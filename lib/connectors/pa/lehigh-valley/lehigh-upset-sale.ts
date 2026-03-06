import { DataSourceConnector, ParsedRecord } from '../../types';

// ============================================================
// LEHIGH COUNTY UPSET SALE CONNECTOR
// Source: lehighcountytaxclaim.com (Upset Sale PDF)
// Data: Properties with 2+ years of unpaid taxes listed for
//       upset sale by the Tax Claim Bureau. ~250 properties/year.
// Key Value: Earlier stage of tax distress (before Judicial Sale
//            and Repository). Feeds both Pipeline and Discovery.
// ============================================================

// The most recent results PDF — update annually after each September sale
const UPSET_SALE_PDF_URL =
  'https://www.lehighcountytaxclaim.com/images/2025_Upset_Sale/Upset_Sale_9-10-25_RESULTS_-_HallockTechnologies.pdf';

// Municipality to city name + default zip mapping
// Upset Sale PDF uses verbose prefixes: "CITY OF", "BOROUGH OF", "TOWNSHIP"
// which are stripped before lookup. Shares the same map as the repository connector.
const MUNICIPALITY_MAP: Record<string, { city: string; zip: string }> = {
  ALLENTOWN: { city: 'Allentown', zip: '18101' },
  BETHLEHEM: { city: 'Bethlehem', zip: '18015' },
  CATASAUQUA: { city: 'Catasauqua', zip: '18032' },
  'CATASAUQUA BORO': { city: 'Catasauqua', zip: '18032' },
  COPLAY: { city: 'Coplay', zip: '18037' },
  'COPLAY BORO': { city: 'Coplay', zip: '18037' },
  EMMAUS: { city: 'Emmaus', zip: '18049' },
  'EMMAUS BORO': { city: 'Emmaus', zip: '18049' },
  'FOUNTAIN HILL': { city: 'Fountain Hill', zip: '18015' },
  'FOUNTAIN HILL BORO': { city: 'Fountain Hill', zip: '18015' },
  WHITEHALL: { city: 'Whitehall', zip: '18052' },
  'WHITEHALL TWP': { city: 'Whitehall', zip: '18052' },
  'SOUTH WHITEHALL': { city: 'Allentown', zip: '18104' },
  'SOUTH WHITEHALL TWP': { city: 'Allentown', zip: '18104' },
  'NORTH WHITEHALL': { city: 'Schnecksville', zip: '18078' },
  'NORTH WHITEHALL TWP': { city: 'Schnecksville', zip: '18078' },
  SLATINGTON: { city: 'Slatington', zip: '18080' },
  'SLATINGTON BORO': { city: 'Slatington', zip: '18080' },
  MACUNGIE: { city: 'Macungie', zip: '18062' },
  'MACUNGIE BORO': { city: 'Macungie', zip: '18062' },
  'LOWER MACUNGIE': { city: 'Macungie', zip: '18062' },
  'LOWER MACUNGIE TWP': { city: 'Macungie', zip: '18062' },
  'UPPER MACUNGIE': { city: 'Breinigsville', zip: '18031' },
  'UPPER MACUNGIE TWP': { city: 'Breinigsville', zip: '18031' },
  COOPERSBURG: { city: 'Coopersburg', zip: '18036' },
  'COOPERSBURG BORO': { city: 'Coopersburg', zip: '18036' },
  SALISBURY: { city: 'Allentown', zip: '18103' },
  'SALISBURY TWP': { city: 'Allentown', zip: '18103' },
  'UPPER SAUCON': { city: 'Center Valley', zip: '18034' },
  'UPPER SAUCON TWP': { city: 'Center Valley', zip: '18034' },
  SCHNECKSVILLE: { city: 'Schnecksville', zip: '18078' },
  ALBURTIS: { city: 'Alburtis', zip: '18011' },
  'ALBURTIS BORO': { city: 'Alburtis', zip: '18011' },
  HANOVER: { city: 'Bethlehem', zip: '18017' },
  'HANOVER TWP': { city: 'Bethlehem', zip: '18017' },
  HEIDELBERG: { city: 'Slatington', zip: '18080' },
  'HEIDELBERG TWP': { city: 'Slatington', zip: '18080' },
  LYNN: { city: 'New Tripoli', zip: '18066' },
  'LYNN TWP': { city: 'New Tripoli', zip: '18066' },
  LOWHILL: { city: 'New Tripoli', zip: '18066' },
  'LOWHILL TWP': { city: 'New Tripoli', zip: '18066' },
  WASHINGTON: { city: 'Slatington', zip: '18080' },
  'WASHINGTON TWP': { city: 'Slatington', zip: '18080' },
  WEISENBERG: { city: 'New Tripoli', zip: '18066' },
  'WEISENBERG TWP': { city: 'New Tripoli', zip: '18066' },
  'LOWER MILFORD': { city: 'Coopersburg', zip: '18036' },
  'LOWER MILFORD TWP': { city: 'Coopersburg', zip: '18036' },
  'UPPER MILFORD': { city: 'Macungie', zip: '18062' },
  'UPPER MILFORD TWP': { city: 'Macungie', zip: '18062' },
};

/**
 * Normalize verbose municipality names from the Upset Sale PDF.
 * "CITY OF ALLENTOWN" → "ALLENTOWN"
 * "BOROUGH OF CATASAUQUA" → "CATASAUQUA"
 * "LOWER MACUNGIE TOWNSHIP" → "LOWER MACUNGIE"
 * "HEIDELBERG TOWNSHIP" → "HEIDELBERG"
 */
function normalizeMunicipality(raw: string): string {
  return raw
    .replace(/^CITY OF\s+/i, '')
    .replace(/^BOROUGH OF\s+/i, '')
    .replace(/\s+TOWNSHIP$/i, '')
    .replace(/\s+BOROUGH$/i, '')
    .trim();
}

/**
 * Extract all text from a PDF buffer using pdfjs-dist directly.
 * Returns per-row items grouped by Y coordinate for structured parsing.
 */
async function extractPdfRows(buffer: Buffer): Promise<Array<{ y: number; items: Array<{ str: string; x: number }> }>> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;

  const allRows: Array<{ y: number; items: Array<{ str: string; x: number }> }> = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    // Group text items by Y coordinate (same row)
    const rowMap = new Map<number, Array<{ str: string; x: number }>>();
    for (const item of content.items as any[]) {
      const y = Math.round(item.transform[5]);
      const x = Math.round(item.transform[4]);
      if (!rowMap.has(y)) rowMap.set(y, []);
      rowMap.get(y)!.push({ str: item.str || '', x });
    }

    // Sort rows top-to-bottom (Y descending in PDF coordinate space)
    const sortedKeys = Array.from(rowMap.keys()).sort((a, b) => b - a);
    for (const y of sortedKeys) {
      const items = rowMap.get(y)!.sort((a, b) => a.x - b.x);
      allRows.push({ y, items });
    }
  }

  return allRows;
}

export class LehighUpsetSaleConnector implements DataSourceConnector {
  name = 'Lehigh County Upset Sale';
  slug = 'lehigh-upset-sale';
  type = 'upset_sale';
  regionSlug = 'lehigh-valley';
  sourceUrl = UPSET_SALE_PDF_URL;
  description =
    'Properties with 2+ years of unpaid taxes listed for upset sale by the Lehigh County Tax Claim Bureau. ~250 properties annually.';

  async fetchAndParse(): Promise<ParsedRecord[]> {
    const response = await fetch(UPSET_SALE_PDF_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'application/pdf,*/*',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Upset Sale PDF: ${response.status} ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const rows = await extractPdfRows(buffer);
    return this.parseUpsetSaleRows(rows);
  }

  private parseUpsetSaleRows(
    rows: Array<{ y: number; items: Array<{ str: string; x: number }> }>
  ): ParsedRecord[] {
    const records: ParsedRecord[] = [];

    for (const row of rows) {
      // Combine all text items for this row
      const texts = row.items.map((i) => i.str).filter(Boolean);
      const fullText = texts.join(' ').trim();

      // Look for sale number pattern: YY-NNNN (e.g., "25-0009")
      const saleMatch = fullText.match(/(\d{2}-\d{4})/);
      if (!saleMatch) continue;

      const saleNumber = saleMatch[1];

      // Skip header row
      if (fullText.includes('Sale number')) continue;

      // Extract parcel number: NN-NNNNNNNNNNNN-NNNNNNN
      const parcelMatch = fullText.match(/(\d{2}-\d{12,}-\d{7})/);
      const parcelNumber = parcelMatch ? parcelMatch[1] : '';

      // Extract municipality — text between sale number and parcel number
      let municipality = '';
      const afterSale = fullText.substring(fullText.indexOf(saleNumber) + saleNumber.length);
      if (parcelNumber) {
        const parcelIdx = afterSale.indexOf(parcelNumber);
        if (parcelIdx > 0) {
          municipality = afterSale.substring(0, parcelIdx).trim();
        }
      }

      // Normalize municipality: "CITY OF ALLENTOWN" → "ALLENTOWN"
      const normalizedMuni = normalizeMunicipality(municipality);

      // Extract upset price: look for "$ N,NNN.NN" pattern
      const priceMatch = fullText.match(/\$\s*([\d,]+\.\d{2})/);
      const upsetPrice = priceMatch ? `$${priceMatch[1]}` : '';

      // Extract results: text after the price (e.g., "no bid", "sold bidder #NNN; $NNN,NNN")
      let saleResult = '';
      if (priceMatch) {
        const afterPrice = fullText.substring(
          fullText.indexOf(priceMatch[0]) + priceMatch[0].length
        ).trim();
        saleResult = afterPrice;
      }

      // Extract owner and address from between parcel and price
      let ownerName = '';
      let address = '';
      if (parcelNumber && priceMatch) {
        const afterParcel = fullText.substring(
          fullText.indexOf(parcelNumber) + parcelNumber.length
        );
        const beforePrice = afterParcel.substring(
          0, afterParcel.indexOf(priceMatch[0])
        ).trim();

        // The owner comes first, then the address
        // Address patterns: starts with a number + street name
        const addrMatch = beforePrice.match(/(\d+[\d./]*\s+(?:[NSEW]\.?\s+)?(?:\w+\s+){0,4}(?:ST|AVE|RD|DR|CT|LN|BLVD|CIR|PL|TER|WAY|PIKE|HWY)\.?)/i);
        if (addrMatch) {
          const addrIdx = beforePrice.indexOf(addrMatch[1]);
          ownerName = beforePrice.substring(0, addrIdx).trim();
          address = addrMatch[1].trim();
        } else {
          // Might be a street name without a standard suffix (e.g., "ALBURTIS RD")
          // or just an owner with a simple address
          const parts = beforePrice.split(/\s{2,}/);
          if (parts.length >= 2) {
            ownerName = parts[0].trim();
            address = parts.slice(1).join(' ').trim();
          } else {
            ownerName = beforePrice;
          }
        }
      }

      // Get city info from municipality map
      const muniKey = normalizedMuni.toUpperCase();
      const cityInfo = MUNICIPALITY_MAP[muniKey] || { city: normalizedMuni || 'Unknown', zip: '' };

      // Derive sale year from sale number (e.g., "25-0009" → 2025)
      const yearPrefix = parseInt(saleNumber.substring(0, 2));
      const saleYear = yearPrefix > 50 ? 1900 + yearPrefix : 2000 + yearPrefix;
      // Use September of the sale year as approximate event date
      const eventDate = new Date(saleYear, 8, 1).toISOString(); // Month 8 = September

      // Title case the address
      const titleAddr = address
        .split(' ')
        .map((w: string) => {
          if (w.match(/^\d/)) return w;
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        })
        .join(' ');

      // Build value text
      const valueText = upsetPrice
        ? `Upset sale — ${upsetPrice} unpaid taxes`
        : 'Listed for upset tax sale — 2+ years of unpaid taxes';

      // Determine if the property sold or went no-bid
      const isSold = saleResult.toLowerCase().includes('sold');
      const isNoBid = saleResult.toLowerCase().includes('no bid');

      if (titleAddr || normalizedMuni) {
        records.push({
          address: titleAddr || `[${normalizedMuni}] Parcel ${parcelNumber}`,
          city: cityInfo.city,
          state: 'PA',
          zipCode: cityInfo.zip,
          county: 'Lehigh',
          ownerName: ownerName || undefined,
          parcelNumber: parcelNumber || undefined,
          signals: [
            {
              signalType: 'upset_sale',
              label: 'Upset Sale',
              category: 'distress',
              points: 25,
              value: isNoBid
                ? `${valueText} (no bid — advancing to Judicial Sale)`
                : isSold
                  ? `${valueText} (sold at auction)`
                  : valueText,
              source: 'Lehigh County Tax Claim Bureau',
              eventDate,
            },
          ],
          sourceUrl: UPSET_SALE_PDF_URL,
          rawData: {
            saleNumber,
            municipality,
            normalizedMunicipality: normalizedMuni,
            parcelNumber,
            ownerName,
            address,
            upsetPrice,
            saleResult,
            saleYear,
            source: 'Lehigh County Upset Sale PDF',
          },
        });
      }
    }

    console.log(`[Upset Sale] Parsed ${records.length} records from PDF`);
    return records;
  }
}
