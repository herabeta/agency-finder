import { NextResponse } from 'next/server';

export const revalidate = 86400;

const SOURCE = 'OpenStreetMap · Overpass API';
const OVERPASS = 'https://overpass-api.de/api/interpreter';

function clean(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function escapeOverpass(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function stateFromTags(tags: Record<string, string>) {
  return clean(tags['addr:state'] || tags['is_in:state'] || 'Nigeria');
}

function cityFromTags(tags: Record<string, string>) {
  return clean(tags['addr:city'] || tags['addr:town'] || tags['addr:municipality'] || tags['is_in:city'] || '');
}

function buildQuery() {
  return `[out:json][timeout:120];area["ISO3166-1"="NG"][admin_level=2]->.ng;(nwr["tourism"="travel_agency"](area.ng);nwr["shop"="travel_agency"](area.ng);nwr["office"="travel_agency"](area.ng);nwr["amenity"="travel_agency"](area.ng););out center tags;`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(4000, Math.max(100, Number(searchParams.get('limit') || 1600)));
  try {
    const res = await fetch(OVERPASS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'AgencyFinder/1.0 public OSM indexer' },
      body: `data=${encodeURIComponent(buildQuery())}`,
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      return NextResponse.json({ source: SOURCE, count: 0, error: `Overpass HTTP ${res.status}`, agencies: [] }, { status: 200 });
    }
    const data = await res.json();
    const seen = new Set<string>();
    const agencies = (data.elements || []).map((element: any) => {
      const tags = element.tags || {};
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      const name = clean(tags.name || tags['name:en']);
      const city = cityFromTags(tags);
      const state = stateFromTags(tags);
      const phone = clean(tags.phone || tags['contact:phone'] || tags['contact:mobile']);
      const address = clean([tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'], city, state].filter(Boolean).join(', '));
      return {
        id: `osm-${element.type}-${element.id}`,
        name,
        city,
        state,
        address: address || undefined,
        phone: phone || undefined,
        email: clean(tags.email || tags['contact:email']) || undefined,
        website: clean(tags.website || tags['contact:website']) || undefined,
        latitude: lat,
        longitude: lon,
        services: ['Travel agency'],
        source: SOURCE,
        verification: 'OPENSTREETMAP LISTED',
        sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
      };
    }).filter((x: any) => {
      if (!x.name) return false;
      const key = `${x.name}|${x.city}|${x.state}|${x.phone || ''}`.toLowerCase().replace(/[^a-z0-9|]+/g, '');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, limit);
    return NextResponse.json({ source: SOURCE, sourceCountClaim: agencies.length, fetchedPages: 1, count: agencies.length, agencies });
  } catch (error) {
    return NextResponse.json({ source: SOURCE, count: 0, error: error instanceof Error ? error.message : 'Overpass request failed', agencies: [] }, { status: 200 });
  }
}
