import { DataSourceConnector, ParsedRecord } from './types';

// ============================================================
// LEHIGH COUNTY SHERIFF SALES CONNECTOR
// Source: CivilView (salesweb.civilview.com)
// Data: Foreclosure sale listings with address, defendant,
//       plaintiff, sale date, parcel #, case #
// ============================================================

const CIVILVIEW_URL =
  'https://salesweb.civilview.com/Sales/SalesSearch?countyId=51';

// Known Lehigh County cities and their zip codes for matching
const LEHIGH_CITY_ZIPS: Record<string, string> = {
  ALLENTOWN: '18101',
  BETHLEHEM: '18015',
  WHITEHALL: '18052',
  CATASAUQUA: '18032',
  COPLAY: '18037',
  EMMAUS: '18049',
  MACUNGIE: '18062',
  BREINIGSVILLE: '18031',
  COOPERSBURG: '18036',
  SLATINGTON: '18080',
  SCHNECKSVILLE: '18078',
  'FOUNTAIN HILL': '18015',
  OREFIELD: '18069',
  'NEW TRIPOLI': '18066',
  ALBURTIS: '18011',
  GERMANSVILLE: '18058',
  'EAST GREENVILLE': '18041',
};

export class LehighSheriffSalesConnector implements DataSourceConnector {
  name = 'Lehigh County Sheriff Sales';
  slug = 'lehigh-sheriff-sales';
  type = 'sheriff_sale';
  regionSlug = 'lehigh-valley';
  description =
    'Foreclosure properties scheduled for sheriff sale in Lehigh County via CivilView.';

  async fetchAndParse(): Promise<ParsedRecord[]> {
    // Fetch the main listing page
    const response = await fetch(CIVILVIEW_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch CivilView: ${response.status} ${response.statusText}`
      );
    }

    const html = await response.text();
    return this.parseListingPage(html);
  }

  private parseListingPage(html: string): ParsedRecord[] {
    const records: ParsedRecord[] = [];

    // Parse table rows from the HTML
    // Each row has: Details link | Sheriff # | Sales Date | Plaintiff | Defendant | Address | Attorney | Parcel # | Court Case #
    const rowRegex =
      /<tr[^>]*>\s*<td[^>]*>\s*<a[^>]*href="([^"]*)"[^>]*>View Details<\/a>\s*<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<td[^>]*>([^<]*)<\/td>\s*<\/tr>/gi;

    let match;
    while ((match = rowRegex.exec(html)) !== null) {
      try {
        const [
          ,
          detailsUrl,
          sheriffNum,
          salesDate,
          plaintiff,
          defendant,
          rawAddress,
          attorney,
          parcelNum,
          caseNum,
        ] = match;

        const parsed = this.parseAddress(this.cleanHtml(rawAddress));
        if (!parsed) continue;

        const cleanDefendant = this.cleanHtml(defendant);
        const cleanPlaintiff = this.cleanHtml(plaintiff);
        const cleanAttorney = this.cleanHtml(attorney);
        const cleanSaleDate = this.cleanHtml(salesDate).trim();
        const cleanSheriffNum = this.cleanHtml(sheriffNum).trim();
        const cleanParcel = this.cleanHtml(parcelNum).trim();
        const cleanCase = this.cleanHtml(caseNum).trim();

        records.push({
          address: parsed.address,
          city: parsed.city,
          state: 'PA',
          zipCode: parsed.zipCode,
          county: 'Lehigh',
          ownerName: this.cleanDefendantName(cleanDefendant),
          parcelNumber: cleanParcel,
          caseNumber: cleanCase,
          saleDate: cleanSaleDate,
          plaintiff: cleanPlaintiff,
          attorney: cleanAttorney,
          sourceUrl: detailsUrl
            ? `https://salesweb.civilview.com${detailsUrl}`
            : undefined,
          signals: [
            {
              signalType: 'pre_foreclosure',
              label: 'Pre-Foreclosure',
              category: 'automated',
              points: 20,
              value: `Sheriff sale scheduled ${cleanSaleDate}`,
              source: 'Lehigh County Sheriff / CivilView',
            },
          ],
          rawData: {
            sheriffNumber: cleanSheriffNum,
            salesDate: cleanSaleDate,
            plaintiff: cleanPlaintiff,
            defendant: cleanDefendant,
            address: this.cleanHtml(rawAddress),
            attorney: cleanAttorney,
            parcelNumber: cleanParcel,
            caseNumber: cleanCase,
            detailsUrl,
          },
        });
      } catch (err) {
        // Skip unparseable rows
        console.error('Error parsing row:', err);
      }
    }

    // If regex approach didn't work (HTML structure might vary), try simpler parsing
    if (records.length === 0) {
      return this.fallbackParse(html);
    }

    return records;
  }

  // Fallback parser using simpler text splitting
  private fallbackParse(html: string): ParsedRecord[] {
    const records: ParsedRecord[] = [];

    // Find all "View Details" links and their surrounding row data
    const detailsRegex = /href="(\/Sales\/SaleDetails\?PropertyId=\d+)"/g;
    const detailMatches = [...html.matchAll(detailsRegex)];

    // Extract all table cell contents
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    const allCells = [...html.matchAll(cellRegex)].map((m) =>
      this.cleanHtml(m[1]).trim()
    );

    // Each row has 9 cells (including the details link cell)
    // Find "View Details" text positions and work from there
    for (let i = 0; i < allCells.length; i++) {
      if (allCells[i].includes('View Details') && i + 8 < allCells.length) {
        try {
          const sheriffNum = allCells[i + 1];
          const salesDate = allCells[i + 2];
          const plaintiff = allCells[i + 3];
          const defendant = allCells[i + 4];
          const rawAddress = allCells[i + 5];
          const attorney = allCells[i + 6];
          const parcelNum = allCells[i + 7];
          const caseNum = allCells[i + 8];

          const parsed = this.parseAddress(rawAddress);
          if (!parsed) continue;

          // Find the matching details URL
          const detailMatch = detailMatches.find((m) => {
            const mIndex = html.indexOf(m[0]);
            const cellIndex = html.indexOf(allCells[i + 1], Math.max(mIndex - 500, 0));
            return cellIndex > 0 && cellIndex - mIndex < 1000;
          });

          const detailsUrl = detailMatch ? detailMatch[1] : undefined;

          records.push({
            address: parsed.address,
            city: parsed.city,
            state: 'PA',
            zipCode: parsed.zipCode,
            county: 'Lehigh',
            ownerName: this.cleanDefendantName(defendant),
            parcelNumber: parcelNum,
            caseNumber: caseNum,
            saleDate: salesDate,
            plaintiff: plaintiff,
            attorney: attorney,
            sourceUrl: detailsUrl
              ? `https://salesweb.civilview.com${detailsUrl}`
              : undefined,
            signals: [
              {
                signalType: 'pre_foreclosure',
                label: 'Pre-Foreclosure',
                category: 'automated',
                points: 20,
                value: `Sheriff sale scheduled ${salesDate}`,
                source: 'Lehigh County Sheriff / CivilView',
              },
            ],
            rawData: {
              sheriffNumber: sheriffNum,
              salesDate,
              plaintiff,
              defendant,
              address: rawAddress,
              attorney,
              parcelNumber: parcelNum,
              caseNumber: caseNum,
              detailsUrl,
            },
          });
        } catch (err) {
          console.error('Fallback parse error:', err);
        }
      }
    }

    return records;
  }

  private parseAddress(
    raw: string
  ): { address: string; city: string; zipCode: string } | null {
    if (!raw || raw.length < 5) return null;

    // Format is typically: "809-813 EAST HAMILTON ST ALLENTOWN PA 18109"
    // or: "3917 BUCHANAN ST COPLAY PA 18037"
    const cleaned = raw.replace(/\s+/g, ' ').trim();

    // Try to extract zip code
    const zipMatch = cleaned.match(/(\d{5})(?:\s*-?\s*\d{4})?$/);
    let zipCode = zipMatch ? zipMatch[1] : '';

    // Try to extract city and state
    // Remove zip and "PA" from end
    let withoutZip = cleaned
      .replace(/\s*\d{5}(?:\s*-?\s*\d{4})?\s*$/, '')
      .trim();
    withoutZip = withoutZip.replace(/\s+PA\s*$/i, '').trim();

    // Find city by matching against known cities (work backwards from the string)
    let city = '';
    let address = withoutZip;

    for (const knownCity of Object.keys(LEHIGH_CITY_ZIPS)) {
      if (withoutZip.toUpperCase().endsWith(knownCity)) {
        city = knownCity;
        address = withoutZip.slice(0, -knownCity.length).trim();

        // Use city's default zip if we didn't find one
        if (!zipCode) {
          zipCode = LEHIGH_CITY_ZIPS[knownCity];
        }
        break;
      }
    }

    if (!city || !address) return null;

    // Title case the city
    city = city
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');

    // Title case the address
    address = address
      .split(' ')
      .map((w) => {
        if (['ST', 'AVE', 'RD', 'DR', 'CT', 'LN', 'BLVD', 'CIR', 'PL', 'TER', 'WAY'].includes(w.toUpperCase())) {
          return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
        }
        if (w.match(/^\d/)) return w; // Keep numbers as-is
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(' ');

    return { address, city, zipCode };
  }

  private cleanDefendantName(defendant: string): string {
    // Remove legal suffixes like "a/k/a", "KNOWN HEIR OF", etc.
    let name = defendant
      .replace(/,?\s*a\/k\/a\s*.*/i, '')
      .replace(/,?\s*KNOWN HEIR OF\s*.*/i, '')
      .replace(/,?\s*SOLELY IN (?:HIS|HER) CAPACITY.*/i, '')
      .replace(/;\s*ET\s*AL\.?/i, '')
      .replace(/;\s*$/,'')
      .trim();

    // Title case
    name = name
      .split(/\s+/)
      .map((w) => {
        if (w.length <= 2 && !w.match(/^[A-Z]\.$/)) return w;
        return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
      })
      .join(' ');

    return name;
  }

  private cleanHtml(html: string): string {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
}
