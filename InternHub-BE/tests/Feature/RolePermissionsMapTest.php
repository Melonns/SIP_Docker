<?php

namespace Tests\Feature;

use Tests\TestCase;
use Illuminate\Foundation\Testing\RefreshDatabase;
use App\Models\Role;
use App\Models\Permission;
use App\Models\User;

class RolePermissionsMapTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_get_compact_role_permissions_map()
    {
        $adminRole = Role::create(['name' => 'admin', 'label' => 'Admin']);
        $mentorRole = Role::create(['name' => 'mentor', 'label' => 'Mentor']);

        $p1 = Permission::create(['name' => 'view_dashboard', 'label' => 'View Dashboard', 'group' => 'Dashboard']);
        $p2 = Permission::create(['name' => 'manage_users', 'label' => 'Manage Users', 'group' => 'Master Data']);

        $adminRole->permissions()->attach([$p1->permission_id, $p2->permission_id]);
        $mentorRole->permissions()->attach([$p1->permission_id]);

        $admin = User::create([
            'username' => 'adminuser2',
            'password' => bcrypt('secret'),
            'identifier' => '0003',
            'nama' => 'Admin User',
            'status' => 'active'
        ]);
        $admin->roles()->attach($adminRole->role_id);

        $this->actingAs($admin, 'sanctum')
            ->getJson('/api/admin/roles/permissions/map')
            ->assertStatus(200)
            ->assertJsonStructure(['success', 'data'])
            ->assertJsonFragment(['admin' => ['view_dashboard', 'manage_users']]);
    }

    public function test_admin_can_import_mapping()
    {
        $adminRole = Role::create(['name' => 'admin', 'label' => 'Admin']);
        $p1 = Permission::create(['name' => 'view_dashboard', 'label' => 'View Dashboard', 'group' => 'Dashboard']);

        $admin = User::create([
            'username' => 'adminuser3',
            'password' => bcrypt('secret'),
            'identifier' => '0004',
            'nama' => 'Admin User',
            'status' => 'active'
        ]);
        $admin->roles()->attach($adminRole->role_id);

        $payload = ['mapping' => ['admin' => ['view_dashboard']]];

        $this->actingAs($admin, 'sanctum')
            ->postJson('/api/admin/roles/permissions/import', $payload)
            ->assertStatus(200)
            ->assertJson(['success' => true]);

        $this->assertDatabaseHas('permission_role', ['role_id' => $adminRole->role_id, 'permission_id' => $p1->permission_id]);
    }
}