<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'work_schedule_id')) {
                $table->foreignId('work_schedule_id')->nullable()->after('id_site')->constrained('work_schedules')->onDelete('set null');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::disableForeignKeyConstraints();
        
        // Drop the column
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'work_schedule_id')) {
                $table->dropColumn('work_schedule_id');
            }
        });
        
        Schema::enableForeignKeyConstraints();
    }
};

