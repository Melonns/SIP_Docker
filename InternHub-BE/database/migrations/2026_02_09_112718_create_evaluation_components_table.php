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
        Schema::create('evaluation_details', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('id_evaluation');
            $table->unsignedBigInteger('komponen_id');
            $table->string('nama_komponen'); // Snapshot nama komponen saat evaluation dibuat
            $table->decimal('score', 5, 2)->default(0); // Score untuk komponen ini
            $table->timestamps();

            // Foreign keys
            $table->foreign('id_evaluation')->references('id_evaluation')->on('evaluations')->onDelete('cascade');
            $table->foreign('komponen_id')->references('id')->on('evaluation_components')->onDelete('cascade');

            // Unique constraint (1 evaluation tidak boleh punya score 2x untuk 1 komponen)
            $table->unique(['id_evaluation', 'komponen_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('evaluation_details');
    }
};
