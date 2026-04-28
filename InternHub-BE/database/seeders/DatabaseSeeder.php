<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use App\Models\User;
use App\Models\Role;
use App\Models\TblSite;
use App\Models\TblMahasiswa;
use App\Models\InternMentor;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 0. Seed Roles & Permissions first
        $this->call([
            RoleSeeder::class,
            PermissionSeeder::class,
            \Database\Seeders\RolePermissionSeeder::class,
            \Database\Seeders\WorkScheduleSeeder::class,
            KomponenSeeder::class,
            TagSeeder::class,
            CertificateTemplateSeeder::class,
            DivisionSeeder::class,
        ]);

        // Get roles
        $adminRole = Role::where('name', 'admin')->first();
        $mentorRole = Role::where('name', 'mentor')->first();
        $internRole = Role::where('name', 'intern')->first();

        // 1. Buat Sites (SIER & PIER) - HARUS SEBELUM CREATE USERS
        $site1 = TblSite::create([
            'nama_site' => 'SIER',
            'alamat' => 'Jl. Rungkut Industri Raya No.10, Central Rungkut, Gunung Anyar, Surabaya, East Java 60293',
            'latitude' => -7.330588646448069,
            'longitude' => 112.75825353820993,
            'radius_meter' => 50,
        ]);

        $site2 = TblSite::create([
            'nama_site' => 'PIER',
            'alamat' => 'Jl. Rembang Industri Raya No.14, Jati, Pandean, Kec. Rembang, Pasuruan, Jawa Timur 67152',
            'latitude' => -7.616820086578864,
            'longitude' => 112.81790103963394,
            'radius_meter' => 50,
        ]);

        $site3 = TblSite::create([
            'nama_site' => 'IPAL',
            'alamat' => 'Jl. Rembang Industri Raya No.14, Jati, Pandean, Kec. Rembang, Pasuruan, Jawa Timur 67152',
            'latitude' => -7.616456153866322,
            'longitude' => 112.81855372461641,
            'radius_meter' => 50,
        ]);

        $site4 = TblSite::create([
            'nama_site' => 'Kantor Pemasaran S.B.U. Sier',
            'alamat' => 'Jl. Rungkut Industri III No.60, Rungkut Menanggal, Kec. Gn. Anyar, Surabaya, Jawa Timur 60293',
            'latitude' => -7.3364039767791205,
            'longitude' => 112.76363484393322,
            'radius_meter' => 50,
        ]);

        // 2. Sekarang baru panggil KaryawanSeeder (untuk create admin & mentor users)
        $this->call(KaryawanSeeder::class);

        // 2. Buat Admin User (login only - no profile data in users table)
        $admin = User::updateOrCreate(
            ['email' => 'admin@internhub.com'],
            [
                'password' => Hash::make('admin123'),
                'level' => 'admin',
                'nama' => 'Administrator',
                'email' => 'admin@internhub.com',
                'status' => 'active',
            ]
        );
        $admin->roles()->syncWithoutDetaching([$adminRole->role_id, $mentorRole->role_id]); // Double role (idempotent)

        // create karyawan profile for admin (id_site & contact moved to profile)
        \App\Models\TblKaryawan::updateOrCreate(
            ['user_id' => $admin->user_id],
            [
                'nip' => 'NIP001',
                'nama' => $admin->nama,
                'email' => $admin->email,
                'gender' => null,
                'division' => 'IT Department',
                'job_position' => 'System Administrator',
                'status' => 'active',
                'id_site' => $site1->id_site,
                'no_telp' => '08120000000',
            ]
        );

        // 3. Buat Mentor User (login only - no profile data in users table)
        $mentor = User::updateOrCreate(
            ['email' => 'dewi@internhub.com'],
            [
                'password' => Hash::make('mentor123'),
                'level' => 'mentor',
                'nama' => 'Dewi Lestari',
                'email' => 'dewi@internhub.com',
                'status' => 'active',
            ]
        );
        $mentor->roles()->syncWithoutDetaching([$mentorRole->role_id]);

        \App\Models\TblKaryawan::updateOrCreate(
            ['user_id' => $mentor->user_id],
            [
                'nip' => 'NIP002',
                'nama' => $mentor->nama,
                'email' => $mentor->email,
                'gender' => null,
                'division' => 'IT Department',
                'job_position' => 'Senior Developer',
                'status' => 'active',
                'id_site' => $site1->id_site,
                'no_telp' => '08129876543',
            ]
        );

        // 4. Buat Intern Users (login only - profile in students)
        $intern1 = User::updateOrCreate(
            ['email' => 'alvian@gmail.com'],
            [
                'password' => Hash::make('alvian123'),
                'level' => 'intern',
                'nama' => 'Alvian Maulana',
                'email' => 'alvian@gmail.com',
                'status' => 'active',
            ]
        );
        $intern1->roles()->syncWithoutDetaching([$internRole->role_id]);

        // create mahasiswa profile and link
        \App\Models\TblMahasiswa::updateOrCreate(
            ['user_id' => $intern1->user_id],
            [
                'nim' => '12345678',
                'nama' => 'Alvian Maulana',
                'email' => 'alvian@gmail.com',
                'no_telp' => '08123456789',
                'id_site' => $site1->id_site,
            ]
        );

        $intern2 = User::updateOrCreate(
            ['email' => 'siti@student.ub.ac.id'],
            [
                'password' => Hash::make('siti123'),
                'level' => 'intern',
                'nama' => 'Siti Nurhaliza',
                'email' => 'siti@student.ub.ac.id',
                'status' => 'active',
            ]
        );
        $intern2->roles()->syncWithoutDetaching([$internRole->role_id]);

        \App\Models\TblMahasiswa::updateOrCreate(
            ['user_id' => $intern2->user_id],
            [
                'nim' => '87654321',
                'nama' => 'Siti Nurhaliza',
                'email' => 'siti@student.ub.ac.id',
                'no_telp' => '08198765432',
                'id_site' => $site2->id_site,
            ]
        );

        $intern3 = User::updateOrCreate(
            ['email' => 'fadli@student.ub.ac.id'],
            [
                'password' => Hash::make('fadli123'),
                'level' => 'intern',
                'nama' => 'Fadli',
                'email' => 'fadli@student.ub.ac.id',
                'status' => 'active',
            ]
        );
        $intern3->roles()->syncWithoutDetaching([$internRole->role_id]);

        \App\Models\TblMahasiswa::updateOrCreate(
            ['user_id' => $intern3->user_id],
            [
                'nim' => '235150207',
                'nama' => 'Fadli',
                'email' => 'fadli@student.ub.ac.id',
                'no_telp' => '08198765432',
                'id_site' => $site2->id_site,
            ]
        );

        // Test Interns for Evaluation Feature
        $internCompleted1 = User::updateOrCreate(
            ['email' => 'budi@student.ub.ac.id'],
            [
                'password' => Hash::make('budi123'),
                'level' => 'intern',
                'nama' => 'Budi Santoso',
                'email' => 'budi@student.ub.ac.id',
                'status' => 'active',
            ]
        );
        $internCompleted1->roles()->syncWithoutDetaching([$internRole->role_id]);

        \App\Models\TblMahasiswa::updateOrCreate(
            ['user_id' => $internCompleted1->user_id],
            [
                'nim' => '11223344',
                'nama' => 'Budi Santoso',
                'email' => 'budi@student.ub.ac.id',
                'no_telp' => '08111223344',
                'id_site' => $site1->id_site,
            ]
        );

        $internCompleted2 = User::updateOrCreate(
            ['email' => 'rina@student.ub.ac.id'],
            [
                'password' => Hash::make('rina123'),
                'level' => 'intern',
                'nama' => 'Rina Wijaya',
                'email' => 'rina@student.ub.ac.id',
                'status' => 'active',
            ]
        );
        $internCompleted2->roles()->syncWithoutDetaching([$internRole->role_id]);

        \App\Models\TblMahasiswa::updateOrCreate(
            ['user_id' => $internCompleted2->user_id],
            [
                'nim' => '55667788',
                'nama' => 'Rina Wijaya',
                'email' => 'rina@student.ub.ac.id',
                'no_telp' => '08155667788',
                'id_site' => $site2->id_site,
            ]
        );

        $internNew = User::updateOrCreate(
            ['email' => 'budionolaut@student.laut.ac.id'],
            [
               'password' => Hash::make('sip2026'),
                'level' => 'intern',
                'nama' => 'Budiono Siregar', 
                'email' => 'budionolaut@student.laut.ac.id',
                'status' => 'active',
            ]
        );
        $internNew->roles()->syncWithoutDetaching([$internRole->role_id]);

        \App\Models\TblMahasiswa::updateOrCreate(
            ['user_id' => $internNew->user_id],
            [
                'nim' => '99887766',
                'nama' => 'Budiono Siregar',
                'email' => 'budionolaut@student.laut.ac.id',
                'no_telp' => '08985121658785',
                'id_site' => $site1->id_site,
            ]
        );

        // 5. Assign Interns ke Mentor (use profile FKs for fresh seeds)
        $intern1Id = \App\Models\TblMahasiswa::where('user_id', $intern1->user_id)->value('id_mahasiswa');
        $intern2Id = \App\Models\TblMahasiswa::where('user_id', $intern2->user_id)->value('id_mahasiswa');
        $intern3Id = \App\Models\TblMahasiswa::where('user_id', $intern3->user_id)->value('id_mahasiswa');
        $internCompleted1Id = \App\Models\TblMahasiswa::where('user_id', $internCompleted1->user_id)->value('id_mahasiswa');
        $internCompleted2Id = \App\Models\TblMahasiswa::where('user_id', $internCompleted2->user_id)->value('id_mahasiswa');
        $mentorKaryawanId = \App\Models\TblKaryawan::where('user_id', $mentor->user_id)->value('id_karyawan');

        InternMentor::create([
            'intern_id' => $intern1Id,
            'mentor_id' => $mentorKaryawanId,
            'intern_user_id' => $intern1->user_id,
            'mentor_user_id' => $mentor->user_id,
            'assigned_date' => '2026-01-01',
            'is_active' => true,
        ]);

        InternMentor::create([
            'intern_id' => $intern2Id,
            'mentor_id' => $mentorKaryawanId,
            'intern_user_id' => $intern2->user_id,
            'mentor_user_id' => $mentor->user_id,
            'assigned_date' => '2026-01-15',
            'is_active' => true,
        ]);

        InternMentor::create([
            'intern_id' => $intern3Id,
            'mentor_id' => $mentorKaryawanId,
            'intern_user_id' => $intern3->user_id,
            'mentor_user_id' => $mentor->user_id,
            'assigned_date' => '2025-07-15',
            'is_active' => true,
        ]);

        // Assign completed interns to mentor
        InternMentor::create([
            'intern_id' => $internCompleted1Id,
            'mentor_id' => $mentorKaryawanId,
            'intern_user_id' => $internCompleted1->user_id,
            'mentor_user_id' => $mentor->user_id,
            'assigned_date' => '2025-07-01',
            'is_active' => true,
        ]);

        InternMentor::create([
            'intern_id' => $internCompleted2Id,
            'mentor_id' => $mentorKaryawanId,
            'intern_user_id' => $internCompleted2->user_id,
            'mentor_user_id' => $mentor->user_id,
            'assigned_date' => '2025-08-01',
            'is_active' => true,
        ]);

        // Create evaluation for internCompleted1 (Budi - has evaluation)
        $evaluation1 = \App\Models\Evaluation::create([
            'user_id' => $internCompleted1->user_id,
            'intern_mahasiswa_id' => $internCompleted1Id,
            'mentor_id' => $mentor->user_id,
            'mentor_karyawan_id' => $mentorKaryawanId,
            // 7 Score Components
            'integrity_score' => 88,           // Integritas
            'punctuality_score' => 90,         // Ketepatan waktu
            'expertise_score' => 85,           // Keahlian bidang ilmu
            'teamwork_score' => 80,            // Kerjasama tim
            'communication_score' => 82,       // Komunikasi
            'it_proficiency_score' => 87,      // Penggunaan TI
            'self_development_score' => 84,    // Pengembangan diri
            // Final scores
            'final_score_letter' => 'B',
            'final_score_numeric' => 85.14,
            // Other fields
            'periode' => 'Juli - Desember 2025',
            'status' => 'final',
            'mentor_notes' => 'Budi menunjukkan kinerja yang sangat baik selama masa magang. Disiplin tinggi, hasil kerja berkualitas, dan memiliki inisiatif yang baik dalam menyelesaikan tugas.',
            'evaluation_date' => '2026-01-05',
        ]);

        // Create EvaluationComponents for Budi
        $komponenScores1 = [
            1 => [
                'score' => 88,
                'nama_komponen' => 'Integritas (etika, moral dan kesungguhan)'
            ],
            2 => [
                'score' => 90,
                'nama_komponen' => 'Ketepatan waktu dalam bekerja'
            ],
            3 => [
                'score' => 85,
                'nama_komponen' => 'Keahlian berdasarkan bidang ilmu'
            ],
            4 => [
                'score' => 80,
                'nama_komponen' => 'Kerjasama dalam tim'
            ],
            5 => [
                'score' => 82,
                'nama_komponen' => 'Komunikasi'
            ],
            6 => [
                'score' => 87,
                'nama_komponen' => 'Penggunaan teknologi informasi'
            ],
            7 => [
                'score' => 84,
                'nama_komponen' => 'Pengembangan diri'
            ],
        ];

        foreach ($komponenScores1 as $komponen_id => $data) {
            \App\Models\EvaluationComponent::create([
                'id_evaluation' => $evaluation1->id_evaluation,
                'komponen_id' => $komponen_id,
                'nama_komponen' => $data['nama_komponen'],
                'score' => $data['score'],
            ]);
        }

        // 6. Buat Mahasiswa profiles (semua profile data di students, users hanya untuk login)
        TblMahasiswa::updateOrCreate(
            ['user_id' => $intern1->user_id],
            [
                'nama' => 'Alvian Maulana',
                'email' => 'alvian@gmail.com',
                'universitas' => 'Universitas Brawijaya',
                'jurusan' => 'Teknik Informatika',
                'nim' => '12345678',
                'mulai_magang' => '2026-01-01',
                'akhir_magang' => '2026-06-30',
                'alamat' => 'Jl. Kebon Jeruk No. 10, Jakarta',
                'no_telp' => '08123456789',
                'id_site' => $site1->id_site,
                'jenjang_pendidikan' => 'S1',
                'nomor_darurat' => '08123456700',
                'nama_kontak_darurat' => 'Budi Santoso (Ayah)',
                'gender' => 'L',
                'semester' => 6,
                'nik' => '3171120305950001',
                'tempat_lahir' => 'Jakarta',
                'tanggal_lahir' => '1995-03-05',
                'job_position' => 'Software Developer',
                'division' => 'IT Development',
                'work_schedule_id' => 1,
            ]
        );

        TblMahasiswa::updateOrCreate(
            ['user_id' => $intern2->user_id],
            [
                'nama' => 'Siti Nurhaliza',
                'email' => 'siti@student.ub.ac.id',
                'universitas' => 'Universitas Brawijaya',
                'jurusan' => 'Sistem Informasi',
                'nim' => '87654321',
                'mulai_magang' => '2026-01-15',
                'akhir_magang' => '2026-07-15',
                'alamat' => 'Jl. Dago No. 55, Bandung',
                'no_telp' => '08198765432',
                'id_site' => $site2->id_site,
                'jenjang_pendidikan' => 'D3',
                'nomor_darurat' => '08198765400',
                'nama_kontak_darurat' => 'Ani (Ibu)',
                'gender' => 'P',
                'semester' => 5,
                'nik' => '3175060406990002',
                'tempat_lahir' => 'Bandung',
                'tanggal_lahir' => '1999-04-06',
                'job_position' => 'Quality Assurance',
                'division' => 'Quality Assurance',
                'work_schedule_id' => 1,
            ]
        );

        TblMahasiswa::updateOrCreate(
            ['user_id' => $intern3->user_id],
            [
                'nama' => 'Fadli',
                'email' => 'fadli@student.ub.ac.id',
                'universitas' => 'Universitas Brawijaya',
                'jurusan' => 'Teknik Informatika',
                'nim' => '235150207',
                'mulai_magang' => '2025-07-15',
                'akhir_magang' => '2026-02-15',
                'alamat' => 'Jl. Dago No. 55, Bandung',
                'no_telp' => '08198765432',
                'id_site' => $site2->id_site,
                'jenjang_pendidikan' => 'S1',
                'nomor_darurat' => '08198765411',
                'nama_kontak_darurat' => 'Citra (Kakak)',
                'gender' => 'P',
                'semester' => 7,
                'nik' => '3175070507000003',
                'tempat_lahir' => 'Surabaya',
                'tanggal_lahir' => '2000-07-05',
                'job_position' => 'Backend Developer',
                'division' => 'IT Development',
                'work_schedule_id' => 1,
            ]
        );

        TblMahasiswa::updateOrCreate(
            ['user_id' => $internCompleted1->user_id],
            [
                'nama' => 'Budi Santoso',
                'email' => 'budi@student.ub.ac.id',
                'universitas' => 'Universitas Brawijaya',
                'jurusan' => 'Teknik Informatika',
                'nim' => '11223344',
                'mulai_magang' => '2025-07-01',
                'akhir_magang' => '2025-12-31',
                'alamat' => 'Jl. Sudirman No. 100, Jakarta',
                'no_telp' => '08111223344',
                'id_site' => $site1->id_site,
                'jenjang_pendidikan' => 'S1',
                'nomor_darurat' => '08111223300',
                'nama_kontak_darurat' => 'Ani Santoso (Ibu)',
                'gender' => 'L',
                'semester' => 8,
                'nik' => '3171010104950004',
                'tempat_lahir' => 'Jakarta',
                'tanggal_lahir' => '1995-01-01',
                'job_position' => 'System Administrator',
                'division' => 'Infrastructure',
                'work_schedule_id' => 1,
            ]
        );

        TblMahasiswa::updateOrCreate(
            ['user_id' => $internCompleted2->user_id],
            [
                'nama' => 'Rina Wijaya',
                'email' => 'rina@student.ub.ac.id',
                'universitas' => 'Universitas Airlangga',
                'jurusan' => 'Desain Komunikasi Visual',
                'nim' => '55667788',
                'mulai_magang' => '2025-08-01',
                'akhir_magang' => '2026-01-15',
                'alamat' => 'Jl. Gatot Subroto No. 50, Surabaya',
                'no_telp' => '08155667788',
                'id_site' => $site2->id_site,
                'jenjang_pendidikan' => 'S1',
                'nomor_darurat' => '08155667700',
                'nama_kontak_darurat' => 'Dedi Wijaya (Ayah)',
                'gender' => 'P',
                'semester' => 8,
                'nik' => '3575020508960005',
                'tempat_lahir' => 'Surabaya',
                'tanggal_lahir' => '1996-08-05',
                'job_position' => 'UI/UX Designer',
                'division' => 'Design',
                'work_schedule_id' => 1,
            ]
        );

        TblMahasiswa::updateOrCreate(
            ['user_id' => $internNew->user_id],
            [
                'nama' => 'Budiono Siregar',
                'email' => 'budionolaut@student.laut.ac.id',
                'universitas' => 'Universitas Samudra Internasional',
                'jurusan' => 'Teknik Kapal Laut',
                'nim' => '99887766',
                'mulai_magang' => '2026-02-01',
                'akhir_magang' => '2026-07-31',
                'alamat' => 'Jl. Pantai No. 1, Jakarta',
                'no_telp' => '08985121658785',
                'id_site' => $site1->id_site,
                'jenjang_pendidikan' => 'S1',
                'nomor_darurat' => '08985121650000',
                'nama_kontak_darurat' => 'Siti Aminah (Ibu)',
                'gender' => 'L',
                'semester' => 6,
                'nik' => '1204130609970006',
                'tempat_lahir' => 'Medan',
                'tanggal_lahir' => '1997-06-09',
                'job_position' => 'Marine Engineer',
                'division' => 'Engineering',
                'work_schedule_id' => 1,
            ]
        );

        // 7. Seed data aktivitas (Izin dulu, baru Absensi agar sinkron)
        $this->call([
            LiburSeeder::class,     // Seed hari libur nasional
            IzinSeeder::class,      // Izin dulu
            AbsensiSeeder::class,   // Absensi skip tanggal yang ada leave_requests
            LogbookSeeder::class,
        ]);
    }
}
