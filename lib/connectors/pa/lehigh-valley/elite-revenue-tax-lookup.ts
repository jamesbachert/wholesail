import { LookupConnector, TaxDelinquentLookupResult } from '../../lookup-types';

// ============================================================
// LEHIGH COUNTY TAX DELINQUENT LOOKUP (Elite Revenue Solutions)
// Source: eliterevenue.rba.com/taxes/lehigh/
// Data: Real-time delinquent tax data for all Lehigh County parcels.
//       Shows dollar amounts owed, years delinquent, penalties,
//       and interest. Updated daily (close of previous working day).
// Coverage: All Lehigh County zip codes
// ============================================================

const BASE_URL = 'https://eliterevenue.rba.com/taxes/lehigh';

// All Lehigh County zip codes (same list as coverage-registry.ts)
const LEHIGH_COUNTY_ZIPS = [
  '18011', '18015', '18017', '18018', '18031', '18032', '18034',
  '18036', '18037', '18041', '18046', '18049', '18051', '18052',
  '18053', '18058', '18059', '18062', '18065', '18066', '18069',
  '18078', '18079', '18080', '18087', '18092',
  '18101', '18102', '18103', '18104', '18106', '18109',
];

/** Small delay between requests to be respectful to the server */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class LehighEliteRevenueTaxConnector implements LookupConnector {
  name = 'Lehigh County Tax Delinquent Lookup';
  slug = 'lehigh-elite-revenue-tax';
  type = 'tax_delinquent' as const;
  regionSlug = 'lehigh-valley';
  description =
    'Real-time delinquent tax lookup via Elite Revenue Solutions for all Lehigh County parcels.';
  supportedZipCodes = LEHIGH_COUNTY_ZIPS;

  /**
   * Look up delinquent taxes by street address.
   * Searches Elite Revenue by street, then fetches detail for matching parcels.
   */
  async lookupByAddress(
    address: string,
    zipCode: string
  ): Promise<TaxDelinquentLookupResult> {
    const parsed = this.parseAddress(address);
    if (!parsed) {
      return {
        found: false,
        rawData: { error: 'Could not parse address', address },
      };
    }

    // Build search query: "720 N FOUNTAIN" → "720 N FOUNTAIN"
    // Elite Revenue searches all of Lehigh County by street
    const streetQuery = `${parsed.streetNumber} ${parsed.streetRest}`.trim();
    console.log(
      `[Elite Revenue] Searching by address: "${streetQuery}" (zip: ${zipCode})`
    );

    try {
      const searchResults = await this.searchByStreet(streetQuery);

      if (searchResults.length === 0) {
        console.log(`[Elite Revenue] No delinquent records found for: ${address}`);
        return { found: false, rawData: { query: streetQuery, address } };
      }

      // Pick the best match — prefer matching address text
      const normalizedAddr = address.toUpperCase().replace(/[^A-Z0-9\s]/g, '').trim();
      const bestMatch =
        searchResults.find((r) =>
          normalizedAddr.includes(r.address.replace(/[^A-Z0-9\s]/g, '').trim())
        ) ||
        searchResults.find((r) =>
          r.address.replace(/[^A-Z0-9\s]/g, '').trim().includes(
            parsed.streetNumber + ' ' + parsed.streetRest.toUpperCase()
          )
        ) ||
        searchResults[0]; // fallback to first result

      // Fetch detail page for the matched parcel
      await sleep(200);
      return await this.fetchDelinquentDetail(bestMatch.parcel.trim());
    } catch (err: any) {
      console.error(`[Elite Revenue] Error searching by address:`, err.message);
      return {
        found: false,
        rawData: { error: err.message, query: streetQuery },
      };
    }
  }

  /**
   * Look up delinquent taxes directly by parcel number.
   * More reliable than address search — use when parcel is known.
   */
  async lookupByParcel(
    parcelNumber: string
  ): Promise<TaxDelinquentLookupResult> {
    console.log(`[Elite Revenue] Looking up by parcel: ${parcelNumber}`);
    return await this.fetchDelinquentDetail(parcelNumber);
  }

  // ============================================================
  // PRIVATE — Search & Parse
  // ============================================================

  /**
   * Search Elite Revenue by street address.
   * Returns matching parcels with owner names and addresses.
   * NOTE: Only returns properties that HAVE delinquent taxes.
   */
  private async searchByStreet(
    streetQuery: string
  ): Promise<Array<{ parcel: string; owner: string; address: string; location: string }>> {
    const url = `${BASE_URL}/trirsp1.asp?street=${encodeURIComponent(streetQuery)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'text/html',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Elite Revenue search failed: ${response.status} ${response.statusText}`
      );
    }

    const html = await response.text();

    // Check for "no results" indicator
    if (html.includes('There is no information to display')) {
      return [];
    }

    return this.parseSearchResults(html);
  }

  /**
   * Parse the search results HTML table.
   * Each row has: Parcel Number (link), Owner's Name, Address, Location
   *
   * HTML structure:
   *   <A href="trirsp2ppwcurr.asp?parcel=XX%2DNNNN...%2DNNNN...++&currentlist=N&">
   *     02-549783356884-0000001  </a>
   *   <TD Class="TableContent"> OWNER NAME </TD>
   *   <TD Class="TableContent"> ADDRESS </TD>
   *   <TD Class="TableContent"> LOCATION </TD>
   */
  private parseSearchResults(
    html: string
  ): Array<{ parcel: string; owner: string; address: string; location: string }> {
    const results: Array<{
      parcel: string;
      owner: string;
      address: string;
      location: string;
    }> = [];

    // Match each result row: the parcel link followed by 3 TDs
    // HTML structure per result (note the commented-out duplicate link):
    //   <A href="trirsp2ppwcurr.asp?parcel=XX&currentlist=N&">
    //   <!--  <A href="trirsp2ppwcurr.asp?parcel=XX&"> -->
    //      02-549783356884-0000001  </a>
    // We match the active link (contains "currentlist") and allow
    // the HTML comment between the opening tag and the parcel text.
    const rowRegex =
      /<A\s+href="trirsp2ppwcurr\.asp\?parcel=[^"]*currentlist=[^"]*"[^>]*>[\s\S]*?(\d{2}-\d{12,}-\d{7})\s*<\/a>/gi;

    let match;
    while ((match = rowRegex.exec(html)) !== null) {
      const parcel = match[1].trim();
      const afterLink = html.substring(match.index + match[0].length);

      // Extract the next 3 <TD Class="TableContent"> values
      const tdRegex =
        /<TD\s+Class="TableContent">\s*([\s\S]*?)\s*<\/TD>/gi;
      const tds: string[] = [];
      let tdMatch;
      let searchFrom = afterLink;
      for (let i = 0; i < 3; i++) {
        tdMatch = tdRegex.exec(searchFrom);
        if (tdMatch) {
          tds.push(tdMatch[1].trim());
        }
      }

      results.push({
        parcel,
        owner: tds[0] || '',
        address: tds[1] || '',
        location: tds[2] || '',
      });
    }

    return results;
  }

  /**
   * Fetch the detail page for a specific parcel and parse delinquent tax data.
   *
   * Detail page URL: trirsp2ppwcurr.asp?parcel=XX-NNNNNNNNNNNN-NNNNNNN&currentlist=0
   *
   * Returns owner info, assessed value, and delinquent tax breakdown.
   */
  private async fetchDelinquentDetail(
    parcelNumber: string
  ): Promise<TaxDelinquentLookupResult> {
    const url = `${BASE_URL}/trirsp2ppwcurr.asp?parcel=${encodeURIComponent(parcelNumber)}&currentlist=0`;
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept: 'text/html',
      },
    });

    if (!response.ok) {
      throw new Error(
        `Elite Revenue detail fetch failed: ${response.status} ${response.statusText}`
      );
    }

    const html = await response.text();
    return this.parseDetailPage(html, parcelNumber);
  }

  /**
   * Parse the detail page HTML for owner info and delinquent tax data.
   *
   * Key HTML patterns:
   *   NAME:     <TD><b> NAME: </b></TD><td>OWNER NAME</td>
   *   ADDRESS:  <TD><b> ADDRESS: </b></TD><td>720 N FOUNTAIN ST</td>
   *   DISTRICT: <td><b> DISTRICT: </b></td><td>02 (CITY OF ALLENTOWN)</td>
   *   ASSESSED: <TD valign=top><b> ASSESSED VALUE:</b></td><td>3,100</td>
   *
   *   Year rows: <TD><b>2025</b></TD><TD align="right"><b>$144.20</b></TD>
   *   Year totals: <b>2025 Total:</b> ... <b>144.20</b> (last <b> in the row is Balance)
   *   Grand total: Total Due as of ... <b>1,127.76</b>
   */
  private parseDetailPage(
    html: string,
    parcelNumber: string
  ): TaxDelinquentLookupResult {
    // Check if the page has delinquent taxes at all
    if (!html.includes('Delinquent Taxes Due')) {
      console.log(`[Elite Revenue] No delinquent taxes for parcel: ${parcelNumber}`);
      return {
        found: false,
        parcelNumber,
        rawData: { parcelNumber, status: 'current' },
      };
    }

    // Extract owner name
    const nameMatch = html.match(
      /<b>\s*NAME:\s*<\/b>\s*<\/TD>\s*<td>([\s\S]*?)<\/td>/i
    );
    const ownerName = nameMatch ? nameMatch[1].trim() : undefined;

    // Extract address (bill_adr1 comment marks it)
    const addrMatch = html.match(
      /<!-- bill_adr1 -->([\s\S]*?)<\/td>/i
    );
    const propertyAddress = addrMatch ? addrMatch[1].trim() : undefined;

    // Extract district
    const districtMatch = html.match(
      /<b>\s*DISTRICT:\s*<\/b>\s*<\/td>\s*<td>([\s\S]*?)<\/TD>/i
    );
    const district = districtMatch ? districtMatch[1].trim() : undefined;

    // Extract assessed value
    const assessedMatch = html.match(
      /<b>\s*ASSESSED VALUE:\s*<\/b>\s*<\/td>\s*<td>\s*([\d,]+)\s*<\/TD>/i
    );
    const assessedValue = assessedMatch
      ? parseInt(assessedMatch[1].replace(/,/g, ''))
      : undefined;

    // Extract delinquent year summary rows
    // Pattern: <TD><b>YYYY</b></TD>\n<TD align="right"><b>$NNN.NN</b></TD>
    const yearSummaryRegex =
      /<TD><b>(\d{4})<\/b><\/TD>\s*<TD\s+align="right"><b>\$([\d,]+\.\d{2})<\/b><\/TD>/gi;
    const delinquentYears: Array<{ year: number; balance: number }> = [];
    let yearMatch;
    while ((yearMatch = yearSummaryRegex.exec(html)) !== null) {
      delinquentYears.push({
        year: parseInt(yearMatch[1]),
        balance: parseFloat(yearMatch[2].replace(/,/g, '')),
      });
    }

    // Extract grand total
    // Pattern: Total Due as of ... <b>N,NNN.NN</b>
    const totalMatch = html.match(
      /Total Due as of[\s\S]*?<td\s+align="right">\s*<b>([\d,]+\.\d{2})<\/b>/i
    );
    const totalDelinquent = totalMatch
      ? parseFloat(totalMatch[1].replace(/,/g, ''))
      : delinquentYears.reduce((sum, y) => sum + y.balance, 0);

    console.log(
      `[Elite Revenue] Found delinquent taxes for ${parcelNumber}: $${totalDelinquent.toFixed(2)} (${delinquentYears.map((y) => y.year).join(', ')})`
    );

    return {
      found: true,
      parcelNumber: parcelNumber.trim(),
      ownerName,
      propertyAddress,
      district,
      assessedValue,
      totalDelinquent,
      delinquentYears: delinquentYears.sort((a, b) => a.year - b.year),
      rawData: {
        parcelNumber,
        ownerName,
        propertyAddress,
        district,
        assessedValue,
        totalDelinquent,
        delinquentYears,
        source: 'Elite Revenue Solutions — Lehigh County Tax Claim Bureau',
      },
    };
  }

  // ============================================================
  // PRIVATE — Address Parsing
  // ============================================================

  /**
   * Parse an address into street number and remaining street text.
   * "720 N Fountain St" → { streetNumber: "720", streetRest: "N FOUNTAIN" }
   * We keep direction prefixes for Elite Revenue search accuracy.
   */
  private parseAddress(
    address: string
  ): { streetNumber: string; streetRest: string } | null {
    const trimmed = address.trim();
    const match = trimmed.match(/^(\d+)\s+(.+)$/);
    if (!match) return null;

    const streetNumber = match[1];
    let streetRest = match[2].toUpperCase();

    // Remove unit/apt suffixes
    streetRest = streetRest
      .replace(/\s+(APT|UNIT|STE|SUITE|#)\s*\S*$/i, '')
      .trim();

    // Remove trailing street type for broader matching
    const streetTypes = [
      'ST', 'STREET', 'AVE', 'AVENUE', 'RD', 'ROAD', 'DR', 'DRIVE',
      'CT', 'COURT', 'LN', 'LANE', 'BLVD', 'BOULEVARD', 'CIR', 'CIRCLE',
      'PL', 'PLACE', 'WAY', 'TER', 'TERRACE', 'PIKE', 'HWY',
    ];
    const parts = streetRest.split(/\s+/);
    if (
      parts.length > 1 &&
      streetTypes.includes(parts[parts.length - 1])
    ) {
      parts.pop();
    }

    streetRest = parts.join(' ');
    if (!streetRest) return null;

    return { streetNumber, streetRest };
  }
}
