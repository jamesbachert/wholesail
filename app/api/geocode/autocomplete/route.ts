import { NextRequest, NextResponse } from 'next/server';
import { getApiKey } from '@/lib/api-keys';

// State name → abbreviation mapping for Geoapify results
const STATE_ABBR: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
};

function toStateAbbr(stateCode: string | undefined): string {
  if (!stateCode) return '';
  // Already an abbreviation (2 chars)?
  if (stateCode.length === 2) return stateCode.toUpperCase();
  return STATE_ABBR[stateCode] || stateCode;
}

// GET /api/geocode/autocomplete?q=2122+W+Liberty
// Server-side proxy for Geoapify — keeps the API key secret.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q');

    if (!q || q.length < 3) {
      return NextResponse.json({ suggestions: [] });
    }

    const apiKey = await getApiKey('geoapify');
    if (!apiKey) {
      return NextResponse.json({
        suggestions: [],
        error: 'Geoapify API key not configured. Add one in Settings → API Keys.',
      });
    }

    const url = `https://api.geoapify.com/v1/geocode/autocomplete?text=${encodeURIComponent(q)}&format=json&filter=countrycode:us&limit=5&apiKey=${apiKey}`;

    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      console.error('Geoapify error:', res.status, text);
      return NextResponse.json({
        suggestions: [],
        error: res.status === 401 ? 'Invalid Geoapify API key' : 'Geocoding service error',
      });
    }

    const data = await res.json();

    const suggestions = (data.results || [])
      .filter((r: any) => r.housenumber && r.street)
      .map((r: any) => {
        const street = `${r.housenumber} ${r.street}`;
        const stateAbbr = toStateAbbr(r.state_code || r.state);
        const zip = r.postcode || '';
        const city = r.city || r.town || r.village || r.county || '';

        return {
          display: `${street}, ${city}, ${stateAbbr} ${zip}`.trim(),
          street,
          city,
          state: stateAbbr,
          zip: zip.substring(0, 5),
        };
      });

    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error('Autocomplete proxy error:', error);
    return NextResponse.json({ suggestions: [], error: 'Autocomplete service unavailable' });
  }
}
