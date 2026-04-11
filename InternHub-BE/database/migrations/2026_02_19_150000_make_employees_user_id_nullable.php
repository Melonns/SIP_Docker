<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // Make employees.user_id nullable so we can store employees without creating users during sync
        // Use raw statement to avoid requiring doctrine/dbal in dev deps
        DB::statement("ALTER TABLE employees MODIFY COLUMN user_id BIGINT UNSIGNED NULL");
    }

    public function down(): void
    {
        // Revert to NOT NULL (will fail if nulls exist) — keep conservative
        DB::statement("ALTER TABLE employees MODIFY COLUMN user_id BIGINT UNSIGNED NOT NULL");
    }
};
