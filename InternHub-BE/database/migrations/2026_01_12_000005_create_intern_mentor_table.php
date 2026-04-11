<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Tabel untuk mapping relasi antara Intern dan Mentor
     */
    public function up(): void
    {
        Schema::create('intern_mentors', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('intern_id'); // user_id dengan role intern
            $table->unsignedBigInteger('mentor_id'); // user_id dengan role mentor
            $table->date('assigned_date');
            $table->date('end_date')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->foreign('intern_id')->references('user_id')->on('users')->onDelete('cascade');
            $table->foreign('mentor_id')->references('user_id')->on('users')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('intern_mentors');
        Schema::enableForeignKeyConstraints();
    }
};
