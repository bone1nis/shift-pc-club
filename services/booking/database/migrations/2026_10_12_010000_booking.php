<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            throw new RuntimeException('Booking requires PostgreSQL exclusion constraints.');
        }
        DB::statement('CREATE EXTENSION IF NOT EXISTS btree_gist');
        Schema::create('workstations', function (Blueprint $t) {
            $t->unsignedBigInteger('id')->primary();
            $t->unsignedBigInteger('zone_id');
            $t->string('name');
            $t->string('status');
            $t->boolean('maintenance_locked')->default(false);
            $t->integer('version');
            $t->integer('hourly_price');
            $t->timestampTz('synced_at');
        });
        Schema::create('bookings', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('user_id')->index();
            $t->string('status')->default('confirmed');
            $t->timestampTz('starts_at');
            $t->timestampTz('ends_at');
            $t->integer('total_price');
            $t->timestampsTz();
        });
        Schema::create('booking_items', function (Blueprint $t) {
            $t->id();
            $t->foreignId('booking_id')->constrained();
            $t->foreignId('workstation_id')->constrained();
            $t->integer('hourly_price');
            $t->integer('price');
            $t->integer('catalog_version');
        });
        Schema::create('gaming_sessions', function (Blueprint $t) {
            $t->id();
            $t->foreignId('booking_id')->nullable()->constrained();
            $t->unsignedBigInteger('user_id')->nullable()->index();
            $t->foreignId('workstation_id')->constrained();
            $t->string('status')->default('active');
            $t->timestampTz('starts_at');
            $t->timestampTz('ends_at');
            $t->timestampTz('ended_at')->nullable();
            $t->integer('hourly_price');
            $t->integer('total_price');
            $t->integer('version')->default(1);
            $t->timestampsTz();
        });
        Schema::create('allocations', function (Blueprint $t) {
            $t->id();
            $t->foreignId('workstation_id')->constrained();
            $t->foreignId('booking_id')->nullable()->constrained();
            $t->foreignId('session_id')->nullable()->constrained('gaming_sessions');
            $t->timestampTz('starts_at');
            $t->timestampTz('ends_at');
            $t->boolean('active')->default(true);
        });
        DB::statement("ALTER TABLE allocations ADD CONSTRAINT positive_interval CHECK (ends_at > starts_at), ADD CONSTRAINT single_owner CHECK ((booking_id IS NULL) <> (session_id IS NULL)), ADD CONSTRAINT no_workstation_overlap EXCLUDE USING gist (workstation_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (active)");
        DB::statement("CREATE UNIQUE INDEX one_running_session_per_workstation ON gaming_sessions (workstation_id) WHERE status IN ('active','awaiting_checkout')");
        Schema::create('idempotency_keys', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('user_id');
            $t->string('key', 128);
            $t->string('fingerprint', 64);
            $t->foreignId('booking_id')->constrained();
            $t->unique(['user_id', 'key']);
        });
        Schema::create('notifications', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('user_id')->index();
            $t->string('type');
            $t->string('dedupe_key')->unique();
            $t->jsonb('data');
            $t->timestampTz('created_at');
            $t->timestampTz('read_at')->nullable();
        });
        Schema::create('audit_entries', function (Blueprint $t) {
            $t->id();
            $t->unsignedBigInteger('actor_id');
            $t->string('action');
            $t->unsignedBigInteger('entity_id');
            $t->jsonb('changes');
            $t->timestampTz('created_at');
        });
    }

    public function down(): void
    {
        foreach (['audit_entries', 'notifications', 'idempotency_keys', 'allocations', 'gaming_sessions', 'booking_items', 'bookings', 'workstations'] as $t) {
            Schema::dropIfExists($t);
        }
    }
};
