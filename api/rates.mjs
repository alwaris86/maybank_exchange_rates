// GET /api/rates — reads Maybank's public counter-rates page and answers with the rates as JSON (same shape as rates.json).
//
// Run on Vercel. The answer is cached at Vercel's edge for 30 minutes (and served stale for a day while it refreshes), so
// however many callers there are, Maybank is asked about twice an hour at most.
//
// If Maybank does not answer, or the page is not the rates page, or a figure looks wrong, this answers 502 with the reason and
// nothing is cached. It does not try to get around a refusal: if Maybank says no, the answer is no.

import { buildRates, URL_PAGE, FETCH_HEADERS } from '../scripts/read.mjs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  try {
    const r = await fetch(URL_PAGE, { headers: FETCH_HEADERS, signal: AbortSignal.timeout(8000) });
    if (r.status !== 200) throw new Error(`Maybank answered HTTP ${r.status}`);
    const data = buildRates(await r.text());
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=86400');
    res.status(200).json(data);
  } catch (e) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(502).json({
      error: e instanceof Error ? e.message : String(e),
      hint: 'Maybank did not give the rates page to this server. Use the saved rates.json, and read its as_at.',
    });
  }
}
