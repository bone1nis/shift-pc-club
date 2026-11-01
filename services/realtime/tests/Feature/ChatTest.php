<?php

namespace Tests\Feature;

use App\Events\MessageSent;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class ChatTest extends TestCase
{
    use RefreshDatabase;

    private string $keyFile = '';

    private string $privateKey = '';

    protected function setUp(): void
    {
        parent::setUp();
        $key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        self::assertNotFalse($key);
        openssl_pkey_export($key, $this->privateKey);
        $this->keyFile = tempnam(sys_get_temp_dir(), 'jwt');
        file_put_contents($this->keyFile, openssl_pkey_get_details($key)['key']);
        config(['shift.jwt_public_key_path' => $this->keyFile, 'shift.csrf_secret' => str_repeat('s', 32)]);
    }

    protected function tearDown(): void
    {
        @unlink($this->keyFile);
        parent::tearDown();
    }

    /** @param array<string, mixed> $body */
    private function api(string $method, string $uri, int $user, string $role = 'player', array $body = []): TestResponse
    {
        $now = time();
        $nonce = str_repeat('a', 64);
        $csrf = $nonce.'.'.hash_hmac('sha256', $nonce, str_repeat('s', 32));
        $cookies = ['XSRF-TOKEN' => $csrf, 'shift_access' => JWT::encode(['iss' => 'shift-identity', 'aud' => 'shift-api', 'sub' => (string) $user, 'sid' => 's1', 'iat' => $now, 'nbf' => $now, 'exp' => $now + 900], $this->privateKey, 'RS256')];
        Http::swap(new Factory);
        Http::fake(['*' => Http::response(['data' => ['id' => $user, 'name' => "User {$user}", 'role' => $role]])]);

        return $this->withCredentials()->withUnencryptedCookies($cookies)->json($method, '/api/realtime/'.$uri, $body, ['Origin' => config('shift.origin'), 'X-XSRF-TOKEN' => $csrf]);
    }

    private function participant(int $booking, int $user, string $role = 'owner', ?string $closedAt = null, ?string $mutedAt = null): void
    {
        DB::table('booking_participants')->insert(['booking_id' => $booking, 'user_id' => $user, 'role' => $role, 'closed_at' => $closedAt, 'muted_at' => $mutedAt, 'created_at' => now(), 'updated_at' => now()]);
    }

    public function test_non_participant_cannot_read_or_write(): void
    {
        $this->participant(10, 1);
        $this->api('GET', 'conversations/10', 2)->assertForbidden();
        $this->api('GET', 'conversations/10/messages', 2)->assertForbidden();
        $this->api('POST', 'conversations/10/messages', 2, 'player', ['body' => 'hi'])->assertForbidden();
    }

    public function test_send_and_broadcast_once(): void
    {
        Event::fake([MessageSent::class]);
        $this->participant(10, 1);
        $response = $this->api('POST', 'conversations/10/messages', 1, 'player', ['body' => ' hello '])->assertCreated();
        $response->assertJsonPath('data.body', 'hello')->assertJsonPath('data.kind', 'text')->assertJsonPath('data.senderId', 1);
        Event::assertDispatchedTimes(MessageSent::class, 1);
        Event::assertDispatched(MessageSent::class, fn (MessageSent $e) => $e->broadcastAs() === 'message.sent'
            && $e->broadcastOn()[0]->name === 'private-booking.10.chat'
            && array_keys($e->broadcastWith()) === ['id', 'conversationId', 'senderId', 'kind', 'body', 'createdAt', 'attachment']);
    }

    public function test_body_validation(): void
    {
        $this->participant(10, 1);
        $this->api('POST', 'conversations/10/messages', 1, 'player', ['body' => str_repeat('a', 2001)])->assertStatus(422);
        $this->api('POST', 'conversations/10/messages', 1, 'player', ['body' => '   '])->assertStatus(422);
    }

    public function test_closed_booking_rejects_writes_but_allows_reads(): void
    {
        Event::fake([MessageSent::class]);
        $this->participant(10, 1, 'owner', now()->subHour()->toDateTimeString());
        $this->api('POST', 'conversations/10/messages', 1, 'player', ['body' => 'x'])->assertStatus(409);
        $this->api('GET', 'conversations/10/messages', 1)->assertOk();
        $this->api('GET', 'conversations/10', 1)->assertOk()->assertJsonPath('data.closed', true);
        Event::assertNotDispatched(MessageSent::class);
    }

    public function test_muted_participant_cannot_write(): void
    {
        $this->participant(10, 1);
        $this->participant(10, 2, 'member', null, now()->toDateTimeString());
        $this->api('POST', 'conversations/10/messages', 2, 'player', ['body' => 'x'])->assertForbidden();
    }

    public function test_deleted_messages_are_hidden_and_pagination_by_id(): void
    {
        Event::fake([MessageSent::class]);
        $this->participant(10, 1);
        $ids = [];
        foreach (range(1, 5) as $i) {
            $ids[] = $this->api('POST', 'conversations/10/messages', 1, 'player', ['body' => "m{$i}"])->json('data.id');
        }
        $this->api('DELETE', "conversations/10/messages/{$ids[2]}", 9, 'admin')->assertNoContent();

        $all = $this->api('GET', 'conversations/10/messages', 1)->assertOk();
        self::assertSame(['m1', 'm2', 'm4', 'm5'], array_column($all->json('data'), 'body'));

        $after = $this->api('GET', "conversations/10/messages?after_id={$ids[1]}&limit=1", 1);
        self::assertSame(['m4'], array_column($after->json('data'), 'body'));
        self::assertTrue($after->json('meta.has_more'));

        $before = $this->api('GET', "conversations/10/messages?before_id={$ids[4]}&limit=2", 1);
        self::assertSame(['m2', 'm4'], array_column($before->json('data'), 'body'));
        self::assertTrue($before->json('meta.has_more'));
    }

    public function test_moderation_only_for_admin_or_owner(): void
    {
        Event::fake([MessageSent::class]);
        $this->participant(10, 1);
        $this->participant(10, 2, 'member');
        $id = $this->api('POST', 'conversations/10/messages', 1, 'player', ['body' => 'x'])->json('data.id');

        $this->api('DELETE', "conversations/10/messages/{$id}", 1, 'player')->assertForbidden();
        $this->api('POST', 'conversations/10/participants/2/mute', 1, 'player')->assertForbidden();

        $this->api('POST', 'conversations/10/participants/2/mute', 8, 'admin')->assertOk()->assertJsonPath('data.muted', true);
        $this->api('POST', 'conversations/10/messages', 2, 'player', ['body' => 'y'])->assertForbidden();
        $this->api('POST', 'conversations/10/participants/2/mute', 7, 'owner', ['muted' => false])->assertOk();
        $this->api('POST', 'conversations/10/messages', 2, 'player', ['body' => 'y'])->assertCreated();
        $this->api('DELETE', "conversations/10/messages/{$id}", 7, 'owner')->assertNoContent();
        $this->api('DELETE', "conversations/10/messages/{$id}", 7, 'owner')->assertNotFound();
    }

    public function test_invitation_flow_is_single_use(): void
    {
        $this->participant(10, 1);
        $this->api('POST', 'bookings/10/invitations', 2)->assertForbidden();
        $token = $this->api('POST', 'bookings/10/invitations', 1)->assertCreated()->json('data.token');

        $this->api('POST', "invitations/{$token}/accept", 2)->assertOk()->assertJsonPath('data.bookingId', 10);
        self::assertSame('member', DB::table('booking_participants')->where('booking_id', 10)->where('user_id', 2)->value('role'));
        $this->api('POST', "invitations/{$token}/accept", 3)->assertStatus(410);
        $this->api('GET', 'conversations/10', 3)->assertForbidden();
        $this->api('POST', 'conversations/10/messages', 2, 'player', ['body' => 'hi'])->assertCreated();
    }

    public function test_invitation_expired_unknown_and_closed(): void
    {
        $this->participant(10, 1);
        $token = $this->api('POST', 'bookings/10/invitations', 1)->json('data.token');
        DB::table('invitations')->update(['expires_at' => now()->subMinute()]);
        $this->api('POST', "invitations/{$token}/accept", 2)->assertStatus(410);
        $this->api('POST', 'invitations/'.str_repeat('z', 40).'/accept', 2)->assertNotFound();

        $this->participant(11, 1, 'owner', now()->subHour()->toDateTimeString());
        $this->api('POST', 'bookings/11/invitations', 1)->assertStatus(409);
        DB::table('invitations')->insert(['token' => hash('sha256', str_repeat('c', 40)), 'booking_id' => 11, 'created_by' => 1, 'expires_at' => now()->addDay(), 'created_at' => now(), 'updated_at' => now()]);
        $this->api('POST', 'invitations/'.str_repeat('c', 40).'/accept', 2)->assertStatus(409);
    }

    public function test_send_rate_limit(): void
    {
        Event::fake([MessageSent::class]);
        config(['shift.chat_send_per_minute' => 2]);
        $this->participant(10, 1);
        $this->api('POST', 'conversations/10/messages', 1, 'player', ['body' => 'a'])->assertCreated();
        $this->api('POST', 'conversations/10/messages', 1, 'player', ['body' => 'b'])->assertCreated();
        $this->api('POST', 'conversations/10/messages', 1, 'player', ['body' => 'c'])->assertStatus(429);
    }

    public function test_participant_cap_blocks_invite_and_accept(): void
    {
        config(['shift.chat_max_participants' => 2]);
        $this->participant(10, 1);
        $first = $this->api('POST', 'bookings/10/invitations', 1)->assertCreated()->json('data.token');
        $second = $this->api('POST', 'bookings/10/invitations', 1)->assertCreated()->json('data.token');

        $this->api('POST', "invitations/{$first}/accept", 2)->assertOk();
        // Теперь участников 2 = лимит: новые приглашения и приём отклоняются.
        $this->api('POST', 'bookings/10/invitations', 1)->assertStatus(422)->assertJsonPath('message', 'В чате уже максимум участников: 2.');
        $this->api('POST', "invitations/{$second}/accept", 3)->assertStatus(422);
        self::assertSame(2, DB::table('booking_participants')->where('booking_id', 10)->count());
    }

    public function test_accept_rate_limit(): void
    {
        config(['shift.chat_accept_per_minute' => 2]);
        $this->participant(10, 1);
        $token = $this->api('POST', 'bookings/10/invitations', 1)->json('data.token');
        $this->api('POST', "invitations/{$token}/accept", 2)->assertOk();
        $this->api('POST', "invitations/{$token}/accept", 3)->assertStatus(410);
        $this->api('POST', "invitations/{$token}/accept", 4)->assertStatus(429);
    }
}
