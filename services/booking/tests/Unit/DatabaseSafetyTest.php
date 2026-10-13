<?php

namespace Tests\Unit;

use Illuminate\Foundation\Testing\DatabaseMigrations;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class DatabaseSafetyTest extends TestCase
{
    /** @param array<string, mixed> $changes */
    #[DataProvider('unsafeConfigurations')]
    public function test_non_test_database_is_rejected_before_migrations_run(array $changes): void
    {
        $probe = new class('initializeTraits') extends TestCase
        {
            use DatabaseMigrations;

            public bool $migrationsStarted = false;

            public function runDatabaseMigrations(): void
            {
                $this->migrationsStarted = true;
            }

            public function initializeTraits(): void
            {
                $this->setUpTraits();
            }
        };
        $original = config()->all();
        config($changes);
        try {
            $probe->initializeTraits();
            self::fail('Expected the database guard to reject a non-test database.');
        } catch (\RuntimeException $exception) {
            self::assertSame('Unsafe test database configuration.', $exception->getMessage());
            self::assertFalse($probe->migrationsStarted);
        } finally {
            config()->set($original);
        }
    }

    /** @return array<string, array{array<string, mixed>}> */
    public static function unsafeConfigurations(): array
    {
        return [
            'demo database' => [['database.connections.pgsql.database' => 'shift_booking']],
            'arbitrary test suffix' => [['database.connections.pgsql.database' => 'production_test']],
            'demo role' => [['database.connections.pgsql.username' => 'booking']],
            'URL override' => [['database.connections.pgsql.url' => 'pgsql://localhost/shift_booking']],
            'write override' => [['database.connections.pgsql.write' => ['database' => 'shift_booking']]],
            'read override' => [['database.connections.pgsql.read' => ['database' => 'shift_booking']]],
            'wrong default' => [['database.default' => 'sqlite']],
            'wrong driver' => [['database.connections.pgsql.driver' => 'sqlite']],
        ];
    }
}
