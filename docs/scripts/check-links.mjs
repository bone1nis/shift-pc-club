import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, extname, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const docs = dirname(dirname(fileURLToPath(import.meta.url)))
const root = dirname(docs)
const markdown = []
const failures = []

async function collect(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === '.vitepress') continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) await collect(path)
    else if (extname(path) === '.md') markdown.push(path)
  }
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

function candidates(target, source) {
  const clean = decodeURIComponent(target.split(/[?#]/, 1)[0] || '')
  const path = clean.startsWith('/') ? resolve(docs, `.${clean}`) : resolve(dirname(source), clean)
  const normalized = normalize(path)
  if (normalized !== root && !normalized.startsWith(`${root}${sep}`)) return []
  if (extname(normalized)) {
    // Статические файлы (скриншоты и т. п.) лежат в docs/public и доступны по абсолютному пути.
    return clean.startsWith('/')
      ? [normalized, normalize(resolve(docs, 'public', `.${clean}`))]
      : [normalized]
  }
  return [join(normalized, 'index.md'), `${normalized}.md`, normalized]
}

await collect(docs)
for (const source of markdown) {
  const body = await readFile(source, 'utf8')
  const links = [...body.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g)].map(
    (match) => match[1],
  )
  for (const target of links) {
    if (/^(?:[a-z]+:|#|\/\/)/i.test(target)) continue
    const matches = candidates(target, source)
    if (!matches.length) {
      failures.push(`${source}: path escapes project: ${target}`)
      continue
    }
    let found = false
    for (const candidate of matches) found ||= await isFile(candidate)
    if (!found) failures.push(`${source}: missing ${target}`)
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Checked ${markdown.length} Markdown files; local links resolve.`)
}
