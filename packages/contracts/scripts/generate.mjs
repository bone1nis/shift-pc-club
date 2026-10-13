#!/usr/bin/env node
// Генерирует TypeScript-описание HTTP API из OpenAPI-спецификаций Scramble.
//   node scripts/generate.mjs [--base http://localhost:8088] [--check]
// --check ничего не пишет и завершается с ошибкой, если файл устарел (для CI).
// Вывод генератора не считается истиной: Scramble пока описывает ответы неполно
// (`additionalProperties: {}`), поэтому доменные типы остаются в src/index.ts вручную.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../src/generated/api.ts')
const args = process.argv.slice(2)
const base = args.includes('--base') ? args[args.indexOf('--base') + 1] : 'http://localhost:8088'
const check = args.includes('--check')
const services = {
  identity: '/api/auth/openapi.json',
  club: '/api/club/openapi.json',
  booking: '/api/booking/openapi.json',
}

function ts(schema, indent = '  ') {
  if (!schema || typeof schema !== 'object') return 'unknown'
  if (schema.const !== undefined) return JSON.stringify(schema.const)
  if (schema.enum) return schema.enum.map((v) => JSON.stringify(v)).join(' | ')
  for (const key of ['anyOf', 'oneOf']) {
    if (schema[key]) return [...new Set(schema[key].map((s) => ts(s, indent)))].join(' | ')
  }
  if (schema.allOf) return schema.allOf.map((s) => ts(s, indent)).join(' & ')
  const types = Array.isArray(schema.type) ? schema.type : [schema.type]
  const parts = types.map((type) => {
    switch (type) {
      case 'string':
        return 'string'
      case 'integer':
      case 'number':
        return 'number'
      case 'boolean':
        return 'boolean'
      case 'null':
        return 'null'
      case 'array':
        return `Array<${ts(schema.items, indent)}>`
      case 'object':
      case undefined: {
        const props = Object.entries(schema.properties ?? {})
        if (!props.length) return 'Record<string, unknown>'
        const required = new Set(schema.required ?? [])
        const lines = props.map(
          ([name, child]) =>
            `${indent}  ${JSON.stringify(name)}${required.has(name) ? '' : '?'}: ${ts(child, indent + '  ')}`,
        )
        return `{\n${lines.join('\n')}\n${indent}}`
      }
      default:
        return 'unknown'
    }
  })
  return parts.join(' | ')
}

function jsonSchema(content) {
  return content?.['application/json']?.schema
}

let source = '// Файл создан scripts/generate.mjs из OpenAPI. Не редактируйте вручную.\n\n'
for (const [service, path] of Object.entries(services)) {
  const spec = await fetch(base + path).then((r) => {
    if (!r.ok) throw new Error(`${service}: ${r.status} ${r.statusText} (${base + path})`)
    return r.json()
  })
  source += `export interface ${service[0].toUpperCase()}${service.slice(1)}Api {\n`
  for (const [route, methods] of Object.entries(spec.paths).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    for (const [method, op] of Object.entries(methods).sort(([a], [b]) => a.localeCompare(b))) {
      const request = jsonSchema(op.requestBody?.content)
      const ok = Object.entries(op.responses ?? {}).find(([code]) => code.startsWith('2'))
      const response = ok ? jsonSchema(ok[1].content) : undefined
      source += `  ${JSON.stringify(`${method.toUpperCase()} ${route}`)}: {\n`
      source += `    request: ${request ? ts(request, '    ') : 'undefined'}\n`
      source += `    response: ${response ? ts(response, '    ') : 'undefined'}\n  }\n`
    }
  }
  source += '}\n\n'
}

if (check) {
  let current = ''
  try {
    current = readFileSync(out, 'utf8')
  } catch {
    // no file
  }
  if (current !== source) {
    console.error(
      'packages/contracts/src/generated/api.ts устарел: выполните pnpm --filter @shift/contracts generate',
    )
    process.exit(1)
  }
  console.log('Контракты актуальны.')
} else {
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, source)
  console.log(`Записано ${out}`)
}
