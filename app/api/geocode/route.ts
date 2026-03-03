import { NextRequest, NextResponse } from 'next/server';
import { getApiKey } from '@/lib/api-keys';

// GET /api/geocode?address=123+Main+St,+Allentown,+PA+18101
// Geocodes a full address → returns lat/lng coordinates.
// Uses Geoapify (same provider as autocomplete) — keeps API key server-side.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json({ error: 'Missing address parameter' }, { status: 400 });
    }

    const apiKey = await getApiKey('geoapify');
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Geoapify API key not configured' },
        { status: 503 },
      );
    }

    const url = `https://api.geoapify.com/v1/geocode/search?text=${encodeURIComponent(address)}&format=json&filter=countrycode:us&limit=1&apiKey=${apiKey}`;

    const res = await fetch(url);

    if (!res.ok) {
      console.error('Geoapify geocode error:', res.status);
      return NextResponse.json({ error: 'Geocoding service error' }, { status: 502 });
    }

    const data = await res.json();
    const result = data.results?.[0];

    if (!result || result.lat == null || result.lon == null) {
      return NextResponse.json({ lat: null, lng: null });
    }

    return NextResponse.json({
      lat: result.lat,
      lng: result.lon,
    });
  } catch (error: any) {
    console.error('Geocode error:', error);
    return NextResponse.json({ error: 'Geocoding service unavailable' }, { status: 500 });
  }
}
