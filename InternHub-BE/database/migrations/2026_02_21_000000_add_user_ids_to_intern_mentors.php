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
        Schema::table('intern_mentors', function (Blueprint $table) {
            $table->unsignedBigInteger('intern_user_id')->nullable()->after('intern_id');
            $table->unsignedBigInteger('mentor_user_id')->nullable()->after('mentor_id');
            
            // Indexes for performance
            $table->index('intern_user_id');
            $table->index('mentor_user_id');
        });

        // Sync existing data
        // For interns (id_mahasiswa -> user_id)
        DB::statement("
            UPDATE intern_mentors im
            JOIN students s ON im.intern_id = s.id_mahasiswa
            SET im.intern_user_id = s.user_id
        ");

        // For mentors (id_karyawan -> user_id)
        DB::statement("
            UPDATE intern_mentors im
            JOIN employees e ON im.mentor_id = e.id_karyawan
            SET im.mentor_user_id = e.user_id
        ");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('intern_mentors', function (Blueprint $table) {
            $table->dropColumn(['intern_user_id', 'mentor_user_id']);
        });
    }
};
