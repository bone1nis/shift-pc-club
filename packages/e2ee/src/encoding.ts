import { E2eeError } from './errors'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const utf8 = (text: string): Uint8Array<ArrayBuffer> => encoder.encode(text)
export const fromUtf8 = (bytes: ArrayBuffer | Uint8Array): string => decoder.decode(bytes)

export function toBase64Url(input: ArrayBuffer | Uint8Array): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]*$/.test(value) || value.length % 4 === 1) {
    throw new E2eeError('bad_format', 'Invalid base64url')
  }
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4))
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  // reject non-canonical encodings (non-zero trailing bits): one byte string, one text form
  if (toBase64Url(out) !== value) throw new E2eeError('bad_format', 'Invalid base64url')
  return out
}

/** Decodes base64url and checks the exact byte length (nonce, salt, ...). */
export function fromBase64UrlFixed(value: string, length: number): Uint8Array<ArrayBuffer> {
  const bytes = fromBase64Url(value)
  if (bytes.length !== length) throw new E2eeError('bad_format', 'Invalid field length')
  return bytes
}

export function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

/** Length-prefixed join, so that field boundaries cannot be shifted in AAD. */
export function joinFields(fields: Array<string | number>): Uint8Array<ArrayBuffer> {
  return concat(
    ...fields.map((f) => {
      const bytes = utf8(String(f))
      const prefix = new Uint8Array(4)
      new DataView(prefix.buffer).setUint32(0, bytes.length, true)
      return concat(prefix, bytes)
    }),
  )
}
