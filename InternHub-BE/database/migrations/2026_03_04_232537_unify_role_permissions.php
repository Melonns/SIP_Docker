<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Define how split permissions map to a single unified permission
        $unifications = [
            'view_dashboard' => [
                'label' => 'View Dashboard',
                'group' => 'dashboard',
                'old_names' => ['view_dashboard_admin', 'view_dashboard_mentor', 'view_dashboard_intern', 'view_dashboard']
            ],
            'view_intern_monitoring' => [
                'label' => 'View Intern Monitoring',
                'group' => 'intern_monitoring',
                'old_names' => ['view_intern_monitoring_admin', 'view_intern_monitoring_mentor', 'view_intern_monitoring']
            ],
            'view_logs' => [
                'label' => 'View Attendance Logs',
                'group' => 'attendance',
                'old_names' => ['view_logs_admin', 'view_logs_mentor', 'view_logs', 'view_history']
            ],
            'view_presence' => [
                'label' => 'View Presence',
                'group' => 'attendance',
                'old_names' => ['view_attendance_today', 'view_attendance', 'view_presence']
            ],
            'view_leave_request' => [
                'label' => 'View Leave Request',
                'group' => 'attendance',
                'old_names' => ['view_izin_admin', 'view_izin_mentor', 'view_izin_intern', 'view_izin']
            ],
            'view_correction' => [
                'label' => 'View Attendance Correction',
                'group' => 'attendance',
                'old_names' => ['view_correction_admin', 'view_correction_mentor', 'view_correction_intern']
            ],
            'view_logbook' => [
                'label' => 'View Logbook',
                'group' => 'logbooks',
                'old_names' => ['view_logbooks_monitoring_admin', 'view_logbooks_monitoring_mentor', 'view_logbooks_monitoring', 'view_daily_activities']
            ],
            'view_input_evaluation' => [
                'label' => 'Input Evaluation',
                'group' => 'evaluation',
                'old_names' => ['view_evaluation_admin', 'view_evaluation_mentor', 'view_evaluation', 'view_input_evaluation']
            ],
            'view_result_evaluation' => [
                'label' => 'View Evaluation Result',
                'group' => 'evaluation',
                'old_names' => ['view_result_evaluation']
            ],
            'view_reports' => [
                'label' => 'View Reports',
                'group' => 'reports',
                'old_names' => ['view_reports_admin', 'view_reports_mentor']
            ],
            'view_profile' => [
                'label' => 'View Profile',
                'group' => 'profile',
                'old_names' => ['view_profile_admin', 'view_profile_mentor', 'view_profile_intern']
            ],
        ];

        foreach ($unifications as $targetName => $config) {
            // 1. Create the unified permission if it doesn't exist
            $unified = \App\Models\Permission::firstOrCreate(
                ['name' => $targetName],
                ['label' => $config['label'], 'group' => $config['group']]
            );

            // 2. Find old split permissions
            $oldPerms = \App\Models\Permission::whereIn('name', $config['old_names'])->get();
            $oldPermIds = $oldPerms->pluck('permission_id')->toArray();

            if (!empty($oldPermIds)) {
                // 3. For every role that has any of the old permissions, give them the unified one
                // Use DB facade to do direct pivot inserts safely (ignore duplicates)
                $rolesWithOldPerms = \Illuminate\Support\Facades\DB::table('permission_role')
                    ->whereIn('permission_id', $oldPermIds)
                    ->pluck('role_id')
                    ->unique();

                foreach ($rolesWithOldPerms as $roleId) {
                    \Illuminate\Support\Facades\DB::table('permission_role')->updateOrInsert([
                        'role_id' => $roleId,
                        'permission_id' => $unified->permission_id
                    ]);
                }

                // Delete old permissions
                \App\Models\Permission::whereIn('permission_id', $oldPermIds)->delete();
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // One-way migration primarily. To rollback correctly requires knowing exactly which roles had what.
        // For simplicity, we just leave it as is or recreate them empty.
    }
};
