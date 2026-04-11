<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Evaluation;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Notifications\GeneralNotification;

class EvaluationController extends Controller
{
    /**
     * Get evaluations for the authenticated intern
     * Route: GET /api/intern/my-evaluation
     */
    public function myEvaluation(Request $request)
    {
        $user = $request->user();

        $evaluations = Evaluation::with([
            'mentor:user_id,nama',
            'mentor.mahasiswa:user_id,nim',
            'details'
        ])
            ->forIntern($user)
            ->where('status', 'final') 
            ->orderBy('evaluation_date', 'desc')
            ->get();

        // Include intern's internship period
        $internshipPeriode = null;
        if ($user->mahasiswa?->mulai_magang && $user->mahasiswa?->akhir_magang) {
            $internshipPeriode = Carbon::parse($user->mahasiswa->mulai_magang)->format('j M Y') . ' - ' . Carbon::parse($user->mahasiswa->akhir_magang)->format('j M Y');
        }

        return response()->json([
            'success' => true,
            'data' => $evaluations,
            'internship_info' => [
                'mulai_magang' => $user->mahasiswa?->mulai_magang,
                'akhir_magang' => $user->mahasiswa?->akhir_magang,
                'internship_periode' => $internshipPeriode,
            ]
        ]);
    }

    /**
     * List interns with evaluation status for Mentor/Admin
     * Shows: foto, nama, division, periode, status (Not Yet, Draft, Done)
     * Route: GET /api/mentor/evaluations/interns OR /api/admin/evaluations/interns
     */
    public function listInterns(Request $request)
    {
        $user = $request->user();
        
        // Get interns that mentor has access to
        if ($request->segment(2) === 'mentor') {
            // Mentor sees only their assigned interns with completed internship
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

            $query = User::whereIn('users.user_id', $internIds)
                ->whereHas('mahasiswa', function($q) {
                    $q->whereDate('akhir_magang', '<', date('Y-m-d'));
                });
        } elseif ($user->isAdmin()) {
            // Admin sees all interns with completed internship
            $query = User::whereHas('roles', function($q) {
                $q->where('name', 'intern');
            })->whereHas('mahasiswa', function($q) {
                $q->whereDate('akhir_magang', '<', date('Y-m-d'));
            });
        } else {
            // Fallback for non-admin trying to access non-mentor route
            $query = $user->interns()
                ->whereHas('mahasiswa', function($q) {
                    $q->whereDate('akhir_magang', '<', date('Y-m-d'));
                });
        }

        // Apply filters
        if ($request->filled('search')) {
            $search = addslashes($request->search);
            $query->where(function($q) use ($search) {
                $q->where('nama', 'like', "%{$search}%")
                  ->orWhereExists(function($sub) use ($search) {
                      $sub->select(DB::raw('1'))->from('students')->whereRaw("students.user_id = users.user_id AND (students.nim LIKE ? OR students.nama LIKE ?)", ["%{$search}%","%{$search}%"]);
                  });
            });
        }

        if ($request->filled('division')) {
            $query->whereHas('mahasiswa', function($q) use ($request) {
                $q->where('division', $request->division);
            });
        }

        $interns = $query->with('mahasiswa')->select([
            'user_id', 'nama', 'status'
        ])->get();

        // Add evaluation status for each intern
        $result = $interns->map(function($intern) use ($user, $request) {
            // Check evaluation status
            $evaluationQuery = Evaluation::forIntern($intern);
            
            // For mentor endpoint, check only their evaluations (legacy mentor_id still valid)
            if ($request->segment(2) === 'mentor') {
                $evaluationQuery->where('mentor_id', $user->user_id);
            }
            
            $evaluation = $evaluationQuery->orderBy('created_at', 'desc')->first();
            
            $status = 'not_yet';
            if ($evaluation) {
                $status = $evaluation->status === 'final' ? 'done' : 'draft';
            }

            $mahasiswa = $intern->mahasiswa;
            return [
                'user_id' => $intern->user_id,
                'id_mahasiswa' => $mahasiswa?->id_mahasiswa ?? null,
                'nama' => $intern->nama,
                'identifier' => $mahasiswa?->nim ?? $intern->identifier,
                'foto' => $mahasiswa?->foto ?? null,
                'status' => $intern->status ?? null,
                'is_active' => isset($intern->status) ? ($intern->status === 'active') : null,
                'division' => $mahasiswa?->division,
                'job_position' => $mahasiswa?->job_position,
                'jenjang_pendidikan' => $mahasiswa?->jenjang_pendidikan,
                'universitas' => $mahasiswa?->universitas,
                'jurusan' => $mahasiswa?->jurusan,
                'mulai_magang' => $mahasiswa?->mulai_magang,
                'akhir_magang' => $mahasiswa?->akhir_magang,
                'periode' => $mahasiswa?->mulai_magang && $mahasiswa?->akhir_magang 
                    ? Carbon::parse($mahasiswa->mulai_magang)->format('j M Y') . ' - ' . Carbon::parse($mahasiswa->akhir_magang)->format('j M Y')
                    : null,
                'evaluation_status' => $status,
                'evaluation_id' => $evaluation?->id_evaluation,
            ];
        });

        // Filter by status if needed (supports comma-separated values or array)
        if ($request->has('status') && $request->status !== null && $request->status !== '') {
            $statuses = is_array($request->status) ? $request->status : array_filter(array_map('trim', explode(',', $request->status)));
            $statuses = array_map('strtolower', $statuses);
            
            if (!empty($statuses)) {
                $result = $result->filter(function($item) use ($statuses) {
                    return in_array(strtolower($item['evaluation_status'] ?? ''), $statuses, true);
                })->values();
            }
        }

        return response()->json([
            'success' => true,
            'data' => $result
        ]);
    }

    /**
     * Get interns ending soon (for evaluation dashboard)
     * Route: GET /api/mentor/evaluations/ending-soon
     */
    public function endingSoon(Request $request)
    {
        $user = $request->user();
        $days = $request->days ?? 30;

        if ($request->segment(2) === 'mentor') {
            // For mentors, filter through mentors relationship to get their interns
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
            $query = User::whereIn('users.user_id', $internIds);
        } elseif ($user->isAdmin()) {
            $query = User::whereHas('roles', function($q) {
                $q->where('name', 'intern');
            });
        } else {
            $query = $user->interns();
        }

        // Search filter
        if ($request->filled('search')) {
            $search = addslashes($request->search);
            $query->where(function($q) use ($search) {
                $q->where('nama', 'like', "%{$search}%")
                  ->orWhereExists(function($sub) use ($search) {
                      $sub->select(DB::raw('1'))->from('students')->whereRaw("students.user_id = users.user_id AND (students.nim LIKE ? OR students.nama LIKE ?)", ["%{$search}%","%{$search}%"]);
                  });
            });
        }

        // Division filter
        if ($request->filled('division')) {
            $division = $request->division;
            $query->whereHas('mahasiswa', function($q) use ($division) {
                $q->where('division', 'like', "%{$division}%")
                  ->orWhere('job_position', 'like', "%{$division}%");
            });
        }

        $today = date('Y-m-d');
        $interns = $query->whereHas('mahasiswa', function($q) use ($today, $days) {
            $q->whereDate('akhir_magang', '>=', $today)
              ->whereDate('akhir_magang', '<=', Carbon::parse($today)->addDays($days)->toDateString());
        })->with('mahasiswa')->select(['user_id', 'nama', 'status'])
            ->get()
            ->sortBy(function($intern) {
                return $intern->mahasiswa?->akhir_magang;
            })
            ->values();

        // Add evaluation status
        $request = request();
        $result = $interns->map(function($intern) use ($user, $request) {
            $evaluationQuery = Evaluation::forIntern($intern);
            if ($request->segment(2) === 'mentor') {
                $evaluationQuery->where('mentor_id', $user->user_id);
            }
            $evaluation = $evaluationQuery->first();
            
            $mentor = $intern->mentors()->first();
            $mahasiswa = $intern->mahasiswa;
            
            return [
                'user_id' => $intern->user_id,
                'id_mahasiswa' => $mahasiswa?->id_mahasiswa ?? null,
                'nama' => $intern->nama,
                'identifier' => $mahasiswa?->nim ?? $intern->identifier,
                'foto' => $mahasiswa?->foto ?? null,
                'status' => $intern->status ?? null,
                'is_active' => isset($intern->status) ? ($intern->status === 'active') : null,
                'division' => $mahasiswa?->division,
                'job_position' => $mahasiswa?->job_position,
                'jenjang_pendidikan' => $mahasiswa?->jenjang_pendidikan,
                'nama_mentor' => $mentor ? $mentor->nama : null,
                'akhir_magang' => $mahasiswa?->akhir_magang ? Carbon::parse($mahasiswa->akhir_magang)->format('Y-m-d') : null,
                'days_remaining' => $mahasiswa?->akhir_magang ? Carbon::today()->diffInDays($mahasiswa->akhir_magang, false) : null,
                'has_evaluation' => $evaluation !== null,
                'evaluation_status' => $evaluation?->status ?? 'not_yet',
            ];
        });

        // Filter by status (supports multi-status)
        if ($request->has('status') && $request->status !== null && $request->status !== '') {
            $statuses = is_array($request->status) ? $request->status : array_filter(array_map('trim', explode(',', $request->status)));
            $statuses = array_map('strtolower', $statuses);
            
            if (!empty($statuses)) {
                $result = $result->filter(function($item) use ($statuses) {
                    return in_array(strtolower($item['evaluation_status'] ?? 'not_yet'), $statuses, true);
                })->values();
            }
        }

        return response()->json([
            'success' => true,
            'data' => $result
        ]);
    }

    /**
     * Admin Dashboard Stats
     * Route: GET /api/admin/evaluations/dashboard
     */
    public function adminDashboard(Request $request)
    {
        // Get all interns with completed internship period
        $completedInterns = User::where('status', 'active')
            ->whereHas('roles', function($q) {
            $q->where('name', 'intern');
        })->whereHas('mahasiswa', function($q) {
            $q->whereDate('akhir_magang', '<', date('Y-m-d'));
        })->get();

        $totalCompleted = $completedInterns->count();
        $doneCount = 0;
        $needReviewCount = 0;
        $notYetCount = 0;

        foreach ($completedInterns as $intern) {
            $evaluation = Evaluation::forIntern($intern)
                ->where('status', 'final')
                ->first();

            if (!$evaluation) {
                $notYetCount++;
            } elseif ($evaluation->admin_reviewed) {
                $doneCount++;
            } else {
                $needReviewCount++;
            }
        }

        return response()->json([
            'success' => true,
            'data' => [
                'total_completed' => $totalCompleted,
                'done' => $doneCount,
                'need_review' => $needReviewCount,
                'not_yet' => $notYetCount,
            ]
        ]);
    }

    /**
     * Admin List Interns with Evaluation Status
     * Route: GET /api/admin/evaluations/interns
     */
    public function adminListInterns(Request $request)
    {
        // Get all interns with completed internship period
        $query = User::whereHas('roles', function($q) {
            $q->where('name', 'intern');
        })->whereHas('mahasiswa', function($q) {
            $q->whereDate('akhir_magang', '<', date('Y-m-d'));
        });

        // Search filter
        if ($request->filled('search')) {
            $search = addslashes($request->search);
            $query->where(function($q) use ($search) {
                $q->where('nama', 'like', "%{$search}%")
                  ->orWhereExists(function($sub) use ($search) {
                      $sub->select(DB::raw('1'))->from('students')->whereRaw("students.user_id = users.user_id AND (students.nim LIKE ? OR students.nama LIKE ?)", ["%{$search}%","%{$search}%"]);
                  });
            });
        }

        if ($request->filled('division')) {
            $query->whereHas('mahasiswa', function($q) use ($request) {
                $q->where('division', $request->division);
            });
        }

        $interns = $query->with('mahasiswa')->select(['user_id', 'nama', 'status'])->get();

        // Map with evaluation status and mentor info - keep objects for downstream processing
        $result = $interns->map(function($intern) {
            $evaluation = Evaluation::with('mentor:user_id,nama')
                ->where('user_id', $intern->user_id)
                ->where('status', 'final')
                ->first();

            // Determine admin review status
            $status = 'not_yet';
            if ($evaluation) {
                $status = $evaluation->admin_reviewed ? 'done' : 'need_review';
            }

            // Get mentor name (priority: from evaluation, fallback: from active mentor relationship)
            $mentorName = $evaluation?->mentor?->nama;
            if (!$mentorName) {
                $activeMentor = $intern->mentors()->first();
                $mentorName = $activeMentor?->nama;
            }

            $mahasiswa = $intern->mahasiswa;
            return [
                'user_id' => $intern->user_id,
                'id_mahasiswa' => $mahasiswa?->id_mahasiswa ?? null,
                'nama' => $intern->nama,
                'identifier' => $intern->identifier,
                'foto' => $intern->foto,
                'is_active' => isset($intern->status) ? ($intern->status === 'active') : null,
                'division' => $mahasiswa?->division,
                'job_position' => $mahasiswa?->job_position,
                'jenjang_pendidikan' => $mahasiswa?->jenjang_pendidikan,
                'universitas' => $mahasiswa?->universitas,
                'jurusan' => $mahasiswa?->jurusan,
                'mulai_magang' => $mahasiswa?->mulai_magang,
                'akhir_magang' => $mahasiswa?->akhir_magang,
                'periode' => $mahasiswa?->mulai_magang && $mahasiswa?->akhir_magang 
                    ? Carbon::parse($mahasiswa->mulai_magang)->format('j M Y') . ' - ' . Carbon::parse($mahasiswa->akhir_magang)->format('j M Y')
                    : null,
                'mentor_name' => $mentorName, // Use resolved mentor name (nama_mentor)
                'nama_mentor' => $mentorName, // Alias for consistency
                'evaluation_id' => $evaluation?->id_evaluation,
                'admin_review_status' => $status,
                'can_view' => $status !== 'not_yet',
                'can_edit' => $status === 'need_review',
            ];
        });

        // Filter by admin review status (supports comma-separated values or array)
        if ($request->has('status') && $request->status !== null && $request->status !== '') {
            $statuses = is_array($request->status) ? $request->status : array_filter(array_map('trim', explode(',', $request->status)));
            $statuses = array_map('strtolower', $statuses);
            
            if (!empty($statuses)) {
                $result = $result->filter(function($item) use ($statuses) {
                    return in_array(strtolower($item['admin_review_status'] ?? ''), $statuses, true);
                })->values();
            }
        }

        return response()->json([
            'success' => true,
            'data' => $result
        ]);
    }

    /**
     * Admin Review Evaluation (Edit feedback and mark as reviewed)
     * Route: PUT /api/admin/evaluations/{id}/review
     */
    public function adminReview(Request $request, $id)
    {
        $evaluation = Evaluation::with(['user', 'mentor'])->find($id);

        if (!$evaluation) {
            return response()->json([
                'success' => false,
                'message' => 'Evaluation not found'
            ], 404);
        }

        // Check if status is final (mentor has submitted)
        if ($evaluation->status !== 'final') {
            return response()->json([
                'success' => false,
                'message' => 'Cannot review evaluation that is not finalized by mentor'
            ], 400);
        }

        // Check if already reviewed (done status = view only)
        if ($evaluation->admin_reviewed) {
            return response()->json([
                'success' => false,
                'message' => 'Evaluation already reviewed. You can only view.'
            ], 400);
        }

        $request->validate([
            'mentor_notes' => 'nullable|string',  // Admin edits mentor_notes directly
            'notes' => 'nullable|string',         // Frontend sends 'notes'
        ]);

        $user = $request->user();

        // Update mentor notes (admin can edit the mentor's feedback)
        if ($request->has('mentor_notes')) {
            $evaluation->mentor_notes = $request->mentor_notes;
        } elseif ($request->has('notes')) {
            $evaluation->mentor_notes = $request->notes;
        }

        // Auto-mark as reviewed ketika admin review
        $evaluation->admin_reviewed = true;
        $evaluation->admin_id = $user->user_id;
        $evaluation->admin_reviewed_at = now();

        $evaluation->save();

        // Reload with fresh data and components (avoid selecting non-existent users.identifier)
        $evaluation->load(['user:user_id,nama', 'user.mahasiswa:user_id,nim', 'mentor:user_id,nama', 'mentor.mahasiswa:user_id,nim', 'components']);

        // Notifikasi ke Mentor (Review Admin Selesai)
        $mentorUser = User::find($evaluation->mentor_id);
        if ($mentorUser) {
            $mentorUser->notify(new GeneralNotification(
                'Evaluasi Direview Admin',
                "Evaluasi untuk intern {$evaluation->user->nama} telah direview oleh Admin.",
                "/mentor/evaluations",
                "success",
                "mentor"
            ));
        }

        return response()->json([
            'success' => true,
            'message' => 'Evaluation reviewed successfully',
            'data' => $evaluation
        ]);
    }

    /**
     * List evaluations (Mentor/Admin)
     * Route: GET /api/mentor/evaluations OR /api/admin/evaluations
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Evaluation::with(['user:user_id,nama', 'user.mahasiswa:user_id,nim,division', 'mentor:user_id,nama', 'mentor.mahasiswa:user_id,nim']);

        // If accessed via mentor route, only show evaluations they created
        $activeRole = $request->query('active_role');
        $isMentorContext = ($activeRole === 'mentor') || ($request->segment(2) === 'mentor' && $user->isMentor());

        if ($isMentorContext) {
            $query->where('mentor_id', $user->user_id);
        }

        // Filter by status (supports comma-separated values or array)
        if ($request->has('status') && $request->status !== null && $request->status !== '') {
            $statuses = is_array($request->status) ? $request->status : array_filter(array_map('trim', explode(',', $request->status)));
            
            if (!empty($statuses)) {
                $query->whereIn('status', $statuses);
            }
        }

        // Filter by user_id (intern) — accept `id_mahasiswa` as alias
        if ($request->filled('user_id') || $request->filled('id_mahasiswa')) {
            $targetUserId = $request->input('user_id') ?? \App\Models\TblMahasiswa::where('id_mahasiswa', $request->id_mahasiswa)->value('user_id');
            if ($targetUserId) {
                $query->where('user_id', $targetUserId);
            }
        }

        // Filter by periode
        if ($request->filled('periode')) {
            $query->where('periode', 'like', '%' . $request->periode . '%');
        }

        $evaluations = $query->orderBy('evaluation_date', 'desc')
            ->paginate($request->per_page ?? 10);

        return response()->json([
            'success' => true,
            'data' => $evaluations
        ]);
    }

    /**
     * Create new evaluation
     * Route: POST /api/mentor/evaluations OR /api/admin/evaluations
     */
    public function store(Request $request)
    {
        $request->validate([
            // Accept either legacy `user_id` or preferred `id_mahasiswa` (profile FK)
            'user_id' => 'required_without:id_mahasiswa|exists:users,user_id',
            'id_mahasiswa' => 'required_without:user_id|exists:students,id_mahasiswa',
            // Dynamic components (flexible)
            'components' => 'nullable|array',
            'components.*.komponen_id' => 'required_with:components|exists:evaluation_components,id',
            'components.*.score' => 'required_with:components|numeric|min:0|max:100',
            // Other fields
            'periode' => 'nullable|string|max:255',
            'status' => 'nullable|in:draft,final',
            'mentor_notes' => 'nullable|string',
            'evaluation_date' => 'nullable|date',
        ]);

        $user = $request->user();

        // Resolve target user ID: accept either `user_id` (legacy) or `id_mahasiswa` (preferred)
        $targetUserId = $request->input('user_id');
        if (!$targetUserId && $request->filled('id_mahasiswa')) {
            $targetUserId = \App\Models\TblMahasiswa::where('id_mahasiswa', $request->id_mahasiswa)->value('user_id');
            if (!$targetUserId) {
                return response()->json(['success' => false, 'message' => 'id_mahasiswa tidak valid'], 422);
            }
        }

        // Verify mentor has access to this intern
        if ($user->isMentor() && !$user->isAdmin()) {
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
            if (!in_array($targetUserId, $internIds)) {
                return response()->json([
                    'success' => false,
                    'message' => 'You are not authorized to evaluate this intern'
                ], 403);
            }
        }

        // Auto-generate periode from evaluation_date if not provided
        $periode = $request->periode;
        $evaluationDate = $request->evaluation_date ?? now()->toDateString();
        
        if (!$periode) {
            $date = \Carbon\Carbon::parse($evaluationDate);
            $periode = $date->locale('id')->isoFormat('MMMM YYYY');
        }

        $evaluation = Evaluation::create([
            'user_id' => $targetUserId,
            'intern_mahasiswa_id' => $request->id_mahasiswa ?? \App\Models\TblMahasiswa::where('user_id', $targetUserId)->value('id_mahasiswa'),
            'mentor_id' => $user->user_id,
            'mentor_karyawan_id' => $user->karyawan?->id_karyawan ?? null,
            // Other fields
            'periode' => $periode,
            'status' => $request->status ?? 'draft',
            'mentor_notes' => $request->mentor_notes,
            'evaluation_date' => $evaluationDate,
        ]);

        // Add components (dynamic)
        if ($request->has('components') && is_array($request->components)) {
            $componentsToInsert = [];
            foreach ($request->components as $component) {
                $komponen = \App\Models\EvaluationComponentMaster::find($component['komponen_id']);
                if ($komponen) {
                    $componentsToInsert[] = [
                        'id_evaluation' => $evaluation->id_evaluation,
                        'komponen_id' => $component['komponen_id'],
                        'nama_komponen' => $komponen->nama_komponen, // SNAPSHOT
                        'score' => $component['score'],
                        'created_at' => now(),
                        'updated_at' => now(),
                    ];
                } else {
                    \Log::warning("Komponen not found: {$component['komponen_id']}");
                }
            }
            if (!empty($componentsToInsert)) {
                try {
                    \App\Models\EvaluationComponent::insert($componentsToInsert);
                    
                    // Persist final scores to database for indexing/reporting
                    $scores = array_column($componentsToInsert, 'score');
                    if (!empty($scores)) {
                        $avg = array_sum($scores) / count($scores);
                        $evaluation->final_score_numeric = round($avg, 2);
                        $evaluation->final_score_letter = Evaluation::scoreToLetter($evaluation->final_score_numeric);
                        $evaluation->save();
                    }
                } catch (\Exception $e) {
                    \Log::error("Failed to insert components: " . $e->getMessage());
                }
            }
        }

        $evaluation->load(['user:user_id,nama', 'user.mahasiswa:user_id,nim', 'mentor:user_id,nama', 'mentor.mahasiswa:user_id,nim', 'components']);

        if ($evaluation->status === 'final') {
            // Notifikasi ke Intern (Evaluasi Selesai)
            $intern = User::find($evaluation->user_id);
            if ($intern) {
                $intern->notify(new GeneralNotification(
                    'Evaluasi Akhir Tersedia',
                    "Mentor telah menyelesaikan evaluasi magang Anda untuk periode {$evaluation->periode}.",
                    "/intern/evaluations",
                    "success",
                    "intern"
                ));
            }

            // Notifikasi ke Admin (Butuh Review)
            $admins = User::active()->withRole('admin')->get();
            foreach ($admins as $adminUser) {
                if ($adminUser) {
                    $adminUser->notify(new GeneralNotification(
                        'Review Evaluasi Menunggu',
                        "Mentor {$user->nama} telah merilis evaluasi final untuk intern {$evaluation->user->nama} dan membutuhkan review Admin.",
                        "/admin/evaluations",
                        "warning",
                        "admin"
                    ));
                }
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Evaluation created successfully',
            'data' => $evaluation
        ], 201);
    }

    /**
     * Show evaluation detail
     * Route: GET /api/mentor/evaluations/{id} OR /api/admin/evaluations/{id}
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        $evaluation = Evaluation::with([
            'user:user_id,nama',
            'user.mahasiswa:user_id,nim',            
            'user.mahasiswa:id_mahasiswa,job_position,division,universitas,jurusan,jenjang_pendidikan,mulai_magang,akhir_magang,user_id',
            'mentor:user_id,nama',
            'components' // ← TAMBAH INI
        ])->find($id);

        if (!$evaluation) {
            return response()->json([
                'success' => false,
                'message' => 'Evaluation not found'
            ], 404);
        }

        // Authorization check
        if ($user->isMentor() && !$user->isAdmin()) {
            if ($evaluation->mentor_id !== $user->user_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 403);
            }
        }

        return response()->json([
            'success' => true,
            'data' => $evaluation
        ]);
    }

    /**
     * Update evaluation
     * Route: PUT /api/mentor/evaluations/{id} OR /api/admin/evaluations/{id}
     */
    public function update(Request $request, $id)
    {
        $evaluation = Evaluation::find($id);

        if (!$evaluation) {
            return response()->json([
                'success' => false,
                'message' => 'Evaluation not found'
            ], 404);
        }

        $user = $request->user();

        // Authorization check
        if ($user->isMentor() && !$user->isAdmin()) {
            if ($evaluation->mentor_id !== $user->user_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 403);
            }
        }

        // Status final tidak boleh di-edit
        if ($evaluation->status === 'final' && !$user->isAdmin()) {
            return response()->json([
                'success' => false,
                'message' => 'Evaluasi yang sudah final tidak bisa diedit'
            ], 422);
        }

        $request->validate([
            // Dynamic components
            'components' => 'nullable|array',
            'components.*.komponen_id' => 'required_with:components|exists:evaluation_components,id',
            'components.*.score' => 'required_with:components|numeric|min:0|max:100',
            // Other fields
            'periode' => 'nullable|string|max:255',
            'status' => 'nullable|in:draft,final',
            'mentor_notes' => 'nullable|string',
            'evaluation_date' => 'nullable|date',
        ]);

        // Update basic fields
        $evaluation->update($request->only([
            'periode',
            'status',
            'mentor_notes',
            'evaluation_date',
        ]));

        // Update components if provided
        if ($request->has('components') && is_array($request->components)) {
            // Delete old components
            \App\Models\EvaluationComponent::where('id_evaluation', $evaluation->id_evaluation)->delete();
            
            // Insert new components
            $componentsToInsert = [];
            foreach ($request->components as $component) {
                $komponen = \App\Models\EvaluationComponentMaster::find($component['komponen_id']);
                if ($komponen) {
                    $componentsToInsert[] = [
                        'id_evaluation' => $evaluation->id_evaluation,
                        'komponen_id' => $component['komponen_id'],
                        'nama_komponen' => $komponen->nama_komponen, // SNAPSHOT
                        'score' => $component['score'],
                    ];
                }
            }
            if (!empty($componentsToInsert)) {
                \App\Models\EvaluationComponent::insert($componentsToInsert);
                
                // Persist final scores to database for indexing/reporting
                $scores = array_column($componentsToInsert, 'score');
                if (!empty($scores)) {
                    $avg = array_sum($scores) / count($scores);
                    $evaluation->final_score_numeric = round($avg, 2);
                    $evaluation->final_score_letter = Evaluation::scoreToLetter($evaluation->final_score_numeric);
                    $evaluation->save();
                }
            }
        }

        $evaluation->load(['user:user_id,nama', 'user.mahasiswa:user_id,nim', 'mentor:user_id,nama', 'mentor.mahasiswa:user_id,nim', 'components']);

        // Jika berubah menjadi final via update
        if ($evaluation->wasChanged('status') && $evaluation->status === 'final') {
            // Notifikasi ke Intern (Evaluasi Selesai)
            $intern = User::find($evaluation->user_id);
            if ($intern) {
                $intern->notify(new GeneralNotification(
                    'Evaluasi Akhir Tersedia',
                    "Mentor telah menyelesaikan evaluasi magang Anda untuk periode {$evaluation->periode}.",
                    "/intern/evaluations",
                    "success",
                    "intern"
                ));
            }

            // Notifikasi ke Admin (Butuh Review)
            $admins = User::active()->withRole('admin')->get();
            foreach ($admins as $adminUser) {
                if ($adminUser) {
                    $adminUser->notify(new GeneralNotification(
                        'Review Evaluasi Menunggu',
                        "Mentor {$user->nama} telah merilis evaluasi final untuk intern {$evaluation->user->nama} dan membutuhkan review Admin.",
                        "/admin/evaluations",
                        "warning",
                        "admin"
                    ));
                }
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Evaluation updated successfully',
            'data' => $evaluation
        ]);
    }

    /**
     * Delete evaluation
     * Route: DELETE /api/mentor/evaluations/{id} OR /api/admin/evaluations/{id}
     */
    public function destroy(Request $request, $id)
    {
        $evaluation = Evaluation::find($id);

        if (!$evaluation) {
            return response()->json([
                'success' => false,
                'message' => 'Evaluation not found'
            ], 404);
        }

        $user = $request->user();

        // Authorization check
        if ($user->isMentor() && !$user->isAdmin()) {
            if ($evaluation->mentor_id !== $user->user_id) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 403);
            }
        }

        $evaluation->delete();

        return response()->json([
            'success' => true,
            'message' => 'Evaluation deleted successfully'
        ]);
    }

    public function getKomponenPenilaian()
    {
        $komponen = \App\Models\EvaluationComponentMaster::all();

        return response()->json([
            'success' => true,
            'data' => $komponen
        ]);
    }
}
