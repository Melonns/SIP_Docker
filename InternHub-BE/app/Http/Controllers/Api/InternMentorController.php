<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\InternMentor;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Carbon\Carbon;

class InternMentorController extends Controller
{
    /**
     * Trigger employee synchronization command.
     * Endpoint: POST /admin/intern-mentor/sync-employees
     */
    public function syncEmployees(Request $request)
    {
        try {
            // Trigger command synchronously (simple and deterministic for current BE setup)
            $exitCode = Artisan::call('sync:employees');

            if ($exitCode !== 0) {
                return response()->json([
                    'success' => false,
                    'message' => 'Failed to sync employees.',
                    'artisan_output' => Artisan::output()
                ], 500);
            }

            return response()->json([
                'success' => true,
                'message' => 'Employee sync has been triggered successfully.'
            ], 200);
        } catch (\Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to sync employees.',
                'error_message' => $e->getMessage(),
                'error_line' => $e->getLine(),
                'error_file' => $e->getFile()
            ], 500);
        }
    }

    /**
     * Get list of mentors with assigned interns count and details (for Mapping UI)
     * Supports optional `include_unregistered=1` to return karyawan (employees)
     * records that don't yet have a corresponding `users` row.
     */
    public function getMentorsList(Request $request)
    {
        // Get ALL employees as mentors, since users are only created upon first login
        $query = \App\Models\TblKaryawan::query()
            ->with(['site', 'user', 'divisionModel'])
            ->withCount(['mentorMappings as interns_count' => function($q) {
                // To accurately count assigned interns we must consider the modern relations as well 
                // but since TblKaryawan relates to mentor_id on intern_mentors, we just count those active entries.
                // However, to cover edgecase where user_id is assigned but mentor_id is not, use logical grouping:
                $q->where(function($query) {
                    $query->whereColumn('intern_mentors.mentor_id', 'employees.id_karyawan')
                          ->orWhereColumn('intern_mentors.mentor_user_id', 'employees.user_id');
                })->where('intern_mentors.is_active', true);
            }])
            ->orderBy('interns_count', 'desc')
            ->orderBy('nama', 'asc');

        // Search by name or NIP
        if ($request->has('q')) {
            $search = $request->q;
            $query->where(function ($q) use ($search) {
                $q->where('nama', 'like', "%{$search}%")
                  ->orWhere('nip', 'like', "%{$search}%");
            });
        }

        $karyawans = $query->paginate($request->per_page ?? 10);

        // Map the results to structurally match the old User-based response
        $transformedMentors = collect($karyawans->items())->map(function ($karyawan) {
            $mentor = $karyawan->user ?? new \App\Models\User();
            
            // Set user_id. If missing, provide a pseudo ID so frontend table keys don't duplicate
            $mentor->user_id = $karyawan->user_id ?? ('profile_' . $karyawan->id_karyawan);
            $mentor->nama = $karyawan->nama;
            $mentor->email = $karyawan->email;
            $mentor->status = $karyawan->status ?? 'active';
            
            // Reconstruct the nested 'karyawan' object
            $clonedKaryawan = clone $karyawan;
            $clonedKaryawan->unsetRelation('user'); // prevent circular reference
            $mentor->setRelation('karyawan', $clonedKaryawan);
            
            // Add flattened properties expected by frontend
            $mentor->division = $karyawan->divisionModel?->name ?? $karyawan->division;
            $mentor->site = $karyawan->site;
            $mentor->interns_count = $karyawan->interns_count;

            return $mentor;
        });
        $karyawans->setCollection($transformedMentors);

        // Optionally include unregistered (empty since all employees are now in the main list)
        $unregistered = null;

        $payload = ['mentors' => $karyawans];
        if ($request->boolean('include_unregistered')) {
            // Provide an empty array for backward compatibility if frontend expects it
            $payload['unregistered'] = [];
        }

        return response()->json([
            'success' => true,
            'data' => $payload
        ]);
    }

    /**
     * Get list of interns who are not assigned to any mentor
     */
    public function getUnassignedInterns(Request $request)
    {
        $query = User::whereHas('roles', function ($q) {
            $q->where('name', 'intern');
        })
        ->whereDoesntHave('internMentorMappings') // Uses the defined bridge relationship
        ->with(['mahasiswa.site', 'mahasiswa.divisionModel', 'mahasiswa:id_mahasiswa,user_id,division,division_id,id_site,job_position,universitas,mulai_magang,akhir_magang']);

        // Search by name, identifier (NIM), or email
        if ($request->filled('q')) {
            $search = $request->q;
            $query->where(function ($q) use ($search) {
                $q->where('nama', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhereExists(function($sub) use ($search) {
                      $sub->select(\Illuminate\Support\Facades\DB::raw('1'))
                          ->from('students')
                          ->whereRaw("students.user_id = users.user_id AND (students.nim LIKE ? OR students.nama LIKE ? OR students.email LIKE ?)", ["%{$search}%", "%{$search}%", "%{$search}%"]);
                  });
            });
        }
        
        // Filter by site
        if ($request->filled('id_site')) {
            $siteId = intval($request->id_site);
            $query->whereHas('mahasiswa', function($q) use ($siteId) {
                $q->where('id_site', $siteId);
            });
        }

        // Filter by Internship Period (Period of internship must OVERLAP with requested date range)
        // Overlap logic: intern_start <= filter_end AND intern_end >= filter_start
        if ($request->filled('start_date')) {
            $filterStart = $request->start_date;
            // If end_date provided, use it. Otherwise, treat start_date as a single-point-in-time check.
            $filterEnd = $request->filled('end_date') ? $request->end_date : $filterStart;

            $query->whereHas('mahasiswa', function($q) use ($filterStart, $filterEnd) {
                $q->where('mulai_magang', '<=', $filterEnd)
                  ->where('akhir_magang', '>=', $filterStart);
            });
        }

        // Filter by Division
        if ($request->filled('division')) {
            $division = $request->division;
            $query->whereHas('mahasiswa', function($q) use ($division) {
                $q->where('division', $division)
                  ->orWhere('division_id', $division);
            });
        }

        $interns = $query->paginate($request->per_page ?? 20);

        // Add mahasiswa fields to response
        foreach ($interns as $intern) {
            if ($intern->mahasiswa) {
                $m = $intern->mahasiswa;
                $intern->universitas = $m->universitas;
                $intern->division = $m->division;
                $intern->job_position = $m->job_position;
                $intern->periode = $m->mulai_magang && $m->akhir_magang 
                    ? $m->mulai_magang . ' - ' . $m->akhir_magang 
                    : null;
            } else {
                $intern->universitas = null;
                $intern->division = null;
                $intern->job_position = null;
                $intern->periode = null;
            }
        }

        return response()->json([
            'success' => true,
            'data' => $interns
        ]);
    }

    /**
     * Get mapping intern-mentor
     * Replaces UserController::getInternMentorMapping
     */
    public function getInternMentorMapping(Request $request)
    {
        $query = InternMentor::with([
            // keep legacy relations for backward compatibility
            'internUser.roles',
            'mentorUser.roles',
            'intern',
            'mentor',
            // prefer profile relations when available
            'internMahasiswa:id_mahasiswa,user_id,division,job_position,universitas,mulai_magang,akhir_magang,nim,nama',
            'mentorKaryawan:id_karyawan,user_id,nip,nama,email,division,job_position'
        ]);

        // Default: filter active only, unless specified otherwise
        if ($request->has('is_active')) {
            $status = $request->input('is_active');
            if ($status !== 'all') {
                $query->where('is_active', filter_var($status, FILTER_VALIDATE_BOOLEAN));
            }
        } else {
            // Default active only
            $query->where('is_active', true);
        }

        // Filter by mentor
        if ($request->has('mentor_id')) {
            $query->where('mentor_id', $request->mentor_id);
        }

        // Filter by intern
        if ($request->has('intern_id')) {
            $query->where('intern_id', $request->intern_id);
        }

        $mappings = $query->paginate($request->per_page ?? 20);
        $perPage = $request->per_page ?? 20;

        // Format response to include mahasiswa data at top level
        $formatted = [];
        foreach ($mappings->items() as $mapping) {
            $internUserId = $mapping->internMahasiswa?->user_id ?? $mapping->internUser?->user_id ?? null;
            $internName = $mapping->internMahasiswa?->nama ?? $mapping->internUser?->nama ?? null;

            $internData = [
                'user_id' => $internUserId,
                'id_mahasiswa' => $mapping->internMahasiswa?->id_mahasiswa ?? null,
                'nama' => $internName,
                'email' => $mapping->internUser?->email ?? null,
                'no_telp' => $mapping->internUser?->no_telp ?? null,
                'status' => $mapping->internUser?->status ?? null,
            ];

            // Add mahasiswa profile fields if present
            if ($mapping->internMahasiswa) {
                $m = $mapping->internMahasiswa;
                $internData['identifier'] = $m->nim ?? null;
                $internData['division'] = $m->division;
                $internData['job_position'] = $m->job_position;
                $internData['universitas'] = $m->universitas;
                $internData['periode'] = $m->mulai_magang && $m->akhir_magang 
                    ? $m->mulai_magang . ' - ' . $m->akhir_magang 
                    : null;
            } else {
                $internData['identifier'] = $mapping->internUser?->identifier ?? null;
                $internData['division'] = null;
                $internData['job_position'] = null;
                $internData['universitas'] = null;
                $internData['periode'] = null;
            }

            // Mentor: prefer karyawan profile when available (may not have user linked)
            if ($mapping->mentorKaryawan) {
                $k = $mapping->mentorKaryawan;
                $mentorPayload = [
                    'karyawan_id' => $k->id_karyawan,
                    'id_karyawan' => $k->id_karyawan,
                    'nip' => $k->nip,
                    'nama' => $k->nama,
                    'email' => $k->email ?? ($mapping->mentorUser?->email ?? null),
                    'user_id' => $k->user_id ?? $mapping->mentorUser?->user_id ?? null,
                ];
            } else {
                $mentorPayload = [
                    'user_id' => $mapping->mentorUser?->user_id ?? null,
                    'id_karyawan' => null,
                    'nama' => $mapping->mentorUser?->nama ?? null,
                    'email' => $mapping->mentorUser?->email ?? null,
                ];
            }

            $formatted[] = [
                'id' => $mapping->id,
                'intern' => $internData,
                'mentor' => $mentorPayload,
                'assigned_date' => $mapping->assigned_date,
                'end_date' => $mapping->end_date,
                'is_active' => $mapping->is_active,
                // Effective active: only true if mapping is active AND intern user status is 'active'
                'mapping_effective_active' => ($mapping->is_active && strtolower($mapping->internUser?->status ?? 'active') === 'active'),
                // Friendly label for UI styling based on effective active state
                'mapping_active_label' => ($mapping->is_active && strtolower($mapping->internUser?->status ?? 'active') === 'active') ? 'Active' : 'Inactive',
            ];
        }

        // Return paginated response with formatted data
        return response()->json([
            'success' => true,
            'data' => [
                'data' => $formatted,
                'current_page' => $mappings->currentPage(),
                'per_page' => $perPage,
                'total' => $mappings->total(),
                'last_page' => $mappings->lastPage(),
                'from' => $mappings->firstItem(),
                'to' => $mappings->lastItem(),
                'next_page_url' => $mappings->nextPageUrl(),
                'prev_page_url' => $mappings->previousPageUrl(),
            ]
        ]);
    }

    /**
     * Assign intern ke mentor
     * Replaces UserController::assignInternToMentor
     */
    public function assignInternToMentor(Request $request)
    {
        // Accept either user_id OR profile identifiers (nim / nip).
        // Accept either profile identifiers (nim/nip) or IDs (user_id or pseudo profile_{id}).
        $request->validate([
            'intern_id' => 'sometimes', // allow string or integer pseudo IDs
            'intern_nim' => 'sometimes|string',
            'mentor_id' => 'sometimes', // allow string or integer pseudo IDs
            'mentor_nip' => 'sometimes|string',
            'assigned_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:assigned_date',
        ]);

        // Resolve intern: prefer intern_nim -> mahasiswa -> user_id, else use intern_id
        $internUserId = null;
        $internMahasiswaId = null;
        if ($request->filled('intern_nim')) {
            $m = \App\Models\TblMahasiswa::where('nim', $request->intern_nim)->first();
            if (! $m) {
                return response()->json(['success' => false, 'message' => 'NIM intern tidak ditemukan'], 404);
            }
            $internMahasiswaId = $m->id_mahasiswa;
            $internUserId = $m->user_id ?? null; // may be null if user not provisioned
        } elseif ($request->filled('intern_id')) {
            $internIdInput = $request->intern_id;
            if (is_string($internIdInput) && str_starts_with($internIdInput, 'profile_')) {
                $m = \App\Models\TblMahasiswa::where('id_mahasiswa', str_replace('profile_', '', $internIdInput))->first();
            } else {
                // Focus strictly on id_mahasiswa
                $m = \App\Models\TblMahasiswa::where('id_mahasiswa', $internIdInput)->first();
            }
            $internMahasiswaId = $m?->id_mahasiswa;
            $internUserId = $m?->user_id ?? null;
        } else {
            return response()->json(['success' => false, 'message' => 'intern_id atau intern_nim wajib disediakan'], 400);
        }

        // Resolve mentor: prefer mentor_nip -> karyawan -> user_id, else use mentor_id
        $mentorUserId = null;
        $mentorKaryawanId = null;
        if ($request->filled('mentor_nip')) {
            $k = \App\Models\TblKaryawan::where('nip', $request->mentor_nip)->first();
            if (! $k) {
                return response()->json(['success' => false, 'message' => 'NIP mentor tidak ditemukan'], 404);
            }
            $mentorKaryawanId = $k->id_karyawan;
            $mentorUserId = $k->user_id ?? null; // may be null if user not provisioned
        } elseif ($request->filled('mentor_id')) {
            $mentorIdInput = $request->mentor_id;
            if (is_string($mentorIdInput) && str_starts_with($mentorIdInput, 'profile_')) {
                $k = \App\Models\TblKaryawan::where('id_karyawan', str_replace('profile_', '', $mentorIdInput))->first();
            } else {
                // Focus strictly on id_karyawan
                $k = \App\Models\TblKaryawan::where('id_karyawan', $mentorIdInput)->first();
            }
            $mentorKaryawanId = $k?->id_karyawan;
            $mentorUserId = $k?->user_id ?? null;
        } else {
            return response()->json(['success' => false, 'message' => 'mentor_id atau mentor_nip wajib disediakan'], 400);
        }

        // Delete any existing active mapping for this intern (by profile ID)
        InternMentor::where('intern_id', $internMahasiswaId)
            ->where('is_active', true)
            ->delete();

        // Create mapping — intern_id and mentor_id now store profile-primary-keys (id_mahasiswa/id_karyawan)
        $mapping = InternMentor::create([
            'intern_id' => $internMahasiswaId,
            'mentor_id' => $mentorKaryawanId,
            'intern_user_id' => $internUserId,
            'mentor_user_id' => $mentorUserId,
            'assigned_date' => $request->assigned_date ?? Carbon::now()->toDateString(),
            'end_date' => $request->end_date,
            'is_active' => true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Intern berhasil di-assign ke mentor',
            'data' => $mapping->load(['internMahasiswa', 'mentorKaryawan', 'intern', 'mentor'])
        ], 201);
    }

    /**
     * Update mapping intern-mentor
     * Replaces UserController::updateInternMentorMapping
     */
    public function updateInternMentorMapping(Request $request, $id)
    {
        $mapping = InternMentor::find($id);

        if (!$mapping) {
            return response()->json([
                'success' => false,
                'message' => 'Mapping tidak ditemukan'
            ], 404);
        }

        $request->validate([
            'end_date' => 'nullable|date',
            'is_active' => 'nullable|boolean',
        ]);

        // If activating this mapping, delete any other active mappings for the intern
        if ($request->filled('is_active') && $request->is_active) {
            InternMentor::where('intern_id', $mapping->intern_id)
                ->where('is_active', true)
                ->where('id', '!=', $mapping->id)
                ->delete();
        }

        // If setting inactive and end_date not provided, set end_date to today
        if ($request->filled('is_active') && !$request->is_active && !$request->filled('end_date')) {
            $mapping->end_date = Carbon::now()->toDateString();
        }

        $mapping->update($request->only(['end_date', 'is_active']));

        return response()->json([
            'success' => true,
            'message' => 'Mapping berhasil diperbarui',
            'data' => $mapping->load(['intern', 'mentor'])
        ]);
    }

    /**
     * Remove mapping (set inactive)
     * Replaces UserController::removeInternMentorMapping
     */
    public function removeInternMentorMapping($id)
    {
        $mapping = InternMentor::find($id);

        if (!$mapping) {
            return response()->json([
                'success' => false,
                'message' => 'Mapping tidak ditemukan'
            ], 404);
        }

        $mapping->delete();

        return response()->json([
            'success' => true,
            'message' => 'Mapping berhasil dihapus'
        ]);
    }

    /**
     * Export Intern-Mentor Mapping to PDF
     */
    public function exportPdf(Request $request)
    {
        $query = InternMentor::with(['internUser.roles', 'mentorUser.roles', 'intern', 'mentor']);

        // Default: filter active only, unless specified otherwise
        if ($request->has('is_active')) {
            $status = $request->input('is_active');
            if ($status !== 'all') {
                $query->where('is_active', filter_var($status, FILTER_VALIDATE_BOOLEAN));
            }
        } else {
            // Default active only
            $query->where('is_active', true);
        }

        // Filter by mentor
        if ($request->has('mentor_id')) {
            $query->where('mentor_id', $request->mentor_id);
        }

        // Filter by intern
        if ($request->has('intern_id')) {
            $query->where('intern_id', $request->intern_id);
        }

        $data = $query->get();

        $pdf = \Barryvdh\DomPDF\Facade\Pdf::loadView('exports.intern_mentors_pdf', ['data' => $data]);
        return $pdf->download('daftar_intern_mentors_' . now()->format('YmdHis') . '.pdf');
    }

}