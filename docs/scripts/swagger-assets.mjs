import { cp, mkdir, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = dirname(dirname(fileURLToPath(import.meta.url)))
const source = dirname(require.resolve('swagger-ui-dist/package.json'))
const destination = join(root, 'public/swagger-ui')

await rm(destination, { recursive: true, force: true })
await mkdir(destination, { recursive: true })
for (const file of ['swagger-ui.css', 'swagger-ui-bundle.js', 'swagger-ui-standalone-preset.js']) {
  await cp(join(source, file), join(destination, file))
}
