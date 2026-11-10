#!/usr/bin/env node
// Seed an Admin User + role directly into D1. No quota row is created.
//
//   node scripts/create-admin-d1.mjs <email> <password> [--remote]
//
// The password hash uses the same PBKDF2-SHA512 parameters as the Worker
// (WebCrypto): 10000 iterations, 512 bits, 16-byte salt, stored `salt:hash`.
import { execFileSync } from 'node:child_process';
import { pbkdf2Sync, randomBytes, randomUUID } from 'node:crypto';

const argv = process.argv.slice(2);
const remote = argv.includes('--remote');
const positional = argv.filter((arg) => !arg.startsWith('--'));
const [rawEmail, password] = positional;

if (!rawEmail || !password) {
  console.error('Usage: node scripts/create-admin-d1.mjs <email> <password> [--remote]');
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

const args = [
  'exec',
  'wrangler',
  'd1',
  'execute',
  'DB',
  remote ? '--remote' : '--local',
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
