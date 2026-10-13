<?php

namespace App\Console\Commands;

use App\Services\CatalogProjection;
use Illuminate\Console\Command;

class SyncCatalog extends Command
{
    protected $signature = 'club:sync';

    protected $description = 'Refresh local Club projections using its internal snapshot API.';

    public function handle(CatalogProjection $projection): int
    {
        $projection->sync();

        return self::SUCCESS;
    }
}
