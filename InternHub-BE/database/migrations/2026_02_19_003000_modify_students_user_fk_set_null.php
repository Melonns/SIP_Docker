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
        Schema::table('students', function (Blueprint $table) {
            // Drop existing FK (if any) and recreate with SET NULL
            try {
                $table->dropForeign(['user_id']);
            } catch (\Exception $e) {
                // ignore if foreign key does not exist
            }

            // ensure column exists
            if (! Schema::hasColumn('students', 'user_id')) {
                $table->unsignedBigInteger('user_id')->nullable()->after('id_mahasiswa');
            }

            $table->foreign('user_id')->references('user_id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            try { $table->dropForeign(['user_id']); } catch (\Exception $e) {}
            $table->foreign('user_id')->references('user_id')->on('users')->onDelete('cascade');
        });
    }
};