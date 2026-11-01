<?php

namespace Tests\Feature;

use App\Events\Signal;
use App\Mail\ComplaintCreated;
use App\Services\EventHandler;
use Illuminate\Foundation\Testing\DatabaseMigrations;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

class EventHandlerTest extends TestCase
{
    use DatabaseMigrations;

    /** @param array<string,mixed> $payload
     * @return array<string,mixed> */
    private function event(string $type, array $payload): array
    {
        return ['event_id' => (string) Str::uuid(), 'type' => $type, 'schema_version' => 1, 'occurred_at' => now()->toIso8601String(), 'payload' => $payload];
    }

    private function signals(string $name, string $channel): int
    {
        return Event::dispatched(Signal::class, fn (Signal $s) => $s->name === $name && $s->channel === $channel)->count();
    }

    public function test_confirmed_booking_creates_owner_and_signals_owner_and_hall(): void
    {
        Event::fake([Signal::class]);
        $this->assertTrue(app(EventHandler::class)->process($this->event('booking.confirmed', ['booking_id' => 5, 'user_id' => 7])));

        $row = DB::table('booking_participants')->where('booking_id', 5)->first();
        $this->assertSame(7, (int) $row->user_id);
        $this->assertSame('owner', $row->role);
        $this->assertNull($row->closed_at);
        $this->assertSame(1, $this->signals('account.changed', 'user.7'));
        $this->assertSame(1, $this->signals('hall.changed', 'hall'));
        Event::assertDispatched(Signal::class, fn (Signal $s) => $s->broadcastWith() === ['type' => 'booking', 'id' => 5]);
    }

    public function test_duplicate_event_is_not_processed_or_broadcast_twice(): void
    {
        Event::fake([Signal::class]);
        $event = $this->event('booking.confirmed', ['booking_id' => 5, 'user_id' => 7]);
        $this->assertTrue(app(EventHandler::class)->process($event));
        $this->assertFalse(app(EventHandler::class)->process($event));

        $this->assertSame(1, DB::table('inbox')->count());
        $this->assertSame(1, DB::table('booking_participants')->count());
        $this->assertSame(1, $this->signals('account.changed', 'user.7'));
        $this->assertSame(1, $this->signals('hall.changed', 'hall'));
    }

    public function test_cancelled_booking_sets_closed_at(): void
    {
        Event::fake([Signal::class]);
        app(EventHandler::class)->process($this->event('booking.confirmed', ['booking_id' => 5, 'user_id' => 7]));
        app(EventHandler::class)->process($this->event('booking.cancelled', ['booking_id' => 5, 'user_id' => 7]));

        $this->assertNotNull(DB::table('booking_participants')->where('booking_id', 5)->value('closed_at'));
    }

    public function test_no_show_and_finished_session_close_booking_but_unfinished_does_not(): void
    {
        Event::fake([Signal::class]);
        $h = app(EventHandler::class);
        foreach ([1, 2, 3] as $id) {
            $h->process($this->event('booking.confirmed', ['booking_id' => $id, 'user_id' => 7]));
        }
        $h->process($this->event('booking.no_show', ['booking_id' => 1, 'user_id' => 7]));
        $h->process($this->event('session.completed', ['session_id' => 9, 'user_id' => 7, 'booking_id' => 2, 'workstation_id' => 4, 'booking_finished' => true]));
        $h->process($this->event('session.completed', ['session_id' => 10, 'user_id' => 7, 'booking_id' => 3, 'workstation_id' => 4, 'booking_finished' => false]));

        $this->assertNotNull(DB::table('booking_participants')->where('booking_id', 1)->value('closed_at'));
        $this->assertNotNull(DB::table('booking_participants')->where('booking_id', 2)->value('closed_at'));
        $this->assertNull(DB::table('booking_participants')->where('booking_id', 3)->value('closed_at'));
    }

    public function test_foreign_booking_event_does_not_signal_another_user(): void
    {
        Event::fake([Signal::class]);
        app(EventHandler::class)->process($this->event('booking.confirmed', ['booking_id' => 5, 'user_id' => 7]));
        app(EventHandler::class)->process($this->event('booking.cancelled', ['booking_id' => 6, 'user_id' => 8]));

        $this->assertSame(1, $this->signals('account.changed', 'user.7'));
        $this->assertSame(1, $this->signals('account.changed', 'user.8'));
        $this->assertSame(0, $this->signals('account.changed', 'user.9'));
        // Гостевая сессия без игрока не шлёт сигнал в кабинет, только в зал.
        app(EventHandler::class)->process($this->event('session.started', ['session_id' => 1, 'user_id' => null, 'booking_id' => null, 'workstation_id' => 3]));
        Event::assertNotDispatched(Signal::class, fn (Signal $s) => $s->channel === 'user.0');
        $this->assertSame(3, $this->signals('hall.changed', 'hall'));
    }

    public function test_hall_events_from_sessions_maintenance_and_catalog(): void
    {
        Event::fake([Signal::class]);
        $h = app(EventHandler::class);
        $h->process($this->event('session.moved', ['session_id' => 1, 'user_id' => 7, 'workstation_id' => 3, 'from_workstation_id' => 2]));
        $h->process($this->event('booking.maintenance_changed', ['workstation_id' => 3, 'blocked' => true]));
        $h->process($this->event('club.catalog.updated', ['entity' => 'workstations', 'id' => 3, 'version' => 2]));

        $this->assertSame(3, $this->signals('hall.changed', 'hall'));
        $this->assertSame(1, $this->signals('account.changed', 'user.7'));
        Event::assertDispatched(Signal::class, fn (Signal $s) => $s->name === 'hall.changed' && $s->broadcastWith() === ['type' => 'workstation', 'id' => 3]);
    }

    public function test_complaint_created_signals_owner_once_without_text(): void
    {
        Event::fake([Signal::class]);
        Mail::fake();
        Http::fake(['*' => Http::response(['data' => ['emails' => []]])]);
        $event = $this->event('complaint.created', ['type' => 'complaint.created', 'id' => 9]);
        $h = app(EventHandler::class);
        $this->assertTrue($h->process($event));
        $this->assertFalse($h->process($event));

        $this->assertSame(1, $this->signals('complaint.created', 'owner'));
        Event::assertDispatched(Signal::class, fn (Signal $s) => $s->broadcastWith() === ['type' => 'complaint.created', 'id' => 9]);
        $this->assertSame(0, $this->signals('hall.changed', 'hall'));
    }

    public function test_complaint_mails_owners_once_without_text(): void
    {
        Event::fake([Signal::class]);
        Mail::fake();
        Http::fake(['*/api/auth/internal/owners/emails' => Http::response(['data' => ['emails' => ['owner@shift.local']]])]);
        $event = $this->event('complaint.created', ['type' => 'complaint.created', 'id' => 9, 'text' => 'секретный текст']);
        $h = app(EventHandler::class);
        $h->process($event);
        $h->process($event);

        Http::assertSentCount(1);
        Http::assertSent(fn ($r) => $r->header('X-Internal-Token') === [config('shift.internal_token')]);
        Mail::assertSent(ComplaintCreated::class, 1);
        Mail::assertSent(ComplaintCreated::class, function (ComplaintCreated $m): bool {
            $html = $m->render();

            return $m->hasTo('owner@shift.local') && $m->hasSubject('Новая жалоба или отзыв')
                && str_contains($html, '№ 9') && str_contains($html, '/admin/complaints') && ! str_contains($html, 'секретный');
        });
    }

    public function test_identity_outage_does_not_break_complaint_signal(): void
    {
        Event::fake([Signal::class]);
        Mail::fake();
        Http::fake(['*' => Http::response('boom', 500)]);
        $event = $this->event('complaint.created', ['type' => 'complaint.created', 'id' => 4]);
        $h = app(EventHandler::class);
        $this->assertTrue($h->process($event));
        $this->assertFalse($h->process($event));

        Mail::assertNothingSent();
        Http::assertSentCount(1);
        $this->assertSame(1, $this->signals('complaint.created', 'owner'));
    }

    public function test_complaint_without_id_is_ignored(): void
    {
        Event::fake([Signal::class]);
        app(EventHandler::class)->process($this->event('complaint.created', ['type' => 'complaint.created']));
        Event::assertNotDispatched(Signal::class);
    }

    public function test_invalid_envelope_is_rejected(): void
    {
        $this->expectException(\InvalidArgumentException::class);
        app(EventHandler::class)->process(['event_id' => 'x', 'type' => 'booking.confirmed']);
    }
}
