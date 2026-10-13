import { readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const dir = resolve(process.cwd(), 'packages/contracts/events')
type Schema = {
  type?: string | string[]
  const?: unknown
  enum?: unknown[]
  minimum?: number
  pattern?: string
  required?: string[]
  additionalProperties?: boolean
  properties?: Record<string, Schema>
}
const load = (name: string): Schema => JSON.parse(readFileSync(resolve(dir, name), 'utf8'))

// Минимальный валидатор для ключевых слов, которые используют эти схемы.
function validate(value: unknown, schema: Schema, path = '$'): string[] {
  const errors: string[] = []
  if (schema.const !== undefined && value !== schema.const) errors.push(`${path}: must equal const`)
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: not in enum`)
  if (schema.type) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    const actual = value === null ? 'null' : Number.isInteger(value) ? 'integer' : typeof value
    if (!types.includes(actual) && !(types.includes('number') && typeof value === 'number'))
      errors.push(`${path}: expected ${types.join('|')}, got ${actual}`)
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum)
    errors.push(`${path}: below minimum`)
  if (typeof value === 'string' && schema.pattern && !new RegExp(schema.pattern).test(value))
    errors.push(`${path}: pattern mismatch`)
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const object = value as Record<string, unknown>
    for (const key of schema.required ?? [])
      if (!(key in object)) errors.push(`${path}.${key}: required`)
    for (const [key, child] of Object.entries(object)) {
      const rule = schema.properties?.[key]
      if (rule) errors.push(...validate(child, rule, `${path}.${key}`))
      else if (schema.additionalProperties === false) errors.push(`${path}.${key}: not allowed`)
    }
  }
  return errors
}

const samples: Record<string, unknown> = {
  'booking.confirmed': { booking_id: 7, user_id: 3 },
  'booking.cancelled': { booking_id: 7, user_id: 3 },
  'booking.checked_in': { booking_id: 7, user_id: 3 },
  'booking.no_show': { booking_id: 7, user_id: 3 },
  'session.completed': { session_id: 9, user_id: null },
  'club.catalog.updated': { entity: 'workstations', id: 4, version: 2 },
  'booking.reminder': { booking_id: 7, user_id: 3 },
  'session.ending': { session_id: 9, user_id: 3, version: 1 },
}

describe('event contracts', () => {
  it('has a schema for every sample and no unsampled schema', () => {
    const files = readdirSync(dir)
      .filter((f) => f.endsWith('.schema.json') && f !== 'envelope.schema.json')
      .map((f) => f.replace('.schema.json', ''))
      .sort()
    expect(files).toEqual(Object.keys(samples).sort())
  })

  it.each(Object.entries(samples))('%s payload matches its schema', (type, payload) => {
    expect(validate(payload, load(`${type}.schema.json`))).toEqual([])
  })

  it('rejects unknown fields and missing keys', () => {
    const schema = load('booking.confirmed.schema.json')
    expect(validate({ booking_id: 1, user_id: 2, extra: true }, schema)).not.toEqual([])
    expect(validate({ booking_id: 1 }, schema)).not.toEqual([])
    expect(validate({ booking_id: '1', user_id: 2 }, schema)).not.toEqual([])
  })

  it('accepts the envelope produced by the outbox', () => {
    const envelope = {
      event_id: 'b2f4f1a0-8e5a-4a41-9d65-0f6f9f0f3c11',
      type: 'booking.confirmed',
      schema_version: 1,
      occurred_at: '2026-10-13T12:00:00+00:00',
      correlation_id: 'abc',
      payload: { booking_id: 1, user_id: 2 },
    }
    expect(validate(envelope, load('envelope.schema.json'))).toEqual([])
    expect(validate({ ...envelope, schema_version: 2 }, load('envelope.schema.json'))).not.toEqual(
      [],
    )
  })
})
