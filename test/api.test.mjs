import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/rates.mjs';
import { CODE_OF } from '../scripts/parse.mjs';

// A page shaped like Maybank's, with every currency the reader knows and invented figures.
const names = Object.keys(CODE_OF).map((n) => n.replace(/\b\w/g, (c) => c.toUpperCase()));
const rows = names
  .map((n, i) => {
    const base = n === 'Us Dollar' ? 4.1545 : 1 + i * 0.3;
    const cell = (v) => `<td>\n\t${v.toFixed(4)}\n</td>`;
    const unit = i % 2 ? 100 : 1;
    return `<tr><td></td><td class="currency"><div><span>${unit} ${n === 'Us Dollar' ? 'US Dollar' : n}</span></div></td>${cell(base)}${cell(base * 0.965)}${cell(base * 0.96)}${cell(base * 1.01)}${cell(base * 0.96)}<td></td></tr>`;
  })
  .join('');
const PAGE = `<html><body><h2>Foreign Exchange Counter Rates</h2><table>${rows}</table><p><strong>Last Update </strong> Oct 12, 2026 05:16 PM</p></body></html>`;

function run(fetchImpl) {
  const realFetch = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  const out = { headers: {}, status: null, body: null };
  const res = {
    setHeader: (k, v) => (out.headers[k.toLowerCase()] = v),
    status(code) {
      out.status = code;
      return this;
    },
    json(b) {
      out.body = b;
    },
  };
  return handler({}, res).then(() => out).finally(() => (globalThis.fetch = realFetch));
}

test('answers with the rates, cached at the edge, when Maybank gives the page', async () => {
  const out = await run(async () => ({ status: 200, text: async () => PAGE }));
  assert.equal(out.status, 200);
  assert.equal(out.body.as_at, '2026-10-12T17:16:00+08:00');
  assert.ok(out.body.rates.length >= 20);
  assert.match(out.headers['cache-control'], /s-maxage=1800/);
  assert.equal(out.headers['access-control-allow-origin'], '*');
});

test('answers 502 and caches nothing when Maybank refuses', async () => {
  const out = await run(async () => ({ status: 403, text: async () => 'Access Denied' }));
  assert.equal(out.status, 502);
  assert.match(out.body.error, /HTTP 403/);
  assert.equal(out.headers['cache-control'], 'no-store');
});

test('answers 502 when Maybank cannot be reached', async () => {
  const out = await run(async () => {
    throw new Error('The operation was aborted due to timeout');
  });
  assert.equal(out.status, 502);
  assert.match(out.body.error, /timeout/);
});

test('answers 502 when what came back is not the rates page', async () => {
  const out = await run(async () => ({ status: 200, text: async () => '<html>Please verify you are human</html>' }));
  assert.equal(out.status, 502);
  assert.match(out.body.error, /not the rates page/);
});
