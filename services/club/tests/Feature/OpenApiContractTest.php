<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Gate;
use Tests\TestCase;

class OpenApiContractTest extends TestCase
{
    public function test_published_specification_describes_public_paths_and_hides_internal_ones(): void
    {
        // Вне локального окружения Scramble прячет спецификацию за этой проверкой доступа.
        Gate::define('viewApiDocs', fn ($user = null) => true);
        $spec = $this->getJson('/api/club/openapi.json')->assertOk()->json();
        self::assertStringStartsWith('3.', $spec['openapi']);
        foreach (['/catalog'] as $path) {
            self::assertArrayHasKey($path, $spec['paths']);
        }
        foreach (array_keys($spec['paths']) as $path) {
            self::assertStringNotContainsString('internal', $path);
        }
        self::assertArrayHasKey('securitySchemes', $spec['components']);
    }
}
