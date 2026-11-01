<?php

namespace Tests\Feature;

use Tests\TestCase;

class HealthTest extends TestCase
{
    public function test_health_endpoint_reports_service_alive(): void
    {
        $this->getJson('/api/realtime/health')
            ->assertOk()
            ->assertExactJson(['service' => 'realtime', 'status' => 'ok']);
    }
}
