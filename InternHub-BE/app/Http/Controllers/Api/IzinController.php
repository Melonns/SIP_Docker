<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Izin;
use App\Models\KoreksiAbsensi;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Carbon\Carbon;
use App\Notifications\GeneralNotification;
use App\Models\User;

class IzinController extends Controller
{
    /**
     * Download lampiran leave_requests secara aman (hanya user terkait atau admin/mentor)
     */

    public function downloadLampiran(Request $request, $id, $index = 0)
    {
        // AMBIL USER DARI SINI
        $user = $request->user();

        // Cari Izin berdasarkan ID dari URL
        $leave_requests = Izin::findOrFail($id);

        // 2. Validasi Akses (Authorization)
        $isOwner = $leave_requests->user_id == $user->user_id;
        $isAdmin = $user->hasRole('admin');
        $isMentorOf = false;

        if (!$isOwner && !$isAdmin) {
            // Cek relasi mentor-intern dengan dukungan skema baru (mentor_id/intern_id)
            // dan legacy (mentor_user_id/intern_user_id).
            $isMentorOf = $this->isMentorOfIntern($user, (int) $leave_requests->user_id);

            if (!$isMentorOf) {
                return response()->json(['success' => false, 'message' => 'Akses ditolak.'], 403);
            }
        }

        // 3. Ambil Path File
        $lampiranPaths = json_decode($leave_requests->lampiran, true);
        $lampiranPaths = is_array($lampiranPaths) ? $lampiranPaths : [$lampiranPaths];


        if (!is_array($lampiranPaths)) {
            $lampiranPaths = $leave_requests->lampiran ? [$leave_requests->lampiran] : [];
        }

        if (!isset($lampiranPaths[$index])) {
            return response()->json([
                'success' => false,
                'message' => 'Index file tidak valid. Tersedia: ' . count($lampiranPaths) . ' file.'
            ], 404);
        }

        $filePath = $lampiranPaths[$index];
        $disk = Storage::disk('public');

        if (str_starts_with($filePath, "encrypted/")) {
            if (!Storage::disk("local")->exists($filePath)) return response()->json(["message" => "File fisik tidak ditemukan"], 404);
            $encryptedContents = Storage::disk("local")->get($filePath);
            $decryptedContents = \Illuminate\Support\Facades\Crypt::decryptString($encryptedContents);
            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->buffer($decryptedContents) ?: "application/octet-stream";
            
            $downloadName = basename($filePath);
            if (str_ends_with($downloadName, '.enc')) {
                $downloadName = str_replace('.enc', '', $downloadName);
                if (strpos($downloadName, '---') !== false) {
                    $parts = explode('---', $downloadName);
                    $downloadName = end($parts);
                } else {
                    $downloadName = preg_replace('/^leave_requests_\d+_\d+_[a-z0-9]+_/', '', $downloadName);
                }
            }
            
            return response($decryptedContents, 200)->header("Content-Type", $mime)->header("Content-Disposition", "attachment; filename=\"" . $downloadName . "\"");
        }

        if (!$disk->exists($filePath)) {
            return response()->json(['success' => false, 'message' => 'File fisik tidak ditemukan.'], 404);
        }

        // 4. Download dengan Stream
        $fullPath = $disk->path($filePath);

        return response()->download($fullPath, basename($filePath), [
            'Content-Type' => $disk->mimeType($filePath),
        ]);
    }
    public function downloadLampiranKoreksi(Request $request, $id, $index = 0)
    {
        // AMBIL USER DARI SINI
        $user = $request->user();

        // Cari Izin berdasarkan ID dari URL
        $koreksi = KoreksiAbsensi::findOrFail($id);

        // 2. Validasi Akses (Authorization)
        $isOwner = $koreksi->user_id == $user->user_id;
        $isAdmin = $user->hasRole('admin');
        $isMentorOf = false;

        if (!$isOwner && !$isAdmin) {
            // Cek relasi mentor-intern dengan dukungan skema baru (mentor_id/intern_id)
            // dan legacy (mentor_user_id/intern_user_id).
            $isMentorOf = $this->isMentorOfIntern($user, (int) $koreksi->user_id);

            if (!$isMentorOf) {
                return response()->json(['success' => false, 'message' => 'Akses ditolak.'], 403);
            }
        }

        // 3. Ambil Path File
        $lampiranPaths = json_decode($koreksi->lampiran, true);
        $lampiranPaths = is_array($lampiranPaths) ? $lampiranPaths : [$lampiranPaths];


        if (!is_array($lampiranPaths)) {
            $lampiranPaths = $koreksi->lampiran ? [$koreksi->lampiran] : [];
        }

        if (!isset($lampiranPaths[$index])) {
            return response()->json([
                'success' => false,
                'message' => 'Index file tidak valid. Tersedia: ' . count($lampiranPaths) . ' file.'
            ], 404);
        }

        $filePath = $lampiranPaths[$index];
        $disk = Storage::disk('public');

        if (str_starts_with($filePath, "encrypted/")) {
            if (!Storage::disk("local")->exists($filePath)) return response()->json(["message" => "File fisik tidak ditemukan"], 404);
            $encryptedContents = Storage::disk("local")->get($filePath);
            $decryptedContents = \Illuminate\Support\Facades\Crypt::decryptString($encryptedContents);
            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->buffer($decryptedContents) ?: "application/octet-stream";
            
            $downloadName = basename($filePath);
            if (str_ends_with($downloadName, '.enc')) {
                $downloadName = str_replace('.enc', '', $downloadName);
                if (strpos($downloadName, '---') !== false) {
                    $parts = explode('---', $downloadName);
                    $downloadName = end($parts);
                } else {
                    $downloadName = preg_replace('/^koreksi_lampiran_\d+_\d+_[a-z0-9]+_/', '', $downloadName);
                }
            }
            
            return response($decryptedContents, 200)->header("Content-Type", $mime)->header("Content-Disposition", "attachment; filename=\"" . $downloadName . "\"");
        }

        if (!$disk->exists($filePath)) {
            return response()->json(['success' => false, 'message' => 'File fisik tidak ditemukan.'], 404);
        }

        // 4. Download dengan Stream
        $fullPath = $disk->path($filePath);

        return response()->download($fullPath, basename($filePath), [
            'Content-Type' => $disk->mimeType($filePath),
        ]);
    }

    // ==================== IZIN (Sakit/Izin) ====================

    /**
     * List leave_requests untuk user yang login
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Izin::query();
        $query->forUser($user);

        // Filter by status (support array or CSV)
        if ($request->filled('status')) {
            $status = $request->input('status');
            if (!is_array($status)) {
                $status = array_filter(array_map('trim', explode(',', strtolower($status))));
            }
            
            $query->where(function($q) use ($status) {
                if (in_array('approved', $status)) {
                    $q->orWhere(function($subq) {
                        $subq->where('status_mentor', 'approved')
                             ->where('status_admin', 'approved');
                    });
                }
                
                if (in_array('rejected', $status)) {
                    $q->orWhere('status_mentor', 'rejected')
                      ->orWhere('status_admin', 'rejected');
                }
                
                if (in_array('need_approval', $status)) {
                    $q->orWhere('status_mentor', 'pending');
                }
                
                if (in_array('waiting_admin', $status)) {
                    $q->orWhere(function($subq) {
                        $subq->where('status_mentor', 'approved')
                             ->where('status_admin', 'pending');
                    });
                }
            });
        }

        // Filter by type (support array)
        if ($request->filled('type')) {
            $type = $request->input('type');
            if (is_array($type)) {
                $query->whereIn('jenis_izin', $type);
            } else {
                $query->where('jenis_izin', $type);
            }
        }

        // Filter by date range
        if ($request->filled('tanggal_mulai')) {
            $query->whereDate('tanggal_mulai', '>=', $request->tanggal_mulai);
        }
        if ($request->filled('tanggal_selesai')) {
            $query->whereDate('tanggal_selesai', '<=', $request->tanggal_selesai);
        }

        // Search by keterangan
        if ($request->filled('q')) {
            $q = $request->q;
            $query->where(function($sub) use ($q) {
                $sub->where('keterangan', 'like', "%$q%")
                    ->orWhere('jenis_izin', 'like', "%$q%")
                    ->orWhere('status', 'like', "%$q%")
                    ->orWhere('tanggal_mulai', 'like', "%$q%")
                    ->orWhere('tanggal_selesai', 'like', "%$q%")
                ;
            });
        }

        $leave_requests = $query->select([
                'id_izin', 'user_id', 'jenis_izin', 'tanggal_mulai', 'tanggal_selesai', 'keterangan', 'lampiran',
                'status', 'approved_by', 'catatan_approval', 'approved_at',
                'status_mentor', 'status_admin', 'catatan_mentor', 'catatan_admin',
                'approved_by_mentor', 'approved_by_admin', 'approved_at_mentor', 'approved_at_admin', 'created_at', 'updated_at'
            ])
            ->orderBy('tanggal_mulai', 'desc')
            ->orderBy('created_at', 'desc')
            ->paginate($request->per_page ?? $request->input('limit') ?? 10);

        return response()->json([
            'success' => true,
            'data' => $leave_requests
        ]);
    }


    /**
     * Submit pengajuan leave_requests (Sakit/Izin) dengan date range
     */
    public function store(Request $request)
    {
        // Validasi lampiran bisa file tunggal atau array
        $rules = [
            'type' => 'required|in:sakit,izin',
            'tanggal_mulai' => 'required|date',
            'tanggal_selesai' => 'required|date|after_or_equal:tanggal_mulai',
            'keterangan' => 'required|string|max:1000',
        ];
        if ($request->hasFile('lampiran')) {
            if (is_array($request->file('lampiran'))) {
                $rules['lampiran'] = 'nullable|array';
                $rules['lampiran.*'] = 'file|mimes:pdf,jpeg,jpg,png|max:5120';
            } else {
                $rules['lampiran'] = 'nullable|file|mimes:pdf,jpeg,jpg,png|max:5120';
            }
        } else {
            $rules['lampiran'] = 'nullable';
        }
        $request->validate($rules);


        $user = $request->user();

        // Upload semua lampiran jika ada, optimized dan terenkripsi
        $lampiranPaths = [];
        if ($request->hasFile('lampiran')) {
            $lampiranFiles = is_array($request->file('lampiran'))
                ? $request->file('lampiran')
                : [$request->file('lampiran')];
            $now = microtime(true);
            try {
                foreach ($lampiranFiles as $file) {
                    $originalName = preg_replace('/[^A-Za-z0-9.\-_]/', '_', $file->getClientOriginalName());
                    $uniqueFolder = $user->user_id . '_' . str_replace('.', '', $now) . '_' . uniqid();
                    $fileName = $uniqueFolder . '/' . $originalName;
                    $fileContents = file_get_contents($file->getRealPath());
                    $encryptedContents = \Illuminate\Support\Facades\Crypt::encryptString($fileContents);
                    Storage::disk("local")->put("encrypted/leave_requests/" . $fileName, $encryptedContents);
                    $lampiranPaths[] = "encrypted/leave_requests/" . $fileName;
                }
            } catch (\Exception $e) {
                return response()->json(['success' => false, 'message' => 'Error encrypting lampiran: ' . $e->getMessage()], 500);
            }
        }

        // Prevent overlapping leave requests for the same user (ignore previously rejected requests)
        $start = $request->tanggal_mulai;
        $end = $request->tanggal_selesai;

        $overlapExists = Izin::forUser($user)
            ->where(function($q) use ($start, $end) {
                $q->whereBetween('tanggal_mulai', [$start, $end])
                  ->orWhereBetween('tanggal_selesai', [$start, $end])
                  ->orWhere(function($qq) use ($start, $end) {
                      $qq->where('tanggal_mulai', '<=', $start)
                         ->where('tanggal_selesai', '>=', $end);
                  });
            })
            ->where(function($q) {
                // Consider existing requests that are not explicitly rejected
                $q->whereNull('status')->orWhere('status', '!=', 'rejected');
            })
            ->exists();

        if ($overlapExists) {
            return response()->json([
                'success' => false,
                'message' => 'Sudah ada pengajuan izin/sakit yang tumpang tindih pada rentang tanggal tersebut.'
            ], 400);
        }

        // Reject if there are existing attendance records for any date in the requested range
        $mahasiswaId = $user->mahasiswa?->id_mahasiswa ?? null;
        $attendanceQuery = \App\Models\TblAbsensi::query();
        if ($mahasiswaId) {
            $attendanceQuery->where('id_mahasiswa', $mahasiswaId);
        } else {
            $attendanceQuery->where('user_id', $user->user_id);
        }
        $attendanceDates = $attendanceQuery
            ->whereBetween('tanggal', [$start, $end])
            ->pluck('tanggal')
            ->unique()
            ->map(function($d) { return \Carbon\Carbon::parse($d)->toDateString(); })
            ->toArray();

        if (!empty($attendanceDates)) {
            return response()->json([
                'success' => false,
                'message' => 'Tidak dapat mengajukan izin/sakit pada tanggal yang sudah ada absensi: ' . implode(', ', $attendanceDates)
            ], 400);
        }

        $leave_requests = Izin::create([
            'user_id' => $user->user_id,
            'id_mahasiswa' => $user->mahasiswa?->id_mahasiswa ?? null,
            'jenis_izin' => $request->type,
            'tanggal_mulai' => $request->tanggal_mulai,
            'tanggal_selesai' => $request->tanggal_selesai,
            'keterangan' => $request->keterangan,
            'lampiran' => $lampiranPaths ? json_encode($lampiranPaths) : null,
        ]);

        // Kirim Notifikasi ke semua Mentor yang membimbing intern ini
        $mentors = $user->mentors()->get();
        foreach ($mentors as $mentor) {
            if ($mentor) {
                $mentor->notify(new GeneralNotification(
                    'Pengajuan Izin/Sakit Baru',
                    "Intern {$user->nama} mengajukan {$request->type} pada tanggal " . Carbon::parse($request->tanggal_mulai)->format('d-m-Y') . " s/d " . Carbon::parse($request->tanggal_selesai)->format('d-m-Y') . ".",
                    "/mentor/izin",
                    "info",
                    "mentor"
                ));
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Pengajuan leave_requests berhasil dikirim',
            'data' => $leave_requests
        ], 201);
    }

    /**
     * Detail leave_requests
     */
    public function show($id)
    {
        $leave_requests = Izin::with(['user', 'approver'])->find($id);

        if (!$leave_requests) {
            return response()->json([
                'success' => false,
                'message' => 'Data leave_requests tidak ditemukan'
            ], 404);
        }

        // Lampiran info siap pakai
        $lampiranInfo = [];
        if ($leave_requests->lampiran) {
            $lampiranPaths = json_decode($leave_requests->lampiran, true);
            $lampiranPaths = is_array($lampiranPaths) ? $lampiranPaths : [$lampiranPaths];
            foreach ($lampiranPaths as $path) {
                $fileName = basename($path);
                if (str_ends_with($fileName, '.enc')) {
                    $displayName = str_replace('.enc', '', $fileName);
                    if (strpos($displayName, '---') !== false) {
                        $parts = explode('---', $displayName);
                        $displayName = end($parts);
                    } else {
                        $displayName = preg_replace('/^leave_requests_\d+_\d+_[a-z0-9]+_/', '', $displayName);
                    }
                    $fileName = $displayName;
                }
                $url = url('storage/' . $path);
                $mime = \Storage::disk('public')->exists($path) ? \Storage::disk('public')->mimeType($path) : null;
                $lampiranInfo[] = [
                    'name' => $fileName,
                    'url' => $url,
                    'type' => $mime,
                    'path' => $path
                ];
            }
        }

        $leave_requestsArr = $leave_requests->toArray();
        $leave_requestsArr['lampiran'] = $lampiranInfo;

        return response()->json([
            'success' => true,
            'data' => $leave_requestsArr
        ]);
    }

    /**
     * List semua leave_requests (Admin/Mentor)
     * Mentor hanya bisa melihat intern bimbingannya
     */
    public function listAll(Request $request)
    {
        $user = $request->user();

        $query = Izin::query();

        // Jika diakses melalui endpoint mentor, batasi hanya ke intern bimbingannya
        // Admin (juga mentor) accessing /api/mentor/* should only see their interns.
        $activeRole = $request->query('active_role');
        $isMentorContext = ($activeRole === 'mentor') || ($request->segment(2) === 'mentor' && $user->isMentor());

        if ($isMentorContext) {
            // collect user IDs for interns the mentor is responsible for
            // primary source: belongsToMany via `intern_user_id` pivot column
            $direct = $user->interns()->pluck('users.user_id')->toArray();

            // legacy rows may only populate intern_mentors.intern_id (mahasiswa PK)
            // join against students to resolve to user_id if available
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
                return response()->json(['success' => true, 'data' => []]);
            }
            $query->whereIn('user_id', $internIds);
        }

        // Filter by status (support array or CSV)
        if ($request->filled('status')) {
            $status = $request->input('status');
            if (!is_array($status)) {
                $status = array_filter(array_map('trim', explode(',', strtolower($status))));
            }
            
            $query->where(function($q) use ($status, $request) {
                // Normalize status values: converts spaces to underscores for robustness (e.g., 'need approval' -> 'need_approval')
                $statusNormalized = array_map(function($s) {
                    return str_replace(' ', '_', $s);
                }, $status);

                if (in_array('approved', $statusNormalized)) {
                    $q->orWhere(function($subq) {
                        $subq->where('status_mentor', 'approved')
                             ->where('status_admin', 'approved');
                    });
                }
                
                if (in_array('rejected', $statusNormalized)) {
                    $q->orWhere('status_mentor', 'rejected')
                      ->orWhere('status_admin', 'rejected');
                }
                
                if (in_array('need_approval', $statusNormalized)) {
                    // Logic differs slightly based on who is asking
                    // Note: If request comes from /api/mentor/* or user is specifically a mentor without admin rights in this context
                    if ($request->segment(2) === 'mentor') {
                        $q->orWhere('status_mentor', 'pending');
                    } else {
                        // For Admin / Generic list: items needing action
                        $q->orWhere(function($subq) {
                            // Needs Mentor approval OR Needs Admin approval (already mentor approved)
                            $subq->where('status_mentor', 'pending')
                                 ->orWhere(function($adminQ) {
                                     $adminQ->where('status_mentor', 'approved')
                                            ->where('status_admin', 'pending');
                                 });
                        });
                    }
                }
                
                if (in_array('waiting_admin', $statusNormalized)) {
                    $q->orWhere(function($subq) {
                        $subq->where('status_mentor', 'approved')
                             ->where('status_admin', 'pending');
                    });
                }
            });
        }

        // Filter by jenis (support array or CSV)
        if ($request->filled('type')) {
            $type = $request->input('type');
            if (!is_array($type)) {
                $type = array_filter(array_map('trim', explode(',', $type)));
            }
            $query->whereIn('jenis_izin', $type);
        }

        // Filter by date range
        if ($request->filled('tanggal_mulai')) {
            $query->whereDate('tanggal_mulai', '>=', $request->tanggal_mulai);
        }
        if ($request->filled('tanggal_selesai')) {
            $query->whereDate('tanggal_selesai', '<=', $request->tanggal_selesai);
        }

        // Filter by month/year (supports 'bulan'/'month' and 'tahun'/'year')
        if ($request->filled('bulan') || $request->filled('month') || $request->filled('tahun') || $request->filled('year')) {
            if ($request->filled('bulan') || $request->filled('month')) {
                $month = $request->filled('bulan') ? $request->bulan : $request->month;
                // ensure numeric month
                $query->whereMonth('tanggal_mulai', (int) $month);
            }
            if ($request->filled('tahun') || $request->filled('year')) {
                $year = $request->filled('tahun') ? $request->tahun : $request->year;
                $query->whereYear('tanggal_mulai', (int) $year);
            }
        }

        // Search by user name only (supports 'q' or 'search' param from FE)
        if ($request->filled('q') || $request->filled('search')) {
            $q = $request->filled('q') ? $request->q : $request->search;
            $query->whereHas('user', function($u) use ($q) {
                $u->where('nama', 'like', "%$q%");
            });
        }

        // Select only needed columns for list
        $leave_requests = $query->select([
                'id_izin', 'user_id', 'jenis_izin', 'tanggal_mulai', 'tanggal_selesai', 'keterangan', 'lampiran',
                'status', 'approved_by', 'catatan_approval', 'approved_at',
                'status_mentor', 'status_admin', 'catatan_mentor', 'catatan_admin',
                'approved_by_mentor', 'approved_by_admin', 'approved_at_mentor', 'approved_at_admin', 'created_at', 'updated_at'
            ])
            ->orderBy('tanggal_mulai', 'desc')
            ->orderBy('created_at', 'desc')
            ->paginate($request->per_page ?? $request->input('limit') ?? 10);

        // Ambil user dan approver hanya untuk yang tampil
        $userIds = $leave_requests->getCollection()->pluck('user_id')->merge(
            $leave_requests->getCollection()->pluck('approved_by_mentor')
        )->merge(
            $leave_requests->getCollection()->pluck('approved_by_admin')
        )->unique()->filter()->all();
        $userMap = \App\Models\User::whereIn('user_id', $userIds)
            ->with('mahasiswa')
            ->get(['user_id', 'nama'])
            ->keyBy('user_id');

        $leave_requests->getCollection()->transform(function($item) use ($userMap) {
            $approverMentor = $item->approved_by_mentor && isset($userMap[$item->approved_by_mentor])
                ? [
                    'user_id' => $userMap[$item->approved_by_mentor]->user_id,
                    'id_karyawan' => $userMap[$item->approved_by_mentor]->karyawan?->id_karyawan ?? null,
                    'nama' => $userMap[$item->approved_by_mentor]->nama,
                    'identifier' => $userMap[$item->approved_by_mentor]->identifier
                ] : null;
            $approverAdmin = $item->approved_by_admin && isset($userMap[$item->approved_by_admin])
                ? [
                    'user_id' => $userMap[$item->approved_by_admin]->user_id,
                    'id_karyawan' => $userMap[$item->approved_by_admin]->karyawan?->id_karyawan ?? null,
                    'nama' => $userMap[$item->approved_by_admin]->nama,
                    'identifier' => $userMap[$item->approved_by_admin]->identifier
                ] : null;
            $mahasiswaData = null;
            if ($item->user_id && isset($userMap[$item->user_id]) && $userMap[$item->user_id]->mahasiswa) {
                $mhs = $userMap[$item->user_id]->mahasiswa;
                $mahasiswaData = [
                    'job_position' => $mhs->job_position ?? null,
                    'division' => $mhs->division ?? null,
                    'universitas' => $mhs->universitas ?? null,
                    'jurusan' => $mhs->jurusan ?? null
                ];
            }
            
            $userInfo = $item->user_id && isset($userMap[$item->user_id])
                ? [
                    'user_id' => $userMap[$item->user_id]->user_id,
                    'id_mahasiswa' => $userMap[$item->user_id]->mahasiswa?->id_mahasiswa ?? null,
                    'nama' => $userMap[$item->user_id]->nama,
                    'identifier' => $userMap[$item->user_id]->identifier,
                    'mahasiswa' => $mahasiswaData
                ] : null;
            $leave_requestsData = [
                'id_izin' => $item->id_izin,
                'user_id' => $item->user_id,
                'id_mahasiswa' => $item->id_mahasiswa ?? null,
                'jenis_izin' => $item->jenis_izin,
                'tanggal_mulai' => $item->tanggal_mulai,
                'tanggal_selesai' => $item->tanggal_selesai,
                'keterangan' => $item->keterangan,
                'lampiran' => $item->lampiran,
                'status' => $item->status,
                'approved_by' => $item->approved_by,
                'catatan_approval' => $item->catatan_approval,
                'approved_at' => $item->approved_at,
                'status_mentor' => $item->status_mentor,
                'status_admin' => $item->status_admin,
                'catatan_mentor' => $item->catatan_mentor,
                'catatan_admin' => $item->catatan_admin,
                'approved_by_mentor' => $item->approved_by_mentor,
                'approved_by_admin' => $item->approved_by_admin,
                'approved_at_mentor' => $item->approved_at_mentor,
                'approved_at_admin' => $item->approved_at_admin,
                'user' => $userInfo,
                'approver_mentor' => $approverMentor,
                'approver_admin' => $approverAdmin
            ];
            return (object) $leave_requestsData;
        });

        return response()->json([
            'success' => true,
            'data' => $leave_requests
        ]);
    }

    /**
     * Approve/Reject leave_requests (Admin/Mentor)
     */
    public function updateStatus(Request $request, $id)
    {
        // Merge raw JSON body if present to ensure fields are available for PUT requests
        $json = json_decode($request->getContent(), true);
        if (is_array($json)) {
            $request->merge($json);
        }

        $request->validate([
            'status' => 'required|in:approved,rejected',
            'catatan_approval' => 'nullable|string|max:500',
        ], [
            'status.required' => 'Field status harus disertakan dan bernilai approved atau rejected.',
            'status.in' => 'Field status harus salah satu dari: approved, rejected.'
        ]);

        $leave_requests = Izin::find($id);
        if (!$leave_requests) {
            return response()->json([
                'success' => false,
                'message' => 'Data leave_requests tidak ditemukan'
            ], 404);
        }

        $user = $request->user();
        $now = Carbon::now();

        // Approval berjenjang: mentor dulu, lalu admin
        // Contextual approval based on API route
        $activeRole = $request->query('active_role');
        $isMentorContext = ($activeRole === 'mentor') || ($request->segment(2) === 'mentor' && $user->isMentor());

        if ($isMentorContext) {
            // Cek apakah intern bimbingan
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
            
            if (!in_array($leave_requests->user_id, $internIds)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak berhak memproses leave_requests ini'
                ], 403);
            }
            // Hanya bisa approve jika status_mentor masih pending
            if ($leave_requests->status_mentor !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'Izin sudah diproses mentor sebelumnya'
                ], 400);
            }
            // Jika mentor reject, admin tidak bisa approve
            if ($request->status === 'rejected') {
                $leave_requests->update([
                    'status_mentor' => 'rejected',
                    'catatan_mentor' => $request->catatan_approval,
                    'approved_by_mentor' => $user->user_id,
                    'approved_at_mentor' => $now,
                    'status_admin' => 'rejected',
                    'catatan_admin' => null,
                    'approved_by_admin' => null,
                    'approved_at_admin' => null,
                    'approved_by' => $user->user_id,
                    'catatan_approval' => $request->catatan_approval,
                    'approved_at' => $now,
                    // Mark overall status as rejected so queries checking status='approved' won't include it
                    'status' => 'rejected',
                ]);

                // Notifikasi ke Intern (Ditolak Mentor)
                $intern = User::find($leave_requests->user_id);
                if ($intern) {
                    $intern->notify(new GeneralNotification(
                        'Izin/Sakit Ditolak Mentor',
                        "Pengajuan {$leave_requests->jenis_izin} Anda (" . Carbon::parse($leave_requests->tanggal_mulai)->format('d-m-Y') . " s/d " . Carbon::parse($leave_requests->tanggal_selesai)->format('d-m-Y') . ") ditolak oleh Mentor.",
                        "/intern/izin",
                        "error",
                        "intern"
                    ));
                }
            } else {
                // Jika mentor approve, status admin pending
                $leave_requests->update([
                    'status_mentor' => 'approved',
                    'catatan_mentor' => $request->catatan_approval,
                    'approved_by_mentor' => $user->user_id,
                    'approved_at_mentor' => $now,
                    'status_admin' => 'pending',
                    'catatan_admin' => null,
                    'approved_by_admin' => null,
                    'approved_at_admin' => null,
                    'approved_by' => null,
                    'catatan_approval' => null,
                    'approved_at' => null,
                ]);

                // Notifikasi ke Intern (Disetujui Mentor, Menunggu Admin)
                $intern = User::find($leave_requests->user_id);
                if ($intern) {
                    $intern->notify(new GeneralNotification(
                        'Izin/Sakit Disetujui Mentor',
                        "Pengajuan {$leave_requests->jenis_izin} Anda (" . Carbon::parse($leave_requests->tanggal_mulai)->format('d-m-Y') . " s/d " . Carbon::parse($leave_requests->tanggal_selesai)->format('d-m-Y') . ") disetujui Mentor dan sedang menunggu Admin.",
                        "/intern/izin",
                        "info",
                        "intern"
                    ));
                }
                
                // Notifikasi ke semua Admin (Ada izin baru yang butuh approval)
                $admins = User::active()->withRole('admin')->get();
                foreach ($admins as $adminUser) {
                    if ($adminUser) {
                        $adminUser->notify(new GeneralNotification(
                            'Persetujuan Izin/Sakit Menunggu',
                            "Ada pengajuan {$leave_requests->jenis_izin} (" . Carbon::parse($leave_requests->tanggal_mulai)->format('d-m-Y') . " s/d " . Carbon::parse($leave_requests->tanggal_selesai)->format('d-m-Y') . ") dari intern yang telah disetujui Mentor dan perlu persetujuan Anda.",
                            "/admin/izin",
                            "warning",
                            "admin"
                        ));
                    }
                }
            }
        } else if ($request->segment(2) === 'admin' && $user->isAdmin()) {
            // Admin hanya bisa approve jika sudah di-approve mentor (status_mentor == approved dan status_admin == pending)
            if ($leave_requests->status_mentor !== 'approved' || $leave_requests->status_admin !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'Izin belum di-approve mentor atau sudah diproses admin'
                ], 400);
            }
            // Admin approve/reject
            $leave_requests->update([
                'status_admin' => $request->status,
                'catatan_admin' => $request->catatan_approval,
                'approved_by_admin' => $user->user_id,
                'approved_at_admin' => $now,
                'approved_by' => $user->user_id,
                'catatan_approval' => $request->catatan_approval,
                'approved_at' => $now,
                // Mark overall status to reflect final admin decision
                'status' => $request->status,
            ]);

            // Notifikasi ke Intern (Keputusan Final Admin)
            $intern = User::find($leave_requests->user_id);
            if ($intern) {
                $statusIndo = $request->status === 'approved' ? 'Disetujui' : 'Ditolak';
                $notifType = $request->status === 'approved' ? 'success' : 'error';
                $intern->notify(new GeneralNotification(
                    "Izin/Sakit {$statusIndo} Admin",
                    "Pengajuan {$leave_requests->jenis_izin} Anda (" . Carbon::parse($leave_requests->tanggal_mulai)->format('d-m-Y') . " s/d " . Carbon::parse($leave_requests->tanggal_selesai)->format('d-m-Y') . ") putusan akhir: {$statusIndo} oleh Admin.",
                    "/intern/izin",
                    $notifType,
                    "intern"
                ));
            }
        } else {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak berhak memproses leave_requests ini'
            ], 403);
        }

        // Tambahkan approver_mentor dan approver_admin ke response
        $leave_requestsFresh = $leave_requests->fresh(['user']);
        $approverMentor = null;
        $approverAdmin = null;
        if ($leave_requestsFresh->approved_by_mentor) {
            $mentor = \App\Models\User::find($leave_requestsFresh->approved_by_mentor);
            if ($mentor) {
                $approverMentor = [
                    'user_id' => $mentor->user_id,
                    'nama' => $mentor->nama,
                    'identifier' => $mentor->identifier
                ];
            }
        }
        if ($leave_requestsFresh->approved_by_admin) {
            $admin = \App\Models\User::find($leave_requestsFresh->approved_by_admin);
            if ($admin) {
                $approverAdmin = [
                    'user_id' => $admin->user_id,
                    'nama' => $admin->nama,
                    'identifier' => $admin->identifier
                ];
            }
        }
        $leave_requestsArr = $leave_requestsFresh->toArray();
        $leave_requestsArr['approver_mentor'] = $approverMentor;
        $leave_requestsArr['approver_admin'] = $approverAdmin;
        return response()->json([
            'success' => true,
            'message' => 'Status leave_requests berhasil diperbarui',
            'data' => $leave_requestsArr
        ]);
    }

    // ==================== KOREKSI ABSENSI ====================

    /**
     * List koreksi absensi untuk user yang login
     */
    public function koreksiIndex(Request $request)
    {
        $user = $request->user();

        $query = KoreksiAbsensi::query()
            ->selectRaw('
                attendance_corrections.*,
                (SELECT MAX(waktu) FROM attendances 
                 WHERE attendances.user_id = attendance_corrections.user_id 
                 AND attendances.tanggal = attendance_corrections.tanggal
                 AND ((attendance_corrections.jenis_koreksi = "lupa_absen_masuk" AND attendances.status = "masuk") 
                      OR (attendance_corrections.jenis_koreksi IN ("lupa_absen_pulang", "pulang_cepat") AND attendances.status = "pulang"))
                ) as waktu_asli
            ')
            ->where('attendance_corrections.user_id', $user->user_id);

        if ($request->filled('status')) {
            $status = $request->input('status');
            if (!is_array($status)) {
                $status = array_filter(array_map('trim', explode(',', strtolower($status))));
            } else {
                $status = array_map('strtolower', $status);
            }
            
            $query->where(function($q) use ($status) {
                if (in_array('approved', $status)) {
                    $q->orWhere(function($subq) {
                        $subq->where('attendance_corrections.status_mentor', 'approved')
                             ->where('attendance_corrections.status_admin', 'approved');
                    });
                }
                
                if (in_array('rejected', $status)) {
                    $q->orWhere('attendance_corrections.status_mentor', 'rejected')
                      ->orWhere('attendance_corrections.status_admin', 'rejected');
                }
                
                if (in_array('need_approval', $status)) {
                    $q->orWhere('attendance_corrections.status_mentor', 'pending');
                }
                
                if (in_array('waiting_admin', $status)) {
                    $q->orWhere(function($subq) {
                        $subq->where('attendance_corrections.status_mentor', 'approved')
                             ->where('attendance_corrections.status_admin', 'pending');
                    });
                }
            });
        }

        // Filter by jenis_koreksi (support array)
        if ($request->filled('jenis_koreksi')) {
            $jenis = $request->input('jenis_koreksi');
            if (is_array($jenis)) {
                $query->whereIn('attendance_corrections.jenis_koreksi', $jenis);
            } else {
                $query->where('attendance_corrections.jenis_koreksi', $jenis);
            }
        }

        // Filter by tanggal
        if ($request->filled('tanggal')) {
            $query->whereDate('attendance_corrections.tanggal', $request->tanggal);
        }

        // Search by alasan
        if ($request->filled('q')) {
            $q = $request->q;
            $query->where(function($sub) use ($q) {
                $sub->where('attendance_corrections.alasan', 'like', "%$q%")
                    ->orWhere('attendance_corrections.jenis_koreksi', 'like', "%$q%")
                    ->orWhere('attendance_corrections.status', 'like', "%$q%")
                    ->orWhere('attendance_corrections.tanggal', 'like', "%$q%")
                    ->orWhere('attendance_corrections.jam_koreksi', 'like', "%$q%")
                ;
            });
        }

        $koreksi = $query->orderBy('attendance_corrections.tanggal', 'desc')
            ->orderBy('attendance_corrections.created_at', 'desc')
            ->paginate($request->per_page ?? $request->input('limit') ?? 10);

        // Ensure tanggal is returned as Y-m-d (avoid timezone shifts on frontend)
        $koreksi->getCollection()->transform(function($item) {
            if (!empty($item->tanggal)) {
                $item->tanggal = Carbon::parse($item->tanggal)->toDateString();
            }
            return $item;
        });

        return response()->json([
            'success' => true,
            'data' => $koreksi
        ]);
    }

    /**
     * Submit pengajuan koreksi absensi dengan tanggal dan jam spesifik
     * Mendukung multiple koreksi dalam satu submission (check-in dan check-out sama hari)
     */
    public function koreksiStore(Request $request)
    {
        // Detect PHP-level upload errors (e.g., missing tmp dir) using raw $_FILES so we can return a clear message
        if (isset($_FILES['lampiran'])) {
            $phpErrors = [];
            $fileErr = $_FILES['lampiran']['error'];
            if (is_array($fileErr)) {
                foreach ($fileErr as $e) {
                    if ($e !== UPLOAD_ERR_OK && $e !== UPLOAD_ERR_NO_FILE) {
                        $phpErrors[] = $e;
                    }
                }
            } else {
                if ($fileErr !== UPLOAD_ERR_OK && $fileErr !== UPLOAD_ERR_NO_FILE) {
                    $phpErrors[] = $fileErr;
                }
            }
            if (!empty($phpErrors)) {
                $errorsMap = [
                    UPLOAD_ERR_INI_SIZE => 'File terlalu besar (php.ini upload_max_filesize)',
                    UPLOAD_ERR_FORM_SIZE => 'File terlalu besar (form limit)',
                    UPLOAD_ERR_PARTIAL => 'Upload terpotong',
                    UPLOAD_ERR_NO_FILE => 'Tidak ada file yang diupload',
                    UPLOAD_ERR_NO_TMP_DIR => 'Folder tmp upload tidak ada (server)',
                    UPLOAD_ERR_CANT_WRITE => 'Tidak dapat menulis file sementara (server)',
                    UPLOAD_ERR_EXTENSION => 'Upload dihentikan oleh ekstensi',
                ];
                $first = $phpErrors[0];
                $msg = $errorsMap[$first] ?? 'Upload gagal (kode ' . $first . ')';
                return response()->json(['success' => false, 'message' => $msg], 400);
            }
        }

        // Normalize single-file upload to array so clients sending one file (lampiran) still pass validation
        if ($request->hasFile('lampiran') && !is_array($request->file('lampiran'))) {
            $request->files->set('lampiran', [$request->file('lampiran')]);
        }

        // If files present, check for PHP upload errors early and return a helpful message
        if ($request->hasFile('lampiran')) {
            $files = is_array($request->file('lampiran')) ? $request->file('lampiran') : [$request->file('lampiran')];
            foreach ($files as $file) {
                if ($file->getError() !== UPLOAD_ERR_OK) {
                    $errorsMap = [
                        UPLOAD_ERR_INI_SIZE => 'File terlalu besar (php.ini upload_max_filesize)',
                        UPLOAD_ERR_FORM_SIZE => 'File terlalu besar (form limit)',
                        UPLOAD_ERR_PARTIAL => 'Upload terpotong',
                        UPLOAD_ERR_NO_FILE => 'Tidak ada file yang diupload',
                        UPLOAD_ERR_NO_TMP_DIR => 'Folder tmp upload tidak ada (server)',
                        UPLOAD_ERR_CANT_WRITE => 'Tidak dapat menulis file sementara (server)',
                        UPLOAD_ERR_EXTENSION => 'Upload dihentikan oleh ekstensi',
                    ];
                    $msg = $errorsMap[$file->getError()] ?? 'Upload gagal (kode ' . $file->getError() . ')';
                    return response()->json(['success' => false, 'message' => $msg], 400);
                }
            }
        }

        // Support both single koreksi dan array of koreksi
        $isMultiple = $request->filled('koreksi') && is_array($request->input('koreksi'));
        
        if ($isMultiple) {
            // Multiple koreksi in one submission
            $rules = [
                'koreksi' => 'required|array|min:1',
                'koreksi.*.jenis_koreksi' => 'required|in:lupa_absen_masuk,lupa_absen_pulang,pulang_cepat',
                'koreksi.*.tanggal' => 'required|date|before_or_equal:today',
                'koreksi.*.jam_koreksi' => 'required|date_format:H:i',
                'koreksi.*.alasan' => 'required|string|max:1000',
            ];
            if ($request->hasFile('lampiran')) {
                $rules['lampiran'] = 'nullable|array';
                $rules['lampiran.*'] = 'file|mimes:pdf,jpeg,jpg,png|max:5120';
            } else {
                $rules['lampiran'] = 'nullable';
            }
            $request->validate($rules);

            $user = $request->user();
            
            // Check for duplicates before processing files
            foreach ($request->input('koreksi') as $item) {
                $existing = KoreksiAbsensi::where('user_id', $user->user_id)
                    ->where('tanggal', $item['tanggal'])
                    ->where('jenis_koreksi', $item['jenis_koreksi'])
                    ->first();
                    
                $isRejected = $existing && ($existing->status === 'rejected');
                    
                if ($existing && !$isRejected) {
                    // It is NOT rejected by either. So it's still pending or approved. We block.
                    return response()->json([
                        'success' => false,
                        'message' => 'Anda sudah memiliki pengajuan koreksi ('. $item['jenis_koreksi'] .') pada tanggal ' . \Carbon\Carbon::parse($item['tanggal'])->toDateString() . ' yang sedang diproses atau disetujui.'
                    ], 400);
                }
            }
            // Upload semua lampiran jika ada
            $lampiranPaths = [];
            if ($request->hasFile('lampiran')) {
                foreach ($request->file('lampiran') as $file) {
                    $originalName = preg_replace('/[^A-Za-z0-9.\-_]/', '_', $file->getClientOriginalName());
                    $uniqueFolder = $user->user_id . '_' . time() . '_' . uniqid();
                    $fileName = $uniqueFolder . '/' . $originalName;
                    $fileContents = file_get_contents($file->getRealPath());
                    $encryptedContents = \Illuminate\Support\Facades\Crypt::encryptString($fileContents);
                    Storage::disk("local")->put("encrypted/koreksi/" . $fileName, $encryptedContents);
                    $lampiranPaths[] = "encrypted/koreksi/" . $fileName;
                }
            }

            // Create multiple koreksi records
            $createdKoreksi = [];
            foreach ($request->input('koreksi') as $item) {
                $koreksi = KoreksiAbsensi::create([
                    'user_id' => $user->user_id,
                    'id_mahasiswa' => $user->mahasiswa?->id_mahasiswa ?? null,
                    'jenis_koreksi' => $item['jenis_koreksi'],
                    'tanggal' => $item['tanggal'],
                    'jam_koreksi' => $item['jam_koreksi'],
                    'alasan' => $item['alasan'],
                    'lampiran' => $lampiranPaths ? json_encode($lampiranPaths) : null,
                    'status' => 'pending',
                ]);
                
                // If it was rejected, we overwrite by deleting the old one (or we could update, but create + delete old is easier)
                KoreksiAbsensi::where('user_id', $user->user_id)
                    ->where('tanggal', $item['tanggal'])
                    ->where('jenis_koreksi', $item['jenis_koreksi'])
                    ->where('id_koreksi', '!=', $koreksi->id_koreksi)
                    ->delete();
                    
                $createdKoreksi[] = $koreksi;
            }

            // Kirim Notifikasi ke semua Mentor
            $mentors = $user->mentors()->get();
            $itemCount = count($createdKoreksi);
            $firstItem = $createdKoreksi[0];
            $dateFormatted = \Carbon\Carbon::parse($firstItem->tanggal)->format('d-m-Y');
            
            foreach ($mentors as $mentor) {
                if ($mentor) {
                    $mentor->notify(new GeneralNotification(
                        'Pengajuan Koreksi Absensi Baru',
                        "Intern {$user->nama} mengajukan {$itemCount} koreksi absensi pada tanggal {$dateFormatted}.",
                        "/mentor/koreksi",
                        "info",
                        "mentor"
                    ));
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Pengajuan koreksi absensi berhasil dikirim (' . count($createdKoreksi) . ' item)',
                'data' => $createdKoreksi
            ], 201);
        } else {
            // Single koreksi (backward compatible)
            $rules = [
                'jenis_koreksi' => 'required|in:lupa_absen_masuk,lupa_absen_pulang,pulang_cepat',
                'tanggal' => 'required|date|before_or_equal:today',
                'jam_koreksi' => 'required|date_format:H:i',
                'alasan' => 'required|string|max:1000',
            ];

            if ($request->hasFile('lampiran')) {
                $rules['lampiran'] = 'nullable|array';
                $rules['lampiran.*'] = 'file|mimes:pdf,jpeg,jpg,png|max:5120'; // Max 5MB
            } else {
                $rules['lampiran'] = 'nullable';
            }

            $request->validate($rules);

            $user = $request->user();

            $existing = KoreksiAbsensi::where('user_id', $user->user_id)
                ->where('tanggal', $request->tanggal)
                ->where('jenis_koreksi', $request->jenis_koreksi)
                ->first();
                
            $isRejected = $existing && ($existing->status === 'rejected');
                
            if ($existing && !$isRejected) {
                // It is NOT rejected by either. So it's still pending or approved. We block.
                return response()->json([
                    'success' => false,
                    'message' => 'Anda sudah memiliki pengajuan koreksi ('. $request->jenis_koreksi .') pada tanggal ' . \Carbon\Carbon::parse($request->tanggal)->toDateString() . ' yang sedang diproses atau disetujui.'
                ], 400);
            }
            
            // Upload semua lampiran jika ada
            $lampiranPaths = [];
            if ($request->hasFile('lampiran')) {
                foreach ($request->file('lampiran') as $file) {
                    $originalName = preg_replace('/[^A-Za-z0-9.\-_]/', '_', $file->getClientOriginalName());
                    $uniqueFolder = $user->user_id . '_' . time() . '_' . uniqid();
                    $fileName = $uniqueFolder . '/' . $originalName;
                    $fileContents = file_get_contents($file->getRealPath());
                    $encryptedContents = \Illuminate\Support\Facades\Crypt::encryptString($fileContents);
                    Storage::disk("local")->put("encrypted/koreksi/" . $fileName, $encryptedContents);
                    $lampiranPaths[] = "encrypted/koreksi/" . $fileName;
                }
            }

            $koreksi = KoreksiAbsensi::create([
                'user_id' => $user->user_id,
                'id_mahasiswa' => $user->mahasiswa?->id_mahasiswa ?? null,
                'jenis_koreksi' => $request->jenis_koreksi,
                'tanggal' => $request->tanggal,
                'jam_koreksi' => $request->jam_koreksi,
                'alasan' => $request->alasan,
                'lampiran' => $lampiranPaths ? json_encode($lampiranPaths) : null,
                'status' => 'pending',
            ]);
            
            if ($existing) {
                $existing->delete();
            }

            // Kirim Notifikasi ke semua Mentor yang membimbing intern ini
            $jenisLabel = ['lupa_absen_masuk' => 'Clock In', 'lupa_absen_pulang' => 'Clock Out', 'pulang_cepat' => 'Early Clock Out'][$request->jenis_koreksi] ?? $request->jenis_koreksi;
            $mentors = $user->mentors()->get();
            foreach ($mentors as $mentor) {
                if ($mentor) {
                    $mentor->notify(new GeneralNotification(
                        'Pengajuan Koreksi Absensi Baru',
                        "Intern {$user->nama} mengajukan koreksi {$jenisLabel} pada tanggal " . Carbon::parse($request->tanggal)->format('d-m-Y') . ".",
                        "/mentor/koreksi",
                        "info",
                        "mentor"
                    ));
                }
            }

            return response()->json([
                'success' => true,
                'message' => 'Pengajuan koreksi absensi berhasil dikirim',
                'data' => $koreksi
            ], 201);
        }
    }

    /**
     * Detail koreksi absensi
     */
    public function koreksiShow($id)
    {
        $koreksi = KoreksiAbsensi::with(['user', 'approver'])->find($id);

        if (!$koreksi) {
            return response()->json([
                'success' => false,
                'message' => 'Data koreksi tidak ditemukan'
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => $koreksi
        ]);
    }

    /**
     * List semua koreksi absensi (Admin/Mentor)
     */
    public function koreksiListAll(Request $request)
    {
        $user = $request->user();

        $query = KoreksiAbsensi::query();

        // Filter by mentor (if accessed via mentor endpoint)
        $activeRole = $request->query('active_role');
        $isMentorContext = ($activeRole === 'mentor') || ($request->segment(2) === 'mentor' && $user->isMentor());

        if ($isMentorContext) {
            // collect user IDs for interns the mentor is responsible for
            // primary source: belongsToMany via `intern_user_id` pivot column
            $direct = $user->interns()->pluck('users.user_id')->toArray();

            // legacy rows may only populate intern_mentors.intern_id (mahasiswa PK)
            // join against students to resolve to user_id if available
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
                return response()->json(['success' => true, 'data' => []]);
            }
            $query->whereIn('attendance_corrections.user_id', $internIds);
        }

        // Filter by status (support array or CSV)
        if ($request->filled('status')) {
            $status = $request->input('status');
            if (!is_array($status)) {
                $status = array_filter(array_map('trim', explode(',', strtolower($status))));
            } else {
                $status = array_map('strtolower', $status);
            }
            
            $query->where(function($q) use ($status) {
                if (in_array('approved', $status)) {
                    $q->orWhere(function($subq) {
                        $subq->where('attendance_corrections.status_mentor', 'approved')
                             ->where('attendance_corrections.status_admin', 'approved');
                    });
                }
                
                if (in_array('rejected', $status)) {
                    $q->orWhere('attendance_corrections.status_mentor', 'rejected')
                      ->orWhere('attendance_corrections.status_admin', 'rejected');
                }
                
                if (in_array('need_approval', $status)) {
                    $q->orWhere('attendance_corrections.status_mentor', 'pending');
                }
                
                if (in_array('waiting_admin', $status)) {
                    $q->orWhere(function($subq) {
                        $subq->where('attendance_corrections.status_mentor', 'approved')
                             ->where('attendance_corrections.status_admin', 'pending');
                    });
                }
            });
        }

        // Filter by jenis (support array or CSV)
        if ($request->filled('jenis_koreksi')) {
            $jenis = $request->input('jenis_koreksi');
            if (!is_array($jenis)) {
                $jenis = array_filter(array_map('trim', explode(',', $jenis)));
            }
            $query->whereIn('jenis_koreksi', $jenis);
        }

        // Filter by tanggal
        if ($request->filled('tanggal')) {
            $query->whereDate('tanggal', $request->tanggal);
        }

        // Search by alasan
        if ($request->filled('q')) {
            $q = $request->q;
            $query->where(function($sub) use ($q) {
                $sub->where('alasan', 'like', "%$q%")
                    ->orWhere('jenis_koreksi', 'like', "%$q%")
                    ->orWhere('status', 'like', "%$q%")
                    ->orWhere('tanggal', 'like', "%$q%")
                    ->orWhere('jam_koreksi', 'like', "%$q%")
                ;
            });
        }

        $koreksi = $query->selectRaw('
                attendance_corrections.*,
                (SELECT MAX(waktu) FROM attendances 
                 WHERE attendances.user_id = attendance_corrections.user_id 
                 AND attendances.tanggal = attendance_corrections.tanggal
                 AND ((attendance_corrections.jenis_koreksi = "lupa_absen_masuk" AND attendances.status = "masuk") 
                      OR (attendance_corrections.jenis_koreksi IN ("lupa_absen_pulang", "pulang_cepat") AND attendances.status = "pulang"))
                ) as waktu_asli
            ')
            ->orderBy('attendance_corrections.tanggal', 'desc')
            ->orderBy('attendance_corrections.created_at', 'desc')
            ->paginate($request->per_page ?? $request->input('limit') ?? 10);

        $userIds = $koreksi->getCollection()->pluck('user_id')->merge(
            $koreksi->getCollection()->pluck('approved_by_mentor')
        )->merge(
            $koreksi->getCollection()->pluck('approved_by_admin')
        )->unique()->filter()->all();
        
        $userMap = \App\Models\User::whereIn('user_id', $userIds)
            ->with(['mahasiswa', 'karyawan'])
            ->get(['user_id', 'nama'])
            ->keyBy('user_id');

        $koreksi->setCollection(
            $koreksi->getCollection()->map(function($item) use ($userMap) {
                $mahasiswaData = null;
                if ($item->user_id && isset($userMap[$item->user_id]) && $userMap[$item->user_id]->mahasiswa) {
                    $mhs = $userMap[$item->user_id]->mahasiswa;
                    $mahasiswaData = [
                        'job_position' => $mhs->job_position ?? null,
                        'division' => $mhs->division ?? null,
                        'universitas' => $mhs->universitas ?? null,
                        'jurusan' => $mhs->jurusan ?? null
                    ];
                }
                return [
                    'id_koreksi' => $item->id_koreksi,
                    'user' => $item->user_id && isset($userMap[$item->user_id]) ? [
                        'user_id' => $userMap[$item->user_id]->user_id,
                        'id_mahasiswa' => $userMap[$item->user_id]->mahasiswa?->id_mahasiswa ?? null,
                        'nama' => $userMap[$item->user_id]->nama,
                        'identifier' => $userMap[$item->user_id]->identifier,
                        'mahasiswa' => $mahasiswaData
                    ] : null,
                    'jenis_koreksi' => $item->jenis_koreksi,
                    'tanggal' => $item->tanggal ? Carbon::parse($item->tanggal)->toDateString() : $item->tanggal,
                    'jam_koreksi' => $item->jam_koreksi,
                    'waktu_asli' => $item->waktu_asli,
                    'alasan' => $item->alasan,
                    'lampiran' => $item->lampiran,
                    'status_mentor' => $item->status_mentor,
                    'status_admin' => $item->status_admin,
                    'catatan_mentor' => $item->catatan_mentor,
                    'catatan_admin' => $item->catatan_admin,
                    'approved_by_mentor' => $item->approved_by_mentor,
                    'approved_by_admin' => $item->approved_by_admin,
                    'approved_at_mentor' => $item->approved_at_mentor,
                    'approved_at_admin' => $item->approved_at_admin,
                    'approver_mentor' => $item->approved_by_mentor && isset($userMap[$item->approved_by_mentor])
                        ? [
                            'user_id' => $userMap[$item->approved_by_mentor]->user_id,
                            'id_karyawan' => $userMap[$item->approved_by_mentor]->karyawan?->id_karyawan ?? null,
                            'nama' => $userMap[$item->approved_by_mentor]->nama,
                            'identifier' => $userMap[$item->approved_by_mentor]->identifier,
                        ] : null,
                    'approver_admin' => $item->approved_by_admin && isset($userMap[$item->approved_by_admin])
                        ? [
                            'user_id' => $userMap[$item->approved_by_admin]->user_id,
                            'id_karyawan' => $userMap[$item->approved_by_admin]->karyawan?->id_karyawan ?? null,
                            'nama' => $userMap[$item->approved_by_admin]->nama,
                            'identifier' => $userMap[$item->approved_by_admin]->identifier,
                        ] : null,
                    'created_at' => $item->created_at,
                    'updated_at' => $item->updated_at,
                ];
            })
        );

        return response()->json([
            'success' => true,
            'data' => $koreksi
        ]);
    }

    /**
     * Approve/Reject koreksi absensi (Admin/Mentor)
     */
    public function koreksiUpdateStatus(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:approved,rejected',
            'catatan' => 'nullable|string|max:500',
        ]);

        $koreksi = KoreksiAbsensi::find($id);

        if (!$koreksi) {
            return response()->json([
                'success' => false,
                'message' => 'Data koreksi tidak ditemukan'
            ], 404);
        }

        $user = $request->user();

        // Contextual approval based on API route
        $updateData = [];
        $activeRole = $request->query('active_role');
        $isMentorContext = ($activeRole === 'mentor') || ($request->segment(2) === 'mentor' && $user->isMentor());

        if ($isMentorContext) {
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
            if (!in_array($koreksi->user_id, $internIds)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Anda tidak berhak memproses koreksi ini'
                ], 403);
            }
            if ($koreksi->status_mentor !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'Koreksi sudah diproses oleh mentor'
                ], 400);
            }
            if ($request->status === 'rejected') {
                $updateData = [
                    'status_mentor' => 'rejected',
                    'catatan_mentor' => $request->catatan,
                    'approved_by_mentor' => $user->user_id,
                    'approved_at_mentor' => Carbon::now(),
                    'status_admin' => 'rejected',
                    'catatan_admin' => null,
                    'approved_by_admin' => null,
                    'approved_at_admin' => null,
                ];

                // Notifikasi ke Intern (Koreksi Ditolak Mentor)
                $jenisLabel = ['lupa_absen_masuk' => 'Clock In', 'lupa_absen_pulang' => 'Clock Out', 'pulang_cepat' => 'Early Clock Out'][$koreksi->jenis_koreksi] ?? $koreksi->jenis_koreksi;
                $intern = User::find($koreksi->user_id);
                if ($intern) {
                    $intern->notify(new GeneralNotification(
                        'Koreksi Absensi Ditolak Mentor',
                        "Pengajuan koreksi {$jenisLabel} tanggal " . Carbon::parse($koreksi->tanggal)->format('d-m-Y') . " Anda ditolak oleh Mentor.",
                        "/intern/koreksi",
                        "error",
                        "intern"
                    ));
                }
            } else {
                $updateData = [
                    'status_mentor' => 'approved',
                    'catatan_mentor' => $request->catatan,
                    'approved_by_mentor' => $user->user_id,
                    'approved_at_mentor' => Carbon::now(),
                ];

                // Notifikasi ke Intern (Koreksi Disetujui Mentor)
                $jenisLabel = ['lupa_absen_masuk' => 'Clock In', 'lupa_absen_pulang' => 'Clock Out', 'pulang_cepat' => 'Early Clock Out'][$koreksi->jenis_koreksi] ?? $koreksi->jenis_koreksi;
                $intern = User::find($koreksi->user_id);
                if ($intern) {
                    $intern->notify(new GeneralNotification(
                        'Koreksi Absensi Disetujui Mentor',
                        "Pengajuan koreksi {$jenisLabel} tanggal " . Carbon::parse($koreksi->tanggal)->format('d-m-Y') . " Anda disetujui Mentor dan sedang menunggu Admin.",
                        "/intern/koreksi",
                        "info",
                        "intern"
                    ));
                }
                
                // Notifikasi ke semua Admin (Ada koreksi baru yang butuh approval)
                $admins = User::active()->withRole('admin')->get();
                foreach ($admins as $adminUser) {
                    if ($adminUser) {
                        $adminUser->notify(new GeneralNotification(
                            'Persetujuan Koreksi Absensi Menunggu',
                            "Ada pengajuan koreksi absensi dari intern yang telah disetujui Mentor dan perlu persetujuan Anda.",
                            "/admin/koreksi",
                            "warning",
                            "admin"
                        ));
                    }
                }
            }
        } elseif ($request->segment(2) === 'admin' && $user->isAdmin()) {
            if ($koreksi->status_mentor !== 'approved') {
                return response()->json([
                    'success' => false,
                    'message' => 'Koreksi harus disetujui mentor terlebih dahulu'
                ], 400);
            }
            if ($koreksi->status_admin !== 'pending') {
                return response()->json([
                    'success' => false,
                    'message' => 'Koreksi sudah diproses oleh admin'
                ], 400);
            }
            $updateData = [
                'status_admin' => $request->status,
                'catatan_admin' => $request->catatan,
                'approved_by_admin' => $user->user_id,
                'approved_at_admin' => Carbon::now(),
            ];

            // Notifikasi ke Intern (Keputusan Final Admin)
            $jenisLabel = ['lupa_absen_masuk' => 'Clock In', 'lupa_absen_pulang' => 'Clock Out', 'pulang_cepat' => 'Early Clock Out'][$koreksi->jenis_koreksi] ?? $koreksi->jenis_koreksi;
            $intern = User::find($koreksi->user_id);
            if ($intern) {
                $statusIndo = $request->status === 'approved' ? 'Disetujui' : 'Ditolak';
                $notifType = $request->status === 'approved' ? 'success' : 'error';
                $intern->notify(new GeneralNotification(
                    "Koreksi Absensi {$statusIndo} Admin",
                    "Pengajuan koreksi {$jenisLabel} tanggal " . Carbon::parse($koreksi->tanggal)->format('d-m-Y') . " Anda putusan akhir: {$statusIndo} oleh Admin.",
                    "/intern/koreksi",
                    $notifType,
                    "intern"
                ));
            }
        } else {
            return response()->json([
                'success' => false,
                'message' => 'Anda tidak berhak memproses koreksi ini'
            ], 403);
        }

        $koreksi->update($updateData);

        // Optionally, update main status if both approved
        if ($koreksi->fresh()->status_mentor === 'approved' && $koreksi->fresh()->status_admin === 'approved') {
            $koreksi->update(['status' => 'approved']);

            // Apply all approved corrections for this user/date so both clock-in and clock-out
            // koreksi (if present) are applied to the attendance/history table.
            $this->applyApprovedCorrectionsForDate($koreksi->user_id, $koreksi->tanggal);
        } elseif (in_array('rejected', [$koreksi->fresh()->status_mentor, $koreksi->fresh()->status_admin])) {
            $koreksi->update(['status' => 'rejected']);
        }

        $fresh = $koreksi->fresh();
        $response = [
            'id_koreksi' => $fresh->id_koreksi,
            'user' => $fresh->user,
            'jenis_koreksi' => $fresh->jenis_koreksi,
            'tanggal' => $fresh->tanggal,
            'jam_koreksi' => $fresh->jam_koreksi,
            'alasan' => $fresh->alasan,
            'lampiran' => $fresh->lampiran,
            'status_mentor' => $fresh->status_mentor,
            'status_admin' => $fresh->status_admin,
            'catatan_mentor' => $fresh->catatan_mentor,
            'catatan_admin' => $fresh->catatan_admin,
            'approved_by_mentor' => $fresh->approved_by_mentor,
            'approved_by_admin' => $fresh->approved_by_admin,
            'approved_at_mentor' => $fresh->approved_at_mentor,
            'approved_at_admin' => $fresh->approved_at_admin,
            'approver_mentor' => $fresh->approved_by_mentor ? $fresh->approverMentor : null,
            'approver_admin' => $fresh->approved_by_admin ? $fresh->approverAdmin : null,
            'created_at' => $fresh->created_at,
            'updated_at' => $fresh->updated_at,
        ];

        return response()->json([
            'success' => true,
            'message' => 'Status koreksi berhasil diperbarui',
            'data' => $response
        ]);
    }

    public function viewLampiran($id, $index)
    {
        $leave_requests = Izin::findOrFail($id);
        // Path lampiran diambil dari database, FE hanya kirim id dan index
        $lampiranPaths = json_decode($leave_requests->lampiran, true);
        $lampiranPaths = is_array($lampiranPaths) ? $lampiranPaths : ($leave_requests->lampiran ? [$leave_requests->lampiran] : []);
        if (!isset($lampiranPaths[$index])) {
            abort(404, 'Lampiran tidak ditemukan');
        }
        $filePath = $lampiranPaths[$index];
        if (str_starts_with($filePath, "encrypted/")) {
            if (!Storage::disk("local")->exists($filePath)) abort(404, 'File tidak ditemukan');
            $encryptedContents = Storage::disk("local")->get($filePath);
            $decryptedContents = \Illuminate\Support\Facades\Crypt::decryptString($encryptedContents);
            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->buffer($decryptedContents) ?: "application/octet-stream";
            return response($decryptedContents, 200)->header("Content-Type", $mime);
        }

        $disk = Storage::disk('public');
        if (!$disk->exists($filePath)) {
            abort(404, 'File tidak ditemukan');
        }
        $file = $disk->get($filePath);
        $type = $disk->mimeType($filePath);
        return response($file)->header('Content-Type', $type);
    }

    public function viewLampiranKoreksi($id, $index)
    {
        $koreksi = KoreksiAbsensi::findOrFail($id);
        // Path lampiran diambil dari database, FE hanya kirim id dan index
        $lampiranPaths = json_decode($koreksi->lampiran, true);
        $lampiranPaths = is_array($lampiranPaths) ? $lampiranPaths : ($koreksi->lampiran ? [$koreksi->lampiran] : []);
        if (!isset($lampiranPaths[$index])) {
            abort(404, 'Lampiran tidak ditemukan');
        }
        $filePath = $lampiranPaths[$index];
        if (str_starts_with($filePath, "encrypted/")) {
            if (!Storage::disk("local")->exists($filePath)) abort(404, 'File tidak ditemukan');
            $encryptedContents = Storage::disk("local")->get($filePath);
            $decryptedContents = \Illuminate\Support\Facades\Crypt::decryptString($encryptedContents);
            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->buffer($decryptedContents) ?: "application/octet-stream";
            return response($decryptedContents, 200)->header("Content-Type", $mime);
        }

        $disk = Storage::disk('public');
        if (!$disk->exists($filePath)) {
            abort(404, 'File tidak ditemukan');
        }
        $file = $disk->get($filePath);
        $type = $disk->mimeType($filePath);
        return response($file)->header('Content-Type', $type);
    }

    /**
     * Update actual attendance record when correction is approved by admin
     */
    private function updateAttendanceFromCorrection($koreksi)
    {
        // Map jenis_koreksi to absensi status
        $statusMapping = [
            'lupa_absen_masuk' => 'masuk',
            'lupa_absen_pulang' => 'pulang',
            'pulang_cepat' => 'pulang'
        ];
        
        $absensiStatus = $statusMapping[$koreksi->jenis_koreksi] ?? $koreksi->jenis_koreksi;

        // Calculate lateness if status is 'masuk'
        $lamaTelat = 0;
        if ($absensiStatus === 'masuk') {
            $user = $koreksi->user;
            if ($user) {
                $lamaTelat = \App\Services\AttendanceService::calculateLateness($user, $koreksi->jam_koreksi, $koreksi->tanggal);
            }
        }

        // Find the attendance record to update
        $attendance = \DB::table('attendances')
            ->where('user_id', $koreksi->user_id)
            ->where('tanggal', $koreksi->tanggal)
            ->where('status', $absensiStatus)
            ->first();

        if ($attendance) {
            // Update the waktu (time) with the corrected time and recalculate lateness
            \DB::table('attendances')
                ->where('id_absensi', $attendance->id_absensi)
                ->update([
                    'waktu' => $koreksi->jam_koreksi,
                    'lama_telat' => $lamaTelat,
                    'updated_at' => Carbon::now()
                ]);
        } else {
            // If attendance record doesn't exist, create it with default values
            \DB::table('attendances')->insert([
                'user_id' => $koreksi->user_id,
                'id_mahasiswa' => $koreksi->user->id_mahasiswa ?? null,
                'tanggal' => $koreksi->tanggal,
                'waktu' => $koreksi->jam_koreksi,
                'status' => $absensiStatus,
                'latitude_absen' => -7.330588, // Default campus latitude (dummy value for correction)
                'longitude_absen' => 112.758253, // Default campus longitude (dummy value for correction)
                'lama_telat' => $lamaTelat, 
                'foto_absen' => null, // Nullable
                'created_at' => Carbon::now(),
                'updated_at' => Carbon::now()
            ]);
        }
    }

    /**
     * Check whether mentor can access an intern's attachment.
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

    /**
     * Apply all approved koreksi for a given user and date.
     * Ensures that if there are separate koreksi for 'masuk' and 'pulang',
     * both are applied into the attendances table/history when fully approved.
     */
    private function applyApprovedCorrectionsForDate($userId, $tanggal)
    {
        $rows = KoreksiAbsensi::where('user_id', $userId)
            ->where('tanggal', $tanggal)
            ->where('status_mentor', 'approved')
            ->where('status_admin', 'approved')
            ->get();

        foreach ($rows as $r) {
            try {
                $this->updateAttendanceFromCorrection($r);
            } catch (\Exception $e) {
                // Log and continue with others
                \Illuminate\Support\Facades\Log::error('Failed to apply approved koreksi: ' . $e->getMessage(), [
                    'id_koreksi' => $r->id_koreksi ?? null,
                    'user_id' => $userId,
                    'tanggal' => $tanggal
                ]);
            }
        }
    }
}
