<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Add 'draft' status and ensure revision_needed is available
     */
    public function up(): void
    {
        // MySQL: First alter the enum to include all needed values
        DB::statement("ALTER TABLE logbooks MODIFY COLUMN status_verifikasi ENUM('draft', 'pending', 'verified', 'revision_needed') DEFAULT 'draft'");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert back to original enum
        DB::statement("ALTER TABLE logbooks MODIFY COLUMN status_verifikasi ENUM('pending', 'verified', 'revision_needed') DEFAULT 'pending'");
    }
};
