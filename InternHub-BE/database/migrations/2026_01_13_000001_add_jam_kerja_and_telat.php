<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Tambah kolom jam kerja di site dan menit telat di absensi
     */
    public function up(): void
    {
        // Tambah jam masuk & pulang di sites
        Schema::table('sites', function (Blueprint $table) {
            $table->time('jam_masuk')->default('08:00:00')->after('radius_meter');
            $table->time('jam_pulang')->default('17:00:00')->after('jam_masuk');
        });

        // Tambah lama telat di attendances
        Schema::table('attendances', function (Blueprint $table) {
            $table->integer('lama_telat')->default(0)->after('foto_absen');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            $table->dropColumn(['jam_masuk', 'jam_pulang']);
        });

        Schema::table('attendances', function (Blueprint $table) {
            $table->dropColumn('lama_telat');
        });
    }
};
