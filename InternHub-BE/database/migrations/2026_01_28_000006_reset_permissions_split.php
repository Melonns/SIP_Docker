<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Artisan;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Reset permissions to apply split changes (Admin vs Mentor variants).
     */
    public function up(): void
    {
        // Disable Foreign Key Checks to allow truncation
        DB::statement('SET FOREIGN_KEY_CHECKS=0;');

        // Truncate Main Tables
        DB::table('permissions')->truncate();
        DB::table('permission_role')->truncate();
        DB::table('permission_user')->truncate();
        
        // Also clear cache to be safe
        // app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();
        try {
            Artisan::call('cache:clear');
        } catch (\Exception $e) {
            // ignore
        }

        DB::statement('SET FOREIGN_KEY_CHECKS=1;');

        // Re-run Seeders with new split configuration
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
        // No rollback intended for reset migration
    }
};
