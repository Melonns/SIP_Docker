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
        Schema::create('certificate_templates', function (Blueprint $table) {
            $table->id();
            $table->string('name')->comment('Nama template (e.g., "Sertifikat Internship 2026")');
            $table->enum('side', ['front', 'back'])->comment('Depan (front) atau belakang (back)');
            $table->string('image_path')->comment('Path ke file PNG template');
            $table->unsignedBigInteger('created_by')->nullable()->comment('User yang membuat template');
            $table->unsignedBigInteger('updated_by')->nullable()->comment('User yang mengupdate template');
            $table->timestamps();
            
            $table->foreign('created_by')->references('user_id')->on('users')->onDelete('set null');
            $table->foreign('updated_by')->references('user_id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('certificate_templates');
    }
};
