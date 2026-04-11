<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    // File: ...create_sites_table.php
    public function up(): void
    {
        Schema::create('sites', function (Blueprint $table) {
            $table->id('id_site'); // Primary Key
            $table->string('nama_site', 255);
            $table->string('pimpinan',255);
            $table->string('pembimbing',255);
            $table->string('no_telp',20);
            $table->text('alamat');
            $table->string('website',255);
            $table->string('logo',255);
            $table->double('latitude')->nullable();
            $table->double('longitude')->nullable();
            $table->double('radius_meter')->default(100);
            $table->timestamps();
        });
    }
    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('sites');
    }
};
