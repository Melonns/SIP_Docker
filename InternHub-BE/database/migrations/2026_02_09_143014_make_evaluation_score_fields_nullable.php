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
        Schema::table('evaluations', function (Blueprint $table) {
            // Make old score fields nullable (now using dynamic evaluation_details)
            $table->decimal('integrity_score', 5, 2)->nullable()->change();
            $table->decimal('punctuality_score', 5, 2)->nullable()->change();
            $table->decimal('expertise_score', 5, 2)->nullable()->change();
            $table->decimal('teamwork_score', 5, 2)->nullable()->change();
            $table->decimal('communication_score', 5, 2)->nullable()->change();
            $table->decimal('it_proficiency_score', 5, 2)->nullable()->change();
            $table->decimal('self_development_score', 5, 2)->nullable()->change();
            $table->decimal('final_score_numeric', 5, 2)->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('evaluations', function (Blueprint $table) {
            // Revert back to NOT NULL
            $table->decimal('integrity_score', 5, 2)->nullable(false)->change();
            $table->decimal('punctuality_score', 5, 2)->nullable(false)->change();
            $table->decimal('expertise_score', 5, 2)->nullable(false)->change();
            $table->decimal('teamwork_score', 5, 2)->nullable(false)->change();
            $table->decimal('communication_score', 5, 2)->nullable(false)->change();
            $table->decimal('it_proficiency_score', 5, 2)->nullable(false)->change();
            $table->decimal('self_development_score', 5, 2)->nullable(false)->change();
            $table->decimal('final_score_numeric', 5, 2)->nullable(false)->change();
        });
    }
};
