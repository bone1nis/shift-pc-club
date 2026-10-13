\set ON_ERROR_STOP on
\if :{?club_timezone}
\else
\set club_timezone Europe/Moscow
\endif
BEGIN;
DO $$ BEGIN
    IF current_database() <> 'shift_booking' THEN
        RAISE EXCEPTION 'Reporting views require shift_booking';
    END IF;
END $$;

CREATE OR REPLACE VIEW public.reporting_bookings_daily AS
WITH visits AS (
    SELECT b.id, (b.starts_at AT TIME ZONE :'club_timezone')::date AS date, b.status,
        CASE WHEN count(DISTINCT w.zone_id) = 1 THEN min(w.zone_id) ELSE 0 END AS zone_id,
        b.total_price,
        CASE WHEN b.status IN ('confirmed', 'checked_in')
            THEN extract(epoch FROM (b.ends_at - b.starts_at)) / 60 * count(i.id)
            ELSE 0 END AS reserved_minutes
    FROM bookings b LEFT JOIN booking_items i ON i.booking_id = b.id
    LEFT JOIN workstations w ON w.id = i.workstation_id
    GROUP BY b.id
)
SELECT date, status, zone_id, count(*) AS booking_count,
    sum(total_price) AS booking_price_total, sum(reserved_minutes) AS reserved_minutes
FROM visits GROUP BY date, status, zone_id;

CREATE OR REPLACE VIEW public.reporting_sessions_daily AS
WITH bounds AS (
    SELECT s.*, w.zone_id, least(coalesce(s.ended_at, now()), now()) AS actual_end
    FROM gaming_sessions s JOIN workstations w ON w.id = s.workstation_id
), events AS (
    SELECT day::date AS date, b.zone_id, b.status,
        CASE WHEN day::date = (b.starts_at AT TIME ZONE :'club_timezone')::date THEN 1 ELSE 0 END AS session_count,
        greatest(0, extract(epoch FROM (
            least(b.actual_end, (day + interval '1 day') AT TIME ZONE :'club_timezone')
            - greatest(b.starts_at, day AT TIME ZONE :'club_timezone'))) / 60) AS session_minutes,
        0::bigint AS earned_price_total, 0::bigint AS paid_price_total
    FROM bounds b CROSS JOIN LATERAL generate_series(
        (b.starts_at AT TIME ZONE :'club_timezone')::date::timestamp,
        (b.actual_end AT TIME ZONE :'club_timezone')::date::timestamp, interval '1 day') AS day
    WHERE b.actual_end > b.starts_at
    UNION ALL
    SELECT (ended_at AT TIME ZONE :'club_timezone')::date, zone_id, status,
        0, 0, total_price, 0 FROM bounds WHERE status = 'completed' AND ended_at IS NOT NULL
    UNION ALL
    SELECT (paid_at AT TIME ZONE :'club_timezone')::date, zone_id, status,
        0, 0, 0, total_price FROM bounds WHERE status = 'completed' AND paid_at IS NOT NULL
)
SELECT date, zone_id, status, sum(session_count) AS session_count,
    sum(session_minutes) AS session_minutes, sum(earned_price_total) AS earned_price_total,
    sum(paid_price_total) AS paid_price_total
FROM events GROUP BY date, zone_id, status;

CREATE OR REPLACE VIEW public.reporting_site_funnel_daily AS
SELECT (created_at AT TIME ZONE :'club_timezone')::date AS date, type, environment,
    count(*) AS events, count(DISTINCT visitor) AS visitors
FROM site_events GROUP BY 1, 2, 3
UNION ALL
SELECT (created_at AT TIME ZONE :'club_timezone')::date, 'booking_completed', 'server',
    count(*), count(DISTINCT user_id)
FROM bookings GROUP BY 1;

ALTER VIEW public.reporting_bookings_daily OWNER TO booking;
ALTER VIEW public.reporting_site_funnel_daily OWNER TO booking;
ALTER VIEW public.reporting_sessions_daily OWNER TO booking;
REVOKE ALL ON public.reporting_bookings_daily, public.reporting_sessions_daily, public.reporting_site_funnel_daily FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO shift_report;
GRANT SELECT ON public.reporting_bookings_daily, public.reporting_sessions_daily, public.reporting_site_funnel_daily TO shift_report;
COMMIT;
