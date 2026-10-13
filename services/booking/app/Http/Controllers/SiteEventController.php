<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Публичный приём событий сайта (просмотр страницы, начало бронирования).
 * Принимает только разрешённые типы и пути, отбрасывает ботов, дубликаты в окне
 * дедупликации и чужие Origin. Успешные брони считаются по серверным данным, а не отсюда.
 */
class SiteEventController extends Controller
{
    public const TYPES = ['page_view', 'booking_started'];

    public const PATHS = ['/', '/booking', '/auth', '/account'];

    private const BOT = '/bot|crawl|spider|slurp|headless|lighthouse|curl|wget|python|node-fetch|playwright|monitor/i';

    public function store(Request $request): Response
    {
        $origin = $request->headers->get('Origin');
        abort_if($origin !== null && $origin !== config('shift.origin'), 403, 'Origin mismatch.');
        $values = $request->validate([
            'type' => 'required|string|in:'.implode(',', self::TYPES),
            'path' => 'required|string|in:'.implode(',', self::PATHS),
            'visitor' => ['required', 'string', 'uuid'],
        ]);
        if (preg_match(self::BOT, (string) $request->userAgent()) === 1 && ! config('shift.analytics.count_bots')) {
            return response()->noContent(202);
        }
        $window = (int) config('shift.analytics.dedupe_minutes');
        $key = 'site-event:'.hash('sha256', $values['visitor'].'|'.$values['type'].'|'.$values['path']);
        if (! Cache::add($key, 1, now()->addMinutes($window))) {
            return response()->noContent(202);
        }
        // Хеш с суточной солью (дата + ключ приложения): сам IP и User-Agent не сохраняются,
        // а визиты одного человека в разные дни связать нельзя.
        $person = hash('sha256', now()->format('Y-m-d').'|'.config('app.key').'|'.$request->ip().'|'.$request->userAgent());
        DB::table('site_events')->insert($values + ['person' => $person, 'environment' => (string) config('app.env'), 'created_at' => now()]);

        return response()->noContent();
    }
}
