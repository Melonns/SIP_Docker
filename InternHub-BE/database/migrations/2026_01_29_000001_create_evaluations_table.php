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
        Schema::create('evaluations', function (Blueprint $table) {
            $table->id('id_evaluation');
            $table->unsignedBigInteger('user_id'); // Intern being evaluated
            $table->unsignedBigInteger('mentor_id'); // Mentor who evaluated
            
            // Score fields (0-100 range)
            $table->decimal('discipline_score', 5, 2);
            $table->decimal('work_quality_score', 5, 2);
            $table->decimal('initiative_score', 5, 2);
            $table->decimal('teamwork_score', 5, 2);
            $table->decimal('technical_score', 5, 2);
            
            // Additional fields
            $table->string('periode'); // e.g., "Januari 2026"
            $table->enum('status', ['draft', 'final'])->default('draft');
            $table->text('mentor_notes')->nullable();
            $table->date('evaluation_date');
            
            $table->timestamps();
            
            // Foreign keys
            $table->foreign('user_id')->references('user_id')->on('users')->onDelete('cascade');
            $table->foreign('mentor_id')->references('user_id')->on('users')->onDelete('cascade');
            
            // Indexes
            $table->index('user_id');
            $table->index('mentor_id');
            $table->index('status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('evaluations');
    }
};
