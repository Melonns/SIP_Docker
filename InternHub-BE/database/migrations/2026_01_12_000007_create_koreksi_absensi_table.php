<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Tabel untuk pengajuan koreksi absensi (Lupa Absen/Pulang Cepat)
     */
    public function up(): void
    {
        Schema::create('attendance_corrections', function (Blueprint $table) {
            $table->id('id_koreksi');
            $table->unsignedBigInteger('user_id');
            $table->enum('jenis_koreksi', ['lupa_absen_masuk', 'lupa_absen_pulang', 'pulang_cepat']);
            $table->date('tanggal'); // Satu tanggal spesifik
            $table->time('jam_koreksi'); // Jam yang seharusnya
            $table->text('alasan');
            $table->string('lampiran')->nullable(); // Path file lampiran (PDF/JPEG/PNG, max 5MB)
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->text('catatan_approval')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('user_id')->on('users')->onDelete('cascade');
            $table->foreign('approved_by')->references('user_id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attendance_corrections');
    }
};
