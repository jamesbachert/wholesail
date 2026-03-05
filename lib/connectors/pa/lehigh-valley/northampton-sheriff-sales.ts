import { DataSourceConnector, ParsedRecord } from '../../types';

// ============================================================
// NORTHAMPTON COUNTY SHERIFF SALES CONNECTOR
// Source: Manual CSV/text import (their website blocks scraping)
// How to use:
//   1. Go to https://web.northamptoncounty.org/SheriffSale/SheriffSale.html
//   2. Copy the sale list text or download as CSV
//   3. POST it to /api/connectors/run/northampton-sheriff-sales
//      with body: { "data": "<pasted text or CSV>" }
// ============================================================

// Known Northampton County cities
const NORTHAMPTON_CITY_ZIPS: Record<string, string> = {
  EASTON: '18042',
  BETHLEHEM: '18015',
  'PALMER TOWNSHIP': '18045',
  PALMER: '18045',
  NAZARETH: '18064',
  BANGOR: '18013',
  'WILSON BOROUGH': '18042',
  WILSON: '18042',
  'FORKS TOWNSHIP': '18040',
  FORKS: '18040',
  'LOWER NAZARETH': '18064',
  'UPPER NAZARETH': '18064',
  PLAINFIELD: '18072',
  'PLAINFIELD TOWNSHIP': '18072',
  SLATE: '18080',
  'SLATE BELT': '18091',
  'WIND GAP': '18091',
  'PEN ARGYL': '18072',
  BATH: '18014',
  NORTHAMPTON: '18067',
  'NORTHAMPTON BORO': '18067',
  HELLERTOWN: '18055',
  'LOWER SAUCON': '18015',
  'LOWER SAUCON TWP': '18015',
  STOCKERTOWN: '18083',
  TATAMY: '18085',
  'WILLIAMS TOWNSHIP': '18042',
  WILLIAMS: '18042',
  'BUSHKILL TOWNSHIP': '18091',
  BUSHKILL: '18091',
  'MOORE TOWNSHIP': '18014',
  MOORE: '18014',
  'LEHIGH TOWNSHIP': '18067',
  LEHIGH: '18067',
  'ALLEN TOWNSHIP': '18067',
  ALLEN: '18067',
  'EAST ALLEN': '18014',
  'EAST ALLEN TWP': '18014',
  WALNUTPORT: '18088',
  'FREEMANSBURG': '18017',
  'FREEMANSBURG BORO': '18017',
  GLENDON: '18042',
  'WEST EASTON': '18042',
  'WEST EASTON BORO': '18042',
};

export class NorthamptonSheriffSalesConnector implements DataSourceConnector {
  name = 'Northampton County Sheriff Sales';
  slug = 'northampton-sheriff-sales';
  type = 'sheriff_sale';
  regionSlug = 'lehigh-valley';
  description =
    'Foreclosure properties in Northampton County. Paste data from web.northamptoncounty.org sale list.';
  sourceUrl = 'https://web.northamptoncounty.org/SheriffSale/SheriffSale.html';

  // This connector doesn't auto-fetch — it receives data via POST body
  // The fetchAndParse method handles the auto-attempt, but the real
  // import happens through parseManualInput()
  async fetchAndParse(): Promise<ParsedRecord[]> {
    // Try fetching the Northampton site — may fail due to SSL/robot blocking
    try {
      const response = await fetch(
        'https://web.northamptoncounty.org/SheriffSale/SheriffSale.html',
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            Accept: 'text/html',
          },
          signal: AbortSignal.timeout(8000), // 8s timeout
        }
      );

      if (response.ok) {
        const html = await response.text();
        return this.parseHtml(html);
      }
    } catch (err) {
      // Expected — site often blocks automated access
      console.log('[Northampton] Auto-fetch failed (expected), manual import required');
    }

    // Return empty with a clear message
    throw new Error(
      'Northampton County blocks automated scraping. Use manual import: ' +
      'POST to /api/connectors/run/northampton-sheriff-sales with body: { "data": "<pasted text>" }. ' +
      'Copy text from https://web.northamptoncounty.org/SheriffSale/SheriffSale.html'
    );
  }

  // Parse HTML if we do manage to fetch it
  parseHtml(html: string): ParsedRecord[] {
    const records: ParsedRecord[] = [];

    // Look for table rows with property data
    // Northampton format usually: Sale # | Address | City | Plaintiff | Defendant | Attorney | Sale Date
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let match;

    while ((match = rowRegex.exec(html)) !== null) {
      const rowHtml = match[1];
      const cells = [...rowHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)]
        .map((m) => m[1].replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim());

      if (cells.length < 4) continue;

      // Try to identify address cells (contain street patterns)
      const record = this.tryExtractFromCells(cells);
      if (record) records.push(record);
    }

    return records;
  }

  // Main entry point for manual pasted data
  parseManualInput(rawText: string): ParsedRecord[] {
    const records: ParsedRecord[] = [];

    // Try to detect format
    if (rawText.includes('\t') || rawText.includes(',')) {
      // Tab or comma-delimited
      const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

      // Skip header row if present
      const startIdx = lines[0].match(/sale|address|defendant|plaintiff/i) ? 1 : 0;

      for (let i = startIdx; i < lines.length; i++) {
        const cells = lines[i].includes('\t')
          ? lines[i].split('\t').map((c) => c.trim())
          : this.parseCSVLine(lines[i]);

        const record = this.tryExtractFromCells(cells);
        if (record) records.push(record);
      }
    } else {
      // Freeform text — try line-by-line parsing
      const lines = rawText.split('\n').map((l) => l.trim()).filter(Boolean);

      for (const line of lines) {
        const streetMatch = line.match(
          /(\d+\s+(?:[NSEW]\.?\s+)?(?:\w+\s+){0,4}(?:ST|AVE|RD|DR|CT|LN|BLVD|CIR|PL|TER|WAY)\.?)\s*[,]?\s*([\w\s]+?)\s*(?:PA)?\s*(\d{5})?/i
        );

        if (streetMatch) {
          const [, address, city, zip] = streetMatch;
          const cleanCity = city.trim().replace(/\s+/g, ' ');
          const cityUpper = cleanCity.toUpperCase();
          const zipCode = zip || NORTHAMPTON_CITY_ZIPS[cityUpper] || '';

          records.push({
            address: this.titleCase(address),
            city: this.titleCase(cleanCity),
            state: 'PA',
            zipCode,
            county: 'Northampton',
            signals: [
              {
                signalType: 'pre_foreclosure',
                label: 'Pre-Foreclosure',
                category: 'automated',
                points: 20,
                value: 'Sheriff sale — Northampton County',
                source: 'Northampton County Sheriff',
              },
            ],
            rawData: { rawLine: line },
          });
        }
      }
    }

    return records;
  }

  private tryExtractFromCells(cells: string[]): ParsedRecord | null {
    if (cells.length < 3) return null;

    // Find the cell that looks like an address
    let addressIdx = -1;
    let address = '';
    let city = '';
    let defendant = '';
    let plaintiff = '';
    let saleDate = '';

    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c];

      // Address: contains a number followed by street name
      if (cell.match(/^\d+\s+\w+/) && cell.match(/ST|AVE|RD|DR|CT|LN|BLVD|CIR|WAY/i)) {
        addressIdx = c;
        // Check if address includes city
        const parts = cell.match(
          /^(.+?)\s+(EASTON|BETHLEHEM|NAZARETH|BANGOR|NORTHAMPTON|HELLERTOWN|BATH|WIND GAP|PEN ARGYL|PALMER|WILSON|STOCKERTOWN|TATAMY|WALNUTPORT|FREEMANSBURG)\b/i
        );
        if (parts) {
          address = parts[1].trim();
          city = parts[2].trim();
        } else {
          address = cell.trim();
        }
      }

      // Date pattern
      if (cell.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/) || cell.match(/^\d{1,2}-\d{1,2}-\d{2,4}$/)) {
        saleDate = cell;
      }
    }

    if (!address || addressIdx < 0) return null;

    // City might be in the next cell after address
    if (!city && addressIdx + 1 < cells.length) {
      const nextCell = cells[addressIdx + 1].toUpperCase();
      if (NORTHAMPTON_CITY_ZIPS[nextCell]) {
        city = cells[addressIdx + 1].trim();
      }
    }

    // Defendant is usually 1-2 cells after address/city
    const defIdx = city ? addressIdx + 2 : addressIdx + 1;
    if (defIdx < cells.length && !cells[defIdx].match(/^\d/)) {
      defendant = cells[defIdx].trim();
    }

    // Plaintiff is often 1 cell before address or 1 cell after defendant
    if (addressIdx > 0 && !cells[addressIdx - 1].match(/^\d{1,2}[\/\-]/)) {
      plaintiff = cells[addressIdx - 1].trim();
    }

    const cityUpper = city.toUpperCase();
    const zipCode = NORTHAMPTON_CITY_ZIPS[cityUpper] || '';

    return {
      address: this.titleCase(address),
      city: this.titleCase(city) || 'Unknown',
      state: 'PA',
      zipCode,
      county: 'Northampton',
      ownerName: defendant ? this.titleCase(defendant) : undefined,
      plaintiff: plaintiff || undefined,
      saleDate: saleDate || undefined,
      signals: [
        {
          signalType: 'pre_foreclosure',
          label: 'Pre-Foreclosure',
          category: 'automated',
          points: 20,
          value: saleDate
            ? `Sheriff sale scheduled ${saleDate}`
            : 'Sheriff sale — Northampton County',
          source: 'Northampton County Sheriff',
        },
      ],
      rawData: {
        cells,
        defendant,
        plaintiff,
        saleDate,
      },
    };
  }

  private parseCSVLine(line: string): string[] {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cells.push(current.trim());
    return cells;
  }

  private titleCase(str: string): string {
    return str
      .split(' ')
      .map((w) => {
        if (w.match(/^\d/)) return w;
        if (w.length <= 2) return w.toUpperCase();
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(' ');
  }
}
