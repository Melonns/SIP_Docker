<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('users', function (Blueprint $table) {
            // New canonical bank fields (English)
            $table->string('bank_name')->nullable()->after('universitas');
            $table->string('bank_account_name')->nullable()->after('bank_name');
            $table->string('bank_account_number')->nullable()->after('bank_account_name');

            // Backwards-compatible Indonesian fields (if references exist in code)
            if (!Schema::hasColumn('users', 'nama_bank')) {
                $table->string('nama_bank')->nullable()->after('bank_account_number');
            }
            if (!Schema::hasColumn('users', 'no_rekening')) {
                $table->string('no_rekening')->nullable()->after('nama_bank');
            }
            if (!Schema::hasColumn('users', 'nama_pemegang_rekening')) {
                $table->string('nama_pemegang_rekening')->nullable()->after('no_rekening');
            }
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'bank_account_number')) {
                $table->dropColumn(['bank_name', 'bank_account_name', 'bank_account_number']);
            }

            if (Schema::hasColumn('users', 'nama_bank')) {
                $table->dropColumn(['nama_bank']);
            }
            if (Schema::hasColumn('users', 'no_rekening')) {
                $table->dropColumn(['no_rekening']);
            }
            if (Schema::hasColumn('users', 'nama_pemegang_rekening')) {
                $table->dropColumn(['nama_pemegang_rekening']);
            }
        });
    }
};
