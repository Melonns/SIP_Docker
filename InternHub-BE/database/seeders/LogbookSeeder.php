<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Logbook;
use App\Models\User;
use App\Models\TblAbsensi;
use Carbon\Carbon;

class LogbookSeeder extends Seeder
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
        
        // Get mentor for verification
        $mentor = User::whereHas('roles', fn($q) => $q->where('name', 'mentor'))->first();

        // More detailed and diverse activities
        $aktivitas = [
            // Phase 1: Learning & Setup
            'Mempelajari dokumentasi project dan setup environment development. Instalasi dependencies dan konfigurasi database lokal.',
            'Mengikuti onboarding session dan mempelajari arsitektur project. Review codebase dan understanding best practices yang digunakan.',
            'Setup environment development, konfigurasi IDE, dan git workflow. Testing deployment ke staging environment.',
            
            // Phase 2: Backend Tasks
            'Implementasi REST API endpoint untuk fitur absensi. Testing dengan Postman dan dokumentasi di Swagger.',
            'Membuat database migration untuk tabel mahasiswa_profile dan work_schedule. Testing migration di berbagai environment.',
            'Membuat seeder untuk data test dan production data. Optimasi seeder untuk performa lebih baik.',
            'Memperbaiki bug di modul authentication dan authorization. Menambahkan role-based access control untuk endpoint tertentu.',
            'Implementasi fitur logbooks dengan status verifikasi (pending, verified, rejected). Menambahkan notification system untuk mentor approval.',
            
            // Phase 3: Frontend Tasks
            'Membuat UI component untuk dashboard menggunakan React dan Tailwind CSS. Responsive design untuk mobile dan tablet.',
            'Implementasi form validation dan error handling untuk login page. Testing cross-browser compatibility.',
            'Membuat attendance report dashboard dengan chart dan table. Integrasi dengan API dan real-time data fetching.',
            'Membuat logbooks submission form dengan file upload capability. Integration dengan attendance data untuk auto-fill.',
            'UI improvement untuk navigation menu dan sidebar. Dark mode implementation dan theme toggle.',
            
            // Phase 4: Testing & QA
            'Testing fitur baru dan membuat comprehensive bug report. Dokumentasi test case dan scenario coverage.',
            'Unit testing untuk utility functions menggunakan Jest. Mencapai 80% code coverage untuk critical modules.',
            'Integration testing untuk API endpoints menggunakan Pest framework. Testing error handling dan edge cases.',
            'Melakukan user acceptance testing (UAT) dengan stakeholder. Mengumpulkan feedback dan membuat improvement list.',
            
            // Phase 5: Optimization & Review
            'Code review dengan senior developer dan refactoring code untuk readability. Applying design patterns dan SOLID principles.',
            'Database query optimization dan menambahkan indexes untuk slow queries. Performance monitoring dan profiling.',
            'Security audit untuk project dan penambahan validation rules. Testing untuk SQL injection dan XSS vulnerabilities.',
            'Dokumentasi lengkap untuk API endpoints, database schema, dan deployment guide.',
            
            // Phase 6: Miscellaneous
            'Pair programming dengan senior developer untuk complex feature. Knowledge transfer dan mentoring dari mentor.',
            'Presentasi progress mingguan kepada tim dan stakeholder. Demo fitur yang sudah dikerjakan.',
            'Riset teknologi baru untuk improvement project (Laravel Sanctum, React Query, etc).',
            'Membuat utility functions dan helpers untuk reusable code. Dokumentasi dan testing untuk utility library.',
            'Bug fixing dari production issue dan hotfix deployment. Monitoring dan post-deployment verification.',
        ];

        foreach ($interns as $intern) {
            // Prefer mahasiswa.mulai_magang; cap seeding to mahasiswa.akhir_magang.
            $mulaiMagang = $intern->mahasiswa && $intern->mahasiswa->mulai_magang
                ? Carbon::parse($intern->mahasiswa->mulai_magang)
                : Carbon::now()->subMonths(2);

            // Exclude today so user can create logbooks for today
            $yesterday = Carbon::now()->subDay();
            $akhirMagang = $intern->mahasiswa && $intern->mahasiswa->akhir_magang ? Carbon::parse($intern->mahasiswa->akhir_magang) : null;
            if ($akhirMagang && $akhirMagang->lt($yesterday)) {
                $yesterday = $akhirMagang->copy();
            }

            // If internship not started yet or starts after effective end, skip
            if ($mulaiMagang->gt($yesterday)) {
                continue;
            }

            // Cleanup duplicate logbook rows (idempotency) for this intern in the seeding window
            $existing = Logbook::where('user_id', $intern->user_id)
                ->whereBetween('tanggal', [$mulaiMagang->toDateString(), $yesterday->toDateString()])
                ->get()
                ->groupBy(function($r) { return Carbon::parse($r->tanggal)->toDateString(); });

            foreach ($existing as $date => $rows) {
                if ($rows->count() > 1) {
                    // keep first, delete the rest
                    $rows->slice(1)->each(fn($r) => $r->delete());
                }
            }

            $currentDate = $mulaiMagang->copy();
            $dayCount = 0;
            
            while ($currentDate->lte($yesterday)) {
                // Skip jika bukan hari kerja (weekend atau hari libur)
                if (!$this->isWorkingDay($currentDate)) {
                    $currentDate->addDay();
                    continue;
                }

                // Check if intern hadir (has both masuk and pulang records for this date)
                $hasAttendance = TblAbsensi::where('user_id', $intern->user_id)
                    ->where('tanggal', $currentDate->toDateString())
                    ->groupBy('status')
                    ->select('status')
                    ->pluck('status')
                    ->count() === 2; // Must have both 'masuk' and 'pulang'

                if (!$hasAttendance) {
                    // Skip if not attended
                    $currentDate->addDay();
                    continue;
                }

                $dayCount++;

                // Higher rate of logbooks completion in the later days (ramp-up)
                $completionRate = min(85 + ($dayCount * 0.5), 95); // Gradually increase from 85% to 95%
                
                if (rand(1, 100) <= $completionRate) {
                    // Random status: 70% verified, 20% pending, 10% revision_needed
                    $statusRand = rand(1, 100);
                    if ($statusRand <= 70) {
                        $status = 'verified';
                    } elseif ($statusRand <= 90) {
                        $status = 'pending';
                    } else {
                        $status = 'revision_needed';
                    }

                    // For verified_at, use same day at 17:00-18:00 WIB (2 hours after work end time)
                    $verifiedAt = null;
                    if ($status === 'verified') {
                        $verifiedAt = $currentDate->copy()->setTime(rand(17, 18), rand(0, 59), 0);
                    }

                    // Variable duration based on activity type
                    $durationOptions = [
                        ['jam' => 8, 'menit' => 0],  // Full day
                        ['jam' => 7, 'menit' => 30], // 7.5 hours
                        ['jam' => 8, 'menit' => 30], // 8.5 hours
                        ['jam' => 7, 'menit' => 0],  // 7 hours
                    ];
                    $duration = $durationOptions[array_rand($durationOptions)];

                    // Generate feedback based on status
                    $feedback = null;
                    if ($status === 'verified') {
                        $feedbacks = [
                            'Bagus! Deskripsi lengkap dan detail.',
                            'Good job! Progress yang bagus hari ini.',
                            'Excellent work! Keep it up!',
                            'Nice! Sudah sesuai dengan task list.',
                        ];
                        $feedback = $feedbacks[array_rand($feedbacks)];
                    } elseif ($status === 'revision_needed') {
                        $feedbacks = [
                            'Deskripsi kurang detail. Mohon tambahkan langkah-langkah spesifik yang dikerjakan.',
                            'Tolong jelaskan lebih detail hasil yang dicapai hari ini.',
                            'Kurang informasi tentang challenge yang dihadapi dan solusinya.',
                            'Perlu ditambahkan time allocation untuk setiap activity.',
                        ];
                        $feedback = $feedbacks[array_rand($feedbacks)];
                    }

                    Logbook::create([
                        'user_id' => $intern->user_id,
                        // ensure seeded logbooks populate profile FK so backfill/migrations remain consistent
                        'id_mahasiswa' => \App\Models\TblMahasiswa::where('user_id', $intern->user_id)->value('id_mahasiswa'),
                        'tanggal' => $currentDate->toDateString(),
                        'deskripsi_kegiatan' => $aktivitas[array_rand($aktivitas)],
                        'status_verifikasi' => $status,
                        'verified_by' => in_array($status, ['verified', 'revision_needed']) ? $mentor->user_id : null,
                        'feedback' => $feedback,
                        'verified_at' => $verifiedAt,
                    ]);
                }

                $currentDate->addDay();
            }
        }
    }
}
