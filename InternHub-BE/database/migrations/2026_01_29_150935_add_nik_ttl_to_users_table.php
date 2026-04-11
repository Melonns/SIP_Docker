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
            $table->string('nik')->nullable()->after('identifier');
            $table->string('tempat_lahir')->nullable()->after('gender');
            $table->date('tanggal_lahir')->nullable()->after('tempat_lahir');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $columns_to_drop = [];
            if (Schema::hasColumn('users', 'nik')) {
                $columns_to_drop[] = 'nik';
            }
            if (Schema::hasColumn('users', 'tempat_lahir')) {
                $columns_to_drop[] = 'tempat_lahir';
            }
            if (Schema::hasColumn('users', 'tanggal_lahir')) {
                $columns_to_drop[] = 'tanggal_lahir';
            }
            if (!empty($columns_to_drop)) {
                $table->dropColumn($columns_to_drop);
            }
        });
    }
};
