<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\Role;
use App\Models\Permission;
use App\Models\User;

class UserEffectivePermissionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_effective_permissions_includes_inherited_from_roles()
    {
        $adminRole = Role::create(['name' => 'admin', 'label' => 'Admin']);
        $internRole = Role::create(['name' => 'intern', 'label' => 'Intern']);

        $p1 = Permission::create(['name' => 'view_reports', 'label' => 'View Reports', 'group' => 'reports']);
        $p2 = Permission::create(['name' => 'manage_users', 'label' => 'Manage Users', 'group' => 'user_management']);

        // assign p1 to intern role, p2 to admin role
        $internRole->permissions()->attach($p1->permission_id);
        $adminRole->permissions()->attach($p2->permission_id);

        $user = User::create([
            'username' => 'junior',
            'password' => bcrypt('secret'),
            'identifier' => '0005',
            'nama' => 'Junior Dev',
            'status' => 'active'
        ]);
        $user->roles()->attach($internRole->role_id);

        // Call as admin to access admin-only endpoint
        $admin = User::create([
            'username' => 'super',
            'password' => bcrypt('secret'),
            'identifier' => '0007',
            'nama' => 'Super Admin',
            'status' => 'active'
        ]);
        $adminRole = Role::create(['name' => 'admin', 'label' => 'Admin']);
        $admin->roles()->attach($adminRole->role_id);

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/users/{$user->user_id}/permissions/effective")
            ->assertStatus(200)
            ->assertJsonPath('data.roles', ['intern'])
            ->assertJsonPath('data.permissions.0.name', 'view_reports')
            ->assertJsonPath('data.permissions.0.inherited_from_roles', ['intern'])
            ->assertJsonPath('data.permissions.0.effective', true);
    }

    public function test_user_override_precedence_over_inherited()
    {
        $mentorRole = Role::create(['name' => 'mentor', 'label' => 'Mentor']);
        $p = Permission::create(['name' => 'verify_logbooks', 'label' => 'Verify Logbook', 'group' => 'logbooks']);
        $mentorRole->permissions()->attach($p->permission_id);

        $user = User::create([
            'username' => 'temp',
            'password' => bcrypt('secret'),
            'identifier' => '0006',
            'nama' => 'Temp User',
            'status' => 'active'
        ]);
        $user->roles()->attach($mentorRole->role_id);

        // Explicitly deny via user override
        $user->permissions()->sync([$p->permission_id => ['is_granted' => false]]);

        $admin = User::create([
            'username' => 'super2',
            'password' => bcrypt('secret'),
            'identifier' => '0008',
            'nama' => 'Super Admin2',
            'status' => 'active'
        ]);
        $adminRole = Role::firstWhere('name', 'admin') ?? Role::create(['name' => 'admin', 'label' => 'Admin']);
        $admin->roles()->attach($adminRole->role_id);

        $this->actingAs($admin, 'sanctum')
            ->getJson("/api/admin/users/{$user->user_id}/permissions/effective")
            ->assertStatus(200)
            ->assertJsonPath('data.permissions.0.user_override', false)
            ->assertJsonPath('data.permissions.0.effective', false);
    }
}
