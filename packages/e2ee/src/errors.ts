/** Generic crypto failure. Messages never contain plaintext, keys or recovery codes. */
export class E2eeError extends Error {
  constructor(
    readonly code: 'decrypt_failed' | 'bad_recovery_code' | 'bad_format',
    message: string,
  ) {
    super(message)
    this.name = 'E2eeError'
  }
}
