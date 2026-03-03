import { DataSourceConnector, ParsedRecord } from '../../types';

// ============================================================
// LEHIGH COUNTY TAX CLAIM REPOSITORY CONNECTOR
// Source: lehighcountytaxclaim.com (PDF)
// Data: Properties unsold at Judicial Sale — deeply distressed,
//       years of unpaid taxes, available for low-bid purchase.
// Key Value: Enriches existing leads with "tax_delinquent" signal
//            AND adds brand new leads.
// ============================================================

const REPOSITORY_PDF_URL =
  'https://www.lehighcountytaxclaim.com/images/Repository_/Repository_List_as_of_6-26-25.pdf';

// Municipality to city name + default zip mapping
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
 * Extract all text from a PDF buffer using pdfjs-dist directly.
 * This avoids the pdf-parse wrapper which has worker issues in Next.js.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;

  const pageTexts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((item: any) => item.str || '');
    pageTexts.push(strings.join(' '));
  }

  return pageTexts.join('\n');
}

export class LehighRepositoryConnector implements DataSourceConnector {
  name = 'Lehigh County Tax Claim Repository';
  slug = 'lehigh-tax-repository';
  type = 'tax_delinquent';
  regionSlug = 'lehigh-valley';
  description =
    'Properties with years of unpaid taxes unsold at judicial sale. High-distress leads available for low-bid purchase.';

  async fetchAndParse(): Promise<ParsedRecord[]> {
    // Fetch the PDF
    const response = await fetch(REPOSITORY_PDF_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'application/pdf,*/*',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Repository PDF: ${response.status} ${response.statusText}`
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const text = await extractPdfText(buffer);

    return this.parseRepositoryText(text);
  }

  private parseRepositoryText(text: string): ParsedRecord[] {
    const records: ParsedRecord[] = [];
    const lines = text.split('\n').map((l: string) => l.trim()).filter(Boolean);

    // The PDF has a tabular structure:
    // PARCEL NUMBER | MUNICIPALITY | PROPERTY ADDRESS | OWNER NAME | DATE ADDED | CURRENT STATUS
    // We need to find rows with parcel numbers (format: XX-XXXXXXXXXXXX-XXXXXXX)

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // Look for parcel number pattern: ##-############ or ##-############-#######
      const parcelMatch = line.match(
        /(\d{2}-\d{12,}-\d{7})/
      );

      if (parcelMatch) {
        try {
          const parcelNumber = parcelMatch[1];

          // The data may be on the same line or spread across multiple lines
          // Try to collect: municipality, address, owner, date, status
          let municipality = '';
          let address = '';
          let ownerName = '';
          let dateAdded = '';
          let status = '';

          // Look at the text after the parcel number on this line
          let remaining = line.substring(line.indexOf(parcelNumber) + parcelNumber.length).trim();

          // Also collect next few lines that aren't parcel numbers
          const extraLines: string[] = [];
          let j = i + 1;
          while (j < lines.length && j < i + 6) {
            const nextLine = lines[j];
            if (nextLine.match(/\d{2}-\d{12,}/)) break; // Next parcel
            if (nextLine.match(/^PARCEL|^LEHIGH COUNTY|^Revised|^Page/i)) {
              j++;
              continue;
            }
            extraLines.push(nextLine);
            j++;
          }

          // Combine all text for this record
          const allText = [remaining, ...extraLines].join(' ').trim();

          // Try to find municipality from known list
          for (const [muni] of Object.entries(MUNICIPALITY_MAP)) {
            const muniRegex = new RegExp(`\\b${muni.replace(/\s+/g, '\\s+')}\\b`, 'i');
            if (muniRegex.test(allText)) {
              municipality = muni;
              break;
            }
          }

          // If no municipality found, check the first extra line
          if (!municipality && extraLines.length > 0) {
            const firstExtra = extraLines[0].toUpperCase();
            for (const [muni] of Object.entries(MUNICIPALITY_MAP)) {
              if (firstExtra.includes(muni)) {
                municipality = muni;
                break;
              }
            }
          }

          // Try to extract address - look for street patterns
          const streetPatterns = /(\d+\s+(?:[NSEW]\.?\s+)?(?:\w+\s+){0,3}(?:ST|AVE|RD|DR|CT|LN|BLVD|CIR|PL|TER|WAY|PIKE|HWY)\.?)/i;
          const addrMatch = allText.match(streetPatterns);
          if (addrMatch) {
            address = addrMatch[1].trim();
          } else {
            // Try simpler: look for text between municipality and owner keywords
            const textAfterMuni = municipality
              ? allText.substring(allText.toUpperCase().indexOf(municipality) + municipality.length).trim()
              : allText;
            // Take the first chunk that looks like an address
            const simpleAddr = textAfterMuni.match(/^([^,]+?\s+(?:St|Ave|Rd|Dr|Ct|Ln|Blvd|Cir)\.?)/i);
            if (simpleAddr) address = simpleAddr[1].trim();
          }

          // Owner name: look for "Lehigh County Tax Claim" pattern or text after address
          if (allText.includes('Lehigh County Tax Claim')) {
            ownerName = 'Lehigh County Tax Claim (Repository)';
          } else {
            // Try to find owner - usually after the address and municipality
            const ownerPatterns = /(?:Repository|Status)\s*(.+?)(?:\d{1,2}\/\d{1,2}\/\d{2,4}|$)/i;
            const ownerMatch = allText.match(ownerPatterns);
            if (ownerMatch) {
              ownerName = ownerMatch[1].trim();
            }
          }

          // Date added
          const dateMatch = allText.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})/);
          if (dateMatch) dateAdded = dateMatch[1];

          // Skip records without an address (vacant lots, etc. are still valuable but need address)
          // Use the raw text as address if we couldn't parse one
          if (!address && remaining) {
            // Just use whatever text we have
            address = remaining.split(/\s{2,}/)[0] || '';
          }

          // Get city info from municipality
          const muniKey = municipality.toUpperCase();
          const cityInfo = MUNICIPALITY_MAP[muniKey] || { city: municipality || 'Unknown', zip: '' };

          if (address || municipality) {
            // Title case the address
            const titleAddr = address
              .split(' ')
              .map((w: string) => {
                if (w.match(/^\d/)) return w;
                return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
              })
              .join(' ');

            records.push({
              address: titleAddr || `[${municipality}] Parcel ${parcelNumber}`,
              city: cityInfo.city,
              state: 'PA',
              zipCode: cityInfo.zip,
              county: 'Lehigh',
              ownerName:
                ownerName !== 'Lehigh County Tax Claim (Repository)'
                  ? ownerName
                  : undefined,
              parcelNumber: parcelNumber,
              signals: [
                {
                  signalType: 'tax_delinquent',
                  label: 'Tax Delinquent (Repository)',
                  category: 'automated',
                  points: 18,
                  value: dateAdded
                    ? `In repository since ${dateAdded}`
                    : 'In tax claim repository — years of unpaid taxes',
                  source: 'Lehigh County Tax Claim Bureau',
                },
              ],
              rawData: {
                parcelNumber,
                municipality,
                address,
                ownerName,
                dateAdded,
                status,
                source: 'Lehigh County Tax Claim Repository PDF',
              },
            });
          }

          i = j; // Skip to next parcel
          continue;
        } catch (err) {
          console.error('Error parsing repository entry:', err);
        }
      }
      i++;
    }

    return records;
  }
}
