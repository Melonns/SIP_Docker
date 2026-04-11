<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Update users table untuk mendukung fitur baru
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // NIP untuk Admin/Mentor, NIM untuk Intern (disimpan dalam satu kolom identifier)
            $table->string('identifier')->nullable()->after('username'); // NIP atau NIM
            $table->string('nama')->nullable()->after('identifier');
            $table->string('email')->nullable()->after('nama');
            $table->string('no_telp')->nullable()->after('email');
            $table->string('foto')->nullable()->after('no_telp');
            $table->unsignedBigInteger('id_site')->nullable()->after('foto');
            $table->enum('status', ['active', 'inactive'])->default('active')->after('id_site');
            
            // Data khusus intern
            $table->string('universitas')->nullable()->after('status');
            $table->string('jurusan')->nullable()->after('universitas');
            $table->date('mulai_magang')->nullable()->after('jurusan');
            $table->date('akhir_magang')->nullable()->after('mulai_magang');
            $table->string('alamat')->nullable()->after('akhir_magang');

            $table->foreign('id_site')->references('id_site')->on('sites')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['id_site']);
            $table->dropColumn([
                'identifier',
                'nama',
                'email',
                'no_telp',
                'foto',
                'id_site',
                'status',
                'universitas',
                'jurusan',
                'mulai_magang',
                'akhir_magang',
                'alamat'
            ]);
        });
    }
};
