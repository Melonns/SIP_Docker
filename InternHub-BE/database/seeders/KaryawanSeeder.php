<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\TblKaryawan;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class KaryawanSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get role IDs
        $adminRoleId = \App\Models\Role::where('name', 'admin')->first()?->role_id;
        $mentorRoleId = \App\Models\Role::where('name', 'mentor')->first()?->role_id;

        if (!$adminRoleId || !$mentorRoleId) {
            echo "Roles tidak ditemukan. Jalankan RoleSeeder terlebih dahulu.\n";
            return;
        }

        // Get site
        $site = \App\Models\TblSite::first();
        if (!$site) {
            echo "Site tidak ditemukan. Buat site terlebih dahulu.\n";
            return;
        }

        // 1. Create Admin User (use email as unique key; user table minimal)
        $adminUser = User::updateOrCreate(
            ['email' => 'admin@internhub.com'],
            [
                'password' => Hash::make('password123'),
                'nama' => 'Administrator',
                'email' => 'admin@internhub.com',
                'status' => 'active',
            ]
        );

        // 2. Assign admin role
        $adminUser->roles()->syncWithoutDetaching([$adminRoleId]);

        // 3. Create admin karyawan profile (store NIP, site and phone here)
        TblKaryawan::updateOrCreate(
            ['user_id' => $adminUser->user_id],
            [
                'nip' => 'NIP001',
                'nama' => $adminUser->nama,
                'email' => $adminUser->email,
                'gender' => null,
                'division' => 'IT Department',
                'job_position' => 'System Administrator',
                'status' => 'active',
                'id_site' => $site->id_site,
                'no_telp' => '08120000000',
            ]
        );

        // 4. Create Mentor User
        $mentorUser = User::updateOrCreate(
            ['email' => 'dewi@internhub.com'],
            [
                'password' => Hash::make('password123'),
                'nama' => 'Dewi Lestari',
                'email' => 'dewi@internhub.com',
                'status' => 'active',
            ]
        );

        // 5. Assign mentor role
        $mentorUser->roles()->syncWithoutDetaching([$mentorRoleId]);

        // 6. Create mentor karyawan profile
        TblKaryawan::updateOrCreate(
            ['user_id' => $mentorUser->user_id],
            [
                'nip' => 'NIP002',
                'nama' => $mentorUser->nama,
                'email' => $mentorUser->email,
                'gender' => null,
                'division' => 'IT Department',
                'job_position' => 'Senior Developer',
                'status' => 'active',
                'id_site' => $site->id_site,
                'no_telp' => '08129876543',
            ]
        );

        // 7. Create additional mentor
        $mentorUser2 = User::updateOrCreate(
            ['email' => 'budi@internhub.com'],
            [
                'password' => Hash::make('password123'),
                'nama' => 'Budi Santoso',
                'email' => 'budi@internhub.com',
                'status' => 'active',
            ]
        );

        $mentorUser2->roles()->syncWithoutDetaching([$mentorRoleId]);

        TblKaryawan::updateOrCreate(
            ['user_id' => $mentorUser2->user_id],
            [
                'nip' => 'NIP003',
                'nama' => $mentorUser2->nama,
                'email' => $mentorUser2->email,
                'gender' => null,
                'division' => 'HR Department',
                'job_position' => 'HR Manager',
                'status' => 'active',
                'id_site' => $site->id_site,
                'no_telp' => '08129876544',
            ]
        );

        echo "Karyawan seeder berhasil dijalankan!\n";
    }
}
