<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Logbook;
use App\Models\User;
use Illuminate\Http\Request;
use Carbon\Carbon;
use App\Notifications\GeneralNotification;

class LogbookController extends Controller
{
    /**
     * List logbooks untuk intern yang login
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Logbook::forUser($user)
            ->orderBy('tanggal', 'desc');

        // Filter by status verifikasi (supports CSV or array, friendly labels)
        if ($request->has('status_verifikasi')) {
            $parsed = $this->normalizeStatusFilters($request->status_verifikasi);
            $statuses = $parsed['statuses'] ?? [];
            // index (own logbooks) doesn't support Not Yet special handling
            if (!empty($statuses)) {
                $query->whereIn('status_verifikasi', $statuses);
            }
        }

        // Filter by date range (ignore empty values)
        if ($request->filled('start_date') && $request->filled('end_date')) {
            $start = $this->parseDateParam($request->start_date);
            $end = $this->parseDateParam($request->end_date);
            if ($start && $end) {
                $query->whereBetween('tanggal', [$start, $end]);
            }
        }

        // Filter by bulan dan tahun
        if ($request->has('bulan') && $request->has('tahun')) {
            $query->whereMonth('tanggal', $request->bulan)
                  ->whereYear('tanggal', $request->tahun);
        }

        if ($request->has('q')) {
            $q = $request->q;
            $query->where('deskripsi_kegiatan', 'like', "%{$q}%");
        }

        $logbooks = $query->paginate($request->per_page ?? 10);

        return response()->json([
            'success' => true,
            'data' => $logbooks
        ]);
    }

    /**
     * Normalize status filters coming from UI (CSV or array) and map friendly labels
     * Returns array: ['statuses' => [...], 'include_not_yet' => bool]
     */
    private function normalizeStatusFilters($input)
    {
        $raw = is_array($input) ? $input : array_filter(array_map('trim', explode(',', $input)));
        $mapped = [];
        $includeNotYet = false;

        foreach ($raw as $r) {
            $lower = strtolower(trim($r));
            if ($lower === '') continue;

            // Accept several UI variants
            if (in_array($lower, ['approved', 'verified'])) {
                $mapped[] = 'verified';
                continue;
            }
            if (in_array($lower, ['pending'])) {
                $mapped[] = 'pending';
                continue;
            }
            if (in_array($lower, ['draft'])) {
                $mapped[] = 'draft';
                continue;
            }
            if (in_array($lower, ['revision', 'revision_needed', 'revision needed'])) {
                $mapped[] = 'revision_needed';
                continue;
            }
            if (in_array($lower, ['rejected'])) {
                $mapped[] = 'rejected';
                continue;
            }
            if (in_array($lower, ['not yet', 'not_yet', 'notyet', 'not-yet'])) {
                $includeNotYet = true;
                continue;
            }

            // Fallback: assume it's already a canonical status
            $mapped[] = $r;
        }

        // Ensure unique
        $mapped = array_values(array_unique($mapped));

        return ['statuses' => $mapped, 'include_not_yet' => $includeNotYet];
    }

    /**
     * Parse date param from UI accepting mm/dd/YYYY or ISO-like formats.
     * Returns Y-m-d string or null on failure.
     */
    private function parseDateParam($val)
    {
        if (empty($val)) return null;
        try {
            if (strpos($val, '/') !== false) {
                // mm/dd/yyyy
                $dt = Carbon::createFromFormat('m/d/Y', $val);
            } else {
                $dt = Carbon::parse($val);
            }
            return $dt->toDateString();
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Create logbooks entry (Intern)
     * Rich text / textarea untuk deskripsi kegiatan harian
     */
    public function store(Request $request)
    {
        $input = $request->all();

        // Robust file extraction: ensure we handle array of files
        // Fix: Explicitly merge files into input and force array structure for validation
        if ($request->hasFile('bukti_kegiatan')) {
            $files = $request->file('bukti_kegiatan');
            $input['bukti_kegiatan'] = is_array($files) ? $files : [$files];
        } else {
             unset($input['bukti_kegiatan']);
        }

        // For draft, deskripsi can be optional
        $isDraft = $request->boolean('is_draft');
        
        $validator = \Illuminate\Support\Facades\Validator::make($input, [
            'tanggal' => 'required|date|before_or_equal:today',
            'deskripsi_kegiatan' => $isDraft ? 'nullable|string|max:5000' : 'required|string|max:5000',
            'bukti_kegiatan' => 'nullable', // Base field check
            'bukti_kegiatan.*' => 'file|mimes:jpg,jpeg,png,pdf|max:51200', // Max 10MB per file, specific check for array items
            'is_draft' => 'nullable|boolean',
            'tag_id' => 'nullable|integer|exists:tags,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = $request->user();

        // Cek apakah sudah ada logbooks untuk tanggal yang sama
        $existing = Logbook::forUser($user)
            ->where('tanggal', $request->tanggal)
            ->first();

        if ($existing) {
            // Jika status rejected, revision_needed, atau draft, izinkan resubmit (update existing)
            if (in_array($existing->status_verifikasi, ['rejected', 'revision_needed', 'draft'])) {
                // Handle File Upload for resubmit
                $buktiPaths = [];
                if ($request->hasFile('bukti_kegiatan')) {
                    // Delete old files
                    $oldFiles = $existing->bukti_kegiatan;
                    if ($oldFiles && is_array($oldFiles)) {
                        foreach ($oldFiles as $oldFile) {
                            $path = str_replace('storage/', '', $oldFile);
                            \Illuminate\Support\Facades\Storage::disk('public')->delete($path);
                        }
                    }

                    $files = $request->file('bukti_kegiatan');
                    if (!is_array($files)) {
                        $files = [$files];
                    }
                    foreach ($files as $file) {
                        $filename = time() . '_' . uniqid() . '_' . $file->getClientOriginalName();
                        $path = $file->storeAs('logbooks', $filename, 'public');
                        $buktiPaths[] = 'storage/' . $path;
                    }
                }

                $updateData = [
                    'deskripsi_kegiatan' => $request->deskripsi_kegiatan ?? $existing->deskripsi_kegiatan,
                    'status_verifikasi' => $isDraft ? 'draft' : 'pending',
                    'feedback' => null, // Clear old feedback
                    'submitted_at' => $isDraft ? null : Carbon::now(),
                    'tag_id' => $request->filled('tag_id') ? $request->tag_id : $existing->tag_id,
                ];

                if (!empty($buktiPaths)) {
                    $updateData['bukti_kegiatan'] = $buktiPaths;
                }

                $existing->update($updateData);

                $message = $isDraft ? 'Logbook berhasil disimpan sebagai draft' : 'Logbook berhasil diajukan ulang';

                if (!$isDraft) {
                    // Notifikasi ke Mentor (Logbook Diperbaiki)
                    $mentors = $user->mentors()->get();
                    foreach ($mentors as $mentor) {
                        if ($mentor) {
                            $mentor->notify(new GeneralNotification(
                                'Revisi Logbook Dikirim',
                                "Intern {$user->nama} telah memperbaiki dan mengirim ulang logbook tanggal " . Carbon::parse($request->tanggal)->format('d-m-Y') . ".",
                                "/mentor/logbook",
                                "info",
                                "mentor"
                            ));
                        }
                    }
                }

                return response()->json([
                    'success' => true,
                    'message' => $message,
                    'data' => $existing->fresh()
                ], 200);
            }

            // Status lain (pending, verified, draft) tetap block
            return response()->json([
                'success' => false,
                'message' => 'Logbook untuk tanggal ini sudah ada. Silakan edit logbooks yang sudah ada.',
                'existing_logbooks' => $existing
            ], 400);
        }

        // Handle File Upload
        $buktiPaths = [];
        if ($request->hasFile('bukti_kegiatan')) {
            $files = $request->file('bukti_kegiatan');
            
            // Normalize to array
            if (!is_array($files)) {
                $files = [$files];
            }

            foreach ($files as $file) {
                 $filename = time() . '_' . uniqid() . '_' . $file->getClientOriginalName();
                 // Store in storage/app/public/logbooks
                 $path = $file->storeAs('logbooks', $filename, 'public');
                 $buktiPaths[] = 'storage/' . $path;
            }
        }

        $logbooks = Logbook::create([
            'user_id' => $user->user_id,
            'id_mahasiswa' => $user->mahasiswa?->id_mahasiswa ?? null,
            'tanggal' => $request->tanggal,
            'deskripsi_kegiatan' => $request->deskripsi_kegiatan ?? '',
            'bukti_kegiatan' => $buktiPaths, // Model mutator handles JSON encoding
            'tag_id' => $request->filled('tag_id') ? $request->tag_id : null,
            'status_verifikasi' => $isDraft ? 'draft' : 'pending',
            'submitted_at' => $isDraft ? null : Carbon::now(), // Set submission time jika submit (bukan draft)
        ]);

        $message = $isDraft ? 'Logbook berhasil disimpan sebagai draft' : 'Logbook berhasil diajukan';

        if (!$isDraft) {
            // Notifikasi ke Mentor (Logbook Baru)
            $mentors = $user->mentors()->get();
            foreach ($mentors as $mentor) {
                if ($mentor) {
                    $mentor->notify(new GeneralNotification(
                        'Logbook Baru',
                        "Intern {$user->nama} telah mensubmit logbook untuk tanggal " . Carbon::parse($request->tanggal)->format('d-m-Y') . ".",
                        "/mentor/logbook",
                        "info",
                        "mentor"
                    ));
                }
            }
        }

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $logbooks->load('tag')
        ], 201);
    }

    /**
     * Detail logbooks
     */
    public function show($id)
    {
        $logbooks = Logbook::with(['user', 'verifier', 'tag'])->find($id);

        if (!$logbooks) {
            return response()->json([
                'success' => false,
                'message' => 'Logbook tidak ditemukan'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $logbooks
        ]);
    }

    /**
     * Update logbooks (hanya jika status draft, pending, atau rejected)
     * Supports is_draft parameter to save as draft or submit for review
     */
    public function update(Request $request, $id)
    {
        $input = $request->all();

        // Robust file extraction: ensure we handle array of files
        // Fix: Explicitly merge files into input and force array structure for validation
        if ($request->hasFile('bukti_kegiatan')) {
             $files = $request->file('bukti_kegiatan');
             $input['bukti_kegiatan'] = is_array($files) ? $files : [$files];
        } else {
            unset($input['bukti_kegiatan']);
        }

        $isDraft = $request->boolean('is_draft');

        $validator = \Illuminate\Support\Facades\Validator::make($input, [
            'deskripsi_kegiatan' => $isDraft ? 'nullable|string|max:5000' : 'required|string|max:5000',
            'bukti_kegiatan' => 'nullable',
            'bukti_kegiatan.*' => 'file|mimes:jpg,jpeg,png,pdf|max:51200', // Max 10MB
            'is_draft' => 'nullable|boolean',
            'tag_id' => 'nullable|integer|exists:tags,id',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $user = $request->user();
        $logbooks = Logbook::where('id_logbooks', $id)
            ->where('user_id', $user->user_id)
            ->first();

        if (!$logbooks) {
            return response()->json([
                'success' => false,
                'message' => 'Logbook tidak ditemukan'
            ], 404);
        }

        // Hanya bisa edit jika status draft / rejected / revision_needed
        // PENDING dan VERIFIED tidak bisa di-edit (locked)
        if (!in_array($logbooks->status_verifikasi, ['draft', 'rejected', 'revision_needed'])) {
            return response()->json([
                'success' => false,
                'message' => 'Logbook dengan status ' . $logbooks->status_verifikasi . ' tidak dapat diubah'
            ], 400);
        }

        // Determine new status
        $newStatus = $isDraft ? 'draft' : 'pending';

        // Use validated $input instead of $request directly (better multipart handling)
        $dataToUpdate = [
            'deskripsi_kegiatan' => $input['deskripsi_kegiatan'] ?? $logbooks->deskripsi_kegiatan,
            'status_verifikasi' => $newStatus,
            'tag_id' => array_key_exists('tag_id', $input) ? ($input['tag_id'] ?: null) : $logbooks->tag_id,
        ];

        // Only clear feedback if submitting (not draft)
        if (!$isDraft) {
            $dataToUpdate['feedback'] = null;
            // Update submitted_at ketika resubmit (dari revision_needed ke pending)
            $dataToUpdate['submitted_at'] = Carbon::now();
        }

        // Handle File Replacement
        // NOTE: Currently we replace ALL files if new files are uploaded.
        // To support "append" or "delete specific", we need more complex logic on FE.
        if ($request->hasFile('bukti_kegiatan')) {
            // Delete old files
            $oldFiles = $logbooks->bukti_kegiatan; // Accessor ensures this is array
            if ($oldFiles && is_array($oldFiles)) {
                foreach ($oldFiles as $oldFile) {
                    if (\Illuminate\Support\Facades\Storage::exists(str_replace('storage/', 'public/', $oldFile))) {
                         \Illuminate\Support\Facades\Storage::delete(str_replace('storage/', 'public/', $oldFile));
                    }
                }
            } elseif ($oldFiles && is_string($oldFiles)) {
                 // Fallback for legacy single string (should be handled by accessor, but safe guard)
                 if (\Illuminate\Support\Facades\Storage::exists(str_replace('storage/', 'public/', $oldFiles))) {
                         \Illuminate\Support\Facades\Storage::delete(str_replace('storage/', 'public/', $oldFiles));
                    }
            }

            // Upload new files
            $files = $request->file('bukti_kegiatan');
            if (!is_array($files)) {
                $files = [$files];
            }
            
            $newPaths = [];
            foreach ($files as $file) {
                 $filename = time() . '_' . uniqid() . '_' . $file->getClientOriginalName();
                 $path = $file->storeAs('logbooks', $filename, 'public');
                 $newPaths[] = 'storage/' . $path;
            }
            $dataToUpdate['bukti_kegiatan'] = $newPaths; // Mutator will json_encode
        }

        $logbooks->update($dataToUpdate);

        $message = $isDraft ? 'Logbook berhasil disimpan sebagai draft' : 'Logbook berhasil diajukan untuk verifikasi';

        if (!$isDraft && $newStatus === 'pending') {
            // Notifikasi ke Mentor (Logbook Diajukan/Diubah)
            $mentors = $user->mentors()->get();
            foreach ($mentors as $mentor) {
                if ($mentor) {
                    $mentor->notify(new GeneralNotification(
                        'Logbook Diajukan',
                        "Intern {$user->nama} telah mengajukan logbook tanggal " . Carbon::parse($logbooks->tanggal)->format('d-m-Y') . " untuk diverifikasi.",
                        "/mentor/logbook",
                        "info",
                        "mentor"
                    ));
                }
            }
        }

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => $logbooks->load('tag')
        ]);
    }

    /**
     * Delete logbooks (hanya jika status draft atau pending)
     */
    public function destroy($id)
    {
        $user = request()->user();
        $logbooks = Logbook::where('id_logbooks', $id)
            ->where('user_id', $user->user_id)
            ->first();

        if (!$logbooks) {
            return response()->json([
                'success' => false,
                'message' => 'Logbook tidak ditemukan'
            ], 404);
        }

        // Hanya bisa delete jika status draft / rejected / revision_needed
        // PENDING dan VERIFIED tidak bisa di-hapus (locked)
        if (!in_array($logbooks->status_verifikasi, ['draft', 'rejected', 'revision_needed'])) {
            return response()->json([
                'success' => false,
                'message' => 'Logbook dengan status ' . $logbooks->status_verifikasi . ' tidak dapat dihapus'
            ], 400);
        }

        // Delete files if exist
        $files = $logbooks->bukti_kegiatan; // Accessor returns array
        if ($files && is_array($files)) {
            foreach ($files as $file) {
                 $path = str_replace('storage/', '', $file);
                 \Illuminate\Support\Facades\Storage::disk('public')->delete($path);
            }
        }

        $logbooks->delete();

        return response()->json([
            'success' => true,
            'message' => 'Logbook berhasil dihapus'
        ]);
    }

    // ==================== MENTOR FEATURES ====================

    /**
     * List semua logbooks intern bimbingan (Mentor)
     * Mentor hanya bisa melihat logbooks dari intern bimbingannya
     */
    public function listForMentor(Request $request)
    {
        $user = $request->user();

        // Get intern IDs yang dibimbing mentor ini
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

        $query = Logbook::with(['user', 'tag'])
            ->whereIn('user_id', $internIds)
            ->orderBy('tanggal', 'desc');

        // Filter by status verifikasi (supports CSV or array, friendly labels)
        if ($request->has('status_verifikasi')) {
            $parsed = $this->normalizeStatusFilters($request->status_verifikasi);
            $statusesForQuery = $parsed['statuses'];
            $includeNotYet = $parsed['include_not_yet'] ?? false;

            if ($includeNotYet) {
                if (!$request->has('user_id')) {
                    return response()->json(['success' => false, 'message' => 'Parameter user_id required when filtering by Not Yet'], 400);
                }
                $wanted = intval($request->user_id);
                if (!in_array($wanted, $internIds)) {
                    return response()->json(['success' => false, 'message' => 'You do not have access to this intern'], 403);
                }

                $daily = $this->buildDailySummary($request, $wanted);
                return response()->json(['success' => true, 'data' => $daily]);
            }

            if (!empty($statusesForQuery)) {
                $query->whereIn('status_verifikasi', $statusesForQuery);
            }
        }

        // Search text in deskripsi or intern name
        if ($request->filled('q')) {
            $q = $request->search;
            $query->where(function ($qq) use ($q) {
                $qq->where('deskripsi_kegiatan', 'like', "%{$q}%")
                   ->orWhereHas('user', function ($u) use ($q) {
                       $u->where('nama', 'like', "%{$q}%");
                   });
            });
        }

        // Filter by user_id (intern tertentu) — prefer profile FK (id_mahasiswa) when available
        if ($request->has('user_id')) {
            $mahasiswa = \App\Models\TblMahasiswa::where('user_id', $request->user_id)->first();
            if ($mahasiswa) {
                $query->where('id_mahasiswa', $mahasiswa->id_mahasiswa);
            } elseif (\App\Models\TblMahasiswa::where('id_mahasiswa', $request->user_id)->exists()) {
                // allow passing id_mahasiswa directly
                $query->where('id_mahasiswa', $request->user_id);
            } else {
                $query->where('user_id', $request->user_id);
            }
        }

        // Filter by date range (accept mm/dd/yyyy or ISO); ignore empty inputs
            if ($request->filled('start_date') && $request->filled('end_date')) {
                $start = $this->parseDateParam($request->start_date);
                $end = $this->parseDateParam($request->end_date);
                if ($start && $end) {
                    $query->whereBetween('tanggal', [$start, $end]);
                }
            }

        $logbooks = $query->paginate($request->per_page ?? 10);

        return response()->json([
            'success' => true,
            'data' => $logbooks
        ]);
    }

    /**
     * List logbooks by intern id (Admin or Mentor)
     * Mentor can only view logbooks for their interns; admin can view all
     */
    public function listByIntern(Request $request, $userId)
    {
        $user = $request->user();

        $target = User::find($userId);
        if (!$target || !$target->isIntern()) {
            return response()->json(['success' => false, 'message' => 'Intern tidak ditemukan'], 404);
        }

        $activeRole = $request->query('active_role');
        $isMentorContext = ($activeRole === 'mentor') || ($request->segment(2) === 'mentor' && $user->isMentor());

        // Authorization: admins can view all; mentors only their interns
        if (!$user->isAdmin() || $isMentorContext) {
            if (!$user->isMentor()) {
                return response()->json(['success' => false, 'message' => 'Akses ditolak'], 403);
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
            if (!in_array(intval($userId), $internIds)) {
                return response()->json(['success' => false, 'message' => 'Anda tidak berhak melihat logbooks intern ini'], 403);
            }
        }

        $mahasiswaId = $target->mahasiswa?->id_mahasiswa ?? null;
        $query = Logbook::with(['user', 'tag']);
        if ($mahasiswaId) {
            $query->where('id_mahasiswa', $mahasiswaId);
        } else {
            $query->where('user_id', $userId);
        }
        $query->orderBy('tanggal', 'desc');

        // Filter by status (supports CSV or array, friendly labels)
        if ($request->has('status_verifikasi')) {
            $parsed = $this->normalizeStatusFilters($request->status_verifikasi);
            $statuses = $parsed['statuses'] ?? [];
            if (!empty($statuses)) {
                $query->whereIn('status_verifikasi', $statuses);
            }
        }

        // Search text in description
        if ($request->filled('search')) {
            $q = $request->search;
            $query->where('deskripsi_kegiatan', 'like', "%{$q}%");
        }

        if ($request->filled('start_date') && $request->filled('end_date')) {
            $start = $this->parseDateParam($request->start_date);
            $end = $this->parseDateParam($request->end_date);
            if ($start && $end) {
                $query->whereBetween('tanggal', [$start, $end]);
            }
        }

        if ($request->has('bulan') && $request->has('tahun')) {
            $query->whereMonth('tanggal', $request->bulan)
                  ->whereYear('tanggal', $request->tahun);
        }

        $logbooks = $query->paginate($request->per_page ?? 10);

        return response()->json([
            'success' => true,
            'data' => $logbooks
        ]);
    }

    /**
     * Verifikasi logbooks (Mentor)
     * Mentor bisa memberikan status "verified" atau "revision_needed" dengan feedback
     */
    public function verify(Request $request, $id)
    {
        // Validate request
        $request->validate([
            'status_verifikasi' => 'required|in:verified,revision_needed',
            'feedback' => 'nullable|string|max:500'
        ]);

        $user = $request->user();
        $logbooks = Logbook::with('user')->find($id);

        if (!$logbooks) {
            return response()->json([
                'success' => false,
                'message' => 'Logbook tidak ditemukan'
            ], 404);
        }

        // Cek apakah intern adalah bimbingan mentor ini (gunakan profile ID)
        $mahasiswa = $logbooks->mahasiswa;
        $karyawanId = $user->karyawan?->id_karyawan;
        
        $isBimbingan = false;
        if ($karyawanId && $mahasiswa) {
            $isBimbingan = \DB::table('intern_mentors')
                ->where('mentor_id', $karyawanId)
                ->where('intern_id', $mahasiswa->id_mahasiswa)
                ->where('is_active', true)
                ->exists();
        }

        $activeRole = $request->query('active_role');
        $isMentorContext = ($activeRole === 'mentor') || ($request->segment(2) === 'mentor' && $user->isMentor());

        // Admin bisa verifikasi semua
        if (!$user->isAdmin() || $isMentorContext) {
            if (!$isBimbingan) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak berhak memverifikasi logbooks ini'
                ], 403);
            }
        }
        

        $updateData = [
            'status_verifikasi' => $request->status_verifikasi,
            'verified_by' => $user->user_id,
            'feedback' => $request->feedback,
            'verified_at' => Carbon::now(),
        ];

        // Jika status revision_needed, set revision_at dan revision_by
        if ($request->status_verifikasi === 'revision_needed') {
            $updateData['revision_at'] = Carbon::now();
            $updateData['revision_by'] = $user->user_id;
        }

        $logbooks->update($updateData);

        // Notifikasi ke Intern
        $intern = User::find($logbooks->user_id);
        if ($intern) {
            if ($request->status_verifikasi === 'verified') {
                $intern->notify(new GeneralNotification(
                    'Logbook Diverifikasi',
                    "Logbook Anda tanggal " . Carbon::parse($logbooks->tanggal)->format('d-m-Y') . " telah diverifikasi oleh Mentor.",
                    "/intern/logbook",
                    "success",
                    "intern"
                ));
            } elseif ($request->status_verifikasi === 'revision_needed') {
                $intern->notify(new GeneralNotification(
                    'Revisi Logbook Diperlukan',
                    "Mentor meminta revisi pada logbook Anda tanggal " . Carbon::parse($logbooks->tanggal)->format('d-m-Y') . ". Silakan cek catatan feedback.",
                    "/intern/logbook",
                    "warning",
                    "intern"
                ));
            }
        }

        $statusMessage = $request->status_verifikasi === 'verified' 
            ? 'Logbook berhasil diverifikasi' 
            : 'Logbook perlu revisi';

        return response()->json([
            'success' => true,
            'message' => $statusMessage,
            'data' => $logbooks->fresh(['user', 'verifier'])
        ]);
    }

    // ==================== MENTOR FEATURES ====================

    /**
     * Progress summary per intern (Mentor)
     * - Query params: start_date, end_date (preferred), month & year (alternative)
     * - Optional: user_id to focus on a single intern
     * Returns per-intern metrics: total_entries, verified, pending, revision_needed, last_submission,
     * expected_workdays, percent_submitted
     */
    public function progressForMentor(Request $request)
    {
        $user = $request->user();

        // Determine period
        if ($request->filled('start_date') && $request->filled('end_date')) {
            $start = Carbon::parse($request->start_date)->startOfDay();
            $end = Carbon::parse($request->end_date)->endOfDay();
        } elseif ($request->filled('month') && $request->filled('year')) {
            $start = Carbon::create(intval($request->year), intval($request->month), 1)->startOfMonth();
            $end = Carbon::create(intval($request->year), intval($request->month), 1)->endOfMonth();
        } else {
            // default: last 30 days
            $end = Carbon::now()->endOfDay();
            $start = Carbon::now()->subDays(30)->startOfDay();
        }

        $activeRole = $request->query('active_role');
        $isMentorContext = ($activeRole === 'mentor') || ($request->segment(2) === 'mentor' && $user->isMentor());

        // Mentor scope (admins can view all)
        if ($user->isAdmin() && !$isMentorContext) {
            $internIds = $request->filled('user_id') ? [$request->user_id] : \App\Models\User::whereHas('roles', fn($q) => $q->where('name', 'intern'))->pluck('user_id')->toArray();
        } else {
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
            if ($request->filled('user_id')) {
                $wanted = intval($request->user_id);
                $internIds = in_array($wanted, $internIds) ? [$wanted] : [];
            }
        }

        if (empty($internIds)) {
            return response()->json(['success' => true, 'data' => []]);
        }

        // Aggregate logbooks counts per intern in the period
        $rows = \DB::table('logbooks')
            ->select('user_id', \DB::raw('COUNT(*) as total'),
                \DB::raw("SUM(CASE WHEN status_verifikasi = 'verified' THEN 1 ELSE 0 END) as verified"),
                \DB::raw("SUM(CASE WHEN status_verifikasi = 'pending' THEN 1 ELSE 0 END) as pending"),
                \DB::raw("SUM(CASE WHEN status_verifikasi = 'revision_needed' THEN 1 ELSE 0 END) as revision_needed"),
                \DB::raw('MAX(tanggal) as last_submission')
            )
            ->whereIn('user_id', $internIds)
            ->whereBetween('tanggal', [$start->toDateString(), $end->toDateString()])
            ->groupBy('user_id')
            ->get()
            ->keyBy('user_id');

        // Preload intern user data with mahasiswa periods (don't assume period columns on users table)
        $users = \App\Models\User::whereIn('user_id', $internIds)
            ->with('mahasiswa:user_id,mulai_magang,akhir_magang')
            ->get(['user_id', 'nama'])
            ->keyBy('user_id');

        // Get libur dates (to exclude)
        $liburDates = \App\Models\Libur::pluck('tanggal')->toArray();

        $result = [];
        foreach ($internIds as $uid) {
            $userObj = $users->get($uid);
            $agg = $rows->has($uid) ? $rows->get($uid) : (object)['total' => 0, 'verified' => 0, 'pending' => 0, 'revision_needed' => 0, 'last_submission' => null];

            // Expected workdays = number of weekdays (Mon-Fri) in intersection of [start,end] and intern's magang period, excluding libur
            $periodStart = $start->copy();
            $periodEnd = $end->copy();
            if ($userObj && $userObj->mulai_magang) {
                $mm = Carbon::parse($userObj->mulai_magang)->startOfDay();
                if ($mm->gt($periodStart)) $periodStart = $mm;
            }
            if ($userObj && $userObj->akhir_magang) {
                $am = Carbon::parse($userObj->akhir_magang)->endOfDay();
                if ($am->lt($periodEnd)) $periodEnd = $am;
            }

            $expected = 0;
            if ($periodStart->lte($periodEnd)) {
                for ($d = $periodStart->copy(); $d->lte($periodEnd); $d->addDay()) {
                    $ds = $d->toDateString();
                    if ($d->isWeekend() || in_array($ds, $liburDates)) continue;
                    $expected++;
                }
            }

            $percent = $expected > 0 ? round(($agg->total / $expected) * 100, 1) : null;

            $result[] = [
                'user_id' => $uid,
                'id_mahasiswa' => $userObj?->mahasiswa?->id_mahasiswa ?? null,
                'nama' => $userObj ? $userObj->nama : null,
                'total_entries' => intval($agg->total),
                'verified' => intval($agg->verified),
                'pending' => intval($agg->pending),
                'revision_needed' => intval($agg->revision_needed),
                'last_submission' => $agg->last_submission,
                'expected_workdays' => $expected,
                'percent_submitted' => $percent,
            ];
        }

        // Optional sorting (e.g., by percent ascending to find low coverage)
        if ($request->filled('sort_by') && $request->sort_by === 'percent_asc') {
            usort($result, fn($a,$b)=>($a['percent_submitted'] ?? 0) <=> ($b['percent_submitted'] ?? 0));
        }

        return response()->json(['success' => true, 'data' => $result]);
    }

    // ==================== ADMIN FEATURES ====================

    /**
     * List semua logbooks (Admin)
     */
    public function listAll(Request $request)
    {
        $query = Logbook::with(['user', 'verifier'])
            ->orderBy('tanggal', 'desc');

        // Filter by status (supports CSV or array)
        if ($request->has('status_verifikasi')) {
            $statuses = is_array($request->status_verifikasi) ? $request->status_verifikasi : explode(',', $request->status_verifikasi);
            $query->whereIn('status_verifikasi', $statuses);
        }

        // Search text in description or intern name
        if ($request->filled('search')) {
            $q = $request->search;
            $query->where(function ($qq) use ($q) {
                $qq->where('deskripsi_kegiatan', 'like', "%{$q}%")
                   ->orWhereHas('user', function ($u) use ($q) {
                       $u->where('nama', 'like', "%{$q}%");
                   });
            });
        }

        // Filter by user_id — prefer profile FK (id_mahasiswa) when available
        if ($request->has('user_id')) {
            $mahasiswa = \App\Models\TblMahasiswa::where('user_id', $request->user_id)->first();
            if ($mahasiswa) {
                $query->where('id_mahasiswa', $mahasiswa->id_mahasiswa);
            } elseif (\App\Models\TblMahasiswa::where('id_mahasiswa', $request->user_id)->exists()) {
                $query->where('id_mahasiswa', $request->user_id);
            } else {
                $query->where('user_id', $request->user_id);
            }
        }


        // Filter by site
        if ($request->has('id_site')) {
            $query->whereHas('user', function ($q) use ($request) {
                $q->where('id_site', $request->id_site);
            });
        }

        // Filter by date range
        if ($request->has('start_date') && $request->has('end_date')) {
            $query->whereBetween('tanggal', [$request->start_date, $request->end_date]);
        }

        $logbooks = $query->paginate($request->per_page ?? 20);

        // Transform collection to include division and mentor
        $logbooks->getCollection()->transform(function ($item) {
            $intern = $item->user;
            // Get active mentor
            $mentor = $intern ? $intern->mentors()->first() : null;
            
            // Add custom fields
            $item->division = $intern ? ($intern->division ?? $intern->divisi) : null;
            $item->nama_mentor = $mentor ? $mentor->nama : null;
            
            return $item;
        });

        return response()->json([
            'success' => true,
            'data' => $logbooks
        ]);
    }

    // ==================== FILE HANDLING ====================

    /**
     * Get/Download logbooks file
     * URL: /api/logbooks/{id}/file/{filename}
     * Query: ?download=1 (force download)
     */
    public function getFile(Request $request, $id, $filename)
    {
        $logbooks = Logbook::find($id);

        if (!$logbooks) {
            return response()->json(['message' => 'Logbook tidak ditemukan'], 404);
        }

        $user = $request->user();

        // Authorization Logic
        // 1. Owner
        // 2. Admin
        // 3. Mentor of the owner (active or inactive)
        $isOwner = ($logbooks->user_id === $user->user_id) || (
            $user->mahasiswa?->id_mahasiswa && $logbooks->id_mahasiswa && $user->mahasiswa->id_mahasiswa === $logbooks->id_mahasiswa
        );
        $isAdmin = $user->isAdmin();
        // Check mentor mapping via both legacy and profile-based columns.
        $isMentor = false;
        if ($user->isMentor()) {
            $isMentor = $this->isMentorOfIntern($user, (int) $logbooks->user_id);
        }

        if (!$isOwner && !$isAdmin && !$isMentor) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        // Validate filename exists in this logbooks
        // $logbooks->bukti_kegiatan is Array (Accessor)
        $files = $logbooks->bukti_kegiatan;
        $isValidFile = false;
        $targetPath = '';

        if (is_array($files)) {
            foreach ($files as $path) {
                // path in db: "storage/logbooks/filename.pdf"
                // we check if the requested filename matches the basename
                if (basename($path) === $filename) {
                    $isValidFile = true;
                    $targetPath = $path; // "storage/logbooks/..."
                    break;
                }
            }
        }

        if (!$isValidFile) {
            return response()->json(['message' => 'File tidak ditemukan di logbooks ini'], 404);
        }

        // Serve File
        // Remove 'storage/' prefix because Storage::disk('public') starts inside storage/app/public
        $relativePath = str_replace('storage/', '', $targetPath);

        if (!\Illuminate\Support\Facades\Storage::disk('public')->exists($relativePath)) {
            return response()->json(['message' => 'File fisik tidak ditemukan'], 404);
        }

        if ($request->query('download')) {
            return \Illuminate\Support\Facades\Storage::disk('public')->download($relativePath);
        }

        $file = \Illuminate\Support\Facades\Storage::disk('public')->get($relativePath);
        $mimeType = \Illuminate\Support\Facades\Storage::disk('public')->mimeType($relativePath);
        return response($file)->header('Content-Type', $mimeType);
    }

    /**
     * Check whether mentor can access an intern's logbook attachment.
     * Supports both new mapping columns (mentor_id/intern_id) and legacy user-id mapping.
     */
    private function isMentorOfIntern(User $mentor, int $internUserId): bool
    {
        if (! $mentor->isMentor()) {
            return false;
        }

        $mentorKaryawanId = $mentor->karyawan?->id_karyawan;
        $internMahasiswaId = \App\Models\TblMahasiswa::where('user_id', $internUserId)->value('id_mahasiswa');

        $query = \DB::table('intern_mentors')->where('is_active', true);

        $query->where(function ($q) use ($mentor, $mentorKaryawanId) {
            $q->where('mentor_user_id', $mentor->user_id);
            if ($mentorKaryawanId) {
                $q->orWhere('mentor_id', $mentorKaryawanId);
            }
        });

        $query->where(function ($q) use ($internUserId, $internMahasiswaId) {
            $q->where('intern_user_id', $internUserId);
            if ($internMahasiswaId) {
                $q->orWhere('intern_id', $internMahasiswaId);
            }
        });

        return $query->exists();
    }
}
