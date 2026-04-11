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
        Schema::create('divisions', function (Blueprint $table) {
            $table->id('id_division');
            $table->string('name');
            $table->string('slug')->unique();
            $table->unsignedBigInteger('site_id')->nullable()->index();
            $table->json('keywords')->nullable();
            $table->timestamps();

            // optional FK to sites (nullable)
            try {
                $table->foreign('site_id')->references('id_site')->on('sites')->onDelete('set null');
            } catch (\Exception $e) {
                // some environments may not allow adding FK during tests/seeds
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('divisions');
    }
};