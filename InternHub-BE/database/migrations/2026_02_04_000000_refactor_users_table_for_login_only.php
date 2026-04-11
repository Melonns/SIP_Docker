<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Refactor users table untuk hanya login, profile data dipindah ke students/tbl_admin
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Drop foreign key terlebih dahulu sebelum drop column
            try {
                $table->dropForeign(['work_schedule_id']);
            } catch (\Exception $e) {
                // Foreign key mungkin tidak ada
            }

            // Also drop foreign key on id_site if exists (some installs add FK to sites)
            try {
                $table->dropForeign(['id_site']);
            } catch (\Exception $e) {
                // FK mungkin tidak ada atau sudah di-drop
            }
            
            // Drop profile columns dari users table
            $columns_to_drop = [
                'gender',
                'job_position',
                'division',
                'universitas',
                'jurusan',
                'jenjang_pendidikan',
                'mulai_magang',
                'akhir_magang',
                'alamat',
                'nomor_darurat',
                'nama_kontak_darurat',
                'foto_ktm',
                'nik',
                'tempat_lahir',
                'tanggal_lahir',
                'bank_name',
                'bank_account_name',
                'bank_account_number',
                'nama_bank',
                'nama_pemegang_rekening',
                'no_rekening',
                'semester',
                'work_schedule_id',
                // Additional profile fields that should live in mahasiswa/karyawan tables
                'no_telp',
                'foto',
                'id_site',
            ];
            
            // Drop columns yang ada
            foreach ($columns_to_drop as $column) {
                if (Schema::hasColumn('users', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Untuk rollback, kita perlu recover tapi ini sulit
        // Sebaiknya backup data sebelum migration ini
        Schema::table('users', function (Blueprint $table) {
            // Recover columns if needed (tapi data sudah hilang)
            $table->string('gender')->nullable()->after('nama');
            $table->string('job_position')->nullable()->after('status');
            $table->string('division')->nullable()->after('job_position');
            $table->string('universitas')->nullable();
            $table->string('jurusan')->nullable();
            $table->string('jenjang_pendidikan')->nullable();
            $table->date('mulai_magang')->nullable();
            $table->date('akhir_magang')->nullable();
            $table->text('alamat')->nullable();
            $table->string('nomor_darurat')->nullable();
            $table->string('nama_kontak_darurat')->nullable();
            $table->string('foto_ktm')->nullable();
            $table->string('nik')->nullable();
            $table->string('tempat_lahir')->nullable();
            $table->date('tanggal_lahir')->nullable();
            $table->string('bank_name')->nullable();
            $table->string('bank_account_name')->nullable();
            $table->string('bank_account_number')->nullable();
            $table->string('nama_bank')->nullable();
            $table->string('nama_pemegang_rekening')->nullable();
            $table->string('no_rekening')->nullable();
            $table->integer('semester')->nullable();
            $table->unsignedBigInteger('work_schedule_id')->nullable();
            // Re-create previously dropped profile fields if needed
            $table->string('no_telp')->nullable();
            $table->string('foto')->nullable();
            $table->unsignedBigInteger('id_site')->nullable();
        });
    }
};
