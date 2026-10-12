import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseMaybank } from '../scripts/parse.mjs';

const html = readFileSync(new URL('./fixture.html', import.meta.url), 'utf8');

test('reads the stated time as Malaysian time', () => {
  assert.equal(parseMaybank(html).as_at, '2026-10-12T17:16:00+08:00');
});

test('reads per-1 and per-100 currencies and keeps the decimals as written', () => {
  const { rows } = parseMaybank(html);
  assert.deepEqual(rows.map((r) => r.currency), ['AUD', 'JPY', 'TWD', 'USD', 'IDR']);
  const usd = rows.find((r) => r.currency === 'USD');
  assert.deepEqual([usd.unit, usd.selling_tt_od, usd.buying_tt, usd.buying_od, usd.selling_notes, usd.buying_notes], [1, '4.1545', '4.0095', '3.9995', '4.1870', '3.9930']);
  assert.equal(rows.find((r) => r.currency === 'JPY').unit, 100);
  assert.equal(rows.find((r) => r.currency === 'IDR').selling_tt_od, '0.0242');
});

test('N/A is "not quoted", and a currency with nothing quoted is dropped', () => {
  const { rows } = parseMaybank(html);
  const twd = rows.find((r) => r.currency === 'TWD');
  assert.deepEqual([twd.selling_tt_od, twd.buying_tt, twd.buying_od, twd.selling_notes, twd.buying_notes], ['14.0000', null, null, '14.1600', '11.9700']);
  assert.equal(rows.some((r) => r.currency === 'PGK'), false);
});

test('a name it does not know is reported, not guessed', () => {
  const { rows, problems } = parseMaybank(html);
  assert.ok(problems.some((p) => p.startsWith('Martian Dollar')));
  assert.equal(rows.some((r) => r.name === 'Martian Dollar'), false);
});

test('a page that is not the rates page gives nothing, and says so', () => {
  const p = parseMaybank('<html><body>Access Denied</body></html>');
  assert.equal(p.rows.length, 0);
  assert.ok(p.problems.length >= 1);
});
