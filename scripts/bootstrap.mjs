// Готовит локальное окружение к первому запуску. Ничего не запускает и не трогает базы.
//   1. Создаёт `.env` из `.env.example` и подставляет случайные секреты вместо `replace-with-local-secret`;
//      уже существующие значения сохраняются, дописываются только недостающие ключи.
//   2. Создаёт пару ключей RSA для подписи JWT в `.runtime/keys` (если их ещё нет).
//   3. Копирует `.env.example` каждого Laravel-сервиса в его `.env`.
// Запускается из `scripts/setup.sh` (с Node на хосте) и из `scripts/start.sh` (в контейнере node:alpine,
// поэтому для запуска проекта в Docker Node на машине не нужен). Скрипт безопасно запускать повторно.
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { randomBytes, generateKeyPairSync } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
const root = fileURLToPath(new URL('../', import.meta.url))
const envPath = resolve(root, '.env')
const template = readFileSync(resolve(root, '.env.example'), 'utf8')
const existingEnv = existsSync(envPath) ? readFileSync(envPath, 'utf8') : ''
const existingKeys = new Set(
  existingEnv
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=/)?.[1])
    .filter(Boolean),
)
const missingLines = template
  .split(/\r?\n/)
  .filter((line) => {
    const key = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=/)?.[1]
    return key && !existingKeys.has(key)
  })
  .map((line) => line.replace(/=replace-with-local-secret$/, `=${randomBytes(24).toString('hex')}`))
if (!existsSync(envPath)) {
  writeFileSync(envPath, missingLines.join('\n') + '\n', { mode: 0o600 })
} else if (missingLines.length) {
  writeFileSync(envPath, `${existingEnv.replace(/\s*$/, '')}\n${missingLines.join('\n')}\n`)
}
const keys = resolve(root, '.runtime/keys')
mkdirSync(keys, { recursive: true })
if (!existsSync(resolve(keys, 'jwt-private.pem'))) {
  const pair = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  writeFileSync(resolve(keys, 'jwt-private.pem'), pair.privateKey, { mode: 0o600 })
  writeFileSync(resolve(keys, 'jwt-public.pem'), pair.publicKey)
}
for (const service of ['identity', 'club', 'booking']) {
  const target = resolve(root, 'services', service, '.env')
  const example = resolve(root, 'services', service, '.env.example')
  if (!existsSync(target) && existsSync(example)) {
    writeFileSync(target, readFileSync(example))
    chmodSync(target, 0o600)
  }
}
console.log('Локальное окружение и ключи подписи готовы. Существующие значения сохранены.')
