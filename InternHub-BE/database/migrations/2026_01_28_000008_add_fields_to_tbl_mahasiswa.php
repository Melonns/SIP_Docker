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
            $table->string('jenjang_pendidikan')->nullable()->after('jurusan');
            $table->string('nomor_darurat')->nullable()->after('no_telp');
            $table->string('nama_kontak_darurat')->nullable()->after('nomor_darurat');
            $table->string('foto_ktm')->nullable()->after('foto');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('students', function (Blueprint $table) {
            $columns_to_drop = [];
            foreach (['jenjang_pendidikan', 'nomor_darurat', 'nama_kontak_darurat', 'foto_ktm'] as $column) {
                if (Schema::hasColumn('students', $column)) {
                    $columns_to_drop[] = $column;
                }
            }
            if (!empty($columns_to_drop)) {
                $table->dropColumn($columns_to_drop);
            }
        });
    }
};
