<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\TblMahasiswa;
use App\Models\TblKaryawan;
use App\Models\InternMentor;
use App\Models\TblAbsensi;
use App\Models\Logbook;
use App\Models\Evaluation;
use App\Models\EvaluationComponent;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class TestingInternSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // 1. Setup Mentor
        $mentorUser = User::firstOrCreate([
            'email' => 'mentor.testing@sier.id'
        ], [
            'nama' => 'Mentor Testing',
            'password' => Hash::make('password123'),
            'level' => 'mentor',
            'status' => 'active'
        ]);

        // Assign Role Mentor
        $mentorRole = \App\Models\Role::firstOrCreate(['name' => 'mentor'], ['label' => 'Mentor']);
        $mentorUser->roles()->syncWithoutDetaching([$mentorRole->role_id]);

        $mentorProfile = TblKaryawan::firstOrCreate([
            'nip' => 'MENTOR001'
        ], [
            'user_id' => $mentorUser->user_id,
            'nama' => 'Mentor Testing',
            'email' => 'mentor.testing@sier.id',
            'division' => 'Divisi Inovasi',
            'job_position' => 'Senior Developer',
            'gender' => 'L',
            'status' => 'active',
            'id_site' => 1
        ]);


        // 2. Setup Intern 1 (Active)
        $intern1User = User::firstOrCreate([
            'email' => 'intern.active@sier.id'
        ], [
            'nama' => 'Intern Active',
            'password' => Hash::make('password123'),
            'level' => 'intern',
            'status' => 'active'
        ]);

        // Assign Role Intern
        $internRole = \App\Models\Role::firstOrCreate(['name' => 'intern'], ['label' => 'Intern']);
        $intern1User->roles()->syncWithoutDetaching([$internRole->role_id]);

        $intern1Profile = TblMahasiswa::firstOrCreate([
            'nim' => 'INT-ACT-001'
        ], [
            'user_id' => $intern1User->user_id,
            'nama' => 'Intern Active',
            'email' => 'intern.active@sier.id',
            'universitas' => 'Universitas Testing',
            'jurusan' => 'Teknik Informatika',
            'mulai_magang' => Carbon::now()->subMonths(1)->format('Y-m-d'),
            'akhir_magang' => Carbon::now()->addMonths(2)->format('Y-m-d'),
            'id_site' => 1,
            'division' => 'Divisi Inovasi'
        ]);

        // Mapping Mentor & Intern 1
        InternMentor::firstOrCreate([
            'intern_id' => $intern1Profile->id_mahasiswa,
            'mentor_id' => $mentorProfile->id_karyawan,
            'is_active' => true
        ], [
            'intern_user_id' => $intern1User->user_id,
            'mentor_user_id' => $mentorUser->user_id,
            'assigned_date' => Carbon::now()->subMonths(1)->format('Y-m-d')
        ]);

        // Absensi Intern 1 (Semua hari kerja dari mulai magang sampai hari ini)
        $start1 = Carbon::parse($intern1Profile->mulai_magang);
        $end1 = Carbon::now();
        $diffDays1 = $start1->diffInDays($end1);

        for ($i = $diffDays1; $i >= 0; $i--) {
            $date = Carbon::now()->subDays($i);
            if ($date->isWeekday()) {
                TblAbsensi::firstOrCreate([
                    'id_mahasiswa' => $intern1Profile->id_mahasiswa,
                    'tanggal' => $date->format('Y-m-d')
                ], [
                    'user_id' => $intern1User->user_id,
                    'status' => 'hadir',
                    'waktu' => '07:30:00',
                    'latitude_absen' => '-7.3323048',
                    'longitude_absen' => '112.759495',
                    'foto_absen' => 'dummy_photo.jpg'
                ]);

                // Logbook Intern 1
                Logbook::firstOrCreate([
                    'id_mahasiswa' => $intern1Profile->id_mahasiswa,
                    'tanggal' => $date->format('Y-m-d')
                ], [
                    'user_id' => $intern1User->user_id,
                    'deskripsi_kegiatan' => 'Mengerjakan fitur testing hari ke ' . $date->format('d'),
                    'status_verifikasi' => 'verified',
                    'verified_by' => $mentorUser->user_id,
                    'verified_at' => $date->copy()->addHours(10),
                    'submitted_at' => $date->copy()->addHours(9)
                ]);
            }
        }


        // 3. Setup Intern 2 (Complete)
        $intern2User = User::firstOrCreate([
            'email' => 'intern.complete@sier.id'
        ], [
            'nama' => 'Intern Complete',
            'password' => Hash::make('password123'),
            'level' => 'intern',
            'status' => 'active'
        ]);

        $intern2User->roles()->syncWithoutDetaching([$internRole->role_id]);

        $intern2Profile = TblMahasiswa::firstOrCreate([
            'nim' => 'INT-CMP-002'
        ], [
            'user_id' => $intern2User->user_id,
            'nama' => 'Intern Complete',
            'email' => 'intern.complete@sier.id',
            'universitas' => 'Universitas Selesai',
            'jurusan' => 'Sistem Informasi',
            'mulai_magang' => Carbon::now()->subMonths(4)->format('Y-m-d'),
            'akhir_magang' => Carbon::now()->subDays(1)->format('Y-m-d'),
            'id_site' => 1,
            'division' => 'Divisi Inovasi'
        ]);

        // Mapping Mentor & Intern 2
        InternMentor::firstOrCreate([
            'intern_id' => $intern2Profile->id_mahasiswa,
            'mentor_id' => $mentorProfile->id_karyawan,
        ], [
            'intern_user_id' => $intern2User->user_id,
            'mentor_user_id' => $mentorUser->user_id,
            'assigned_date' => Carbon::now()->subMonths(4)->format('Y-m-d'),
            'end_date' => Carbon::now()->subDays(1)->format('Y-m-d'),
            'is_active' => false // sudah selesai
        ]);

        // Absensi Intern 2 (Semua hari kerja selama magang)
        $start2 = Carbon::parse($intern2Profile->mulai_magang);
        $end2 = Carbon::parse($intern2Profile->akhir_magang);
        $diffDays2 = $start2->diffInDays($end2);

        for ($i = $diffDays2; $i >= 0; $i--) {
            $date = Carbon::parse($intern2Profile->akhir_magang)->subDays($i);
            if ($date->isWeekday()) {
                TblAbsensi::firstOrCreate([
                    'id_mahasiswa' => $intern2Profile->id_mahasiswa,
                    'tanggal' => $date->format('Y-m-d')
                ], [
                    'user_id' => $intern2User->user_id,
                    'status' => 'hadir',
                    'waktu' => '07:30:00',
                    'latitude_absen' => '-7.3323048',
                    'longitude_absen' => '112.759495',
                    'foto_absen' => 'dummy_photo.jpg'
                ]);

                // Logbook Intern 2
                Logbook::firstOrCreate([
                    'id_mahasiswa' => $intern2Profile->id_mahasiswa,
                    'tanggal' => $date->format('Y-m-d')
                ], [
                    'user_id' => $intern2User->user_id,
                    'deskripsi_kegiatan' => 'Final task project magang hari ke ' . $date->format('d'),
                    'status_verifikasi' => 'verified',
                    'verified_by' => $mentorUser->user_id,
                    'verified_at' => $date->copy()->addHours(10),
                    'submitted_at' => $date->copy()->addHours(9)
                ]);
            }
        }

        $eval = Evaluation::firstOrCreate([
            'intern_mahasiswa_id' => $intern2Profile->id_mahasiswa,
            'mentor_karyawan_id' => $mentorProfile->id_karyawan,
        ], [
            'user_id' => $intern2User->user_id,
            'mentor_id' => $mentorUser->user_id,
            'integrity_score' => 90,
            'punctuality_score' => 88,
            'expertise_score' => 92,
            'teamwork_score' => 95,
            'communication_score' => 90,
            'it_proficiency_score' => 93,
            'self_development_score' => 91,
            'final_score_numeric' => 91.2,
            'final_score_letter' => 'A',
            'periode' => $intern2Profile->mulai_magang . ' - ' . $intern2Profile->akhir_magang,
            'status' => 'final', // Bisa draft/final, asumsikan disubmit oleh mentor / final
            'mentor_notes' => 'Kerja bagus, sangat memuaskan.',
            'evaluation_date' => Carbon::now()->subDays(1)->format('Y-m-d'),
            'admin_reviewed' => true,
            'admin_id' => 1, // Assume admin id 1 exists
            'admin_reviewed_at' => Carbon::now()
        ]);

        // Insert Evaluation Details
        $components = DB::table('evaluation_components')->get();
        if ($components->count() > 0) {
            $scores = [
                'Integritas (etika, moral dan kesungguhan)' => 90,
                'Ketepatan waktu dalam bekerja' => 88,
                'Keahlian berdasarkan bidang ilmu' => 92,
                'Kerjasama dalam tim' => 95,
                'Komunikasi' => 90,
                'Penggunaan teknologi informasi' => 93,
                'Pengembangan diri' => 91,
            ];
            
            foreach ($components as $comp) {
                // Determine the score for this component based on its name, default to 85 if not found
                $score = $scores[$comp->nama_komponen] ?? 85;

                DB::table('evaluation_details')->updateOrInsert(
                    [
                        'id_evaluation' => $eval->id_evaluation,
                        'komponen_id' => $comp->id
                    ],
                    [
                        'nama_komponen' => $comp->nama_komponen,
                        'score' => $score,
                        'created_at' => Carbon::now(),
                        'updated_at' => Carbon::now()
                    ]
                );
            }
        }
        
        
        // Add original dummy interns back
        $siteId = \App\Models\TblSite::first()?->id_site ?? 1;
        $internsDummy = [
            [
                'nama' => 'Budi Santoso',
                'email' => 'budi.santoso@student.univ.ac.id',
                'nim' => '1204130609990000',
                'universitas' => 'Universitas Brawijaya',
                'jurusan' => 'Teknik Informatika',
                'no_telp' => '081234567890',
                'id_site' => $siteId,
                'alamat' => 'Jl. Ketintang No. 12, Surabaya',
                'jenjang_pendidikan' => 'S1',
                'mulai_magang' => '2026-01-01',
                'akhir_magang' => '2026-06-30',
                'job_position' => 'Fullstack Developer',
                'division' => 'IT Development',
                'work_schedule_id' => 1,
            ],
            [
                'nama' => 'Dewi Lestari',
                'email' => 'dewi.lestari@student.univ.ac.id',
                'nim' => '1204130609990001',
                'universitas' => 'Universitas Airlangga',
                'jurusan' => 'Sistem Informasi',
                'no_telp' => '081223344556',
                'id_site' => $siteId,
                'alamat' => 'Jl. Gubeng Kertajaya No. 45, Surabaya',
                'jenjang_pendidikan' => 'S1',
                'mulai_magang' => '2026-01-15',
                'akhir_magang' => '2026-07-15',
                'job_position' => 'UI/UX Designer',
                'division' => 'Design',
                'work_schedule_id' => 1,
            ],
            [
                'nama' => 'Rian Hidayat',
                'email' => 'rian.hidayat@samudra.ac.id',
                'nim' => '1204130609990002',
                'universitas' => 'Universitas Samudra Internasional',
                'jurusan' => 'Teknik Kapal Laut',
                'no_telp' => '081334455667',
                'id_site' => $siteId, 
                'alamat' => 'Jl. Rembang Industri Raya No. 5, Pasuruan',
                'jenjang_pendidikan' => 'D4',
                'mulai_magang' => '2026-02-01',
                'akhir_magang' => '2026-08-01',
                'job_position' => 'Quality Assurance',
                'division' => 'Quality Assurance',
                'work_schedule_id' => 1,
            ],
            [
                'nama' => 'Ahmad Fauzi',
                'email' => 'ahmad.fauzi@student.univ.ac.id',
                'nim' => '1204130609990003',
                'universitas' => 'Universitas Brawijaya',
                'jurusan' => 'Teknik Informatika',
                'no_telp' => '081445566778',
                'id_site' => $siteId,
                'alamat' => 'Jl. Veteran No. 10, Malang',
                'jenjang_pendidikan' => 'S1',
                'mulai_magang' => '2026-01-01',
                'akhir_magang' => '2026-06-30',
                'job_position' => 'Backend Developer',
                'division' => 'IT Development',
                'work_schedule_id' => 1,
            ],
            [
                'nama' => 'Siti Aisyah',
                'email' => 'siti.aisyah@student.univ.ac.id',
                'nim' => '1204130609990004',
                'universitas' => 'Universitas Brawijaya',
                'jurusan' => 'Desain Komunikasi Visual',
                'no_telp' => '081556677889',
                'id_site' => $siteId, 
                'alamat' => 'Jl. Dinoyo No. 5, Malang',
                'jenjang_pendidikan' => 'S1',
                'mulai_magang' => '2026-03-01',
                'akhir_magang' => '2026-09-01',
                'job_position' => 'Content Creator',
                'division' => 'Jasa Penunjang',
                'work_schedule_id' => 1,
            ],
            [
                'nama' => 'Farhan Hakim',
                'email' => 'farhan.hakim@student.univ.ac.id',
                'nim' => '1204130609970006',
                'universitas' => 'Universitas Samudra Internasional',
                'jurusan' => 'Teknik Kapal Laut',
                'no_telp' => '08985121650000',
                'id_site' => $siteId,
                'alamat' => 'Jl. Ketintang Baru No. 15, Surabaya',
                'jenjang_pendidikan' => 'S1',
                'mulai_magang' => '2026-01-01',
                'akhir_magang' => '2026-04-28',
                'job_position' => 'Marine Engineer',
                'division' => 'Engineering',
                'work_schedule_id' => 1,
            ]
        ];

        foreach ($internsDummy as $dummy) {
            // Create User record
            $dummyUser = User::updateOrCreate(
                ['email' => $dummy['email']],
                [
                    'password' => Hash::make('password123'),
                    'level' => 'intern',
                    'nama' => $dummy['nama'],
                    'status' => 'active',
                ]
            );
            $dummyUser->roles()->syncWithoutDetaching([\App\Models\Role::where('name', 'intern')->first()?->role_id]);

            // Create Student profile
            $dummyStudent = TblMahasiswa::updateOrCreate(
                ['user_id' => $dummyUser->user_id],
                [
                    'nim' => $dummy['nim'],
                    'nama' => $dummy['nama'],
                    'email' => $dummy['email'],
                    'universitas' => $dummy['universitas'],
                    'jurusan' => $dummy['jurusan'],
                    'no_telp' => $dummy['no_telp'],
                    'id_site' => $dummy['id_site'],
                    'alamat' => $dummy['alamat'],
                    'jenjang_pendidikan' => $dummy['jenjang_pendidikan'],
                    'mulai_magang' => $dummy['mulai_magang'],
                    'akhir_magang' => $dummy['akhir_magang'],
                    'job_position' => $dummy['job_position'],
                    'division' => $dummy['division'],
                    'work_schedule_id' => $dummy['work_schedule_id'],
                ]
            );

            // Map to Mentor
            InternMentor::firstOrCreate([
                'intern_id' => $dummyStudent->id_mahasiswa,
                'mentor_id' => $mentorProfile->id_karyawan,
            ], [
                'intern_user_id' => $dummyUser->user_id,
                'mentor_user_id' => $mentorUser->user_id,
                'assigned_date' => Carbon::now()->toDateString(),
                'is_active' => ($dummy['nama'] === 'Farhan Hakim' ? false : true),
            ]);
        }

        // Output ke terminal
        $this->command->info('TestingInternSeeder berhasil dieksekusi.');
        $this->command->info('Akun Mentor: mentor.testing@sier.id | pass: password123');
        $this->command->info('Akun Intern Active: intern.active@sier.id | pass: password123');
        $this->command->info('Akun Intern Complete: intern.complete@sier.id | pass: password123');
    }
}
