<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\Role;
use App\Models\Permission;
use App\Models\User;

class UserPermissionScopeTest extends TestCase
{
    use RefreshDatabase;

    public function test_cannot_assign_permission_outside_role_scope()
    {
        $internRole = Role::create(['name' => 'intern', 'label' => 'Intern']);
        $adminRole = Role::create(['name' => 'admin', 'label' => 'Admin']);

        $pIntern = Permission::create(['name' => 'view_attendance', 'label' => 'View Attendance', 'group' => 'attendance']);
        $pAdmin = Permission::create(['name' => 'manage_users', 'label' => 'Manage Users', 'group' => 'user_management']);

        // assign role-level perms
        $internRole->permissions()->syncWithoutDetaching([$pIntern->permission_id]);
        $adminRole->permissions()->syncWithoutDetaching([$pAdmin->permission_id]);

        $user = User::create(['username' => 'jun3', 'password' => bcrypt('secret'), 'identifier' => '010', 'nama' => 'Junior 3', 'status' => 'active']);
        $user->roles()->syncWithoutDetaching([$internRole->role_id]);

        $admin = User::create(['username' => 'super4', 'password' => bcrypt('secret'), 'identifier' => '011', 'nama' => 'Super4', 'status' => 'active']);
        $admin->roles()->syncWithoutDetaching([$adminRole->role_id]);

        // Attempt to assign admin permission to intern
        $payload = ['permissions' => [['permission_id' => $pAdmin->permission_id, 'is_granted' => true]]];

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/admin/users/{$user->user_id}/permissions", $payload)
            ->assertStatus(422)
            ->assertJsonFragment(['invalid_permission_ids' => [$pAdmin->permission_id]]);

        // ensure DB not updated
        $this->assertDatabaseMissing('permission_user', ['user_id' => $user->user_id, 'permission_id' => $pAdmin->permission_id]);
    }

    public function test_can_assign_allowed_permissions()
    {
        $internRole = Role::create(['name' => 'intern', 'label' => 'Intern']);
        $pIntern = Permission::create(['name' => 'view_attendance', 'label' => 'View Attendance', 'group' => 'attendance']);

        $internRole->permissions()->syncWithoutDetaching([$pIntern->permission_id]);

        $user = User::create(['username' => 'jun4', 'password' => bcrypt('secret'), 'identifier' => '012', 'nama' => 'Junior 4', 'status' => 'active']);
        $user->roles()->syncWithoutDetaching([$internRole->role_id]);

        $admin = User::create(['username' => 'super5', 'password' => bcrypt('secret'), 'identifier' => '013', 'nama' => 'Super5', 'status' => 'active']);
        $adminRole = Role::create(['name' => 'admin', 'label' => 'Admin']);
        $admin->roles()->syncWithoutDetaching([$adminRole->role_id]);

        $payload = ['permissions' => [['permission_id' => $pIntern->permission_id, 'is_granted' => true]]];

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/admin/users/{$user->user_id}/permissions", $payload)
            ->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('permission_user', ['user_id' => $user->user_id, 'permission_id' => $pIntern->permission_id, 'is_granted' => 1]);
    }
}
