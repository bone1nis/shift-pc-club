import { concat, utf8 } from './encoding'
import { publicKeyBytes, subtle, type PublicKeyInput } from './keys'

const MOD = 10n ** 60n

async function digits(raws: Uint8Array[]): Promise<string> {
  const digest = new Uint8Array(
    await subtle().digest('SHA-256', concat(utf8('pcclub-fingerprint-v1'), ...raws)),
  )
  let n = 0n
  for (const b of digest) n = (n << 8n) | BigInt(b)
  const s = (n % MOD).toString().padStart(60, '0')
  return Array.from({ length: 12 }, (_, i) => s.slice(i * 5, i * 5 + 5)).join(' ')
}

const compare = (a: Uint8Array, b: Uint8Array): number => {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return (a[i] as number) - (b[i] as number)
  }
  return a.length - b.length
}

/** Safety number of a pair of keys: order-independent, 12 groups of 5 digits. */
export async function fingerprint(a: PublicKeyInput, b?: PublicKeyInput): Promise<string> {
  const raws = [await publicKeyBytes(a)]
  if (b !== undefined) raws.push(await publicKeyBytes(b))
  raws.sort(compare)
  return digits(raws)
}

/** Fingerprint of a single key (owner key shown to players). */
export const fingerprintOfKey = (publicKey: PublicKeyInput): Promise<string> =>
  fingerprint(publicKey)
