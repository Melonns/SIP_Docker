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
        
        
        // Output ke terminal
        $this->command->info('TestingInternSeeder berhasil dieksekusi.');
        $this->command->info('Akun Mentor: mentor.testing@sier.id | pass: password123');
        $this->command->info('Akun Intern Active: intern.active@sier.id | pass: password123');
        $this->command->info('Akun Intern Complete: intern.complete@sier.id | pass: password123');
    }
}
