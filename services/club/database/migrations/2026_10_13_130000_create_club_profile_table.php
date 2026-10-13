<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('club_profile', function (Blueprint $table) {
            $table->unsignedSmallInteger('id')->primary();
            $table->string('name', 80);
            $table->string('tagline', 160);
            $table->text('description');
            $table->string('city', 80);
            $table->string('address', 200);
            $table->string('landmark', 200);
            $table->string('phone', 32);
            $table->string('email', 120);
            $table->decimal('latitude', 8, 5);
            $table->decimal('longitude', 8, 5);
            $table->jsonb('hours');
            $table->timestampsTz();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('club_profile');
    }
};
