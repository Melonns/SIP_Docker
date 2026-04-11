<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    // File: ...create_students_table.php
    public function up(): void
    {
        Schema::create('students', function (Blueprint $table) {
            $table->id('id_mahasiswa');
            $table->string('nama', 255);
            $table->string('universitas', 255);
            $table->string('jurusan', 255);
            $table->string('nim', 255);
            $table->date('mulai_magang');
            $table->date('akhir_magang');
            $table->string('alamat', 255);
            $table->string('no_telp', 255);
            $table->string('foto', 255)->nullable();
            $table->unsignedBigInteger('id_site');
            $table->foreign('id_site')->references('id_site')->on('sites')->onDelete('cascade');
            $table->timestamps();
        });
    }
    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('students');
    }
};
