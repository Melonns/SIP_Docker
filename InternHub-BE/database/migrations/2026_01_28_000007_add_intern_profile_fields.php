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
            // Jenjang Pendidikan (e.g., SMK, D3, S1)
            $table->string('jenjang_pendidikan')->nullable()->after('jurusan');
            
            // Emergency Contact
            $table->string('nomor_darurat')->nullable()->after('no_telp');
            $table->string('nama_kontak_darurat')->nullable()->after('nomor_darurat');
            
            // Kartu Tanda Mahasiswa (Path file)
            $table->string('foto_ktm')->nullable()->after('foto');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'jenjang_pendidikan',
                'nomor_darurat',
                'nama_kontak_darurat',
                'foto_ktm'
            ]);
        });
    }
};
