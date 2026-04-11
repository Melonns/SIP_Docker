<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Guard: index may already exist from an earlier migration (e.g. add_indexes_users_students)
        if (! collect(\DB::select("SHOW INDEX FROM users WHERE Key_name = 'users_email_index'"))->isNotEmpty()) {
            Schema::table('users', function (Blueprint $table) {
                $table->index('email');
            });
        }
    }

    public function down(): void
    {
        if (collect(\DB::select("SHOW INDEX FROM users WHERE Key_name = 'users_email_index'"))->isNotEmpty()) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropIndex(['users_email_index']);
            });
        }
    }
};
