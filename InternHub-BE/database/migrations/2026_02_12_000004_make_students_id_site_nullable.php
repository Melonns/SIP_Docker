<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        if (Schema::hasColumn('students', 'id_site')) {
            try {
                Schema::table('students', function (Blueprint $table) {
                    $table->unsignedBigInteger('id_site')->nullable()->change();
                });
            } catch (\Exception $e) {
                // Fallback: use raw SQL for MySQL
                \DB::statement('ALTER TABLE students MODIFY COLUMN `id_site` BIGINT UNSIGNED NULL');
            }
        }
    }

    public function down()
    {
        if (Schema::hasColumn('students', 'id_site')) {
            try {
                Schema::table('students', function (Blueprint $table) {
                    $table->unsignedBigInteger('id_site')->change();
                });
            } catch (\Exception $e) {
                \DB::statement('ALTER TABLE students MODIFY COLUMN `id_site` BIGINT UNSIGNED NOT NULL');
            }
        }
    }
};