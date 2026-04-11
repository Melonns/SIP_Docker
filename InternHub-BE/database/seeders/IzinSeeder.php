<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Izin;
use App\Models\User;
use Carbon\Carbon;

class IzinSeeder extends Seeder
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
        // Get intern users
        $interns = User::whereHas('roles', fn($q) => $q->where('name', 'intern'))->get();
        
        // Get mentor for approval
        $mentor = User::whereHas('roles', fn($q) => $q->where('name', 'mentor'))->first();

        $jenisIzin = ['sakit', 'izin']; // Hanya sakit dan izin sesuai enum di migration
        $keteranganSakit = ['Demam', 'Flu', 'Sakit kepala', 'Sakit perut', 'Tidak enak badan'];
        $keteranganIzin = ['Urusan keluarga', 'Acara kampus', 'Keperluan mendadak', 'Mengurus dokumen'];

        foreach ($interns as $intern) {
            // Resolve id_mahasiswa from profile
            $idMahasiswa = $intern->mahasiswa?->id_mahasiswa ?? null;

            // Buat 1-2 leave_requests sakit (approved, sudah di-approve mentor & admin) di Januari 2026
            for ($i = 0; $i < rand(1, 2); $i++) {
                // Pilih tanggal kerja secara random di Januari 2026
                $workingDays = [];
                $tempDate = Carbon::create(2026, 1, 1);
                while ($tempDate->month === 1) {
                    if ($this->isWorkingDay($tempDate)) {
                        $workingDays[] = $tempDate->copy();
                    }
                    $tempDate->addDay();
                }
                $tanggalMulai = $workingDays[array_rand($workingDays)];
                
                $durasi = rand(1, 3);
                $tanggalSelesai = $tanggalMulai->copy()->addDays($durasi - 1);
                // Pastikan tanggal selesai juga hari kerja atau sesuaikan
                while (!$this->isWorkingDay($tanggalSelesai) && $tanggalSelesai->month === 1) {
                    $tanggalSelesai->addDay();
                }
                if ($tanggalSelesai->month !== 1) {
                    $tanggalSelesai = $tanggalMulai; // pastikan tetap di Januari
                }
                $approvedMentorAt = $tanggalMulai->copy()->addHours(1);
                $approvedAdminAt = $tanggalMulai->copy()->addHours(2);
                Izin::create([
                    'user_id' => $intern->user_id,
                    'id_mahasiswa' => $idMahasiswa,
                    'jenis_izin' => 'sakit',
                    'tanggal_mulai' => $tanggalMulai->toDateString(),
                    'tanggal_selesai' => $tanggalSelesai->toDateString(),
                    'keterangan' => $keteranganSakit[array_rand($keteranganSakit)],
                    'status' => 'approved',
                    'approved_by' => $mentor->user_id,
                    'catatan_approval' => 'Semoga lekas sembuh',
                    'approved_at' => $approvedAdminAt,
                    'status_mentor' => 'approved',
                    'status_admin' => 'approved',
                    'catatan_mentor' => 'Semoga lekas sembuh',
                    'catatan_admin' => 'Disetujui admin',
                    'approved_by_mentor' => $mentor->user_id,
                    'approved_by_admin' => $mentor->user_id, // contoh: admin = mentor
                    'approved_at_mentor' => $approvedMentorAt,
                    'approved_at_admin' => $approvedAdminAt,
                ]);
            }

            // Buat 0-1 leave_requests lainnya (approved, sudah di-approve mentor & admin) di Januari 2026
            if (rand(0, 1)) {
                // Pilih tanggal kerja secara random di Januari 2026
                $workingDays = [];
                $tempDate = Carbon::create(2026, 1, 1);
                while ($tempDate->month === 1) {
                    if ($this->isWorkingDay($tempDate)) {
                        $workingDays[] = $tempDate->copy();
                    }
                    $tempDate->addDay();
                }
                $tanggalMulai = $workingDays[array_rand($workingDays)];
                $approvedMentorAt = $tanggalMulai->copy()->addHours(1);
                $approvedAdminAt = $tanggalMulai->copy()->addHours(3);
                Izin::create([
                    'user_id' => $intern->user_id,
                    'id_mahasiswa' => $idMahasiswa,
                    'jenis_izin' => 'izin',
                    'tanggal_mulai' => $tanggalMulai->toDateString(),
                    'tanggal_selesai' => $tanggalMulai->toDateString(),
                    'keterangan' => $keteranganIzin[array_rand($keteranganIzin)],
                    'status' => 'approved',
                    'approved_by' => $mentor->user_id,
                    'catatan_approval' => 'Disetujui',
                    'approved_at' => $approvedAdminAt,
                    'status_mentor' => 'approved',
                    'status_admin' => 'approved',
                    'catatan_mentor' => 'Disetujui mentor',
                    'catatan_admin' => 'Disetujui admin',
                    'approved_by_mentor' => $mentor->user_id,
                    'approved_by_admin' => $mentor->user_id, // contoh: admin = mentor
                    'approved_at_mentor' => $approvedMentorAt,
                    'approved_at_admin' => $approvedAdminAt,
                ]);
            }

            // Buat 1 leave_requests pending (belum di-approve mentor & admin) di Februari 2026
            // Pilih tanggal kerja secara random di Februari 2026
            $workingDaysFeb = [];
            $tempDateFeb = Carbon::create(2026, 2, 1);
            while ($tempDateFeb->month === 2) {
                if ($this->isWorkingDay($tempDateFeb)) {
                    $workingDaysFeb[] = $tempDateFeb->copy();
                }
                $tempDateFeb->addDay();
            }
            $tanggalMulaiPending = $workingDaysFeb[array_rand($workingDaysFeb)];
            $tanggalSelesaiPending = $tanggalMulaiPending->copy()->addDays(rand(0, 2));
            // Pastikan tanggal selesai juga hari kerja
            while (!$this->isWorkingDay($tanggalSelesaiPending) && $tanggalSelesaiPending->month === 2) {
                $tanggalSelesaiPending->addDay();
            }
            if ($tanggalSelesaiPending->month !== 2) {
                $tanggalSelesaiPending = $tanggalMulaiPending;
            }
            Izin::create([
                'user_id' => $intern->user_id,
                'id_mahasiswa' => $idMahasiswa,
                'jenis_izin' => $jenisIzin[array_rand($jenisIzin)],
                'tanggal_mulai' => $tanggalMulaiPending->toDateString(),
                'tanggal_selesai' => $tanggalSelesaiPending->toDateString(),
                'keterangan' => 'Pengajuan leave_requests untuk keperluan penting',
                'status' => 'pending',
                'status_mentor' => 'pending',
                'status_admin' => 'pending',
                'catatan_mentor' => null,
                'catatan_admin' => null,
                'approved_by_mentor' => null,
                'approved_by_admin' => null,
                'approved_at_mentor' => null,
                'approved_at_admin' => null,
            ]);
        }
    }
}
