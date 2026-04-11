<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class() extends Migration
{
    public function up(): void
    {
        // Add student/employee profile FKs to core tables that still use users.user_id
        Schema::table('logbooks', function (Blueprint $table) {
            if (!Schema::hasColumn('logbooks', 'id_mahasiswa')) {
                $table->unsignedBigInteger('id_mahasiswa')->nullable()->after('user_id')->index();
                $table->foreign('id_mahasiswa')->references('id_mahasiswa')->on('students')->nullOnDelete();
            }
        });

        Schema::table('izin', function (Blueprint $table) {
            if (!Schema::hasColumn('izin', 'id_mahasiswa')) {
                $table->unsignedBigInteger('id_mahasiswa')->nullable()->after('user_id')->index();
                $table->foreign('id_mahasiswa')->references('id_mahasiswa')->on('students')->nullOnDelete();
            }
        });

        Schema::table('attendance_corrections', function (Blueprint $table) {
            if (!Schema::hasColumn('attendance_corrections', 'id_mahasiswa')) {
                $table->unsignedBigInteger('id_mahasiswa')->nullable()->after('user_id')->index();
                $table->foreign('id_mahasiswa')->references('id_mahasiswa')->on('students')->nullOnDelete();
            }
        });

        Schema::table('evaluations', function (Blueprint $table) {
            if (!Schema::hasColumn('evaluations', 'intern_mahasiswa_id')) {
                $table->unsignedBigInteger('intern_mahasiswa_id')->nullable()->after('user_id')->index();
                $table->foreign('intern_mahasiswa_id')->references('id_mahasiswa')->on('students')->nullOnDelete();
            }
            if (!Schema::hasColumn('evaluations', 'mentor_karyawan_id')) {
                $table->unsignedBigInteger('mentor_karyawan_id')->nullable()->after('mentor_id')->index();
                $table->foreign('mentor_karyawan_id')->references('id_karyawan')->on('employees')->nullOnDelete();
            }
        });

        // Backfill: try to populate profile FKs from existing user_id / mentor_id values
        // Use SQL updates for performance and to avoid large Eloquent loops in migrations.
        // 1) logbooks.id_mahasiswa <- students.id_mahasiswa where logbooks.user_id = students.user_id
        DB::statement(<<<'SQL'
            UPDATE logbooks lb
            JOIN students s ON s.user_id = lb.user_id
            SET lb.id_mahasiswa = s.id_mahasiswa
            WHERE lb.id_mahasiswa IS NULL;
        SQL
        );

        // 2) izins.id_mahasiswa <- students.id_mahasiswa
        DB::statement(<<<'SQL'
            UPDATE izin z
            JOIN students s ON s.user_id = z.user_id
            SET z.id_mahasiswa = s.id_mahasiswa
            WHERE z.id_mahasiswa IS NULL;
        SQL
        );

        // 3) koreksi_absensis.id_mahasiswa <- students.id_mahasiswa
        DB::statement(<<<'SQL'
            UPDATE attendance_corrections k
            JOIN students s ON s.user_id = k.user_id
            SET k.id_mahasiswa = s.id_mahasiswa
            WHERE k.id_mahasiswa IS NULL;
        SQL
        );

        // 4) evaluations.intern_mahasiswa_id <- students.id_mahasiswa (from evaluations.user_id)
        DB::statement(<<<'SQL'
            UPDATE evaluations e
            JOIN students s ON s.user_id = e.user_id
            SET e.intern_mahasiswa_id = s.id_mahasiswa
            WHERE e.intern_mahasiswa_id IS NULL;
        SQL
        );

        // 5) evaluations.mentor_karyawan_id <- employees.id_karyawan (from evaluations.mentor_id)
        DB::statement(<<<'SQL'
            UPDATE evaluations e
            JOIN employees emp ON emp.user_id = e.mentor_id
            SET e.mentor_karyawan_id = emp.id_karyawan
            WHERE e.mentor_karyawan_id IS NULL;
        SQL
        );
    }

    public function down(): void
    {
        Schema::table('evaluations', function (Blueprint $table) {
            if (Schema::hasColumn('evaluations', 'mentor_karyawan_id')) {
                try { $table->dropForeign(['mentor_karyawan_id']); } catch (\Exception $e) {}
                $table->dropColumn('mentor_karyawan_id');
            }
            if (Schema::hasColumn('evaluations', 'intern_mahasiswa_id')) {
                try { $table->dropForeign(['intern_mahasiswa_id']); } catch (\Exception $e) {}
                $table->dropColumn('intern_mahasiswa_id');
            }
        });

        Schema::table('attendance_corrections', function (Blueprint $table) {
            if (Schema::hasColumn('attendance_corrections', 'id_mahasiswa')) {
                try { $table->dropForeign(['id_mahasiswa']); } catch (\Exception $e) {}
                $table->dropColumn('id_mahasiswa');
            }
        });

        Schema::table('izin', function (Blueprint $table) {
            if (Schema::hasColumn('izin', 'id_mahasiswa')) {
                try { $table->dropForeign(['id_mahasiswa']); } catch (\Exception $e) {}
                $table->dropColumn('id_mahasiswa');
            }
        });

        Schema::table('logbooks', function (Blueprint $table) {
            if (Schema::hasColumn('logbooks', 'id_mahasiswa')) {
                try { $table->dropForeign(['id_mahasiswa']); } catch (\Exception $e) {}
                $table->dropColumn('id_mahasiswa');
            }
        });
    }
};
