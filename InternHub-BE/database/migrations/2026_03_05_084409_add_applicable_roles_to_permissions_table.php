<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Adds 'applicable_roles' JSON column to permissions table.
     * null = applicable to ALL roles (flexible)
     * ["intern"] = only applicable to intern role
     * ["admin","mentor"] = only applicable to admin & mentor roles
     */
    public function up(): void
    {
        Schema::table('permissions', function (Blueprint $table) {
            $table->json('applicable_roles')->nullable()->after('group')
                ->comment('JSON array of role names this permission applies to. null = all roles.');
        });

        // Set applicable_roles for role-locked permissions
        $roleLocked = [
            // Intern-only features
            'view_presence'             => json_encode(['intern']),
            'view_result_evaluation'    => json_encode(['intern']),
            'view_logbook'              => json_encode(['intern']),

            // Admin/Mentor-only features
            'view_input_evaluation'     => json_encode(['admin', 'mentor']),
            'view_intern_monitoring'    => json_encode(['admin', 'mentor']),
            'view_reports'              => json_encode(['admin', 'mentor']),

            // Master Data (semua admin/mentor, intern TIDAK MUNGKIN)
            'view_user_role'            => json_encode(['admin', 'mentor']),
            'view_user_permissions'     => json_encode(['admin', 'mentor']),
            'view_intern_profiles'      => json_encode(['admin', 'mentor']),
            'view_intern_mapping'       => json_encode(['admin']),
            'view_office_locations'     => json_encode(['admin', 'mentor']),
            'view_working_schedule'     => json_encode(['admin', 'mentor']),
            'view_evaluation_component' => json_encode(['admin']),
        ];

        foreach ($roleLocked as $name => $roles) {
            DB::table('permissions')
                ->where('name', $name)
                ->update(['applicable_roles' => $roles]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('permissions', function (Blueprint $table) {
            $table->dropColumn('applicable_roles');
        });
    }
};
