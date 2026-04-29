<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Role;
use App\Models\Permission;
use App\Models\InternMentor;
use App\Models\WorkSchedule;
use App\Models\TblMahasiswa;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class UserController extends Controller
{
    // ==================== USER MANAGEMENT ====================

    /**
     * List semua user dengan filter Role dan Status
     * Master table dengan satu endpoint
     */
    public function index(Request $request)
    {
        $query = User::select([
            'users.user_id', 'users.nama', 'users.email', 'users.status', 'users.created_at', 'users.must_change_password',
            // Prefer students.division (intern profile), fallback to users.division (for admin/mentor stored on users)
            \DB::raw("COALESCE(students.division, users.division) as division")
        ])->with(['roles:role_id,name', 'site:id_site,nama_site'])
        ->leftJoin('students', 'users.user_id', '=', 'students.user_id');

        // Search by nama, username, identifier (NIP/NIM)
        if ($request->has('q')) {
            $search = $request->q;
            $query->where(function ($q) use ($search) {
                $q->where('nama', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('students.nim', 'like', "%{$search}%");
            })->orWhereHas('karyawan', function($q) use ($search) {
                $q->where('nip', 'like', "%{$search}%");
            });
        }

        // Filter by role (supports single `role=admin` or multiple via `roles[]=admin&roles[]=mentor` or CSV `role=admin,mentor`)
        $rolesParam = null;
        if ($request->has('roles')) {
            $rolesParam = $request->roles;
        } elseif ($request->has('role')) {
            $rolesParam = $request->role;
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

        // Filter by status (supports single `status=active` or multiple `status=active,inactive` or `status[]=active`)
        if ($request->has('status')) {
            $statusParam = $request->status;
            if (!is_array($statusParam)) {
                $statuses = array_filter(array_map('trim', explode(',', $statusParam)));
            } else {
                $statuses = $statusParam;
            }

            if (!empty($statuses)) {
                $query->whereIn('status', $statuses);
            }
        }

        // Filter by site
        if ($request->has('id_site')) {
            $query->where('id_site', $request->id_site);
        }

        // Filter by created_at single date (YYYY-MM-DD) OR by created_month (YYYY-MM)
        if ($request->has('created_month')) {
            try {
                $start = Carbon::createFromFormat('Y-m', $request->created_month)->startOfMonth()->toDateString();
                $end = Carbon::createFromFormat('Y-m', $request->created_month)->endOfMonth()->toDateString();
                $query->whereBetween('created_at', [$start, $end]);
            } catch (\Exception $e) {
                return response()->json(['success' => false, 'message' => 'Format created_month tidak valid (gunakan YYYY-MM)'], 400);
            }
        } elseif ($request->has('created_at')) {
            try {
                $date = Carbon::parse($request->created_at)->toDateString();
                $query->whereDate('created_at', $date);
            } catch (\Exception $e) {
                return response()->json(['success' => false, 'message' => 'Format created_at tidak valid (gunakan YYYY-MM-DD)'], 400);
            }
        }

        $users = $query->paginate($request->per_page ?? 20);

        return response()->json([
            'success' => true,
            'data' => $users
        ]);
    }

    /**
     * Detail user
     */
    public function show($id)
    {
        // Just find with more relations, no strict select needed as it is single item
        $user = User::with(['roles', 'permissions', 'mentors', 'interns', 'mahasiswa'])->find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User tidak ditemukan'
            ], 404);
        }

        // Build response data
        $data = [
            'roles' => $user->getRoleNames(),
            'permissions' => $user->getGrantedPermissions(),
            'identifier_label' => $user->getIdentifierLabel(),
        ];

        // Add mahasiswa profile data if exists (for interns with profile data)
        if ($user->mahasiswa) {
            $mahasiswa = $user->mahasiswa;
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
            ];
        }

        // Get work schedule — semua intern menggunakan schedule yang active (global)
        $work_schedule = null;
        $schedule = WorkSchedule::getActive();
        if ($schedule) {
            $work_schedule = [
                'id' => $schedule->id,
                'name' => $schedule->name,
                'start_time' => $schedule->start_time,
                'end_time' => $schedule->end_time,
                'days' => $schedule->days,
                'day_times' => $schedule->day_times,
                'tolerance' => $schedule->tolerance,
            ];
        }

        if ($work_schedule) {
            $data['work_schedule'] = $work_schedule;
        }

        // Add user object with computed URLs (prefer profile tables)
        $profileFoto = $user->mahasiswa?->foto ?? $user->karyawan?->foto ?? $user->foto ?? null;
        $user->foto_url = $profileFoto ? url($profileFoto) : null;
        $user->foto_ktm_url = $user->mahasiswa?->foto_ktm ? url("/api/users/{$user->user_id}/foto?type=ktm") : null;

        // Expose profile-aware photo field for backward compatibility
        $user->foto = $profileFoto;
        // Add profile identifiers for consumers that expect them
        $user->id_mahasiswa = $user->mahasiswa?->id_mahasiswa ?? null;
        $user->id_karyawan = $user->karyawan?->id_karyawan ?? null;
        $data['user'] = $user;

        return response()->json([
            'success' => true,
            'data' => $data
        ]);
    }



    /**
     * Create user baru (Admin)
     * Password di-generate otomatis dan dikirim via email
     * 
     * PENTING: Users table hanya untuk login (username, password, email)
     * Profile data (alamat, bank, etc) disimpan di students untuk mahasiswa
     */
    public function store(Request $request)
    {
        $request->validate([
            // username and identifier moved to profile tables; users table keeps minimal login fields
            'identifier' => 'required|string|max:50', // NIP atau NIM (stored on mahasiswa/karyawan)
            'nama' => 'required|string|max:255',
            'email' => 'required|email|max:255|unique:users,email', // Email wajib untuk kirim password
            'no_telp' => 'nullable|string|max:20',
            'id_site' => 'nullable|exists:sites,id_site',
            'status' => 'nullable|in:active,inactive',
            'roles' => 'required|array|min:1', // Array of role IDs
            'roles.*' => 'integer|exists:roles,role_id',
            'foto' => 'nullable|image|max:2048', // Max 2MB
            
            // Optional: link ke mahasiswa existing
            'mahasiswa_id' => 'nullable|integer|exists:students,id_mahasiswa',

            // Profile data untuk mahasiswa (opsional, disimpan di students)
            'universitas' => 'nullable|string|max:255',
            'jurusan' => 'nullable|string|max:255',
            'semester' => 'nullable|integer|min:1|max:14',
            'mulai_magang' => 'nullable|date',
            'akhir_magang' => 'nullable|date|after_or_equal:mulai_magang',
            'alamat' => 'nullable|string|max:500',
            'jenjang_pendidikan' => 'nullable|string|max:50',
            'nomor_darurat' => 'nullable|string|max:20',
            'nama_kontak_darurat' => 'nullable|string|max:255',
            'foto_ktm' => 'nullable|image|max:2048', // Max 2MB
            'gender' => 'nullable|string|max:20',
            'tempat_lahir' => 'nullable|string|max:255',
            'tanggal_lahir' => 'nullable|date',
            'nik' => 'nullable|string|max:20',
            'bank_name' => 'nullable|string|max:100',
            'bank_account_name' => 'nullable|string|max:255',
            'bank_account_number' => 'nullable|string|max:30',
            'work_schedule_id' => 'nullable|integer|exists:work_schedules,id',
        ]);

        // Generate random password (12 chars: mix uppercase, lowercase, digits, special chars)
        $password = \Illuminate\Support\Str::random(8);
        $password = $password . rand(100, 999) . '!'; // Tambah digits dan special char

        // Handle Foto Upload
        $fotoPath = null;
        if ($request->hasFile('foto')) {
            $file = $request->file('foto');
            $filename = time() . '_foto_' . uniqid() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('users', $filename, 'public');
            $fotoPath = 'storage/' . $path;
        }

        // Create user + link to existing mahasiswa (optional) inside a transaction
        try {
            DB::beginTransaction();

            // Create user with minimal fields (login only)
            // Create user with minimal login fields only
            $user = User::create([
                'password' => Hash::make($password),
                'nama' => $request->nama,
                'email' => $request->email,
                'status' => $request->status ?? 'active',
                'foto' => $fotoPath,
                'must_change_password' => true, // Force user to change password on first login
            ]);

            // If mahasiswa_id diberikan, link ke mahasiswa yang sudah ada
            if ($request->filled('mahasiswa_id')) {
                $mahasiswa = TblMahasiswa::find($request->mahasiswa_id);
                if (!$mahasiswa) {
                    throw new \Exception('Mahasiswa tidak ditemukan');
                }
                if (!empty($mahasiswa->user_id)) {
                    throw new \Exception('Mahasiswa sudah terkait dengan akun user');
                }
                $mahasiswa->update(['user_id' => $user->user_id]);
            } else {
                // Jika ada profile data, create record di students baru
                if ($request->filled('universitas') || $request->filled('alamat')) {
                    $mahasiswaData = [
                        'user_id' => $user->user_id,  // Link ke users table
                        'nim' => $request->identifier,
                        'nama' => $request->nama,
                        'no_telp' => $request->no_telp,
                        'id_site' => $request->id_site,
                        'universitas' => $request->universitas,
                        'jurusan' => $request->jurusan,
                        'semester' => $request->semester,
                        'mulai_magang' => $request->mulai_magang,
                        'akhir_magang' => $request->akhir_magang,
                        'alamat' => $request->alamat,
                        'jenjang_pendidikan' => $request->jenjang_pendidikan,
                        'nomor_darurat' => $request->nomor_darurat,
                        'nama_kontak_darurat' => $request->nama_kontak_darurat,
                        'gender' => $request->gender,
                        'tempat_lahir' => $request->tempat_lahir,
                        'tanggal_lahir' => $request->tanggal_lahir,
                        'nik' => $request->nik,
                        'bank_name' => $request->bank_name,
                        'bank_account_name' => $request->bank_account_name,
                        'bank_account_number' => $request->bank_account_number,
                        'work_schedule_id' => $request->work_schedule_id,
                    ];

                    // Handle foto_ktm
                    if ($request->hasFile('foto_ktm')) {
                        $file = $request->file('foto_ktm');
                        $filename = time() . '_ktm_' . uniqid() . '.' . $file->getClientOriginalExtension();
                        $path = $file->storeAs('users', $filename, 'public');
                        $mahasiswaData['foto_ktm'] = 'storage/' . $path;
                    }

                    \App\Models\TblMahasiswa::create($mahasiswaData);
                }
            }

            // Attach roles (expecting array of role IDs)
            if ($request->has('roles')) {
                $user->roles()->attach($request->roles);
            }

            // Attempt to send welcome email BEFORE committing so we can rollback on failure (if email provided)
            $emailSent = false;
            $emailError = null;
            if (!empty($user->email)) {
                try {
                    \Illuminate\Support\Facades\Mail::send('emails.welcome-new-user', [
                        'user' => $user,
                        'password' => $password,
                        'login_url' => config('app.frontend_url', 'http://localhost:3000') . '/login',
                    ], function ($message) use ($user) {
                        $message->to($user->email);
                        $message->subject('Akun SIP - Kredensial Login');
                    });
                    $emailSent = true;
                } catch (\Exception $e) {
                    DB::rollBack();
                    \Illuminate\Support\Facades\Log::error('Failed to send welcome email during user creation: ' . ($user->email ?? 'unknown'), ['error' => $e->getMessage()]);
                    return response()->json(['success' => false, 'message' => 'Gagal mengirim email. User tidak dibuat.', 'error' => config('app.debug') ? $e->getMessage() : null], 500);
                }
            }

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['success' => false, 'message' => 'Gagal membuat user: ' . $e->getMessage()], 400);
        }

        return response()->json([
            'success' => true,
            'message' => 'User berhasil dibuat. Password telah dikirim ke email user.',
            'email_sent' => $emailSent,
            'email_error' => $emailError,
            'data' => $user->load('roles')
        ], 201);
    }

    /**
     * Update user (Admin)
     * PENTING: Users table hanya untuk login fields
     * Profile data diupdate di students
     */
    public function update(Request $request, $id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User tidak ditemukan'
            ], 404);
        }

        $request->validate([
            // username/identifier moved to profile tables; validate identifier as string (uniqueness maintained on profile tables)
            'password' => 'nullable|string|min:6',
            'identifier' => 'sometimes|required|string|max:50',
            'nama' => 'sometimes|required|string|max:255',
            'email' => 'nullable|email|max:255',
            'no_telp' => 'nullable|string|max:20',
            'id_site' => 'nullable|exists:sites,id_site',
            'status' => 'nullable|in:active,inactive',
            'roles' => 'sometimes|required|array|min:1',
            'roles.*' => 'integer|exists:roles,role_id',
            'foto' => 'nullable|image|max:2048', // Max 2MB
            
            // Profile fields (untuk students)
            'universitas' => 'nullable|string|max:255',
            'jurusan' => 'nullable|string|max:255',
            'semester' => 'nullable|integer|min:1|max:14',
            'mulai_magang' => 'nullable|date',
            'akhir_magang' => 'nullable|date|after_or_equal:mulai_magang',
            'alamat' => 'nullable|string|max:500',
            'jenjang_pendidikan' => 'nullable|string|max:50',
            'nomor_darurat' => 'nullable|string|max:20',
            'nama_kontak_darurat' => 'nullable|string|max:255',
            'foto_ktm' => 'nullable|image|max:2048', // Max 2MB
            'gender' => 'nullable|string|max:20',
            'tempat_lahir' => 'nullable|string|max:255',
            'tanggal_lahir' => 'nullable|date',
            'nik' => 'nullable|string|max:20',
            'bank_name' => 'nullable|string|max:100',
            'bank_account_name' => 'nullable|string|max:255',
            'bank_account_number' => 'nullable|string|max:30',
            'work_schedule_id' => 'nullable|integer|exists:work_schedules,id',
        ]);

        // Update user table (login fields only)
        $userData = $request->only([
            'username', 'identifier', 'nama', 'email', 'no_telp', 'id_site', 'status'
        ]);

        if ($request->filled('password')) {
            $userData['password'] = Hash::make($request->password);
        }

        // Handle Foto Upload
        if ($request->hasFile('foto')) {
            $file = $request->file('foto');
             // Delete old file
            if ($user->foto && \Illuminate\Support\Facades\Storage::exists(str_replace('storage/', 'public/', $user->foto))) {
                \Illuminate\Support\Facades\Storage::delete(str_replace('storage/', 'public/', $user->foto));
            }
            $filename = time() . '_foto_' . uniqid() . '.' . $file->getClientOriginalExtension();
            $path = $file->storeAs('users', $filename, 'public');
            $userData['foto'] = 'storage/' . $path;
        }

        $user->update($userData);

        // If status was provided in the update, toggle mapping is_active for intern
        if ($request->has('status') && $user->checkHasRole('intern')) {
            $mahasiswaId = $user->mahasiswa?->id_mahasiswa;
            $mappingQuery = InternMentor::query();

            if ($mahasiswaId) {
                $mappingQuery->where('intern_id', $mahasiswaId);
            } else {
                $mappingQuery->where('intern_id', $user->user_id);
            }

            if ($request->status === 'inactive') {
                $mappingQuery->where('is_active', true)->update([
                    'is_active' => false,
                    'end_date' => Carbon::now()->toDateString()
                ]);
            } elseif ($request->status === 'active') {
                // Restore most recent inactive mapping
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
            'success' => true,
            'message' => 'User berhasil diperbarui',
            'data' => $user->load('roles')
        ]);
    }

    /**
     * Delete/Deactivate user (Admin)
     */
    public function destroy($id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User tidak ditemukan'
            ], 404);
        }

        // Soft delete: set status to inactive
        $user->update(['status' => 'inactive']);

        // If user is intern, deactivate their mentor mappings
        if ($user->checkHasRole('intern')) {
            $mahasiswaId = $user->mahasiswa?->id_mahasiswa;
            if ($mahasiswaId) {
                InternMentor::where('intern_id', $mahasiswaId)
                    ->where('is_active', true)
                    ->update([
                        'is_active' => false,
                        'end_date' => Carbon::now()->toDateString()
                    ]);
            } else {
                // fallback to legacy user-based pivot (if still present)
                InternMentor::where('intern_id', $user->user_id)
                    ->where('is_active', true)
                    ->update([
                        'is_active' => false,
                        'end_date' => Carbon::now()->toDateString()
                    ]);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'User berhasil dinonaktifkan'
        ]);
    }

    /**
     * Hard delete user (Admin - hati-hati!)
     */
    public function forceDelete($id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User tidak ditemukan'
            ], 404);
        }

        $user->delete();

        return response()->json([
            'success' => true,
            'message' => 'User berhasil dihapus permanen'
        ]);
    }

    /**
     * Admin-only: update user's active status (active|inactive)
     */
    public function updateStatus(Request $request, $id)
    {
        $user = User::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User tidak ditemukan'
            ], 404);
        }

        $request->validate([
            'status' => 'required|in:active,inactive',
        ]);

        $user->status = $request->status;
        $user->save();
        
        // If status changes, toggle mapping is_active for intern
        if ($user->checkHasRole('intern')) {
            $mahasiswaId = $user->mahasiswa?->id_mahasiswa;
            $mappingQuery = InternMentor::query();

            if ($mahasiswaId) {
                $mappingQuery->where('intern_id', $mahasiswaId);
            } else {
                $mappingQuery->where('intern_id', $user->user_id);
            }

            if ($request->status === 'inactive') {
                $mappingQuery->where('is_active', true)->update([
                    'is_active' => false,
                    'end_date' => Carbon::now()->toDateString()
                ]);
            } elseif ($request->status === 'active') {
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
            'success' => true,
            'message' => 'Status user berhasil diperbarui',
            'data' => ['user_id' => $user->user_id, 'status' => $user->status]
        ]);
    }

    // ==================== INTERN-MENTOR MAPPING ====================
    // Moved to InternMentorController

    // ==================== PERMISSION MANAGEMENT ====================

    /**
     * Get semua permission yang tersedia
     */
    public function getPermissions()
    {
        $permissions = Permission::all()->groupBy('group');

        return response()->json([
            'success' => true,
            'data' => $permissions
        ]);
    }

    /**
     * Get permission user tertentu
     */
    public function getUserPermissions($userId)
    {
        $user = User::with('permissions')->find($userId);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User tidak ditemukan'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'user_id' => $user->user_id,
                'nama' => $user->nama,
                'roles' => $user->getRoleNames(),
                'permissions' => $user->permissions->map(function ($p) {
                    return [
                        'permission_id' => $p->permission_id,
                        'name' => $p->name,
                        'label' => $p->label,
                        'group' => $p->group,
                        'is_granted' => $p->pivot->is_granted,
                    ];
                }),
            ]
        ]);
    }

    /**
     * GET: effective permissions for a user (combines role-level and user overrides)
     */
    /**
     * GET: effective permissions for a user (combines role-level and user overrides)
     * Supports filtering by role scope: ?role=admin
     */
    public function getUserPermissionsEffective(Request $request, $userId)
    {
        $user = User::with(['roles', 'permissions'])->find($userId);

        if (! $user) {
            return response()->json(['success' => false, 'message' => 'User tidak ditemukan'], 404);
        }

        // Prepare user roles
        $userRoleNames = $user->getRoleNames();

        // Load all permissions with their roles to avoid N+1
        $allPermissions = \App\Models\Permission::with('roles')->get();

        // Map user overrides: permission_id => is_granted (true/false)
        $overrides = $user->permissions->mapWithKeys(function ($p) {
            return [$p->permission_id => (bool)$p->pivot->is_granted];
        })->toArray();

        $result = $allPermissions->map(function ($perm) use ($userRoleNames, $overrides) {
            $rolesHaving = $perm->roles->pluck('name')->toArray();
            // intersection to find which of user's roles provide this permission
            $inheritedFrom = array_values(array_intersect($rolesHaving, $userRoleNames));

            $userOverride = array_key_exists($perm->permission_id, $overrides) ? $overrides[$perm->permission_id] : null;
            $effective = $userOverride !== null ? $userOverride : (!empty($inheritedFrom));

            return [
                'permission_id' => $perm->permission_id,
                'name' => $perm->name,
                'label' => $perm->label,
                'group' => $perm->group,
                'inherited_from_roles' => $inheritedFrom,
                'user_override' => $userOverride,
                'effective' => (bool)$effective,
            ];
        });

        // Default: show ONLY relevant permissions (inherited or overridden) unless ?all=true
        if (! $request->boolean('all')) {
            $result = $result->filter(function ($p) {
                return !empty($p['inherited_from_roles']) || $p['user_override'] !== null;
            });
        }
        
        $result = $result->values();

        // Build summary counts for the modal
        $inheritedCount = $result->filter(fn($p) => !empty($p['inherited_from_roles']))->count();
        $overridesCount = $result->filter(fn($p) => $p['user_override'] !== null)->count();
        $effectiveGrantedCount = $result->filter(fn($p) => $p['effective'])->count();

        return response()->json([
            'success' => true,
            'data' => [
                'user_id' => $user->user_id,
                'nama' => $user->nama,
                'roles' => $userRoleNames,
                'summary' => [
                    'inherited' => $inheritedCount,
                    'overrides' => $overridesCount,
                    'effective_granted' => $effectiveGrantedCount,
                ],
                'permissions' => $result,
            ]
        ]);
    }

    /**
     * Update permission user (User Permission Modal)
     * Double role tetap dikelola lewat satu modal terpadu
     */
    public function updateUserPermissions(Request $request, $userId)
    {
        $user = User::find($userId);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User tidak ditemukan'
            ], 404);
        }

        $request->validate([
            'permissions' => 'required|array',
            'permissions.*.permission_id' => 'required|exists:permissions,permission_id',
            'permissions.*.is_granted' => 'required|boolean',
        ]);

        // Normalize incoming permissions to map: id => is_granted
        $input = [];
        $ids = [];
        foreach ($request->permissions as $perm) {
            $pid = (int)$perm['permission_id'];
            $input[$pid] = ['is_granted' => (bool)$perm['is_granted']];
            $ids[] = $pid;
        }

        // Validate scope via policy helper
        $policy = new \App\Policies\UserPermissionPolicy();
        $invalid = $policy->validatePermissionsScope($request->user(), $user, $ids);
        if (!empty($invalid)) {
            return response()->json([
                'success' => false,
                'message' => 'Permission diluar scope role user',
                'invalid_permission_ids' => $invalid
            ], 422);
        }

        // Use model helper to sync scoped permissions (enforces scope internally too)
        try {
            $user->syncScopedPermissions($request->permissions);
        } catch (\InvalidArgumentException $e) {
            return response()->json(['success' => false, 'message' => $e->getMessage()], 422);
        }

        return response()->json([
            'success' => true,
            'message' => 'Permission user berhasil diperbarui',
            'data' => [
                'user_id' => $user->user_id,
                'granted_permissions' => $user->getGrantedPermissions(),
            ]
        ]);
    }

    // ==================== ROLE MANAGEMENT ====================

    /**
     * Get semua role
     */
    public function getRoles()
    {
        $roles = Role::all();

        return response()->json([
            'success' => true,
            'data' => $roles
        ]);
    }

    /**
     * Update roles user
     */
    public function updateUserRoles(Request $request, $userId)
    {
        $user = User::find($userId);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User tidak ditemukan'
            ], 404);
        }

        $request->validate([
            'roles' => 'required|array|min:1',
            'roles.*' => 'integer|exists:roles,role_id',
        ]);

        // Sync role IDs directly
        $user->roles()->sync($request->roles);

        return response()->json([
            'success' => true,
            'message' => 'Role user berhasil diperbarui',
            'data' => [
                'user_id' => $user->user_id,
                'roles' => $user->getRoleNames(),
            ]
        ]);
    }

    // ==================== MENTOR: GET MY INTERNS ====================

    /**
     * Get list intern yang dibimbing mentor (untuk mentor yang login)
     */
    public function getMyInterns(Request $request)
    {
        $user = $request->user();

        // Additional filters: universitas, min_progress/max_progress (0-100), search by name
        // Also allow caller to specify acting role (e.g. "as_role=mentor") when user has multiple roles
        $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'universitas' => 'nullable|string',
            'min_progress' => 'nullable|numeric|min:0|max:100',
            'max_progress' => 'nullable|numeric|min:0|max:100',
            'search' => 'nullable|string',
            'as_role' => 'nullable|in:mentor,admin',
            'status' => 'nullable|string',
        ]);

        // Ensure min_progress is not greater than max_progress when both provided
        if ($request->filled('min_progress') && $request->filled('max_progress')) {
            if (floatval($request->min_progress) > floatval($request->max_progress)) {
                return response()->json(['success' => false, 'message' => 'min_progress tidak boleh lebih besar dari max_progress'], 400);
            }
        }

        // Honor explicit acting role if provided (useful if user has multiple roles)
        $asRole = $request->input('as_role');
        // Check route prefix/segment to determine context if not provided
        // URL: /api/admin/interns -> segment(2) = admin
        // URL: /api/mentor/interns -> segment(2) = mentor
        if (!$asRole) {
            $prefix = $request->segment(2);
            if ($prefix === 'admin' && $user->hasRole('admin')) {
                $asRole = 'admin';
            } elseif ($prefix === 'mentor' && $user->hasRole('mentor')) {
                $asRole = 'mentor';
            } elseif ($user->isAdmin()) {
                $asRole = 'admin'; // Fallback for admin
            }
        }

        if ($asRole === 'mentor') {
        // Acting as mentor: ensure user has profile and role
        if (!$user->hasRole('mentor')) {
            return response()->json(['success' => false, 'message' => 'Anda tidak memiliki role mentor'], 403);
        }

        $direct = $user->interns()->pluck('users.user_id')->toArray();
        $viaStudents = \DB::table('intern_mentors as im')
            ->join('students as s', 's.id_mahasiswa', '=', 'im.intern_id')
            ->where('im.is_active', 1)
            ->where(function($q) use ($user) {
                $q->where('im.mentor_user_id', $user->user_id);
                if ($user->karyawan?->id_karyawan) {
                    $q->orWhere('im.mentor_id', $user->karyawan->id_karyawan);
                }
            })
            ->pluck('s.user_id')
            ->filter()
            ->toArray();
        $internIds = array_unique(array_filter(array_merge($direct, $viaStudents)));

        $internsQuery = \App\Models\User::whereIn('users.user_id', $internIds)
            ->join('students', 'users.user_id', '=', 'students.user_id')
            ->select([
                'users.user_id', 'users.nama', 'students.nim as identifier', 'students.universitas', 'students.jurusan',
                'students.mulai_magang', 'students.akhir_magang', 'users.status', 'students.id_site', 'students.foto',
                'students.id_mahasiswa'
            ])->with('mahasiswa.site:id_site,nama_site');
    } elseif ($asRole === 'admin') {
            if (!$user->hasRole('admin')) {
                return response()->json(['success' => false, 'message' => 'Anda tidak memiliki role admin'], 403);
            }
            $internsQuery = User::whereHas('roles', fn($q) => $q->where('name', 'intern'))
                ->join('students', 'users.user_id', '=', 'students.user_id')
                ->select([
                    'users.user_id', 'users.nama', 'students.nim as identifier', 'students.universitas', 'students.jurusan',
                    'students.mulai_magang', 'students.akhir_magang', 'users.status', 'students.id_site', 'students.foto',
                    'students.id_mahasiswa'
                ])->with('mahasiswa.site:id_site,nama_site');
        } else {
            return response()->json(['success' => false, 'message' => 'Role tidak valid atau Anda bukan mentor'], 403);
        }

        // Filter by status (supports single `status=active` or multiple `status=active,inactive` or `status[]=active`)
        // Default: show only active interns if no status filter provided
        if ($request->has('status')) {
            $statusParam = $request->status;
            if (!is_array($statusParam)) {
                $statuses = array_filter(array_map('trim', explode(',', $statusParam)));
            } else {
                $statuses = $statusParam;
            }

            if (!empty($statuses)) {
                $internsQuery->whereIn('users.status', $statuses);
            }
        } else {
            // Default: only ACTIVE interns for non-admin contexts
            // Admin acting role should see all interns (including inactive) by default
            if ($asRole !== 'admin') {
                $internsQuery->where('users.status', 'active');
            }
        }

        // Optional period filter: start_date & end_date must be provided together
        $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
        ]);

        // Debug log: acting role and include_progress flag
        \Illuminate\Support\Facades\Log::info('getMyInterns: request', [
            'user_id' => $user->user_id,
            'as_role' => $asRole,
            'include_progress' => $request->boolean('include_progress'),
            'query_params' => $request->query(),
        ]);

        // Apply client-side filters for name and universitas early (so they limit total set)
        if ($request->filled('search')) {
            $internsQuery->where('users.nama', 'like', "%{$request->search}%");
        }

        if ($request->filled('universitas')) {
            $internsQuery->whereRaw('TRIM(students.universitas) = ?', [trim($request->universitas)]);
        }

        if ($request->filled('start_date')) {
            $filterStart = $request->start_date;
            // Handle month-only format 'YYYY-MM'
            if (strlen($filterStart) === 7) {
                $filterStart .= '-01';
            }
            $filterEnd = $request->filled('end_date') ? $request->end_date : null;
            if ($filterEnd && strlen($filterEnd) === 7) {
                $filterEnd = Carbon::parse($filterEnd)->endOfMonth()->toDateString();
            }

            // Simplified overlap logic: intern_start <= filter_end (if exists) AND intern_end >= filter_start
            $internsQuery->where(function($q) use ($filterStart, $filterEnd) {
                $q->where('students.akhir_magang', '>=', $filterStart);
                if ($filterEnd) {
                    $q->where('students.mulai_magang', '<=', $filterEnd);
                }
            });
        }

            // Debug log: counts after applying period filter
            \Illuminate\Support\Facades\Log::info('getMyInterns: after period filter', [
                'user_id' => $user->user_id,
                'as_role' => $asRole,
                'interns_query_count_after' => $internsQuery->count(),
            ]);

            // Additional mentor debug: log intern ids when acting as mentor
            if ($asRole === 'mentor') {
                $ids = $internsQuery->pluck('users.user_id')->toArray();
                \Illuminate\Support\Facades\Log::info('getMyInterns: mentor intern ids after filter', [
                    'user_id' => $user->user_id,
                    'intern_ids' => $ids,
                ]);
            }

        // If include_progress requested, compute progress for all matching interns, apply min_progress filter, then paginate the results.
        if ($request->boolean('include_progress')) {
            $perPage = $request->per_page ?? 20;

            // Fetch all matching interns (already filtered by search/universitas/start/end)
            $allInterns = $internsQuery->get();

            // libur dates - normalize to Y-m-d strings (so in_array checks work reliably)
            $liburDates = \App\Models\Libur::pluck('tanggal')->toArray();
            $normalizeDate = fn($v) => ($v instanceof Carbon) ? $v->toDateString() : (string)$v;
            $liburDates = array_filter(array_map($normalizeDate, $liburDates));
            $liburSet = array_flip($liburDates);
            $today = Carbon::now()->endOfDay();

            $allAgg = \DB::table('logbooks')
                ->select('user_id',
                    \DB::raw('COUNT(*) as total'),
                    \DB::raw("SUM(CASE WHEN status_verifikasi = 'verified' THEN 1 ELSE 0 END) as verified"),
                    \DB::raw("SUM(CASE WHEN status_verifikasi = 'pending' THEN 1 ELSE 0 END) as pending"),
                    \DB::raw("SUM(CASE WHEN status_verifikasi = 'revision_needed' THEN 1 ELSE 0 END) as revision_needed"),
                    \DB::raw('MAX(tanggal) as last_submission')
                )
                ->whereIn('user_id', $allInterns->pluck('user_id'))
                ->groupBy('user_id')
                ->get()
                ->keyBy('user_id');

            $computed = $allInterns->map(function ($intern) use ($liburDates, $liburSet, $today, $request, $allAgg) {
                // Determine per-intern period. If caller provided start_date & end_date, use that period (support YYYY-MM month ranges),
                // otherwise use intern's mulai_magang -> today (cap to akhir_magang when present)
                if ($request->filled('start_date')) {
                    try {
                        // Support month-only inputs like 'YYYY-MM'
                        if (preg_match('/^\\d{4}-\\d{2}$/', $request->start_date)) {
                            $periodStart = Carbon::createFromFormat('Y-m', $request->start_date)->startOfMonth();
                        } else {
                            $periodStart = Carbon::parse($request->start_date)->startOfDay();
                        }
                        // ignore provided end_date for progress calc; end = today (capped to akhir_magang later)
                        $periodEnd = Carbon::now()->endOfDay();
                    } catch (\Exception $e) {
                        // fallback to intern's natural period when parsing fails
                        $periodStart = $intern->mulai_magang ? Carbon::parse($intern->mulai_magang)->startOfDay() : Carbon::now()->subDays(30)->startOfDay();
                        $periodEnd = $today->copy();
                    }
                } else {
                    $periodStart = $intern->mulai_magang ? Carbon::parse($intern->mulai_magang)->startOfDay() : Carbon::now()->subDays(30)->startOfDay();
                    $periodEnd = $today->copy();
                }

                // Cap periodEnd to today and intern akhir_magang
                $todayCap = Carbon::now()->endOfDay();
                if ($periodEnd->gt($todayCap)) {
                    $periodEnd = $todayCap;
                }
                if ($intern->akhir_magang) {
                    $am = Carbon::parse($intern->akhir_magang)->endOfDay();
                    if ($am->lt($periodEnd)) $periodEnd = $am;
                }

                // Cap the period end to today
                $todayCap = Carbon::now()->endOfDay();
                if ($periodEnd->gt($todayCap)) {
                    $periodEnd = $todayCap;
                }

                // Ensure period START uses intern.mulai_magang when available (list should reflect intern period start)
                if ($intern->mulai_magang) {
                    $periodStart = Carbon::parse($intern->mulai_magang)->startOfDay();
                }

                // Aggregate logbooks counts for this intern in its own period
                $agg = isset($allAgg[$intern->user_id]) ? $allAgg[$intern->user_id] : (object)['total' => 0, 'verified' => 0, 'pending' => 0, 'revision_needed' => 0, 'last_submission' => null];


                $expected = 0;
                if ($periodStart->lte($periodEnd)) {
                    // Calculate total days
                    $days = $periodStart->diffInDays($periodEnd) + 1;
                    $fullWeeks = floor($days / 7);
                    $expected = $fullWeeks * 5;
                    
                    $remainingDays = $days % 7;
                    if ($remainingDays > 0) {
                        $startDay = $periodStart->dayOfWeek; // 0 (Sun) - 6 (Sat)
                        for ($i = 0; $i < $remainingDays; $i++) {
                            $currentDay = ($startDay + $i) % 7;
                            if ($currentDay != 0 && $currentDay != 6) {
                                $expected++;
                            }
                        }
                    }
                    
                    // Subtract holidays
                    foreach ($liburSet as $hDate => $_) {
                        try {
                            $h = \Carbon\Carbon::parse($hDate);
                            if ($h->betweenIncluded($periodStart, $periodEnd) && !$h->isWeekend()) {
                                $expected--;
                            }
                        } catch (\Exception $e) {}
                    }
                }

                $percent = $expected > 0 ? round(($agg->verified / $expected) * 100, 1) : null;

                // Determine holidays within the period for debugging/helping diagnosis
                $holidaysInPeriod = array_values(array_filter($liburDates, function($d) use ($periodStart, $periodEnd) {
                    try {
                        $dt = Carbon::parse($d);
                        return $dt->betweenIncluded($periodStart, $periodEnd);
                    } catch (\Exception $e) {
                        return false;
                    }
                }));

                $progress = [
                    'total_entries' => intval($agg->total),
                    'verified' => intval($agg->verified),
                    'pending' => intval($agg->pending),
                    'revision_needed' => intval($agg->revision_needed),
                    'last_submission' => $agg->last_submission,
                    'expected_workdays' => $expected,
                    'percent_submitted' => $percent,
                    'period_start' => $periodStart->toDateString(),
                    'period_end' => $periodEnd->toDateString(),
                ];

                // Optional debug fields when requested
                if ($request->boolean('debug_holidays')) {
                    $progress['holidays_in_period_count'] = count($holidaysInPeriod);
                    $progress['holidays_in_period'] = $holidaysInPeriod;
                }

                // Return minimized representation for API response
                return [
                    'user_id' => $intern->user_id,
                    'id_mahasiswa' => $intern->mahasiswa?->id_mahasiswa ?? null,
                    'nama' => $intern->nama,
                    'jurusan' => $intern->jurusan,
                    'universitas' => $intern->universitas,
                    'periode' => $intern->mulai_magang && $intern->akhir_magang 
                        ? Carbon::parse($intern->mulai_magang)->format('j M Y') . ' - ' . Carbon::parse($intern->akhir_magang)->format('j M Y')
                        : null,
                    'mulai_magang' => $intern->mulai_magang,
                    'akhir_magang' => $intern->akhir_magang,
                    'status' => $intern->status,
                    'foto' => $intern->foto,
                    'foto_url' => $intern->mahasiswa && $intern->mahasiswa->id_mahasiswa ? url("/api/users/{$intern->user_id}/foto") : ($intern->foto ? url("/api/users/{$intern->user_id}/foto") : null),
                    'site' => $intern->site ? [
                        'id_site' => $intern->site->id_site,
                        'nama_site' => $intern->site->nama_site,
                    ] : null,
                    'progress' => $progress,
                ];
            });

            // Apply min_progress/max_progress filter if provided (treat null percent as 0)
            $min = $request->filled('min_progress') ? floatval($request->min_progress) : null;
            $max = $request->filled('max_progress') ? floatval($request->max_progress) : null;
            if (!is_null($min) || !is_null($max)) {
                $computed = $computed->filter(function ($it) use ($min, $max) {
                    $p = $it['progress']['percent_submitted'];
                    $val = is_null($p) ? 0 : floatval($p);
                    if (!is_null($min) && $val < $min) return false;
                    if (!is_null($max) && $val > $max) return false;
                    return true;
                })->values();
            }

            // Paginate the computed collection
            $page = \Illuminate\Pagination\LengthAwarePaginator::resolveCurrentPage();
            $total = $computed->count();
            $results = $computed->slice(($page - 1) * $perPage, $perPage)->values();

            $paginator = new \Illuminate\Pagination\LengthAwarePaginator($results, $total, $perPage, $page, [
                'path' => \Illuminate\Pagination\LengthAwarePaginator::resolveCurrentPath(),
                'query' => $request->query(),
            ]);

            $interns = $paginator;
        } else {
            // No progress requested: return all interns (no pagination) but minimal fields
            $interns = $internsQuery->get()->map(function ($intern) {
                return [
                    'user_id' => $intern->user_id,
                    'id_mahasiswa' => $intern->mahasiswa?->id_mahasiswa ?? null,
                    'nama' => $intern->nama,
                    'jurusan' => $intern->jurusan,
                    'universitas' => $intern->universitas,
                    'periode' => $intern->mulai_magang && $intern->akhir_magang 
                        ? Carbon::parse($intern->mulai_magang)->format('j M Y') . ' - ' . Carbon::parse($intern->akhir_magang)->format('j M Y')
                        : null,
                    'mulai_magang' => $intern->mulai_magang,
                    'akhir_magang' => $intern->akhir_magang,
                    'status' => $intern->status,
                    'foto' => $intern->foto,
                    'foto_url' => $intern->mahasiswa && $intern->mahasiswa->id_mahasiswa ? url("/api/users/{$intern->user_id}/foto") : ($intern->foto ? url("/api/users/{$intern->user_id}/foto") : null),
                    'site' => $intern->site ? [
                        'id_site' => $intern->site->id_site,
                        'nama_site' => $intern->site->nama_site,
                    ] : null,
                ];
            });
        }

        // Normalize response: always return data as array; include pagination meta when available
        if ($interns instanceof \Illuminate\Pagination\LengthAwarePaginator) {
            $items = $interns->items();
            $meta = [
                'total' => $interns->total(),
                'per_page' => $interns->perPage(),
                'current_page' => $interns->currentPage(),
                'last_page' => $interns->lastPage(),
            ];
        } else {
            $items = is_array($interns) ? $interns : ($interns instanceof \Illuminate\Support\Collection ? $interns->values()->all() : (array)$interns);
            $meta = null;
        }

        return response()->json([
            'success' => true,
            'count' => is_countable($items) ? count($items) : 0,
            'data' => $items,
            'meta' => $meta,
        ]);
    }

    public function getInternDetails(Request $request, $id)
    {
        $user = TblMahasiswa::find($id);

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Intern tidak ditemukan'
            ], 404);
        }

        // Get mahasiswa profile (eager-load site for site name)
        $mahasiswa = TblMahasiswa::where('id_mahasiswa', $id)->with('site')->first();

        // Determine intern period: mulai_magang -> akhir_magang (cap to today)
        $today = Carbon::now()->endOfDay();
        if ($mahasiswa && $mahasiswa->mulai_magang) {
            $periodStart = Carbon::parse($mahasiswa->mulai_magang)->startOfDay();
        } else {
            // fallback to 30 days if no start
            $periodStart = Carbon::now()->subDays(30)->startOfDay();
        }

        $periodEnd = $today->copy();
        if ($mahasiswa && $mahasiswa->akhir_magang) {
            $am = Carbon::parse($mahasiswa->akhir_magang)->endOfDay();
            if ($am->lt($periodEnd)) $periodEnd = $am;
        }

        // libur dates
        $liburDates = \App\Models\Libur::pluck('tanggal')->toArray();
        // Normalize all date arrays to plain Y-m-d strings to avoid non-scalar values (Carbon/null)
        $normalizeDate = fn($v) => ($v instanceof Carbon) ? $v->toDateString() : (string)$v;
        $liburDates = array_filter(array_map($normalizeDate, $liburDates));
        $liburSet = array_flip($liburDates); // Use array_flip for reliable lookup

        // Aggregate attendance rows per date (reuse logic from AbsensiController)
        $rows = \App\Models\TblAbsensi::select([
                'attendances.tanggal',
                \DB::raw("MAX(CASE WHEN attendances.status = 'masuk' THEN attendances.waktu END) as jam_masuk"),
                \DB::raw("MAX(CASE WHEN attendances.status = 'pulang' THEN attendances.waktu END) as jam_pulang"),
                \DB::raw("MAX(CASE WHEN attendances.status = 'masuk' THEN attendances.foto_absen END) as foto_masuk"),
                \DB::raw("MAX(CASE WHEN attendances.status = 'pulang' THEN attendances.foto_absen END) as foto_pulang"),
                \DB::raw("MAX(CASE WHEN attendances.status = 'masuk' THEN attendances.latitude_absen END) as lat_masuk"),
                \DB::raw("MAX(CASE WHEN attendances.status = 'masuk' THEN attendances.longitude_absen END) as lon_masuk"),
                \DB::raw("MAX(CASE WHEN attendances.status = 'pulang' THEN attendances.latitude_absen END) as lat_pulang"),
                \DB::raw("MAX(CASE WHEN attendances.status = 'pulang' THEN attendances.longitude_absen END) as lon_pulang"),
                \DB::raw("MAX(CASE WHEN attendances.status = 'masuk' THEN attendances.lama_telat END) as minutes_late"),
                \DB::raw("MAX(izin.id_izin) as leave_requests_id"),
                \DB::raw("MAX(izin.jenis_izin) as leave_requests_jenis"),
                \DB::raw("MAX(attendance_corrections.id_koreksi) as koreksi_id"),
            ])
            ->where('attendances.user_id', $user->user_id)
            ->leftJoin('izin', function ($join) {
                $join->on('izin.user_id', '=', 'attendances.user_id')
                    ->where('izin.status', 'approved')
                    ->whereRaw('attendances.tanggal BETWEEN izin.tanggal_mulai AND IFNULL(izin.tanggal_selesai, izin.tanggal_mulai)')
                    ->whereRaw('attendances.tanggal <= ?', [now()->toDateString()]);
            })
            ->leftJoin('attendance_corrections', function ($join) {
                $join->on('attendance_corrections.user_id', '=', 'attendances.user_id')
                    ->where('attendance_corrections.status', 'approved')
                    ->whereRaw('attendances.tanggal = attendance_corrections.tanggal')
                    ->whereRaw('attendances.tanggal <= ?', [now()->toDateString()]);
            })
            ->whereBetween('attendances.tanggal', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->groupBy('attendances.tanggal')
            ->get();

        // Initialize counters
        $totalAttendance = 0;
        $totalAbsent = 0;
        $totalOnLeave = 0;
        $totalSick = 0;
        $totalLate = 0;
        $debugDays = []; // Debug: track all counted days

        // Build a map of dates that have records
        $rowsByDate = $rows->keyBy(function ($row) {
            return \Carbon\Carbon::parse($row->tanggal)->format('Y-m-d');
        });

        // Use the same logic as AbsensiController::riwayat to compute per-date statuses and aggregate totals
        // DB driver-aware date functions and weekend/holiday exclusion (reuse logic from riwayat)
        try {
            $driver = \DB::getPdo()->getAttribute(\PDO::ATTR_DRIVER_NAME);
        } catch (\Throwable $e) {
            $driver = config('database.default');
        }
        $today = now()->toDateString(); // Use PHP timezone (Asia/Jakarta), not MySQL timezone
        $curDate = "'{$today}'";
        if ($driver === 'sqlite') {
            $dateAdd = "DATE(dt, '+1 day')";
            $notWeekend = "AND strftime('%w', d.dt) NOT IN ('0','6')"; // exclude Sun(0) and Sat(6)
        } else {
            $dateAdd = "DATE_ADD(dt, INTERVAL 1 DAY)";
            $notWeekend = "AND DAYOFWEEK(d.dt) NOT IN (1,7)"; // exclude Sun(1) and Sat(7)
        }

        $hasLibur = \Illuminate\Support\Facades\Schema::hasTable('holidays');
        $holidayCondition = $hasLibur ? "AND NOT EXISTS (SELECT 1 FROM holidays l WHERE l.tanggal = d.dt)" : "";

        $sqlDates = "WITH RECURSIVE dates AS (
            SELECT DATE('{$periodStart->toDateString()}') AS dt
            UNION ALL
            SELECT {$dateAdd} FROM dates WHERE dt < DATE('{$periodEnd->toDateString()}')
        )";

        $sqlRelevantDates = "relevant_dates AS (
            SELECT d.dt as tanggal
            FROM dates d
            WHERE d.dt BETWEEN ? AND ? {$notWeekend} {$holidayCondition}
              AND (
                  EXISTS (SELECT 1 FROM attendances a WHERE a.user_id = ? AND a.tanggal = d.dt)
                  OR EXISTS (SELECT 1 FROM attendance_corrections ka WHERE ka.user_id = ? AND ka.status = 'approved' AND ka.tanggal = d.dt)
                  OR EXISTS (SELECT 1 FROM izin iz WHERE iz.user_id = ? AND (iz.status = 'approved' OR iz.status_admin = 'approved') AND d.dt BETWEEN iz.tanggal_mulai AND IFNULL(iz.tanggal_selesai, iz.tanggal_mulai))
              )
        )";

        $dataSql = "{$sqlDates}, {$sqlRelevantDates}
            SELECT rd.tanggal as tanggal,
                MAX(CASE WHEN a.status = 'masuk' THEN a.waktu END) as jam_masuk,
                MAX(CASE WHEN a.status = 'pulang' THEN a.waktu END) as jam_pulang,
                MAX(CASE WHEN a.status = 'masuk' THEN a.lama_telat END) as minutes_late,
                MAX(CASE WHEN (iz.status = 'approved' OR iz.status_admin = 'approved') THEN iz.id_izin END) as leave_requests_id,
                MAX(CASE WHEN (iz.status = 'approved' OR iz.status_admin = 'approved') THEN iz.jenis_izin END) as leave_requests_jenis,
                MAX(CASE WHEN ka.status = 'approved' THEN ka.id_koreksi END) as koreksi_id,
                MAX(CASE WHEN a.status = 'pulang' THEN a.early END) as pulang_early
            FROM relevant_dates rd
            LEFT JOIN attendances a ON a.user_id = ? AND a.tanggal = rd.tanggal
            LEFT JOIN izin iz ON iz.user_id = ? AND (iz.status = 'approved' OR iz.status_admin = 'approved') AND rd.tanggal BETWEEN iz.tanggal_mulai AND IFNULL(iz.tanggal_selesai, iz.tanggal_mulai)
            LEFT JOIN attendance_corrections ka ON ka.user_id = ? AND ka.status = 'approved' AND ka.tanggal = rd.tanggal
            WHERE rd.tanggal <= {$curDate}
            GROUP BY rd.tanggal";

        $bindings = array_merge([
            $periodStart->toDateString(),
            $periodEnd->toDateString()
        ], array_fill(0, 6, $user->user_id));

        $rowsForCounts = \DB::select($dataSql, $bindings);

        // Build a map of rows by tanggal for quick lookup
        $rowsMap = [];
        foreach ($rowsForCounts as $r) {
            $dstr = ($r->tanggal instanceof \Carbon\Carbon) ? $r->tanggal->toDateString() : (string)$r->tanggal;
            $rowsMap[$dstr] = $r;
        }

        // Prefetch approved leave_requests spanning the period and expand into per-date map (exclude weekends & libur)
        $leave_requestss = \App\Models\Izin::where('user_id', $user->user_id)
            ->where(function($q){ $q->where('status', 'approved')->orWhere('status_admin', 'approved'); })
            ->whereRaw('(IFNULL(tanggal_selesai, tanggal_mulai) >= ?) AND (tanggal_mulai <= ?)', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->get();

        $leave_requestsDays = [];
        foreach ($leave_requestss as $iz) {
            $startI = Carbon::parse($iz->tanggal_mulai)->startOfDay();
            $endI = $iz->tanggal_selesai ? Carbon::parse($iz->tanggal_selesai)->startOfDay() : Carbon::parse($iz->tanggal_mulai)->startOfDay();
            if ($startI->lt($periodStart)) $startI = $periodStart->copy();
            if ($endI->gt($periodEnd)) $endI = $periodEnd->copy();
            for ($dd = $startI->copy(); $dd->lte($endI); $dd->addDay()) {
                $dstr = $dd->toDateString();
                if ($dd->isWeekend() || isset($liburSet[$dstr])) continue;
                // If multiple leave_requests overlap the same date, keep the latest one (or any) - we only need jenis
                $leave_requestsDays[$dstr] = $iz->jenis_izin ?? 'izin';
            }
        }

        // Build per-date status map (leave_requests takes precedence), then compute totals
        $dateStatus = [];
        for ($d = $periodStart->copy(); $d->lte($periodEnd); $d->addDay()) {
            $ds = $d->toDateString();
            if ($d->isWeekend() || isset($liburSet[$ds])) continue;

            if (isset($leave_requestsDays[$ds])) {
                $j = strtolower($leave_requestsDays[$ds]);
                $dateStatus[$ds] = ($j === 'sakit') ? 'sick' : 'on_leave';
                continue;
            }

            if (isset($rowsMap[$ds])) {
                $r = $rowsMap[$ds];
                if (!empty($r->pulang_early)) {
                    $dateStatus[$ds] = 'early';
                } elseif ($r->koreksi_id) {
                    $dateStatus[$ds] = 'koreksi';
                } elseif ($r->jam_masuk && $r->jam_pulang) {
                    $dateStatus[$ds] = (!is_null($r->minutes_late) && intval($r->minutes_late) > 0) ? 'late' : 'ontime';
                } else {
                    $dateStatus[$ds] = 'absent';
                }
            } else {
                $dateStatus[$ds] = 'absent';
            }
        }

        // Reset counters and fill from dateStatus
        $totalAttendance = 0;
        $totalAbsent = 0;
        $totalOnLeave = 0;
        $totalSick = 0;
        $totalLate = 0;
        $debugDays = [];

        foreach ($dateStatus as $date => $st) {
            $debugDays[] = ['date' => $date, 'type' => $st];
            if ($st === 'sick') $totalSick++;
            elseif ($st === 'on_leave') $totalOnLeave++;
            elseif ($st === 'late') { $totalAttendance++; $totalLate++; }
            elseif ($st === 'early' || $st === 'koreksi' || $st === 'ontime') { $totalAttendance++; }
            else { $totalAbsent++; }
        }

        // Debug logging
        \Illuminate\Support\Facades\Log::info('getInternDetails attendance_summary debug', [
            'user_id' => $user->user_id,
            'period_start' => $periodStart->toDateString(),
            'period_end' => $periodEnd->toDateString(),
            'total_attendance' => $totalAttendance,
            'total_absent' => $totalAbsent,
            'total_on_leave' => $totalOnLeave,
            'total_sick' => $totalSick,
            'total' => $totalAttendance + $totalAbsent + $totalOnLeave + $totalSick,
            'libur_count' => count($liburDates),
            'debug_days_count' => count($debugDays),
            'debug_days' => $debugDays,
        ]);

        // Get today's clock-in/out info
        $todayStr = Carbon::now()->toDateString();
        $masuk = \App\Models\TblAbsensi::where('user_id', $user->user_id)->where('tanggal', $todayStr)->where('status', 'masuk')->orderBy('waktu')->first();
        $pulang = \App\Models\TblAbsensi::where('user_id', $user->user_id)->where('tanggal', $todayStr)->where('status', 'pulang')->orderBy('waktu')->first();

        $todayInfo = [
            'masuk' => $masuk ? [
                'waktu' => $masuk->waktu,
                'foto' => $masuk->foto_absen ? str_replace('absensi/foto/', 'absensi/foto-masuk/', $masuk->foto_absen) : null,
                'latitude' => $masuk->latitude_absen,
                'longitude' => $masuk->longitude_absen,
            ] : null,
            'pulang' => $pulang ? [
                'waktu' => $pulang->waktu,
                'foto' => $pulang->foto_absen ? str_replace('absensi/foto/', 'absensi/foto-pulang/', $pulang->foto_absen) : null,
                'latitude' => $pulang->latitude_absen,
                'longitude' => $pulang->longitude_absen,
            ] : null,
        ];

        $data = [
            'user' => [
                'user_id' => $user->user_id,
                'nama' => $user->nama,
                'email' => $user->email,
                'student_id' => $mahasiswa ? $mahasiswa->nim : $user->identifier,
                'universitas' => $mahasiswa ? $mahasiswa->universitas : null,
                'jurusan' => $mahasiswa ? $mahasiswa->jurusan : null,
                'semester' => $mahasiswa ? $mahasiswa->semester : null,
                'jenjang_pendidikan' => $mahasiswa ? $mahasiswa->jenjang_pendidikan : null,
                'alamat' => $mahasiswa ? $mahasiswa->alamat : null,
                'nomor_darurat' => $mahasiswa ? $mahasiswa->nomor_darurat : null,
                'nama_kontak_darurat' => $mahasiswa ? $mahasiswa->nama_kontak_darurat : null,
                'job_position' => $mahasiswa ? $mahasiswa->job_position : null,
                'division' => $mahasiswa ? $mahasiswa->division : null,
                'id_site' => $mahasiswa ? $mahasiswa->id_site : $user->id_site ?? null,
                'site' => $mahasiswa && $mahasiswa->site ? $mahasiswa->site->nama_site : ($user->site?->nama_site ?? null),
                'no_telp' => $mahasiswa ? $mahasiswa->no_telp : $user->no_telp ?? null,
                'nik' => $mahasiswa ? $mahasiswa->nik : $user->nik ?? null,
                'tempat_lahir' => $mahasiswa ? $mahasiswa->tempat_lahir : null,
                'tanggal_lahir' => $mahasiswa ? $mahasiswa->tanggal_lahir : null,
                'gender' => $mahasiswa ? $mahasiswa->gender : null,
                'work_schedule_id' => $mahasiswa ? $mahasiswa->work_schedule_id : null,
                'bank_name' => $mahasiswa ? $mahasiswa->bank_name : null,
                'bank_account_name' => $mahasiswa ? $mahasiswa->bank_account_name : null,
                'bank_account_number' => $mahasiswa ? $mahasiswa->bank_account_number : null,
                'foto' => $mahasiswa && $mahasiswa->foto ? $mahasiswa->foto : $user->foto,
                'foto_url' => ($mahasiswa && $mahasiswa->foto) ? url("/api/users/{$user->user_id}/foto") : ($user->foto ? url("/api/users/{$user->user_id}/foto") : null),
                'foto_filename' => ($mahasiswa && $mahasiswa->foto) ? basename($mahasiswa->foto) : ($user->foto ? basename($user->foto) : null),
                'foto_ktm' => $mahasiswa ? $mahasiswa->foto_ktm : null,
                'foto_ktm_url' => $mahasiswa && $mahasiswa->foto_ktm ? url("/api/users/{$user->user_id}/foto?type=ktm") : null,
                'foto_ktm_filename' => $mahasiswa && $mahasiswa->foto_ktm ? basename($mahasiswa->foto_ktm) : null,
                'mulai_magang' => $mahasiswa ? $mahasiswa->mulai_magang : null,
                'akhir_magang' => $mahasiswa ? $mahasiswa->akhir_magang : null,
            ],
            'attendance_summary' => [
                'period_start' => $periodStart->toDateString(),
                'period_end' => $periodEnd->toDateString(),
                'total_attendance' => $totalAttendance,
                'total_absent' => $totalAbsent,
                'total_on_leave' => $totalOnLeave,
                'total_sick' => $totalSick,
                'total_late' => $totalLate,
            ],
            'today' => $todayInfo,
        ];

        return response()->json([
            'success' => true,
            'data' => $data
        ]);
    }

    public function getAvailableUniv(Request $request)
    {
        $user = $request->user();
        // Only admin or mentor can access this list
        if (!$user || (! $user->isAdmin() && ! $user->isMentor())) {
            return response()->json(['success' => false, 'message' => 'Akses ditolak'], 403);
        }

        $activeRole = $request->query('active_role');
        $isMentorContext = ($activeRole === 'mentor') || ($request->segment(2) === 'mentor' && $user->isMentor());

        if ($user->isAdmin() && !$isMentorContext) {
            // Admin: all universities
            $universities = TblMahasiswa::whereNotNull('universitas')
                ->where('universitas', '<>', '')
                ->selectRaw('TRIM(universitas) as universitas')
                ->distinct()
                ->orderBy('universitas')
                ->pluck('universitas');
        } else {
            // Mentor: only universities of interns they mentor
            $direct = $user->interns()->pluck('users.user_id')->toArray();
            $viaStudents = \DB::table('intern_mentors as im')
                ->join('students as s', 's.id_mahasiswa', '=', 'im.intern_id')
                ->where('im.is_active', 1)
                ->where(function($q) use ($user) {
                    $q->where('im.mentor_user_id', $user->user_id);
                    if ($user->karyawan?->id_karyawan) {
                        $q->orWhere('im.mentor_id', $user->karyawan->id_karyawan);
                    }
                })
                ->pluck('s.user_id')
                ->filter()
                ->toArray();
            $internIds = array_unique(array_filter(array_merge($direct, $viaStudents)));
            if (empty($internIds)) {
                $universities = collect([]);
            } else {
                $universities = TblMahasiswa::whereIn('user_id', $internIds)
                    ->whereNotNull('universitas')
                    ->where('universitas', '<>', '')
                    ->selectRaw('TRIM(universitas) as universitas')
                    ->distinct()
                    ->orderBy('universitas')
                    ->pluck('universitas');
            }
        }

        return response()->json([
            'success' => true,
            'data' => $universities
        ]);
    }

    public function getAvailableDivisions(Request $request)
    {
        $user = $request->user();
        // Only admin or mentor can access this list
        if (!$user || (! $user->isAdmin() && ! $user->isMentor())) {
            return response()->json(['success' => false, 'message' => 'Akses ditolak'], 403);
        }

        $activeRole = $request->query('active_role');
        $isMentorContext = ($activeRole === 'mentor') || ($request->segment(2) === 'mentor' && $user->isMentor());

        if ($user->isAdmin() && !$isMentorContext) {
            // Admin: all divisions
            $divisions = TblMahasiswa::whereNotNull('division')
                ->where('division', '<>', '')
                ->selectRaw('TRIM(division) as division')
                ->distinct()
                ->orderBy('division')
                ->pluck('division');
        } else {
            // Mentor: only divisions of interns they mentor
            $direct = $user->interns()->pluck('users.user_id')->toArray();
            $viaStudents = \DB::table('intern_mentors as im')
                ->join('students as s', 's.id_mahasiswa', '=', 'im.intern_id')
                ->where('im.is_active', 1)
                ->where(function($q) use ($user) {
                    $q->where('im.mentor_user_id', $user->user_id);
                    if ($user->karyawan?->id_karyawan) {
                        $q->orWhere('im.mentor_id', $user->karyawan->id_karyawan);
                    }
                })
                ->pluck('s.user_id')
                ->filter()
                ->toArray();
            $internIds = array_unique(array_filter(array_merge($direct, $viaStudents)));
            if (empty($internIds)) {
                $divisions = collect([]);
            } else {
                $divisions = TblMahasiswa::whereIn('user_id', $internIds)
                    ->whereNotNull('division')
                    ->where('division', '<>', '')
                    ->selectRaw('TRIM(division) as division')
                    ->distinct()
                    ->orderBy('division')
                    ->pluck('division');
            }
        }

        return response()->json([
            'success' => true,
            'data' => $divisions
        ]);
    }

    public function getAvailableMentor(Request $request)
    {
        $user = $request->user();
        // Only admin or mentor can access this list
        if (!$user || (! $user->isAdmin() && ! $user->isMentor())) {
            return response()->json(['success' => false, 'message' => 'Akses ditolak'], 403);
        }

        // Use whereHas('roles') because roles are stored in a many-to-many relationship
        // Only get mentors who have active intern(s) (either through modern relation or legacy karyawan)
        $mentors = User::whereHas('roles', function ($q) {
                $q->where('name', 'mentor');
            })
            ->where(function ($query) {
                // Has modern intern mapping
                $query->has('interns')
                // OR has legacy mapping via their TblKaryawan
                ->orWhereHas('karyawan.mentorMappings', function ($q) {
                    // mentorMappings already filters by is_active = true
                });
            })
            ->select('user_id', 'nama')
            ->orderBy('nama')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $mentors
        ]);
    }

    public function getActiveIntern(Request $request)
    {
        $user = $request->user();
        if (!$user || (!$user->isAdmin() && !$user->isMentor())) {
            return response()->json(['success' => false, 'message' => 'Akses ditolak'], 403);
        }

        $activeRole = $request->query('active_role');
        $isMentorContext = ($activeRole === 'mentor') || ($request->segment(2) === 'mentor' && $user->isMentor());

        if ($user->isAdmin() && !$isMentorContext) {
            // Admin: all active interns
            $interns = User::where('status', 'active')
                ->whereHas('roles', function ($q) {
                    $q->where('name', 'intern');
                })
                ->select('user_id', 'nama')
                ->orderBy('nama')
                ->get();
        } else {
            // Mentor: only their own active interns
            $interns = $user->interns()
                ->where('users.status', 'active')
                ->select('users.user_id', 'users.nama')
                ->orderBy('users.nama')
                ->get();
        }

        return response()->json([
            'success' => true,
            'data' => $interns
        ]);
    }

    public function getDoneIntern(Request $request)
    {
        $user = $request->user();
        if (!$user || (!$user->isAdmin() && !$user->isMentor())) {
            return response()->json(['success' => false, 'message' => 'Akses ditolak'], 403);
        }

        $today = now()->toDateString();

        $activeRole = $request->query('active_role');
        $isMentorContext = ($activeRole === 'mentor') || ($request->segment(2) === 'mentor' && $user->isMentor());

        if ($user->isAdmin() && !$isMentorContext) {
            // Admin: all done interns (based on date)
            $interns = User::whereHas('roles', function ($q) {
                    $q->where('name', 'intern');
                })
                ->join('students', 'users.user_id', '=', 'students.user_id')
                ->where('students.akhir_magang', '<', $today)
                ->select('users.user_id', 'users.nama', 'students.akhir_magang')
                ->orderBy('users.nama')
                ->get();
        } else {
            // Mentor: only their own done interns
            $interns = $user->interns()
                ->join('students', 'users.user_id', '=', 'students.user_id')
                ->where('students.akhir_magang', '<', $today)
                ->select('users.user_id', 'users.nama', 'students.akhir_magang')
                ->orderBy('users.nama')
                ->get();
        }

        return response()->json([
            'success' => true,
            'data' => $interns
        ]);
    }

    public function getKaryawan()
    {
        $karyawans = \App\Models\TblKaryawan::join('users', 'employees.user_id', '=', 'users.user_id')
            ->leftJoin('divisions', 'employees.division_id', '=', 'divisions.id_division')
            ->selectRaw("users.user_id, users.nama, employees.nip, COALESCE(divisions.name, employees.division) as division, employees.job_position")
            ->orderBy('users.nama')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $karyawans
        ]);
    }

    /**
     * Get Intern Detail with Attendance Summary & Pagination
     * Route: GET /api/mentor/interns/{id}/attendance OR /api/admin/interns/{id}/attendance
     */
    public function getInternAttendanceDetail(Request $request, $id)
    {
        $user = $request->user();

        // Resolve route param as either id_mahasiswa (preferred) or legacy user_id (fallback)
        $mahasiswa = \App\Models\TblMahasiswa::find($id) ?? \App\Models\TblMahasiswa::where('user_id', $id)->first();
        if (!$mahasiswa) {
            return response()->json([
                'success' => false,
                'message' => 'Intern tidak ditemukan'
            ], 404);
        }

        // Check authorization: mentor or admin only
        if (!$user->isAdmin() && !$user->isMentor()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized'
            ], 403);
        }

        // If mentor, verify they have access to this mahasiswa via profile-based pivot
        if ($user->isMentor() && !$user->isAdmin()) {
            $karyawanId = $user->karyawan?->id_karyawan;
            $hasAccess = $karyawanId && \DB::table('intern_mentors')
                ->where('mentor_id', $karyawanId)
                ->where('intern_id', $mahasiswa->id_mahasiswa)
                ->where('is_active', true)
                ->exists();

            if (!$hasAccess) {
                return response()->json([
                    'success' => false,
                    'message' => 'You do not have access to this intern'
                ], 403);
            }
        }

        // Determine intern period: mulai_magang -> akhir_magang (cap to today)
        $today = Carbon::now()->endOfDay();
        if ($mahasiswa && $mahasiswa->mulai_magang) {
            $periodStart = Carbon::parse($mahasiswa->mulai_magang)->startOfDay();
        } else {
            $periodStart = Carbon::now()->subDays(30)->startOfDay();
        }

        $periodEnd = $today->copy();
        if ($mahasiswa && $mahasiswa->akhir_magang) {
            $am = Carbon::parse($mahasiswa->akhir_magang)->endOfDay();
            if ($am->lt($periodEnd)) $periodEnd = $am;
        }

        // Pagination
        $perPage = $request->per_page ?? 20;
        $page = $request->page ?? 1;

        // Query attendance records with both clock in and out on same date
        $attendanceQuery = \App\Models\TblAbsensi::select([
                'attendances.tanggal',
                \DB::raw("MAX(CASE WHEN attendances.status = 'masuk' THEN attendances.waktu END) as jam_masuk"),
                \DB::raw("MAX(CASE WHEN attendances.status = 'pulang' THEN attendances.waktu END) as jam_pulang"),
                \DB::raw("MAX(CASE WHEN attendances.status = 'masuk' THEN attendances.foto_absen END) as foto_masuk"),
                \DB::raw("MAX(CASE WHEN attendances.status = 'pulang' THEN attendances.foto_absen END) as foto_pulang"),
            ])
            ->where('attendances.id_mahasiswa', $mahasiswa->id_mahasiswa)
            ->whereBetween('attendances.tanggal', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->groupBy('attendances.tanggal')
            ->orderBy('attendances.tanggal', 'desc');

        // Get total count before pagination
        $totalCount = $attendanceQuery->count();

        // Paginate
        $attendances = $attendanceQuery->paginate($perPage, ['*'], 'page', $page);

        // Map attendance data from paginated items
        $attendanceList = collect($attendances->items())->map(function ($row) {
            $masukTime = $row->jam_masuk ? Carbon::parse($row->jam_masuk) : null;
            $pulangTime = $row->jam_pulang ? Carbon::parse($row->jam_pulang) : null;

            // Calculate duration in minutes
            $durationMinutes = null;
            if ($masukTime && $pulangTime) {
                $durationMinutes = $pulangTime->diffInMinutes($masukTime);
            }

            // Format duration as HH:MM
            $durationFormatted = null;
            if ($durationMinutes !== null) {
                $hours = intdiv($durationMinutes, 60);
                $minutes = $durationMinutes % 60;
                $durationFormatted = sprintf('%02d:%02d', $hours, $minutes);
            }

            return [
                'tanggal' => $row->tanggal,
                'jam_masuk' => $row->jam_masuk,
                'jam_pulang' => $row->jam_pulang,
                'durasi_kerja' => $durationFormatted,
                'durasi_kerja_menit' => $durationMinutes,
                'foto_masuk' => $row->foto_masuk ? url("/api/absensi/foto-masuk/" . basename($row->foto_masuk)) : null,
                'foto_pulang' => $row->foto_pulang ? url("/api/absensi/foto-pulang/" . basename($row->foto_pulang)) : null,
                'foto_masuk_filename' => $row->foto_masuk ? basename($row->foto_masuk) : null,
                'foto_pulang_filename' => $row->foto_pulang ? basename($row->foto_pulang) : null,
            ];
        })->all();

        // Build response - only attendance_period and records
        $data = [
            'attendance_period' => [
                'start' => $periodStart->toDateString(),
                'end' => $periodEnd->toDateString(),
            ],
            'attendance_records' => $attendanceList,
            'pagination' => [
                'total' => $attendances->total(),
                'per_page' => $attendances->perPage(),
                'current_page' => $attendances->currentPage(),
                'last_page' => $attendances->lastPage(),
                'from' => $attendances->firstItem(),
                'to' => $attendances->lastItem(),
            ],
        ];

        return response()->json([
            'success' => true,
            'data' => $data
        ]);
    }

    /**
     * Get combined attendance and logbooks summary (daily view)
     * Each day shows: attendance + logbooks data merged
     */
    public function getInternDailySummary(Request $request, $id)
    {
        $user = $request->user();

        // Validate optional date filters
        $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'status_verifikasi' => 'nullable|string',
            'q' => 'nullable|string',
            'search' => 'nullable|string',
        ]);

        // // Authorization: Admin or Mentor only
        // if (!$user->isAdmin() && !$user->isMentor()) {
        //     return response()->json([
        //         'success' => false,
        //         'message' => 'Unauthorized'
        //     ], 403);
        // }

        // Resolve mahasiswa by profile id (preferred) to avoid ID ambiguity with user_id
        $mahasiswa = \App\Models\TblMahasiswa::find($id) ?? \App\Models\TblMahasiswa::where('user_id', $id)->first();
        if (!$mahasiswa) {
            return response()->json([
                'success' => false,
                'message' => 'Intern tidak ditemukan'
            ], 404);
        }

        // Authorization: Admin, Mentor, or the intern themselves
        $isOwnData = ($mahasiswa->user_id == $user->user_id)
                   || ($mahasiswa->id_mahasiswa == $id && $user->mahasiswa && $user->mahasiswa->id_mahasiswa == $id);

        if (!$user->isAdmin() && !$user->isMentor() && !$isOwnData) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized'
            ], 403);
        }

        // If mentor, verify they have access to this mahasiswa via profile-based pivot
        if ($user->isMentor() && !$user->isAdmin()) {
            $karyawanId = $user->karyawan?->id_karyawan;
            $hasAccess = $karyawanId && \DB::table('intern_mentors')
                ->where('mentor_id', $karyawanId)
                ->where('intern_id', $mahasiswa->id_mahasiswa)
                ->where('is_active', true)
                ->exists();

            if (!$hasAccess) {
                return response()->json([
                    'success' => false,
                    'message' => 'You do not have access to this intern'
                ], 403);
            }
        }

        // Continue with resolved mahasiswa
        $intern = $mahasiswa->user; // may be null if user not provisioned
        $mahasiswaId = $mahasiswa->id_mahasiswa;

        // Determine intern period
        $today = Carbon::now()->endOfDay();
        
        // Use request parameters if provided, otherwise use intern's mulai_magang/akhir_magang
        if ($request->filled('start_date')) {
            $periodStart = Carbon::parse($request->start_date)->startOfDay();
        } elseif ($mahasiswa && $mahasiswa->mulai_magang) {
            $periodStart = Carbon::parse($mahasiswa->mulai_magang)->startOfDay();
        } else {
            $periodStart = Carbon::now()->subDays(30)->startOfDay();
        }

        if ($request->filled('end_date')) {
            $periodEnd = Carbon::parse($request->end_date)->endOfDay();
        } else {
            $periodEnd = $today->copy();
        }

        // Always cap at min(periodEnd, today, akhir_magang) to avoid future dates in summary
        if ($periodEnd->gt($today)) $periodEnd = $today->copy();
        if ($mahasiswa && $mahasiswa->akhir_magang) {
            $am = Carbon::parse($mahasiswa->akhir_magang)->endOfDay();
            if ($am->lt($periodEnd)) $periodEnd = $am;
        }

        // Pagination
        $perPage = $request->per_page ?? 20;
        $page = $request->page ?? 1;

        // Get libur dates for filtering weekends/holidays
        $liburDates = \App\Models\Libur::pluck('tanggal')->toArray();
        $normalizeDate = fn($v) => ($v instanceof \Carbon\Carbon) ? $v->toDateString() : (string)$v;
        $liburDates = array_filter(array_map($normalizeDate, $liburDates));
        $liburSet = array_flip($liburDates);

        // Get all working days in period
        $allWorkingDays = [];
        for ($d = $periodStart->copy(); $d->lte($periodEnd); $d->addDay()) {
            $ds = $d->toDateString();
            if (!$d->isWeekend() && !isset($liburSet[$ds])) {
                $allWorkingDays[] = $ds;
            }
        }

        // Get attendance and logbooks data
        // Attendance should be queried by mahasiswa profile id
        $attendanceQuery = \App\Models\TblAbsensi::query()
            ->where('id_mahasiswa', $mahasiswaId);

        $attendanceByDate = $attendanceQuery
            ->whereBetween('tanggal', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->select('tanggal')
            ->distinct()
            ->pluck('tanggal')
            ->map($normalizeDate)
            ->flip()
            ->all();

        $logbookQuery = \App\Models\Logbook::query();
        if ($mahasiswaId) { $logbookQuery->where('id_mahasiswa', $mahasiswaId); } else { $logbookQuery->where('user_id', $intern->user_id); }
        $logbooksByDate = $logbookQuery
            ->whereBetween('tanggal', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->select('tanggal', 'status_verifikasi', 'deskripsi_kegiatan')
            ->get()
            ->groupBy('tanggal')
            ->mapWithKeys(function ($logs, $date) {
                $dateStr = ($date instanceof \Carbon\Carbon) 
                    ? $date->toDateString() 
                    : \Carbon\Carbon::parse($date)->toDateString();
                return [$dateStr => $logs];
            })
            ->all();

        $searchQuery = strtolower(trim((string) ($request->q ?? $request->search ?? '')));

        // Prefetch approved leave_requests spanning the period and approved koreksi per date so daily-summary reflects them
        $leaveQuery = \App\Models\Izin::query();
        if ($mahasiswaId) { $leaveQuery->where('id_mahasiswa', $mahasiswaId); } else { $leaveQuery->where('user_id', $intern->user_id); }
        $leave_requestss = $leaveQuery
            ->where('status', 'approved')
            ->whereRaw('(IFNULL(tanggal_selesai, tanggal_mulai) >= ?) AND (tanggal_mulai <= ?)', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->get();

        $leave_requestssByDate = [];
        foreach ($leave_requestss as $iz) {
            $startI = Carbon::parse($iz->tanggal_mulai)->startOfDay();
            $endI = $iz->tanggal_selesai ? Carbon::parse($iz->tanggal_selesai)->startOfDay() : Carbon::parse($iz->tanggal_mulai)->startOfDay();
            if ($startI->lt($periodStart)) $startI = $periodStart->copy();
            if ($endI->gt($periodEnd)) $endI = $periodEnd->copy();
            for ($d = $startI->copy(); $d->lte($endI); $d->addDay()) {
                $ds = $d->toDateString();
                if ($d->isWeekend() || isset($liburSet[$ds])) continue;
                $leave_requestssByDate[$ds] = $iz;
            }
        }

        $koreksiByDate = \App\Models\KoreksiAbsensi::when($mahasiswaId, fn($q) => $q->where('id_mahasiswa', $mahasiswaId), fn($q) => $q->where('user_id', $intern->user_id))
            ->where('status', 'approved')
            ->whereBetween('tanggal', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->get()
            ->keyBy(function ($k) {
                return Carbon::parse($k->tanggal)->toDateString();
            })
            ->all();

        // Build summary data for all working days
        $summaryData = [];
        
        // Normalize status filters (support CSV/array and friendly labels)
        $statusFilterParsed = ['statuses' => [], 'include_not_yet' => false];
        if ($request->filled('status_verifikasi')) {
            try {
                $statusRaw = $request->status_verifikasi;
                if (!is_array($statusRaw)) {
                    $statusRaw = array_filter(array_map('trim', explode(',', $statusRaw)));
                }
                // map friendly labels
                $mapped = [];
                $includeNotYet = false;
                foreach ($statusRaw as $r) {
                    $lower = strtolower(trim($r));
                    if ($lower === '') continue;
                    if (in_array($lower, ['approved', 'verified'])) { $mapped[] = 'verified'; continue; }
                    if (in_array($lower, ['pending'])) { $mapped[] = 'pending'; continue; }
                    if (in_array($lower, ['draft'])) { $mapped[] = 'draft'; continue; }
                    if (in_array($lower, ['revision', 'revision_needed', 'revision needed'])) { $mapped[] = 'revision_needed'; continue; }
                    if (in_array($lower, ['rejected'])) { $mapped[] = 'rejected'; continue; }
                    if (in_array($lower, ['not yet', 'not_yet', 'notyet', 'not-yet'])) { $includeNotYet = true; continue; }
                    $mapped[] = $r;
                }
                $mapped = array_values(array_unique($mapped));
                $statusFilterParsed = ['statuses' => $mapped, 'include_not_yet' => $includeNotYet];
            } catch (\Exception $e) {
                $statusFilterParsed = ['statuses' => [], 'include_not_yet' => false];
            }
        }

        foreach ($allWorkingDays as $tanggal) {
            $hasAttendance = isset($attendanceByDate[$tanggal]);
            $logbooks = $logbooksByDate[$tanggal] ?? null;

            // If status filter includes not_yet and optionally other statuses, handle both
            $includeNotYet = $statusFilterParsed['include_not_yet'] ?? false;
            $statuses = $statusFilterParsed['statuses'] ?? [];

            $hasIzinForDate = isset($leave_requestssByDate[$tanggal]);
            $hasKoreksiForDate = isset($koreksiByDate[$tanggal]);

            $matched = false;

            // Check logbooks statuses match any requested statuses
            if (!empty($statuses) && $logbooks) {
                $logStatuses = $logbooks->pluck('status_verifikasi')->map(fn($s) => strtolower(trim($s)))->unique()->all();
                $searchStatuses = array_map(fn($s) => strtolower(trim($s)), $statuses);
                if (count(array_intersect($logStatuses, $searchStatuses)) > 0) {
                    $matched = true;
                }
            }

            // Check Not Yet condition
            if ($includeNotYet) {
                // Include days with no logbooks and no excused absence, regardless of attendance
                if (!$logbooks && !$hasIzinForDate && !$hasKoreksiForDate) {
                    $matched = true;
                }
            }

            $hasMatchedDescription = true;
            if ($searchQuery !== '') {
                $hasMatchedDescription = false;
                if ($logbooks) {
                    $hasMatchedDescription = $logbooks->contains(function ($log) use ($searchQuery) {
                        $desc = strtolower((string) ($log->deskripsi_kegiatan ?? ''));
                        return $desc !== '' && str_contains($desc, $searchQuery);
                    });
                }
            }

            $shouldInclude = $request->filled('status_verifikasi') ? $matched : true;
            $shouldInclude = $shouldInclude && $hasMatchedDescription;

            if ($shouldInclude) {
                $summaryData[] = $tanggal;
            }
        }

        // Sort descending
        rsort($summaryData);

        // Paginate
        $totalDates = count($summaryData);
        $offset = ($page - 1) * $perPage;
        $paginatedDates = array_slice($summaryData, $offset, $perPage);

        // Map each date with attendance + logbooks data
        $summaryData = collect($paginatedDates)->map(function ($tanggal) use ($intern, $attendanceByDate, $logbooksByDate, $leave_requestssByDate, $koreksiByDate, $mahasiswaId) {
            $tanggalStr = $tanggal instanceof Carbon ? $tanggal->toDateString() : $tanggal;

            // Get attendance for this date (include late/early fields to determine status)
            $attendance = \App\Models\TblAbsensi::select([
                    \DB::raw("MAX(CASE WHEN attendances.status = 'masuk' THEN attendances.waktu END) as jam_masuk"),
                    \DB::raw("MAX(CASE WHEN attendances.status = 'pulang' THEN attendances.waktu END) as jam_pulang"),
                    \DB::raw("MAX(CASE WHEN attendances.status = 'masuk' THEN attendances.latitude_absen END) as lat_masuk"),
                    \DB::raw("MAX(CASE WHEN attendances.status = 'masuk' THEN attendances.longitude_absen END) as lon_masuk"),
                    \DB::raw("MAX(CASE WHEN attendances.status = 'pulang' THEN attendances.latitude_absen END) as lat_pulang"),
                    \DB::raw("MAX(CASE WHEN attendances.status = 'pulang' THEN attendances.longitude_absen END) as lon_pulang"),
                    \DB::raw("MAX(CASE WHEN attendances.status = 'masuk' THEN attendances.foto_absen END) as foto_masuk"),
                    \DB::raw("MAX(CASE WHEN attendances.status = 'pulang' THEN attendances.foto_absen END) as foto_pulang"),
                    \DB::raw("MAX(CASE WHEN attendances.status = 'masuk' THEN attendances.lama_telat END) as minutes_late"),
                    \DB::raw("MAX(CASE WHEN attendances.status = 'pulang' THEN attendances.early END) as pulang_early"),
                    \DB::raw("MAX(CASE WHEN attendances.status = 'pulang' THEN attendances.remark END) as pulang_remark"),
                ])
                ->when($mahasiswaId, fn($q) => $q->where('id_mahasiswa', $mahasiswaId), fn($q) => $q->where('user_id', $intern->user_id))
                ->where('tanggal', $tanggalStr)
                ->groupBy('tanggal')
                ->first();

            // Get logbooks for this date (first logbooks if multiple)
            $logbookQuery = \App\Models\Logbook::with(['tag:id,nama']);
            if ($mahasiswaId) { $logbookQuery->where('id_mahasiswa', $mahasiswaId); } else { $logbookQuery->where('user_id', $intern->user_id); }
            $logbooks = $logbookQuery->where('tanggal', $tanggalStr)->first();

            // Check approved leave_requests / koreksi for the date (if any)
            $leave_requests = $leave_requestssByDate[$tanggalStr] ?? null;
            $koreksi = $koreksiByDate[$tanggalStr] ?? null;

            $hasAttendance = isset($attendanceByDate[$tanggalStr]);
            $hasLogbook = $logbooks ? true : false;
            $hasIzin = $leave_requests ? true : false;
            $hasKoreksi = $koreksi ? true : false;

            // Not Submit: no attendance, no logbooks, and excused/absent day
            $isNotSubmit = !$hasLogbook && !$hasAttendance;
            // Not Yet: has attendance, no logbooks, no leave_requests/koreksi
            $isNotYet = $hasAttendance && !$hasLogbook && !$hasIzin && !$hasKoreksi;

            // Calculate duration if attendance exists
            $durationFormatted = null;
            $durationMinutes = null;
            if ($attendance && $attendance->jam_masuk && $attendance->jam_pulang) {
                $masukTime = Carbon::parse($attendance->jam_masuk);
                $pulangTime = Carbon::parse($attendance->jam_pulang);
                $durationMinutes = $pulangTime->diffInMinutes($masukTime);
                $hours = intdiv($durationMinutes, 60);
                $minutes = $durationMinutes % 60;
                $durationFormatted = sprintf('%02d:%02d', $hours, $minutes);
            }

            // Determine attendance status (precedence: leave_requests -> koreksi -> early -> late/ontime -> absent)
            $attendanceStatus = null;
            $reason = null;
            if ($leave_requests) {
                $attendanceStatus = (strtolower($leave_requests->jenis_izin) === 'sakit') ? 'sick' : 'on_leave';
                $reason = $leave_requests->keterangan ?: null;
            } elseif ($koreksi) {
                $attendanceStatus = 'koreksi';
                $reason = $koreksi->alasan ?: null;
            } elseif ($attendance && $attendance->jam_masuk && $attendance->jam_pulang) {
                if (!empty($attendance->pulang_early)) {
                    $attendanceStatus = 'early';
                    $reason = $attendance->pulang_remark ?: null;
                } elseif (!empty($attendance->minutes_late) && $attendance->minutes_late > 0) {
                    $attendanceStatus = 'late';
                } else {
                    $attendanceStatus = 'ontime';
                }
            } else {
                $attendanceStatus = 'absent';
            }

            $result = [
                'tanggal' => $tanggalStr,
                'status' => $attendanceStatus,
                'is_not_yet' => $isNotYet,
                'is_not_submit' => $isNotSubmit,
                'attendance' => $attendance ? [
                    'jam_masuk' => $attendance->jam_masuk,
                    'lat_masuk' => $attendance->lat_masuk,
                    'lon_masuk' => $attendance->lon_masuk,
                    'jam_pulang' => $attendance->jam_pulang,
                    'lat_pulang' => $attendance->lat_pulang,
                    'lon_pulang' => $attendance->lon_pulang,
                    'durasi_kerja' => $durationFormatted,
                    'durasi_kerja_menit' => $durationMinutes,
                    'minutes_late' => $attendance->minutes_late ?? null,
                    'early' => !empty($attendance->pulang_early),
                    'early_remark' => $attendance->pulang_remark ?? null,
                    'foto_masuk' => $attendance->foto_masuk ? url("/api/absensi/foto-masuk/" . basename($attendance->foto_masuk)) : null,
                    'foto_pulang' => $attendance->foto_pulang ? url("/api/absensi/foto-pulang/" . basename($attendance->foto_pulang)) : null,
                ] : null,
                'leave_requests' => $leave_requests ? [
                    'id_izin' => $leave_requests->id_izin ?? null,
                    'jenis_izin' => $leave_requests->jenis_izin ?? null,
                    'keterangan' => $leave_requests->keterangan ?? null,
                    'start' => $leave_requests->tanggal_mulai ?? null,
                    'end' => $leave_requests->tanggal_selesai ?? null,
                ] : null,
                'koreksi' => $koreksi ? [
                    'id_koreksi' => $koreksi->id_koreksi ?? null,
                    'alasan' => $koreksi->alasan ?? null,
                ] : null,
                'logbooks' => $logbooks ? [
                    'logbooks_id' => $logbooks->id_logbooks,
                    'tag_id' => $logbooks->tag_id,
                    'tag' => $logbooks->tag ? [
                        'id' => $logbooks->tag->id,
                        'nama' => $logbooks->tag->nama,
                    ] : null,
                    'deskripsi_kegiatan' => $logbooks->deskripsi_kegiatan,
                    'bukti_kegiatan' => $logbooks->bukti_kegiatan ? (is_array($logbooks->bukti_kegiatan) ? array_map(fn($f) => url("/api/logbook/" . $logbooks->id_logbooks . "/file/" . basename($f)), $logbooks->bukti_kegiatan) : url("/api/logbook/" . $logbooks->id_logbooks . "/file/" . basename($logbooks->bukti_kegiatan))) : null,
                    'status_verifikasi' => $logbooks->status_verifikasi,
                    'feedback' => $logbooks->feedback,
                    'verified_at' => $logbooks->verified_at,
                    'submitted_at' => $logbooks->created_at,
                ] : null,
            ];

            // Preserve attendance status; Not Yet/Not Submit are flags

            return $result;
        })->all();

        $data = [
            'attendance_period' => [
                'start' => $periodStart->toDateString(),
                'end' => $periodEnd->toDateString(),
            ],
            'daily_summary' => $summaryData,
            'pagination' => [
                'total' => $totalDates,
                'per_page' => $perPage,
                'current_page' => $page,
                'last_page' => ceil($totalDates / $perPage),
                'from' => $totalDates > 0 ? $offset + 1 : null,
                'to' => $totalDates > 0 ? min($offset + $perPage, $totalDates) : null,
            ],
        ];

        return response()->json([
            'success' => true,
            'data' => $data
        ]);
    }

    /**
     * Get logbooks chart data for single intern
     * Returns logbooks status breakdown (pending, verified, revision_needed)
     */
    public function getInternLogbookChart(Request $request, $id)
    {
        $user = $request->user();

        // Resolve mahasiswa by profile id (preferred) or legacy user_id (fallback)
        $mahasiswa = \App\Models\TblMahasiswa::find($id) ?? \App\Models\TblMahasiswa::where('user_id', $id)->first();
        if (!$mahasiswa) {
            return response()->json([
                'success' => false,
                'message' => 'Intern tidak ditemukan'
            ], 404);
        }

        // Authorization: Admin or Mentor only
        if (!$user->isAdmin() && !$user->isMentor()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized'
            ], 403);
        }

        // If mentor, verify they have access to this mahasiswa via profile-based pivot
        if ($user->isMentor() && !$user->isAdmin()) {
            $karyawanId = $user->karyawan?->id_karyawan;
            $hasAccess = $karyawanId && \DB::table('intern_mentors')
                ->where('mentor_id', $karyawanId)
                ->where('intern_id', $mahasiswa->id_mahasiswa)
                ->where('is_active', true)
                ->exists();

            if (!$hasAccess) {
                return response()->json([
                    'success' => false,
                    'message' => 'You do not have access to this intern'
                ], 403);
            }
        }

        // Continue with resolved mahasiswa
        $intern = $mahasiswa->user; // may be null
        $mahasiswaId = $mahasiswa->id_mahasiswa; // ensure profile FK variable is defined for later logic
        $today = Carbon::now()->endOfDay();

        if ($request->filled('start_date')) {
            try {
                if (preg_match('/^\\d{4}-\\d{2}$/', $request->start_date)) {
                    $periodStart = Carbon::createFromFormat('Y-m', $request->start_date)->startOfMonth();
                } else {
                    $periodStart = Carbon::parse($request->start_date)->startOfDay();
                }
            } catch (\Exception $e) {
                $periodStart = $mahasiswa && $mahasiswa->mulai_magang ? Carbon::parse($mahasiswa->mulai_magang)->startOfDay() : Carbon::now()->subDays(30)->startOfDay();
            }
        } elseif ($mahasiswa && $mahasiswa->mulai_magang) {
            $periodStart = Carbon::parse($mahasiswa->mulai_magang)->startOfDay();
        } else {
            $periodStart = Carbon::now()->subDays(30)->startOfDay();
        }

        if ($request->filled('start_date')) {
            // When start_date is provided, expected workdays should be counted from start_date until TODAY
            $periodEnd = Carbon::now()->endOfDay();
            if ($mahasiswa && $mahasiswa->akhir_magang) {
                $am = Carbon::parse($mahasiswa->akhir_magang)->endOfDay();
                if ($am->lt($periodEnd)) {
                    $periodEnd = $am;
                }
            }
        } elseif ($request->filled('end_date')) {
            try {
                if (preg_match('/^\\d{4}-\\d{2}$/', $request->end_date)) {
                    $periodEnd = Carbon::createFromFormat('Y-m', $request->end_date)->endOfMonth()->endOfDay();
                } else {
                    $periodEnd = Carbon::parse($request->end_date)->endOfDay();
                }
            } catch (\Exception $e) {
                $periodEnd = $today->copy();
            }
        } else {
            $periodEnd = $today->copy();
            if ($mahasiswa && $mahasiswa->akhir_magang) {
                $am = Carbon::parse($mahasiswa->akhir_magang)->endOfDay();
                if ($am->lt($periodEnd)) {
                    $periodEnd = $am;
                }
            }
        }

        // Cap periodEnd to today & akhir_magang if needed
        $todayCap = Carbon::now()->endOfDay();
        if ($periodEnd->gt($todayCap)) $periodEnd = $todayCap;
        if ($mahasiswa && $mahasiswa->akhir_magang) {
            $am = Carbon::parse($mahasiswa->akhir_magang)->endOfDay();
            if ($am->lt($periodEnd)) $periodEnd = $am;
        }

        // Count logbooks by status within the period
        $logbookQueryBase = \App\Models\Logbook::query();
        // Limit logbooks to mahasiswa profile id
        $logbookQueryBase->where('id_mahasiswa', $mahasiswaId);

        $pending = (clone $logbookQueryBase)
            ->whereBetween('tanggal', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->where('status_verifikasi', 'pending')
            ->count();

        $verified = (clone $logbookQueryBase)
            ->whereBetween('tanggal', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->where('status_verifikasi', 'verified')
            ->count();

        $revisionNeeded = (clone $logbookQueryBase)
            ->whereBetween('tanggal', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->where('status_verifikasi', 'revision_needed')
            ->count();

        // Prefetch logbooks by date in the period
        $logbooksByDate = (clone $logbookQueryBase)
            ->whereBetween('tanggal', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->get()
            ->keyBy(function ($l) { return Carbon::parse($l->tanggal)->toDateString(); })
            ->all();

        $totalSubmitted = $pending + $verified + $revisionNeeded;

        $liburDates = \App\Models\Libur::pluck('tanggal')->toArray();
        // Normalize all date arrays to plain Y-m-d strings to avoid non-scalar values (Carbon/null)
        $normalizeDate = fn($v) => ($v instanceof Carbon) ? $v->toDateString() : (string)$v;
        $liburDates = array_filter(array_map($normalizeDate, $liburDates));
        $liburSet = array_flip($liburDates);

        // Prefetch approved leave_requests spanning the period and approved koreksi per date so daily-summary reflects them
        $leaveQuery = \App\Models\Izin::query();
        if ($mahasiswaId) { $leaveQuery->where('id_mahasiswa', $mahasiswaId); } else { $leaveQuery->where('user_id', $intern->user_id); }
        $leave_requestss = $leaveQuery->where('status', 'approved')
            ->whereRaw('(IFNULL(tanggal_selesai, tanggal_mulai) >= ?) AND (tanggal_mulai <= ?)', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->get();

        $leave_requestssByDate = [];
        foreach ($leave_requestss as $iz) {
            $startI = Carbon::parse($iz->tanggal_mulai)->startOfDay();
            $endI = $iz->tanggal_selesai ? Carbon::parse($iz->tanggal_selesai)->startOfDay() : Carbon::parse($iz->tanggal_mulai)->startOfDay();
            if ($startI->lt($periodStart)) $startI = $periodStart->copy();
            if ($endI->gt($periodEnd)) $endI = $periodEnd->copy();
            for ($d = $startI->copy(); $d->lte($endI); $d->addDay()) {
                $ds = $d->toDateString();
                if ($d->isWeekend() || isset($liburSet[$ds])) continue;
                $leave_requestssByDate[$ds] = $iz;
            }
        }

        $koreksiByDate = \App\Models\KoreksiAbsensi::where('user_id', $intern->user_id)
            ->where('status', 'approved')
            ->whereBetween('tanggal', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->get()
            ->keyBy(function ($k) {
                return Carbon::parse($k->tanggal)->toDateString();
            })
            ->all();

        // Calculate expected working days using same logic as getInternDetails (attendance + absent)
        $rows = \App\Models\TblAbsensi::select([
                'attendances.tanggal',
                \DB::raw("MAX(CASE WHEN attendances.status = 'masuk' THEN attendances.waktu END) as jam_masuk"),
                \DB::raw("MAX(izin.id_izin) as leave_requests_id"),
                \DB::raw("MAX(izin.jenis_izin) as leave_requests_jenis"),
                \DB::raw("MAX(attendance_corrections.id_koreksi) as koreksi_id"),
            ])
            ->where('attendances.id_mahasiswa', $mahasiswaId)
            ->leftJoin('izin', function ($join) {
                $join->on('izin.id_mahasiswa', '=', 'attendances.id_mahasiswa')
                    ->where('izin.status', 'approved')
                    ->whereRaw('attendances.tanggal BETWEEN izin.tanggal_mulai AND IFNULL(izin.tanggal_selesai, izin.tanggal_mulai)')
                    ->whereRaw('attendances.tanggal <= ?', [now()->toDateString()]);
            })
            ->leftJoin('attendance_corrections', function ($join) {
                $join->on('attendance_corrections.id_mahasiswa', '=', 'attendances.id_mahasiswa')
                    ->where('attendance_corrections.status', 'approved')
                    ->whereRaw('attendances.tanggal = attendance_corrections.tanggal')
                    ->whereRaw('attendances.tanggal <= ?', [now()->toDateString()]);
            })
            ->whereBetween('attendances.tanggal', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->groupBy('attendances.tanggal')
            ->get();

        $rowsByDate = $rows->keyBy(function ($row) {
            return Carbon::parse($row->tanggal)->format('Y-m-d');
        });

        $expectedWorkdays = 0;
        $notSubmit = 0;
        $notYetCount = 0;
        for ($d = $periodStart->copy(); $d->lte($periodEnd); $d->addDay()) {
            $ds = $d->toDateString();
            if ($d->isWeekend() || isset($liburSet[$ds])) continue;

            $row = $rowsByDate->has($ds) ? $rowsByDate->get($ds) : null;

            if ($row) {
                // Check leave_requests
                if ($row->leave_requests_id && strtolower($row->leave_requests_jenis) === 'sakit') {
                    $expectedWorkdays++;
                } elseif ($row->leave_requests_id && strtolower($row->leave_requests_jenis) === 'leave_requests') {
                    $expectedWorkdays++;
                } else {
                    // Attendance or absent
                    $expectedWorkdays++;
                }
            } else {
                // No absensi data => still count as expected workday
                $expectedWorkdays++;
            }

            // Determine logbooks / attendance / leave_requests / koreksi state for this date
            $hasLogbook = isset($logbooksByDate[$ds]);
            $hasAttendance = $row !== null;
            $hasIzin = isset($leave_requestssByDate[$ds]);
            $hasKoreksi = isset($koreksiByDate[$ds]);

            if (!$hasLogbook) {
                if (!$hasAttendance) {
                    // No attendance and either there's an leave_requests OR implicitly absent -> Not Submit
                    $notSubmit++;
                } elseif ($hasAttendance && !$hasIzin && !$hasKoreksi) {
                    // Has attendance but no logbooks and no leave_requests/koreksi -> Not Yet
                    $notYetCount++;
                }
            }
        }

-        // Calculate not_yet as: expected working days - total submitted logbooks entries
-        $notYet = max(0, $expectedWorkdays - $totalSubmitted);
        // Final counts
        $notYet = $notYetCount;
        $total = $expectedWorkdays;
        $completionRate = $total > 0 ? round(($verified / $total) * 100, 1) : 0;

        // Optional holidays diagnostic for debugging
        $holidaysInPeriod = array_values(array_filter($liburDates, function($d) use ($periodStart, $periodEnd) {
            try {
                $dt = Carbon::parse($d);
                return $dt->betweenIncluded($periodStart, $periodEnd);
            } catch (\Exception $e) {
                return false;
            }
        }));

        if ($request->boolean('debug_holidays')) {
            $data_debug_holidays = [
                'holidays_in_period_count' => count($holidaysInPeriod),
                'holidays_in_period' => $holidaysInPeriod,
            ];
        } else {
            $data_debug_holidays = [];
        }

        $data = [
            'id' => $intern->user_id,
            'nama' => $intern->nama,
            'identifier' => $intern->identifier,
            'period_start' => $periodStart->toDateString(),
            'period_end' => $periodEnd->toDateString(),
            'pending' => $pending,
            'verified' => $verified,
            'revision_needed' => $revisionNeeded,
            'not_yet' => $notYet,
            'not_submit' => $notSubmit,
            'total' => $total,
            'expected_workdays' => $expectedWorkdays,
            'completion_rate' => $completionRate,
            'percent_submitted' => $total > 0 ? round(($verified / $total) * 100, 1) : null,
            'chart_data' => [
                'labels' => ['Pending', 'Verified', 'Revision Needed', 'Not Yet', 'Not Submit'],
                'datasets' => [
                    [
                        'label' => 'Logbook Status',
                        'data' => [$pending, $verified, $revisionNeeded, $notYet, $notSubmit],
                        'backgroundColor' => ['#FFA500', '#4CAF50', '#FF6B6B', '#9E9E9E', '#607D8B'],
                        'borderColor' => ['#FF8C00', '#45a049', '#FF5252', '#757575', '#455A64'],
                        'borderWidth' => 1,
                    ]
                ],
            ],
        ];

        if ($request->boolean('debug_holidays')) {
            $data = array_merge($data, $data_debug_holidays);
        }

        return response()->json([
            'success' => true,
            'data' => $data
        ]);
    }

    /**
     * Get detailed attendance records with all related data (leave_requests, sakit, koreksi)
     * Each record shows complete clock in/out info with coordinates, photos, and all absence reasons
     * Route: GET /api/mentor/interns/{id}/attendance-detail OR /api/admin/interns/{id}/attendance-detail
     */
    public function getInternAttendanceDetailComplete(Request $request, $id)
    {
        $user = $request->user();

        // Resolve $id as id_mahasiswa (preferred) or legacy user_id (fallback)
        $mahasiswa = \App\Models\TblMahasiswa::find($id) ?? \App\Models\TblMahasiswa::where('user_id', $id)->first();
        if (!$mahasiswa) {
            return response()->json([
                'success' => false,
                'message' => 'Intern tidak ditemukan'
            ], 404);
        }

        // Check authorization: mentor or admin only
        if (!$user->isAdmin() && !$user->isMentor()) {
            return response()->json([
                'success' => false,
                'message' => 'Unauthorized'
            ], 403);
        }

        // If mentor, verify they have access to this mahasiswa via profile-based pivot
        if ($user->isMentor() && !$user->isAdmin()) {
            $karyawanId = $user->karyawan?->id_karyawan;
            $hasAccess = $karyawanId && \DB::table('intern_mentors')
                ->where('mentor_id', $karyawanId)
                ->where('intern_id', $mahasiswa->id_mahasiswa)
                ->where('is_active', true)
                ->exists();

            if (!$hasAccess) {
                return response()->json([
                    'success' => false,
                    'message' => 'You do not have access to this intern'
                ], 403);
            }
        }

        // Validate optional date filters
        $request->validate([
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'tanggal' => 'nullable|date',
        ]);

        $intern = $mahasiswa->user;
        $mahasiswaId = $mahasiswa->id_mahasiswa;

        // Determine intern period: mulai_magang -> akhir_magang (cap to today)
        $today = Carbon::now()->endOfDay();
        if ($mahasiswa && $mahasiswa->mulai_magang) {
            $periodStart = Carbon::parse($mahasiswa->mulai_magang)->startOfDay();
        } else {
            $periodStart = Carbon::now()->subDays(30)->startOfDay();
        }

        $periodEnd = $today->copy();
        if ($mahasiswa && $mahasiswa->akhir_magang) {
            $am = Carbon::parse($mahasiswa->akhir_magang)->endOfDay();
            if ($am->lt($periodEnd)) $periodEnd = $am;
        }

        // Allow override via request parameters
        if ($request->filled('start_date')) {
            $periodStart = Carbon::parse($request->start_date)->startOfDay();
        }
        if ($request->filled('end_date')) {
            $periodEnd = Carbon::parse($request->end_date)->endOfDay();
        }

        // Cap periodEnd to today (jangan tampilkan hari di masa depan)
        $todayCap = Carbon::now()->endOfDay();
        if ($periodEnd->gt($todayCap)) {
            $periodEnd = $todayCap;
        }

        // Single date filter if provided
        if ($request->filled('tanggal')) {
            $singleDate = Carbon::parse($request->tanggal)->toDateString();
            $periodStart = Carbon::parse($singleDate)->startOfDay();
            $periodEnd = Carbon::parse($singleDate)->endOfDay();
        }

        // Pagination
        $perPage = $request->per_page ?? 20;
        $page = $request->page ?? 1;

        // Get all attendance records for the period (including duplicate dates for masuk/pulang)
        $allQuery = \App\Models\TblAbsensi::query()->where('id_mahasiswa', $mahasiswaId);
        $allRecords = $allQuery
            ->whereBetween('tanggal', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->orderBy('tanggal', 'desc')
            ->orderBy('waktu', 'desc')
            ->get();

        // Group attendance by date (normalize tanggal to Y-m-d string)
        $attendanceByDate = [];
        foreach ($allRecords as $record) {
            $dateStr = Carbon::parse($record->tanggal)->toDateString();
            if (!isset($attendanceByDate[$dateStr])) {
                $attendanceByDate[$dateStr] = collect();
            }
            $attendanceByDate[$dateStr]->push($record);
        }

        // Get all leave_requests records for the period
        $leaveQuery = \App\Models\Izin::query()->where('id_mahasiswa', $mahasiswaId);
        $leave_requestss = $leaveQuery->where('status', 'approved')
            ->whereRaw('(IFNULL(tanggal_selesai, tanggal_mulai) >= ?) AND (tanggal_mulai <= ?)', 
                [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->get();

        // Get all koreksi records for the period
        $koreksiQuery = \App\Models\KoreksiAbsensi::query()->where('id_mahasiswa', $mahasiswaId);
        $koreksis = $koreksiQuery->where('status', 'approved')
            ->whereBetween('tanggal', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->get();

        // Normalize koreksi dates to Y-m-d string
        $koreksisByDate = [];
        foreach ($koreksis as $kor) {
            $dateStr = Carbon::parse($kor->tanggal)->toDateString();
            $koreksisByDate[$dateStr] = $kor;
        }

        // Get libur dates for reference
        $liburDates = \App\Models\Libur::pluck('tanggal')->toArray();
        $normalizeDate = fn($v) => ($v instanceof Carbon) ? $v->toDateString() : (string)$v;
        $liburDates = array_filter(array_map($normalizeDate, $liburDates));
        $liburSet = array_flip($liburDates);

        // Build list of all unique dates in period
        $allDates = [];
        for ($d = $periodStart->copy(); $d->lte($periodEnd); $d->addDay()) {
            $ds = $d->toDateString();
            $allDates[] = $ds;
        }

        // Build detailed records for all dates (attendance + leave_requests + koreksi)
        $detailedRecords = [];
        
        foreach ($allDates as $tanggal) {
            $tanggalObj = Carbon::parse($tanggal);
            $isWeekend = $tanggalObj->isWeekend();
            $isLibur = isset($liburSet[$tanggal]);

            // Skip weekend and holiday (libur) records - jangan ditampilkan
            if ($isWeekend || $isLibur) {
                continue;
            }

            // Get attendance for this date
            $attendanceRecords = $attendanceByDate[$tanggal] ?? collect();
            $masukRecord = $attendanceRecords->firstWhere('status', 'masuk');
            $pulangRecord = $attendanceRecords->firstWhere('status', 'pulang');

            // Get leave_requests for this date (check if date falls within leave_requests range)
            $leave_requests = null;
            foreach ($leave_requestss as $iz) {
                $startI = Carbon::parse($iz->tanggal_mulai)->startOfDay();
                $endI = $iz->tanggal_selesai ? Carbon::parse($iz->tanggal_selesai)->startOfDay() : Carbon::parse($iz->tanggal_mulai)->startOfDay();
                $currentDate = Carbon::parse($tanggal)->startOfDay();
                
                if ($currentDate->betweenIncluded($startI, $endI)) {
                    $leave_requests = $iz;
                    break;
                }
            }

            // Get koreksi for this date
            $koreksi = $koreksisByDate[$tanggal] ?? null;

            // Calculate work duration if both clock in and out exist
            $durationFormatted = null;
            $durationMinutes = null;
            if ($masukRecord && $pulangRecord) {
                $masukTime = Carbon::parse($masukRecord->waktu);
                $pulangTime = Carbon::parse($pulangRecord->waktu);
                $durationMinutes = $pulangTime->diffInMinutes($masukTime);
                $hours = intdiv($durationMinutes, 60);
                $minutes = $durationMinutes % 60;
                $durationFormatted = sprintf('%02d:%02d', $hours, $minutes);
            }

            // Determine attendance status
            $attendanceStatus = 'not_submitted';
            if ($isWeekend) {
                $attendanceStatus = 'weekend';
            } elseif ($isLibur) {
                $attendanceStatus = 'holiday';
            } elseif ($leave_requests) {
                $attendanceStatus = strtolower($leave_requests->jenis_izin) === 'sakit' ? 'sick' : 'on_leave';
            } elseif ($koreksi) {
                $attendanceStatus = 'corrected';
            } elseif ($masukRecord && $pulangRecord) {
                $lateMinutes = $masukRecord->lama_telat ?? 0;
                $attendanceStatus = $lateMinutes > 0 ? 'late' : 'ontime';
            } elseif ($masukRecord || $pulangRecord) {
                $attendanceStatus = 'incomplete';
            } else {
                $attendanceStatus = 'absent';
            }

            $record = [
                'tanggal' => $tanggal,
                'hari' => $tanggalObj->format('l'), // Day name (Monday, Tuesday, etc)
                'is_weekend' => $isWeekend,
                'is_libur' => $isLibur,
                'attendance_status' => $attendanceStatus,
                
                // Clock in details
                'clock_in' => $masukRecord ? [
                    'waktu' => $masukRecord->waktu,
                    'latitude' => $masukRecord->latitude_absen,
                    'longitude' => $masukRecord->longitude_absen,
                    'foto' => $masukRecord->foto_absen ? route('absensi.foto-masuk', ['param' => basename($masukRecord->foto_absen)]) : null,
                    'foto_filename' => $masukRecord->foto_absen ? basename($masukRecord->foto_absen) : null,
                    'lama_telat' => $masukRecord->lama_telat ?? 0,
                    'is_valid_area' => $masukRecord->is_valid_area ?? 0,
                ] : null,

                // Clock out details
                'clock_out' => $pulangRecord ? [
                    'waktu' => $pulangRecord->waktu,
                    'latitude' => $pulangRecord->latitude_absen,
                    'longitude' => $pulangRecord->longitude_absen,
                    'foto' => $pulangRecord->foto_absen ? route('absensi.foto-pulang', ['param' => basename($pulangRecord->foto_absen)]) : null,
                    'foto_filename' => $pulangRecord->foto_absen ? basename($pulangRecord->foto_absen) : null,
                    'early' => $pulangRecord->early ?? 0,
                    'remark' => $pulangRecord->remark ?? null,
                ] : null,

                // Work duration
                'work_duration' => [
                    'formatted' => $durationFormatted,
                    'minutes' => $durationMinutes,
                ],

                // Izin (Leave/Sick) details
                'leave_requests' => $leave_requests ? [
                    'id' => $leave_requests->id_izin,
                    'jenis' => strtolower($leave_requests->jenis_izin),
                    'tanggal_mulai' => $leave_requests->tanggal_mulai,
                    'tanggal_selesai' => $leave_requests->tanggal_selesai,
                    'durasi_hari' => $leave_requests->durasi_hari,
                    'keterangan' => $leave_requests->keterangan,
                    'status' => $leave_requests->status,
                ] : null,

                // Koreksi (Correction) details
                'koreksi' => $koreksi ? [
                    'id' => $koreksi->id_koreksi,
                    'alasan' => $koreksi->alasan,
                    'status' => $koreksi->status,
                    'diverifikasi_oleh' => $koreksi->diverifikasi_oleh,
                    'tanggal_verifikasi' => $koreksi->tanggal_verifikasi,
                ] : null,
            ];

            $detailedRecords[] = $record;
        }

        // Sort by date descending
        usort($detailedRecords, function ($a, $b) {
            return strcmp($b['tanggal'], $a['tanggal']);
        });

        // Paginate
        $totalRecords = count($detailedRecords);
        $offset = ($page - 1) * $perPage;
        $paginatedRecords = array_slice($detailedRecords, $offset, $perPage);

        $data = [
            'intern' => [
                'id' => $intern->user_id,
                'nama' => $intern->nama,
                'identifier' => $intern->identifier,
            ],
            'period' => [
                'start' => $periodStart->toDateString(),
                'end' => $periodEnd->toDateString(),
            ],
            'attendance_records' => $paginatedRecords,
            'pagination' => [
                'total' => $totalRecords,
                'per_page' => $perPage,
                'current_page' => $page,
                'last_page' => ceil($totalRecords / $perPage),
                'from' => $totalRecords > 0 ? $offset + 1 : null,
                'to' => $totalRecords > 0 ? min($offset + $perPage, $totalRecords) : null,
            ],
        ];

        return response()->json([
            'success' => true,
            'data' => $data
        ]);
    }

    public function getInternNoUser(Request $request)
    {
        $page = (int) $request->input('page', 1);
        $perPage = (int) $request->input('per_page', 25);
        $q = $request->input('q');
        $universitas = $request->input('universitas');
        $status = $request->input('status'); // ignored, always inactive

        // only need identifying fields for the add-user screen
        $query = \App\Models\TblMahasiswa::select(['id_mahasiswa','nama','nim as identifier','email']);

        // restrict to interns not linked to a user
        $query->where(function ($sub) {
            $sub->whereNull('user_id')
                ->orWhereDoesntHave('user');
        });

        // optional search by name or identifier only
        if ($q) {
            $query->where(function ($qb) use ($q) {
                $qb->where('nama', 'like', "%{$q}%")
                   ->orWhere('nim', 'like', "%{$q}%");
            });
        }

        $paginator = $query->paginate($perPage, ['*'], 'page', $page);
        $rows = $paginator->items();

        // no additional lookups needed – only id, nama, identifier, email are returned

        // output minimal fields
        $data = array_map(function ($mahasiswa) {
            return [
                'id_mahasiswa' => $mahasiswa->id_mahasiswa,
                'nama' => $mahasiswa->nama,
                'identifier' => $mahasiswa->identifier ?? $mahasiswa->nim ?? null,
                'email' => $mahasiswa->email,
            ];
        }, $rows);

        return response()->json([
            'current_page' => $paginator->currentPage(),
            'data' => $data,
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
            'last_page' => $paginator->lastPage(),
            'from' => $paginator->firstItem(),
            'to' => $paginator->lastItem(),
        ]);
    }
}