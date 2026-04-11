<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use App\Models\TblSite;
use App\Models\TblKaryawan;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class AdminUserSeeder extends Seeder
{
    /**
     * Seed minimal data untuk bisa login sebagai admin.
     * Cocok dijalankan setelah migrate:fresh tanpa --seed.
     *
     * Usage: php artisan db:seed --class=AdminUserSeeder
     */
    public function run(): void
    {
        // 1. Roles & Permissions (prerequisite)
        $this->call([
            RoleSeeder::class,
            PermissionSeeder::class,
            RolePermissionSeeder::class,
        ]);

        // 2. Site default (required FK untuk TblKaryawan)
        $site = TblSite::firstOrCreate(
            ['nama_site' => 'SIER'],
            [
                'alamat'       => 'Jl. Rungkut Industri Raya No.10, Surabaya',
                'latitude'     => -7.330588646448069,
                'longitude'    => 112.75825353820993,
                'radius_meter' => 50,
            ]
        );

        // 3. Admin user
        $adminRole = Role::where('name', 'admin')->first();
        $mentorRole = Role::where('name', 'mentor')->first();

        $admin = User::updateOrCreate(
            ['email' => 'admin@internhub.com'],
            [
                'nama'     => 'Administrator',
                'password' => Hash::make('admin123'),
                'level'    => 'admin',
                'status'   => 'active',
            ]
        );

        $admin->roles()->syncWithoutDetaching(
            array_filter([$adminRole?->role_id, $mentorRole?->role_id])
        );

        TblKaryawan::updateOrCreate(
            ['user_id' => $admin->user_id],
            [
                'nip'          => 'NIP001',
                'nama'         => $admin->nama,
                'email'        => $admin->email,
                'division'     => 'IT Department',
                'job_position' => 'System Administrator',
                'status'       => 'active',
                'id_site'      => $site->id_site,
                'no_telp'      => '08120000000',
            ]
        );

        $this->command->info('Admin user created!');
        $this->command->table(
            ['Field', 'Value'],
            [
                ['Email',    'admin@internhub.com'],
                ['Password', 'admin123'],
                ['Role',     'admin + mentor'],
            ]
        );
    }
}
