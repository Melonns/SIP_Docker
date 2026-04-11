<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    // File: ...create_activities_table.php
    public function up(): void
    {
        Schema::create('activities', function (Blueprint $table) {
            $table->id('id_kegiatan');
            $table->unsignedBigInteger('id_mahasiswa');
            $table->foreign('id_mahasiswa')->references('id_mahasiswa')->on('students')->onDelete('cascade');
            $table->text('kegiatan');
            $table->time('waktu_awal');
            $table->time('waktu_akhir');
            $table->date('tanggal');
            $table->timestamps();
        });
    }
    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('activities');
    }
};
