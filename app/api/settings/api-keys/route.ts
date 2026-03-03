import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyStatuses, setApiKey, deleteApiKey } from '@/lib/api-keys';

// GET /api/settings/api-keys — list all configured keys (masked)
export async function GET() {
  try {
    const keys = await getApiKeyStatuses();
    return NextResponse.json({ keys });
  } catch (error: any) {
    console.error('API keys GET error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/settings/api-keys — save or update an API key
export async function POST(request: NextRequest) {
  try {
    const { provider, value } = await request.json();

    if (!provider || typeof provider !== 'string') {
      return NextResponse.json({ error: 'provider is required' }, { status: 400 });
    }
    if (!value || typeof value !== 'string') {
      return NextResponse.json({ error: 'value is required' }, { status: 400 });
    }

    // Only allow known providers
    const ALLOWED_PROVIDERS = ['geoapify'];
    if (!ALLOWED_PROVIDERS.includes(provider)) {
      return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 });
    }

    await setApiKey(provider, value.trim());

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API keys POST error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/settings/api-keys — remove an API key
export async function DELETE(request: NextRequest) {
  try {
    const { provider } = await request.json();

    if (!provider || typeof provider !== 'string') {
      return NextResponse.json({ error: 'provider is required' }, { status: 400 });
    }

    await deleteApiKey(provider);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API keys DELETE error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
