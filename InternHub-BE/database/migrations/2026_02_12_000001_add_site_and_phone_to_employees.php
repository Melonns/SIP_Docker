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
            if (!Schema::hasColumn('employees', 'id_site')) {
                $table->unsignedBigInteger('id_site')->nullable()->after('nip');
                try {
                    $table->foreign('id_site')->references('id_site')->on('sites')->onDelete('set null');
                } catch (\Exception $e) {
                    // FK may already exist in some setups
                }
            }
            if (!Schema::hasColumn('employees', 'no_telp')) {
                $table->string('no_telp')->nullable()->after('id_site');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            if (Schema::hasColumn('employees', 'no_telp')) {
                $table->dropColumn('no_telp');
            }
            if (Schema::hasColumn('employees', 'id_site')) {
                try {
                    $table->dropForeign(['id_site']);
                } catch (\Exception $e) {
                    // ignore
                }
                $table->dropColumn('id_site');
            }
        });
    }
};