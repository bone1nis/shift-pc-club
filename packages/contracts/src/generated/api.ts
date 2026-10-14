// Файл создан scripts/generate.mjs из OpenAPI. Не редактируйте вручную.

export interface IdentityApi {
  "GET /admin/users": {
    request: undefined
    response: {
      "data": {
        "users": Array<string>
        "page": number
        "per_page": number
        "total": number
      }
    }
  }
  "GET /csrf": {
    request: undefined
    response: {
      "data": {
        "csrf_token": string
      }
    }
  }
  "POST /forgot-password": {
    request: {
      "email": string
    }
    response: {
      "data": {
        "message": "Если аккаунт существует, письмо отправлено."
      }
    }
  }
  "POST /login": {
    request: {
      "email": string
      "password": string
    }
    response: {
      "data": string
    }
  }
  "POST /logout": {
    request: undefined
    response: {
      "data": null
    }
  }
  "POST /logout-all": {
    request: undefined
    response: {
      "data": null
    }
  }
  "GET /me": {
    request: undefined
    response: {
      "data": string
    }
  }
  "PATCH /me": {
    request: {
      "name": string
    }
    response: {
      "data": string
    }
  }
  "POST /refresh": {
    request: undefined
    response: {
      "data": string
    } | string
  }
  "POST /register": {
    request: {
      "name": string
      "email": string
      "password": string
    }
    response: {
      "data": string
    }
  }
  "POST /reset-password": {
    request: {
      "email": string
      "token": string
      "password": string
      "password_confirmation": string
    }
    response: {
      "data": null
    }
  }
  "GET /sessions": {
    request: undefined
    response: {
      "data": Array<{
        "id": string
        "created_at": string
        "expires_at": string
        "current": boolean
      }>
    }
  }
  "DELETE /sessions/{id}": {
    request: undefined
    response: {
      "data": null
    }
  }
}

export interface ClubApi {
  "GET /admin/audit": {
    request: undefined
    response: {
      "data": Array<Record<string, unknown>>
    }
  }
  "PATCH /admin/profile": {
    request: {
      "name": string
      "tagline": string
      "description": string
      "city": string
      "address": string
      "landmark": string
      "phone": string
      "email": string
      "latitude": number
      "longitude": number
      "hours": Array<{
        "label": string
        "value": string
      }>
    }
    response: {
      "data": Record<string, unknown> | null
    }
  }
  "PATCH /admin/tariffs/{id}": {
    request: {
      "name"?: string
      "hourly_price": number
    }
    response: {
      "data": {
        "zones": Array<Record<string, unknown>>
        "workstations": Array<Record<string, unknown>>
        "tariffs": Array<Record<string, unknown>>
      }
    }
  }
  "PATCH /admin/workstations/{id}": {
    request: {
      "name"?: string
      "status"?: "available" | "maintenance"
      "x"?: number
      "y"?: number
      "specs"?: {
        "cpu": string
        "gpu": string
        "ram": string
        "monitor": string
      }
    }
    response: {
      "data": {
        "zones": Array<Record<string, unknown>>
        "workstations": Array<Record<string, unknown>>
        "tariffs": Array<Record<string, unknown>>
      }
    }
  }
  "POST /admin/zones": {
    request: {
      "name": string
      "slug": string
      "description": string
    }
    response: string
  }
  "PATCH /admin/zones/{id}": {
    request: {
      "name": string
      "slug": string
      "description": string
    }
    response: string
  }
  "GET /catalog": {
    request: undefined
    response: {
      "data": {
        "zones": Array<Record<string, unknown>>
        "workstations": Array<Record<string, unknown>>
        "tariffs": Array<Record<string, unknown>>
      }
    }
  }
  "GET /profile": {
    request: undefined
    response: {
      "data": Record<string, unknown> | null
    }
  }
}

export interface BookingApi {
  "GET /admin/audit": {
    request: undefined
    response: {
      "data": Array<Record<string, unknown>>
    }
  }
  "GET /admin/bookings": {
    request: undefined
    response: {
      "data": Array<Record<string, unknown>>
    }
  }
  "POST /admin/bookings": {
    request: {
      "user_id": number
      "workstation_ids": Array<number>
      "starts_at": string
      "ends_at": string
    }
    response: {
      "data": Record<string, unknown>
    }
  }
  "POST /admin/bookings/{id}/cancel": {
    request: undefined
    response: {
      "data": Record<string, unknown>
    }
  }
  "POST /admin/bookings/{id}/check-in": {
    request: undefined
    response: {
      "data": Array<Record<string, unknown>>
    }
  }
  "GET /admin/daily-reports": {
    request: undefined
    response: {
      "data": Array<{
        "date": string
        "club": string
        "zones": string
      }>
    }
  }
  "GET /admin/notifications": {
    request: undefined
    response: {
      "data": Array<Record<string, unknown>>
    }
  }
  "POST /admin/notifications/{id}/retry": {
    request: undefined
    response: {
      "data": {
        "id": number
        "delivery_status": "pending"
      }
    }
  }
  "GET /admin/processing": {
    request: undefined
    response: {
      "data": {
        "outbox_pending": number
        "outbox_oldest_age_seconds": Record<string, unknown>
        "queues": Array<Record<string, unknown>>
        "failed_jobs": number
        "recent_failed_jobs": Array<{
          "id": number
          "queue": string
          "failed_at": string
        }>
        "failed_notifications": number
        "failed_exports": number
      }
    }
  }
  "GET /admin/report-exports": {
    request: undefined
    response: {
      "data": Array<Record<string, unknown>>
    }
  }
  "POST /admin/report-exports": {
    request: {
      "from"?: string | null
      "to"?: string | null
      "zone_id"?: number | null
    }
    response: {
      "data": {
        "id": string
        "status": "pending"
      }
    }
  }
  "GET /admin/report-exports/{id}/download": {
    request: undefined
    response: undefined
  }
  "GET /admin/reports": {
    request: undefined
    response: {
      "data": {
        "from": string
        "to": string
        "timezone": string
        "zone_id": number | null
        "bookings": number
        "confirmed_bookings": number
        "cancelled_bookings": number
        "no_show_bookings": number
        "completed_sessions": number
        "active_sessions": number
        "earned_price": number
        "paid_price": number
        "occupied_hours": number
        "occupancy_percent": number
        "outbox_pending": number
        "site_page_views": number
        "site_booking_started": number
        "site_visits": number
        "site_people_daily_sum": number
      }
    }
  }
  "GET /admin/sessions": {
    request: undefined
    response: {
      "data": Array<Record<string, unknown>>
    }
  }
  "POST /admin/sessions": {
    request: {
      "workstation_id": number
      "minutes": number
    }
    response: {
      "data": Record<string, unknown>
    }
  }
  "POST /admin/sessions/{id}/end": {
    request: undefined
    response: {
      "data": Record<string, unknown>
    }
  }
  "POST /admin/sessions/{id}/extend": {
    request: {
      "minutes": number
    }
    response: {
      "data": Record<string, unknown>
    }
  }
  "POST /admin/sessions/{id}/move": {
    request: {
      "workstation_id": number
    }
    response: {
      "data": Record<string, unknown>
    }
  }
  "POST /admin/sessions/{id}/pay": {
    request: undefined
    response: {
      "data": Record<string, unknown>
    }
  }
  "GET /admin/users/{userId}/history": {
    request: undefined
    response: {
      "data": {
        "bookings": Array<Record<string, unknown>>
        "sessions": Array<Record<string, unknown>>
      }
    }
  }
  "GET /availability": {
    request: undefined
    response: {
      "data": Array<{
        "workstation_id": number
        "available": string
      }>
    }
  }
  "GET /bookings": {
    request: undefined
    response: {
      "data": Array<Record<string, unknown>>
    }
  }
  "POST /bookings": {
    request: {
      "workstation_ids": Array<number>
      "starts_at": string
      "ends_at": string
    }
    response: {
      "data": Record<string, unknown>
    }
  }
  "GET /bookings/{id}": {
    request: undefined
    response: {
      "data": Record<string, unknown>
    }
  }
  "POST /bookings/{id}/cancel": {
    request: undefined
    response: {
      "data": Record<string, unknown>
    }
  }
  "POST /events": {
    request: {
      "type": ""
      "path": ""
      "visitor": string
    }
    response: undefined
  }
  "GET /notifications": {
    request: undefined
    response: {
      "data": Array<Record<string, unknown>>
    }
  }
  "GET /sessions": {
    request: undefined
    response: {
      "data": Array<Record<string, unknown>>
    }
  }
}

