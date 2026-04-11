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
        Schema::table('logbooks', function (Blueprint $table) {
            $table->dateTime('revision_at')->nullable()->after('verified_at')->comment('Waktu ketika diminta revisi');
            $table->unsignedBigInteger('revision_by')->nullable()->after('revision_at')->comment('User ID yang meminta revisi');
            $table->foreign('revision_by')->references('user_id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('logbooks', function (Blueprint $table) {
            $table->dropForeign(['revision_by']);
            $table->dropColumn(['revision_at', 'revision_by']);
        });
    }
};
