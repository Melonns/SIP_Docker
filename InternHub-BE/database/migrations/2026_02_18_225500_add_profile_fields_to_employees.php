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
        Schema::table('employees', function (Blueprint $table) {
            if (! Schema::hasColumn('employees', 'nama')) {
                $table->string('nama')->nullable()->after('nip');
            }
            if (! Schema::hasColumn('employees', 'email')) {
                $table->string('email')->nullable()->after('nama');
            }
            if (! Schema::hasColumn('employees', 'gender')) {
                $table->string('gender', 10)->nullable()->after('email');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            if (Schema::hasColumn('employees', 'gender')) {
                $table->dropColumn('gender');
            }
            if (Schema::hasColumn('employees', 'email')) {
                $table->dropColumn('email');
            }
            if (Schema::hasColumn('employees', 'nama')) {
                $table->dropColumn('nama');
            }
        });
    }
};