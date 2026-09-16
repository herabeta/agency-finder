import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.types',
  'places.rating',
  'places.userRatingCount',
].join(',');

function clean(v: unknown) {
  return String(v ?? '').replace(/\s+/g, ' ').trim();
}

function categoryFromTypes(types: string[] = [], query = '') {
  const text = `${types.join(' ')} ${query}`.toLowerCase();
  if (text.includes('visa')) return /consult|consultancy/.test(text) ? 'Visa Consultant' : 'Visa Centre';
  if (text.includes('embassy')) return 'Embassy';
  if (text.includes('high commission')) return 'High Commission';
  return 'Travel Agency';
}

export async function GET(request: Request) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Google Places is not configured. Add GOOGLE_PLACES_API_KEY to the Vercel environment.' },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = clean(searchParams.get('q') || 'travel agencies in Abuja, Nigeria');
  const pageSize = Math.min(20, Math.max(1, Number(searchParams.get('limit') || 20)));

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify({
        textQuery: query,
        pageSize,
        languageCode: 'en',
        regionCode: 'NG',
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        { error: clean(body?.error?.message) || 'Google Places request failed.' },
        { status: response.status >= 400 && response.status < 600 ? response.status : 502 },
      );
    }

    const places = Array.isArray(body?.places) ? body.places : [];
    const leads = places.map((place: any) => ({
      id: `google-${clean(place.id)}`,
      name: clean(place.displayName?.text),
      city: 'Abuja',
      state: 'Federal Capital Territory',
      address: clean(place.formattedAddress) || undefined,
      phone: clean(place.internationalPhoneNumber || place.nationalPhoneNumber) || undefined,
      website: clean(place.websiteUri) || undefined,
      rating: typeof place.rating === 'number' ? place.rating : undefined,
      reviews: typeof place.userRatingCount === 'number' ? place.userRatingCount : undefined,
      services: [categoryFromTypes(place.types, query)],
      source: 'Google Places API',
      verification: 'GOOGLE PLACES LIVE',
      sourceUrl: place.id ? `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(place.id)}` : undefined,
    })).filter((x: any) => x.name);

    return NextResponse.json({ source: 'Google Places API (New) · live search', query, count: leads.length, leads });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Google Places request failed.' },
      { status: 502 },
    );
  }
}
