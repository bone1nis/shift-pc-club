<?php

namespace App\Http\Controllers;

use App\Events\MessageRead;
use App\Events\MessageSent;
use App\Support\Base64Url;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\HeaderUtils;

class ChatController extends Controller
{
    /** Допустимые типы вложений (определяются по содержимому) и расширения для хранения. */
    private const IMAGE_TYPES = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp', 'image/gif' => 'gif'];

    private const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

    /** Квота на бронь: число файлов и суммарный размер. */
    private const MAX_ATTACHMENTS_PER_BOOKING = 20;

    private const MAX_ATTACHMENT_BYTES_PER_BOOKING = 50 * 1024 * 1024;

    /** @return array{id:int,role:string} */
    private function actor(Request $request): array
    {
        /** @var array{id:int|string,role:string} $actor */
        $actor = $request->attributes->get('actor');

        return ['id' => (int) $actor['id'], 'role' => (string) $actor['role']];
    }

    private function isModerator(Request $request): bool
    {
        return in_array($this->actor($request)['role'], ['admin', 'owner'], true);
    }

    /** @return object{user_id:int,role:string,muted_at:?string,closed_at:?string,last_read_message_id:?int}|null */
    private function participant(int $bookingId, int $userId): ?object
    {
        /** @var object{user_id:int,role:string,muted_at:?string,closed_at:?string,last_read_message_id:?int}|null $row */
        $row = DB::table('booking_participants')->where('booking_id', $bookingId)->where('user_id', $userId)->first();

        return $row;
    }

    /**
     * Участник обязателен; иначе 403.
     *
     * @return object{user_id:int,role:string,muted_at:?string,closed_at:?string,last_read_message_id:?int}
     */
    private function member(Request $request, int $bookingId): object
    {
        $row = $this->participant($bookingId, $this->actor($request)['id']);
        abort_if($row === null, 403, 'Not a participant.');

        return $row;
    }

    /** @return object{id:int,closed_at:?string} */
    private function conversation(int $bookingId): object
    {
        DB::table('conversations')->insertOrIgnore(['booking_id' => $bookingId, 'created_at' => now(), 'updated_at' => now()]);

        /** @var object{id:int,closed_at:?string} $row */
        $row = DB::table('conversations')->where('booking_id', $bookingId)->firstOrFail();

        return $row;
    }

    /** @param object{id:int,closed_at:?string} $conversation */
    private function isClosed(int $bookingId, object $conversation): bool
    {
        return $conversation->closed_at !== null
            || DB::table('booking_participants')->where('booking_id', $bookingId)->whereNotNull('closed_at')->exists();
    }

    /**
     * Участник либо модератор (admin/owner): модератор читает историю любой брони, но не пишет.
     *
     * @return object{user_id:int,role:string,muted_at:?string,closed_at:?string,last_read_message_id:?int}|null
     */
    private function assertCanRead(Request $request, int $bookingId): ?object
    {
        $row = $this->participant($bookingId, $this->actor($request)['id']);
        abort_if($row === null && ! $this->isModerator($request), 403, 'Not a participant.');

        return $row;
    }

    /**
     * @param  array<int,object>  $attachments  вложения по id
     * @param  bool  $redactSecrets  модератору секрет отдаётся без шифртекста и конвертов
     * @return array<string,mixed>
     */
    private function present(object $message, array $attachments = [], bool $redactSecrets = false): array
    {
        /** @var object{id:int,conversation_id:int,sender_id:int,kind:string,body:?string,created_at:string,attachment_id:?int,ciphertext:?string,nonce:?string,envelopes:mixed} $message */
        $base = ['id' => (int) $message->id, 'conversationId' => (int) $message->conversation_id, 'senderId' => (int) $message->sender_id, 'kind' => $message->kind, 'body' => $message->kind === 'secret' ? null : $message->body, 'createdAt' => CarbonImmutable::parse($message->created_at)->toIso8601String()];
        if ($message->kind === 'secret') {
            if ($redactSecrets) {
                return $base + ['redacted' => true];
            }

            /** @var list<array{deviceId:int,ephemeralPublicKey:string,nonce:string,wrappedKey:string}> $stored */
            $stored = is_string($message->envelopes) ? json_decode($message->envelopes, true) : [];
            // jsonb не хранит порядок ключей: отдаём в каноническом.
            $envelopes = array_map(fn (array $e) => ['deviceId' => (int) $e['deviceId'], 'ephemeralPublicKey' => $e['ephemeralPublicKey'], 'nonce' => $e['nonce'], 'wrappedKey' => $e['wrappedKey']], $stored);

            return $base + ['ciphertext' => $message->ciphertext, 'nonce' => $message->nonce, 'envelopes' => $envelopes];
        }
        $attachment = isset($message->attachment_id, $attachments[(int) $message->attachment_id]) ? $this->presentAttachment($attachments[(int) $message->attachment_id]) : null;

        return $base + ['attachment' => $attachment];
    }

    /** @return array{id:int,name:string,mime:string,size:int,url:string} */
    private function presentAttachment(object $a): array
    {
        /** @var object{id:int,name:string,mime:string,size:int} $a */
        return ['id' => (int) $a->id, 'name' => $a->name, 'mime' => $a->mime, 'size' => (int) $a->size, 'url' => '/api/realtime/attachments/'.$a->id];
    }

    /**
     * @param  iterable<object>  $messages
     * @return array<int,object>
     */
    private function attachmentsFor(iterable $messages): array
    {
        $ids = [];
        foreach ($messages as $m) {
            /** @var object{attachment_id:?int} $m */
            if ($m->attachment_id !== null) {
                $ids[] = (int) $m->attachment_id;
            }
        }

        return $ids === [] ? [] : DB::table('attachments')->whereIn('id', $ids)->get()->keyBy('id')->all();
    }

    /** @param object{user_id:int,last_read_message_id:?int}|null $me */
    private function unread(int $conversationId, ?object $me): int
    {
        if ($me === null) {
            return 0;
        }

        return DB::table('messages')->where('conversation_id', $conversationId)->whereNull('deleted_at')->where('sender_id', '!=', $me->user_id)->where('id', '>', (int) ($me->last_read_message_id ?? 0))->count();
    }

    public function conversationShow(Request $request, int $bookingId): JsonResponse
    {
        $me = $this->assertCanRead($request, $bookingId);
        $conversation = $this->conversation($bookingId);
        $participants = DB::table('booking_participants')->where('booking_id', $bookingId)->orderBy('id')->get(['user_id', 'role', 'muted_at']);

        return response()->json(['data' => [
            'id' => (int) $conversation->id,
            'bookingId' => $bookingId,
            'closed' => $this->isClosed($bookingId, $conversation),
            'muted' => $me !== null && $me->muted_at !== null,
            'unreadCount' => $this->unread((int) $conversation->id, $me),
            'lastReadMessageId' => $me !== null && $me->last_read_message_id !== null ? (int) $me->last_read_message_id : null,
            'canWrite' => $me !== null,
            'moderated' => true,
            'participants' => $participants->map(fn ($p) => ['userId' => (int) $p->user_id, 'role' => $p->role, 'muted' => $p->muted_at !== null])->all(),
        ]]);
    }

    public function messages(Request $request, int $bookingId): JsonResponse
    {
        $me = $this->assertCanRead($request, $bookingId);
        $params = $request->validate(['after_id' => ['nullable', 'integer', 'min:0'], 'before_id' => ['nullable', 'integer', 'min:1'], 'limit' => ['nullable', 'integer', 'min:1', 'max:100']]);
        $limit = (int) ($params['limit'] ?? 50);
        $conversation = $this->conversation($bookingId);
        $query = DB::table('messages')->where('conversation_id', $conversation->id)->whereNull('deleted_at');

        if (isset($params['after_id'])) {
            $rows = $query->where('id', '>', $params['after_id'])->orderBy('id')->limit($limit + 1)->get();
            $more = $rows->count() > $limit;
            $rows = $rows->take($limit);
        } else {
            if (isset($params['before_id'])) {
                $query->where('id', '<', $params['before_id']);
            }
            $rows = $query->orderByDesc('id')->limit($limit + 1)->get();
            $more = $rows->count() > $limit;
            $rows = $rows->take($limit)->reverse()->values();
        }

        $attachments = $this->attachmentsFor($rows);

        return response()->json(['data' => $rows->map(fn ($m) => $this->present($m, $attachments, $me === null && $this->isModerator($request)))->all(), 'meta' => ['has_more' => $more]]);
    }

    public function send(Request $request, int $bookingId): JsonResponse
    {
        $me = $this->member($request, $bookingId);
        $kind = $request->input('kind', 'text');
        abort_unless(in_array($kind, ['text', 'secret'], true), 422, 'Unknown message kind.');
        $secret = null;
        $body = null;
        if ($kind === 'secret') {
            $secret = $this->validateSecret($request, $bookingId);
        } else {
            $data = $request->validate(['body' => ['required', 'string', 'max:2000']]);
            $body = trim($data['body']);
            abort_if($body === '', 422, 'Message is empty.');
        }
        abort_if($me->muted_at !== null, 403, 'You are muted.');
        $conversation = $this->conversation($bookingId);
        abort_if($this->isClosed($bookingId, $conversation), 409, 'Chat is closed.');

        $message = DB::transaction(function () use ($conversation, $me, $body, $secret) {
            $row = ['conversation_id' => $conversation->id, 'sender_id' => $me->user_id, 'kind' => $secret === null ? 'text' : 'secret', 'body' => $body, 'created_at' => now()];
            if ($secret !== null) {
                $row += ['ciphertext' => $secret['ciphertext'], 'nonce' => $secret['nonce'], 'envelopes' => json_encode($secret['envelopes'], JSON_THROW_ON_ERROR)];
            }
            $id = DB::table('messages')->insertGetId($row);

            return DB::table('messages')->where('id', $id)->first();
        });
        abort_if($message === null, 500);
        $payload = $this->present($message);
        MessageSent::dispatch($bookingId, $payload['id'], $payload['conversationId'], $payload['senderId'], $body, $payload['createdAt'], null, $secret === null ? null : ['ciphertext' => $payload['ciphertext'], 'nonce' => $payload['nonce'], 'envelopes' => $payload['envelopes']]);

        return response()->json(['data' => $payload], 201);
    }

    /**
     * Формат и размеры секрета; набор конвертов должен в точности совпадать с активными устройствами всех участников брони.
     * Строго: и пропуск, и лишнее/чужое/повторное устройство дают 422 (клиент перезапросит GET .../keys).
     *
     * @return array{ciphertext:string,nonce:string,envelopes:list<array{deviceId:int,ephemeralPublicKey:string,nonce:string,wrappedKey:string}>}
     */
    private function validateSecret(Request $request, int $bookingId): array
    {
        $data = $request->validate([
            'kind' => ['required', 'in:secret'],
            'body' => ['prohibited'],
            'ciphertext' => ['required', 'string', 'max:11000'],
            'nonce' => ['required', 'string', 'max:32'],
            'envelopes' => ['required', 'array', 'min:1', 'max:200'],
            'envelopes.*' => ['array:deviceId,ephemeralPublicKey,nonce,wrappedKey'],
            'envelopes.*.deviceId' => ['required', 'integer', 'min:1'],
            'envelopes.*.ephemeralPublicKey' => ['required', 'string', 'max:128'],
            'envelopes.*.nonce' => ['required', 'string', 'max:32'],
            'envelopes.*.wrappedKey' => ['required', 'string', 'max:128'],
        ]);
        $cipher = Base64Url::decode($data['ciphertext']);
        // Минимум 16 байт: тег AES-GCM. Максимум 8 КБ шифртекста.
        abort_if($cipher === null || strlen($cipher) < 16 || strlen($cipher) > 8192, 422, 'ciphertext must be base64url, 16 bytes to 8 KB.');
        abort_unless(Base64Url::isLength($data['nonce'], 12), 422, 'nonce must be 12 bytes of base64url.');
        $envelopes = [];
        foreach ($data['envelopes'] as $e) {
            abort_unless(Base64Url::isLength($e['ephemeralPublicKey'], 65) && Base64Url::isLength($e['nonce'], 12) && Base64Url::isLength($e['wrappedKey'], 48), 422, 'Malformed envelope.');
            $envelopes[] = ['deviceId' => (int) $e['deviceId'], 'ephemeralPublicKey' => $e['ephemeralPublicKey'], 'nonce' => $e['nonce'], 'wrappedKey' => $e['wrappedKey']];
        }

        $given = array_column($envelopes, 'deviceId');
        $active = DB::table('device_keys')->whereIn('user_id', DB::table('booking_participants')->where('booking_id', $bookingId)->select('user_id'))->whereNull('revoked_at')->pluck('id')->map(fn ($v) => (int) $v)->all();
        $missing = array_values(array_diff($active, $given));
        $unexpected = array_values(array_unique(array_merge(array_diff($given, $active), array_keys(array_filter(array_count_values($given), fn ($n) => $n > 1)))));
        if ($missing !== [] || $unexpected !== []) {
            abort(response()->json(['message' => 'Envelope set does not match the active devices of the participants.', 'code' => 'envelopes_mismatch', 'missingDeviceIds' => $missing, 'unexpectedDeviceIds' => $unexpected], 422));
        }

        return ['ciphertext' => $data['ciphertext'], 'nonce' => $data['nonce'], 'envelopes' => $envelopes];
    }

    public function read(Request $request, int $bookingId): JsonResponse
    {
        $me = $this->member($request, $bookingId);
        $data = $request->validate(['upToMessageId' => ['required', 'integer', 'min:1']]);
        $conversation = $this->conversation($bookingId);
        $upTo = (int) $data['upToMessageId'];
        abort_unless(DB::table('messages')->where('id', $upTo)->where('conversation_id', $conversation->id)->exists(), 404, 'Message not found.');

        // Позиция только растёт: условный UPDATE безопасен при гонке двух запросов.
        $advanced = DB::table('booking_participants')->where('booking_id', $bookingId)->where('user_id', $me->user_id)
            ->where(fn ($q) => $q->whereNull('last_read_message_id')->orWhere('last_read_message_id', '<', $upTo))
            ->update(['last_read_message_id' => $upTo, 'updated_at' => now()]);
        if ($advanced > 0) {
            MessageRead::dispatch($bookingId, (int) $me->user_id, $upTo);
        }
        $position = (int) DB::table('booking_participants')->where('booking_id', $bookingId)->where('user_id', $me->user_id)->value('last_read_message_id');

        return response()->json(['data' => ['lastReadMessageId' => $position, 'unreadCount' => $this->unread((int) $conversation->id, $this->participant($bookingId, (int) $me->user_id))]]);
    }

    public function attach(Request $request, int $bookingId): JsonResponse
    {
        $me = $this->member($request, $bookingId);
        $data = $request->validate(['file' => ['required', 'file'], 'body' => ['nullable', 'string', 'max:2000']]);
        abort_if($me->muted_at !== null, 403, 'You are muted.');
        $conversation = $this->conversation($bookingId);
        abort_if($this->isClosed($bookingId, $conversation), 409, 'Chat is closed.');

        /** @var UploadedFile $file */
        $file = $request->file('file');
        abort_unless($file->isValid(), 422, 'Upload failed.');
        $size = (int) $file->getSize();
        abort_if($size < 1 || $size > self::MAX_ATTACHMENT_BYTES, 422, 'File size must be up to 10 MB.');
        // Тип определяем по содержимому, а не по имени и заявленному Content-Type.
        $mime = (new \finfo(FILEINFO_MIME_TYPE))->file($file->getRealPath());
        abort_unless(is_string($mime) && isset(self::IMAGE_TYPES[$mime]), 422, 'Only PNG, JPEG, WebP and GIF images are allowed.');
        abort_if(@getimagesize($file->getRealPath()) === false, 422, 'The file is not a valid image.');

        $conversationId = (int) $conversation->id;
        $used = DB::table('attachments')->where('conversation_id', $conversationId)->selectRaw('count(*) as c, coalesce(sum(size), 0) as s')->first();
        abort_if($used !== null && ((int) $used->c >= self::MAX_ATTACHMENTS_PER_BOOKING || (int) $used->s + $size > self::MAX_ATTACHMENT_BYTES_PER_BOOKING), 413, 'Attachment quota for this booking is exceeded.');

        $path = $bookingId.'/'.Str::uuid()->toString().'.'.self::IMAGE_TYPES[$mime];
        $stored = Storage::disk('attachments')->putFileAs((string) $bookingId, $file, basename($path));
        abort_if($stored === false, 500, 'Could not store the file.');
        $caption = isset($data['body']) ? trim($data['body']) : '';

        [$message, $attachment] = DB::transaction(function () use ($conversationId, $me, $path, $file, $mime, $size, $caption) {
            $attachmentId = DB::table('attachments')->insertGetId(['conversation_id' => $conversationId, 'uploader_id' => $me->user_id, 'path' => $path, 'name' => $this->cleanName($file->getClientOriginalName(), $mime), 'mime' => $mime, 'size' => $size, 'created_at' => now()]);
            $id = DB::table('messages')->insertGetId(['conversation_id' => $conversationId, 'sender_id' => $me->user_id, 'kind' => 'text', 'body' => $caption === '' ? null : $caption, 'attachment_id' => $attachmentId, 'created_at' => now()]);

            return [DB::table('messages')->where('id', $id)->first(), DB::table('attachments')->where('id', $attachmentId)->first()];
        });
        abort_if($message === null || $attachment === null, 500);
        $payload = $this->present($message, [(int) $attachment->id => $attachment]);
        MessageSent::dispatch($bookingId, $payload['id'], $payload['conversationId'], $payload['senderId'], $payload['body'], $payload['createdAt'], $payload['attachment']);

        return response()->json(['data' => $payload], 201);
    }

    /** Имя файла для показа: без пути и управляющих символов, до 100 знаков, расширение по реальному типу. */
    private function cleanName(string $original, string $mime): string
    {
        $base = pathinfo(str_replace('\\', '/', $original), PATHINFO_FILENAME);
        $base = (string) preg_replace('/[^\p{L}\p{N} ._()-]+/u', '_', $base);
        $base = trim(mb_substr($base, 0, 100), ' ._');

        return ($base === '' ? 'image' : $base).'.'.self::IMAGE_TYPES[$mime];
    }

    public function attachment(Request $request, int $attachmentId): Response|BinaryFileResponse
    {
        $attachment = DB::table('attachments')->where('id', $attachmentId)->first();
        abort_if($attachment === null, 404);
        $conversation = DB::table('conversations')->where('id', $attachment->conversation_id)->first();
        abort_if($conversation === null, 404);
        $bookingId = (int) $conversation->booking_id;
        $member = $this->participant($bookingId, $this->actor($request)['id']);
        abort_if($member === null && ! $this->isModerator($request), 403, 'Not a participant.');
        // Удалённое модератором сообщение: вложение видят только модераторы.
        if (! $this->isModerator($request) && DB::table('messages')->where('attachment_id', $attachmentId)->whereNotNull('deleted_at')->exists()) {
            abort(404);
        }
        $disk = Storage::disk('attachments');
        abort_unless($disk->exists($attachment->path), 404);

        return response()->file($disk->path($attachment->path), [
            'Content-Type' => $attachment->mime,
            'Content-Disposition' => HeaderUtils::makeDisposition(HeaderUtils::DISPOSITION_INLINE, $attachment->name, 'image.'.self::IMAGE_TYPES[$attachment->mime]),
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; sandbox",
            'Cache-Control' => 'private, max-age=3600',
        ]);
    }

    public function destroyMessage(Request $request, int $bookingId, int $messageId): JsonResponse
    {
        abort_unless($this->isModerator($request), 403, 'Moderators only.');
        $conversation = DB::table('conversations')->where('booking_id', $bookingId)->first();
        abort_if($conversation === null, 404);
        $updated = DB::table('messages')->where('id', $messageId)->where('conversation_id', $conversation->id)->whereNull('deleted_at')->update(['deleted_at' => now(), 'ciphertext' => null, 'nonce' => null, 'envelopes' => null]);
        abort_if($updated === 0, 404);

        return response()->json(null, 204);
    }

    public function mute(Request $request, int $bookingId, int $userId): JsonResponse
    {
        abort_unless($this->isModerator($request), 403, 'Moderators only.');
        $muted = $request->boolean('muted', true);
        $updated = DB::table('booking_participants')->where('booking_id', $bookingId)->where('user_id', $userId)->update(['muted_at' => $muted ? now() : null, 'updated_at' => now()]);
        abort_if($updated === 0, 404);

        return response()->json(['data' => ['userId' => $userId, 'muted' => $muted]]);
    }

    public function invite(Request $request, int $bookingId): JsonResponse
    {
        $me = $this->member($request, $bookingId);
        abort_unless($me->role === 'owner', 403, 'Only the booking owner can invite.');
        abort_if($this->isClosed($bookingId, $this->conversation($bookingId)), 409, 'Chat is closed.');
        $this->assertRoomForAnotherParticipant($bookingId);
        $token = Str::random(40);
        $expires = now()->addHours(72);
        DB::table('invitations')->insert(['token' => hash('sha256', $token), 'booking_id' => $bookingId, 'created_by' => $me->user_id, 'expires_at' => $expires, 'created_at' => now(), 'updated_at' => now()]);

        return response()->json(['data' => ['token' => $token, 'url' => rtrim((string) config('shift.origin'), '/').'/invite/'.$token, 'expiresAt' => $expires->toIso8601String()]], 201);
    }

    /** Потолок участников брони: при достижении лимита новых не добавляем (422). */
    private function assertRoomForAnotherParticipant(int $bookingId): void
    {
        $max = (int) config('shift.chat_max_participants');
        $count = DB::table('booking_participants')->where('booking_id', $bookingId)->count();
        abort_if($count >= $max, 422, "В чате уже максимум участников: {$max}.");
    }

    public function accept(Request $request, string $token): JsonResponse
    {
        $userId = $this->actor($request)['id'];

        return DB::transaction(function () use ($token, $userId): JsonResponse {
            $invite = DB::table('invitations')->where('token', hash('sha256', $token))->lockForUpdate()->first();
            abort_if($invite === null, 404, 'Invitation not found.');
            abort_if($invite->used_by !== null || CarbonImmutable::parse($invite->expires_at)->isPast(), 410, 'Invitation is no longer valid.');
            $bookingId = (int) $invite->booking_id;
            abort_if($this->isClosed($bookingId, $this->conversation($bookingId)), 409, 'Chat is closed.');
            abort_if($this->participant($bookingId, $userId) !== null, 409, 'Already a participant.');
            $this->assertRoomForAnotherParticipant($bookingId);
            DB::table('booking_participants')->insert(['booking_id' => $bookingId, 'user_id' => $userId, 'role' => 'member', 'created_at' => now(), 'updated_at' => now()]);
            DB::table('invitations')->where('id', $invite->id)->update(['used_by' => $userId, 'used_at' => now(), 'updated_at' => now()]);

            return response()->json(['data' => ['bookingId' => $bookingId]]);
        });
    }
}
