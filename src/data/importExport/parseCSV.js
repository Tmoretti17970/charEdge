// ═══════════════════════════════════════════════════════════════════
// charEdge — CSV Parser
// ═══════════════════════════════════════════════════════════════════

/**
 * Parse a CSV string into rows of objects.
 * Handles quoted fields with commas and newlines.
 */
export function parseCSV(text) {
  const lines = [];
  let current = '';
  let inQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuote = !inQuote;
      }
    } else if (ch === '\n' && !inQuote) {
      lines.push(current);
      current = '';
    } else if (ch === '\r' && !inQuote) {
      // skip CR
    } else {
      current += ch;
    }
  }
  if (current.trim()) lines.push(current);

  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const vals = [];
    let val = '';
    let q = false;
    for (let j = 0; j < lines[i].length; j++) {
      const c = lines[i][j];
      if (c === '"') {
        if (q && lines[i][j + 1] === '"') {
          val += '"';
          j++;
        } else q = !q;
      } else if (c === ',' && !q) {
        vals.push(val.trim());
        val = '';
      } else {
        val += c;
      }
    }
    vals.push(val.trim());

    const row = {};
    headers.forEach((h, idx) => {
      row[h] = vals[idx] || '';
    });
    rows.push(row);
  }

  return rows;
}
