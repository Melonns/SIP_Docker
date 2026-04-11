<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            if (Schema::hasColumn('sites', 'jam_masuk')) {
                $table->dropColumn('jam_masuk');
            }
            if (Schema::hasColumn('sites', 'jam_pulang')) {
                $table->dropColumn('jam_pulang');
            }
        });
    }

    public function down(): void
    {
        Schema::table('sites', function (Blueprint $table) {
            if (!Schema::hasColumn('sites', 'jam_masuk')) {
                $table->time('jam_masuk')->default('08:00:00')->after('radius_meter');
            }
            if (!Schema::hasColumn('sites', 'jam_pulang')) {
                $table->time('jam_pulang')->default('17:00:00')->after('jam_masuk');
            }
        });
    }
};
