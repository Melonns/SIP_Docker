<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Reset permissions to ensure they have correct IDs order (Dashboard first).
     */
    public function up(): void
    {
        // Disable Foreign Key Checks to allow truncation (role_has_permissions, model_has_permissions)
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');

        // Truncate Main Tables
        DB::table('permissions')->truncate();
        DB::table('permission_role')->truncate();
        DB::table('permission_user')->truncate();

        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        // Re-run Seeders
        Artisan::call('db:seed', [
            '--class' => 'PermissionSeeder',
            '--force' => true
        ]);
        
        Artisan::call('db:seed', [
            '--class' => 'RolePermissionSeeder',
            '--force' => true
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No real rollback for a truncate+seed. 
        // It just stays seeded.
    }
};
