<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // add non-unique index on email if not present
            try {
                $table->index('email', 'users_email_index');
            } catch (\Exception $e) {
                // index may already exist on some environments
            }
        });

        Schema::table('students', function (Blueprint $table) {
            // add index for akhir_magang (used by reports / ordering)
            try {
                $table->index('akhir_magang', 'students_akhir_magang_index');
            } catch (\Exception $e) {
                // ignore if exists
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            try { $table->dropIndex('users_email_index'); } catch (\Exception $e) {}
        });

        Schema::table('students', function (Blueprint $table) {
            try { $table->dropIndex('students_akhir_magang_index'); } catch (\Exception $e) {}
        });
    }
};