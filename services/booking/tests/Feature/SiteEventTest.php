<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class SiteEventTest extends TestCase
{
    use DatabaseMigrations;

    private function send(array $body, array $headers = []): TestResponse
    {
        return $this->withHeaders($headers + ['User-Agent' => 'Mozilla/5.0 (Macintosh) Safari/605', 'Origin' => config('shift.origin')])
            ->postJson('/api/booking/events', $body);
    }

    public function test_allowed_events_are_stored_once_per_dedupe_window(): void
    {
        Cache::flush();
        $visitor = (string) Str::uuid();
        $this->send(['type' => 'page_view', 'path' => '/booking', 'visitor' => $visitor])->assertNoContent(204);
        $this->send(['type' => 'page_view', 'path' => '/booking', 'visitor' => $visitor])->assertStatus(202);
        $this->send(['type' => 'booking_started', 'path' => '/booking', 'visitor' => $visitor])->assertNoContent(204);
        self::assertSame(2, DB::table('site_events')->count());
        self::assertSame('testing', DB::table('site_events')->value('environment'));
        $person = (string) DB::table('site_events')->value('person');
        self::assertSame(64, strlen($person));
        self::assertStringNotContainsString('127.0.0.1', $person);
    }

    public function test_unknown_types_paths_and_bad_visitors_are_rejected(): void
    {
        $visitor = (string) Str::uuid();
        $this->send(['type' => 'delete_everything', 'path' => '/', 'visitor' => $visitor])->assertUnprocessable();
        $this->send(['type' => 'page_view', 'path' => '/admin/secret?token=1', 'visitor' => $visitor])->assertUnprocessable();
        $this->send(['type' => 'page_view', 'path' => '/', 'visitor' => 'not-a-uuid'])->assertUnprocessable();
        self::assertSame(0, DB::table('site_events')->count());
    }

    public function test_bots_and_foreign_origins_are_not_counted(): void
    {
        Cache::flush();
        $body = ['type' => 'page_view', 'path' => '/', 'visitor' => (string) Str::uuid()];
        $this->send($body, ['User-Agent' => 'Googlebot/2.1'])->assertStatus(202);
        $this->send($body, ['Origin' => 'https://evil.example'])->assertForbidden();
        self::assertSame(0, DB::table('site_events')->count());
    }
}
