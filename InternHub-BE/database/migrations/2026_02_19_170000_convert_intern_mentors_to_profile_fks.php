<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('intern_mentors', function (Blueprint $table) {
            // Drop legacy FK to users if exists
            try { $table->dropForeign(['intern_id']); } catch (\Exception $e) {}
            try { $table->dropForeign(['mentor_id']); } catch (\Exception $e) {}

            // Remove legacy user-based columns
            if (Schema::hasColumn('intern_mentors', 'intern_id')) {
                $table->dropColumn('intern_id');
            }
            if (Schema::hasColumn('intern_mentors', 'mentor_id')) {
                $table->dropColumn('mentor_id');
            }

            // Rename profile-backed columns to canonical names
            if (Schema::hasColumn('intern_mentors', 'intern_mahasiswa_id')) {
                $table->renameColumn('intern_mahasiswa_id', 'intern_id');
            }
            if (Schema::hasColumn('intern_mentors', 'mentor_karyawan_id')) {
                $table->renameColumn('mentor_karyawan_id', 'mentor_id');
            }

            // Add new foreign keys pointing to profile tables
            $table->unsignedBigInteger('intern_id')->change();
            $table->unsignedBigInteger('mentor_id')->change();

            $table->foreign('intern_id')->references('id_mahasiswa')->on('students')->onDelete('cascade');
            $table->foreign('mentor_id')->references('id_karyawan')->on('employees')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::table('intern_mentors', function (Blueprint $table) {
            // Drop new FK constraints
            try { $table->dropForeign(['intern_id']); } catch (\Exception $e) {}
            try { $table->dropForeign(['mentor_id']); } catch (\Exception $e) {}

            // Rename profile columns back to legacy names
            if (Schema::hasColumn('intern_mentors', 'intern_id')) {
                $table->renameColumn('intern_id', 'intern_mahasiswa_id');
            }
            if (Schema::hasColumn('intern_mentors', 'mentor_id')) {
                $table->renameColumn('mentor_id', 'mentor_karyawan_id');
            }

            // Recreate legacy user_id columns (nullable) for rollback safety
            if (! Schema::hasColumn('intern_mentors', 'intern_id')) {
                $table->unsignedBigInteger('intern_id')->nullable()->after('id');
            }
            if (! Schema::hasColumn('intern_mentors', 'mentor_id')) {
                $table->unsignedBigInteger('mentor_id')->nullable()->after('intern_id');
            }

            // Recreate foreign keys to users as nullable
            try { $table->foreign('intern_id')->references('user_id')->on('users')->onDelete('cascade'); } catch (\Exception $e) {}
            try { $table->foreign('mentor_id')->references('user_id')->on('users')->onDelete('cascade'); } catch (\Exception $e) {}
        });
    }
};
