#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const WRANGLER = './node_modules/.bin/wrangler'
const CONFIG = 'wrangler.jsonc'
const checkOnly = process.argv.includes('--check')

function fail(message, hints = []) {
  console.error(`\n✖ ${message}`)
  for (const hint of hints) console.error(`  → ${hint}`)
  process.exit(1)
}

function readConfig() {
  const raw = readFileSync(CONFIG, 'utf8')
  const stripped = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  return JSON.parse(stripped)
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.error) fail(`failed to run ${command}: ${result.error.message}`)
  return result.status ?? 1
}

function capture(command, args) {
  return spawnSync(command, args, { encoding: 'utf8' })
}

const config = readConfig()
const accountId = config.account_id
if (!accountId) {
  fail(`${CONFIG} has no account_id`, ['pin the target account before deploying so a command cannot reach the wrong one'])
}

if (process.env.CLOUDFLARE_API_TOKEN && process.env.ALLOW_API_TOKEN !== '1') {
  fail('CLOUDFLARE_API_TOKEN is set and overrides auth profiles', [
    'unset it to use the pinned profile, or set ALLOW_API_TOKEN=1 if this is intentional',
  ])
}

const who = capture(WRANGLER, ['whoami', '--json'])
if (who.status !== 0) {
  fail('wrangler whoami failed', [String(who.stderr ?? '').trim().slice(0, 400)])
}

let identity
try {
  identity = JSON.parse(who.stdout)
} catch {
  fail('could not parse wrangler whoami output')
}
if (!identity.loggedIn) {
  fail('not logged in', ['run: wrangler auth create <profile> && wrangler auth activate <profile> <this directory>'])
}

const accounts = identity.accounts ?? []
const target = accounts.find((account) => account.id === accountId)
if (!target) {
  fail(`pinned account ${accountId} is not reachable by the active profile (${identity.email})`, [
    `reachable accounts: ${accounts.map((account) => `${account.name} (${account.id})`).join(', ') || 'none'}`,
    `activate the right profile: wrangler auth activate <profile> ${process.cwd()}`,
  ])
}

const database = config.d1_databases?.[0]
if (!database?.database_id) {
  const hints = [
    `wrangler d1 create ${database?.database_name ?? config.name}`,
    'paste the returned database_id into wrangler.jsonc, then run: npm run cf:db:remote',
  ]
  if (checkOnly) {
    console.warn(`\n⚠ no D1 database_id in ${CONFIG} — the API will fail once deployed`)
    for (const hint of hints) console.warn(`  → ${hint}`)
  } else {
    fail(`no D1 database_id in ${CONFIG}`, hints)
  }
}

console.log(`\ndeploy target · worker ${config.name} · account ${target.name} (${accountId})`)
if (database?.database_id) console.log(`database     · ${database.database_name} (${database.database_id})`)

if (checkOnly) {
  console.log('mode         · dry run only\n')
  process.exit(run(WRANGLER, ['deploy', '--dry-run']))
}

console.log('mode         · build and deploy\n')
const buildStatus = run('npm', ['run', 'build'])
if (buildStatus !== 0) process.exit(buildStatus)
process.exit(run(WRANGLER, ['deploy']))
