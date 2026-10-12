// Reads Maybank's "Foreign Exchange Counter Rates" page into rows.
//
// The page is plain HTML: a table of currencies and, below it, "Last Update Oct 12, 2026 05:16 PM" (Malaysian time).
// Columns: Currency, Selling TT/OD, Buying TT, Buying OD, Selling Notes, Buying Notes. A cell reading N/A means "not quoted".
// A currency is "1 US Dollar" or "100 Japanese Yen": the number is the unit the rate is quoted for.
//
// Rates stay as the strings the page shows; nothing here converts them to floating point.
// A currency name that is not in CODE_OF is reported and left out, never guessed at.

export const CODE_OF = {
  'australian dollar': 'AUD',
  'brunei dollar': 'BND',
  'canadian dollar': 'CAD',
  'euro': 'EUR',
  'new zealand dollar': 'NZD',
  'papua n guinea kina': 'PGK',
  'singapore dollar': 'SGD',
  'sterling pound': 'GBP',
  'swiss franc': 'CHF',
  'bangladesh taka': 'BDT',
  'danish krone': 'DKK',
  'hongkong dollar': 'HKD',
  'indian rupee': 'INR',
  'indonesian rupiah': 'IDR',
  'japanese yen': 'JPY',
  'norwegian krone': 'NOK',
  'pakistan rupee': 'PKR',
  'philippine peso': 'PHP',
  'saudi riyal': 'SAR',
  'south africa rand': 'ZAR',
  'sri lanka rupee': 'LKR',
  'swedish krona': 'SEK',
  'thai baht': 'THB',
  'us dollar': 'USD',
  'uae dirham': 'AED',
  'qatar riyal': 'QAR',
  'new taiwan dollar': 'TWD',
  'chinese renminbi': 'CNY',
};

const MONTHS = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

const strip = (s) => s.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

// "4.1545" -> "4.1545"; "N/A" or empty -> null; anything else -> undefined (not a rate).
function rateCell(raw) {
  const t = strip(raw);
  if (t === '' || /^n\/?a$/i.test(t)) return null;
  return /^\d{1,6}(\.\d{1,6})?$/.test(t) && Number(t) > 0 ? t : undefined;
}

export function parseMaybank(source) {
  const problems = [];
  const rows = [];

  let asAt = null;
  const stamp = /Last\s*Update\s*(?:<\/strong>)?\s*([A-Za-z]{3})[a-z]*\s+(\d{1,2}),\s*(\d{4})\s+(\d{1,2}):(\d{2})\s*([AP]M)/i.exec(source);
  if (stamp) {
    const month = MONTHS[stamp[1].toLowerCase()];
    let hour = Number(stamp[4]) % 12;
    if (stamp[6].toUpperCase() === 'PM') hour += 12;
    if (month) asAt = `${stamp[3]}-${month}-${stamp[2].padStart(2, '0')}T${String(hour).padStart(2, '0')}:${stamp[5]}:00+08:00`;
  }
  if (!asAt) problems.push('The page does not say when it was updated ("Last Update ...").');

  const seen = new Set();
  for (const tr of source.match(/<tr[\s>][\s\S]*?<\/tr>/gi) ?? []) {
    const cells = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1]);
    const label = /<span>\s*(\d+)\s+([^<]+?)\s*<\/span>/i.exec(cells[1] ?? '');
    if (!label) continue;
    const unit = Number(label[1]);
    const name = label[2].trim();
    const code = CODE_OF[name.toLowerCase()];
    if (unit !== 1 && unit !== 100) {
      problems.push(`${name}: quoted per ${label[1]}, which this reader does not know.`);
      continue;
    }
    if (!code) {
      problems.push(`${name}: not a currency this reader knows, so it was left out.`);
      continue;
    }
    const five = cells.slice(2, 7).map(rateCell);
    if (five.length < 5 || five.some((v) => v === undefined)) {
      problems.push(`${name}: a rate could not be read, so it was left out.`);
      continue;
    }
    if (seen.has(code)) {
      problems.push(`${name}: appears twice; the first was kept.`);
      continue;
    }
    seen.add(code);
    if (five.every((v) => v === null)) continue; // nothing quoted at all
    rows.push({
      currency: code,
      name,
      unit,
      selling_tt_od: five[0],
      buying_tt: five[1],
      buying_od: five[2],
      selling_notes: five[3],
      buying_notes: five[4],
    });
  }
  if (rows.length === 0) problems.push('No rates were found in the page.');
  return { as_at: asAt, rows, problems };
}
