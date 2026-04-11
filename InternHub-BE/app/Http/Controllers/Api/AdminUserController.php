<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\TblMahasiswa;
use App\Models\Role;
use App\Models\InternMentor;
use App\Jobs\DeleteInternData;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Carbon\Carbon;

class AdminUserController extends Controller
{
    public function index(Request $request)
    {
        $perPage = $request->input('per_page', 25);

        // Build base query and eager-load roles + mahasiswa/karyawan for mapping
        // Do not rely on identifier/username in users table; use mahasiswa/karyawan relations instead
        $query = User::with(['roles', 'mahasiswa', 'karyawan'])
            ->select([
                'users.user_id', 
                'users.nama', 
                'users.email', 
                'users.status'
            ])
            ->selectRaw("
                (CASE 
                    WHEN EXISTS (SELECT 1 FROM role_user ru JOIN roles r ON ru.role_id = r.role_id WHERE ru.user_id = users.user_id AND r.name = 'admin') 
                         AND EXISTS (SELECT 1 FROM role_user ru JOIN roles r ON ru.role_id = r.role_id WHERE ru.user_id = users.user_id AND r.name = 'mentor') THEN 2
                    WHEN EXISTS (SELECT 1 FROM role_user ru JOIN roles r ON ru.role_id = r.role_id WHERE ru.user_id = users.user_id AND r.name = 'admin') THEN 1
                    WHEN EXISTS (SELECT 1 FROM role_user ru JOIN roles r ON ru.role_id = r.role_id WHERE ru.user_id = users.user_id AND r.name = 'mentor') THEN 3
                    WHEN EXISTS (SELECT 1 FROM role_user ru JOIN roles r ON ru.role_id = r.role_id WHERE ru.user_id = users.user_id AND r.name = 'intern') THEN 4
                    ELSE 5
                END) as role_priority
            ")
            ->orderBy('role_priority', 'asc')
            ->orderBy('users.nama', 'asc');

        // Support simple search across name, email, or related identifiers (nim/nip)
        if ($search = $request->input('q')) {
            $query->where(function ($q) use ($search) {
                $q->where('nama', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            })
            ->orWhereHas('mahasiswa', function ($q) use ($search) {
                $q->where('nim', 'like', "%{$search}%");
            })
            ->orWhereHas('karyawan', function ($q) use ($search) {
                $q->where('nip', 'like', "%{$search}%");
            });
        }

        // Filter by role id (supports 'role_id=3' or 'role_id=3,2' or 'role_ids[]=3')
        $roleIdsParam = null;
        if ($request->has('role_ids')) {
            $roleIdsParam = $request->input('role_ids');
        } elseif ($request->has('role_id')) {
            $roleIdsParam = $request->input('role_id');
        }

        if ($roleIdsParam) {
            if (!is_array($roleIdsParam)) {
                $roleIds = array_filter(array_map('intval', explode(',', $roleIdsParam)));
            } else {
                $roleIds = array_map('intval', $roleIdsParam);
            }

            if (!empty($roleIds)) {
                $query->whereHas('roles', function ($q) use ($roleIds) {
                    $q->whereIn('roles.role_id', $roleIds);
                });
            }
        }

        // Filter by role name (supports 'roles[]=mentor' or 'role=mentor,admin' or single 'role=mentor')
        $rolesParam = null;
        if ($request->has('roles')) {
            $rolesParam = $request->input('roles');
        } elseif ($request->has('role')) {
            $rolesParam = $request->input('role');
        }

        if ($rolesParam) {
            if (!is_array($rolesParam)) {
                $roles = array_filter(array_map('trim', explode(',', $rolesParam)));
            } else {
                $roles = $rolesParam;
            }

            if (!empty($roles)) {
                $query->whereHas('roles', function ($q) use ($roles) {
                    $q->whereIn('name', $roles);
                });
            }
        }

        // Filter by status (supports 'status=active' or 'status=active,inactive' or status[]=active)
        if ($request->has('status')) {
            $statusParam = $request->input('status');
            if (!is_array($statusParam)) {
                $statuses = array_filter(array_map('trim', explode(',', $statusParam)));
            } else {
                $statuses = $statusParam;
            }

            if (!empty($statuses)) {
                $query->whereIn('status', $statuses);
            }
        }

        // Get current user ID to identify self
        $currentUserId = $request->user()?->user_id;

        // Mapper to return only the requested fields
        $formatUser = function ($user) use ($currentUserId) {
            $roles = $user->roles->pluck('name')->toArray();

            // Prefer linked mahasiswa; fallback to students table by email or identifier (nim)
            $mahasiswa = $user->mahasiswa;
            if (! $mahasiswa) {
                $mahasiswa = \App\Models\TblMahasiswa::where('email', $user->email)
                    ->orWhere('nim', $user->identifier)
                    ->first();
            }

            $mulai = $mahasiswa?->mulai_magang ?? null;
            $akhir = $mahasiswa?->akhir_magang ?? null;

            $periode = null;
            try {
                if ($mulai && $akhir) {
                    $periode = Carbon::parse($mulai)->format('j M Y') . ' - ' . Carbon::parse($akhir)->format('j M Y');
                }
            } catch (\Throwable $e) {
                $periode = null;
            }

            return [
                'user_id' => $user->user_id,
                'is_self' => $user->user_id === $currentUserId,
                'id_mahasiswa' => $user->mahasiswa?->id_mahasiswa ?? null,
                'id_karyawan' => $user->karyawan?->id_karyawan ?? null,
                'nama' => $user->nama,
                // If identifier missing on user, prefer mahasiswa.nim when available
                'identifier' => $user->identifier ?? $mahasiswa?->nim ?? null,
                'email' => $user->email,
                'role' => count($roles) ? implode(', ', $roles) : null,
                'status' => $user->status,
                'division' => $mahasiswa?->division ?? $user->karyawan?->division ?? $user->division ?? null,
                'mulai_magang' => $mulai,
                'akhir_magang' => $akhir,
                'periode' => $periode,
            ];
        };

        // If caller requests all users, return full collection (no pagination)
        if ($request->boolean('all')) {
            $users = $query->get()->map($formatUser);
            return response()->json(['data' => $users]);
        }

        // Default: paginated response with the mapped items
        $paginated = $query->paginate($perPage);
        $paginated->getCollection()->transform(function ($user) use ($formatUser) {
            return $formatUser($user);
        });
        return response()->json($paginated);
    }

    public function show($id)
    {
        $user = User::findOrFail($id);

        // Load all relationships including mahasiswa profile
        $user->load('roles', 'permissions', 'mentors', 'interns', 'mahasiswa');

        // Get roles
        $roles = $user->roles->pluck('name')->toArray();
        $role = count($roles) ? $roles[0] : null;

        // Build response data matching profile structure
        $data = [
            'roles' => $roles,
            'permissions' => $user->permissions->pluck('name')->toArray(),
            'identifier_label' => $role === 'intern' ? 'NIM' : ($role === 'mentor' ? 'NIP' : 'ID'),
        ];

        // Add mahasiswa profile data if exists (for interns with profile data)
        $mahasiswa = $user->mahasiswa;
        if ($mahasiswa) {
            $data['mahasiswa'] = [
                'id_mahasiswa' => $mahasiswa->id_mahasiswa,
                'universitas' => $mahasiswa->universitas,
                'jurusan' => $mahasiswa->jurusan,
                'mulai_magang' => $mahasiswa->mulai_magang,
                'akhir_magang' => $mahasiswa->akhir_magang,
                'job_position' => $mahasiswa->job_position,
                'division' => $mahasiswa->division,
                'tempat_lahir' => $mahasiswa->tempat_lahir,
                'tanggal_lahir' => $mahasiswa->tanggal_lahir,
                'nik' => $mahasiswa->nik,
                'gender' => $mahasiswa->gender,
                'semester' => $mahasiswa->semester,
                'jenjang_pendidikan' => $mahasiswa->jenjang_pendidikan,
                'alamat' => $mahasiswa->alamat,
                'nomor_darurat' => $mahasiswa->nomor_darurat,
                'nama_kontak_darurat' => $mahasiswa->nama_kontak_darurat,
                'bank_name' => $mahasiswa->bank_name,
                'bank_account_name' => $mahasiswa->bank_account_name,
                'bank_account_number' => $mahasiswa->bank_account_number,
                'foto_ktm' => $mahasiswa->foto_ktm,
                'foto_ktm_url' => $mahasiswa->foto_ktm ? url("/api/admin/intern-profiles/{$mahasiswa->id_mahasiswa}/photo?type=ktm") : null,
            ];
        }

        // Add work schedule
        if ($user->workSchedule) {
            $schedule = $user->workSchedule;
            $data['work_schedule'] = [
                'id' => $schedule->id,
                'name' => $schedule->name,
                'start_time' => $schedule->start_time,
                'end_time' => $schedule->end_time,
                'days' => $schedule->days,
                'day_times' => $schedule->day_times,
                'tolerance' => $schedule->tolerance,
            ];
        }

        // Add user object last
        $data['user'] = [
            'user_id' => $user->user_id,
            'id_mahasiswa' => $user->mahasiswa?->id_mahasiswa ?? null,
            'id_karyawan' => $user->karyawan?->id_karyawan ?? null,
            'identifier' => $user->identifier,
            'nama' => $user->nama,
            'email' => $user->email,
            // Prefer profile table values (mahasiswa/karyawan) over legacy user columns
            'no_telp' => $user->mahasiswa?->no_telp ?? $user->karyawan?->no_telp ?? null,
            'foto' => $user->mahasiswa?->foto ?? $user->karyawan?->foto ?? null,
            'foto_url' => ($user->mahasiswa?->foto ?? $user->karyawan?->foto) ? url($user->mahasiswa?->foto ?? $user->karyawan?->foto) : null,
            'id_site' => $user->mahasiswa?->id_site ?? $user->karyawan?->id_site ?? null,
            'status' => $user->status,
            'must_change_password' => $user->must_change_password,
            'level' => $user->level,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
            'roles' => $user->roles,
            'permissions' => $user->permissions,
            'site' => $user->site,
            'mentors' => $user->mentors,
            'interns' => $user->interns,
        ];

        return response()->json([
            'success' => true,
            'data' => $data
        ]);
    }

    public function store(Request $request)
    {
        // Support two flows:
        // - Mode A: Assign role to existing mahasiswa via id_mahasiswa (admin action)
        // - Mode B: Create a new user (and optionally a mahasiswa profile) in one request (legacy behaviour)

        // If id_mahasiswa is present, we follow Mode A
        if ($request->has('id_mahasiswa')) {
            $id_mahasiswa = $request->validate([
                'id_mahasiswa' => 'required|exists:students,id_mahasiswa'
            ])['id_mahasiswa'];

            $roles = $request->validate([
                'roles' => 'required|array|min:1',
                'roles.*' => 'in:intern,mentor,admin'
            ])['roles'];

            // Ambil mahasiswa
            $mahasiswa = TblMahasiswa::findOrFail($id_mahasiswa);

            // Jika mahasiswa sudah punya user, error
            if ($mahasiswa->user_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Mahasiswa ini sudah memiliki akun user'
                ], 400);
            }

            // Optional: accept email and identifier to fill missing nim
            $optionalData = $request->validate([
                'email' => 'nullable|email|unique:users,email',
                'identifier' => 'nullable|string|max:255',
            ]);

            try {
                DB::beginTransaction();

                // For interns, prefer to use mahasiswa.nim as identifier; if missing, try to use provided identifier
                if (in_array('intern', $roles) && empty($mahasiswa->nim)) {
                    if (!empty($optionalData['identifier'])) {
                        // Use provided identifier to set mahasiswa nim
                        $existing = TblMahasiswa::where('nim', $optionalData['identifier'])->first();
                        if ($existing && $existing->id_mahasiswa !== $mahasiswa->id_mahasiswa) {
                            DB::rollBack();
                            return response()->json(['success' => false, 'message' => 'Identifier already in use by another mahasiswa'], 422);
                        }
                        $mahasiswa->nim = $optionalData['identifier'];
                        $mahasiswa->save();
                    } else {
                        DB::rollBack();
                        return response()->json([
                            'success' => false,
                            'message' => 'Mahasiswa harus memiliki NIM sebelum di-assign sebagai intern. Silakan isi NIM di profile mahasiswa.'
                        ], 422);
                    }
                }

                $email = $optionalData['email'] ?? null; // email might be optional here but will be validated earlier if provided

                // Buat user record
                $plainPassword = Str::random(12);
                $user = User::create([
                    'nama' => $mahasiswa->nama ?? 'Mahasiswa',
                    'email' => $email,
                    'password' => Hash::make($plainPassword),
                    'status' => 'active',
                ]);

                // Update mahasiswa dengan user_id
                $mahasiswa->update(['user_id' => $user->user_id]);

                // Assign roles
                foreach ($roles as $roleName) {
                    $role = Role::where('name', $roleName)->first();
                    if ($role) {
                        $user->roles()->attach($role->role_id);
                    }
                }

                // Determine whether to attempt email send (only if email provided)
                $email = $optionalData['email'] ?? null;
                $emailSent = false;

                if (!empty($email)) {
                    try {
                        \Illuminate\Support\Facades\Mail::send('emails.welcome', [
                            'nama' => $user->nama,
                            'email' => $user->email,
                            'password' => $plainPassword,
                            'identifier' => $user->mahasiswa?->nim ?? $user->karyawan?->nip ?? null,
                            'role' => implode(', ', $roles),
                        ], function ($message) use ($user) {
                            $message->to($user->email)
                                    ->subject('Akun Anda Telah Dibuat - SIP');
                        });
                        $emailSent = true;
                    } catch (\Exception $e) {
                        DB::rollBack();
                        \Log::warning('Failed to send welcome email during admin create: ' . ($user->email ?? '') . ': ' . $e->getMessage());
                        return response()->json(['success' => false, 'message' => 'Gagal mengirim email. User tidak dibuat.', 'error' => config('app.debug') ? $e->getMessage() : null], 500);
                    }
                }

                DB::commit();

                $user->load('roles', 'mahasiswa');

                return response()->json([
                    'success' => true,
                    'message' => 'User berhasil dibuat dan role di-assign. Password telah dikirim ke email.',
                    'email_sent' => $emailSent,
                    'data' => [
                        'user' => [
                            'user_id' => $user->user_id,
                            'nama' => $user->nama,
                            'identifier' => $user->identifier,
                            'email' => $user->email,
                        ],
                        'mahasiswa' => [
                            'id_mahasiswa' => $mahasiswa->id_mahasiswa,
                            'user_id' => $mahasiswa->user_id,
                            'universitas' => $mahasiswa->universitas,
                        ],
                        'roles' => $user->roles->pluck('name')->toArray(),
                    ]
                ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Gagal membuat user: ' . $e->getMessage()
            ], 400);
        }
        }  // Close the if ($request->has('id_mahasiswa')) block

        // Mode B: Create new user (legacy flow). Input: role (single), identifier, optional mahasiswa fields
        $data = $request->validate([
            'nama' => 'required|string|max:255',
            'identifier' => 'nullable|string|max:255',
            'email' => 'nullable|email|unique:users,email',
            'role' => 'required|in:intern,mentor,admin',
            'no_telp' => 'nullable|string|max:20',
            'status' => 'sometimes|in:active,inactive',
            'universitas' => 'sometimes|nullable|string|max:255',
            'jurusan' => 'sometimes|nullable|string|max:255',
            'mulai_magang' => 'sometimes|nullable|date',
            'akhir_magang' => 'sometimes|nullable|date|after_or_equal:mulai_magang',
            'id_site' => 'sometimes|nullable|exists:sites,id_site'
        ]);

        try {
            DB::beginTransaction();

            // Create user
            $plainPassword = Str::random(12);
            $user = User::create([
                'nama' => $data['nama'],
                'email' => $data['email'] ?? null,
                'password' => Hash::make($plainPassword),
                'status' => $data['status'] ?? 'active',
            ]);

            // Assign role
            $role = Role::where('name', $data['role'])->first();
            if ($role) $user->roles()->attach($role->role_id);

            // If intern role, create mahasiswa profile
            if ($data['role'] === 'intern') {
                $mahasiswaData = [
                    'user_id' => $user->user_id,
                    'nim' => $data['identifier'] ?? null,
                    'nama' => $data['nama'],
                    'universitas' => $data['universitas'] ?? null,
                    'jurusan' => $data['jurusan'] ?? null,
                    'mulai_magang' => $data['mulai_magang'] ?? null,
                    'akhir_magang' => $data['akhir_magang'] ?? null,
                    'id_site' => $data['id_site'] ?? null,
                    'job_position' => $data['job_position'] ?? null,
                    'division' => $data['division'] ?? null,
                ];
                TblMahasiswa::create($mahasiswaData);
            }

            DB::commit();

            // Send email synchronously and include status
            $emailSent = false;
            $emailError = null;
            try {
                \Illuminate\Support\Facades\Mail::send('emails.welcome', [
                    'nama' => $user->nama,
                    'email' => $user->email,
                    'password' => $plainPassword,
                    'identifier' => $data['identifier'] ?? null,
                    'role' => $data['role'],
                ], function ($message) use ($user) {
                    if ($user->email) {
                        $message->to($user->email)
                                ->subject('Akun Anda Telah Dibuat - SIP');
                    }
                });
                $emailSent = true;
            } catch (\Exception $e) {
                \Log::warning('Failed to send welcome email to ' . ($user->email ?? '') . ': ' . $e->getMessage());
                $emailError = $e->getMessage();
            }

            return response()->json(['success' => true, 'message' => 'User berhasil dibuat. Email dengan password telah dikirim.', 'email_sent' => $emailSent, 'email_error' => $emailError, 'data' => ['user' => $user]], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => 'Gagal membuat user: ' . $e->getMessage()], 400);
        }
    }

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);

        // Separate user and mahasiswa fields
        $userData = $request->validate([
            'nama' => 'sometimes|required|string|max:255',
            'email' => 'sometimes|required|email|unique:users,email,' . $user->user_id . ',user_id',
            'password' => 'nullable|string|min:6',
            'status' => 'sometimes|in:active,inactive',
            'roles' => 'sometimes|array',
            'roles.*' => 'integer|exists:roles,role_id',
        ]);

        // Mahasiswa profile fields (if user is intern)
        $mahasiswaData = $request->validate([
            'universitas' => 'sometimes|nullable|string|max:255',
            'jurusan' => 'sometimes|nullable|string|max:255',
            'mulai_magang' => 'sometimes|nullable|date',
            'akhir_magang' => 'sometimes|nullable|date',
            'tempat_lahir' => 'sometimes|nullable|string|max:255',
            'tanggal_lahir' => 'sometimes|nullable|date',
            'nik' => 'sometimes|nullable|string|max:20',
            'job_position' => 'sometimes|nullable|string|max:255',
            'alamat' => 'sometimes|nullable|string',
            'jenjang_pendidikan' => 'sometimes|nullable|string|max:100',
            'gender' => 'sometimes|nullable|in:L,P,M,F,male,female',
            'semester' => 'sometimes|nullable|integer|min:1',
            'bank_name' => 'sometimes|nullable|string|max:255',
            'bank_account_name' => 'sometimes|nullable|string|max:255',
            'bank_account_number' => 'sometimes|nullable|string|max:30',
            'no_telp' => 'sometimes|nullable|string|max:20',
            'id_site' => 'sometimes|nullable|integer|exists:sites,id_site',
        ], [], [
            // Custom attribute names for better error messages
            'universitas' => 'universitas',
            'jurusan' => 'jurusan',
            'mulai_magang' => 'tanggal mulai magang',
            'akhir_magang' => 'tanggal akhir magang',
        ]);

        // File uploads
        $request->validate([
            'foto' => 'nullable|image|max:2048',
            'foto_ktm' => 'nullable|image|max:2048',
        ]);

        // Hash password if provided
        if (!empty($userData['password'])) {
            $userData['password'] = Hash::make($userData['password']);
        } else {
            unset($userData['password']);
        }

        // Handle Foto Upload (prefer storing on mahasiswa profile; fallback to user)
        if ($request->hasFile('foto')) {
            $file = $request->file('foto');
            $filename = time() . '_foto_' . uniqid() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('users', $filename, 'public');
            $storagePath = 'storage/' . $path;
            if ($user->mahasiswa) {
                if ($user->mahasiswa->foto && Storage::exists(str_replace('storage/', 'public/', $user->mahasiswa->foto))) {
                    Storage::delete(str_replace('storage/', 'public/', $user->mahasiswa->foto));
                }
                $mahasiswaData['foto'] = $storagePath;
            } else {
                // Legacy fallback to user table
                if ($user->foto && Storage::exists(str_replace('storage/', 'public/', $user->foto))) {
                    Storage::delete(str_replace('storage/', 'public/', $user->foto));
                }
                $userData['foto'] = $storagePath;
            }
        }

        // Handle Foto KTM Upload (mahasiswa table)
        if ($request->hasFile('foto_ktm')) {
            $file = $request->file('foto_ktm');
            // We'll handle this after mahasiswa is created/updated
            $mahasiswaData['foto_ktm_file'] = $file;
        }

        // Extract roles for separate handling
        $roles = $userData['roles'] ?? null;
        unset($userData['roles']); // Don't pass to update()

        // Update user data
        $user->update($userData);

        // Update roles if provided (with cleanup of conflicting relationships)
        if ($roles !== null) {
            // Get new role names
            $newRoleNames = Role::whereIn('role_id', $roles)->pluck('name')->toArray();
            $isIntern = in_array('intern', $newRoleNames);
            $isMentor = in_array('mentor', $newRoleNames);

            // Clean up conflicting relationships
            if ($isIntern && !$isMentor) {
                // Changing TO intern (not mentor) - remove as mentor from any intern mappings
                $karyawanId = $user->karyawan?->id_karyawan;
                if ($karyawanId) {
                    InternMentor::where('mentor_id', $karyawanId)->delete();
                } else {
                    InternMentor::where('mentor_id', $user->user_id)->delete();
                }
            }
            if ($isMentor && !$isIntern) {
                // Changing TO mentor (not intern) - remove from any intern-mentor mappings as intern
                $mahasiswaId = $user->mahasiswa?->id_mahasiswa;
                if ($mahasiswaId) {
                    InternMentor::where('intern_id', $mahasiswaId)->delete();
                } else {
                    InternMentor::where('intern_id', $user->user_id)->delete();
                }
            }

            $user->roles()->sync($roles);
        }

        // Update or create mahasiswa data
        if (!empty($mahasiswaData) && $user->mahasiswa) {
            // Handle foto_ktm file upload
            if (isset($mahasiswaData['foto_ktm_file'])) {
                $file = $mahasiswaData['foto_ktm_file'];
                // Delete old file
                if ($user->mahasiswa->foto_ktm && Storage::exists(str_replace('storage/', 'public/', $user->mahasiswa->foto_ktm))) {
                    Storage::delete(str_replace('storage/', 'public/', $user->mahasiswa->foto_ktm));
                }
                $filename = time() . '_ktm_' . uniqid() . '.' . $file->getClientOriginalExtension();
                $path = $file->storeAs('users', $filename, 'public');
                $mahasiswaData['foto_ktm'] = 'storage/' . $path;
                unset($mahasiswaData['foto_ktm_file']);
            }
            $user->mahasiswa->update($mahasiswaData);
        } elseif (!empty($mahasiswaData)) {
            // Handle foto_ktm file upload for new mahasiswa record
            if (isset($mahasiswaData['foto_ktm_file'])) {
                $file = $mahasiswaData['foto_ktm_file'];
                $filename = time() . '_ktm_' . uniqid() . '.' . $file->getClientOriginalExtension();
                $path = $file->storeAs('users', $filename, 'public');
                $mahasiswaData['foto_ktm'] = 'storage/' . $path;
                unset($mahasiswaData['foto_ktm_file']);
            }
            // Create mahasiswa profile if it doesn't exist
            $mahasiswaData['user_id'] = $user->user_id;
            $user->mahasiswa()->create($mahasiswaData);
        }

        // Return minimal response with updated fields
        return response()->json([
            'user_id' => $user->user_id,
            'status' => $user->status,
            'roles' => $user->roles->pluck('name'),
        ]);
    }

    /**
     * Update roles for a user (sync roles by role_id array)
     */
    public function updateRoles(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $data = $request->validate([
            'roles' => 'required|array',
            'roles.*' => 'integer|exists:roles,role_id',
        ]);

        // Get new role names
        $newRoleNames = Role::whereIn('role_id', $data['roles'])->pluck('name')->toArray();
        $isIntern = in_array('intern', $newRoleNames);
        $isMentor = in_array('mentor', $newRoleNames);

        // Clean up conflicting relationships
        if ($isIntern && !$isMentor) {
            // Changing TO intern (not mentor) - remove as mentor from any intern mappings
            $karyawanId = $user->karyawan?->id_karyawan;
            if ($karyawanId) {
                InternMentor::where('mentor_id', $karyawanId)->delete();
            } else {
                // fallback to legacy user-based pivot
                InternMentor::where('mentor_id', $user->user_id)->delete();
            }
        }
        if ($isMentor && !$isIntern) {
            // Changing TO mentor (not intern) - remove from any intern-mentor mappings as intern
            $mahasiswaId = $user->mahasiswa?->id_mahasiswa;
            if ($mahasiswaId) {
                InternMentor::where('intern_id', $mahasiswaId)->delete();
            } else {
                InternMentor::where('intern_id', $user->user_id)->delete();
            }
        }

        $user->roles()->sync($data['roles']);
        $user->load('roles');

        return response()->json([
            'success' => true,
            'user_id' => $user->user_id,
            'roles' => $user->roles->pluck('name'),
        ]);
    }

    /**
     * Update active status for a user (active|inactive)
     */
    public function updateStatus(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $data = $request->validate([
            'status' => 'required|in:active,inactive',
        ]);

        $user->status = $data['status'];
        $user->save();

        if ($user->checkHasRole('intern')) {
            $mahasiswaId = $user->mahasiswa?->id_mahasiswa;
            $mappingQuery = InternMentor::query();

            if ($mahasiswaId) {
                $mappingQuery->where('intern_id', $mahasiswaId);
            } else {
                $mappingQuery->where('intern_id', $user->user_id);
            }

            if ($data['status'] === 'inactive') {
                $mappingQuery->where('is_active', true)->update([
                    'is_active' => false,
                    'end_date' => Carbon::now()->toDateString()
                ]);
            } elseif ($data['status'] === 'active') {
                $mappingQuery->where('is_active', false)
                    ->orderBy('id', 'desc')
                    ->limit(1)
                    ->update([
                        'is_active' => true,
                        'end_date' => null
                    ]);
            }
        }

        return response()->json([
            'status' => $user->status,
        ]);
    }

    public function destroy($id)
    {
        $user = User::findOrFail($id);

        // Hanya cabut akses login (soft delete user)
        $user->delete();

        return response()->json([
            'success' => true,
            'message' => 'User berhasil dihapus.'
        ]);
    }

    /**
     * Serve user foto file (admin-only).
     * Supports query param `type` = 'foto' (default) or 'ktm' to serve profile photo or foto_ktm respectively.
     * Example: GET /api/admin/users/{id}/foto?type=ktm
     */
    public function foto(Request $request, $id)
    {
        $user = User::findOrFail($id);

        // Determine which field to serve
        $type = strtolower($request->query('type', 'foto'));
        if (!in_array($type, ['foto', 'ktm', 'foto_ktm'])) {
            return response()->json(['message' => "Invalid type parameter. Use 'foto' or 'ktm'."], 400);
        }
        $field = ($type === 'ktm' || $type === 'foto_ktm') ? 'foto_ktm' : 'foto';

        $value = $user->{$field} ?? null;
        if (!$value) {
            return response()->json(['message' => 'Foto tidak ditemukan'], 404);
        }

        // Security check
        $me = $request->user();
        if (!$me) return response()->json(['message' => 'Unauthorized'], 401);

        if (!$me->hasRole('admin')) {
            // If not admin, must be mentor and must be guiding this intern
            if (!$me->hasRole('mentor')) {
                return response()->json(['message' => 'Akses ditolak. Anda bukan admin atau mentor.'], 403);
            }
            
            // Direct DB check to avoid any relationship scope issues
            $mentorKaryawanId = $me->karyawan?->id_karyawan;
            $internMahasiswaId = $user->mahasiswa?->id_mahasiswa;

            if ($mentorKaryawanId && $internMahasiswaId) {
                $isGuiding = \DB::table('intern_mentors')
                    ->where('mentor_id', $mentorKaryawanId)
                    ->where('intern_id', $internMahasiswaId)
                    ->where('is_active', true)
                    ->exists();
            } else {
                // fallback to legacy user-based check
                $isGuiding = \DB::table('intern_mentors')
                    ->where('mentor_user_id', $me->user_id)
                    ->where('intern_user_id', $user->user_id)
                    ->where('is_active', true)
                    ->exists();
            }

            if (! $isGuiding) {
                return response()->json(['message' => 'Akses ditolak. Intern ini tidak berada di bawah bimbingan Anda.'], 403);
            }
        }

        $path = str_replace('storage/', '', $value);

        if (!Storage::disk('public')->exists($path)) {
            return response()->json(['message' => 'File tidak ditemukan'], 404);
        }

        $filename = basename($path);
        
        // Use private cache to prevent sharing between roles/users
        return Storage::disk('public')->response($path, $filename, [
            'Cache-Control' => 'private, max-age=604800, must-revalidate'
        ]);
    }
}
