<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Role;
use App\Models\Permission;

class RolePermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     * 
     * Permission mapping per role:
     * 
     * ADMIN: view_dashboard, view_intern_monitoring, view_logs, view_leave_requests, view_correction,
     *        view_logbooks_monitoring, view_evaluation, view_reports, view_user_role,
     *        view_user_permissions, view_intern_profiles, view_intern_mapping,
     *        view_office_locations, view_working_schedule, view_profile
     * 
     * MENTOR: view_dashboard, view_intern_monitoring, view_leave_requests, view_correction, view_logs,
     *         view_logbooks_monitoring, view_evaluation, view_reports, view_profile
     * 
     * INTERN: view_dashboard, view_attendance_today, view_history, view_leave_requests, view_correction,
     *         view_daily_activities, view_result_evaluation, view_profile
     */
    public function run(): void
    {
        $admin = Role::firstWhere('name', 'admin');
        $mentor = Role::firstWhere('name', 'mentor');
        $intern = Role::firstWhere('name', 'intern');

        if (! $admin || ! $mentor || ! $intern) {
            $this->command->info('One or more roles not found, skipping RolePermissionSeeder');
            return;
        }

        // Admin permissions
        $adminPermNames = [
            'view_dashboard',
            'view_intern_monitoring',
            'view_logs',
            'view_presence',
            'view_leave_request',
            'view_correction',
            'view_logbook',
            'view_input_evaluation',
            'view_result_evaluation',
            'view_reports',
            'view_user_role',
            'view_user_permissions',
            'view_intern_profiles',
            'view_intern_mapping',
            'view_office_locations',
            'view_working_schedule',
            'view_evaluation_component',
            'view_logbook_tags',
            'view_profile',
        ];
        $adminPermIds = Permission::whereIn('name', $adminPermNames)->pluck('permission_id')->toArray();
        $admin->permissions()->sync($adminPermIds);

        // Mentor permissions
        $mentorPermNames = [
            'view_dashboard',
            'view_intern_monitoring',
            'view_leave_request',
            'view_correction',
            'view_logs',
            'view_logbook',
            'view_input_evaluation',
            'view_reports',
            'view_profile',
        ];
        $mentorPermIds = Permission::whereIn('name', $mentorPermNames)->pluck('permission_id')->toArray();
        $mentor->permissions()->sync($mentorPermIds);

        // Intern permissions
        $internPermNames = [
            'view_dashboard',
            'view_presence',
            'view_logs',
            'view_leave_request',
            'view_correction',
            'view_logbook',
            'view_result_evaluation',
            'view_profile',
        ];
        $internPermIds = Permission::whereIn('name', $internPermNames)->pluck('permission_id')->toArray();
        $intern->permissions()->sync($internPermIds);

        // Invalidate cache
        \Illuminate\Support\Facades\Cache::forget('role_permissions_map');

        $this->command->info('Assigned role-specific permissions for admin, mentor, and intern.');
    }
}
