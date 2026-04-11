<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use App\Models\Permission;
use App\Models\Role;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // 1. Create new permissions
        $newPerms = [
            ['name' => 'view_dashboard_admin', 'label' => 'Lihat Dashboard Admin', 'group' => 'dashboard'],
            ['name' => 'view_dashboard_mentor', 'label' => 'Lihat Dashboard Mentor', 'group' => 'dashboard'],
            ['name' => 'view_dashboard_intern', 'label' => 'Lihat Dashboard Intern', 'group' => 'dashboard'],
        ];

        foreach ($newPerms as $p) {
            Permission::create($p);
        }

        // 2. Assign to roles
        $adminRole = Role::where('name', 'admin')->first();
        $mentorRole = Role::where('name', 'mentor')->first();
        $internRole = Role::where('name', 'intern')->first();

        // Admin gets view_dashboard_admin
        if ($adminRole) {
            $p = Permission::where('name', 'view_dashboard_admin')->first();
            $adminRole->permissions()->attach($p->permission_id);
            // Detach old view_dashboard if exists
            $old = Permission::where('name', 'view_dashboard')->first();
            if ($old) $adminRole->permissions()->detach($old->permission_id);
        }

        // Mentor gets view_dashboard_mentor
        if ($mentorRole) {
            $p = Permission::where('name', 'view_dashboard_mentor')->first();
            $mentorRole->permissions()->attach($p->permission_id);
            $old = Permission::where('name', 'view_dashboard')->first();
            if ($old) $mentorRole->permissions()->detach($old->permission_id);
        }

        // Intern gets view_dashboard_intern
        if ($internRole) {
            $p = Permission::where('name', 'view_dashboard_intern')->first();
            $internRole->permissions()->attach($p->permission_id);
            $old = Permission::where('name', 'view_dashboard')->first();
            if ($old) $internRole->permissions()->detach($old->permission_id);
        }

        // 3. Delete old permission 'view_dashboard'
        Permission::where('name', 'view_dashboard')->delete();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Re-create old permission
        $old = Permission::create(['name' => 'view_dashboard', 'label' => 'Lihat Dashboard', 'group' => 'dashboard']);

        // Remove new permissions and restore old one to roles
        $params = ['view_dashboard_admin', 'view_dashboard_mentor', 'view_dashboard_intern'];
        $newPerms = Permission::whereIn('name', $params)->get();

        $adminRole = Role::where('name', 'admin')->first();
        if ($adminRole) {
             $adminRole->permissions()->attach($old->permission_id);
             $adminRole->permissions()->detach($newPerms->where('name', 'view_dashboard_admin')->pluck('permission_id'));
        }
        // ... simplistic rollback logic, fine for now
        Permission::whereIn('name', $params)->delete();
    }
};
