#!/usr/bin/env node
// Seed an Admin User + role directly into D1. No quota row is created.
//
//   node scripts/create-admin-d1.mjs <email> <password> [--remote] [--env <name>]
//
// `--env preview|production` selects the environment D1 binding from
// wrangler.jsonc; omit it for the top-level local database.
//
// The password hash uses the same PBKDF2-SHA512 parameters as the Worker
// (WebCrypto): 10000 iterations, 512 bits, 16-byte salt, stored `salt:hash`.
import { execFileSync } from 'node:child_process';
import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const remote = argv.includes('--remote');

let envName;
const positional = [];
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i];
  if (arg === '--env') {
    envName = argv[i + 1];
    if (!envName || envName.startsWith('--')) {
      console.error('--env requires an environment name');
      process.exit(1);
    }
    i += 1;
    continue;
  }
  if (arg.startsWith('--env=')) {
    envName = arg.slice('--env='.length);
    continue;
  }
  if (arg.startsWith('--')) continue;
  positional.push(arg);
}

const [rawEmail, password] = positional;

if (!rawEmail || !password) {
  console.error(
    'Usage: node scripts/create-admin-d1.mjs <email> <password> [--remote] [--env <name>]'
  );
  process.exit(1);
}
if (envName !== undefined && !/^[A-Za-z0-9_-]+$/.test(envName)) {
  console.error(`Invalid environment name: ${envName}`);
  process.exit(1);
}

const email = rawEmail.toLowerCase().trim();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error(`Invalid email address: ${rawEmail}`);
  process.exit(1);
}

const salt = randomBytes(16).toString('hex');
const hash = pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
const passwordHash = `${salt}:${hash}`;
const userId = randomUUID();
const timestamp = new Date().toISOString();

const sqlText = (value) => `'${value.replace(/'/g, "''")}'`;

const sql = [
  `INSERT INTO users (id, email, password_hash, created_at, updated_at, email_verified)
   VALUES (${sqlText(userId)}, ${sqlText(email)}, ${sqlText(passwordHash)},
           ${sqlText(timestamp)}, ${sqlText(timestamp)}, 1)
   ON CONFLICT(email) DO UPDATE SET
     password_hash = excluded.password_hash,
     updated_at = excluded.updated_at,
     email_verified = 1;`,
  `INSERT INTO user_roles (user_id, role, created_at)
   SELECT id, 'admin', ${sqlText(timestamp)} FROM users WHERE email = ${sqlText(email)}
   ON CONFLICT(user_id) DO UPDATE SET role = 'admin';`,
  `SELECT id, email, role FROM users JOIN user_roles ON user_roles.user_id = users.id
   WHERE email = ${sqlText(email)};`,
].join('\n');

const configPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'wrangler.jsonc'
);

const args = [
  'exec',
  'wrangler',
  'd1',
  'execute',
  'DB',
  remote ? '--remote' : '--local',
  ...(envName ? ['--env', envName] : []),
  '--config',
  configPath,
  '--yes',
  '--json',
  '--command',
  sql,
];

let output;
try {
  output = execFileSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
} catch (error) {
  console.error('Failed to seed the Admin User in D1.');
  process.exit(error.status ?? 1);
}

const json = output.slice(output.indexOf('['));
try {
  const result = JSON.parse(json);
  const row = result.at(-1)?.results?.[0];
  console.log(JSON.stringify(row));
} catch {
  console.log(output.trim());
}
