<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Pagination\LengthAwarePaginator;
use Barryvdh\DomPDF\Facade\Pdf;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PhpOffice\PhpSpreadsheet\Worksheet\Drawing;
use PhpOffice\PhpSpreadsheet\Style\Color;
use App\Models\Logbook;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;

class ReportController extends Controller
{
    public function exportAttendance(Request $request)
    {
        $user = $request->user();

        // Pastikan user adalah mentor atau admin
        if (!$user->isMentor() && !$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Ambil interns (jika admin dari route admin semua intern, jika dari route mentor hanya bimbingannya)
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
            $mentorInternIds = array_unique(array_filter(array_merge($direct, $viaStudents)));
            $internQuery = User::whereIn('users.user_id', $mentorInternIds);
        } else {
            $internQuery = $user->isAdmin() 
                ? User::whereHas('roles', fn($q) => $q->where('name', 'intern'))
                : $user->interns();
        }
        
        $internIds = $internQuery->pluck('users.user_id')->toArray();

        // Filter berdasarkan date range jika disediakan
        $startDate = $request->input('start_date', Carbon::now()->startOfMonth()->toDateString());
        $endDate = $request->input('end_date', Carbon::now()->endOfMonth()->toDateString());

        // Filter tambahan
        $universitas = $request->input('universitas'); // array atau string
        $internId = $request->input('intern_id'); // specific intern

        // Filter berdasarkan mentor jika disediakan (Admin)
        $mentorIdFilter = $request->input('mentor_id');
        if ($user->isAdmin() && $mentorIdFilter) {
            $mentorKaryawanId = null;
            $mentorUser = \App\Models\User::find($mentorIdFilter);
            if ($mentorUser && $mentorUser->karyawan) {
                $mentorKaryawanId = $mentorUser->karyawan->id_karyawan;
            } elseif (\App\Models\TblKaryawan::where('id_karyawan', $mentorIdFilter)->exists()) {
                $mentorKaryawanId = intval($mentorIdFilter);
            }

            $internQueryFilteredByMentor = User::whereHas('mahasiswa.internMentors', function($q) use ($mentorKaryawanId, $mentorIdFilter) {
                $q->where('is_active', true)
                  ->where(function($sub) use ($mentorKaryawanId, $mentorIdFilter) {
                      if ($mentorKaryawanId) {
                          $sub->where('mentor_id', $mentorKaryawanId)
                              ->orWhere('mentor_user_id', $mentorIdFilter);
                      } else {
                          $sub->where('mentor_user_id', $mentorIdFilter)
                              ->orWhere('mentor_id', $mentorIdFilter);
                      }
                  });
            });
            $internIds = array_intersect($internIds, $internQueryFilteredByMentor->pluck('users.user_id')->toArray());
        }

        // Fetch all relevant data to build the report in PHP (more flexible than raw SQL for multiple types)
        $interns = User::whereIn('users.user_id', $internIds);
        // Eager-load mahasiswa so we can access mulai_magang / akhir_magang safely
        $interns->with('mahasiswa');
        if ($universitas) {
            if (is_array($universitas)) {
                $interns->whereHas('mahasiswa', fn($q) => $q->whereIn('universitas', $universitas));
            } else {
                $interns->whereHas('mahasiswa', fn($q) => $q->where('universitas', $universitas));
            }
        }
        if ($internId) {
            $resolved = \App\Models\TblMahasiswa::find($internId) ?? \App\Models\TblMahasiswa::where('user_id', $internId)->first();
            if ($resolved) {
                $interns->where('users.user_id', $resolved->user_id);
            } else {
                $interns->where('users.user_id', $internId);
            }
        }
        $internList = $interns->get();
        $internIds = $internList->pluck('user_id')->toArray();

        // 1. Fetch all attendance (masuk & pulang)
        $absensi = \App\Models\TblAbsensi::whereIn('user_id', $internIds)
            ->whereBetween('tanggal', [$startDate, $endDate])
            ->get()
            ->groupBy([
                'user_id', 
                function ($item) {
                    return \Carbon\Carbon::parse($item->tanggal)->format('Y-m-d');
                }
            ]);

        // 2. Fetch all approved leave (sakit/izin)
        // For izin: must have status_admin = 'approved'
        // For sakit: can have status_mentor = 'approved' OR status_admin = 'approved'
        $leaves = \App\Models\Izin::whereIn('user_id', $internIds)
            ->where(function($query) {
                // izin must be approved by admin, sakit can be approved by mentor or admin
                $query->where(function($q) {
                    $q->where('jenis_izin', 'izin')
                      ->where('status_admin', 'approved');
                })
                ->orWhere(function($q) {
                    $q->where('jenis_izin', 'sakit')
                      ->where(function($inner) {
                          $inner->where('status_mentor', 'approved')
                                ->orWhere('status_admin', 'approved');
                      });
                });
            })
            ->where(function($query) use ($startDate, $endDate) {
                // Date overlap check: leave period includes any part of the requested period
                $query->whereBetween('tanggal_mulai', [$startDate, $endDate])
                      ->orWhereBetween('tanggal_selesai', [$startDate, $endDate])
                      ->orWhere(function($q) use ($startDate, $endDate) {
                          $q->where('tanggal_mulai', '<=', $startDate)
                            ->where('tanggal_selesai', '>=', $endDate);
                      });
            })
            ->get()
            ->map(function($l) {
                $l->parsed_mulai = \Carbon\Carbon::parse($l->tanggal_mulai)->toDateString();
                $l->parsed_selesai = \Carbon\Carbon::parse($l->tanggal_selesai)->toDateString();
                return $l;
            })
            ->groupBy('user_id');

        // 3. Fetch approved corrections
        $corrections = \App\Models\KoreksiAbsensi::whereIn('user_id', $internIds)
            ->where(function($q){ $q->where('status', 'approved')->orWhere('status_admin', 'approved'); })
            ->whereBetween('tanggal', [$startDate, $endDate])
            ->get()
            ->groupBy([
                'user_id',
                function ($item) {
                    return \Carbon\Carbon::parse($item->tanggal)->format('Y-m-d');
                }
            ]);

        // 4. Fetch holidays (hari libur)
        $holidays = \App\Models\Libur::whereBetween('tanggal', [$startDate, $endDate])
            ->pluck('tanggal')
            ->map(function($date) {
                return \Carbon\Carbon::parse($date)->format('Y-m-d');
            })
            ->toArray();

        // 5. Build the final data array by iterating through interns and dates
        $data = [];
        $periodStart = Carbon::parse($startDate);
        $periodEnd = Carbon::parse($endDate);
        $today = Carbon::now();
        
        // Cap period end to today (don't show future data)
        if ($periodEnd->gt($today)) {
            $periodEnd = $today;
        }

        foreach ($internList as $intern) {
            // Cap per-intern period so we do not count absences after their internship ends
            $localStart = $periodStart->copy();
            $localEnd = $periodEnd->copy();

            if (!empty($intern->mahasiswa?->mulai_magang)) {
                $ms = \Carbon\Carbon::parse($intern->mahasiswa->mulai_magang)->startOfDay();
                if ($ms->gt($localStart)) $localStart = $ms;
            }
            if (!empty($intern->mahasiswa?->akhir_magang)) {
                $ae = \Carbon\Carbon::parse($intern->mahasiswa->akhir_magang)->endOfDay();
                if ($ae->lt($localEnd)) $localEnd = $ae;
            }

            // If the intern's period does not overlap the requested period, skip them
            if ($localStart->gt($localEnd)) {
                continue;
            }

            for ($date = $localStart->copy(); $date->lte($localEnd); $date->addDay()) {
                $dateStr = $date->toDateString();

                // Skip if it's a weekend (Saturday = 6, Sunday = 0)
                $dayOfWeek = $date->dayOfWeek;
                if ($dayOfWeek === 0 || $dayOfWeek === 6) {
                    continue;
                }

                // Skip if it's a holiday
                if (in_array($dateStr, $holidays)) {
                    continue;
                }
                
                // Check if there is attendance or leave for this day
                $userAbsensi = $absensi[$intern->user_id][$dateStr] ?? null;
                $userCorrection = $corrections[$intern->user_id][$dateStr] ?? null;
                
                // Find if there's an approved leave for this date
                // Prioritize "izin" over "sakit" if multiple leaves on same date
                $userLeaves = isset($leaves[$intern->user_id]) ? collect($leaves[$intern->user_id]) : collect();
                
                $matchingLeaves = $userLeaves->filter(function($l) use ($dateStr) {
                    return $dateStr >= $l->parsed_mulai && $dateStr <= $l->parsed_selesai;
                })->sort(function($a, $b) {
                    $aVal = ($a->jenis_izin === 'izin') ? 0 : 1;
                    $bVal = ($b->jenis_izin === 'izin') ? 0 : 1;
                    return $aVal <=> $bVal;
                });
                
                $activeLeave = $matchingLeaves->first();

                // Build notes
                $notes = [];
                if ($userCorrection) {
                    $notes[] = 'Koreksi: ' . $userCorrection->first()->alasan;
                }
                if ($activeLeave) {
                    $notes[] = ucfirst($activeLeave->jenis_izin) . ': ' . $activeLeave->keterangan;
                }

                $row = null;
                if ($userAbsensi) {
                    $masuk = $userAbsensi->where('status', 'masuk')->first();
                    $pulang = $userAbsensi->where('status', 'pulang')->first();
                    
                    if ($masuk) {
                        // Default status based on clock-in lateness
                        $status = ($masuk->lama_telat > 0) ? 'Late' : 'On Time';

                        // If not late by clock-in, check early departure (pulang before 17:00)
                        if (empty($masuk->lama_telat) || $masuk->lama_telat == 0) {
                            if ($pulang && !empty($pulang->waktu)) {
                                try {
                                    $pulangTime = \Carbon\Carbon::parse($pulang->waktu);
                                    if ($pulangTime->lt(\Carbon\Carbon::parse('17:00:00'))) {
                                        $status = 'Early';
                                    }
                                } catch (\Throwable $e) {
                                    // ignore parse errors and keep default status
                                }
                            }
                        }

                        $row = (object) [
                            'date' => $dateStr,
                            'name' => $intern->nama,
                            'jurusan' => $intern->mahasiswa->jurusan ?? null,
                            'univ' => $intern->mahasiswa->universitas ?? null,
                            'status' => $status,
                            'clock_in' => $masuk->waktu,
                            'clock_out' => $pulang ? $pulang->waktu : null,
                            'notes' => implode('; ', $notes) ?: null
                        ];
                    }
                }

                if (!$row && $activeLeave) {
                    // It's a leave day with no clock-in
                    // Map types: 'izin' -> 'On Leave', 'sakit' -> 'Sakit'
                    if (strtolower($activeLeave->jenis_izin) === 'izin') {
                        $leaveStatus = 'On Leave';
                    } else {
                        // Normalize 'sakit' -> 'Sick' for consistent English labels in reports
                        $jenis = strtolower($activeLeave->jenis_izin);
                        if ($jenis === 'sakit') {
                            $leaveStatus = 'Sick';
                        } else {
                            $leaveStatus = ucfirst($jenis);
                        }
                    }

                    $row = (object) [
                        'date' => $dateStr,
                        'name' => $intern->nama,
                        'jurusan' => $intern->mahasiswa->jurusan ?? null,
                        'univ' => $intern->mahasiswa->universitas ?? null,
                        'status' => $leaveStatus,
                        'clock_in' => null,
                        'clock_out' => null,
                        'notes' => $activeLeave->keterangan
                    ];
                }

                if (!$row) {
                    // No attendance record and no approved leave = Absent
                    $row = (object) [
                        'date' => $dateStr,
                        'name' => $intern->nama,
                        'jurusan' => $intern->mahasiswa->jurusan ?? null,
                        'univ' => $intern->mahasiswa->universitas ?? null,
                        'status' => 'Absent',
                        'clock_in' => null,
                        'clock_out' => null,
                        'notes' => null
                    ];
                }

                if ($row) {
                    $data[] = $row;
                }
            }
        }

        // Sort data by date and then by name
        usort($data, function($a, $b) {
            if ($a->date == $b->date) {
                return strcmp($a->name, $b->name);
            }
            return strcmp($a->date, $b->date);
        });

        // Cek jika preview
        // Gunakan boolean() agar query string "false" atau "0" diparse menjadi false
        $isPreview = $request->boolean('preview');

        if ($isPreview) {
            $perPage = (int) $request->input('per_page', 10);
            $page = (int) $request->input('page', 1);
            $paginator = new LengthAwarePaginator(
                array_slice($data, ($page - 1) * $perPage, $perPage),
                count($data),
                $perPage,
                $page,
                ['path' => $request->url(), 'pageName' => 'page']
            );
            return response()->json([
                'success' => true,
                'data' => $paginator->items(),
                'pagination' => [
                    'current_page' => $paginator->currentPage(),
                    'last_page' => $paginator->lastPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                    'from' => $paginator->firstItem(),
                    'to' => $paginator->lastItem(),
                ],
                'mentor' => $user->isAdmin() ? null : $user->nama,
                'period' => $startDate . ' to ' . $endDate
            ]);
        }

        // Sanitize data untuk PDF/CSV
        $data = array_map(function($row) {
            // Remove seconds from clock_in and clock_out (HH:MM:SS -> HH:MM)
            $clockIn = $row->clock_in ?? '';
            $clockOut = $row->clock_out ?? '';
            
            if ($clockIn && strlen($clockIn) >= 5) {
                $clockIn = substr($clockIn, 0, 5); // Get HH:MM only
            }
            if ($clockOut && strlen($clockOut) >= 5) {
                $clockOut = substr($clockOut, 0, 5); // Get HH:MM only
            }
            
            return (object) [
                'date' => $row->date ?? '',
                'name' => htmlspecialchars($row->name ?? '', ENT_QUOTES, 'UTF-8'),
                'jurusan' => $row->jurusan ?? '',
                'univ' => $row->univ ?? '',
                'status' => $row->status ?? '',
                'clock_in' => $clockIn,
                'clock_out' => $clockOut,
                'notes' => htmlspecialchars($row->notes ?? '', ENT_QUOTES, 'UTF-8'),
            ];
        }, $data);

        // Pilih format export (pdf atau excel/csv)
        $format = strtolower($request->input('format', $request->input('export', 'pdf')));

        if (in_array($format, ['csv'])) {
            // Generate CSV (compatible with Excel)
            $handle = fopen('php://temp', 'r+');
            // Header
            fputcsv($handle, ['Date', 'Name', 'Major', 'Institution', 'Status', 'Clock In', 'Clock Out', 'Notes']);
            foreach ($data as $row) {
                fputcsv($handle, [
                    $row->date,
                    html_entity_decode($row->name, ENT_QUOTES, 'UTF-8'),
                    $row->jurusan,
                    $row->univ,
                    $row->status,
                    $row->clock_in,
                    $row->clock_out,
                    html_entity_decode($row->notes, ENT_QUOTES, 'UTF-8'),
                ]);
            }
            rewind($handle);
            $csv = stream_get_contents($handle);
            fclose($handle);

            // Add BOM + CRLF for better Excel compatibility
            $csv = "\xEF\xBB\xBF" . preg_replace("~\R~u", "\r\n", $csv);

            $filename = 'attendance_report_' . $user->user_id . '.csv';

            return response($csv, 200, [
                'Content-Type' => 'text/csv; charset=utf-8',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                'Content-Length' => strlen($csv),
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0'
            ]);
        }

        if (in_array($format, ['excel', 'xlsx'])) {
            // Generate real XLSX using PhpSpreadsheet
            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Attendance');

            // Header
            $sheet->fromArray(['Date', 'Name', 'Major', 'Institution', 'Status', 'Clock In', 'Clock Out', 'Notes'], null, 'A1');

            $row = 2;
            foreach ($data as $r) {
                $sheet->setCellValue('A' . $row, $r->date);
                $sheet->setCellValue('B' . $row, html_entity_decode($r->name, ENT_QUOTES, 'UTF-8'));
                $sheet->setCellValue('C' . $row, $r->jurusan);
                $sheet->setCellValue('D' . $row, $r->univ);
                $sheet->setCellValue('E' . $row, $r->status);
                $sheet->setCellValue('F' . $row, $r->clock_in);
                $sheet->setCellValue('G' . $row, $r->clock_out);
                $sheet->setCellValue('H' . $row, html_entity_decode($r->notes, ENT_QUOTES, 'UTF-8'));
                
                // Highlight rows with Absent, Sakit, or Izin status with yellow background
                if (in_array($r->status, ['Absent', 'Sakit', 'Izin'])) {
                    $sheet->getStyle('A' . $row . ':H' . $row)->getFill()
                        ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                        ->setStartColor(new Color('FFFF00')); // Yellow
                }
                
                $row++;
            }

            $writer = new Xlsx($spreadsheet);
            $filename = 'attendance_report_' . $user->user_id . '.xlsx';

            // Capture output
            ob_start();
            $writer->save('php://output');
            $xlsxContent = ob_get_clean();

            return response($xlsxContent, 200, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                'Content-Length' => strlen($xlsxContent),
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0'
            ]);
        }

        // Generate PDF
        try {
            $pdf = Pdf::loadView('reports.attendance', [
                'data' => $data,
                'mentor' => $user->isAdmin() ? null : htmlspecialchars($user->nama ?? '', ENT_QUOTES, 'UTF-8'),
                'period' => $startDate . ' to ' . $endDate
            ]);
            $pdf->setPaper('a4', 'landscape');

            $pdfContent = $pdf->output();

            return response($pdfContent, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="attendance_report_' . $user->user_id . '.pdf"',
                'Content-Length' => strlen($pdfContent),
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate PDF: ' . $e->getMessage()
            ], 500);
        }
    }

    public function exportLogbook(Request $request)
    {
        $user = $request->user();

        if (!$user->isMentor() && !$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

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
            $mentorInternIds = array_unique(array_filter(array_merge($direct, $viaStudents)));
            $internQuery = User::whereIn('users.user_id', $mentorInternIds);
        } else {
            $internQuery = $user->isAdmin()
                ? User::whereHas('roles', fn($q) => $q->where('name', 'intern'))
                : $user->interns();
        }

        $internIds = $internQuery->pluck('users.user_id')->toArray();

        $startDate = $request->input('start_date', Carbon::now()->startOfMonth()->toDateString());
        $endDate = $request->input('end_date', Carbon::now()->endOfMonth()->toDateString());

        // Filter tambahan (sama seperti attendance)
        $universitas = $request->input('universitas'); // array atau string
        $internId = $request->input('intern_id'); // specific intern

        // Filter berdasarkan mentor jika disediakan (Admin)
        $mentorIdFilter = $request->input('mentor_id');
        if ($user->isAdmin() && $mentorIdFilter) {
            $mentorKaryawanId = null;
            $mentorUser = \App\Models\User::find($mentorIdFilter);
            if ($mentorUser && $mentorUser->karyawan) {
                $mentorKaryawanId = $mentorUser->karyawan->id_karyawan;
            } elseif (\App\Models\TblKaryawan::where('id_karyawan', $mentorIdFilter)->exists()) {
                $mentorKaryawanId = intval($mentorIdFilter);
            }

            $internQueryFilteredByMentor = User::whereHas('mahasiswa.internMentors', function($q) use ($mentorKaryawanId, $mentorIdFilter) {
                $q->where('is_active', true)
                  ->where(function($sub) use ($mentorKaryawanId, $mentorIdFilter) {
                      if ($mentorKaryawanId) {
                          $sub->where('mentor_id', $mentorKaryawanId)
                              ->orWhere('mentor_user_id', $mentorIdFilter);
                      } else {
                          $sub->where('mentor_user_id', $mentorIdFilter)
                              ->orWhere('mentor_id', $mentorIdFilter);
                      }
                  });
            });
            $internIds = array_intersect($internIds, $internQueryFilteredByMentor->pluck('users.user_id')->toArray());
        }

        // Raw query untuk logbooks
        // Handle empty internIds to avoid str_repeat error
        if (empty($internIds)) {
            $data = [];
        } else {
            // 1. Fetch mentor mappings in one fast query to avoid dependent subquery execution in SELECT
            $mentorMap = \DB::table('intern_mentors as im')
                ->join('students as s', 'im.intern_id', '=', 's.id_mahasiswa')
                ->join('employees as e', 'im.mentor_id', '=', 'e.id_karyawan')
                ->join('users as u', 'e.user_id', '=', 'u.user_id')
                ->whereIn('s.user_id', $internIds)
                ->where('im.is_active', 1)
                ->select('s.user_id', 'u.nama as mentor_name')
                ->get()
                ->pluck('mentor_name', 'user_id')
                ->toArray();

            $placeholders = str_repeat('?,', count($internIds) - 1) . '?';
            $data = DB::select("
                SELECT 
                    l.tanggal as date,
                    u.nama as name,
                    u.user_id,
                    m.id_mahasiswa as id_mahasiswa,
                    m.jurusan as jurusan,
                    m.universitas as univ,
                    m.division as division,
                    m.job_position as job_position,
                    l.deskripsi_kegiatan as activity,
                    l.status_verifikasi as status,
                    l.feedback,
                    l.bukti_kegiatan
                FROM logbooks l
                JOIN users u ON l.user_id = u.user_id
                LEFT JOIN students m ON u.user_id = m.user_id
                WHERE l.user_id IN ($placeholders) 
                  AND l.tanggal BETWEEN ? AND ?
                  AND l.status_verifikasi = 'verified'
                ORDER BY l.tanggal, l.user_id
            ", array_merge($internIds, [$startDate, $endDate]));

            // 2. Attach mentor_name in PHP memory (O(N) mapping, avoids thousands of DB subquery executions)
            foreach ($data as $row) {
                $row->mentor_name = $mentorMap[$row->user_id] ?? '-';
            }
        }

        // Cek jika preview
        // Gunakan boolean() agar query string "false" atau "0" diparse menjadi false
        $isPreview = $request->boolean('preview');

        if ($isPreview) {
            $perPage = (int) $request->input('per_page', 10);
            $page = (int) $request->input('page', 1);
            $paginator = new LengthAwarePaginator(
                array_slice($data, ($page - 1) * $perPage, $perPage),
                count($data),
                $perPage,
                $page,
                ['path' => $request->url(), 'pageName' => 'page']
            );
            return response()->json([
                'success' => true,
                'data' => $paginator->items(),
                'pagination' => [
                    'current_page' => $paginator->currentPage(),
                    'last_page' => $paginator->lastPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                    'from' => $paginator->firstItem(),
                    'to' => $paginator->lastItem(),
                ],
                'mentor' => $user->nama,
                'period' => $startDate . ' to ' . $endDate
            ]);
        }

        // Sanitize data untuk PDF
        $data = array_map(function($row) {
            // Parse bukti_kegiatan JSON
            $files = [];
            if (!empty($row->bukti_kegiatan)) {
                $decoded = json_decode($row->bukti_kegiatan, true);
                $files = is_array($decoded) ? $decoded : [];
            }
            
            // Function to prettify filename (trim leading timestamps/uuids)
            $prettify = function($path) {
                // Match the pattern used in LogbookController: time() . '_' . uniqid() . '_' . originalName
                // Example: 1625123456_60de4e4567890_my_image.png
                // We want to strip the first two segments.
                $filename = basename($path);
                
                // Pattern 1: digits_hex_originalName (Current)
                if (preg_match('/^\d+_[a-f0-9]+_(.+)$/i', $filename, $matches)) {
                    $filename = $matches[1];
                } 
                // Pattern 2: Old/Alternative patterns
                elseif (preg_match('/^\d+_[\w\d]+_\d+_(.+)$/', $filename, $matches)) {
                    $filename = $matches[1];
                }

                return ltrim($filename, '? ._');
            };

            // Map files to objects for easier access in view
            $fileObjects = array_map(function($path) use ($prettify) {
                return (object) [
                    'path' => $path,
                    'name' => $prettify($path)
                ];
            }, $files);

            return (object) [
                'date' => $row->date ?? '',
                'name' => htmlspecialchars($row->name ?? '', ENT_QUOTES, 'UTF-8'),
                'jurusan' => $row->jurusan ?? '',
                'univ' => $row->univ ?? '',
                'division' => $row->division ?? '',
                'job_position' => $row->job_position ?? '',
                'activity' => htmlspecialchars($row->activity ?? '', ENT_QUOTES, 'UTF-8'),
                'duration_hours' => $row->duration_hours ?? 0,
                'duration_minutes' => $row->duration_minutes ?? 0,
                'status' => $row->status ?? '',
                'feedback' => htmlspecialchars($row->feedback ?? '', ENT_QUOTES, 'UTF-8'),
                'mentor_name' => htmlspecialchars($row->mentor_name ?? '-', ENT_QUOTES, 'UTF-8'),
                'files' => $fileObjects,
                'files_display' => implode(', ', array_map(function($f) { return $f->name; }, $fileObjects)),
            ];
        }, $data);

        // Pilih format export (pdf, excel/csv, atau zip)
        $format = strtolower($request->input('format', $request->input('export', 'pdf')));

        // ZIP Export: Group by Intern -> PDF per Intern -> ZIP
        if ($format === 'zip') {
            $zip = new \ZipArchive;
            $zipFileName = 'logbooks_report_' . $user->user_id . '_' . time() . '.zip';
            $zipFilePath = storage_path('app/public/' . $zipFileName);

            if ($zip->open($zipFilePath, \ZipArchive::CREATE) === TRUE) {
                // Group data by user_id
                $groupedData = [];
                foreach ($data as $row) {
                    $groupedData[$row->user_id][] = $row;
                }

                foreach ($groupedData as $userId => $items) {
                    $internName = $items[0]->name ?? 'Unknown';
                    $safeName = Str::slug($internName);
                    
                    $pdf = Pdf::loadView('reports.logbook', [
                        'data' => $items,
                        'mentor' => $user->isAdmin() ? null : htmlspecialchars($user->nama ?? '', ENT_QUOTES, 'UTF-8'),
                        'period' => $startDate . ' to ' . $endDate
                    ]);
                    $pdf->setPaper('a4', 'landscape');
                    
                    $pdfContent = $pdf->output();
                    $zip->addFromString("Logbook_{$safeName}.pdf", $pdfContent);
                }
                
                $zip->close();
            }

            return response()->download($zipFilePath)->deleteFileAfterSend(true);
        }

        if (in_array($format, ['csv'])) {
            // Generate CSV for logbooks
            $handle = fopen('php://temp', 'r+');
            fputcsv($handle, ['Date', 'Name', 'Institution', 'Major', 'Division', 'Job Position', 'Activity', 'Status', 'Feedback', 'Mentor', 'Files']);
            foreach ($data as $row) {
                fputcsv($handle, [
                    $row->date,
                    html_entity_decode($row->name, ENT_QUOTES, 'UTF-8'),
                    $row->univ,
                    $row->jurusan,
                    $row->division,
                    $row->job_position,
                    html_entity_decode($row->activity, ENT_QUOTES, 'UTF-8'),
                    $row->status,
                    html_entity_decode($row->feedback, ENT_QUOTES, 'UTF-8'),
                    html_entity_decode($row->mentor_name, ENT_QUOTES, 'UTF-8'),
                    $row->files_display,
                ]);
            }
            rewind($handle);
            $csv = stream_get_contents($handle);
            fclose($handle);

            // BOM + CRLF
            $csv = "\xEF\xBB\xBF" . preg_replace("~\R~u", "\r\n", $csv);

            $filename = 'logbooks_report_' . $user->user_id . '.csv';

            return response($csv, 200, [
                'Content-Type' => 'text/csv; charset=utf-8',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                'Content-Length' => strlen($csv),
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0'
            ]);
        }

        if (in_array($format, ['excel', 'xlsx'])) {
            // Generate XLSX for logbooks
            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Logbook');
            $sheet->fromArray(['Date', 'Name', 'Institution', 'Major', 'Division', 'Job Position', 'Activity', 'Status', 'Feedback', 'Mentor', 'Files'], null, 'A1');

            $row = 2;
            foreach ($data as $r) {
                $sheet->setCellValue('A' . $row, $r->date);
                $sheet->setCellValue('B' . $row, html_entity_decode($r->name, ENT_QUOTES, 'UTF-8'));
                $sheet->setCellValue('C' . $row, $r->univ);
                $sheet->setCellValue('D' . $row, $r->jurusan);
                $sheet->setCellValue('E' . $row, $r->division);
                $sheet->setCellValue('F' . $row, $r->job_position);
                $sheet->setCellValue('G' . $row, html_entity_decode($r->activity, ENT_QUOTES, 'UTF-8'));
                $sheet->setCellValue('H' . $row, $r->status);
                $sheet->setCellValue('I' . $row, html_entity_decode($r->feedback, ENT_QUOTES, 'UTF-8'));
                $sheet->setCellValue('J' . $row, html_entity_decode($r->mentor_name, ENT_QUOTES, 'UTF-8'));
                
                // Handle files: embed images and list non-images as text
                if (!empty($r->files)) {
                    $nonImageNames = [];
                    $imgColOffset = 0;

                    foreach ($r->files as $file) {
                        $extension = strtolower(pathinfo($file->path, PATHINFO_EXTENSION));
                        $isImage = in_array($extension, ['jpg', 'jpeg', 'png', 'gif', 'webp']);
                        $fullPath = public_path($file->path);
                        
                        if ($isImage && file_exists($fullPath)) {
                            // Embed image in columns starting from M (index 12)
                            $drawing = new Drawing();
                            $drawing->setName($file->name);
                            $drawing->setDescription($file->name);
                            $drawing->setPath($fullPath);
                            $drawing->setHeight(80);
                            $drawing->setResizeProportional(true); // Maintain aspect ratio
                            $drawing->setCoordinates(\PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex(12 + $imgColOffset) . $row);
                            $drawing->setWorksheet($sheet);
                            
                            $imgColOffset++;
                        } else {
                            // Collect non-image filenames
                            $nonImageNames[] = $file->name;
                        }
                    }
                    
                    // Column M (index 12) for text-based filenames
                    $sheet->setCellValue('M' . $row, !empty($nonImageNames) ? implode(', ', $nonImageNames) : '-');

                    if ($imgColOffset > 0) {
                        $sheet->getRowDimension($row)->setRowHeight(90); // Increased height to fit 80px image + padding
                    }
                } else {
                    $sheet->setCellValue('K' . $row, '-');
                }
                
                $row++;
            }

            // Adjust column widths
            foreach (range('A', 'J') as $col) {
                $sheet->getColumnDimension($col)->setAutoSize(true);
            }
            // Set fixed width for image columns if needed, or let them be

            $writer = new Xlsx($spreadsheet);
            $filename = 'logbooks_report_' . $user->user_id . '.xlsx';

            ob_start();
            $writer->save('php://output');
            $xlsxContent = ob_get_clean();

            return response($xlsxContent, 200, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                'Content-Length' => strlen($xlsxContent),
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0'
            ]);
        }

        $pdf = Pdf::loadView('reports.logbook', [
            'data' => $data,
            'mentor' => $user->isAdmin() ? null : htmlspecialchars($user->nama ?? '', ENT_QUOTES, 'UTF-8'),
            'period' => $startDate . ' to ' . $endDate
        ]);

        $pdf->setPaper('a4', 'landscape');

        try {
            $pdfContent = $pdf->output();

            return response($pdfContent, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="logbooks_report_' . $user->user_id . '.pdf"',
                'Content-Length' => strlen($pdfContent),
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate PDF: ' . $e->getMessage()
            ], 500);
        }
    }

    public function exportAssignedInterns(Request $request)
    {
        $user = $request->user();

        if (!$user->isMentor() && !$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Get filter parameters
        $universitas = $request->input('universitas');
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');

        // Resolve acting context — same pattern used by exportAttendance / exportLogbook
        $activeRole = $request->query('active_role');
        $isMentorContext = ($activeRole === 'mentor') || ($request->segment(2) === 'mentor' && $user->isMentor());

        // Resolve intern IDs upfront — same proven approach as exportAttendance
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
            $internIds = array_values(array_unique(array_filter(array_merge($direct, $viaStudents))));
        } else {
            $internIds = User::whereHas('roles', fn($q) => $q->where('name', 'intern'))
                ->pluck('users.user_id')
                ->toArray();
        }

        // Debug mode
        if ($request->boolean('debug')) {
            return response()->json([
                'debug' => true,
                'user_id' => $user->user_id,
                'user_roles' => $user->getRoleNames(),
                'active_role' => $activeRole,
                'is_mentor_context' => $isMentorContext,
                'karyawan_id' => $user->karyawan?->id_karyawan,
                'intern_ids' => $internIds,
                'intern_count' => count($internIds),
            ]);
        }

        // Build query using resolved intern IDs
        if (empty($internIds)) {
            $data = [];
        } else {
            $query = User::whereIn('users.user_id', $internIds)
                ->join('students', 'users.user_id', '=', 'students.user_id')
                ->leftJoin('sites', 'students.id_site', '=', 'sites.id_site')
                ->select([
                    'users.nama as name',
                    'users.status',
                    'students.universitas as university',
                    'students.jurusan as major',
                    'students.division as division',
                    'students.mulai_magang as start_date',
                    'students.akhir_magang as end_date',
                    \DB::raw("COALESCE(sites.nama_site, 'Unknown') as site"),
                ]);

            // Date overlap filter
            if ($startDate && $endDate) {
                $query->where('students.mulai_magang', '<=', $endDate)
                      ->where(function($sub) use ($startDate) {
                          $sub->whereNull('students.akhir_magang')
                              ->orWhere('students.akhir_magang', '>=', $startDate);
                      });
            }

            // Universitas filter
            if ($universitas) {
                if (is_array($universitas)) {
                    $query->whereIn('students.universitas', $universitas);
                } else {
                    $query->where('students.universitas', $universitas);
                }
            }

            $data = $query->orderBy('users.nama')->get()->map(fn($r) => (object) $r->toArray())->all();
        }

        // Cek jika preview
        // Gunakan boolean() agar query string "false" atau "0" diparse menjadi false
        $isPreview = $request->boolean('preview');

        if ($isPreview) {
            $perPage = (int) $request->input('per_page', 10);
            $page = (int) $request->input('page', 1);
            $paginator = new LengthAwarePaginator(
                array_slice($data, ($page - 1) * $perPage, $perPage),
                count($data),
                $perPage,
                $page,
                ['path' => $request->url(), 'pageName' => 'page']
            );
            
            $response = [
                'success' => true,
                'data' => $paginator->items(),
                'pagination' => [
                    'current_page' => $paginator->currentPage(),
                    'last_page' => $paginator->lastPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                    'from' => $paginator->firstItem(),
                    'to' => $paginator->lastItem(),
                ],
                'mentor' => $user->nama,
            ];
            
            // Add period filter info if dates were provided
            if ($startDate && $endDate) {
                $response['period'] = $startDate . ' to ' . $endDate;
            }
            
            return response()->json($response);
        }

        // Sanitize data untuk PDF
        $data = array_map(function($row) {
            return (object) [
                'name' => htmlspecialchars($row->name ?? '', ENT_QUOTES, 'UTF-8'),
                'university' => htmlspecialchars($row->university ?? '', ENT_QUOTES, 'UTF-8'),
                'major' => htmlspecialchars($row->major ?? '', ENT_QUOTES, 'UTF-8'),
                'division' => htmlspecialchars($row->division ?? '', ENT_QUOTES, 'UTF-8'),
                'start_date' => $row->start_date ?? '',
                'end_date' => $row->end_date ?? '',
                'status' => $row->status ?? '',
                'site' => htmlspecialchars($row->site ?? '', ENT_QUOTES, 'UTF-8'),
            ];
        }, $data);

        // Support export pagination: jika client memberikan page & per_page untuk ekspor
        $exportPage = $request->input('page');
        $exportPerPage = $request->input('per_page');
        $pageSuffix = '';
        if (!$isPreview && $exportPage && $exportPerPage) {
            $exportPage = (int) $exportPage;
            $exportPerPage = (int) $exportPerPage;
            $offset = ($exportPage - 1) * $exportPerPage;
            $data = array_slice($data, $offset, $exportPerPage);
            $pageSuffix = "_page{$exportPage}_per{$exportPerPage}";
        }

        // Pilih format export (pdf atau excel/csv)
        $format = strtolower($request->input('format', $request->input('export', 'pdf')));

        if (in_array($format, ['csv'])) {
            // Generate CSV for assigned interns
            $handle = fopen('php://temp', 'r+');
            fputcsv($handle, ['Name', 'Institution', 'Major', 'Division', 'Site', 'Start Date', 'End Date', 'Status']);
            foreach ($data as $row) {
                fputcsv($handle, [
                    html_entity_decode($row->name, ENT_QUOTES, 'UTF-8'),
                    html_entity_decode($row->university, ENT_QUOTES, 'UTF-8'),
                    html_entity_decode($row->major, ENT_QUOTES, 'UTF-8'),
                    html_entity_decode($row->division, ENT_QUOTES, 'UTF-8'),
                    html_entity_decode($row->site, ENT_QUOTES, 'UTF-8'),
                    $row->start_date,
                    $row->end_date,
                    $row->status,
                ]);
            }
            rewind($handle);
            $csv = stream_get_contents($handle);
            fclose($handle);

            // BOM + CRLF
            $csv = "\xEF\xBB\xBF" . preg_replace("~\R~u", "\r\n", $csv);

            $filename = 'assigned_interns_report_' . $user->user_id . $pageSuffix . '.csv';

            return response($csv, 200, [
                'Content-Type' => 'text/csv; charset=utf-8',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                'Content-Length' => strlen($csv),
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0'
            ]);
        }

        if (in_array($format, ['excel', 'xlsx'])) {
            // Generate XLSX for assigned interns
            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Assigned Interns');
            $sheet->fromArray(['Name', 'Institution', 'Major', 'Division', 'Site', 'Start Date', 'End Date', 'Status'], null, 'A1');

            $row = 2;
            foreach ($data as $r) {
                $sheet->setCellValue('A' . $row, html_entity_decode($r->name, ENT_QUOTES, 'UTF-8'));
                $sheet->setCellValue('B' . $row, html_entity_decode($r->university, ENT_QUOTES, 'UTF-8'));
                $sheet->setCellValue('C' . $row, html_entity_decode($r->major, ENT_QUOTES, 'UTF-8'));
                $sheet->setCellValue('D' . $row, html_entity_decode($r->division, ENT_QUOTES, 'UTF-8'));
                $sheet->setCellValue('E' . $row, html_entity_decode($r->site, ENT_QUOTES, 'UTF-8'));
                $sheet->setCellValue('F' . $row, $r->start_date);
                $sheet->setCellValue('G' . $row, $r->end_date);
                $sheet->setCellValue('H' . $row, $r->status);
                $row++;
            }

            $writer = new Xlsx($spreadsheet);
            $filename = 'assigned_interns_report_' . $user->user_id . $pageSuffix . '.xlsx';

            ob_start();
            $writer->save('php://output');
            $xlsxContent = ob_get_clean();

            return response($xlsxContent, 200, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                'Content-Length' => strlen($xlsxContent),
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0'
            ]);
        }

        $pdf = Pdf::loadView('reports.assigned_interns', [
            'data' => $data,
            'mentor' => $user->isAdmin() ? null : htmlspecialchars($user->nama ?? '', ENT_QUOTES, 'UTF-8'),
        ]);
        $pdf->setPaper('a4', 'landscape');

        try {
            $pdfContent = $pdf->output();

            return response($pdfContent, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="assigned_interns_report_' . $user->user_id . '.pdf"',
                'Content-Length' => strlen($pdfContent),
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to generate PDF: ' . $e->getMessage()
            ], 500);
        }
    }

    public function getFilters(Request $request)
    {
        $user = $request->user();

        // Pastikan user adalah mentor
        if (!$user->isMentor()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // Ambil daftar universitas dari interns mentor
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

        $universities = User::whereIn('users.user_id', $internIds)
            ->join('students', 'users.user_id', '=', 'students.user_id')
            ->distinct()
            ->pluck('students.universitas')
            ->filter()
            ->values();

        // Ambil daftar interns dengan nama, user_id, universitas, dan akhir_magang
        $interns = User::whereIn('users.user_id', $internIds)
            ->join('students', 'users.user_id', '=', 'students.user_id')
            ->select('users.user_id', 'users.nama', 'students.id_mahasiswa as id_mahasiswa', 'students.universitas', 'students.akhir_magang')
            ->get();

        // Tambahkan endDate untuk setiap intern
        $interns->transform(function ($intern) {
            $intern->endDate = $intern->akhir_magang;
            return $intern;
        });

        // Ambil endDate dari akhir_magang terbaru dari interns untuk pivot
        $endDate = $interns->max('akhir_magang');

        return response()->json([
            'success' => true,
            'universities' => $universities,
            'interns' => $interns,
            'pivot' => [
                'endDate' => $endDate
            ]
        ]);
    }

    public function exportMentorList(Request $request)
    {
        $user = $request->user();

        if (!$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $division = $request->input('division');
        $hasInternsOnly = $request->boolean('has_interns');

        $query = \App\Models\TblKaryawan::query()
            ->with(['user.interns' => function($q) {
                $q->wherePivot('is_active', true)
                  ->join('students', 'users.user_id', '=', 'students.user_id')
                  ->select('users.user_id', 'users.nama', 'students.universitas');
            }, 'mentorMappings' => function($q) {
                $q->where('is_active', true)
                  ->with(['intern.user']);
            }]);

        if ($division) {
            $query->where('division', $division);
        }

        if ($hasInternsOnly) {
            $query->where(function($q) {
                // Has legacy mapping
                $q->has('mentorMappings')
                // OR has modern mapping via user
                ->orWhereHas('user.interns');
            });
        }

        $mentors = $query->orderBy('nama')->get();

        $data = $mentors->map(function($m) {
            // 1. Get interns via modern relationship (User -> interns)
            $modernInterns = collect([]);
            if ($m->user) {
                $modernInterns = $m->user->interns->map(function($intern) {
                    return (object)[
                        'nama' => $intern->nama,
                        'universitas' => $intern->universitas,
                        'user_id' => $intern->user_id
                    ];
                });
            }

            // 2. Get interns via legacy mapping (TblKaryawan -> mentorMappings)
            $legacyInterns = $m->mentorMappings->map(function($mapping) {
                $student = $mapping->intern;
                return (object)[
                    'nama' => ($student && $student->user) ? $student->user->nama : ($student ? $student->nama : 'Unknown'),
                    'universitas' => $student ? $student->universitas : '-',
                    'user_id' => $student ? $student->user_id : null
                ];
            });

            // Combine and unique by user_id or name
            $assignedInterns = $modernInterns->concat($legacyInterns)
                ->unique(function ($item) {
                    return $item->user_id ?? $item->nama;
                })
                ->values();

            return (object) [
                'name' => $m->nama,
                'division' => $m->division ?? '-',
                'assigned_interns' => $assignedInterns
            ];
        });

        $isPreview = $request->boolean('preview');
        if ($isPreview) {
            $perPage = (int) $request->input('per_page', 10);
            $page = (int) $request->input('page', 1);

            $transformedData = $data->map(function($item) {
                $itemCopy = clone $item;
                $itemCopy->assigned_interns = count($item->assigned_interns);
                return $itemCopy;
            });

            $paginator = new LengthAwarePaginator(
                $transformedData->forPage($page, $perPage)->values(),
                $transformedData->count(),
                $perPage,
                $page,
                ['path' => $request->url(), 'pageName' => 'page']
            );

            return response()->json([
                'success' => true,
                'data' => $paginator->items(),
                'pagination' => [
                    'current_page' => $paginator->currentPage(),
                    'last_page' => $paginator->lastPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                    'from' => $paginator->firstItem(),
                    'to' => $paginator->lastItem(),
                ],
                'division' => $division
            ]);
        }

        $format = strtolower($request->input('format', $request->input('export', 'pdf')));

        if (in_array($format, ['excel', 'xlsx'])) {
            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Mentor List');

            $sheet->fromArray(['No', 'Mentor Name', 'Division', 'Assigned Interns'], null, 'A1');

            $row = 2;
            foreach ($data as $index => $r) {
                $sheet->setCellValue('A' . $row, $index + 1);
                $sheet->setCellValue('B' . $row, $r->name);
                $sheet->setCellValue('C' . $row, $r->division ?: '-');
                
                $internsStr = $r->assigned_interns->map(function($i) {
                    return $i->nama . " (" . $i->universitas . ")";
                })->implode(', ');
                
                $sheet->setCellValue('D' . $row, $internsStr ?: '-');
                $row++;
            }

            foreach (range('A', 'D') as $col) {
                $sheet->getColumnDimension($col)->setAutoSize(true);
            }

            $writer = new Xlsx($spreadsheet);
            $filename = 'mentor_list_' . now()->format('YmdHis') . '.xlsx';

            ob_start();
            $writer->save('php://output');
            $xlsxContent = ob_get_clean();

            return response($xlsxContent, 200, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                'Content-Length' => strlen($xlsxContent),
            ]);
        }

        // PDF Generation
        $pdf = Pdf::loadView('reports.mentors', [
            'data' => $data,
            'division' => $division
        ]);
        $pdf->setPaper('a4', 'landscape');

        return $pdf->download('mentor_list_' . now()->format('YmdHis') . '.pdf');
    }

    public function exportInternshipList(Request $request)
    {
        $user = $request->user();

        if (!$user->isAdmin() && !$user->isMentor()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $activeRole = $request->query('active_role');
        $isMentorContext = ($activeRole === 'mentor') || ($request->segment(2) === 'mentor' && $user->isMentor());

        $mentorId = $request->input('mentor_id');
        if ($isMentorContext) {
            $mentorId = $user->user_id;
        }

        // Determine period
        if ($request->filled('month') && $request->filled('year')) {
            $month = intval($request->month);
            $year = intval($request->year);
            $startDate = Carbon::create($year, $month, 1)->startOfMonth()->toDateString();
            $endDate = Carbon::create($year, $month, 1)->endOfMonth()->toDateString();
        } else {
            $startDate = $request->input('start_date', Carbon::now()->startOfMonth()->toDateString());
            $endDate = $request->input('end_date', Carbon::now()->endOfMonth()->toDateString());
        }

        $query = User::whereHas('roles', function($q) {
                $q->where('name', 'intern');
            })
            ->join('students', 'users.user_id', '=', 'students.user_id')
            ->leftJoin('sites', 'students.id_site', '=', 'sites.id_site')
            ->select([
                'users.user_id', 'users.nama', 'users.status',
                'students.id_mahasiswa',
                'students.universitas', 'students.jurusan', 'students.division as division', 'students.job_position as job_position',
                'students.mulai_magang', 'students.akhir_magang',
                'sites.nama_site'
            ])
            ->with(['mentors' => function($q) {
                $q->select('users.user_id', 'users.nama');
            }]);

        if ($startDate && $endDate) {
            $query->whereHas('mahasiswa', function($q) use ($startDate, $endDate) {
                $q->where('mulai_magang', '<=', $endDate)
                  ->where(function($sub) use ($startDate) {
                      $sub->whereNull('akhir_magang')
                          ->orWhere('akhir_magang', '>=', $startDate);
                  });
            });
        }

        if ($mentorId) {
            // Use the same hybrid lookup strategy as attendance/logbook reports
            // to support both canonical mapping (intern_id/mentor_id) and legacy
            // mapping (intern_user_id/mentor_user_id) across environments.
            $mentorKaryawanId = null;
            $mentorUser = \App\Models\User::find($mentorId);
            if ($mentorUser && $mentorUser->karyawan) {
                $mentorKaryawanId = $mentorUser->karyawan->id_karyawan;
            } elseif (\App\Models\TblKaryawan::where('id_karyawan', $mentorId)->exists()) {
                $mentorKaryawanId = intval($mentorId);
            }

            $direct = [];
            if ($mentorUser) {
                $direct = $mentorUser->interns()->pluck('users.user_id')->toArray();
            }

            $viaStudents = DB::table('intern_mentors as im')
                ->join('students as s', 's.id_mahasiswa', '=', 'im.intern_id')
                ->where('im.is_active', 1)
                ->where(function($q) use ($mentorId, $mentorKaryawanId) {
                    $q->where('im.mentor_user_id', $mentorId)
                      ->orWhere('im.mentor_id', $mentorId);

                    if ($mentorKaryawanId) {
                        $q->orWhere('im.mentor_id', $mentorKaryawanId);
                    }
                })
                ->pluck('s.user_id')
                ->filter()
                ->toArray();

            $mentorInternIds = array_values(array_unique(array_filter(array_merge($direct, $viaStudents))));

            if (empty($mentorInternIds)) {
                $query->whereRaw('1 = 0');
            } else {
                $query->whereIn('users.user_id', $mentorInternIds);
            }
        }

        $interns = $query->orderBy('users.nama')->get();

        // Extract list of mapped mentor names (modern + legacy)
        foreach ($interns as $intern) {
            $modernMentors = $intern->mentors->map(function($m) {
                return (object)['nama' => $m->nama];
            });

            $legacyMentors = [];
            if ($intern->id_mahasiswa) {
                $legacyMentors = \App\Models\TblKaryawan::whereHas('mentorMappings', function($q) use ($intern) {
                    $q->where('intern_id', $intern->id_mahasiswa)
                      ->where('is_active', true);
                })
                ->whereNotIn('user_id', $intern->mentors->pluck('user_id')->filter()->toArray()) // Avoid duplicates
                ->get()
                ->map(function($k) {
                    return (object)['nama' => $k->nama];
                });
            }

            // Override the relation so it serialization uses 'mentors'
            $intern->setRelation('mentors', $modernMentors->concat($legacyMentors));
        }

        $isPreview = $request->boolean('preview');
        if ($isPreview) {
            $perPage = (int) $request->input('per_page', 10);
            $page = (int) $request->input('page', 1);

            $paginator = new LengthAwarePaginator(
                $interns->forPage($page, $perPage)->values(),
                $interns->count(),
                $perPage,
                $page,
                ['path' => $request->url(), 'pageName' => 'page']
            );

            return response()->json([
                'success' => true,
                'data' => $paginator->items(),
                'pagination' => [
                    'current_page' => $paginator->currentPage(),
                    'last_page' => $paginator->lastPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                    'from' => $paginator->firstItem(),
                    'to' => $paginator->lastItem(),
                ],
                'period' => $startDate . ' to ' . $endDate,
                'startDate' => $startDate,
                'endDate' => $endDate
            ]);
        }

        $mentorName = null;
        if ($mentorId) {
            $mKaryawan = \App\Models\TblKaryawan::where('user_id', $mentorId)->first() 
                      ?? \App\Models\TblKaryawan::find($mentorId);
            $mentorName = $mKaryawan ? $mKaryawan->nama : null;
        }

        $format = strtolower($request->input('format', $request->input('export', 'pdf')));

        if (in_array($format, ['excel', 'xlsx'])) {
            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Internship List');

            $sheet->fromArray(['No', 'Name', 'Division', 'University', 'Period', 'Job Position', 'Status', 'Mentor'], null, 'A1');

            $row = 2;
            foreach ($interns as $index => $r) {
                $sheet->setCellValue('A' . $row, $index + 1);
                $sheet->setCellValue('B' . $row, $r->nama);
                $sheet->setCellValue('C' . $row, $r->division ?? '-');
                $sheet->setCellValue('D' . $row, $r->universitas);
                $sheet->setCellValue('E' . $row, ($r->mulai_magang ? \Carbon\Carbon::parse($r->mulai_magang)->format('Y-m-d') : '-') . ' - ' . ($r->akhir_magang ? \Carbon\Carbon::parse($r->akhir_magang)->format('Y-m-d') : '-'));
                $sheet->setCellValue('F' . $row, $r->job_position ?? '-');
                $sheet->setCellValue('G' . $row, ucfirst($r->status));
                $sheet->setCellValue('H' . $row, $r->mentors->pluck('nama')->implode(', ') ?: '-');
                $row++;
            }

            foreach (range('A', 'H') as $col) {
                $sheet->getColumnDimension($col)->setAutoSize(true);
            }

            $writer = new Xlsx($spreadsheet);
            $filename = 'internship_list_' . now()->format('YmdHis') . '.xlsx';

            ob_start();
            $writer->save('php://output');
            $xlsxContent = ob_get_clean();

            return response($xlsxContent, 200, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                'Content-Length' => strlen($xlsxContent),
            ]);
        }

        // PDF Generation
        $pdf = Pdf::loadView('reports.internships', [
            'data' => $interns,
            'mentor_name' => $mentorName,
            'period' => $startDate . ' to ' . $endDate
        ]);
        $pdf->setPaper('a4', 'landscape');

        return $pdf->download('internship_list_' . now()->format('YmdHis') . '.pdf');
    }
    public function exportAllowance(Request $request)
    {
        $user = $request->user();

        // 1. Authorization (Admin Or Mentor)
        if (!$user->isMentor() && !$user->isAdmin()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        // 2. Validate Required Parameters
        $request->validate([
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
        ]);

        $startDate = $request->start_date;
        $endDate = $request->end_date;

        $activeRole = $request->query('active_role');
        $isMentorContext = ($activeRole === 'mentor') || ($request->segment(2) === 'mentor' && $user->isMentor());

        // 3. Determine Scope (Interns)
        if ($user->isAdmin() && !$isMentorContext) {
            $internQuery = User::whereHas('roles', fn($q) => $q->where('name', 'intern'));
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
            $internIdsForQuery = array_unique(array_filter(array_merge($direct, $viaStudents)));
            $internQuery = User::whereIn('users.user_id', $internIdsForQuery);
        }

        // Filter interns by internship period (mulai_magang & akhir_magang within the date range)
        $internIds = $internQuery
            ->whereHas('mahasiswa', function($q) use ($startDate, $endDate) {
                $q->where(function($sub) use ($startDate, $endDate) {
                    // Internship overlaps with the requested period
                    $sub->where('mulai_magang', '<=', $endDate)
                        ->where(function($innerSub) use ($startDate) {
                            $innerSub->whereNull('akhir_magang')
                                     ->orWhere('akhir_magang', '>=', $startDate);
                        });
                });
            })
            ->pluck('users.user_id')
            ->toArray();

        // Filter by user_id if specific intern needed
        if ($request->filled('intern_id')) {
             $internIds = array_intersect($internIds, [$request->intern_id]);
        }

        // Filter by mentor_id if specific mentor needed (Admin)
        if ($user->isAdmin() && !$isMentorContext && $request->filled('mentor_id')) {
            $mentorIdFilter = $request->mentor_id;
            $mentorKaryawanId = null;
            $mentorUser = \App\Models\User::find($mentorIdFilter);
            if ($mentorUser && $mentorUser->karyawan) {
                $mentorKaryawanId = $mentorUser->karyawan->id_karyawan;
            } elseif (\App\Models\TblKaryawan::where('id_karyawan', $mentorIdFilter)->exists()) {
                $mentorKaryawanId = intval($mentorIdFilter);
            }

            $internQueryFilteredByMentor = User::whereHas('mahasiswa.internMentors', function($q) use ($mentorKaryawanId, $mentorIdFilter) {
                $q->where('is_active', true)
                  ->where(function($sub) use ($mentorKaryawanId, $mentorIdFilter) {
                      if ($mentorKaryawanId) {
                          $sub->where('mentor_id', $mentorKaryawanId)
                              ->orWhere('mentor_user_id', $mentorIdFilter);
                      } else {
                          $sub->where('mentor_user_id', $mentorIdFilter)
                              ->orWhere('mentor_id', $mentorIdFilter);
                      }
                  });
            });
            $internIds = array_intersect($internIds, $internQueryFilteredByMentor->pluck('users.user_id')->toArray());
        }
        
        // Handle empty intern list
        if (empty($internIds)) {
             return response()->json(['message' => 'No interns found for this period'], 404);
        }

        // 4. Fetch Verified Logbooks (all, without date filter)
        $logbooks = Logbook::with('user')
            ->whereIn('user_id', $internIds)
            ->where('status_verifikasi', 'verified')
            ->orderBy('user_id')
            ->orderBy('tanggal')
            ->get();

        if ($logbooks->isEmpty()) {
            return response()->json(['message' => 'No verified logbooks found'], 404);
        }

        // 5. Group by User
        $grouped = $logbooks->groupBy('user_id');

        // PREVIEW MODE: Return JSON data for Frontend Table
        if ($request->boolean('preview')) {
            $previewData = [];
            $rowNumber = 1;
            foreach ($grouped as $userId => $items) {
                $intern = $items->first()->user;
                $mahasiswa = $intern->mahasiswa;
                
                // Calculate total days from verified logbooks
                $totalDays = $items->count();
                $dailyAllowance = 45000;
                $totalAllowance = $totalDays * $dailyAllowance;
                
                // Get internship period
                $periodStart = $mahasiswa && $mahasiswa->mulai_magang 
                    ? (is_string($mahasiswa->mulai_magang) ? $mahasiswa->mulai_magang : $mahasiswa->mulai_magang->format('Y-m-d'))
                    : '-';
                $periodEnd = $mahasiswa && $mahasiswa->akhir_magang 
                    ? (is_string($mahasiswa->akhir_magang) ? $mahasiswa->akhir_magang : $mahasiswa->akhir_magang->format('Y-m-d'))
                    : '-';
                $internshipPeriod = "$periodStart to $periodEnd";
                
                // Get other info from mahasiswa table
                $institution = $mahasiswa?->universitas ?? '-';
                $division = $mahasiswa?->division ?? '-';
                $jobPosition = $mahasiswa?->job_position ?? '-';
                $bankAccountNo = $mahasiswa?->bank_account_number ?? '-';
                $bankName = $mahasiswa?->bank_name ?? '-';
                $bankAccountHolder = $mahasiswa?->bank_account_name ?? '-';
                
                $previewData[] = [
                    'no' => $rowNumber,
                    'name' => $intern->nama ?? "Intern #{$userId}",
                    'institution' => $institution,
                    'division' => $division,
                    'job_position' => $jobPosition,
                    'internship_period' => $internshipPeriod,
                    'total_days' => $totalDays,
                    'daily_allowance' => number_format($dailyAllowance, 0, ',', '.'),
                    'total_allowance' => number_format($totalAllowance, 0, ',', '.'),
                    'bank_account_no' => $bankAccountNo,
                    'bank_name' => $bankName,
                    'bank_account_holder' => $bankAccountHolder
                ];
                
                $rowNumber++;
            }
            
            $perPage = (int) $request->input('per_page', 10);
            $page = (int) $request->input('page', 1);

            $paginator = new LengthAwarePaginator(
                array_slice($previewData, ($page - 1) * $perPage, $perPage),
                count($previewData),
                $perPage,
                $page,
                ['path' => $request->url(), 'pageName' => 'page']
            );

            return response()->json([
                'success' => true,
                'data' => $paginator->items(),
                'pagination' => [
                    'current_page' => $paginator->currentPage(),
                    'last_page' => $paginator->lastPage(),
                    'per_page' => $paginator->perPage(),
                    'total' => $paginator->total(),
                    'from' => $paginator->firstItem(),
                    'to' => $paginator->lastItem(),
                ],
                'period' => \Carbon\Carbon::parse($startDate)->format('d M Y') . ' to ' . \Carbon\Carbon::parse($endDate)->format('d M Y')
            ]);
        }

        // Generate summary data for all formats (CSV, PDF, same structure)
        $pdfData = [];
        $rowNumber = 1;
        
        foreach ($grouped as $userId => $items) {
            $intern = $items->first()->user;
            $mahasiswa = $intern->mahasiswa;
            $internName = $intern->nama ?? "Intern_{$userId}";
            
            // Calculate total days from verified logbooks
            $totalDays = $items->count();
            $dailyAllowance = 45000;
            $totalAllowance = $totalDays * $dailyAllowance;
            
            // Get internship period
            $periodStart = $mahasiswa && $mahasiswa->mulai_magang 
                ? (is_string($mahasiswa->mulai_magang) ? $mahasiswa->mulai_magang : $mahasiswa->mulai_magang->format('Y-m-d'))
                : '-';
            $periodEnd = $mahasiswa && $mahasiswa->akhir_magang 
                ? (is_string($mahasiswa->akhir_magang) ? $mahasiswa->akhir_magang : $mahasiswa->akhir_magang->format('Y-m-d'))
                : '-';
            $internshipPeriod = "$periodStart to $periodEnd";
            
            // Get other info from mahasiswa table
            $institution = $mahasiswa?->universitas ?? '-';
            $division = $mahasiswa?->division ?? '-';
            $jobPosition = $mahasiswa?->job_position ?? '-';
            $bankAccountNo = $mahasiswa?->bank_account_number ?? '-';
            $bankName = $mahasiswa?->bank_name ?? '-';
            $bankAccountHolder = $mahasiswa?->bank_account_name ?? '-';
            
            $pdfData[] = [
                'no' => $rowNumber,
                'name' => $internName,
                'institution' => $institution,
                'division' => $division,
                'job_position' => $jobPosition,
                'internship_period' => $internshipPeriod,
                'total_days' => $totalDays,
                'daily_allowance' => number_format($dailyAllowance, 0, ',', '.'),
                'daily_allowance_numeric' => $dailyAllowance,
                'total_allowance' => number_format($totalAllowance, 0, ',', '.'),
                'total_allowance_numeric' => $totalAllowance,
                'bank_account_no' => $bankAccountNo,
                'bank_name' => $bankName,
                'bank_account_holder' => $bankAccountHolder
            ];
            
            $rowNumber++;
        }

        // Determine requested format
        $format = strtolower($request->input('format', $request->input('export', 'pdf')));

        // Support CSV export for Allowance Summary (12-column format)
        if (in_array($format, ['csv'])) {
            $handle = fopen('php://temp', 'r+');
            // 12-column header: No|Name|Institution|Division|Job Position|Internship Period|Total Days|Daily Allowance (Rp.)|Total Allowance|Bank Account No|Bank Name|Bank Account Holder Name
            fputcsv($handle, ['No', 'Name', 'Institution', 'Division', 'Job Position', 'Internship Period', 'Total Days Internship', 'Daily Allowance (Rp.)', 'Total Allowance', 'Bank Account No', 'Bank Name', 'Bank Account Holder Name'], '|');
            
            foreach ($pdfData as $row) {
                fputcsv($handle, [
                    $row['no'],
                    $row['name'],
                    $row['institution'],
                    $row['division'],
                    $row['job_position'],
                    $row['internship_period'],
                    $row['total_days'],
                    $row['daily_allowance'],
                    $row['total_allowance'],
                    $row['bank_account_no'],
                    $row['bank_name'],
                    $row['bank_account_holder']
                ], '|');
            }
            rewind($handle);
            $csv = stream_get_contents($handle);
            fclose($handle);
            // BOM + CRLF
            $csv = "\xEF\xBB\xBF" . preg_replace("~\R~u", "\r\n", $csv);
            $filename = 'allowance_report_' . date('Y-m-d_His') . '.csv';

            return response($csv, 200, [
                'Content-Type' => 'text/csv; charset=utf-8',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                'Content-Length' => strlen($csv),
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0'
            ]);
        }

        if (in_array($format, ['excel', 'xlsx'])) {
            // Create single XLSX with summary format (same as CSV/PDF - 12 columns)
            $spreadsheet = new Spreadsheet();
            $sheet = $spreadsheet->getActiveSheet();
            $sheet->setTitle('Allowance Report');

            // Header
            $sheet->fromArray(['No', 'Name', 'Institution', 'Division', 'Job Position', 'Internship Period', 'Total Days Internship', 'Daily Allowance (Rp.)', 'Total Allowance', 'Bank Account No', 'Bank Name', 'Bank Account Holder Name'], null, 'A1');

            // Data rows
            $row = 2;
            foreach ($pdfData as $item) {
                $sheet->setCellValue('A' . $row, $item['no']);
                $sheet->setCellValue('B' . $row, $item['name']);
                $sheet->setCellValue('C' . $row, $item['institution']);
                $sheet->setCellValue('D' . $row, $item['division']);
                $sheet->setCellValue('E' . $row, $item['job_position']);
                $sheet->setCellValue('F' . $row, $item['internship_period']);
                $sheet->setCellValue('G' . $row, $item['total_days']);
                
                // H: Daily Allowance (numeric value with Excel number format)
                $sheet->setCellValue('H' . $row, $item['daily_allowance_numeric']);
                $sheet->getStyle('H' . $row)->getNumberFormat()->setFormatCode('#,##0');
                
                // I: Total Allowance (numeric value with Excel number format)
                $sheet->setCellValue('I' . $row, $item['total_allowance_numeric']);
                $sheet->getStyle('I' . $row)->getNumberFormat()->setFormatCode('#,##0');
                
                $sheet->setCellValue('J' . $row, $item['bank_account_no']);
                $sheet->setCellValue('K' . $row, $item['bank_name']);
                $sheet->setCellValue('L' . $row, $item['bank_account_holder']);
                $row++;
            }

            // Auto-size columns
            foreach (range('A', 'L') as $col) {
                $sheet->getColumnDimension($col)->setAutoSize(true);
            }

            $writer = new Xlsx($spreadsheet);
            $filename = 'allowance_report_' . date('Y-m-d_His') . '.xlsx';

            ob_start();
            $writer->save('php://output');
            $xlsxContent = ob_get_clean();

            return response($xlsxContent, 200, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'Content-Disposition' => 'attachment; filename="' . $filename . '"',
                'Content-Length' => strlen($xlsxContent),
                'Cache-Control' => 'no-cache, no-store, must-revalidate',
                'Pragma' => 'no-cache',
                'Expires' => '0'
            ]);
        }

        // Format period with abbreviated month (e.g., "01 Nov 2025 to 31 Dec 2025")
        $startCarbon = \Carbon\Carbon::parse($startDate);
        $endCarbon = \Carbon\Carbon::parse($endDate);
        $disPeriod = $startCarbon->format('d M Y') . ' to ' . $endCarbon->format('d M Y');

        $pdf = Pdf::loadView('reports.allowance', [
            'data' => $pdfData,
            'period' => $disPeriod
        ]);
        // Enable remote & HTML5 parsing so DomPDF can load file:// URLs and modern markup
        $pdf->setOptions([
            'isRemoteEnabled' => true,
            'isHtml5ParserEnabled' => true,
        ]);
        $pdf->setPaper('a4', 'landscape');
        
        $filename = 'allowance_report_' . date('Y-m-d_His') . '.pdf';
        return $pdf->download($filename);
    }

    private function formatAllowanceItems($items) {
        return $items->map(function($item) {
             $files = [];
             if (!empty($item->bukti_kegiatan)) {
                  $files = is_array($item->bukti_kegiatan) ? $item->bukti_kegiatan : [];
             }
             
             $prettify = function($path) {
                 $filename = basename($path);
                 if (preg_match('/^\d+_[a-f0-9]+_(.+)$/i', $filename, $matches)) {
                     $filename = $matches[1];
                 } elseif (preg_match('/^\d+_[\w\d]+_\d+_(.+)$/', $filename, $matches)) {
                     $filename = $matches[1];
                 }
                 return ltrim($filename, '? ._');
             };

             $fileObjects = array_map(function($path) use ($prettify) {
                 $obj = (object) [
                     'path' => $path,
                     'name' => $prettify($path)
                 ];

                 // DEBUG: log resolved file locations and existence
                 try {
                     $public = public_path($path);
                     $storage = storage_path('app/public/' . ltrim($path, '/'));
                     Log::info('Allowance file check', [
                         'original' => $path,
                         'prettified' => $obj->name,
                         'public_path' => $public,
                         'public_exists' => file_exists($public),
                         'storage_path' => $storage,
                         'storage_exists' => file_exists($storage),
                     ]);
                 } catch (\Throwable $e) {
                     Log::error('Allowance file check failed', ['path' => $path, 'error' => $e->getMessage()]);
                 }

                 return $obj;
             }, $files);

             return (object) [
                 'date' => $item->tanggal,
                 'activity' => $item->deskripsi_kegiatan,
                 'status' => $item->status_verifikasi,
                 'files' => $fileObjects
             ];
        });
    }
}
