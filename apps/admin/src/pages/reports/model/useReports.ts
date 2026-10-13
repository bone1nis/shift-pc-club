import { onMounted, ref, watch } from 'vue'
import { useOperationsStore } from '@fsd/entities/operations'
import { api } from '@fsd/shared/api'

export interface Report {
  from: string
  to: string
  bookings: number
  confirmed_bookings: number
  cancelled_bookings: number
  no_show_bookings: number
  completed_sessions: number
  active_sessions: number
  earned_price: number
  paid_price: number
  occupied_hours: number
  occupancy_percent: number
  outbox_pending: number
  zone_id: number | null
  site_page_views: number
  site_booking_started: number
  site_visits: number
  site_people_daily_sum: number
}
export interface DailyReport {
  date: string
  club: Report
  zones: Record<string, Report>
}
export interface ReportExport {
  id: string
  from: string
  to: string
  status: 'pending' | 'processing' | 'ready' | 'failed' | 'expired'
  error: string | null
}

export function useReports() {
  const ops = useOperationsStore()
  const report = ref<Report | null>(null)
  const exports = ref<ReportExport[]>([])
  const daily = ref<DailyReport[]>([])
  const zone = ref<number>(0)
  const from = ref('')
  const to = ref('')

  async function loadReport() {
    try {
      const params = new URLSearchParams()
      if (from.value) params.set('from', from.value)
      if (to.value) params.set('to', to.value)
      if (zone.value) params.set('zone_id', String(zone.value))
      report.value = await api<Report>('/api/booking/admin/reports?' + params)
      from.value = report.value.from
      to.value = report.value.to
    } catch (cause) {
      ops.fail(cause)
    }
  }
  async function loadExports() {
    try {
      exports.value = await api<ReportExport[]>('/api/booking/admin/report-exports')
    } catch (cause) {
      ops.fail(cause)
    }
  }
  async function loadDaily() {
    try {
      daily.value = await api<DailyReport[]>('/api/booking/admin/daily-reports')
    } catch (cause) {
      ops.fail(cause)
    }
  }
  const reload = () => Promise.all([loadReport(), loadExports(), loadDaily()])
  const exportCsv = () =>
    ops.run(
      () =>
        api('/api/booking/admin/report-exports', {
          method: 'POST',
          body: JSON.stringify({ from: from.value, to: to.value, zone_id: zone.value || null }),
        }),
      'CSV поставлен в очередь. Готовая выгрузка появится в списке ниже.',
    )

  onMounted(reload)
  watch(
    () => ops.tick,
    () => {
      void reload()
    },
  )
  return { report, exports, daily, zone, from, to, loadReport, exportCsv }
}
