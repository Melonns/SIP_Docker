<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

class PermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // applicable_roles column may not exist yet when this seeder is called
        // from within an older migration (2026_01_28_000006_reset_permissions_split).
        // Guard against that to avoid "Unknown column" errors on fresh installs.
        $hasApplicableRoles = Schema::hasColumn('permissions', 'applicable_roles');

        $permissions = [
            // Dashboard
            ['name' => 'view_dashboard', 'label' => 'View Dashboard', 'group' => 'dashboard', 'applicable_roles' => null],

            // Intern Monitoring (admin/mentor only - intern nggak monitoring intern lain)
            ['name' => 'view_intern_monitoring', 'label' => 'View Intern Monitoring', 'group' => 'intern_monitoring', 'applicable_roles' => ['admin', 'mentor']],

            // Attendance
            ['name' => 'view_logs', 'label' => 'View Attendance Logs', 'group' => 'attendance', 'applicable_roles' => null],
            ['name' => 'view_presence', 'label' => 'View Presence', 'group' => 'attendance', 'applicable_roles' => ['intern']],

            // Izin & Correction (semua role bisa)
            ['name' => 'view_leave_request', 'label' => 'View Leave Request', 'group' => 'attendance', 'applicable_roles' => null],
            ['name' => 'view_correction', 'label' => 'View Attendance Correction', 'group' => 'attendance', 'applicable_roles' => null],

            // Logbook (semua role bisa)
            ['name' => 'view_logbook', 'label' => 'View Logbook', 'group' => 'logbooks', 'applicable_roles' => ['intern']],

            // Evaluation
            ['name' => 'view_input_evaluation', 'label' => 'Input Evaluation', 'group' => 'evaluation', 'applicable_roles' => ['admin', 'mentor']],
            ['name' => 'view_result_evaluation', 'label' => 'View Evaluation Result', 'group' => 'evaluation', 'applicable_roles' => ['intern']],

            // Reports (admin/mentor only - intern nggak generate report)
            ['name' => 'view_reports', 'label' => 'View Reports', 'group' => 'reports', 'applicable_roles' => ['admin', 'mentor']],

            // Master Data (SEMUA khusus admin/mentor, intern TIDAK MUNGKIN)
            ['name' => 'view_user_role', 'label' => 'View User & Role', 'group' => 'master_data', 'applicable_roles' => ['admin', 'mentor']],
            ['name' => 'view_user_permissions', 'label' => 'View User Permission', 'group' => 'master_data', 'applicable_roles' => ['admin', 'mentor']],
            ['name' => 'view_intern_profiles', 'label' => 'View Intern Profiles', 'group' => 'master_data', 'applicable_roles' => ['admin', 'mentor']],
            ['name' => 'view_intern_mapping', 'label' => 'View Intern Mapping', 'group' => 'master_data', 'applicable_roles' => ['admin']],
            ['name' => 'view_office_locations', 'label' => 'View Office Locations', 'group' => 'master_data', 'applicable_roles' => ['admin', 'mentor']],
            ['name' => 'view_working_schedule', 'label' => 'View Working Schedule', 'group' => 'master_data', 'applicable_roles' => ['admin', 'mentor']],
            ['name' => 'view_evaluation_component', 'label' => 'View Evaluation Component', 'group' => 'master_data', 'applicable_roles' => ['admin']],

            // Profile (semua role)
            ['name' => 'view_profile', 'label' => 'View Profile', 'group' => 'profile', 'applicable_roles' => null],
        ];

        foreach ($permissions as $permission) {
            $data = $permission;
            if (! $hasApplicableRoles) {
                unset($data['applicable_roles']);
            }
            Permission::updateOrCreate(
                ['name' => $data['name']],
                $data
            );
        }
    }
}
