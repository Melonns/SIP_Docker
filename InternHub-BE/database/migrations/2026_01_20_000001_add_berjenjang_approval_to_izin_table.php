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
        Schema::table('izin', function (Blueprint $table) {
            $table->enum('status_mentor', ['pending', 'approved', 'rejected'])->default('pending')->after('approved_at');
            $table->enum('status_admin', ['pending', 'approved', 'rejected'])->default('pending')->after('status_mentor');
            $table->text('catatan_mentor')->nullable()->after('status_admin');
            $table->text('catatan_admin')->nullable()->after('catatan_mentor');
            $table->unsignedBigInteger('approved_by_mentor')->nullable()->after('catatan_admin');
            $table->unsignedBigInteger('approved_by_admin')->nullable()->after('approved_by_mentor');
            $table->timestamp('approved_at_mentor')->nullable()->after('approved_by_admin');
            $table->timestamp('approved_at_admin')->nullable()->after('approved_at_mentor');

            $table->foreign('approved_by_mentor')->references('user_id')->on('users')->onDelete('set null');
            $table->foreign('approved_by_admin')->references('user_id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('izin', function (Blueprint $table) {
            $table->dropForeign(['approved_by_mentor']);
            $table->dropForeign(['approved_by_admin']);
            $table->dropColumn([
                'status_mentor',
                'status_admin',
                'catatan_mentor',
                'catatan_admin',
                'approved_by_mentor',
                'approved_by_admin',
                'approved_at_mentor',
                'approved_at_admin',
            ]);
        });
    }
};
