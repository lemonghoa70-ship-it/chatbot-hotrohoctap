import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeVietnameseName,
  getSecurityStatus,
  registerStudent,
  loginStudent,
  adminUpdateStudent,
  adminDeleteStudent,
} from '../authStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

test('normalizeVietnameseName normalizes NFC/NFD, spaces, and Title Case', () => {
  const nfc = normalizeVietnameseName('  lê   dương trường   hải  ');
  const nfd = normalizeVietnameseName(('LÊ DƯƠNG TRƯỜNG HẢI').normalize('NFD'));
  assert.equal(nfc.display, 'Lê Dương Trường Hải');
  assert.equal(nfc.lookup, 'lê dương trường hải');
  assert.equal(nfd.lookup, nfc.lookup);
  assert.equal(nfd.display, nfc.display);
});

test('getSecurityStatus returns expected boolean flags', () => {
  const s = getSecurityStatus();
  assert.equal(typeof s.supabaseConfigured, 'boolean');
  assert.equal(typeof s.usingDefaultAdminPassword, 'boolean');
  assert.equal(typeof s.isProduction, 'boolean');
});

test('student register, duplicate-name check, cross-class allowance, and login flow', async () => {
  const uniq = `Test Học Sinh ${Date.now()}`;
  const r1 = await registerStudent({ fullName: `  ${uniq.toLowerCase()} `, className: '8/1', password: 'pw123456', approved: true });
  assert.equal(r1.ok, true);
  assert.equal(r1.profile.class_name, '8/1');

  // Same name + same class -> rejected (409)
  const rDup = await registerStudent({ fullName: uniq, className: '8/1', password: 'pw123456', approved: true });
  assert.equal(rDup.ok, false);
  assert.equal(rDup.status, 409);

  // Same name + different class -> allowed
  const rOtherClass = await registerStudent({ fullName: uniq, className: '8/2', password: 'pw123456', approved: true });
  assert.equal(rOtherClass.ok, true);

  // Login with normalized name + class
  const loginOk = await loginStudent({ fullName: uniq.toUpperCase(), className: '8/1', password: 'pw123456', clientIp: '127.0.0.1' });
  assert.equal(loginOk.ok, true);

  // Admin edit duplicate check & cleanup
  const editDup = await adminUpdateStudent(rOtherClass.profile.id, { full_name: uniq, class_name: '8/1' });
  assert.equal(editDup.ok, false);
  assert.equal(editDup.status, 409);

  await adminDeleteStudent(r1.profile.id);
  await adminDeleteStudent(rOtherClass.profile.id);
});

test('index.html main script parses cleanly without syntax errors', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const scripts = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
  assert.ok(scripts.length > 0, 'Expected inline <script> in index.html');
  const mainJs = scripts[scripts.length - 1].replace(/^<script>|<\/script>$/g, '');
  assert.doesNotThrow(() => new Function(mainJs));
});
