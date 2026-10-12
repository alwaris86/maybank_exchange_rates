// Fetches Maybank's public counter-rates page once, checks what came back, and rewrites rates.json only if the rates changed.
//
//   node scripts/update.mjs
//
// It fails loudly and leaves rates.json untouched when:
//   - the site does not answer 200 (it may refuse automated visitors; this script does not try to get around that),
//   - the page is not the rates page, or too few currencies could be read,
//   - the "Last Update" time cannot be read, or is older than the file already holds,
//   - a figure fails a basic sanity check.
// A red run is the signal. The last good rates stay where they are, with their own time on them.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { parseMaybank } from './parse.mjs';

const URL_PAGE = 'https://www.maybank2u.com.my/maybank2u/malaysia/en/personal/rates/forex_rates.page';
const FILE = 'rates.json';
const MIN_CURRENCIES = 20;

const fail = (msg) => {
  console.error(`update: ${msg}`);
  process.exit(1);
};

let res;
try {
  res = await fetch(URL_PAGE, {
    headers: {
      // Says plainly who is asking.
      'user-agent': 'maybank_exchange_rates (+https://github.com/alwaris86/maybank_exchange_rates)',
      accept: 'text/html',
    },
    signal: AbortSignal.timeout(30000),
  });
} catch (e) {
  fail(`could not reach Maybank: ${e instanceof Error ? e.message : String(e)}`);
}
if (res.status !== 200) fail(`Maybank answered HTTP ${res.status}; nothing was changed.`);

const html = await res.text();
if (!html.includes('Foreign Exchange Counter Rates')) {
  fail(`the response is not the rates page (${html.length} bytes, starts: ${JSON.stringify(html.slice(0, 120))}); nothing was changed.`);
}

const parsed = parseMaybank(html);
if (!parsed.as_at) fail('the "Last Update" time could not be read; nothing was changed.');
if (parsed.rows.length < MIN_CURRENCIES) {
  fail(`only ${parsed.rows.length} currencies could be read (expected at least ${MIN_CURRENCIES}). ${parsed.problems.join(' ')}`);
}

// Sanity: a selling rate is never below the buying rate for the same currency, and USD is in a believable range.
for (const r of parsed.rows) {
  if (r.selling_tt_od && r.buying_tt && Number(r.selling_tt_od) < Number(r.buying_tt)) {
    fail(`${r.currency}: selling TT/OD ${r.selling_tt_od} is below buying TT ${r.buying_tt}; the page looks wrong, so nothing was changed.`);
  }
}
const usd = parsed.rows.find((r) => r.currency === 'USD');
if (!usd || !usd.selling_tt_od || Number(usd.selling_tt_od) < 2 || Number(usd.selling_tt_od) > 10) {
  fail(`USD selling TT/OD ${usd ? usd.selling_tt_od : 'missing'} is outside 2 to 10 ringgit; nothing was changed.`);
}

const next = {
  bank: 'MAYBANK',
  source: URL_PAGE,
  as_at: parsed.as_at,
  fetched_at: new Date().toISOString(),
  disclaimer: 'Indicative rates for the day, published by Maybank and subject to change without notice. Not affiliated with or endorsed by Maybank. Check the source page before relying on a figure.',
  quoted_in: 'MYR per `unit` of the currency (1 or 100)',
  rates: parsed.rows,
};

if (existsSync(FILE)) {
  const prev = JSON.parse(readFileSync(FILE, 'utf8'));
  if (prev.as_at && new Date(prev.as_at) > new Date(next.as_at)) {
    fail(`Maybank's page says ${next.as_at}, which is older than the ${prev.as_at} already held; nothing was changed.`);
  }
  if (prev.as_at === next.as_at && JSON.stringify(prev.rates) === JSON.stringify(next.rates)) {
    console.log(`update: no change (still ${next.as_at}).`);
    process.exit(0);
  }
}

writeFileSync(FILE, JSON.stringify(next, null, 2) + '\n');
console.log(`update: wrote ${parsed.rows.length} currencies as at ${next.as_at}.${parsed.problems.length ? ' Notes: ' + parsed.problems.join(' ') : ''}`);
