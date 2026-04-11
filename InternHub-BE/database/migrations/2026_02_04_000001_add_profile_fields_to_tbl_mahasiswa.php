<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Tambahkan profile fields ke students untuk student information
     */
    public function up(): void
    {
        Schema::table('students', function (Blueprint $table) {
            // Personal info
            if (!Schema::hasColumn('students', 'tempat_lahir')) {
                $table->string('tempat_lahir')->nullable();
            }
            if (!Schema::hasColumn('students', 'tanggal_lahir')) {
                $table->date('tanggal_lahir')->nullable();
            }
            if (!Schema::hasColumn('students', 'gender')) {
                $table->string('gender')->nullable();
            }
            if (!Schema::hasColumn('students', 'nik')) {
                $table->string('nik')->nullable();
            }
            if (!Schema::hasColumn('students', 'alamat')) {
                $table->text('alamat')->nullable();
            }

            // Emergency contact
            if (!Schema::hasColumn('students', 'nomor_darurat')) {
                $table->string('nomor_darurat')->nullable();
            }
            if (!Schema::hasColumn('students', 'nama_kontak_darurat')) {
                $table->string('nama_kontak_darurat')->nullable();
            }

            // University info
            if (!Schema::hasColumn('students', 'universitas')) {
                $table->string('universitas')->nullable();
            }
            if (!Schema::hasColumn('students', 'jurusan')) {
                $table->string('jurusan')->nullable();
            }
            if (!Schema::hasColumn('students', 'jenjang_pendidikan')) {
                $table->string('jenjang_pendidikan')->nullable();
            }
            if (!Schema::hasColumn('students', 'semester')) {
                $table->integer('semester')->nullable();
            }

            // Internship period
            if (!Schema::hasColumn('students', 'mulai_magang')) {
                $table->date('mulai_magang')->nullable();
            }
            if (!Schema::hasColumn('students', 'akhir_magang')) {
                $table->date('akhir_magang')->nullable();
            }

            // Document
            if (!Schema::hasColumn('students', 'foto_ktm')) {
                $table->string('foto_ktm')->nullable();
            }

            // Bank details
            if (!Schema::hasColumn('students', 'bank_name')) {
                $table->string('bank_name')->nullable();
            }
            if (!Schema::hasColumn('students', 'bank_account_name')) {
                $table->string('bank_account_name')->nullable();
            }
            if (!Schema::hasColumn('students', 'bank_account_number')) {
                $table->string('bank_account_number')->nullable();
            }

            // Work schedule
            if (!Schema::hasColumn('students', 'work_schedule_id')) {
                $table->unsignedBigInteger('work_schedule_id')->nullable();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $columns = [
                'tempat_lahir',
                'tanggal_lahir',
                'gender',
                'nik',
                'alamat',
                'nomor_darurat',
                'nama_kontak_darurat',
                'universitas',
                'jurusan',
                'jenjang_pendidikan',
                'semester',
                'mulai_magang',
                'akhir_magang',
                'foto_ktm',
                'bank_name',
                'bank_account_name',
                'bank_account_number',
                'work_schedule_id'
            ];

            foreach ($columns as $column) {
                if (Schema::hasColumn('students', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
