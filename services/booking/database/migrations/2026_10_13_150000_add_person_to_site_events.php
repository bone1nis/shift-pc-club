<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('site_events', function (Blueprint $table) {
            // Хеш «посетитель дня»: соль меняется каждые сутки, поэтому связать визиты разных дней нельзя.
            $table->string('person', 64)->nullable()->index();
        });
    }

    public function down(): void
    {
        Schema::table('site_events', function (Blueprint $table) {
            $table->dropColumn('person');
        });
    }
};
