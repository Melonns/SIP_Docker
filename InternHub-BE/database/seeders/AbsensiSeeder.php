<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\TblAbsensi;
use App\Models\Izin;
use App\Models\User;
use App\Models\KoreksiAbsensi;
use Carbon\Carbon;

class AbsensiSeeder extends Seeder
{
    private $holidays = [
        '2026-01-01', // Hari Tahun Baru
        '2026-01-16', // Isra Mikraj Nabi Muhammad
        '2026-02-16', // Cuti Bersama Tahun Baru Imlek
        '2026-02-17', // Tahun Baru Imlek
        '2026-03-18', // Cuti Bersama Hari Suci Nyepi
        '2026-03-19', // Hari Suci Nyepi
        '2026-03-20', // Cuti Bersama Idul Fitri
        '2026-03-21', // Hari Idul Fitri
        '2026-03-23', // Cuti Bersama Idul Fitri
        '2026-03-24', // Cuti Bersama Idul Fitri
        '2026-04-03', // Wafat Isa Almasih
        '2026-04-05', // Hari Paskah
        '2026-05-01', // Hari Buruh
        '2026-05-14', // Kenaikan Isa Al Masih
        '2026-05-15', // Cuti Bersama Kenaikan Isa Al Masih
        '2026-05-27', // Idul Adha
        '2026-05-28', // Idul Adha
        '2026-05-31', // Hari Raya Waisak
        '2026-06-01', // Hari Lahir Pancasila
        '2026-06-16', // Satu Muharam
        '2026-08-17', // Hari Proklamasi
        '2026-08-25', // Maulid Nabi Muhammad
        '2026-12-24', // Cuti Bersama Natal
        '2026-12-25', // Hari Raya Natal
    ];

    private function isWorkingDay(Carbon $date): bool
    {
        // Skip weekend
        if ($date->isWeekend()) {
            return false;
        }
        
        // Skip holidays
        if (in_array($date->toDateString(), $this->holidays)) {
            return false;
        }
        
        return true;
    }

    public function run(): void
    {
        // 1. Ambil semua user dengan role intern
        $interns = User::whereHas('roles', fn($q) => $q->where('name', 'intern'))->get();

        foreach ($interns as $intern) {
            // Use mahasiswa.mulai_magang if available (startOfDay);
            // otherwise fall back to user's created_at (startOfDay) if available,
            // and finally default to 2 months ago.
            if ($intern->mahasiswa && $intern->mahasiswa->mulai_magang) {
                $mulaiMagang = Carbon::parse($intern->mahasiswa->mulai_magang)->startOfDay();
            } elseif (!empty($intern->created_at)) {
                $mulaiMagang = Carbon::parse($intern->created_at)->startOfDay();
            } else {
                $mulaiMagang = Carbon::now()->subMonths(2)->startOfDay();
            }

            // Determine effective seeding end: yesterday OR internship end (whichever is earlier)
            $today = Carbon::now();
            $yesterday = $today->copy()->subDay();
            $akhirMagang = $intern->mahasiswa && $intern->mahasiswa->akhir_magang ? Carbon::parse($intern->mahasiswa->akhir_magang)->endOfDay() : null;
            if ($akhirMagang && $akhirMagang->lt($yesterday)) {
                $yesterday = $akhirMagang->copy();
            }

            // If the internship hasn't started yet or start is after effective end, skip
            if ($mulaiMagang->gt($yesterday)) {
                // Also remove any stale absensi before mulaiMagang just in case
                if ($intern->mahasiswa && $intern->mahasiswa->mulai_magang) {
                    TblAbsensi::where('user_id', $intern->user_id)
                        ->whereDate('tanggal', '<', $mulaiMagang->toDateString())
                        ->delete();
                }
                continue;
            }

            // Cleanup existing absensi entries outside internship period (pre/post)
            if ($intern->mahasiswa && $intern->mahasiswa->mulai_magang) {
                TblAbsensi::where('user_id', $intern->user_id)
                    ->whereDate('tanggal', '<', $mulaiMagang->toDateString())
                    ->delete();
            }
            if (!empty($akhirMagang)) {
                TblAbsensi::where('user_id', $intern->user_id)
                    ->whereDate('tanggal', '>', $akhirMagang->toDateString())
                    ->delete();
            }

            // Ambil daftar tanggal leave_requests yang sudah di-approve
            $tanggalIzin = $this->getTanggalIzin($intern->user_id);

            // --- LOGIKA PENENTUAN TANGGAL KHUSUS ---

            // Pilih 1 tanggal fix untuk ALPA (Tidak hadir sama sekali)
            $fixAlpaDate = null;
            // Pilih 1 tanggal fix untuk LUPA CLOCKOUT (Masuk ada, Pulang tidak ada)
            $fixLupaPulangDate = null;
            // Pilih 1 tanggal fix untuk EARLY (pulang lebih awal)
            $fixEarlyDate = null;

            $tempDate = $mulaiMagang->copy();
            while ($tempDate->lte($yesterday)) {
                $dStr = $tempDate->toDateString();
                if ($this->isWorkingDay($tempDate) && !in_array($dStr, $tanggalIzin)) {
                    if (!$fixAlpaDate) {
                        $fixAlpaDate = $dStr;
                    } elseif (!$fixLupaPulangDate) {
                        $fixLupaPulangDate = $dStr;
                    } elseif (!$fixEarlyDate) {
                        $fixEarlyDate = $dStr;
                        break;
                    }
                }
                $tempDate->addDay();
            }

            // --- LOOP GENERATE ABSENSI HARIAN ---
            $currentDate = $mulaiMagang->copy();

            while ($currentDate->lte($yesterday)) {
                $tanggalStr = $currentDate->toDateString();

                // 1. Skip jika bukan hari kerja (weekend atau hari libur)
                if (!$this->isWorkingDay($currentDate)) {
                    $currentDate->addDay();
                    continue;
                }

                // 2. Skip jika sedang Izin
                if (in_array($tanggalStr, $tanggalIzin)) {
                    $currentDate->addDay();
                    continue;
                }

                // 3. Kondisi jika hari ini adalah jadwal ALPA
                if ($tanggalStr === $fixAlpaDate) {
                    $currentDate->addDay();
                    continue;
                }

                // 4. Proses Pembuatan Absensi
                // Syarat: Hari biasa (probabilitas 95%) ATAU Hari Lupa Clockout (harus masuk)
                if (rand(1, 100) <= 95 || $tanggalStr === $fixLupaPulangDate) {

                    // --- CREATE ABSEN MASUK ---
                    // Varied arrival times: some early, some on time, some late
                    $arrivalPattern = rand(1, 100);
                    if ($arrivalPattern <= 20) {
                        // Early birds (7:00 - 7:30)
                        $jam = 7;
                        $menit = rand(0, 30);
                    } elseif ($arrivalPattern <= 70) {
                        // On time (7:30 - 8:00)
                        $jam = 7;
                        $menit = rand(30, 59);
                    } elseif ($arrivalPattern <= 90) {
                        // Slightly late (8:01 - 8:15)
                        $jam = 8;
                        $menit = rand(1, 15);
                    } else {
                        // Very late (8:16 - 8:45)
                        $jam = 8;
                        $menit = rand(16, 45);
                    }
                    
                    $jamMasuk = sprintf('%02d:%02d:00', $jam, $menit);

                    $lamaTelat = 0;
                    if ($jam > 8 || ($jam == 8 && $menit > 0)) {
                        $lamaTelat = ($jam - 8) * 60 + $menit;
                    }

                    TblAbsensi::create([
                        'id_mahasiswa' => \App\Models\TblMahasiswa::where('user_id', $intern->user_id)->value('id_mahasiswa'),
                        'user_id' => $intern->user_id,
                        'status' => 'masuk',
                        'waktu' => $jamMasuk,
                        'tanggal' => $tanggalStr,
                        'latitude_absen' => -7.330588 + (rand(-10, 10) / 10000),
                        'longitude_absen' => 112.758253 + (rand(-10, 10) / 10000),
                        'lama_telat' => $lamaTelat,
                        'foto_absen' => null,
                    ]);

                    // --- CREATE ABSEN PULANG ---
                    // JIKA tanggal hari ini BUKAN tanggal lupa clockout, maka buat absen pulang
                    if ($tanggalStr !== $fixLupaPulangDate) {
                        // If this is the chosen early-departure date, force an earlier pulang time and early flag
                        $isEarly = 0;
                        if (!empty($fixEarlyDate) && $tanggalStr === $fixEarlyDate) {
                            // Strong early departure: 15:30 - 16:29
                            $jamPulang = sprintf('%02d:%02d:00', 15 + rand(0,1), rand(30, 59));
                            $isEarly = 1;
                        } else {
                            // Varied departure times
                            $departurePattern = rand(1, 100);
                            if ($departurePattern <= 15) {
                                // Early departure (16:30 - 17:00)
                                $jamPulang = sprintf('%02d:%02d:00', 16, rand(30, 59));
                            } elseif ($departurePattern <= 80) {
                                // Normal time (17:00 - 18:00)
                                $jamPulang = sprintf('%02d:%02d:00', 17, rand(0, 59));
                            } else {
                                // Overtime (18:01 - 19:00)
                                $jamPulang = sprintf('%02d:%02d:00', 18, rand(1, 59));
                            }
                        }

                        TblAbsensi::create([
                            'id_mahasiswa' => \App\Models\TblMahasiswa::where('user_id', $intern->user_id)->value('id_mahasiswa'),
                            'user_id' => $intern->user_id,
                            'status' => 'pulang',
                            'waktu' => $jamPulang,
                            'tanggal' => $tanggalStr,
                            'latitude_absen' => -7.330588 + (rand(-10, 10) / 10000),
                            'longitude_absen' => 112.758253 + (rand(-10, 10) / 10000),
                            'lama_telat' => 0,
                            'early' => $isEarly,
                            'foto_absen' => null,
                        ]);
                    }
                    // Jika $tanggalStr === $fixLupaPulangDate, blok pulang di atas dilewati (Lupa Clockout)
                }

                $currentDate->addDay();
            }
        }

        // 5. Tambahan: Buat Data Koreksi untuk contoh (Opsional)
        $this->seedSampleKoreksi($interns->first());
    }

    private function getTanggalIzin(int $userId): array
    {
        $tanggalIzin = [];
        $leave_requestsList = Izin::where('user_id', $userId)->where(function($q){ $q->where('status', 'approved')->orWhere('status_admin', 'approved'); })->get();

        foreach ($leave_requestsList as $leave_requests) {
            $start = Carbon::parse($leave_requests->tanggal_mulai);
            $end = Carbon::parse($leave_requests->tanggal_selesai);
            while ($start->lte($end)) {
                $tanggalIzin[] = $start->toDateString();
                $start->addDay();
            }
        }
        return $tanggalIzin;
    }

    private function seedSampleKoreksi($user)
    {
        if (!$user)
            return;

        // Cari tanggal kerja terdekat yang tidak ada leave_requests (maksimal 14 hari ke belakang)
        $tanggalKoreksi = Carbon::now()->subDay();
        $attempts = 0;
        $tanggalIzin = $this->getTanggalIzin($user->user_id);
        while ((!$this->isWorkingDay($tanggalKoreksi) || in_array($tanggalKoreksi->toDateString(), $tanggalIzin)) && $attempts < 14) {
            $tanggalKoreksi->subDay();
            $attempts++;
        }
        $tanggalKoreksiStr = $tanggalKoreksi->toDateString();

        // Various rejection reasons for variety
        $alasanPending = [
            'HP mati saat mau absen masuk',
            'Lupa absen karena langsung ada meeting',
            'Koneksi internet bermasalah saat absen',
            'Sistem absensi error saat absen',
        ];

        // Contoh Koreksi Pending (belum diproses mentor/admin)
        KoreksiAbsensi::create([
            'id_mahasiswa' => \App\Models\TblMahasiswa::where('user_id', $user->user_id)->value('id_mahasiswa'),
            'user_id' => $user->user_id,
            'jenis_koreksi' => 'lupa_absen_masuk',
            'tanggal' => $tanggalKoreksiStr,
            'jam_koreksi' => '08:10:00',
            'alasan' => $alasanPending[array_rand($alasanPending)],
            'status' => 'pending',
            'status_mentor' => 'pending',
            'status_admin' => 'pending',
        ]);

        // Cari tanggal lain untuk koreksi approved, pastikan tidak sama dengan pending di atas
        $tanggalKoreksi2 = $tanggalKoreksi->copy()->subDay();
        $attempts2 = 0;
        while ((!$this->isWorkingDay($tanggalKoreksi2) || in_array($tanggalKoreksi2->toDateString(), $tanggalIzin) || $tanggalKoreksi2->toDateString() === $tanggalKoreksiStr) && $attempts2 < 14) {
            $tanggalKoreksi2->subDay();
            $attempts2++;
        }
        $tanggalKoreksiStr2 = $tanggalKoreksi2->toDateString();

        $alasanApproved = [
            'Terburu-buru pulang ada urusan keluarga',
            'Tugas terselesaikan lebih awal, pulang duluan',
            'Sakit mendadak saat pulang',
            'Pulang untuk meeting dengan klien',
        ];

        // Contoh Koreksi Approved (sudah disetujui mentor & admin)
        KoreksiAbsensi::create([
            'user_id' => $user->user_id,
            'jenis_koreksi' => 'lupa_absen_pulang',
            'tanggal' => $tanggalKoreksiStr2,
            'jam_koreksi' => '17:30:00',
            'alasan' => $alasanApproved[array_rand($alasanApproved)],
            'status' => 'approved',
            'status_mentor' => 'approved',
            'status_admin' => 'approved',
            'approved_by_mentor' => 2, // contoh user id mentor
            'approved_by_admin' => 1, // contoh user id admin
            'catatan_mentor' => 'Alasan masuk akal, setuju untuk dikoreksi.',
            'catatan_admin' => 'Sudah diverifikasi, koreksi diterima.',
            'approved_at_mentor' => Carbon::now()->subDays(3),
            'approved_at_admin' => Carbon::now()->subDays(2),
        ]);

        // Add a rejected correction example
        $tanggalKoreksi3 = $tanggalKoreksi2->copy()->subDay();
        $attempts3 = 0;
        while ((!$this->isWorkingDay($tanggalKoreksi3) || in_array($tanggalKoreksi3->toDateString(), $tanggalIzin) || 
                $tanggalKoreksi3->toDateString() === $tanggalKoreksiStr || $tanggalKoreksi3->toDateString() === $tanggalKoreksiStr2) && $attempts3 < 14) {
            $tanggalKoreksi3->subDay();
            $attempts3++;
        }

        if ($attempts3 < 14) {
            KoreksiAbsensi::create([
                'user_id' => $user->user_id,
                'jenis_koreksi' => 'lupa_absen_masuk',
                'tanggal' => $tanggalKoreksi3->toDateString(),
                'jam_koreksi' => '08:45:00',
                'alasan' => 'Lupa absen masuk karena banyak kerjaan',
                'status' => 'rejected',
                'status_mentor' => 'rejected',
                'status_admin' => 'rejected',
                'approved_by_mentor' => 2,
                'approved_by_admin' => 1,
                'catatan_mentor' => 'Alasan tidak cukup kuat. Mohon lebih teliti dalam absensi.',
                'catatan_admin' => 'Ditolak karena tidak sesuai kriteria koreksi.',
                'approved_at_mentor' => Carbon::now()->subDays(5),
                'approved_at_admin' => Carbon::now()->subDays(4),
            ]);
        }
    }
}