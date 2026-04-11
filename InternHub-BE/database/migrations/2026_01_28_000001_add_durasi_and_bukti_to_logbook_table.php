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
        Schema::table('logbooks', function (Blueprint $table) {
            $table->float('durasi_jam')->nullable()->after('waktu_selesai'); // Durasi dalam jam (misal 1.5)
            $table->string('bukti_kegiatan')->nullable()->after('deskripsi_kegiatan'); // Path file upload
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('logbooks', function (Blueprint $table) {
            $table->dropColumn(['durasi_jam', 'bukti_kegiatan']);
        });
    }
};
