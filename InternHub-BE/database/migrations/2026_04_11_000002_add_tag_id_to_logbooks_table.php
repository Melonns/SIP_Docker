<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Tambah kolom tag_id ke tabel logbooks (satu logbook = satu tag)
     */
    public function up(): void
    {
        Schema::table('logbooks', function (Blueprint $table) {
            $table->unsignedBigInteger('tag_id')->nullable()->after('deskripsi_kegiatan');
            $table->foreign('tag_id')->references('id')->on('tags')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('logbooks', function (Blueprint $table) {
            $table->dropForeign(['tag_id']);
            $table->dropColumn('tag_id');
        });
    }
};
