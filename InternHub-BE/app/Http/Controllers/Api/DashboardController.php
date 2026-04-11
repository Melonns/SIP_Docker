<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TblAbsensi;
use App\Models\TblMahasiswa;
use App\Models\Izin;
use App\Models\Logbook;
use App\Models\KoreksiAbsensi;
use App\Models\User;
use Illuminate\Http\Request;
use Carbon\Carbon;
use GuzzleHttp\Client;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class DashboardController extends Controller
{
    public function getDashboardData(Request $request)
    {
        $user = $request->user();
        $roles = $user->getRoleNames();
        // FE bisa mengirim role lewat request, jika tidak ada ambil dari user
        $requestedRole = $request->input('role');
        $role = $requestedRole ?? (is_array($roles) ? ($roles[0] ?? null) : $roles->first());

        $data = [];

        switch ($role) {
            case 'intern':
                $data = $this->getInternDashboard($user);
                break;
            case 'mentor':
                $data = $this->getMentorDashboard($user);
                break;
            case 'admin':
                $data = $this->getAdminDashboard($user);
                break;
            default:
                $data = $this->getInternDashboard($user);
        }

        return response()->json([
            'success' => true,
            'role' => $role,
            'data' => $data
        ]);
    }

    /**
     * Dashboard untuk Intern
     */
    private function getInternDashboard($user)
    {
        $userId = $user->user_id;
        $today = Carbon::today();
        $request = request();

        // 1. Get Mahasiswa profile with magang period
        $mahasiswa = \App\Models\TblMahasiswa::where('user_id', $userId)->first();
        $mahasiswaId = $mahasiswa?->id_mahasiswa ?? null;
        
        // 2. Ambil Periode Magang dari students
        $mulaiMagang = $mahasiswa && $mahasiswa->mulai_magang ? Carbon::parse($mahasiswa->mulai_magang) : null;
        $akhirMagang = $mahasiswa && $mahasiswa->akhir_magang ? Carbon::parse($mahasiswa->akhir_magang) : null;

        if (!$mulaiMagang || !$akhirMagang) {
            return ['error' => 'Periode magang belum diatur.'];
        }

        // Determine period: use request params if provided, otherwise use mulai_magang to today
        if ($request->filled('start_date') && $request->filled('end_date')) {
            $periodStart = Carbon::parse($request->start_date)->startOfDay();
            $periodEnd = Carbon::parse($request->end_date)->endOfDay();
        } else {
            $periodStart = $mulaiMagang->copy()->startOfDay();
            $periodEnd = $today->copy()->endOfDay();
            // Cap to akhir_magang if it's before today
            if ($akhirMagang->lt($periodEnd)) {
                $periodEnd = $akhirMagang->copy()->endOfDay();
            }
        }

        // Attendance stats are always for current month only
        $attendanceStart = Carbon::now()->startOfMonth();
        $attendanceEnd = Carbon::now()->endOfMonth();
        // Cap attendance end date to today or akhir_magang
        // $attendanceEnd = min($attendanceEnd, $today, $akhirMagang)->endOfDay();

        // 2. Tarik semua data sekaligus (Eager Loading)
        $absensiQuery = \App\Models\TblAbsensi::query();
        if ($mahasiswaId) {
            $absensiQuery->where('id_mahasiswa', $mahasiswaId);
        } else {
            $absensiQuery->where('user_id', $userId);
        }
        $absensi = $absensiQuery
            ->whereBetween('tanggal', [$attendanceStart->toDateString(), $attendanceEnd->toDateString()])
            ->get()
            ->groupBy(function ($date) {
                return \Carbon\Carbon::parse($date->tanggal)->format('Y-m-d');
            });

        // Ambil semua leave_requests yang overlap dengan attendance period
        $leaveQuery = Izin::query();
        if ($mahasiswaId) {
            $leaveQuery->where('id_mahasiswa', $mahasiswaId);
        } else {
            $leaveQuery->where('user_id', $userId);
        }
        $leave_requestsApproved = (clone $leaveQuery)
            ->where(function($q){ $q->where('status', 'approved')->orWhere('status_admin', 'approved'); })
            ->where(function ($q) use ($attendanceStart, $attendanceEnd) {
                $q->where(function ($sub) use ($attendanceStart, $attendanceEnd) {
                    $sub->where('tanggal_mulai', '<=', $attendanceEnd)
                        ->where('tanggal_selesai', '>=', $attendanceStart);
                });
            })
            ->get();
        $leave_requestsPending = (clone $leaveQuery)
            ->where('status', 'pending')
            ->where(function ($q) use ($attendanceStart, $attendanceEnd) {
                $q->where(function ($sub) use ($attendanceStart, $attendanceEnd) {
                    $sub->where('tanggal_mulai', '<=', $attendanceEnd)
                        ->where('tanggal_selesai', '>=', $attendanceStart);
                });
            })
            ->get();

        // 3. Variabel Akumulasi
        $totalHariKerja = 0;
        $totalHadir = 0;
        $totalSakit = 0;
        $totalIzinLain = 0;
        $totalAlpa = 0;
        $totalIzinPending = 0;

        // Ambil semua tanggal libur nasional
        $liburDates = \App\Models\Libur::pluck('tanggal')
            ->map(function($date) {
                return is_string($date) ? $date : $date->toDateString();
            })
            ->toArray();
        $liburSet = array_flip($liburDates);

        // 4. Looping Hari demi Hari (Analisis Kehadiran & Alpa) dalam bulan ini
        $current = $attendanceStart->copy();
        $limitDate = $attendanceEnd;

        while ($current->lte($limitDate)) {
            $dateStr = $current->toDateString();
            // SKIP weekend & hari libur nasional
            if ($current->isWeekend() || isset($liburSet[$dateStr])) {
                $current->addDay();
                continue;
            }
            $totalHariKerja++;

            $dayAbsen = $absensi->get($dateStr) ?? collect();
            $hasMasuk = $dayAbsen->contains('status', 'masuk');
            $hasPulang = $dayAbsen->contains('status', 'pulang');

            if ($hasMasuk) {
                $totalHadir++;
            } else {
                // Cek leave_requests approved (sakit/leave_requests) untuk hari ini
                $findIzin = $leave_requestsApproved->first(function ($item) use ($current) {
                    return $current->between(
                        Carbon::parse($item->tanggal_mulai)->startOfDay(),
                        Carbon::parse($item->tanggal_selesai)->endOfDay()
                    );
                });

                if ($findIzin) {
                    if ($findIzin->jenis_izin === 'sakit') {
                        $totalSakit++;
                    } else {
                        $totalIzinLain++;
                    }
                } else {
                    // Cek leave_requests pending untuk hari ini
                    $findIzinPending = $leave_requestsPending->first(function ($item) use ($current) {
                        return $current->between(
                            Carbon::parse($item->tanggal_mulai)->startOfDay(),
                            Carbon::parse($item->tanggal_selesai)->endOfDay()
                        );
                    });
                    if ($findIzinPending) {
                        // Jika tanggal sudah lewat hari ini, hitung sebagai alpa dan leave_requests pending
                        if ($current->lt($today)) {
                            $totalAlpa++;
                            $totalIzinPending++;
                        } else {
                            $totalIzinPending++;
                        }
                    } else {
                        if ($current->lt($today)) {
                            $totalAlpa++;
                        }
                    }
                }
            }
            $current->addDay();
        }

        // 5. Hitung Akumulasi Keterlambatan (Query Agregat) - Filter by current month
        $queryTelat = \App\Models\TblAbsensi::where('user_id', $userId)
            ->where('status', 'masuk')
            ->where('lama_telat', '>', 0)
            ->whereBetween('tanggal', [$attendanceStart->toDateString(), $attendanceEnd->toDateString()]);

        $totalTelat = $queryTelat->count();
        $lamaTelat = $queryTelat->sum('lama_telat');

        // 6. Perhitungan Statistik Akhir
        $totalTidakHadir = $totalHariKerja - $totalHadir;
        $persentase = $totalHariKerja > 0 ? round(($totalHadir / $totalHariKerja) * 100, 1) : 0;
        // Use startOfDay to align comparison
        $sisaHariMagang = max(0, Carbon::today()->diffInDays(Carbon::parse($akhirMagang)->startOfDay(), false));
        // If the difference is exact date, it returns integer. If time involved, it floors.
        // Let's force integer diff of dates.
        $sisaHariMagang = max(0, ceil(Carbon::today()->floatDiffInDays(Carbon::parse($akhirMagang)->startOfDay(), false)));

        // Calculate total working days in current month for logbooks display
        $bulanIniStart = Carbon::now()->startOfMonth();
        $bulanIniEnd = Carbon::now()->endOfMonth();
        // Cap end date to akhir_magang if it's before month end
        if ($akhirMagang->lt($bulanIniEnd)) {
            $bulanIniEnd = $akhirMagang->copy()->endOfDay();
        }
        
        $totalHariKerjaBulanIni = 0;
        $currentMonth = $bulanIniStart->copy();
        while ($currentMonth->lte($bulanIniEnd)) {
            if (!$currentMonth->isWeekend() && !isset($liburSet[$currentMonth->toDateString()])) {
                $totalHariKerjaBulanIni++;
            }
            $currentMonth->addDay();
        }

        // Logbook & Mentor Info
        $bulanIniCount = Logbook::when($mahasiswaId, fn($q) => $q->where('id_mahasiswa', $mahasiswaId), fn($q) => $q->where('user_id', $userId))
            ->whereMonth('tanggal', Carbon::now()->month)->count();
        $logbooksStats = [
            'bulan_ini' => $bulanIniCount . '/' . $totalHariKerjaBulanIni,
            'pending' => Logbook::when($mahasiswaId, fn($q) => $q->where('id_mahasiswa', $mahasiswaId), fn($q) => $q->where('user_id', $userId))
                ->where('status_verifikasi', 'pending')
                ->whereBetween('tanggal', [$periodStart->toDateString(), $periodEnd->toDateString()])
                ->count(),
            'approved' => Logbook::when($mahasiswaId, fn($q) => $q->where('id_mahasiswa', $mahasiswaId), fn($q) => $q->where('user_id', $userId))
                ->where('status_verifikasi', 'verified')
                ->whereBetween('tanggal', [$periodStart->toDateString(), $periodEnd->toDateString()])
                ->count(),
            'revision_needed' => Logbook::when($mahasiswaId, fn($q) => $q->where('id_mahasiswa', $mahasiswaId), fn($q) => $q->where('user_id', $userId))
                ->where('status_verifikasi', 'revision_needed')
                ->whereBetween('tanggal', [$periodStart->toDateString(), $periodEnd->toDateString()])
                ->count(),
        ];

        // Consolidated calculation: not_yet (no logbooks but has attendance) and not_submit (no logbooks, no attendance, no approved leave_requests)
        $submittedLogbooks = Logbook::when($mahasiswaId, fn($q) => $q->where('id_mahasiswa', $mahasiswaId), fn($q) => $q->where('user_id', $userId))
            ->whereBetween('tanggal', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->get()
            ->groupBy(function ($item) {
                return Carbon::parse($item->tanggal)->toDateString();
            });

        $absensiPeriodQuery = \App\Models\TblAbsensi::query();
        if ($mahasiswaId) {
            $absensiPeriodQuery->where('id_mahasiswa', $mahasiswaId);
        } else {
            $absensiPeriodQuery->where('user_id', $userId);
        }
        $absensiPeriod = $absensiPeriodQuery
            ->whereBetween('tanggal', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->get()
            ->groupBy(function ($item) {
                return Carbon::parse($item->tanggal)->toDateString();
            });

        // Fetch all leave_requests (any status) overlapping the period
        $leavePeriodQuery = Izin::query();
        if ($mahasiswaId) {
            $leavePeriodQuery->where('id_mahasiswa', $mahasiswaId);
        } else {
            $leavePeriodQuery->where('user_id', $userId);
        }
        $leave_requestsAllPeriod = $leavePeriodQuery
            ->where(function ($q) use ($periodStart, $periodEnd) {
                $q->where(function ($sub) use ($periodStart, $periodEnd) {
                    $sub->where('tanggal_mulai', '<=', $periodEnd)
                        ->where('tanggal_selesai', '>=', $periodStart);
                });
            })
            ->get();

        // Prepare koreksi grouping
        $koreksiQuery = KoreksiAbsensi::query();
        if ($mahasiswaId) {
            $koreksiQuery->where('id_mahasiswa', $mahasiswaId);
        } else {
            $koreksiQuery->where('user_id', $userId);
        }
        $koreksiPeriod = $koreksiQuery
            ->whereBetween('tanggal', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->get()
            ->groupBy(function ($item) {
                return Carbon::parse($item->tanggal)->toDateString();
            });

        $notYetCount = 0;
        $notSubmitCount = 0;
        $cursor = $periodStart->copy();
        // statuses considered as excused/absent if present in attendance record
        $excusedStatuses = ['sakit', 'leave', 'absent', 'leave_requests'];

        while ($cursor->lte($periodEnd)) {
            $d = $cursor->toDateString();
            if ($cursor->isWeekend() || isset($liburSet[$d])) {
                $cursor->addDay();
                continue;
            }

            $hasLogbook = isset($submittedLogbooks[$d]);
            $attendanceRecords = $absensiPeriod[$d] ?? collect();
            $hasAttendance = $attendanceRecords->count() > 0;

            // check if any attendance record marks excused/absent
            $attendanceExcused = $attendanceRecords->contains(function ($rec) use ($excusedStatuses) {
                return in_array(strtolower($rec->status), $excusedStatuses);
            });

            // check any leave_requests (any status) covering this date
            $hasIzin = $leave_requestsAllPeriod->first(function ($item) use ($cursor) {
                return $cursor->between(
                    Carbon::parse($item->tanggal_mulai)->startOfDay(),
                    Carbon::parse($item->tanggal_selesai)->endOfDay()
                );
            }) ? true : false;

            $hasKoreksi = isset($koreksiPeriod[$d]) && $koreksiPeriod[$d]->count() > 0;

            if ($hasLogbook) {
                // submitted -> ignore
            } elseif ($hasAttendance) {
                // attendance exists -> potential Not Yet if no leave_requests/koreksi
                if (!$hasIzin && !$hasKoreksi && !$attendanceExcused) {
                    $notYetCount++;
                }
            } else {
                // no attendance -> if leave_requests exists or day considered excused -> Not Submit
                if ($hasIzin || $attendanceExcused) {
                    $notSubmitCount++;
                }
            }

            $cursor->addDay();
        }

        $logbooksStats['not_yet'] = $notYetCount;
        $logbooksStats['not_submit'] = $notSubmitCount;

        $mentorUser = $user->mentors()->first();

        return [
            'mentor' => $mentorUser ? [
                'nama' => $mentorUser->nama,
                'email' => $mentorUser->email,
                'no_telp' => $mentorUser->no_telp,
            ] : null,
            'periode_magang' => [
                'mulai' => $mulaiMagang->toDateString(),
                'akhir' => $akhirMagang->toDateString(),
                'sisa_hari' => $sisaHariMagang,
            ],
            'absensi_hari_ini' => [
                'tanggal' => $today->toDateString(),
                'sudah_absen_masuk' => (function() use ($mahasiswaId, $userId, $today) {
                    $q = \App\Models\TblAbsensi::query();
                    if ($mahasiswaId) { $q->where('id_mahasiswa', $mahasiswaId); } else { $q->where('user_id', $userId); }
                    return $q->where('tanggal', $today->toDateString())->where('status', 'masuk')->exists();
                })(),
                'sudah_absen_pulang' => (function() use ($mahasiswaId, $userId, $today) {
                    $q = \App\Models\TblAbsensi::query();
                    if ($mahasiswaId) { $q->where('id_mahasiswa', $mahasiswaId); } else { $q->where('user_id', $userId); }
                    return $q->where('tanggal', $today->toDateString())->where('status', 'pulang')->exists();
                })(),
                'can_clock_out' => Carbon::now()->hour >= 17,
            ],
            'akumulasi_kehadiran' => [
                'total_hari_kerja' => $totalHariKerja,
                'total_hadir' => $totalHadir,
                'total_tidak_hadir' => $totalTidakHadir,
                'total_leave_requests_approved' => $totalSakit + $totalIzinLain,
                'total_leave_requests_pending' => $totalIzinPending,
                'alpa' => $totalAlpa,
                'total_telat' => $totalTelat,
                'lama_telat' => (string) $lamaTelat,
                'persentase_kehadiran' => $persentase . '%',
            ],
            'detail_leave_requests_approved' => [
                'sakit' => $totalSakit,
                'leave_requests_lainnya' => $totalIzinLain,
            ],
            'logbooks' => $logbooksStats,
            'server_time' => Carbon::now()->toDateTimeString(),
        ];
    }

    /**
     * Dashboard untuk Mentor
     */
    private function getMentorDashboard($user)
    {
        $today = Carbon::now()->toDateString();



        $request = request();
        $reqMonth = $request->input('month');
        $reqYear = $request->input('year');
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');
        $today = Carbon::today();

        // Ambil semua tanggal libur nasional
        $liburDates = \App\Models\Libur::pluck('tanggal')->toArray();

        // Penentuan periode yang diminta:
        // 1) Jika disediakan BOTH start_date & end_date => gunakan rentang eksak (per-hari)
        // 2) Else jika month+year disediakan => gunakan bulan tersebut
        // 3) Else => default ke rentang tahun berjalan
        if ($request->filled('start_date') && $request->filled('end_date')) {
            $start = Carbon::parse($startDate)->startOfDay();
            $end = Carbon::parse($endDate)->endOfDay();
        } elseif ($reqMonth && $reqYear) {
            $start = Carbon::create(intval($reqYear), intval($reqMonth), 1)->startOfMonth();
            $end = Carbon::create(intval($reqYear), intval($reqMonth), 1)->endOfMonth();
        } else {
            $start = Carbon::now()->copy()->startOfYear();
            $end = Carbon::now()->copy()->endOfYear();
        }

        // Build filtered intern list based on requested period (if provided)
        $internsRelation = $user->interns();
        if ($request->filled('start_date') && $request->filled('end_date')) {
            $s = $start->toDateString();
            $e = $end->toDateString();
            // Use direct DB query on pivot table to avoid pivot aliasing issues
            // Fetch intern IDs via profile mapping (intern_id => id_mahasiswa) then resolve to user_id
            $mahasiswaIds = null;
            $karyawanId = $user->karyawan?->id_karyawan;
            if ($karyawanId) {
                $mahasiswaIds = \DB::table('intern_mentors')
                    ->where('mentor_id', $karyawanId)
                    ->where('is_active', 1)
                    ->where('assigned_date', '<=', $e)
                    ->where(function ($q) use ($s) {
                        $q->where('end_date', '>=', $s)
                            ->orWhereNull('end_date');
                    })
                    ->pluck('intern_id');
            } else {
                // fallback to legacy user-based pivot
                $mahasiswaIds = \DB::table('intern_mentors')
                    ->where('mentor_user_id', $user->user_id)
                    ->where('is_active', 1)
                    ->where('assigned_date', '<=', $e)
                    ->where(function ($q) use ($s) {
                        $q->where('end_date', '>=', $s)
                            ->orWhereNull('end_date');
                    })
                    ->pluck('intern_id');
            }

            // translate mahasiswa ids (or legacy user ids) to user_id where necessary
            $internIds = collect($mahasiswaIds)->isEmpty() ? collect() : \App\Models\TblMahasiswa::whereIn('id_mahasiswa', $mahasiswaIds)->pluck('user_id');
        } else {
            $internIds = $internsRelation->pluck('users.user_id');
        }
        $totalIntern = $internIds->count();

        // Recompute mentor-related counts using the filtered intern list
        $internAbsenHariIni = \App\Models\TblAbsensi::whereIn('user_id', $internIds)
            ->where('tanggal', $today)
            ->where('status', 'masuk')
            ->distinct('user_id')
            ->count('user_id');

        $logbooksPending = Logbook::whereIn('user_id', $internIds)
            ->where('status_verifikasi', 'pending')
            ->count();

        $leave_requestsPending = Izin::whereIn('user_id', $internIds)
            ->where('status_mentor', 'pending')
            ->count();

        $absenBulanIni = \App\Models\TblAbsensi::whereIn('user_id', $internIds)
            ->where('status', 'masuk')
            ->whereMonth('tanggal', Carbon::now()->month)
            ->whereYear('tanggal', Carbon::now()->year)
            ->count();

        $logbooksApproved = Logbook::whereIn('user_id', $internIds)
            ->where('status_verifikasi', 'verified')
            ->count();

        $logbooksDraft = Logbook::whereIn('user_id', $internIds)
            ->where('status_verifikasi', 'draft')
            ->count();

        // Preload intern records with magang period to respect individual internship ranges
        $interns = \App\Models\TblMahasiswa::whereIn('user_id', $internIds)
            ->get(['user_id', 'mulai_magang', 'akhir_magang', 'universitas'])
            ->keyBy('user_id');

        // Also need user names - get from users table
        $users = \App\Models\User::whereIn('user_id', $internIds)
            ->get(['user_id', 'nama'])
            ->keyBy('user_id');

        // Merge mahasiswa and user data
        $interns = $interns->map(function($m) use ($users) {
            $u = $users->get($m->user_id);
            $m->nama = $u ? $u->nama : null;
            return $m;
        });

        // Compute interns whose period ends within the next 30 days (always relative to today)
        // regardless of any date filter – this matches frontend expectation described by user.
        $endingSoonCutoff = Carbon::now()->copy()->addDays(30)->endOfDay();

        // Get all intern IDs ever assigned to this mentor
        $karyawanId = $user->karyawan?->id_karyawan;
        $mentorInternRaw = [];
        if ($karyawanId) {
            $mentorInternRaw = \DB::table('intern_mentors')
                ->where('mentor_id', $karyawanId)
                ->pluck('intern_id')
                ->unique()
                ->toArray();
        } else {
            // fallback to legacy user-based pivot
            $mentorInternRaw = \DB::table('intern_mentors')
                ->where('mentor_user_id', $user->user_id)
                ->pluck('intern_id')
                ->unique()
                ->toArray();
        }

        // Convert profile ids (id_mahasiswa) to user_id for downstream logic
        $mentorInternIds = empty($mentorInternRaw) ? [] : \App\Models\TblMahasiswa::whereIn('id_mahasiswa', $mentorInternRaw)->pluck('user_id')->toArray();

        if (empty($mentorInternIds)) {
            $endingSoon = collect();
            $endingSoonTotalCount = 0;
        } else {
            // Find interns where either mahasiswa's akhir_magang OR pivot end_date falls within next 30 days
            $todayStr = Carbon::today()->toDateString();
            $cutoffStr = $endingSoonCutoff->toDateString();

            // Only consider the internship period end date when determining "ending soon".
            $endingSoonAll = \App\Models\TblMahasiswa::whereIn('user_id', $mentorInternIds)
                ->whereBetween('akhir_magang', [$todayStr, $cutoffStr])
                ->with('user:user_id,nama')
                ->get(['id_mahasiswa', 'user_id', 'universitas', 'akhir_magang']);

            $endingSoonFullMentor = $endingSoonAll->map(function ($i) {
                $akhir = $i->akhir_magang ? Carbon::parse($i->akhir_magang)->toDateString() : null;
                $days_left = $i->akhir_magang ? (int) ceil(Carbon::today()->floatDiffInDays(Carbon::parse($i->akhir_magang)->startOfDay(), false)) : null;
                return [
                    'user_id' => $i->user_id,
                    'id_mahasiswa' => $i->id_mahasiswa ?? null,
                    'nama' => $i->user ? $i->user->nama : null,
                    'akhir_magang' => $akhir,
                    'days_left' => $days_left,
                    'universitas' => $i->universitas,
                ];
            })->values();

            // fire notifications for the mentor about each intern ending soon
            if (!empty($endingSoonFullMentor)) {
                $mentorUser = $user->mentors()->first();
                if ($mentorUser) {
                    foreach ($endingSoonFullMentor as $inst) {
                        $msg = "Intern {$inst['nama']} akan berakhir magang dalam {$inst['days_left']} hari (tanggal {$inst['akhir_magang']}).";
                        // avoid spamming by checking if a similar unread notification already exists
                        $exists = $mentorUser->notifications()
                            ->where('data->message', $msg)
                            ->whereNull('read_at')
                            ->exists();
                        if (!$exists) {
                            $mentorUser->notify(new \App\Notifications\GeneralNotification(
                                'Intern akan berakhir',      // title
                                $msg,                        // message
                                null,                        // no link
                                'warning',                   // type
                                'mentor'                     // target role
                            ));
                        }
                    }
                }
            }

            // Preview limit 5
            $endingSoon = $endingSoonFullMentor->slice(0, 5)->values();
            $endingSoonTotalCount = $endingSoonFullMentor->count();
        }

        // Query absensi agregat per bulan (cover overall requested interval)
        // Use DB-specific month/year expressions (SQLite doesn't have MONTH()/YEAR())
        try {
            $driver = \DB::getPdo()->getAttribute(\PDO::ATTR_DRIVER_NAME);
        } catch (\Throwable $e) {
            $driver = config('database.default');
        }
        if ($driver === 'sqlite') {
            $monthExpr = "strftime('%m', tanggal)";
            $yearExpr = "strftime('%Y', tanggal)";
        } else {
            $monthExpr = 'MONTH(tanggal)';
            $yearExpr = 'YEAR(tanggal)';
        }

        $absensiAgg = \App\Models\TblAbsensi::selectRaw(
            "user_id, {$monthExpr} as bulan, {$yearExpr} as tahun, tanggal, 
                SUM(CASE WHEN status = 'masuk' THEN 1 ELSE 0 END) as masuk,
                SUM(CASE WHEN status = 'pulang' THEN 1 ELSE 0 END) as pulang,
                SUM(CASE WHEN status = 'masuk' AND lama_telat > 0 THEN 1 ELSE 0 END) as telat"
        )
            ->whereIn('user_id', $internIds)
            ->whereBetween('tanggal', [$start->toDateString(), min($end->toDateString(), $today->toDateString())])
            ->groupBy('user_id', 'bulan', 'tahun', 'tanggal')
            ->get();

        // Index absensi by user_id and tanggal for fast lookup (safety-check object)
        $absensiMap = [];
        foreach ($absensiAgg as $row) {
            if (!is_object($row))
                continue;
            if (!isset($row->user_id) || !isset($row->tanggal))
                continue;
            // Convert tanggal to string if it's a Carbon object
            $tanggalKey = $row->tanggal instanceof \Carbon\Carbon ? $row->tanggal->toDateString() : $row->tanggal;
            $absensiMap[$row->user_id][$tanggalKey] = $row;
        }

        // Query leave_requests approved per month and index by user
        $leave_requestsAgg = Izin::selectRaw('user_id, jenis_izin, tanggal_mulai, tanggal_selesai')
            ->whereIn('user_id', $internIds)
            ->where(function($q){ $q->where('status', 'approved')->orWhere('status_admin', 'approved'); })
            ->get();
        $leave_requestsMap = [];
        foreach ($leave_requestsAgg as $item) {
            $leave_requestsMap[$item->user_id][] = $item;
        }

        // Build statistik bulanan
        $result = [];
        $period = Carbon::parse($start)->copy();
        while ($period->lte($end)) {
            $monthStart = $period->copy()->startOfMonth();
            $monthEnd = $period->copy()->endOfMonth();

            // Clip month range to requested period (supports arbitrary start_date/end_date)
            $rangeStart = $monthStart->gt($start) ? $monthStart->copy() : $start->copy();
            $rangeEnd = $monthEnd->lt($end) ? $monthEnd->copy() : $end->copy();

            $label = $monthStart->locale('id')->isoFormat('MMMM');
            if ($rangeStart->gt($today)) {
                $result[$label] = null;
                $period->addMonth();
                continue;
            }
            $present = 0;
            $absent = 0;
            $late = 0;
            $on_leave = 0;
            $sick = 0;

            foreach ($internIds as $uid) {
                $intern = $interns->get($uid);
                // Determine per-intern effective range: intersect requested month-range with intern magang period
                $internStart = $rangeStart->copy();
                $internEnd = $rangeEnd->copy();
                if ($intern) {
                    if ($intern->mulai_magang) {
                        $mm = Carbon::parse($intern->mulai_magang)->startOfDay();
                        if ($mm->gt($internStart))
                            $internStart = $mm;
                    }
                    if ($intern->akhir_magang) {
                        $am = Carbon::parse($intern->akhir_magang)->endOfDay();
                        if ($am->lt($internEnd))
                            $internEnd = $am;
                    }
                }
                // Don't consider future dates beyond today
                if ($internEnd->gt($today)) {
                    $internEnd = $today->copy();
                }
                if ($internStart->gt($internEnd)) {
                    // Intern not active during this period
                    continue;
                }

                for ($d = $internStart->copy(); $d->lte($internEnd); $d->addDay()) {
                    $date = $d->toDateString();
                    if ($d->isWeekend() || in_array($date, $liburDates))
                        continue;

                    $absenRow = isset($absensiMap[$uid][$date]) ? $absensiMap[$uid][$date] : null;
                    $hasMasuk = $absenRow && $absenRow->masuk > 0;
                    $hasPulang = $absenRow && $absenRow->pulang > 0;
                    $isLate = $absenRow && $absenRow->telat > 0;

                    // Cari leave_requests untuk tanggal tersebut (if any)
                    $leave_requestsToday = null;
                    if (isset($leave_requestsMap[$uid])) {
                        foreach ($leave_requestsMap[$uid] as $iz) {
                            if (Carbon::parse($iz->tanggal_mulai)->toDateString() <= $date && Carbon::parse($iz->tanggal_selesai)->toDateString() >= $date) {
                                $leave_requestsToday = $iz;
                                break;
                            }
                        }
                    }

                    if ($hasMasuk && $hasPulang) {
                        $present++;
                        if ($isLate)
                            $late++;
                    } elseif ($leave_requestsToday) {
                        if ($leave_requestsToday->jenis_izin === 'sakit') {
                            $sick++;
                        } else {
                            $on_leave++;
                        }
                    } else {
                        $absent++;
                    }
                }
            }

            if ($present === 0 && $absent === 0 && $late === 0 && $on_leave === 0 && $sick === 0) {
                $result[$label] = null;
            } else {
                $result[$label] = [
                    'present' => $present,
                    'absent' => $absent,
                    'late' => $late,
                    'on_leave' => $on_leave,
                    'sick' => $sick,
                ];
            }
            $period->addMonth();
        }
        $stat_month = $result;

        // --- Compute early leaves per month (early flag) and merge into $stat_month for mentor view ---
        $earlyAgg = [];
        try {
            $driver = \DB::getPdo()->getAttribute(\PDO::ATTR_DRIVER_NAME);
        } catch (\Throwable $e) {
            $driver = config('database.default');
        }
        if ($driver === 'sqlite') {
            $monthExprLocal = "strftime('%m', tanggal)";
            $yearExprLocal = "strftime('%Y', tanggal)";
        } else {
            $monthExprLocal = 'MONTH(tanggal)';
            $yearExprLocal = 'YEAR(tanggal)';
        }

        if (!empty($internIds)) {
            $earlyRows = \App\Models\TblAbsensi::selectRaw(
                "{$monthExprLocal} as bulan, {$yearExprLocal} as tahun, SUM(CASE WHEN early = 1 THEN 1 ELSE 0 END) as early_count"
            )
                ->whereIn('user_id', $internIds)
                ->whereBetween('tanggal', [$start->toDateString(), min($end->toDateString(), $today->toDateString())])
                ->groupBy('bulan', 'tahun')
                ->get();

            foreach ($earlyRows as $r) {
                $key = intval($r->bulan) . '-' . intval($r->tahun);
                $earlyAgg[$key] = intval($r->early_count);
            }
        }

        // Inject early counts into monthly stats
        $mergedStat = [];
        $periodInject = Carbon::parse($start)->copy();
        while ($periodInject->lte($end)) {
            $monthStart = $periodInject->copy()->startOfMonth();
            $label = $monthStart->locale('id')->isoFormat('MMMM');
            $m = intval($monthStart->month);
            $y = intval($monthStart->year);
            if (!array_key_exists($label, $stat_month) || is_null($stat_month[$label])) {
                $mergedStat[$label] = $stat_month[$label] ?? null;
            } else {
                $k = $m . '-' . $y;
                $earlyCount = $earlyAgg[$k] ?? 0;
                $mergedStat[$label] = $stat_month[$label];
                $mergedStat[$label]['early'] = $earlyCount;
            }
            $periodInject->addMonth();
        }
        $stat_month = $mergedStat;

        return [
            'intern_bimbingan' => [
                'total' => $totalIntern,
                'sudah_absen_hari_ini' => $internAbsenHariIni,
                'belum_absen_hari_ini' => $totalIntern - $internAbsenHariIni,
                'ending_soon' => [
                    'count' => $endingSoonTotalCount ?? ($endingSoon instanceof \Illuminate\Support\Collection ? $endingSoon->count() : count($endingSoon)),
                    'data' => (is_array($endingSoon) ? $endingSoon : $endingSoon->values()->all()),
                ],
            ],
            'pending_approval' => [
                'leave_requests' => $leave_requestsPending,
                'total' => $logbooksPending + $leave_requestsPending,
            ],
            'logbooks_stats' => [
                'approved' => $logbooksApproved,
                'draft' => $logbooksDraft,
                'pending' => $logbooksPending,
            ],
            'statistik_bulan_ini' => [
                'total_absensi' => $absenBulanIni,
            ],
            'statistik_bulanan' => $stat_month,
            'server_time' => Carbon::now()->toDateTimeString(),
        ];
    }

    /**
     * Dashboard untuk Admin
     */
    private function getAdminDashboard($user)
    {
        $request = request();
        $startDate = $request->input('start_date');
        $endDate = $request->input('end_date');
        $today = Carbon::now()->toDateString();

        // Determine period (default: today)
        if ($request->filled('start_date') && $request->filled('end_date')) {
            try {
                $start = Carbon::parse($startDate)->startOfDay();
                $end = Carbon::parse($endDate)->endOfDay();
            } catch (\Throwable $e) {
                // Fallback to today if parsing fails
                $start = Carbon::today()->startOfDay();
                $end = Carbon::today()->endOfDay();
            }
        } else {
            // Default: start => start of current month, end => today + 6 months
            $start = Carbon::now()->startOfMonth()->startOfDay();
            $end = Carbon::now()->addMonths(6)->endOfDay();
        }

        // Interns yang overlap dengan periode filter (start..end) *and are active interns only*
        // add status = active constraint on related user so chart/bar data excludes
        // inactive or soft-deleted accounts.
        $internsForPeriodQuery = \App\Models\TblMahasiswa::whereHas('user', function($q) {
                $q->whereHas('roles', fn($q2) => $q2->where('name', 'intern'))
                  ->where('status', 'active');
            })
            ->where(function ($q) use ($start) {
                $q->whereNull('akhir_magang')
                    ->orWhere('akhir_magang', '>=', $start->toDateString());
            })
            ->where(function ($q) use ($end) {
                $q->whereNull('mulai_magang')
                    ->orWhere('mulai_magang', '<=', $end->toDateString());
            })
            ->with('user:user_id,nama,status');

        $internsForPeriod = $internsForPeriodQuery->get(['user_id', 'universitas', 'jurusan', 'mulai_magang', 'akhir_magang'])->keyBy('user_id');
        
        // Add status from user relation
        $internsForPeriod = $internsForPeriod->map(function($m) {
            $m->status = $m->user ? $m->user->status : null;
            $m->nama = $m->user ? $m->user->nama : null;
            return $m;
        });
        
        $internIdsPeriod = $internsForPeriod->keys()->all();
        $totalIntern = $internsForPeriod->count();

        // Jika tidak ada intern di periode, set semua hitungan menjadi 0 untuk menghindari query empty whereIn
        if (empty($internIdsPeriod)) {
            $absenMasukPeriode = 0;
            $unikAbsenUsers = 0;
            $leave_requestsPending = 0;
            $logbooksPending = 0;
        } else {
            // Absensi pada periode (hanya untuk intern dalam periode)
            $absenMasukPeriode = \App\Models\TblAbsensi::whereIn('user_id', $internIdsPeriod)
                ->whereBetween('tanggal', [$start->toDateString(), $end->toDateString()])
                ->where('status', 'masuk')
                ->count();

            // Jumlah user unik yang absen (masuk) di periode (hanya intern periode)
            $unikAbsenUsers = \App\Models\TblAbsensi::whereIn('user_id', $internIdsPeriod)
                ->whereBetween('tanggal', [$start->toDateString(), $end->toDateString()])
                ->where('status', 'masuk')
                ->distinct('user_id')
                ->count('user_id');

            // Izin pending yang dibuat di periode (hanya intern periode)
            $leave_requestsPending = Izin::whereIn('user_id', $internIdsPeriod)
                ->where('status_admin', 'pending')
                ->whereBetween('created_at', [$start, $end])
                ->count();

            // Logbook pending yang dibuat di periode (hanya intern periode)
            $logbooksPending = Logbook::whereIn('user_id', $internIdsPeriod)
                ->where('status_verifikasi', 'pending')
                ->whereBetween('created_at', [$start, $end])
                ->count();
        }

        // User aktif vs inactive (only within periode interns)
        // since we already filtered for active only, inactive count will always be zero,
        // but keep calculation in case filter changes later.
        $userAktif = $internsForPeriod->filter(fn($m) => $m->user && $m->user->status === 'active')->count();
        $userInaktif = $internsForPeriod->filter(fn($m) => $m->user && $m->user->status === 'inactive')->count();

        // Intern aktif (status active + period overlap) – match date filter, not just today
        $internsActive = \App\Models\TblMahasiswa::whereHas('user', fn($q) => $q
            ->where('status', 'active')
            ->whereHas('roles', fn($q2) => $q2->where('name', 'intern'))
        )
            ->where(function ($q) use ($start, $end) {
                $q->whereNull('mulai_magang')
                    ->orWhere('mulai_magang', '<=', $end->toDateString());
            })
            ->where(function ($q) use ($start, $end) {
                $q->whereNull('akhir_magang')
                    ->orWhere('akhir_magang', '>=', $start->toDateString());
            })
            ->with('user:user_id,nama')
            ->get(['user_id', 'universitas', 'mulai_magang', 'akhir_magang']);
        $internsActiveCount = $internsActive->count();

        // Universitas tersedia (distinct) berdasarkan interns di periode
        $universities = $internsForPeriod->pluck('universitas')->filter()->map(fn($u) => trim($u))->unique()->values()->all();

        // Distribusi universitas — hitung total per universitas
        $universitasDistribution = $internsForPeriod
            ->pluck('universitas')
            ->filter()
            ->map(fn($u) => trim($u))
            ->filter()
            ->countBy()
            ->sortDesc()
            ->toArray();

        // Distribusi program studi (jurusan) — hitung total per jurusan
        $jurusanDistribution = $internsForPeriod
            ->pluck('jurusan')
            ->filter()
            ->map(fn($j) => trim($j))
            ->filter()
            ->countBy()
            ->sortDesc()
            ->toArray();

        // Intern yang ending soon (global): hitung untuk semua interns berdasarkan tanggal hari ini (within next 30 days)
        $endingSoonCutoff = Carbon::now()->copy()->addDays(30)->endOfDay();
        $endingSoonAll = \App\Models\TblMahasiswa::whereHas('user', fn($q) => $q->whereHas('roles', fn($q2) => $q2->where('name', 'intern')))
            ->whereNotNull('akhir_magang')
            ->whereBetween('akhir_magang', [Carbon::today()->toDateString(), $endingSoonCutoff->toDateString()])
            ->with('user:user_id,nama')
            ->get(['id_mahasiswa','user_id', 'universitas', 'akhir_magang']);

        $endingSoonFull = $endingSoonAll->map(function ($i) {
            $akhir = $i->akhir_magang ? Carbon::parse($i->akhir_magang)->toDateString() : null;
            // Use ceil floatDiff for safety
            $days_left = $i->akhir_magang ? (int) ceil(Carbon::today()->floatDiffInDays(Carbon::parse($i->akhir_magang)->startOfDay(), false)) : null;
            return [
                'user_id' => $i->user_id,
                'id_mahasiswa' => $i->id_mahasiswa ?? null,
                'nama' => $i->user ? $i->user->nama : null,
                'universitas' => $i->universitas,
                'akhir_magang' => $akhir,
                'days_left' => $days_left,
            ];
        })->values();

        // Preview: limit to 5 items for dashboard display
        $endingSoonPreview = $endingSoonFull->slice(0, 5)->values();
        $endingSoon = $endingSoonPreview->all();
        $endingSoonTotalCount = $endingSoonFull->count();

        // ---------- Statistik bulanan (trend) untuk Admin ----------
        // Gunakan interns yang overlap dengan periode (sesuai filter)
        $internIdsAll = $internsForPeriod->keys()->all();
        $internsAll = \App\Models\TblMahasiswa::whereIn('user_id', $internIdsAll)
            ->get(['user_id', 'mulai_magang', 'akhir_magang'])
            ->keyBy('user_id');

        // Ambil tanggal libur
        $liburDates = \App\Models\Libur::pluck('tanggal')->toArray();

        // Driver DB untuk fungsi MONTH/YEAR
        try {
            $driver = \DB::getPdo()->getAttribute(\PDO::ATTR_DRIVER_NAME);
        } catch (\Throwable $e) {
            $driver = config('database.default');
        }
        if ($driver === 'sqlite') {
            $monthExpr = "strftime('%m', tanggal)";
            $yearExpr = "strftime('%Y', tanggal)";
        } else {
            $monthExpr = 'MONTH(tanggal)';
            $yearExpr = 'YEAR(tanggal)';
        }

        // Ambil absensi agregat untuk interval (batasi hingga hari ini)
        $absensiAggAdmin = \App\Models\TblAbsensi::selectRaw(
            "user_id, {$monthExpr} as bulan, {$yearExpr} as tahun, tanggal, 
                SUM(CASE WHEN status = 'masuk' THEN 1 ELSE 0 END) as masuk,
                SUM(CASE WHEN status = 'pulang' THEN 1 ELSE 0 END) as pulang,
                SUM(CASE WHEN status = 'masuk' AND lama_telat > 0 THEN 1 ELSE 0 END) as telat"
        )
            ->whereIn('user_id', $internIdsAll)
            ->whereBetween('tanggal', [$start->toDateString(), min($end->toDateString(), Carbon::today()->toDateString())])
            ->groupBy('user_id', 'bulan', 'tahun', 'tanggal')
            ->get();

        $absensiMapAdmin = [];
        foreach ($absensiAggAdmin as $row) {
            if (!is_object($row))
                continue;
            if (!isset($row->user_id) || !isset($row->tanggal))
                continue;
            // Convert tanggal to string if it's a Carbon object
            $tanggalKey = $row->tanggal instanceof \Carbon\Carbon ? $row->tanggal->toDateString() : $row->tanggal;
            $absensiMapAdmin[$row->user_id][$tanggalKey] = $row;
        }

        // Ambil leave_requests approved untuk interval
        $leave_requestsAggAdmin = Izin::selectRaw('user_id, jenis_izin, tanggal_mulai, tanggal_selesai')
            ->whereIn('user_id', $internIdsAll)
            ->where('status', 'approved')
            ->get();
        $leave_requestsMapAdmin = [];
        foreach ($leave_requestsAggAdmin as $item) {
            $leave_requestsMapAdmin[$item->user_id][] = $item;
        }

        $stat_month_admin = [];
        $periodAdmin = Carbon::parse($start)->copy();
        $todayObj = Carbon::today();
        while ($periodAdmin->lte($end)) {
            $monthStart = $periodAdmin->copy()->startOfMonth();
            $monthEnd = $periodAdmin->copy()->endOfMonth();
            // (stat bulan loop continues)

            $rangeStart = $monthStart->gt($start) ? $monthStart->copy() : $start->copy();
            $rangeEnd = $monthEnd->lt($end) ? $monthEnd->copy() : $end->copy();

            $label = $monthStart->locale('id')->isoFormat('MMMM');
            if ($rangeStart->gt($todayObj)) {
                $stat_month_admin[$label] = null;
                $periodAdmin->addMonth();
                continue;
            }

            $present = 0;
            $absent = 0;
            $late = 0;
            $on_leave = 0;
            $sick = 0;

            foreach ($internIdsAll as $uid) {
                $intern = $internsAll->get($uid);
                $internStart = $rangeStart->copy();
                $internEnd = $rangeEnd->copy();
                if ($intern) {
                    if ($intern->mulai_magang) {
                        $mm = Carbon::parse($intern->mulai_magang)->startOfDay();
                        if ($mm->gt($internStart))
                            $internStart = $mm;
                    }
                    if ($intern->akhir_magang) {
                        $am = Carbon::parse($intern->akhir_magang)->endOfDay();
                        if ($am->lt($internEnd))
                            $internEnd = $am;
                    }
                }

                if ($internEnd->gt($todayObj)) {
                    $internEnd = $todayObj->copy();
                }

                if ($internStart->gt($internEnd))
                    continue;

                for ($d = $internStart->copy(); $d->lte($internEnd); $d->addDay()) {
                    $date = $d->toDateString();
                    if ($d->isWeekend() || in_array($date, $liburDates))
                        continue;

                    $absRow = isset($absensiMapAdmin[$uid][$date]) ? $absensiMapAdmin[$uid][$date] : null;
                    $hasMasuk = $absRow && $absRow->masuk > 0;
                    $hasPulang = $absRow && $absRow->pulang > 0;
                    $isLate = $absRow && $absRow->telat > 0;

                    // cari leave_requests
                    $leave_requestsToday = null;
                    if (isset($leave_requestsMapAdmin[$uid])) {
                        foreach ($leave_requestsMapAdmin[$uid] as $iz) {
                            if (Carbon::parse($iz->tanggal_mulai)->toDateString() <= $date && Carbon::parse($iz->tanggal_selesai)->toDateString() >= $date) {
                                $leave_requestsToday = $iz;
                                break;
                            }
                        }
                    }

                    if ($hasMasuk && $hasPulang) {
                        $present++;
                        if ($isLate)
                            $late++;
                    } elseif ($leave_requestsToday) {
                        if ($leave_requestsToday->jenis_izin === 'sakit')
                            $sick++;
                        else
                            $on_leave++;
                    } else {
                        $absent++;
                    }
                }
            }

            if ($present === 0 && $absent === 0 && $late === 0 && $on_leave === 0 && $sick === 0) {
                $stat_month_admin[$label] = null;
            } else {
                $stat_month_admin[$label] = [
                    'present' => $present,
                    'absent' => $absent,
                    'late' => $late,
                    'on_leave' => $on_leave,
                    'sick' => $sick,
                ];
            }

            $periodAdmin->addMonth();
        }

        // --- Compute early leaves per month (pulang sebelum 17:00) and merge into $stat_month_admin ---
        try {
            $driver = \DB::getPdo()->getAttribute(\PDO::ATTR_DRIVER_NAME);
        } catch (\Throwable $e) {
            $driver = config('database.default');
        }
        if ($driver === 'sqlite') {
            $timeExpr = "strftime('%H:%M:%S', waktu)";
            $yearExprLocal = "strftime('%Y', tanggal)";
            $monthExprLocal = "strftime('%m', tanggal)";
        } else {
            $timeExpr = 'TIME(waktu)';
            $yearExprLocal = 'YEAR(tanggal)';
            $monthExprLocal = 'MONTH(tanggal)';
        }

        $earlyAgg = [];
        if (!empty($internIdsAll)) {
            // Count early flags recorded on attendances (early = boolean)
            $earlyRows = \App\Models\TblAbsensi::selectRaw(
                "{$monthExprLocal} as bulan, {$yearExprLocal} as tahun, SUM(CASE WHEN early = 1 THEN 1 ELSE 0 END) as early_count"
            )
                ->whereIn('user_id', $internIdsAll)
                ->whereBetween('tanggal', [$start->toDateString(), min($end->toDateString(), Carbon::today()->toDateString())])
                ->groupBy('bulan', 'tahun')
                ->get();

            foreach ($earlyRows as $r) {
                $key = intval($r->bulan) . '-' . intval($r->tahun);
                $earlyAgg[$key] = intval($r->early_count);
            }
        }

        // Rebuild stat_month_admin to inject 'early' values per month
        $mergedStat = [];
        $period = Carbon::parse($start)->copy();
        while ($period->lte($end)) {
            $monthStart = $period->copy()->startOfMonth();
            $label = $monthStart->locale('id')->isoFormat('MMMM');
            $m = intval($monthStart->month);
            $y = intval($monthStart->year);
            if (!array_key_exists($label, $stat_month_admin) || is_null($stat_month_admin[$label])) {
                $mergedStat[$label] = $stat_month_admin[$label] ?? null;
            } else {
                $k = $m . '-' . $y;
                $earlyCount = $earlyAgg[$k] ?? 0;
                $mergedStat[$label] = $stat_month_admin[$label];
                $mergedStat[$label]['early'] = $earlyCount;
            }
            $period->addMonth();
        }
        $stat_month_admin = $mergedStat;

        // ---------- Additional admin aggregates: early leaves, evaluation by university, division distribution ----------
        // Detect DB driver for time extraction
        try {
            $driver = \DB::getPdo()->getAttribute(\PDO::ATTR_DRIVER_NAME);
        } catch (\Throwable $e) {
            $driver = config('database.default');
        }

        if ($driver === 'sqlite') {
            $timeExpr = "strftime('%H:%M:%S', waktu)";
        } else {
            $timeExpr = 'TIME(waktu)';
        }

        $earlyLeaveCount = 0;
        if (!empty($internIdsAll)) {
            $earlyLeaveCount = \App\Models\TblAbsensi::whereIn('user_id', $internIdsAll)
                ->whereBetween('tanggal', [$start->toDateString(), min($end->toDateString(), Carbon::today()->toDateString())])
                ->where('early', 1)
                ->count();
        }

            // Unique hadir hari ini (admin view) - used for 'belum_absen' calculation
            $unikAbsenToday = 0;
            if (!empty($internIdsPeriod)) {
                $unikAbsenToday = \App\Models\TblAbsensi::whereIn('user_id', $internIdsPeriod)
                    ->where('tanggal', Carbon::today()->toDateString())
                    ->where('status', 'masuk')
                    ->distinct('user_id')
                    ->count('user_id');
            }

        // Evaluation stats grouped by university and year: name, year, intern_count, avg_score
        $evaluationsPerUniv = [];
        // Aggregate evaluations per university and year for all finalized (admin reviewed) evaluations
        // This is intentionally global (not restricted to current filter period)
        // determine year expression using evaluation_date fallback to created_at
        if ($driver === 'sqlite') {
            $yearExprEval = "strftime('%Y', COALESCE(evaluations.evaluation_date, evaluations.created_at))";
        } else {
            $yearExprEval = "YEAR(COALESCE(evaluations.evaluation_date, evaluations.created_at))";
        }

        $evalRows = \DB::table('evaluations')
            ->join('students', 'evaluations.user_id', '=', 'students.user_id')
            ->selectRaw("students.universitas as universitas, {$yearExprEval} as tahun, COUNT(DISTINCT evaluations.user_id) as intern_count, AVG(evaluations.final_score_numeric) as avg_score")
            ->where('evaluations.admin_reviewed', 1)
            ->groupBy('students.universitas', 'tahun')
            ->get();

        foreach ($evalRows as $r) {
            $evaluationsPerUniv[] = [
                'universitas' => $r->universitas,
                'year' => $r->tahun !== null ? intval($r->tahun) : null,
                'intern_count' => intval($r->intern_count),
                'average_score' => $r->avg_score !== null ? round(floatval($r->avg_score), 1) : null,
            ];
        }

        // Also compute global average per year across all universities
        $evaluationsGlobalPerYear = [];
        $evalGlobalRows = \DB::table('evaluations')
            ->selectRaw("{$yearExprEval} as tahun, COUNT(DISTINCT evaluations.user_id) as intern_count, AVG(evaluations.final_score_numeric) as avg_score")
            ->where('evaluations.admin_reviewed', 1)
            ->groupBy('tahun')
            ->get();

        foreach ($evalGlobalRows as $g) {
            $evaluationsGlobalPerYear[] = [
                'year' => $g->tahun !== null ? intval($g->tahun) : null,
                'intern_count' => intval($g->intern_count),
                'average_score' => $g->avg_score !== null ? round(floatval($g->avg_score), 1) : null,
            ];
        }

        // Division distribution (by students.division)
        $divisionDistribution = [];
        if (!empty($internIdsPeriod)) {
            $divisionDistribution = \App\Models\TblMahasiswa::whereIn('user_id', $internIdsPeriod)
                ->pluck('division')
                ->filter()
                ->map(fn($d) => trim($d))
                ->countBy()
                ->sortDesc()
                ->toArray();
        }

        // -------------------------------------------------------------

        return [
            'filter_period' => [
                'start' => $start->toDateString(),
                'end' => $end->toDateString(),
            ],
            'users' => [
                'intern' => $totalIntern,
                'aktif' => $userAktif,
                'inaktif' => $userInaktif,
            ],
            'interns' => [
                'active_count' => $userAktif,
                'universitas_available' => $universities,
                'universitas_available_count' => count($universities),
                'universitas_distribution' => $universitasDistribution,
                'jurusan_distribution' => $jurusanDistribution,
                'division_distribution' => $divisionDistribution,
                'evaluation' => $evaluationsPerUniv,
                'evaluation_global' => $evaluationsGlobalPerYear,
                'ending_soon' => [
                    'count' => $endingSoonTotalCount ?? (is_array($endingSoon) ? count($endingSoon) : $endingSoon->count()),
                    'data' => (is_array($endingSoon) ? $endingSoon : $endingSoon->values()->all()),
                ],
            ],
            'hari_ini' => [
                'tanggal' => $today,
                'periode' => $start->toDateString() . ' - ' . $end->toDateString(),
                'total_absen_masuk' => $absenMasukPeriode,
                'unik_absen_user' => $unikAbsenUsers,
                'unik_absen_hari_ini' => $unikAbsenToday,
                'belum_absen' => max(0, $totalIntern - $unikAbsenToday),
                'early_leave_count' => $earlyLeaveCount,
            ],
            'pending_approval' => [
                'leave_requests' => $leave_requestsPending,
                'logbooks' => $logbooksPending,
                'total' => $leave_requestsPending + $logbooksPending,
            ],
            'statistik_bulan_ini' => [
                'total_absensi' => $absenMasukPeriode,
            ],
            'statistik_bulanan' => $stat_month_admin,
            'server_time' => Carbon::now()->toDateTimeString(),
        ];
    }

    /**
     * Export dashboard data for admin (JSON payload)
     */
    public function exportAdmin(Request $request)
    {
        $user = $request->user();
        // Ensure admin access
        $roles = $user->getRoleNames();
        $requestedRole = $request->input('role');
        $role = $requestedRole ?? (is_array($roles) ? ($roles[0] ?? null) : $roles->first());
        if ($role !== 'admin' && !$user->hasRole('admin')) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        // Reuse admin dashboard calculation
        $adminData = $this->getAdminDashboard($user);

        // Summary
        $summary = [
            'total_interns' => $adminData['users']['intern'] ?? 0,
            'total_universities' => $adminData['interns']['universitas_available_count'] ?? 0,
            'ending_soon' => $adminData['interns']['ending_soon']['count'] ?? 0,
            'active_now' => $adminData['interns']['active_count'] ?? ($adminData['users']['aktif'] ?? 0),
        ];

        // Attendance series (convert statistik_bulanan to array of objects)
        $attendance_series = [];
        foreach ($adminData['statistik_bulanan'] as $label => $vals) {
            $labelShort = mb_substr($label, 0, 3);
            if (is_null($vals)) {
                $attendance_series[] = [
                    'label' => $labelShort,
                    'present' => 0,
                    'late' => 0,
                    'on_leave' => 0,
                    'sick' => 0,
                    'absent' => 0,
                ];
            } else {
                $attendance_series[] = [
                    'label' => $labelShort,
                    'present' => $vals['present'] ?? 0,
                    'late' => $vals['late'] ?? 0,
                    'on_leave' => $vals['on_leave'] ?? 0,
                    'sick' => $vals['sick'] ?? 0,
                    'absent' => $vals['absent'] ?? 0,
                ];
            }
        }

        // Universities & programs
        $universities = [];
        foreach ($adminData['interns']['universitas_distribution'] ?? [] as $name => $count) {
            $universities[] = ['name' => $name, 'count' => $count];
        }
        $programs = [];
        foreach ($adminData['interns']['jurusan_distribution'] ?? [] as $name => $count) {
            $programs[] = ['name' => $name, 'count' => $count];
        }
        // Divisions
        $divisions = [];
        foreach ($adminData['interns']['division_distribution'] ?? [] as $name => $count) {
            $divisions[] = ['name' => $name, 'count' => $count];
        }

        // Evaluations (per-university/year) and global per-year
        $evaluations = $adminData['interns']['evaluation'] ?? [];
        $evaluations_global = $adminData['interns']['evaluation_global'] ?? [];

        $endingList = $adminData['interns']['ending_soon']['data'] ?? $adminData['interns']['ending_soon'] ?? [];

        $payload = [
            'success' => true,
            'filter_period' => $adminData['filter_period'] ?? ['start' => null, 'end' => null],
            'server_time' => $adminData['server_time'] ?? Carbon::now()->toDateTimeString(),
            'summary' => $summary,
            'attendance_series' => $attendance_series,
            'universities' => $universities,
            'programs' => $programs,
            'divisions' => $divisions,
            'evaluations' => $evaluations,
            'evaluations_global' => $evaluations_global,
            'ending_soon' => $endingList,
        ];

        return response()->json($payload);
    }

    /**
     * Admin endpoint: list all interns ending soon (paginated)
     */
    public function adminEndingSoon(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->hasRole('admin')) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $perPage = intval($request->input('per_page', 25));
        $today = Carbon::today()->toDateString();
        $cutoff = Carbon::now()->addDays(30)->toDateString();

        $query = \App\Models\TblMahasiswa::whereHas('user', fn($q) => $q->whereHas('roles', fn($q2) => $q2->where('name', 'intern')))
            ->whereNotNull('akhir_magang')
            ->whereBetween('akhir_magang', [$today, $cutoff])
            ->with('user:user_id,nama')
            ->select(['id_mahasiswa','user_id', 'universitas', 'akhir_magang']);

        $paginated = $query->orderBy('akhir_magang', 'asc')->paginate($perPage);

        $paginated->getCollection()->transform(function ($m) {
            return [
                'user_id' => $m->user_id,
                'id_mahasiswa' => $m->id_mahasiswa ?? null,
                'nama' => $m->user ? $m->user->nama : null,
                'universitas' => $m->universitas,
                'akhir_magang' => $m->akhir_magang,
                'days_left' => Carbon::parse($m->akhir_magang)->diffInDays(Carbon::today(), false),
            ];
        });

        return response()->json($paginated);
    }

    /**
     * Mentor endpoint: list all interns ending soon for this mentor (paginated)
     */
    public function mentorEndingSoon(Request $request)
    {
        $user = $request->user();
        if (!$user || ! $user->hasRole('mentor')) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $perPage = intval($request->input('per_page', 25));
        $today = Carbon::today()->toDateString();
        $cutoff = Carbon::now()->addDays(30)->toDateString();

        $mentorKaryawanId = $user->karyawan?->id_karyawan;
        if ($mentorKaryawanId) {
            $mentorInternRaw = \DB::table('intern_mentors')
                ->where('mentor_id', $mentorKaryawanId)
                ->where('is_active', 1)
                ->pluck('intern_id')
                ->unique()
                ->toArray();
        } else {
            $mentorInternRaw = \DB::table('intern_mentors')
                ->where('mentor_user_id', $user->user_id)
                ->where('is_active', 1)
                ->pluck('intern_id')
                ->unique()
                ->toArray();
        }

        // intern_mentors.intern_id stores mahasiswa id on current schema; convert to users.user_id.
        $mentorInternIds = empty($mentorInternRaw)
            ? []
            : \App\Models\TblMahasiswa::whereIn('id_mahasiswa', $mentorInternRaw)->pluck('user_id')->toArray();

        if (empty($mentorInternIds)) {
            return response()->json([
                'success' => true,
                'data' => [
                    'total' => 0,
                    'data' => []
                ]
            ]);
        }

        $query = \App\Models\TblMahasiswa::whereIn('user_id', $mentorInternIds)
            ->where(function($q) use ($today, $cutoff) {
                $q->whereBetween('akhir_magang', [$today, $cutoff])
                  ->orWhereExists(function($sub) use ($today, $cutoff) {
                      $sub->select(\DB::raw(1))
                          ->from('intern_mentors')
                          ->whereColumn('intern_mentors.intern_id', 'students.id_mahasiswa')
                          ->whereBetween('intern_mentors.end_date', [$today, $cutoff]);
                  });
            })
            ->with('user:user_id,nama')
            ->select(['id_mahasiswa','user_id', 'universitas', 'akhir_magang']);

        $paginated = $query->orderBy('akhir_magang', 'asc')->paginate($perPage);

        $paginated->getCollection()->transform(function ($m) {
            return [
                'user_id' => $m->user_id,
                'id_mahasiswa' => $m->id_mahasiswa ?? null,
                'nama' => $m->user ? $m->user->nama : null,
                'universitas' => $m->universitas,
                'akhir_magang' => $m->akhir_magang,
                'days_left' => $m->akhir_magang ? Carbon::parse($m->akhir_magang)->diffInDays(Carbon::today(), false) : null,
            ];
        });

        return response()->json($paginated);
    }

    /**
     * Server-side export package (ZIP) containing JSON and chart images for Admin dashboard
     * Produces a ZIP file with: export.json, chart_attendance.png, report.html
     */
    public function exportAdminPackage(Request $request)
    {

        $user = $request->user();
        $roles = $user->getRoleNames();
        $requestedRole = $request->input('role');
        $role = $requestedRole ?? (is_array($roles) ? ($roles[0] ?? null) : $roles->first());

        if ($role !== 'admin' && !$user->hasRole('admin')) {
            return response()->json(['success' => false, 'message' => 'Unauthorized'], 403);
        }

        $adminData = $this->getAdminDashboard($user);
        $timestamp = now()->format('Ymd_His');
        $exportDir = storage_path('app/exports');
        if (!is_dir($exportDir))
            mkdir($exportDir, 0755, true);

        // --- 1. CONFIG CHART ---
        $labels = array_keys($adminData['statistik_bulanan']);
        $chartConfig = [
            'type' => 'bar',
            'data' => [
                'labels' => $labels,
                'datasets' => [
                    ['label' => 'Present', 'data' => array_column($adminData['statistik_bulanan'], 'present'), 'backgroundColor' => 'rgba(34,197,94,0.7)'],
                    ['label' => 'Late', 'data' => array_column($adminData['statistik_bulanan'], 'late'), 'backgroundColor' => 'rgba(234,88,12,0.8)'],
                    ['label' => 'On Leave', 'data' => array_column($adminData['statistik_bulanan'], 'on_leave'), 'backgroundColor' => 'rgba(59,130,246,0.7)'],
                    ['label' => 'Sick', 'data' => array_column($adminData['statistik_bulanan'], 'sick'), 'backgroundColor' => 'rgba(107,114,128,0.7)'],
                    ['label' => 'Absent', 'data' => array_column($adminData['statistik_bulanan'], 'absent'), 'backgroundColor' => 'rgba(239,68,68,0.7)'],
                ],
            ],
            'options' => [
                'plugins' => [
                    'legend' => ['position' => 'top'],
                    'datalabels' => [
                        'display' => true,
                        'font' => ['weight' => 'bold']
                    ]
                ],
                'scales' => ['y' => ['beginAtZero' => true]]
            ]
        ];

        // --- 2. GENERATE PNG VIA QUICKCHART ---
        $chartPath = $exportDir . '/chart_' . $timestamp . '.png';
        $chartUnivPath = $exportDir . '/chart_univ_' . $timestamp . '.png';
        $chartMajorPath = $exportDir . '/chart_major_' . $timestamp . '.png';
        
        $client = new Client(['verify' => false]);

        // Generate Attendance Chart
        try {
            $res = $client->post('https://quickchart.io/chart', [
                'json' => [
                    'chart' => $chartConfig,
                    'width' => 800,
                    'height' => 400,
                    'format' => 'png'
                ],
                'timeout' => 45
            ]);
            file_put_contents($chartPath, $res->getBody()->getContents());
        } catch (\Throwable $e) {
            Log::error('QuickChart Attendance Error: ' . $e->getMessage());
            file_put_contents($chartPath, '');
        }

        // Generate University Distribution Chart
        try {
            $univLabels = array_keys($adminData['interns']['universitas_distribution'] ?? []);
            $univData = array_values($adminData['interns']['universitas_distribution'] ?? []);
            
            $resUniv = $client->post('https://quickchart.io/chart', [
                'json' => [
                    'chart' => [
                        'type' => 'doughnut',
                        'data' => [
                            'labels' => $univLabels,
                            'datasets' => [['data' => $univData]]
                        ],
                        'options' => [
                            'plugins' => [
                                'legend' => ['position' => 'right'],
                                'title' => ['display' => true, 'text' => 'Institution Distribution'],
                                'datalabels' => [
                                    'display' => true,
                                    'color' => '#fff',
                                    'font' => ['weight' => 'bold', 'size' => 12]
                                ]
                            ]
                        ]
                    ],
                    'width' => 500,
                    'height' => 300,
                    'format' => 'png'
                ]
            ]);
            file_put_contents($chartUnivPath, $resUniv->getBody()->getContents());
        } catch (\Throwable $e) {
            Log::error('QuickChart Univ Error: ' . $e->getMessage());
        }

        // Generate Major Distribution Chart
        try {
            $majorLabels = array_keys($adminData['interns']['jurusan_distribution'] ?? []);
            $majorData = array_values($adminData['interns']['jurusan_distribution'] ?? []);
            
            $resMajor = $client->post('https://quickchart.io/chart', [
                'json' => [
                    'chart' => [
                        'type' => 'pie',
                        'data' => [
                            'labels' => $majorLabels,
                            'datasets' => [['data' => $majorData]]
                        ],
                        'options' => [
                            'plugins' => [
                                'legend' => ['position' => 'right'],
                                'title' => ['display' => true, 'text' => 'Program Studi Distribution'],
                                'datalabels' => [
                                    'display' => true,
                                    'color' => '#fff',
                                    'font' => ['weight' => 'bold', 'size' => 12]
                                ]
                            ]
                        ]
                    ],
                    'width' => 500,
                    'height' => 300,
                    'format' => 'png'
                ]
            ]);
            file_put_contents($chartMajorPath, $resMajor->getBody()->getContents());
        } catch (\Throwable $e) {
            Log::error('QuickChart Major Error: ' . $e->getMessage());
        }

        // Generate Division Distribution Chart
        $chartDivisionPath = $exportDir . '/chart_division_' . $timestamp . '.png';
        try {
            $divLabels = array_keys($adminData['interns']['division_distribution'] ?? []);
            $divData = array_values($adminData['interns']['division_distribution'] ?? []);

            $resDiv = $client->post('https://quickchart.io/chart', [
                'json' => [
                    'chart' => [
                        'type' => 'pie',
                        'data' => [
                            'labels' => $divLabels,
                            'datasets' => [['data' => $divData]]
                        ],
                        'options' => [
                            'plugins' => [
                                'legend' => ['position' => 'right'],
                                'title' => ['display' => true, 'text' => 'Division Distribution'],
                            ]
                        ]
                    ],
                    'width' => 500,
                    'height' => 300,
                    'format' => 'png'
                ]
            ]);
            file_put_contents($chartDivisionPath, $resDiv->getBody()->getContents());
        } catch (\Throwable $e) {
            Log::error('QuickChart Division Error: ' . $e->getMessage());
            file_put_contents($chartDivisionPath, '');
        }

        // Generate Evaluation Average Bar Chart (per-university for the latest year available)
        $chartEvalPath = $exportDir . '/chart_eval_' . $timestamp . '.png';
        try {
            $evalPerUniv = $adminData['interns']['evaluation'] ?? [];
            // find latest year present
            $years = array_unique(array_filter(array_map(fn($r) => $r['year'] ?? null, $evalPerUniv)));
            rsort($years);
            $latestYear = $years[0] ?? null;
            $evalLabels = [];
            $evalData = [];
            if ($latestYear !== null) {
                foreach ($evalPerUniv as $row) {
                    if (($row['year'] ?? null) == $latestYear) {
                        $evalLabels[] = $row['universitas'] ?? 'Unknown';
                        $evalData[] = $row['average_score'] ?? 0;
                    }
                }
            }

            // Fallback: if no per-univ data for latest year, use global per-year as single series
            if (empty($evalLabels)) {
                $evalGlobal = $adminData['interns']['evaluation_global'] ?? [];
                $evalLabels = array_map(fn($r) => $r['year'] ?? 'N/A', $evalGlobal);
                $evalData = array_map(fn($r) => $r['average_score'] ?? 0, $evalGlobal);
            }

            $chartEval = [
                'type' => 'bar',
                'data' => [
                    'labels' => $evalLabels,
                    'datasets' => [[
                        'label' => $latestYear ? "Average Evaluation ({$latestYear})" : 'Average Evaluation',
                        'data' => $evalData,
                        'backgroundColor' => 'rgba(59,130,246,0.8)'
                    ]]
                ],
                'options' => [
                    'plugins' => [
                        'legend' => ['display' => false],
                        'title' => ['display' => true, 'text' => $latestYear ? "Average Evaluation by University ({$latestYear})" : 'Average Evaluation']
                    ],
                    'scales' => ['y' => ['beginAtZero' => true, 'max' => 100]]
                ]
            ];

            $resEval = $client->post('https://quickchart.io/chart', [
                'json' => [
                    'chart' => $chartEval,
                    'width' => 800,
                    'height' => 400,
                    'format' => 'png'
                ],
                'timeout' => 45
            ]);
            file_put_contents($chartEvalPath, $resEval->getBody()->getContents());
        } catch (\Throwable $e) {
            Log::error('QuickChart Eval Error: ' . $e->getMessage());
            file_put_contents($chartEvalPath, '');
        }

        $type = strtolower($request->input('type', 'excel'));

        // Debug log
        Log::info('Export type requested: ' . $type);

        // --- 4. EXPORT LOGIC ---
        if (in_array($type, ['excel', 'xlsx'])) {
            try {
                $spreadsheet = new Spreadsheet();
                $sheet = $spreadsheet->getActiveSheet();
                $sheet->setTitle('Summary');

                // Add summary data
                $sheet->setCellValue('A1', 'Total Interns');
                $sheet->setCellValue('B1', $adminData['users']['intern'] ?? 0);
                $sheet->setCellValue('A2', 'Total Universities');
                $sheet->setCellValue('B2', $adminData['interns']['universitas_available_count'] ?? 0);
                $sheet->setCellValue('A3', 'Active Interns');
                $sheet->setCellValue('B3', $adminData['users']['aktif'] ?? 0);
                $sheet->setCellValue('A4', 'Ending Soon');
                $sheet->setCellValue('B4', $adminData['interns']['ending_soon']['count'] ?? 0);

                // Add attendance series headers
                $sheet->setCellValue('A6', 'Month');
                $sheet->setCellValue('B6', 'Present');
                $sheet->setCellValue('C6', 'Late');
                $sheet->setCellValue('D6', 'On Leave');
                $sheet->setCellValue('E6', 'Sick');
                $sheet->setCellValue('F6', 'Absent');

                $row = 7;
                foreach ($adminData['statistik_bulanan'] as $label => $vals) {
                    $sheet->setCellValue('A' . $row, $label);
                    if (is_null($vals)) {
                        $sheet->setCellValue('B' . $row, 0);
                        $sheet->setCellValue('C' . $row, 0);
                        $sheet->setCellValue('D' . $row, 0);
                        $sheet->setCellValue('E' . $row, 0);
                        $sheet->setCellValue('F' . $row, 0);
                    } else {
                        $sheet->setCellValue('B' . $row, $vals['present'] ?? 0);
                        $sheet->setCellValue('C' . $row, $vals['late'] ?? 0);
                        $sheet->setCellValue('D' . $row, $vals['on_leave'] ?? 0);
                        $sheet->setCellValue('E' . $row, $vals['sick'] ?? 0);
                        $sheet->setCellValue('F' . $row, $vals['absent'] ?? 0);
                    }
                    $row++;
                }

                // Add University Distribution
                $row += 2;
                $sheet->setCellValue('A' . $row, 'Institution Distribution');
                $sheet->getStyle('A' . $row)->getFont()->setBold(true);
                $row++;
                $sheet->setCellValue('A' . $row, 'Institution');
                $sheet->setCellValue('B' . $row, 'Total');
                $sheet->getStyle('A' . $row . ':B' . $row)->getFont()->setBold(true);
                $row++;
                
                $univDist = $adminData['interns']['universitas_distribution'] ?? [];
                if (!empty($univDist)) {
                    foreach ($univDist as $univ => $count) {
                        $sheet->setCellValue('A' . $row, $univ);
                        $sheet->setCellValue('B' . $row, $count);
                        $row++;
                    }
                } else {
                    $sheet->setCellValue('A' . $row, 'No data');
                    $row++;
                }

                // Add Program Studi Distribution
                $row += 2;
                $sheet->setCellValue('A' . $row, 'Program Studi Distribution');
                $sheet->getStyle('A' . $row)->getFont()->setBold(true);
                $row++;
                $sheet->setCellValue('A' . $row, 'Major');
                $sheet->setCellValue('B' . $row, 'Total');
                $sheet->getStyle('A' . $row . ':B' . $row)->getFont()->setBold(true);
                $row++;

                $jurusanDist = $adminData['interns']['jurusan_distribution'] ?? [];
                if (!empty($jurusanDist)) {
                    foreach ($jurusanDist as $jurusan => $count) {
                        $sheet->setCellValue('A' . $row, $jurusan);
                        $sheet->setCellValue('B' . $row, $count);
                        $row++;
                    }
                } else {
                    $sheet->setCellValue('A' . $row, 'No data');
                    $row++;
                }

                $sheet->getColumnDimension('A')->setAutoSize(true);
                $sheet->getColumnDimension('B')->setAutoSize(true);

                // Add Division Distribution table (from interns.division_distribution)
                $row += 2;
                $sheet->setCellValue('A' . $row, 'Division Distribution');
                $sheet->getStyle('A' . $row)->getFont()->setBold(true);
                $row++;
                $sheet->setCellValue('A' . $row, 'Division');
                $sheet->setCellValue('B' . $row, 'Total');
                $sheet->getStyle('A' . $row . ':B' . $row)->getFont()->setBold(true);
                $row++;
                $dist = $adminData['interns']['division_distribution'] ?? [];
                if (!empty($dist)) {
                    foreach ($dist as $name => $count) {
                        $sheet->setCellValue('A' . $row, $name);
                        $sheet->setCellValue('B' . $row, $count);
                        $row++;
                    }
                } else {
                    $sheet->setCellValue('A' . $row, 'No data');
                    $row++;
                }

                // Add Evaluations table (per-university / per-year)
                $row += 2;
                $sheet->setCellValue('A' . $row, 'Evaluations (University / Year)');
                $sheet->getStyle('A' . $row)->getFont()->setBold(true);
                $row++;
                $sheet->setCellValue('A' . $row, 'University');
                $sheet->setCellValue('B' . $row, 'Year');
                $sheet->setCellValue('C' . $row, 'Intern Count');
                $sheet->setCellValue('D' . $row, 'Average Score');
                $sheet->getStyle('A' . $row . ':D' . $row)->getFont()->setBold(true);
                $row++;
                $evals = $adminData['interns']['evaluation'] ?? [];
                if (!empty($evals)) {
                    foreach ($evals as $e) {
                        $sheet->setCellValue('A' . $row, $e['universitas'] ?? '');
                        $sheet->setCellValue('B' . $row, $e['year'] ?? '');
                        $sheet->setCellValue('C' . $row, $e['intern_count'] ?? 0);
                        $sheet->setCellValue('D' . $row, $e['average_score'] ?? null);
                        $row++;
                    }
                } else {
                    $sheet->setCellValue('A' . $row, 'No data');
                    $row++;
                }

                // Add Global Evaluations table (per year)
                $row += 2;
                $sheet->setCellValue('A' . $row, 'Global Evaluation (Year)');
                $sheet->getStyle('A' . $row)->getFont()->setBold(true);
                $row++;
                $sheet->setCellValue('A' . $row, 'Year');
                $sheet->setCellValue('B' . $row, 'Intern Count');
                $sheet->setCellValue('C' . $row, 'Average Score');
                $sheet->getStyle('A' . $row . ':C' . $row)->getFont()->setBold(true);
                $row++;
                $evalGlobal = $adminData['interns']['evaluation_global'] ?? [];
                if (!empty($evalGlobal)) {
                    foreach ($evalGlobal as $g) {
                        $sheet->setCellValue('A' . $row, $g['year'] ?? '');
                        $sheet->setCellValue('B' . $row, $g['intern_count'] ?? 0);
                        $sheet->setCellValue('C' . $row, $g['average_score'] ?? null);
                        $row++;
                    }
                } else {
                    $sheet->setCellValue('A' . $row, 'No data');
                    $row++;
                }

                // Add attendance chart
                if (file_exists($chartPath) && filesize($chartPath) > 0) {
                    $drawing = new \PhpOffice\PhpSpreadsheet\Worksheet\Drawing();
                    $drawing->setName('Attendance Chart');
                    $drawing->setPath($chartPath);
                    $drawing->setHeight(300);
                    $drawing->setCoordinates('H6'); // Right of attendance data
                    $drawing->setWorksheet($sheet);
                }

                if (file_exists($chartUnivPath) && filesize($chartUnivPath) > 0) {
                    $drawingUniv = new \PhpOffice\PhpSpreadsheet\Worksheet\Drawing();
                    $drawingUniv->setName('Institution Chart');
                    $drawingUniv->setPath($chartUnivPath);
                    $drawingUniv->setHeight(250);
                    $drawingUniv->setCoordinates('H23'); // Right of univ distribution
                    $drawingUniv->setWorksheet($sheet);
                }

                if (file_exists($chartMajorPath) && filesize($chartMajorPath) > 0) {
                    $drawingMajor = new \PhpOffice\PhpSpreadsheet\Worksheet\Drawing();
                    $drawingMajor->setName('Major Chart');
                    $drawingMajor->setPath($chartMajorPath);
                    $drawingMajor->setHeight(250);
                    $drawingMajor->setCoordinates('H38'); // Right of major distribution
                    $drawingMajor->setWorksheet($sheet);
                }

                if (isset($chartDivisionPath) && file_exists($chartDivisionPath) && filesize($chartDivisionPath) > 0) {
                    $drawingDiv = new \PhpOffice\PhpSpreadsheet\Worksheet\Drawing();
                    $drawingDiv->setName('Division Chart');
                    $drawingDiv->setPath($chartDivisionPath);
                    $drawingDiv->setHeight(250);
                    $drawingDiv->setCoordinates('H53'); // Below other charts
                    $drawingDiv->setWorksheet($sheet);
                }

                if (isset($chartEvalPath) && file_exists($chartEvalPath) && filesize($chartEvalPath) > 0) {
                    $drawingEval = new \PhpOffice\PhpSpreadsheet\Worksheet\Drawing();
                    $drawingEval->setName('Evaluation Chart');
                    $drawingEval->setPath($chartEvalPath);
                    $drawingEval->setHeight(300);
                    $drawingEval->setCoordinates('H70'); // Below division chart
                    $drawingEval->setWorksheet($sheet);
                }

                $writer = new \PhpOffice\PhpSpreadsheet\Writer\Xlsx($spreadsheet);
                $excelPath = $exportDir . "/Dashboard_Data_{$timestamp}.xlsx";
                $writer->save($excelPath);

                // Cleanup chart files
                @unlink($chartPath);
                @unlink($chartUnivPath);
                @unlink($chartMajorPath);
                if (isset($chartDivisionPath)) {
                    @unlink($chartDivisionPath);
                }
                if (isset($chartEvalPath)) {
                    @unlink($chartEvalPath);
                }

                return response()->download($excelPath)->deleteFileAfterSend(true);
            } catch (\Throwable $e) {
                Log::error('Excel export error: ' . $e->getMessage());
                return response()->json(['success' => false, 'message' => 'Excel export failed: ' . $e->getMessage()], 500);
            }
        }

        return response()->json(['success' => false, 'message' => 'Unsupported export type: ' . $type], 400);
    }
}