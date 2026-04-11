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
        // SQLite tidak support alter enum, jadi pakai string sementara
        Schema::table('izin', function (Blueprint $table) {
            $table->string('status_tmp')->default('pending');
        });
        // Copy data lama ke kolom baru
        \DB::statement('UPDATE izin SET status_tmp = status');
        // Drop foreign key jika ada, drop kolom lama, rename kolom baru
        Schema::table('izin', function (Blueprint $table) {
            $table->dropColumn('status');
        });
        Schema::table('izin', function (Blueprint $table) {
            $table->enum('status', ['pending', 'pending_admin', 'approved', 'rejected'])->default('pending');
        });
        \DB::statement('UPDATE izin SET status = status_tmp');
        Schema::table('izin', function (Blueprint $table) {
            $table->dropColumn('status_tmp');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Kembalikan ke enum awal
        Schema::table('izin', function (Blueprint $table) {
            $table->string('status_tmp')->default('pending');
        });
        \DB::statement('UPDATE izin SET status_tmp = status');
        Schema::table('izin', function (Blueprint $table) {
            $table->dropColumn('status');
        });
        Schema::table('izin', function (Blueprint $table) {
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
        });
        \DB::statement('UPDATE izin SET status = status_tmp');
        Schema::table('izin', function (Blueprint $table) {
            $table->dropColumn('status_tmp');
        });
    }
};
