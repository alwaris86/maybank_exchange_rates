# maybank_exchange_rates

Maybank's public **foreign exchange counter rates**, read from [its own page](https://www.maybank2u.com.my/maybank2u/malaysia/en/personal/rates/forex_rates.page) into one JSON file, `rates.json`.

Maybank publishes these rates as a web page and offers no feed. This repository reads that page a few times a day and keeps the result in a form a program can use.

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

## How it updates

A GitHub Actions workflow (`.github/workflows/update.yml`) runs at 08:30, 11:30, 14:30 and 17:30 Malaysian time and can be started by hand from the **Actions** tab. Each run:

1. checks the reader against the fixture in `test/`,
2. asks Maybank for the page once, identifying itself plainly,
3. checks what came back, and rewrites `rates.json` only if the rates changed.

It stops without touching `rates.json`, and the run goes **red**, when the site does not answer normally, when the page is not the rates page, when fewer than 20 currencies can be read, when the time cannot be read or is older than what is held, or when a figure looks wrong. A red run is the signal to look. The last good rates stay in the file with their own `as_at`, so a consumer can see how old they are and decide for itself.

**It is not guaranteed to keep working.** Maybank's site may refuse automated visitors, and its page can change shape. This project does not try to get around either: if Maybank says no, it stops. If you depend on it, check `as_at` is recent, and keep a manual way to enter a rate.

GitHub also pauses scheduled workflows in a repository with no activity for 60 days. Every change to the rates is a commit, which counts; if the rates stand still and you see no runs, press **Run workflow** once.

## Running it yourself

Node 18 or later, no dependencies:

```
npm test         # the reader against the fixture
npm run update   # one read of Maybank's page
```

## Files

| Path | What it is |
| --- | --- |
| `rates.json` | The data. |
| `scripts/parse.mjs` | Reads the page's HTML table. Unknown currency names are reported, never guessed. |
| `scripts/update.mjs` | Fetches, checks, writes. |
| `test/` | The reader against a fixture shaped like the page. |
