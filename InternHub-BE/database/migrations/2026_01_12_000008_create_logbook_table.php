<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Tabel untuk logbooks aktivitas harian mahasiswa
     */
    public function up(): void
    {
        Schema::create('logbooks', function (Blueprint $table) {
            $table->id('id_logbooks');
            $table->unsignedBigInteger('user_id'); // Intern
            $table->date('tanggal');
            $table->text('deskripsi_kegiatan'); // Rich text / textarea untuk deskripsi harian
            $table->time('waktu_mulai')->nullable();
            $table->time('waktu_selesai')->nullable();
            $table->enum('status_verifikasi', ['pending', 'verified', 'revision_needed'])->default('pending');
            $table->unsignedBigInteger('verified_by')->nullable(); // Mentor yang verifikasi
            $table->text('feedback')->nullable(); // Catatan dari mentor
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('user_id')->on('users')->onDelete('cascade');
            $table->foreign('verified_by')->references('user_id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('logbooks');
    }
};
