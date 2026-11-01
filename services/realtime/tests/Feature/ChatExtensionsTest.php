<?php

namespace Tests\Feature;

use App\Events\MessageRead;
use App\Events\MessageSent;
use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Client\Factory;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

class ChatExtensionsTest extends TestCase
{
    use RefreshDatabase;

    private const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

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
        config(['filesystems.disks.attachments.root' => sys_get_temp_dir().'/rt-att-'.uniqid()]);
    }

    protected function tearDown(): void
    {
        Storage::disk('attachments')->deleteDirectory('');
        @unlink($this->keyFile);
        parent::tearDown();
    }

    /**
     * @param  array<string, mixed>  $body
     * @param  array<string, UploadedFile>  $files
     */
    private function api(string $method, string $uri, int $user, string $role = 'player', array $body = [], array $files = []): TestResponse
    {
        $now = time();
        $nonce = str_repeat('a', 64);
        $csrf = $nonce.'.'.hash_hmac('sha256', $nonce, str_repeat('s', 32));
        $cookies = ['XSRF-TOKEN' => $csrf, 'shift_access' => JWT::encode(['iss' => 'shift-identity', 'aud' => 'shift-api', 'sub' => (string) $user, 'sid' => 's1', 'iat' => $now, 'nbf' => $now, 'exp' => $now + 900], $this->privateKey, 'RS256')];
        Http::swap(new Factory);
        Http::fake(['*' => Http::response(['data' => ['id' => $user, 'name' => "User {$user}", 'role' => $role]])]);
        $server = ['HTTP_ORIGIN' => config('shift.origin'), 'HTTP_X_XSRF_TOKEN' => $csrf, 'HTTP_ACCEPT' => 'application/json'];

        return $this->withCredentials()->withUnencryptedCookies($cookies)->call($method, '/api/realtime/'.$uri, $body, $this->prepareCookiesForRequest(), $files, $server);
    }

    private function participant(int $booking, int $user, string $role = 'owner', ?string $closedAt = null): void
    {
        DB::table('booking_participants')->insert(['booking_id' => $booking, 'user_id' => $user, 'role' => $role, 'closed_at' => $closedAt, 'created_at' => now(), 'updated_at' => now()]);
    }

    private function png(string $name = 'photo.png'): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'png');
        file_put_contents($path, base64_decode(self::PNG));

        return new UploadedFile($path, $name, 'image/png', null, true);
    }

    private function raw(string $content, string $name, string $mime = 'image/png'): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'raw');
        file_put_contents($path, $content);

        return new UploadedFile($path, $name, $mime, null, true);
    }

    public function test_moderator_reads_history_but_cannot_write_or_read_position(): void
    {
        $this->participant(10, 1);
        $this->api('POST', 'conversations/10/messages', 1, 'player', ['body' => 'hello'])->assertCreated();

        $this->api('GET', 'conversations/10', 99, 'player')->assertForbidden();
        foreach (['admin', 'owner'] as $role) {
            $show = $this->api('GET', 'conversations/10', 50, $role)->assertOk();
            $this->assertFalse($show->json('data.canWrite'));
            $this->assertSame(0, $show->json('data.unreadCount'));
            $this->assertSame('hello', $this->api('GET', 'conversations/10/messages', 50, $role)->assertOk()->json('data.0.body'));
        }
        $this->api('POST', 'conversations/10/messages', 50, 'admin', ['body' => 'x'])->assertForbidden();
        $this->api('POST', 'conversations/10/attachments', 50, 'admin', [], ['file' => $this->png()])->assertForbidden();
        $this->api('POST', 'conversations/10/read', 50, 'admin', ['upToMessageId' => 1])->assertForbidden();
    }

    public function test_read_position_only_grows_and_unread_count_updates(): void
    {
        Event::fake([MessageRead::class, MessageSent::class]);
        $this->participant(10, 1);
        $this->participant(10, 2, 'member');
        $ids = [];
        foreach (['a', 'b', 'c'] as $text) {
            $ids[] = $this->api('POST', 'conversations/10/messages', 1, 'player', ['body' => $text])->json('data.id');
        }
        $this->assertSame(3, $this->api('GET', 'conversations/10', 2)->json('data.unreadCount'));
        $this->assertSame(0, $this->api('GET', 'conversations/10', 1)->json('data.unreadCount'));

        $r = $this->api('POST', 'conversations/10/read', 2, 'player', ['upToMessageId' => $ids[1]])->assertOk();
        $this->assertSame($ids[1], $r->json('data.lastReadMessageId'));
        $this->assertSame(1, $r->json('data.unreadCount'));
        // Назад не двигается и событие не рассылается.
        $r = $this->api('POST', 'conversations/10/read', 2, 'player', ['upToMessageId' => $ids[0]])->assertOk();
        $this->assertSame($ids[1], $r->json('data.lastReadMessageId'));
        Event::assertDispatchedTimes(MessageRead::class, 1);
        Event::assertDispatched(MessageRead::class, fn (MessageRead $e) => $e->broadcastWith() === ['userId' => 2, 'upToMessageId' => $ids[1]] && $e->broadcastAs() === 'message.read');

        $this->api('POST', 'conversations/10/read', 2, 'player', ['upToMessageId' => 99999])->assertNotFound();
        $this->api('POST', 'conversations/10/read', 2, 'player', [])->assertUnprocessable();
        $this->api('POST', 'conversations/10/read', 3, 'player', ['upToMessageId' => $ids[0]])->assertForbidden();
        $this->assertSame($ids[1], $this->api('GET', 'conversations/10', 2)->json('data.lastReadMessageId'));
    }

    public function test_attachment_upload_message_download_and_access(): void
    {
        Event::fake([MessageSent::class]);
        $this->participant(10, 1);
        $this->participant(11, 5);
        $response = $this->api('POST', 'conversations/10/attachments', 1, 'player', ['body' => ' подпись '], ['file' => $this->png('../../evil name<>.php.png')])->assertCreated();
        $att = $response->json('data.attachment');
        $this->assertSame('подпись', $response->json('data.body'));
        $this->assertSame('image/png', $att['mime']);
        $this->assertStringNotContainsString('/', $att['name']);
        $this->assertStringNotContainsString('<', $att['name']);
        $this->assertStringEndsWith('.png', $att['name']);
        Event::assertDispatched(MessageSent::class, fn (MessageSent $e) => $e->broadcastWith()['attachment']['id'] === $att['id']);
        $this->assertTrue(Storage::disk('attachments')->exists(DB::table('attachments')->value('path')));

        // История отдаёт вложение, скачивание только участникам и модераторам.
        $this->assertSame($att['id'], $this->api('GET', 'conversations/10/messages', 1)->json('data.0.attachment.id'));
        $file = $this->api('GET', 'attachments/'.$att['id'], 1)->assertOk();
        $file->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertStringStartsWith('inline', (string) $file->headers->get('Content-Disposition'));
        $this->assertSame('image/png', $file->headers->get('Content-Type'));
        $this->api('GET', 'attachments/'.$att['id'], 5)->assertForbidden();
        $this->api('GET', 'attachments/'.$att['id'], 70, 'admin')->assertOk();
        $this->api('GET', 'attachments/999', 1)->assertNotFound();
        $this->api('POST', 'conversations/10/attachments', 5, 'player', [], ['file' => $this->png()])->assertForbidden();

        // Удалённое модератором сообщение: файл скрыт от игроков.
        DB::table('messages')->update(['deleted_at' => now()]);
        $this->api('GET', 'attachments/'.$att['id'], 1)->assertNotFound();
        $this->api('GET', 'attachments/'.$att['id'], 70, 'owner')->assertOk();
    }

    public function test_attachment_rejects_bad_type_fake_extension_and_oversize(): void
    {
        $this->participant(10, 1);
        $this->api('POST', 'conversations/10/attachments', 1, 'player', [], ['file' => $this->raw('<?php echo 1;', 'a.png')])->assertUnprocessable();
        $this->api('POST', 'conversations/10/attachments', 1, 'player', [], ['file' => $this->raw('<svg xmlns="http://www.w3.org/2000/svg"/>', 'a.svg', 'image/svg+xml')])->assertUnprocessable();
        $this->api('POST', 'conversations/10/attachments', 1, 'player', [], ['file' => $this->raw('', 'empty.png')])->assertUnprocessable();
        // Корректный заголовок PNG, но не изображение целиком.
        $this->api('POST', 'conversations/10/attachments', 1, 'player', [], ['file' => $this->raw("\x89PNG\r\n\x1a\n".str_repeat('x', 20), 'broken.png')])->assertUnprocessable();
        $big = base64_decode(self::PNG).str_repeat("\0", 10 * 1024 * 1024);
        $this->api('POST', 'conversations/10/attachments', 1, 'player', [], ['file' => $this->raw($big, 'big.png')])->assertUnprocessable();
        $this->api('POST', 'conversations/10/attachments', 1, 'player')->assertUnprocessable();
        $this->assertSame(0, DB::table('attachments')->count());
        $this->assertSame(0, DB::table('messages')->count());
    }

    public function test_attachment_quota_closed_chat_and_mute(): void
    {
        $this->participant(10, 1);
        $this->api('POST', 'conversations/10/attachments', 1, 'player', [], ['file' => $this->png()])->assertCreated();
        $conversation = DB::table('conversations')->value('id');
        // Квота по числу файлов: добираем до лимита вставкой строк.
        for ($i = 1; $i < 20; $i++) {
            DB::table('attachments')->insert(['conversation_id' => $conversation, 'uploader_id' => 1, 'path' => "10/q{$i}.png", 'name' => 'q.png', 'mime' => 'image/png', 'size' => 10, 'created_at' => now()]);
        }
        $this->api('POST', 'conversations/10/attachments', 1, 'player', [], ['file' => $this->png()])->assertStatus(413);

        // Квота по объёму.
        DB::table('attachments')->where('id', '>', 1)->delete();
        DB::table('attachments')->insert(['conversation_id' => $conversation, 'uploader_id' => 1, 'path' => '10/big.png', 'name' => 'q.png', 'mime' => 'image/png', 'size' => 50 * 1024 * 1024, 'created_at' => now()]);
        $this->api('POST', 'conversations/10/attachments', 1, 'player', [], ['file' => $this->png()])->assertStatus(413);

        DB::table('attachments')->delete();
        DB::table('booking_participants')->update(['muted_at' => now()]);
        $this->api('POST', 'conversations/10/attachments', 1, 'player', [], ['file' => $this->png()])->assertForbidden();
        DB::table('booking_participants')->update(['muted_at' => null, 'closed_at' => now()]);
        $this->api('POST', 'conversations/10/attachments', 1, 'player', [], ['file' => $this->png()])->assertStatus(409);
    }

    public function test_prune_removes_attachments_thirty_days_after_close(): void
    {
        $this->participant(10, 1, 'owner', now()->subDays(31)->toDateTimeString());
        $this->participant(11, 1, 'owner', now()->subDays(5)->toDateTimeString());
        $this->participant(12, 1);
        $paths = [];
        foreach ([10, 11, 12] as $booking) {
            $conversation = DB::table('conversations')->insertGetId(['booking_id' => $booking, 'created_at' => now(), 'updated_at' => now()]);
            $path = "{$booking}/f.png";
            Storage::disk('attachments')->put($path, 'x');
            $attachment = DB::table('attachments')->insertGetId(['conversation_id' => $conversation, 'uploader_id' => 1, 'path' => $path, 'name' => 'f.png', 'mime' => 'image/png', 'size' => 1, 'created_at' => now()]);
            DB::table('messages')->insert(['conversation_id' => $conversation, 'sender_id' => 1, 'kind' => 'text', 'body' => $booking === 10 ? 'caption' : null, 'attachment_id' => $attachment, 'created_at' => now()]);
            $paths[$booking] = $path;
        }

        $this->artisan('chat:prune-attachments')->assertSuccessful();

        $this->assertFalse(Storage::disk('attachments')->exists($paths[10]));
        $this->assertTrue(Storage::disk('attachments')->exists($paths[11]));
        $this->assertTrue(Storage::disk('attachments')->exists($paths[12]));
        $this->assertSame(2, DB::table('attachments')->count());
        // Сообщение с подписью остаётся без вложения, пустое помечается удалённым.
        $this->assertNull(DB::table('messages')->where('body', 'caption')->value('attachment_id'));
        $this->assertNull(DB::table('messages')->where('body', 'caption')->value('deleted_at'));
    }
}
