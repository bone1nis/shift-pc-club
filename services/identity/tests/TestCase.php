<?php

namespace Tests;

use Illuminate\Support\Facades\DB;

abstract class TestCase extends \Illuminate\Foundation\Testing\TestCase
{
    protected function setUpTraits(): array
    {
        $connection = config('database.connections.pgsql');
        if (! app()->environment('testing') || app()->configurationIsCached()
            || config('database.default') !== 'pgsql' || ! is_array($connection)
            || ($connection['driver'] ?? null) !== 'pgsql'
            || ($connection['database'] ?? null) !== 'shift_identity_test'
            || ($connection['username'] ?? null) !== 'identity_test'
            || ! empty($connection['url']) || isset($connection['read']) || isset($connection['write'])) {
            throw new \RuntimeException('Unsafe test database configuration.');
        }

        $identity = DB::connection('pgsql')->selectOne(
            "SELECT current_database() AS database_name, current_user AS role_name,
                NOT EXISTS (
                    SELECT 1 FROM pg_roles
                    WHERE rolname = current_user AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls)
                ) AND NOT EXISTS (
                    SELECT 1 FROM pg_database
                    WHERE datname LIKE 'shift_%' AND datname <> current_database()
                        AND has_database_privilege(current_user, oid, 'CONNECT')
                ) AS isolated"
        );
        if ($identity === null || $identity->database_name !== 'shift_identity_test'
            || $identity->role_name !== 'identity_test' || $identity->isolated !== true) {
            throw new \RuntimeException('Test role must be restricted to its own test database.');
        }

        config(['database.connections' => ['pgsql' => $connection]]);

        return parent::setUpTraits();
    }
}
