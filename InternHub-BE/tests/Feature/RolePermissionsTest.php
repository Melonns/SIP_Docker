<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\User;
use App\Models\Role;
use App\Models\Permission;

class RolePermissionsTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_sync_role_permissions()
    {
        // seed basic roles & permissions
        $adminRole = Role::create(['name' => 'admin', 'label' => 'Admin']);
        $r2 = Role::create(['name' => 'mentor', 'label' => 'Mentor']);

        $p1 = Permission::create(['name' => 'view_dashboard', 'label' => 'View Dashboard', 'group' => 'Dashboard']);
        $p2 = Permission::create(['name' => 'manage_users', 'label' => 'Manage Users', 'group' => 'Master Data']);

        $admin = User::create([
            'username' => 'adminuser',
            'password' => bcrypt('secret'),
            'identifier' => '0001',
            'nama' => 'Admin User',
            'status' => 'active'
        ]);
        // attach admin role
        $admin->roles()->attach($adminRole->role_id);

        $this->actingAs($admin, 'sanctum')
            ->putJson("/api/admin/roles/{$adminRole->role_id}/permissions", ['permissions' => [$p1->permission_id, $p2->permission_id]])
            ->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('permission_role', ['role_id' => $adminRole->role_id, 'permission_id' => $p1->permission_id]);
        $this->assertDatabaseHas('permission_role', ['role_id' => $adminRole->role_id, 'permission_id' => $p2->permission_id]);
    }

    public function test_non_admin_cannot_sync_role_permissions()
    {
        $role = Role::create(['name' => 'mentor', 'label' => 'Mentor']);
        $p = Permission::create(['name' => 'view_dashboard', 'label' => 'View Dashboard', 'group' => 'Dashboard']);

        $user = User::create([
            'username' => 'plainuser',
            'password' => bcrypt('secret'),
            'identifier' => '0002',
            'nama' => 'Plain User',
            'status' => 'active'
        ]);
        // user without admin role
        $this->actingAs($user, 'sanctum')
            ->putJson("/api/admin/roles/{$role->role_id}/permissions", ['permissions' => [$p->permission_id]])
            ->assertStatus(403);
    }
}
