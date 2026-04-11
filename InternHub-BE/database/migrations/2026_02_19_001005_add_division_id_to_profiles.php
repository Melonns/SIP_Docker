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
            if (! Schema::hasColumn('employees', 'division_id')) {
                $table->unsignedBigInteger('division_id')->nullable()->after('nip')->index();
                try {
                    $table->foreign('division_id')->references('id_division')->on('divisions')->onDelete('set null');
                } catch (\Exception $e) {
                    // ignore (test DBs / sqlite may fail)
                }
            }
        });

        Schema::table('students', function (Blueprint $table) {
            if (! Schema::hasColumn('students', 'division_id')) {
                $table->unsignedBigInteger('division_id')->nullable()->after('nim')->index();
                try {
                    $table->foreign('division_id')->references('id_division')->on('divisions')->onDelete('set null');
                } catch (\Exception $e) {
                    // ignore
                }
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            if (Schema::hasColumn('employees', 'division_id')) {
                try { $table->dropForeign(['division_id']); } catch (\Exception $e) {}
                $table->dropColumn('division_id');
            }
        });

        Schema::table('students', function (Blueprint $table) {
            if (Schema::hasColumn('students', 'division_id')) {
                try { $table->dropForeign(['division_id']); } catch (\Exception $e) {}
                $table->dropColumn('division_id');
            }
        });
    }
};