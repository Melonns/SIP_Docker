<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Rename users.nama -> users.nama
     *
     * Note: renameColumn requires the doctrine/dbal package to be installed.
     * If not available, this migration will use raw SQL as a fallback.
     */
    public function up()
    {
        if (Schema::hasColumn('users', 'nama')) {
            // Use schema builder when possible
            try {
                Schema::table('users', function (Blueprint $table) {
                    $table->renameColumn('nama', 'nama');
                });
            } catch (\Exception $e) {
                // Fallback to raw SQL for MySQL
                \DB::statement('ALTER TABLE users CHANGE `nama` `nama` VARCHAR(255) NULL');
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down()
    {
        if (Schema::hasColumn('users', 'nama')) {
            try {
                Schema::table('users', function (Blueprint $table) {
                    $table->renameColumn('nama', 'nama');
                });
            } catch (\Exception $e) {
                \DB::statement('ALTER TABLE users CHANGE `nama` `nama` VARCHAR(255) NULL');
            }
        }
    }
};