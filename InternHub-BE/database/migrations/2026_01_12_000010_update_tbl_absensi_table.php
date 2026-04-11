<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Update attendances untuk mendukung fitur foto dan relasi ke users
     */
    public function up(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            // Foto wajah saat absen (live capture)
            $table->string('foto_absen')->nullable()->after('longitude_absen');
            // User ID untuk relasi ke users table
            $table->unsignedBigInteger('user_id')->nullable()->after('id_mahasiswa');
            
            $table->foreign('user_id')->references('user_id')->on('users')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('attendances', function (Blueprint $table) {
            $table->dropForeign(['user_id']);
            $table->dropColumn(['foto_absen', 'user_id']);
        });
    }
};
