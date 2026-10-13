<?php

namespace Tests\Feature;

use App\Http\Controllers\BookingController;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class AdminBookingTest extends TestCase
{
    use RefreshDatabase;

    private function bookingRequest(): Request
    {
        $this->travelTo(CarbonImmutable::parse('2026-10-12T10:00:00Z'));
        DB::table('workstations')->insert(['id' => 1, 'zone_id' => 1, 'name' => 'PC-1', 'status' => 'available', 'version' => 1, 'hourly_price' => 18000, 'synced_at' => now()]);
        $request = Request::create('/api/booking/admin/bookings', 'POST', ['user_id' => 42, 'workstation_ids' => [1], 'starts_at' => '2026-10-12T11:00:00Z', 'ends_at' => '2026-10-12T12:00:00Z']);
        $request->headers->set('Idempotency-Key', (string) Str::uuid());
        $request->attributes->set('actor', ['id' => 1, 'role' => 'admin']);

        return $request;
    }

    /**
     * @param  array<string, mixed>  $identityResponse
     */
    private function fakeServices(array $identityResponse, int $identityStatus = 200): void
    {
        $snapshot = ['zones' => [], 'workstations' => [['id' => 1, 'zone_id' => 1, 'name' => 'PC-1', 'status' => 'available', 'version' => 1]], 'tariffs' => [['id' => 1, 'zone_id' => 1, 'hourly_price' => 18000, 'version' => 1]]];
        Http::fake([
            config('shift.club_url').'/*' => Http::response(['data' => $snapshot]),
            config('shift.identity_url').'/api/auth/internal/users/42' => Http::response($identityResponse, $identityStatus),
        ]);
    }

    public function test_booking_belongs_to_selected_player_and_repeat_does_not_duplicate_audit(): void
    {
        $request = $this->bookingRequest();
        $this->fakeServices(['data' => ['id' => 42, 'role' => 'player']]);
        $controller = app(BookingController::class);
        $response = $controller->createAdmin($request);
        self::assertSame(201, $response->status());
        self::assertSame(42, $response->getData(true)['data']['user_id']);
        self::assertSame($response->getData(true)['data']['id'], $controller->createAdmin($request)->getData(true)['data']['id']);
        self::assertSame(1, DB::table('audit_entries')->where('action', 'booking.created_by_admin')->where('actor_id', 1)->count());
    }

    public function test_unavailable_player_is_rejected_without_creating_booking(): void
    {
        $request = $this->bookingRequest();
        $this->fakeServices([], 404);
        try {
            app(BookingController::class)->createAdmin($request);
            self::fail('Unavailable player must be rejected.');
        } catch (HttpException $exception) {
            self::assertSame(422, $exception->getStatusCode());
        }
        self::assertSame(0, DB::table('bookings')->count());
    }
}
