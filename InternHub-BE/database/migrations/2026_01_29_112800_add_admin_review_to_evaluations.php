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
            // Add admin review fields (admin edits mentor_notes directly, no separate feedback)
            $table->boolean('admin_reviewed')->default(false)->after('status');
            $table->unsignedBigInteger('admin_id')->nullable()->after('admin_reviewed');
            $table->timestamp('admin_reviewed_at')->nullable()->after('admin_id');
            
            // Foreign key for admin
            $table->foreign('admin_id')->references('user_id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('evaluations', function (Blueprint $table) {
            $table->dropForeign(['admin_id']);
            $table->dropColumn(['admin_reviewed', 'admin_id', 'admin_reviewed_at']);
        });
    }
};
