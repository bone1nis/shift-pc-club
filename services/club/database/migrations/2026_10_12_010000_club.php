<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('zones', function (Blueprint $t) {
            $t->id();
            $t->string('name');
            $t->string('slug')->unique();
            $t->text('description');
            $t->timestampsTz();
        });
        Schema::create('workstations', function (Blueprint $t) {
            $t->id();
            $t->foreignId('zone_id')->constrained();
            $t->string('name')->unique();
            $t->string('status')->default('available');
            $t->integer('x');
            $t->integer('y');
            $t->jsonb('specs');
            $t->integer('version')->default(1);
            $t->timestampsTz();
        });
        Schema::create('tariffs', function (Blueprint $t) {
            $t->id();
            $t->foreignId('zone_id')->unique()->constrained();
            $t->string('name');
            $t->integer('hourly_price');
            $t->integer('version')->default(1);
            $t->timestampsTz();
        });
        Schema::create('audit_entries', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('actor_id');
            $t->string('action');
            $t->string('entity');
            $t->unsignedBigInteger('entity_id');
            $t->jsonb('changes');
            $t->timestampTz('created_at');
        });
    }

    public function down(): void
    {
        foreach (['audit_entries', 'tariffs', 'workstations', 'zones'] as $table) {
            Schema::dropIfExists($table);
        }
    }
};
