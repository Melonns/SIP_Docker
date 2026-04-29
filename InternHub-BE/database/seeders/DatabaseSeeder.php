<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            PermissionSeeder::class,
            RolePermissionSeeder::class,
            WorkScheduleSeeder::class,
            AdminUserSeeder::class,
            DivisionSeeder::class,
            KaryawanSeeder::class,
            LiburSeeder::class,
            KomponenSeeder::class,
            TagSeeder::class,
            TestingInternSeeder::class,
            IzinSeeder::class,
            AbsensiSeeder::class,
            LogbookSeeder::class,
        ]);
    }
}
