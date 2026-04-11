<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('intern_mentors', function (Blueprint $table) {
            // Add profile-level foreign keys (nullable) to preserve backward compatibility
            $table->unsignedBigInteger('mentor_karyawan_id')->nullable()->after('mentor_id');
            $table->unsignedBigInteger('intern_mahasiswa_id')->nullable()->after('intern_id');

            // add FK constraints if referenced tables exist
            if (Schema::hasTable('employees')) {
                $table->foreign('mentor_karyawan_id')->references('id_karyawan')->on('employees')->nullOnDelete();
            }
            if (Schema::hasTable('students')) {
                $table->foreign('intern_mahasiswa_id')->references('id_mahasiswa')->on('students')->nullOnDelete();
            }
        });

        // Backfill from existing user-based mapping where possible
        // mentor -> employees (via users.user_id = employees.user_id)
        DB::statement(<<<'SQL'
            UPDATE intern_mentors im
            LEFT JOIN users u_mentor ON im.mentor_id = u_mentor.user_id
            LEFT JOIN employees e ON u_mentor.user_id = e.user_id
            SET im.mentor_karyawan_id = e.id_karyawan
            WHERE e.id_karyawan IS NOT NULL;
        SQL
        );

        // intern -> students (via users.user_id = students.user_id)
        DB::statement(<<<'SQL'
            UPDATE intern_mentors im
            LEFT JOIN users u_intern ON im.intern_id = u_intern.user_id
            LEFT JOIN students s ON u_intern.user_id = s.user_id
            SET im.intern_mahasiswa_id = s.id_mahasiswa
            WHERE s.id_mahasiswa IS NOT NULL;
        SQL
        );
    }

    public function down(): void
    {
        Schema::table('intern_mentors', function (Blueprint $table) {
            try { $table->dropForeign(['mentor_karyawan_id']); } catch (\Exception $e) {}
            try { $table->dropForeign(['intern_mahasiswa_id']); } catch (\Exception $e) {}
            $table->dropColumn(['mentor_karyawan_id', 'intern_mahasiswa_id']);
        });
    }
};
