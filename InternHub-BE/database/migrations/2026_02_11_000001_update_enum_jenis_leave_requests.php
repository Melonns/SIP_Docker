<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Deprecated: This migration is no longer needed since the base migration
     * 2026_01_12_000006_create_izin_table.php now correctly creates the table
     * with field 'jenis_izin' and enum values ['sakit', 'izin']
     */
    public function up(): void
    {
        // No-op: The field already has correct enum values from base migration
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op: Nothing to reverse
    }
};
