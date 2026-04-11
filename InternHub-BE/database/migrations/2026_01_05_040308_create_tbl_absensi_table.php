<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    // File: ...create_attendances_table.php
    public function up(): void
    {
        Schema::create('attendances', function (Blueprint $table) {
            $table->id('id_absensi');
            $table->unsignedBigInteger('id_mahasiswa')->nullable(); // Nullable karena sekarang pakai user_id
            $table->foreign('id_mahasiswa')->references('id_mahasiswa')->on('students')->onDelete('cascade');
            $table->string('status'); // Changed from integer to string (masuk/pulang)
            $table->time('waktu');
            $table->date('tanggal');
            $table->double('latitude_absen');
            $table->double('longitude_absen');
            $table->timestamps();
        });
    }


    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attendances');
    }
};
