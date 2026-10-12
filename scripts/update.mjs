// Fetches Maybank's public counter-rates page once, checks what came back, and rewrites rates.json only if the rates changed.
//
//   node scripts/update.mjs               fetch the page once
//   node scripts/update.mjs page.html     read a saved copy of the page instead (View source, Select all, Copy, save)
//
// It fails loudly and leaves rates.json untouched when the site does not answer 200 (it may refuse automated visitors; this
// script does not try to get around that), when the page is not the rates page or too few currencies can be read, when the
// "Last Update" time cannot be read or is older than the file already holds, or when a figure fails a sanity check.
// A red run is the signal. The last good rates stay where they are, with their own time on them.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { buildRates, URL_PAGE, FETCH_HEADERS } from './read.mjs';

const FILE = 'rates.json';

const fail = (msg) => {
  console.error(`update: ${msg}; nothing was changed.`);
  process.exit(1);
};

const fileArg = process.argv[2];
let html;
if (fileArg) {
  html = readFileSync(fileArg, 'utf8');
} else {
  let res;
  try {
    res = await fetch(URL_PAGE, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(30000) });
  } catch (e) {
    fail(`could not reach Maybank: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (res.status !== 200) fail(`Maybank answered HTTP ${res.status}`);
  html = await res.text();
}

let next;
try {
  next = buildRates(html);
} catch (e) {
  fail(e instanceof Error ? e.message : String(e));
}

if (existsSync(FILE)) {
  const prev = JSON.parse(readFileSync(FILE, 'utf8'));
  if (prev.as_at && new Date(prev.as_at) > new Date(next.as_at)) {
    fail(`Maybank's page says ${next.as_at}, which is older than the ${prev.as_at} already held`);
  }
  if (prev.as_at === next.as_at && JSON.stringify(prev.rates) === JSON.stringify(next.rates)) {
    console.log(`update: no change (still ${next.as_at}).`);
    process.exit(0);
  }
}

writeFileSync(FILE, JSON.stringify(next, null, 2) + '\n');
console.log(`update: wrote ${next.rates.length} currencies as at ${next.as_at}.${next.notes.length ? ' Notes: ' + next.notes.join(' ') : ''}`);
