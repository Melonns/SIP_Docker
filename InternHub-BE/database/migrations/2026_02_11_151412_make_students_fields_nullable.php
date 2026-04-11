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
        Schema::table('students', function (Blueprint $table) {
            // Make fields nullable - interns will fill these in later
            $table->string('universitas')->nullable()->change();
            $table->string('jurusan')->nullable()->change();
            $table->string('nim')->nullable()->change();
            $table->text('alamat')->nullable()->change();
            $table->string('no_telp')->nullable()->change();
            $table->date('mulai_magang')->nullable()->change();
            $table->date('akhir_magang')->nullable()->change();
            $table->string('tempat_lahir')->nullable()->change();
            $table->date('tanggal_lahir')->nullable()->change();
            $table->string('nik')->nullable()->change();
            $table->string('job_position')->nullable()->change();
            $table->string('division')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            // Revert to NOT NULL
            $table->string('universitas')->nullable(false)->change();
            $table->string('jurusan')->nullable(false)->change();
            $table->string('nim')->nullable(false)->change();
            $table->text('alamat')->nullable(false)->change();
            $table->string('no_telp')->nullable(false)->change();
            $table->date('mulai_magang')->nullable(false)->change();
            $table->date('akhir_magang')->nullable(false)->change();
            $table->string('tempat_lahir')->nullable(false)->change();
            $table->date('tanggal_lahir')->nullable(false)->change();
            $table->string('nik')->nullable(false)->change();
            $table->string('job_position')->nullable(false)->change();
            $table->string('division')->nullable(false)->change();
        });
    }
};
