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
        // 1. Create the permission
        $permission = Permission::firstOrCreate(
            ['name' => 'view_logbook_tags'],
            [
                'label' => 'View Logbook Tags',
                'group' => 'master_data',
                'applicable_roles' => ['admin']
            ]
        );

        // 2. Assign to Admin role
        $admin = Role::where('name', 'admin')->first();
        if ($admin) {
            $admin->permissions()->syncWithoutDetaching([$permission->permission_id]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $permission = Permission::where('name', 'view_logbook_tags')->first();
        $admin = Role::where('name', 'admin')->first();
        
        if ($admin && $permission) {
            $admin->permissions()->detach($permission->permission_id);
        }
        
        if ($permission) {
            $permission->delete();
        }
    }
};
