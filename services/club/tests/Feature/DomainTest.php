<?php

namespace Tests\Feature;

use App\Http\Controllers\ClubController;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class DomainTest extends TestCase
{
    use RefreshDatabase;

    public function test_catalog_has_twenty_stations_and_integer_prices(): void
    {
        $this->seed();
        $response = $this->getJson('/api/club/catalog')->assertOk()->assertJsonCount(20, 'data.workstations')->assertJsonCount(2, 'data.zones');
        self::assertIsInt($response->json('data.tariffs.0.hourly_price'));
        self::assertArrayHasKey('gpu', $response->json('data.workstations.0.specs'));
    }

    public function test_repeat_seed_preserves_tariffs_and_maintenance(): void
    {
        $this->seed();
        DB::table('tariffs')->where('id', 1)->update(['hourly_price' => 22000]);
        DB::table('workstations')->where('id', 1)->update(['status' => 'maintenance']);
        $this->seed();
        self::assertSame(22000, DB::table('tariffs')->where('id', 1)->value('hourly_price'));
        self::assertSame('maintenance', DB::table('workstations')->where('id', 1)->value('status'));
    }

    public function test_admin_rejects_unauthenticated_writes(): void
    {
        $this->patchJson('/api/club/admin/tariffs/1', ['hourly_price' => 0])->assertUnauthorized();
    }

    public function test_internal_catalog_is_private(): void
    {
        $this->getJson('/api/club/internal/catalog')->assertForbidden();
        $this->withHeader('X-Internal-Token', config('shift.internal_token'))->getJson('/api/club/internal/catalog')->assertOk();
    }

    public function test_equipment_specs_and_name_are_saved_with_version_and_audit(): void
    {
        $this->seed();
        $station = DB::table('workstations')->first();
        $request = Request::create('/api/club/admin/workstations/'.$station->id, 'PATCH', ['name' => 'Updated PC', 'specs' => ['cpu' => 'Updated CPU', 'gpu' => 'Updated GPU', 'ram' => '32 GB', 'monitor' => '240 Hz'], 'x' => 5, 'y' => 6]);
        $request->attributes->set('actor', ['id' => 1, 'role' => 'admin']);
        app(ClubController::class)->workstation($request, $station->id);
        $updated = DB::table('workstations')->where('id', $station->id)->first();
        self::assertSame('Updated PC', $updated->name);
        self::assertSame('Updated CPU', json_decode($updated->specs, true)['cpu']);
        self::assertSame($station->version + 1, $updated->version);
        self::assertSame(1, DB::table('audit_entries')->where('actor_id', 1)->count());
        self::assertSame(1, DB::table('outbox')->count());
    }

    public function test_duplicate_zone_slug_and_equipment_name_return_validation_errors(): void
    {
        $this->seed();
        $zone = DB::table('zones')->first();
        $request = Request::create('/api/club/admin/zones', 'POST', ['name' => 'Duplicate zone', 'slug' => $zone->slug, 'description' => 'Description']);
        try {
            app(ClubController::class)->zone($request);
            self::fail('Duplicate slug must be rejected.');
        } catch (ValidationException $exception) {
            self::assertArrayHasKey('slug', $exception->errors());
        }
        $stations = DB::table('workstations')->orderBy('id')->limit(2)->get();
        $request = Request::create('/api/club/admin/workstations/'.$stations[1]->id, 'PATCH', ['name' => $stations[0]->name]);
        try {
            app(ClubController::class)->workstation($request, $stations[1]->id);
            self::fail('Duplicate workstation name must be rejected.');
        } catch (ValidationException $exception) {
            self::assertArrayHasKey('name', $exception->errors());
        }
        self::assertSame(2, DB::table('zones')->count());
        self::assertSame($stations[1]->name, DB::table('workstations')->where('id', $stations[1]->id)->value('name'));
    }

    private function maintenanceRequest(int $id, string $status): Request
    {
        $request = Request::create('/api/club/admin/workstations/'.$id, 'PATCH', ['status' => $status]);
        $request->attributes->set('actor', ['id' => 1, 'role' => 'admin']);

        return $request;
    }

    public function test_maintenance_requires_booking_acknowledgement_before_club_changes(): void
    {
        $this->seed();
        Http::fake(['*' => Http::response([], 409)]);
        try {
            app(ClubController::class)->workstation($this->maintenanceRequest(1, 'maintenance'), 1);
            self::fail('Expected 409');
        } catch (HttpException $e) {
            self::assertSame(409, $e->getStatusCode());
        }
        self::assertSame('available', DB::table('workstations')->where('id', 1)->value('status'));
        Http::assertSentCount(1);
    }

    public function test_maintenance_is_rejected_when_booking_is_unavailable(): void
    {
        $this->seed();
        Http::fake(fn () => throw new ConnectionException('down'));
        try {
            app(ClubController::class)->workstation($this->maintenanceRequest(1, 'maintenance'), 1);
            self::fail('Expected 503');
        } catch (HttpException $e) {
            self::assertSame(503, $e->getStatusCode());
        }
        self::assertSame('available', DB::table('workstations')->where('id', 1)->value('status'));
    }

    public function test_maintenance_block_is_released_when_club_cannot_save(): void
    {
        $this->seed();
        Http::fake(['*' => Http::response([], 200)]);
        DB::statement("ALTER TABLE workstations ADD CONSTRAINT fail_maintenance CHECK (status <> 'maintenance')");
        try {
            app(ClubController::class)->workstation($this->maintenanceRequest(1, 'maintenance'), 1);
            self::fail('Expected a database failure');
        } catch (QueryException) {
            // expected
        }
        Http::assertSentCount(2);
        Http::assertSent(fn ($request) => $request['blocked'] === false);
    }

    public function test_public_profile_has_address_hours_and_contacts_and_admin_can_update_it(): void
    {
        $this->seed();
        $profile = $this->getJson('/api/club/profile')->assertOk()->json('data');
        self::assertSame('SHIFT Gaming Club', $profile['name']);
        self::assertNotEmpty($profile['address']);
        self::assertSame('Ежедневно, круглосуточно', $profile['hours'][0]['value']);
        self::assertIsFloat($profile['latitude']);

        $request = Request::create('/api/club/admin/profile', 'PATCH', array_merge(
            collect($profile)->except(['id', 'created_at', 'updated_at'])->all(),
            ['phone' => '+7 (495) 555-01-99', 'hours' => [['label' => 'Залы', 'value' => 'Круглосуточно']]],
        ));
        $request->attributes->set('actor', ['id' => 1, 'role' => 'admin']);
        $updated = app(ClubController::class)->updateProfile($request)->getData(true)['data'];
        self::assertSame('+7 (495) 555-01-99', $updated['phone']);
        self::assertCount(1, $updated['hours']);
        self::assertSame(1, DB::table('audit_entries')->where('entity', 'club_profile')->count());
    }

    public function test_profile_rejects_invalid_contacts_and_repeat_seed_keeps_edits(): void
    {
        $this->seed();
        $profile = collect($this->getJson('/api/club/profile')->json('data'))->except(['id', 'created_at', 'updated_at'])->all();
        $request = Request::create('/api/club/admin/profile', 'PATCH', array_merge($profile, ['phone' => '<script>', 'email' => 'nope']));
        $request->attributes->set('actor', ['id' => 1, 'role' => 'admin']);
        try {
            app(ClubController::class)->updateProfile($request);
            self::fail('Expected validation error');
        } catch (ValidationException $e) {
            self::assertArrayHasKey('phone', $e->errors());
            self::assertArrayHasKey('email', $e->errors());
        }
        DB::table('club_profile')->where('id', 1)->update(['tagline' => 'Своя подпись']);
        $this->seed();
        self::assertSame('Своя подпись', DB::table('club_profile')->where('id', 1)->value('tagline'));
    }
}
