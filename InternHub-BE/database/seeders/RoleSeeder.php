<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $roles = [
            [
                'name' => 'admin',
                'label' => 'Administrator',
            ],
            [
                'name' => 'mentor',
                'label' => 'Mentor/Pembimbing',
            ],
            [
                'name' => 'intern',
                'label' => 'Mahasiswa Magang',
            ],
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(
                ['name' => $role['name']],
                $role
            );
        }
    }
}
