# maybank_exchange_rates

Maybank's public **foreign exchange counter rates**, read from [its own page](https://www.maybank2u.com.my/maybank2u/malaysia/en/personal/rates/forex_rates.page) into one JSON file, `rates.json`.

Maybank publishes these rates as a web page and offers no feed. This repository reads that page and keeps the result in a form a program can use.

> **Status, 2026-10-12: it does not update by itself.** Maybank's site does not answer GitHub's servers (a test run timed out after 30 seconds), so the scheduled job is switched off. The reader works on a saved copy of the page; see [Updating by hand](#updating-by-hand). `rates.json` holds `as_at: null` until somebody does that.

> **Indicative only.** Maybank describes these as "indicative for the day and subject to change without prior notice". This project is not affiliated with or endorsed by Maybank. Check the source page before relying on a figure. The rates belong to Maybank.

## Using it

```
https://raw.githubusercontent.com/alwaris86/maybank_exchange_rates/main/rates.json
```

```json
{
  "bank": "MAYBANK",
  "as_at": "2026-10-12T17:16:00+08:00",
  "fetched_at": "2026-10-12T09:31:07.512Z",
  "quoted_in": "MYR per `unit` of the currency (1 or 100)",
  "rates": [
    {
      "currency": "USD",
      "name": "US Dollar",
      "unit": 1,
      "selling_tt_od": "4.1545",
      "buying_tt": "4.0095",
      "buying_od": "3.9995",
      "selling_notes": "4.1870",
      "buying_notes": "3.9930"
    }
  ]
}
```

- `as_at` is the time **Maybank states** on its page ("Last Update"), in Malaysian time. It is not the time this repository read it. Always show it beside a rate.
- Rates are **strings, exactly as Maybank prints them**, so no precision is lost. Parse them as decimals, not floating point, if they go near money.
- `unit` is how many units of the currency the rate is for: `1` for US Dollar, `100` for Japanese Yen, Thai Baht and others. Divide by `unit` for a per-1 rate.
- `null` means Maybank shows N/A for that column.
- `selling_tt_od` is what Maybank charges to sell you the currency by telegraphic transfer or overdraft: the usual rate for paying an overseas supplier. `buying_*` is what Maybank pays you for it.
- Before the first successful read, `as_at` is `null` and `rates` is empty. Treat that as "no data".

## Updating by hand

Open Maybank's rates page in a browser, press **Ctrl+U** for the page source, **Select all**, **Copy**, and save it as a file, say `page.html`. Then:

```
node scripts/update.mjs page.html
git add rates.json && git commit -m "Maybank rates" && git push
```

It checks what it was given, and rewrites `rates.json` only if the rates changed. It refuses, and changes nothing, when the file is not the rates page, when fewer than 20 currencies can be read, when the "Last Update" time cannot be read or is older than what is held, or when a figure looks wrong (a selling rate below the buying rate, or USD outside 2 to 10 ringgit).

## Updating automatically (not working)

`.github/workflows/update.yml` reads the page itself, once, identifying itself plainly, and commits if the rates changed. It runs when started by hand from the **Actions** tab. Its schedule is switched off because Maybank does not answer GitHub's servers, so it could only fail. This project does not try to get around that: if Maybank says no, it stops. If that changes, restore the `schedule:` lines in the workflow (the times are in a comment there).

If you depend on `rates.json`, always read `as_at` and show it beside the rate, and keep a manual way to enter a rate.

## Live endpoint on Vercel (being tested)

`api/rates.mjs` is a Vercel function: `GET /api/rates` reads Maybank's page when asked and answers with the same JSON as `rates.json`. It is set to run in Singapore (`vercel.json`), caches each answer at Vercel's edge for 30 minutes so Maybank is asked about twice an hour at most, and answers `502` with the reason, caching nothing, whenever Maybank does not hand over the rates page. It does not try to get around a refusal.

Whether Maybank answers Vercel's servers is not known until it has been tried. If `/api/rates` answers 502, use `rates.json` and read its `as_at`.

## Running it yourself

Node 18 or later, no dependencies:

```
npm test         # the reader against the fixture
npm run update   # one read of Maybank's page (usually refused; see above)
```

## Files

| Path | What it is |
| --- | --- |
| `rates.json` | The data. |
| `scripts/parse.mjs` | Reads the page's HTML table. Unknown currency names are reported, never guessed. |
| `scripts/update.mjs` | Fetches (or reads a saved page), checks, writes `rates.json`. |
| `scripts/read.mjs` | The checks both of the above stop on. |
| `api/rates.mjs` | The Vercel function. |
| `test/` | The reader against a fixture shaped like the page. |
