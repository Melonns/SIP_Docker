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
            // Drop the float column
            $table->dropColumn('durasi_jam');
            
            // Add integer columns
            $table->integer('jam_mulai')->nullable()->default(0)->comment('Durasi jam (e.g. 1)');
            $table->integer('menit_mulai')->nullable()->default(0)->comment('Durasi menit (e.g. 22)');
            // Naming convention: User logic is "Duration", so "jam" and "menit" is better relative to "durasi".
            // Let's use specific names to avoid confusion with time of day.
            // "durasi_jam" (int) and "durasi_menit" (int).
        });
        
        // Re-add them cleanly with correct names
        Schema::table('logbooks', function (Blueprint $table) {
            $table->dropColumn(['jam_mulai', 'menit_mulai']); // cleanup temp thought
        });

        Schema::table('logbooks', function (Blueprint $table) {
             $table->integer('durasi_jam')->default(0)->after('deskripsi_kegiatan');
             $table->integer('durasi_menit')->default(0)->after('durasi_jam');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('logbooks', function (Blueprint $table) {
            $columns_to_drop = [];
            if (Schema::hasColumn('logbooks', 'durasi_jam')) {
                $columns_to_drop[] = 'durasi_jam';
            }
            if (Schema::hasColumn('logbooks', 'durasi_menit')) {
                $columns_to_drop[] = 'durasi_menit';
            }
            if (!empty($columns_to_drop)) {
                $table->dropColumn($columns_to_drop);
            }
            // Don't re-add float durasi_jam - it was the original but we're not reverting fully
        });
    }
};
