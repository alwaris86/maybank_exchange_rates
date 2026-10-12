// Turns the page's HTML into the rates object, or throws an Error saying why it will not.
// Used by scripts/update.mjs (writes rates.json) and api/rates.mjs (answers a request); both stop on the same checks.

import { parseMaybank } from './parse.mjs';

export const URL_PAGE = 'https://www.maybank2u.com.my/maybank2u/malaysia/en/personal/rates/forex_rates.page';
export const MIN_CURRENCIES = 20;

/** Says plainly who is asking. */
export const FETCH_HEADERS = {
  'user-agent': 'maybank_exchange_rates (+https://github.com/alwaris86/maybank_exchange_rates)',
  accept: 'text/html',
};

export function buildRates(html, source = URL_PAGE) {
  if (!html.includes('Foreign Exchange Counter Rates')) {
    throw new Error(`this is not the rates page (${html.length} bytes, starts: ${JSON.stringify(html.slice(0, 120))})`);
  }
  const parsed = parseMaybank(html);
  if (!parsed.as_at) throw new Error('the "Last Update" time could not be read');
  if (parsed.rows.length < MIN_CURRENCIES) {
    throw new Error(`only ${parsed.rows.length} currencies could be read (expected at least ${MIN_CURRENCIES}). ${parsed.problems.join(' ')}`);
  }
  // A selling rate is never below the buying rate for the same currency, and USD is in a believable range.
  for (const r of parsed.rows) {
    if (r.selling_tt_od && r.buying_tt && Number(r.selling_tt_od) < Number(r.buying_tt)) {
      throw new Error(`${r.currency}: selling TT/OD ${r.selling_tt_od} is below buying TT ${r.buying_tt}; the page looks wrong`);
    }
  }
  const usd = parsed.rows.find((r) => r.currency === 'USD');
  if (!usd || !usd.selling_tt_od || Number(usd.selling_tt_od) < 2 || Number(usd.selling_tt_od) > 10) {
    throw new Error(`USD selling TT/OD ${usd ? usd.selling_tt_od : 'missing'} is outside 2 to 10 ringgit`);
  }
  return {
    bank: 'MAYBANK',
    source,
    as_at: parsed.as_at,
    fetched_at: new Date().toISOString(),
    disclaimer:
      'Indicative rates for the day, published by Maybank and subject to change without notice. Not affiliated with or endorsed by Maybank. Check the source page before relying on a figure.',
    quoted_in: 'MYR per `unit` of the currency (1 or 100)',
    rates: parsed.rows,
    notes: parsed.problems,
  };
}
