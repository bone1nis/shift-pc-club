<?php

namespace Database\Seeders;

use App\Services\CatalogProjection;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        if (! app()->environment('local', 'testing')) {
            throw new \RuntimeException('Demo seed is local only.');
        }app(CatalogProjection::class)->sync();
    }
}
