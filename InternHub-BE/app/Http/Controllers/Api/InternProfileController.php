<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\DeleteInternData;
use Illuminate\Http\Request;
use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use App\Models\TblMahasiswa;
use App\Models\WorkSchedule;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class InternProfileController extends Controller
{
    /**
     * Create mahasiswa profile (tanpa user record)
     * Data disimpan ke students saja, untuk nanti di-assign ke user via User & Role page
     */
    public function storeProfile(Request $request)
    {
        $data = $request->validate([
            'nama' => 'required|string|max:255',
            'universitas' => 'nullable|string|max:255',
            'jurusan' => 'nullable|string|max:255',
            'nim' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'mulai_magang' => 'nullable|date',
            'akhir_magang' => 'nullable|date|after_or_equal:mulai_magang',
            'tempat_lahir' => 'nullable|string|max:255',
            'tanggal_lahir' => 'nullable|date',
            'nik' => 'nullable|string|max:20',
            'job_position' => 'nullable|string|max:255',
            'division' => 'nullable|string|max:255',
            'alamat' => 'nullable|string',
            'no_telp' => 'nullable|string|max:20',
            'jenjang_pendidikan' => 'nullable|string|max:100',
            'gender' => 'nullable|in:L,P',
            'semester' => 'nullable|integer|min:1',
            'nomor_darurat' => 'nullable|string|max:20',
            'nama_kontak_darurat' => 'nullable|string|max:255',
            'bank_name' => 'nullable|string|max:255',
            'bank_account_name' => 'nullable|string|max:255',
            'bank_account_number' => 'nullable|string|max:30',
            'id_site' => 'required|exists:sites,id_site',
        ]);

        // Enforce server-side active schedule (ignore client work_schedule_id/work_schedule)
        $activeSchedule = WorkSchedule::where('is_active', true)->first();
        if (!$activeSchedule) {
            return response()->json([
                'success' => false,
                'message' => 'No active work schedule configured.'
            ], 422);
        }
        $data['work_schedule_id'] = $activeSchedule->id;

        try {
            // Check for existing soft-deleted profile by NIM or Email
            $query = TblMahasiswa::withTrashed();
            $checkConditions = [];
            if (!empty($data['nim'])) $checkConditions[] = ['nim', $data['nim']];
            if (!empty($data['email'])) $checkConditions[] = ['email', $data['email']];

            // Only proceed with restoration check if we have distinct identifiers
            $existing = null;
            if (!empty($checkConditions)) {
                $query->where(function($q) use ($checkConditions) {
                    foreach ($checkConditions as $index => $condition) {
                        if ($index === 0) {
                            $q->where($condition[0], $condition[1]);
                        } else {
                            $q->orWhere($condition[0], $condition[1]);
                        }
                    }
                });
                $existing = $query->first();
            }

            if ($existing && $existing->trashed()) {
                // Restore ONLY, do not overwrite with new data as per user request
                $existing->restore();
                // $existing->update($data); // Commented out to preserve old data
                $mahasiswa = $existing;
                $message = 'Profil mahasiswa berhasil dipulihkan (restore). Data lama digunakan kembali.';
            } else {
                // Create new
                // If existing but ACTIVE, create() might fail due to unique constraints if any exist on DB level
                // Assuming application-level check is sufficient for now or DB constraints will throw helpful error
                $mahasiswa = TblMahasiswa::create($data);
                $message = 'Profil mahasiswa berhasil dibuat. Selanjutnya atur di halaman User & Role.';
            }

            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => $mahasiswa
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal membuat profil mahasiswa: ' . $e->getMessage()
            ], 400);
        }
    }

    /**
     * Admin: create mahasiswa profile with minimal required fields
     * Admin only needs to provide: nama, job_position, division, id_site
     * Interns will fill in the rest (universitas, jurusan, nim, alamat, no_telp, mulai_magang, akhir_magang)
     */
    public function storeAdminProfile(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'nama' => 'required|string|max:255',
            'job_position' => 'required|string|max:255',
            'division' => 'required|string|max:255',
            'id_site' => 'required|exists:sites,id_site',
            // Optional fields if admin wants to pre-fill
            'universitas' => 'nullable|string|max:255',
            'jurusan' => 'nullable|string|max:255',
            'nim' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'alamat' => 'nullable|string|max:500',
            'no_telp' => 'nullable|string|max:20',
            'mulai_magang' => 'nullable|date',
            'akhir_magang' => 'nullable|date|after_or_equal:mulai_magang',
        ]);

        // Enforce server-side active schedule (ignore client work_schedule_id/work_schedule)
        $activeSchedule = WorkSchedule::where('is_active', true)->first();
        if (!$activeSchedule) {
            return response()->json([
                'success' => false,
                'message' => 'No active work schedule configured.'
            ], 422);
        }

        try {
            // Map admin data to mahasiswa fields
            $mahasiswaData = [
                'nama' => $data['nama'],
                'job_position' => $data['job_position'],
                'division' => $data['division'],
                'id_site' => $data['id_site'],
                'work_schedule_id' => $activeSchedule->id,
            ];

            // Add optional fields if provided
            if (!empty($data['universitas'])) $mahasiswaData['universitas'] = $data['universitas'];
            if (!empty($data['jurusan'])) $mahasiswaData['jurusan'] = $data['jurusan'];
            if (!empty($data['nim'])) $mahasiswaData['nim'] = $data['nim'];
            if (!empty($data['alamat'])) $mahasiswaData['alamat'] = $data['alamat'];
            if (!empty($data['no_telp'])) $mahasiswaData['no_telp'] = $data['no_telp'];
            if (!empty($data['mulai_magang'])) $mahasiswaData['mulai_magang'] = $data['mulai_magang'];
            if (!empty($data['akhir_magang'])) $mahasiswaData['akhir_magang'] = $data['akhir_magang'];

            // Check for existing soft-deleted profile by NIM or Email (if provided)
            $query = TblMahasiswa::withTrashed();
            $checkConditions = [];
            if (!empty($mahasiswaData['nim'])) $checkConditions[] = ['nim', $mahasiswaData['nim']];
            if (!empty($data['email'])) $checkConditions[] = ['email', $data['email']]; // Email not in mahasiswaData yet? Add it.
            if (!empty($data['email'])) $mahasiswaData['email'] = $data['email'];


            // Only proceed with restoration check if we have identifiers
            $existing = null;
            if (!empty($checkConditions)) {
                $query->where(function($q) use ($checkConditions) {
                    foreach ($checkConditions as $index => $condition) {
                        if ($index === 0) {
                            $q->where($condition[0], $condition[1]);
                        } else {
                            $q->orWhere($condition[0], $condition[1]);
                        }
                    }
                });
                $existing = $query->first();
            }

            if ($existing && $existing->trashed()) {
                // Restore ONLY, do not overwrite with new data
                $existing->restore();
                // $existing->update($mahasiswaData); // Commented out to preserve old data
                $mahasiswa = $existing;
                $message = 'Profil mahasiswa (admin) berhasil dipulihkan (restore). Data lama digunakan kembali.';
            } else {
                $mahasiswa = TblMahasiswa::create($mahasiswaData);
                $message = 'Profil mahasiswa (admin) berhasil dibuat. Intern dapat melengkapi data lainnya nanti.';
            }

            return response()->json([
                'success' => true,
                'message' => $message,
                'data' => $mahasiswa
            ], 201);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Gagal membuat profil mahasiswa (admin): ' . $e->getMessage()
            ], 400);
        }
    }

    /**
     * List all interns (mahasiswa) - primary source of truth
     * Includes linked user info if available
     */
    public function index(Request $request)
    {
        $page = (int) $request->input('page', 1);
        $perPage = (int) $request->input('per_page', 25);
        $q = $request->input('q');
        $universitas = $request->input('universitas');
        $division = $request->input('division');
        $status = $request->input('status'); // 'active' (has user) or 'inactive' (no user)

        $query = TblMahasiswa::query();

        // Search by name or universitas
        if ($q) {
            $query->where(function($qb) use ($q) {
                $qb->where('nama', 'like', "%{$q}%")
                   ->orWhere('universitas', 'like', "%{$q}%");
            });
        }

        // Filter by universitas
        if ($universitas) {
            $query->where('universitas', $universitas);
        }

        // Filter by division
        if ($division) {
            $query->where('division', $division);
        }

        // Filter by status: active = has user_id, inactive = no user_id
        if ($status === 'active') {
            $query->whereNotNull('user_id');
        } elseif ($status === 'inactive') {
            $query->whereNull('user_id');
        }

        // allow a more semantic `type` parameter matching the output `type` field
        // type=mahasiswa  -> unassigned interns (same as status=inactive)
        // type=user       -> assigned interns (same as status=active)
        $reqType = $request->input('type');
        if ($reqType === 'mahasiswa') {
            $query->whereNull('user_id');
        } elseif ($reqType === 'user') {
            $query->whereNotNull('user_id');
        }

        // Eager load related user (minimal fields only - students are source-of-truth for full profiles)
        $query->with([
            'user:user_id,nama,email,status,must_change_password,created_at,updated_at',
            'workSchedule:id,name,start_time,end_time,days,day_times,tolerance,is_active'
        ]);

        // Paginate
        $paginator = $query->paginate($perPage, ['*'], 'page', $page);

        // Map to normalized output (use paginator items to avoid calling collection methods on paginator)
        $rows = $paginator->items();
        $activeSchedule = WorkSchedule::where('is_active', true)->first();
        $needsScheduleSyncIds = [];

        // Collect user_ids for mentor lookup
        $internUserIds = [];
        foreach ($rows as $m) {
            if (!empty($m->user_id)) $internUserIds[] = $m->user_id;
        }

        $mentorsByIntern = [];
        if (!empty($internUserIds)) {
            $ims = \App\Models\InternMentor::whereIn('intern_id', $internUserIds)
                        ->where('is_active', 1)
                        ->orderBy('assigned_date', 'desc')
                        ->get()
                        ->groupBy('intern_id');

            foreach ($ims as $internId => $coll) {
                $first = $coll->first();
                $mentorsByIntern[$internId] = [
                    'mentor_id' => $first->mentor_id,
                    'mentor_name' => $first->mentor?->nama ?? null
                ];
            }
        }

        $data = array_map(function($mahasiswa) use ($mentorsByIntern, $activeSchedule, &$needsScheduleSyncIds) {
            $effectiveWorkSchedule = $mahasiswa->workSchedule;
            if ((!$effectiveWorkSchedule || !(bool) $effectiveWorkSchedule->is_active) && $activeSchedule) {
                $effectiveWorkSchedule = $activeSchedule;
                if ((int) $mahasiswa->work_schedule_id !== (int) $activeSchedule->id) {
                    $needsScheduleSyncIds[] = $mahasiswa->id_mahasiswa;
                }
            }

            $obj = [
                'id_mahasiswa' => $mahasiswa->id_mahasiswa,
                'type' => $mahasiswa->user_id ? 'user' : 'mahasiswa',
                'user_id' => $mahasiswa->user_id,
                'identifier' => $mahasiswa->nim,
                'nama' => $mahasiswa->nama,
                'no_telp' => $mahasiswa->no_telp,
                'status' => $mahasiswa->user?->status ?? 'inactive',
                'id_site' => $mahasiswa->id_site,
                // Prefer mahasiswa photo (students table). Use mahasiswa id for photo endpoint when possible.
            'foto_url' => $mahasiswa->foto ? url("/api/admin/intern-profiles/{$mahasiswa->id_mahasiswa}/photo?type=foto") : ($mahasiswa->user?->foto ? url("/api/admin/intern-profiles/{$mahasiswa->id_mahasiswa}/photo") : null),
                'assigned' => !empty($mahasiswa->user_id),
                'email' => $mahasiswa->email ?? $mahasiswa->user?->email,
                // Mahasiswa fields
                'universitas' => $mahasiswa->universitas,
                'jurusan' => $mahasiswa->jurusan,
                'jenjang_pendidikan' => $mahasiswa->jenjang_pendidikan,
                'mulai_magang' => $mahasiswa->mulai_magang,
                'akhir_magang' => $mahasiswa->akhir_magang,
                'job_position' => $mahasiswa->job_position,
                'division' => $mahasiswa->division,
                'bank_name' => $mahasiswa->bank_name,
                'bank_account_name' => $mahasiswa->bank_account_name,
                'bank_account_number' => $mahasiswa->bank_account_number,
                'mentor' => $mahasiswa->user_id ? ($mentorsByIntern[$mahasiswa->user_id] ?? null) : null,
                'work_schedule' => $effectiveWorkSchedule ? [
                    'id' => $effectiveWorkSchedule->id,
                    'name' => $effectiveWorkSchedule->name,
                    'start_time' => $effectiveWorkSchedule->start_time,
                    'end_time' => $effectiveWorkSchedule->end_time,
                    'days' => $effectiveWorkSchedule->days,
                    'day_times' => $effectiveWorkSchedule->day_times,
                    'tolerance' => $effectiveWorkSchedule->tolerance,
                    'is_active' => isset($effectiveWorkSchedule->is_active) ? (bool)$effectiveWorkSchedule->is_active : null,
                ] : null,
            ];

            // Legacy aliases
            $obj['nama_bank'] = $obj['bank_name'];
            $obj['nama_pemegang_rekening'] = $obj['bank_account_name'];
            $obj['no_rekening'] = $obj['bank_account_number'];

            return $obj;
        }, $rows);

        if ($activeSchedule && !empty($needsScheduleSyncIds)) {
            TblMahasiswa::whereIn('id_mahasiswa', array_values(array_unique($needsScheduleSyncIds)))
                ->update(['work_schedule_id' => $activeSchedule->id]);
        }

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

    /**
     * Show mahasiswa profile detail by mahasiswa id (primary)
     * Returns linked user info if available
     */
    public function show(Request $request, $id)
    {
        $mahasiswa = TblMahasiswa::with('user')->find($id);

        if (!$mahasiswa) {
            // Backward compatibility: try to find by user_id and return mahasiswa
            $user = User::with('mahasiswa')->find($id);
            if ($user && $user->mahasiswa) {
                return response()
                    ->json([
                        'success' => true,
                        'type' => 'mahasiswa',
                        'data' => ['mahasiswa' => $user->mahasiswa],
                        'note' => 'Deprecated: Use mahasiswa id instead of user_id'
                    ])
                    ->header('X-Deprecated', 'Use mahasiswa id in URL path');
            }

            return response()->json([
                'success' => false,
                'message' => 'Mahasiswa tidak ditemukan'
            ], 404);
        }

        // Return mahasiswa and a minimal user representation (no redundant profile fields)
        $user = $mahasiswa->user;
        $minimalUser = $user ? [
            'user_id' => $user->user_id,
            'id_mahasiswa' => $mahasiswa->id_mahasiswa,
            'identifier' => $mahasiswa->nim,
            'nama' => $user->nama,
            'email' => $user->email,
            'status' => $user->status,
            'must_change_password' => $user->must_change_password,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
        ] : null;

        // Ensure returned mahasiswa payload always contains an `email` key for frontend consistency
        $mahasiswaArr = $mahasiswa->toArray();
        // Prefer students.email (set when profile created) then fall back to linked user's email
        $mahasiswaArr['email'] = $mahasiswa->email ?? $user?->email ?? null;

        // Attach full work_schedule detail — semua intern menggunakan schedule yang active (global)
        $workSchedule = null;
        $ws = \App\Models\WorkSchedule::getActive();
        if ($ws) {
            $workSchedule = [
                'id' => $ws->id,
                'name' => $ws->name,
                'start_time' => $ws->start_time ?? null,
                'end_time' => $ws->end_time ?? null,
                'days' => $ws->days ?? [],
                'day_times' => $ws->day_times ?? null,
                'is_active' => (bool)$ws->is_active,
                'tolerance' => $ws->tolerance ?? null,
            ];
        }
        $mahasiswaArr['work_schedule'] = $workSchedule;

        // Attach mentor summary (null if not assigned)
        // NOTE: intern_id in the pivot table references mahasiswa.id_mahasiswa, so we
        // must query using that. We also support legacy intern_user_id field.
        $mentor = null;
        $mentorQuery = \App\Models\InternMentor::where('is_active', 1)
                            ->orderBy('assigned_date', 'desc');
        if (!empty($mahasiswa->id_mahasiswa)) {
            $mentorQuery->where('intern_id', $mahasiswa->id_mahasiswa);
        }
        if (!empty($mahasiswa->user_id)) {
            // also check legacy field in case assignment used user ids
            $mentorQuery->orWhere('intern_user_id', $mahasiswa->user_id);
        }
        $im = $mentorQuery->first();
        if ($im) {
            $mentor = [
                'mentor_id' => $im->mentor_id,
                'mentor_name' => $im->mentor?->nama ?? null
            ];
        }
        $mahasiswaArr['mentor'] = $mentor;

        // Remove duplicated mahasiswa payload inside user object; client can read
        // both data.mahasiswa and data.user separately if needed.
        $userObj = $minimalUser;

        $response = [
            'success' => true,
            'type' => $mahasiswa->user_id ? 'user' : 'mahasiswa',
            'data' => [
                'mahasiswa' => $mahasiswaArr,
                'user' => $userObj,
            ]
        ];

        return response()->json($response);
    }

    /**
     * Update mahasiswa profile by mahasiswa id (primary)
     * Works with both assigned and unassigned mahasiswa
     */
    public function update(Request $request, $id)
    {
        // Primary: lookup by mahasiswa id
        $mahasiswa = TblMahasiswa::find($id);

        // Fallback: if id is user_id, find linked mahasiswa
        if (!$mahasiswa) {
            $user = User::find($id);
            if ($user && $user->mahasiswa) {
                $mahasiswa = $user->mahasiswa;
            }
        }

        if (!$mahasiswa) {
            return response()->json([
                'success' => false,
                'message' => 'Mahasiswa tidak ditemukan'
            ], 404);
        }

        // Normalize incoming alias fields (e.g. nama_lengkap, placement_location, internship_start/end)
        $this->normalizeProfileRequest($request);

        // Remove non-file fields that might cause validation issues
        if ($request->has('foto_ktm') && !$request->hasFile('foto_ktm')) {
            $request->request->remove('foto_ktm');
        }
        if ($request->has('bank_proof') && !$request->hasFile('bank_proof')) {
            $request->request->remove('bank_proof');
        }

        $request->validate([
            'nama' => 'sometimes|required|string|max:255',
            // Ensure email is unique in students table, exclude current mahasiswa record
            'email' => [
                'nullable',
                'email',
                'max:255',
                Rule::unique('students', 'email')->ignore($mahasiswa->id_mahasiswa, 'id_mahasiswa'),
            ],
            'no_telp' => 'nullable|string|max:20',
            'gender' => 'nullable|in:L,P',
            'universitas' => 'nullable|string|max:255',
            'jurusan' => 'nullable|string|max:255',
            'nim' => 'nullable|string|max:255',
            'mulai_magang' => 'nullable|date',
            'akhir_magang' => 'nullable|date|after_or_equal:mulai_magang',
            'alamat' => 'nullable|string|max:500',
            'nomor_darurat' => 'nullable|string|max:20',
            'nama_kontak_darurat' => 'nullable|string|max:255',
            'id_site' => 'nullable|exists:sites,id_site',
            'foto' => 'nullable|image|max:2048',
            'remove_foto' => 'sometimes|boolean',
            'foto_ktm' => 'nullable|image|max:2048',
            'remove_foto_ktm' => 'sometimes|boolean',
            'bank_name' => 'nullable|string|max:255',
            'bank_account_name' => 'nullable|string|max:255',
            'bank_account_number' => 'nullable|string|max:50',
            'bank_proof' => 'nullable|image|max:2048',
            'remove_bank_proof' => 'sometimes|boolean',
        ]);

        $updateData = $request->except(['foto_ktm', '_method', 'remove_foto_ktm', 'foto', 'remove_foto']);
        // Map legacy field names if present
        if (array_key_exists('no_rekening', $updateData) && !array_key_exists('bank_account_number', $updateData)) {
            $updateData['bank_account_number'] = $updateData['no_rekening'];
            unset($updateData['no_rekening']);
        }

        // Remove bank_proof from updateData to handle separately
        unset($updateData['bank_proof']);
        unset($updateData['remove_bank_proof']);


        if (empty($updateData)) {
            return response()->json([
                'success' => false,
                'message' => 'Tidak ada data yang berhasil dibaca dari request.'
            ], 400);
        }

        // Enforce server-side active schedule (ignore client work_schedule_id/work_schedule)
        $activeSchedule = WorkSchedule::where('is_active', true)->first();
        if (!$activeSchedule) {
            return response()->json([
                'success' => false,
                'message' => 'No active work schedule configured.'
            ], 422);
        }
        $updateData['work_schedule_id'] = $activeSchedule->id;

        // Handle Foto Upload with Encryption
        if ($request->hasFile('foto')) {
            try {
                // Delete old foto if exists
                if ($mahasiswa->foto) {
                    $oldPath = str_replace('storage/', '', $mahasiswa->foto);
                    if (str_starts_with($mahasiswa->foto, 'encrypted/')) {
                        if (Storage::disk('local')->exists($mahasiswa->foto)) {
                            Storage::disk('local')->delete($mahasiswa->foto);
                        }
                    } else {
                        if (Storage::disk('public')->exists($oldPath)) {
                            Storage::disk('public')->delete($oldPath);
                        }
                    }
                }
                
                $filename = time() . "_foto_" . uniqid() . ".enc";
                $fileContents = file_get_contents($request->file("foto")->getRealPath());
                $encryptedContents = Crypt::encryptString($fileContents);
                Storage::disk("local")->put("encrypted/users/" . $filename, $encryptedContents);
                $updateData['foto'] = "encrypted/users/" . $filename;
                Log::info("Foto berhasil di-upload dan di-encrypt di InternProfileController", ['filename' => $filename]);
            } catch (\Exception $e) {
                Log::error("Error saat upload foto di InternProfileController: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
                return response()->json(['message' => 'Error upload foto: ' . $e->getMessage()], 500);
            }
        }

        // Handle Foto KTM Upload with Encryption
        if ($request->hasFile('foto_ktm')) {
            try {
                // Delete old KTM if exists
                if ($mahasiswa->foto_ktm) {
                    $oldPath = str_replace('storage/', '', $mahasiswa->foto_ktm);
                    if (str_starts_with($mahasiswa->foto_ktm, 'encrypted/')) {
                        if (Storage::disk('local')->exists($mahasiswa->foto_ktm)) {
                            Storage::disk('local')->delete($mahasiswa->foto_ktm);
                        }
                    } else {
                        if (Storage::disk('public')->exists($oldPath)) {
                            Storage::disk('public')->delete($oldPath);
                        }
                    }
                }
                
                $filename = time() . "_ktm_" . uniqid() . ".enc";
                $fileContents = file_get_contents($request->file("foto_ktm")->getRealPath());
                $encryptedContents = Crypt::encryptString($fileContents);
                Storage::disk("local")->put("encrypted/users/" . $filename, $encryptedContents);
                $updateData['foto_ktm'] = "encrypted/users/" . $filename;
                Log::info("Foto KTM berhasil di-upload dan di-encrypt di InternProfileController", ['filename' => $filename]);
            } catch (\Exception $e) {
                Log::error("Error saat upload foto KTM di InternProfileController: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
                return response()->json(['message' => 'Error upload foto KTM: ' . $e->getMessage()], 500);
            }
        }

        // Handle Bank Proof Upload with Encryption
        if ($request->hasFile('bank_proof')) {
            try {
                // Delete old bank proof if exists
                if ($mahasiswa->bank_proof) {
                    if (str_starts_with($mahasiswa->bank_proof, 'encrypted/')) {
                        if (Storage::disk('local')->exists($mahasiswa->bank_proof)) {
                            Storage::disk('local')->delete($mahasiswa->bank_proof);
                        }
                    } else {
                        $oldPath = str_replace('storage/', '', $mahasiswa->bank_proof);
                        if (Storage::disk('public')->exists($oldPath)) {
                            Storage::disk('public')->delete($oldPath);
                        }
                    }
                }
                
                $filename = time() . '_bank_proof_' . uniqid() . '.enc';
                $fileContents = file_get_contents($request->file('bank_proof')->getRealPath());
                $encryptedContents = Crypt::encryptString($fileContents);
                Storage::disk('local')->put('encrypted/users/' . $filename, $encryptedContents);
                $updateData['bank_proof'] = 'encrypted/users/' . $filename;
                Log::info("Bank proof berhasil di-upload dan di-encrypt di InternProfileController", ['filename' => $filename]);
            } catch (\Exception $e) {
                Log::error("Error saat upload bank proof di InternProfileController: " . $e->getMessage(), ['trace' => $e->getTraceAsString()]);
                return response()->json(['message' => 'Error upload bank proof: ' . $e->getMessage()], 500);
            }
        }

        $mahasiswa->fill($updateData);
        $mahasiswa->save();

        // If this mahasiswa is linked to a user account, propagate certain fields (nama, email) to users table
        if (!empty($mahasiswa->user_id)) {
            try {
                $user = User::find($mahasiswa->user_id);
                if ($user) {
                    $userChanged = false;
                    if (array_key_exists('nama', $updateData) && $updateData['nama'] && $user->nama !== $updateData['nama']) {
                        $user->nama = $updateData['nama'];
                        $userChanged = true;
                    }
                    if (array_key_exists('email', $updateData) && $updateData['email'] && $user->email !== $updateData['email']) {
                        // ensure uniqueness
                        $exists = User::where('email', $updateData['email'])->where('user_id', '!=', $user->user_id)->exists();
                        if ($exists) {
                            return response()->json([
                                'success' => false,
                                'message' => 'Email sudah digunakan oleh akun lain'
                            ], 422);
                        }
                        $user->email = $updateData['email'];
                        $userChanged = true;
                    }
                    if ($userChanged) $user->save();
                }
            } catch (\Exception $e) {
                // don't break the main update flow; return helpful error if needed
                return response()->json([
                    'success' => false,
                    'message' => 'Gagal memperbarui akun terkait: ' . $e->getMessage()
                ], 500);
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Profil mahasiswa berhasil diperbarui',
            'data' => $mahasiswa->fresh(),
            'updated_fields' => array_keys($updateData)
        ]);
    }

    /**
     * Get intern photo (Secure Endpoint)
     */
    /**
     * Get intern photo (Secure Endpoint)
     * Query Param: ?type=foto (default) or ?type=ktm
     */
    public function getPhoto(Request $request, $id)
    {
        $type = $request->query('type', 'foto');

        // Prefer mahasiswa (students table) as source-of-truth for profiles/photos.
        // Primary lookup: by id_mahasiswa
        $mahasiswa = TblMahasiswa::find($id);
        $intern = $mahasiswa ? $mahasiswa->user : null;

        // Fallback: if not found, check if it's a user_id
        if (!$mahasiswa) {
            $intern = User::find($id);
            $mahasiswa = $intern ? $intern->mahasiswa : null;
        }

        if (!$mahasiswa) {
            return response()->json(['message' => 'Intern tidak ditemukan'], 404);
        }

        if ($type === 'ktm') {
            if (!$mahasiswa->foto_ktm) {
                return response()->json(['message' => 'Foto KTM tidak ditemukan'], 404);
            }
            $photoPath = $mahasiswa->foto_ktm;
        } elseif ($type === 'bank_proof') {
            if (!$mahasiswa->bank_proof) {
                return response()->json(['message' => 'Bukti bank tidak ditemukan'], 404);
            }
            $photoPath = $mahasiswa->bank_proof;
        } else {
            // Prefer mahasiswa->foto; fallback to user->foto only if mahasiswa photo not present
            if ($mahasiswa->foto) {
                $photoPath = $mahasiswa->foto;
            } elseif ($intern && $intern->foto) {
                $photoPath = $intern->foto;
            } else {
                return response()->json(['message' => 'Foto tidak ditemukan'], 404);
            }
        }

        // Verify storage existence
        $path = str_replace("storage/", "", str_replace("encrypted/", "", $photoPath));

        if (str_starts_with($photoPath, "encrypted/")) {
            if (!Storage::disk("local")->exists($photoPath)) return response()->json(["message" => "File fisik tidak ditemukan"], 404);
            $encryptedContents = Storage::disk("local")->get($photoPath);
            $decryptedContents = Crypt::decryptString($encryptedContents);
            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->buffer($decryptedContents) ?: "application/octet-stream";
            return response($decryptedContents, 200)->header("Content-Type", $mime);
        }

        if (!Storage::disk("public")->exists($path)) {
            return response()->json(["message" => "File fisik tidak ditemukan"], 404);
        }

        return Storage::disk("public")->response($path);
    }

    /**
     * Get Bank Proof document
     * Endpoint: GET /intern-profiles/{id}/bank-proof or /mahasiswa/{id}/bank-proof
     */
    public function getBankProof($id)
    {
        // Prefer mahasiswa (students table) as source-of-truth for profiles/documents.
        // Primary lookup: by id_mahasiswa
        $mahasiswa = TblMahasiswa::find($id);

        // Fallback: if not found, check if it's a user_id
        if (!$mahasiswa) {
            $intern = User::find($id);
            $mahasiswa = $intern ? $intern->mahasiswa : null;
        }

        if (!$mahasiswa || !$mahasiswa->bank_proof) {
            return response()->json(['message' => 'Bukti bank tidak ditemukan'], 404);
        }

        // Verify storage existence
        $path = str_replace("storage/", "", str_replace("encrypted/", "", $mahasiswa->bank_proof));

        if (str_starts_with($mahasiswa->bank_proof, "encrypted/")) {
            if (!Storage::disk("local")->exists($mahasiswa->bank_proof)) return response()->json(["message" => "File fisik tidak ditemukan"], 404);
            $encryptedContents = Storage::disk("local")->get($mahasiswa->bank_proof);
            $decryptedContents = Crypt::decryptString($encryptedContents);
            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->buffer($decryptedContents) ?: "application/octet-stream";
            return response($decryptedContents, 200)->header("Content-Type", $mime);
        }

        if (!Storage::disk("public")->exists($path)) {
            return response()->json(["message" => "File fisik tidak ditemukan"], 404);
        }
        return Storage::disk("public")->response($path);
    }

    /**
     * Normalize frontend alias fields into canonical mahasiswa fields before validation.
     */
    private function normalizeProfileRequest(Request $request)
    {
        $map = [];

        if ($request->filled('nama_lengkap')) $map['nama'] = $request->input('nama_lengkap');
        if ($request->filled('full_name')) $map['nama'] = $request->input('full_name');
        if ($request->filled('name')) $map['nama'] = $request->input('name');

        if ($request->filled('placement_location')) $map['id_site'] = $request->input('placement_location');
        if ($request->filled('placement')) $map['id_site'] = $request->input('placement');

        if ($request->filled('internship_start')) $map['mulai_magang'] = $request->input('internship_start');
        if ($request->filled('internship_end')) $map['akhir_magang'] = $request->input('internship_end');

        if ($request->filled('position')) $map['job_position'] = $request->input('position');
        if ($request->filled('phone')) $map['no_telp'] = $request->input('phone');
        if ($request->filled('identifier')) $map['nim'] = $request->input('identifier');

        // Work schedule: accept id or name
        if ($request->filled('work_schedule_id')) {
            $map['work_schedule_id'] = (int) $request->input('work_schedule_id');
        } elseif ($request->filled('work_schedule')) {
            $ws = $request->input('work_schedule');
            if (is_numeric($ws)) {
                $map['work_schedule_id'] = (int)$ws;
            } else {
                $found = \App\Models\WorkSchedule::where('name', $ws)->orWhere('name', 'like', "%{$ws}%")->first();
                if ($found) $map['work_schedule_id'] = $found->id;
            }
        }

        if (!empty($map)) {
            $request->merge($map);
        }
    }

    /**
     * Delete mahasiswa (unassigned) or return guidance if linked to user
     */
    /**
     * Delete mahasiswa (soft delete)
     * Also soft-deletes the linked User account if exists.
     */
    public function destroy($id)
    {
        $mahasiswa = TblMahasiswa::find($id);
        if (!$mahasiswa) {
            return response()->json([
                'success' => false,
                'message' => 'Intern profile not found'
            ], 404);
        }

        $userId     = $mahasiswa->user_id ?? null;
        $mahasiswaId = $mahasiswa->id_mahasiswa;

        try {
            DB::beginTransaction();

            // Hard delete user agar email/nama bisa dipakai ulang
            if ($userId) {
                $user = User::find($userId);
                if ($user) {
                    $user->forceDelete();
                }
            }

            // Soft-delete profil mahasiswa segera
            $mahasiswa->delete();

            DB::commit();
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Gagal menghapus profil: ' . $e->getMessage()
            ], 500);
        }

        // Hapus semua data terkait (absensi, logbook, izin, evaluasi, dll) secara async
        if ($userId) {
            DeleteInternData::dispatch($userId, $mahasiswaId);
        }

        return response()->json([
            'success' => true,
            'message' => 'Profil mahasiswa berhasil dihapus. Data terkait sedang dihapus di background.'
        ]);
    }

    /**
     * Create & link a User account for an existing mahasiswa
     * POST /admin/intern-profiles/{mahasiswa_id}/create-user
     */
    public function createUserForMahasiswa(Request $request, $mahasiswaId)
    {
        // This endpoint requires only mahasiswa id in URL. All user data is derived from students table.
        // Include soft-deleted interns to allow restoration via user creation
        $mahasiswa = TblMahasiswa::withTrashed()->find($mahasiswaId);
        
        if (!$mahasiswa) {
            return response()->json([
                'success' => false,
                'message' => 'Mahasiswa tidak ditemukan'
            ], 404);
        }

        // If intern was soft-deleted, restore it
        if ($mahasiswa->trashed()) {
            $mahasiswa->restore();
        }

        if (!empty($mahasiswa->user_id)) {
            // Check if liability user is active or deleted
            $linkedUser = User::withTrashed()->find($mahasiswa->user_id);
            if ($linkedUser && !$linkedUser->trashed()) {
                return response()->json([
                    'success' => false,
                    'message' => 'Mahasiswa sudah memiliki akun user. Gunakan endpoint Users untuk update.'
                ], 400);
            }
            // If linked user is deleted (or missing), we proceed to re-create/restore
            // We don't nullify user_id here yet, but we should rely on the logic below to handle it.
            // Actually, if we leave user_id set, we might have issues if we create a NEW user.
            // But our logic below (user restoration by email) should handle finding the SAME user if emails match.
        }

        // Ensure mahasiswa has a NIM to use as identifier (source-of-truth). If missing, generate a placeholder and persist it to mahasiswa.
        if (empty($mahasiswa->nim)) {
            $mahasiswa->nim = 'mahasiswa' . $mahasiswa->id_mahasiswa;
            $mahasiswa->save();
        }
        $identifier = $mahasiswa->nim;

        // Build email: prefer mahasiswa->email; otherwise generate a placeholder
        $mahasiswaEmail = $mahasiswa->email ?? null;
        $email = $mahasiswaEmail ?: ($identifier . '@no-reply.sip.local');

        // Ensure email unique (exclude soft-deleted from this check initially?)
        // Revised logic: Check if email exists in ALL users (including deleted)
        $baseEmailLocalPart = preg_replace('/@.*/', '', $email);
        $emailDomain = '@no-reply.sip.local';
        
        // If the calculated email exists as an ACTIVE user, increment.
        // If it exists as a DELETED user, we might want to reclaim it.
        $j = 1;
        while (User::where('email', $email)->exists()) {
             $email = $baseEmailLocalPart . '+' . $j++ . $emailDomain;
        }

        // Now check if this email exists in TRASH (soft deleted)
        $deletedUser = User::withTrashed()->where('email', $email)->first();

        // Generate password server-side and require user to change on first login
        $password = \Illuminate\Support\Str::random(8) . rand(100, 999) . '!';
        $hashedPassword = Hash::make($password);

        try {
            DB::beginTransaction();

            if ($deletedUser && $deletedUser->trashed()) {
                // Restore the deleted user
                $user = $deletedUser;
                $user->restore();
                
                // Update details
                $user->update([
                    'nama' => $mahasiswa->nama,
                    'password' => $hashedPassword,
                    'status' => 'active',
                    'must_change_password' => true,
                    'level' => 'intern',
                ]);
            } else {
                // Create new user with minimal fields. Full profile kept on students table.
                $user = User::create([
                    'nama' => $mahasiswa->nama,
                    'email' => $email,
                    'password' => $hashedPassword,
                    'status' => 'active',
                    'must_change_password' => true,
                    // ensure level reflects role for UI/legacy checks
                    'level' => 'intern',
                ]);
            }

            // Link user to mahasiswa
            $mahasiswa->update(['user_id' => $user->user_id]);

            // Assign intern role value
            $internRole = \App\Models\Role::where('name', 'intern')->first();
            if ($internRole) {
                $user->roles()->sync([$internRole->role_id]);
            } else {
                \Illuminate\Support\Facades\Log::warning('Role `intern` not found when creating user for mahasiswa ' . $mahasiswa->id_mahasiswa);
            }

            // Determine whether this is a placeholder email (skip actual send)
            $usedPlaceholderEmail = empty($mahasiswaEmail);
            $emailSent = false;

            // If we have a real email address, attempt send BEFORE committing so we can rollback on failure
            if (!$usedPlaceholderEmail && !empty($user->email)) {
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
                    \Illuminate\Support\Facades\Log::error('Failed to send welcome email during user creation for ' . ($user->email ?? 'unknown'), ['error' => $e->getMessage()]);
                    return response()->json([
                        'success' => false,
                        'message' => 'Gagal mengirim email. Akun tidak dibuat.',
                        'error' => config('app.debug') ? $e->getMessage() : 'Email delivery failed'
                    ], 500);
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => $deletedUser ? 'Akun user lama berhasil dipulihkan.' : 'Akun user berhasil dibuat.',
                'placeholder_email' => $usedPlaceholderEmail,
                'email_sent' => $emailSent,
                'email_error' => $emailSent ? null : null,
                'data' => [
                    'user' => $user,
                    'mahasiswa' => $mahasiswa->fresh()
                ]
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'Gagal membuat akun user: ' . $e->getMessage()
            ], 400);
        }
    }
}