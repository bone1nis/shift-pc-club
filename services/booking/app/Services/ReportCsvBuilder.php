<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Собирает CSV отчёта клуба для Excel: русские названия, суммы в рублях, три раздела (сводка, по дням, по зонам).
 * Разделитель — точка с запятой, в начале файла стоит BOM: так русская версия Excel открывает файл сразу и в правильной кодировке.
 */
class ReportCsvBuilder
{
    private const BOM = "\xEF\xBB\xBF";

    public function __construct(private readonly AdminReportService $reports) {}

    /**
     * @param  array{from: string, to: string, zone_id: int|null}  $scope
     */
    public function build(array $scope): string
    {
        $zone = $scope['zone_id'];
        $summary = $this->reports->report($scope['from'], $scope['to'], $zone);
        $stream = fopen('php://temp', 'w+');
        if ($stream === false) {
            throw new \RuntimeException('Unable to create export stream.');
        }
        try {
            $this->summary($stream, $summary);
            $this->days($stream, $summary, $zone);
            if ($zone === null) {
                $this->zones($stream, $summary);
            }
            rewind($stream);
            $csv = stream_get_contents($stream);
        } finally {
            fclose($stream);
        }
        if ($csv === false) {
            throw new \RuntimeException('Unable to read export stream.');
        }

        return self::BOM.$csv;
    }

    /**
     * @param  resource  $stream
     * @param  array<int, scalar|null>  $row
     */
    private function put($stream, array $row): void
    {
        fputcsv($stream, $row, ';', '"', '');
    }

    /** Рубли с десятичной запятой, как ждёт русский Excel. */
    private function rub(int|float $kopecks): string
    {
        return number_format($kopecks / 100, 2, ',', '');
    }

    private function number(int|float $value): string
    {
        return rtrim(rtrim(number_format((float) $value, 2, ',', ''), '0'), ',');
    }

    private function date(string $iso): string
    {
        return CarbonImmutable::createFromFormat('!Y-m-d', $iso)?->format('d.m.Y') ?? $iso;
    }

    /**
     * @param  resource  $stream
     * @param  array<string, mixed>  $report
     */
    private function summary($stream, array $report): void
    {
        $zone = $report['zone_id'] === null ? 'весь клуб' : 'зона №'.$report['zone_id'];
        $this->put($stream, ['Отчёт по клубу SHIFT']);
        $this->put($stream, ['Период', $this->date($report['from']).' — '.$this->date($report['to'])]);
        $this->put($stream, ['Охват', $zone]);
        $this->put($stream, ['Часовой пояс', $report['timezone']]);
        $this->put($stream, ['Сформирован', CarbonImmutable::now((string) $report['timezone'])->format('d.m.Y H:i')]);
        $this->put($stream, []);
        $this->put($stream, ['СВОДКА ЗА ПЕРИОД']);
        $this->put($stream, ['Показатель', 'Значение', 'Единица', 'Пояснение']);
        $paid = (int) $report['paid_price'];
        $earned = (int) $report['earned_price'];
        $rows = [
            ['Брони (по дате начала)', $report['bookings'], 'шт.', 'все брони периода'],
            ['— подтверждены', $report['confirmed_bookings'], 'шт.', 'ждут прихода гостя'],
            ['— отменены', $report['cancelled_bookings'], 'шт.', ''],
            ['— неявки', $report['no_show_bookings'], 'шт.', 'гость не пришёл в течение 15 минут после начала'],
            ['Завершённые игровые сессии', $report['completed_sessions'], 'шт.', 'закончились в периоде'],
            ['Активные сессии сейчас', $report['active_sessions'], 'шт.', 'на момент формирования файла'],
            ['Начислено за завершённые сессии', $this->rub($earned), '₽', 'стоимость сессий'],
            ['Оплачено в периоде', $this->rub($paid), '₽', 'по отметке администратора об оплате'],
            ['Не оплачено', $this->rub(max(0, $earned - $paid)), '₽', 'начислено минус оплачено (оценка)'],
            ['Занятость компьютеров', $this->number((float) $report['occupied_hours']), 'ч', 'суммарные часы игры'],
            ['Загрузка клуба', $this->number((float) $report['occupancy_percent']), '%', 'доля занятого времени от возможного'],
            ['Просмотры страниц сайта', $report['site_page_views'], 'шт.', 'только согласованные события сайта'],
            ['Визиты на сайт (вкладки)', $report['site_visits'], 'шт.', 'уникальные вкладки, не люди'],
            ['Начали бронирование на сайте', $report['site_booking_started'], 'шт.', 'выбрали хотя бы одно место'],
            ['Уникальные посетители по дням', $report['site_people_daily_sum'], 'чел.', 'сумма по дням: один человек в разные дни считается заново'],
        ];
        foreach ($rows as $row) {
            $this->put($stream, $row);
        }
        $this->put($stream, []);
    }

    /**
     * @param  resource  $stream
     * @param  array<string, mixed>  $summary
     */
    private function days($stream, array $summary, ?int $zone): void
    {
        $this->put($stream, ['ПО ДНЯМ']);
        $this->put($stream, ['Дата', 'Брони', 'Подтверждены', 'Отменены', 'Неявки', 'Завершено сессий', 'Начислено, ₽', 'Оплачено, ₽', 'Занято, ч', 'Загрузка, %', 'Просмотры сайта', 'Начали бронирование']);
        $day = CarbonImmutable::createFromFormat('!Y-m-d', $summary['from']);
        $last = CarbonImmutable::createFromFormat('!Y-m-d', $summary['to']);
        while ($day !== null && $last !== null && $day->lte($last)) {
            $iso = $day->format('Y-m-d');
            $one = $this->reports->report($iso, $iso, $zone);
            $this->put($stream, [
                $day->format('d.m.Y'),
                $one['bookings'], $one['confirmed_bookings'], $one['cancelled_bookings'], $one['no_show_bookings'],
                $one['completed_sessions'], $this->rub((int) $one['earned_price']), $this->rub((int) $one['paid_price']),
                $this->number((float) $one['occupied_hours']), $this->number((float) $one['occupancy_percent']),
                $one['site_page_views'], $one['site_booking_started'],
            ]);
            $day = $day->addDay();
        }
        $this->put($stream, []);
    }

    /**
     * @param  resource  $stream
     * @param  array<string, mixed>  $summary
     */
    private function zones($stream, array $summary): void
    {
        $this->put($stream, ['ПО ЗОНАМ ЗА ПЕРИОД']);
        $this->put($stream, ['Зона', 'Компьютеров', 'Брони', 'Отменены', 'Неявки', 'Завершено сессий', 'Начислено, ₽', 'Оплачено, ₽', 'Занято, ч', 'Загрузка, %']);
        foreach (DB::table('workstations')->selectRaw('zone_id, COUNT(*) AS stations')->groupBy('zone_id')->orderBy('zone_id')->get() as $zone) {
            $one = $this->reports->report($summary['from'], $summary['to'], (int) $zone->zone_id);
            $this->put($stream, [
                'Зона №'.$zone->zone_id, $zone->stations, $one['bookings'], $one['cancelled_bookings'], $one['no_show_bookings'],
                $one['completed_sessions'], $this->rub((int) $one['earned_price']), $this->rub((int) $one['paid_price']),
                $this->number((float) $one['occupied_hours']), $this->number((float) $one['occupancy_percent']),
            ]);
        }
    }
}
