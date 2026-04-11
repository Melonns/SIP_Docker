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
        Schema::create('permissions', function (Blueprint $table) {
            $table->id('permission_id');
            $table->string('name'); // attendance_recap, verify_logbooks, intern_mapping, etc.
            $table->string('label')->nullable(); // Label display untuk UI
            $table->string('group')->nullable(); // Grouping untuk UI (attendance, logbooks, user_management)
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::disableForeignKeyConstraints();
        Schema::dropIfExists('permissions');
        Schema::enableForeignKeyConstraints();
    }
};
