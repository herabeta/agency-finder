import { NextResponse } from 'next/server';

export const revalidate = 86400;

const SOURCE = 'Public Nigerian directories + OpenStreetMap';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const CITIES: Array<[string, string, string]> = [
  ['lagos', 'Lagos', 'Lagos'], ['abuja', 'Abuja', 'Federal Capital Territory'], ['port-harcourt', 'Port Harcourt', 'Rivers'],
  ['ibadan', 'Ibadan', 'Oyo'], ['kano', 'Kano', 'Kano'], ['benin-city', 'Benin City', 'Edo'], ['kaduna', 'Kaduna', 'Kaduna'],
  ['jos', 'Jos', 'Plateau'], ['enugu', 'Enugu', 'Enugu'], ['owerri', 'Owerri', 'Imo'], ['ilorin', 'Ilorin', 'Kwara'],
  ['akure', 'Akure', 'Ondo'], ['calabar', 'Calabar', 'Cross River'], ['uyo', 'Uyo', 'Akwa Ibom'], ['maiduguri', 'Maiduguri', 'Borno'],
  ['abeokuta', 'Abeokuta', 'Ogun'], ['asaba', 'Asaba', 'Delta'], ['awka', 'Awka', 'Anambra']
];
const PHONE = /(?:\+?234[\s-]?(?:\(?\d{1,4}\)?[\s-]?){2,6}|0\d{3}[\s-]?\d{3}[\s-]?\d{4}|0\d{1,3}[\s-]?\d{5,8})/i;
const BAD = /^(travel agencies|travel agency|airline ticketing agencies|car hire services|hotel reservations and bookings|tour operators|travel management|visa consulting agencies|previous|next|more info|write a review|see also|travel services|nigeria travel agencies|photos|reviews)$/i;
function clean(v: unknown) { return String(v ?? '').replace(/\s+/g, ' ').trim(); }
function city(tags: any, fallback = '') { return clean(tags['addr:city'] || tags['addr:town'] || tags['addr:municipality'] || tags['is_in:city'] || fallback); }
function state(tags: any, fallback = 'Nigeria') { return clean(tags['addr:state'] || tags['is_in:state'] || fallback); }
function overpassQuery() { return `[out:json][timeout:120];area["ISO3166-1"="NG"][admin_level=2]->.ng;(nwr["tourism"="travel_agency"](area.ng);nwr["shop"="travel_agency"](area.ng);nwr["office"="travel_agency"](area.ng);nwr["amenity"="travel_agency"](area.ng););out center tags;`; }

function parseDirectory(text: string, sourceUrl: string, source: string, fallbackCity = '', fallbackState = 'Nigeria') {
  const out: any[] = [];
  const normalized = text.replace(/\r/g, '').replace(/\u00a0/g, ' ');
  // Jina Reader sometimes returns directory cards on one physical line. Split on numbered listing starts,
  // while also handling markdown headings/newlines.
  const starts = [...normalized.matchAll(/(?:^|\n|\s)(?:#{1,6}\s*)?(\d{1,4})\s+(?=[A-Za-z][A-Za-z0-9&'().\- ]{2,120})/g)].map(m => m.index! + m[0].search(/\d/));
  const blocks: string[] = [];
  if (starts.length) {
    for (let i = 0; i < starts.length; i++) blocks.push(normalized.slice(starts[i], starts[i + 1] ?? normalized.length));
  } else {
    blocks.push(...normalized.split(/\n{2,}/));
  }
  for (const raw of blocks) {
    const block = clean(raw).replace(/^\d{1,4}\s+/, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
    if (!block) continue;
    const cut = block.search(/\b(?:Image|Suite|No\.?|Plot|Block|Shop|Road|Address)\b/i);
    let name = clean(cut > 0 ? block.slice(0, cut) : block.slice(0, 150));
    name = name.replace(/^(?:\|\s*)/, '').replace(/^#+\s*/, '').replace(/\s+(?:Image|More info|Write a Review|Reviews|Photos).*$/i, '').trim();
    // Remove obvious directory UI fragments accidentally captured as names.
    name = name.replace(/^(?:Reviews|Photos|Sponsored|Verified|More info)\s*/i, '').trim();
    if (!name || name.length < 3 || name.length > 140 || BAD.test(name)) continue;
    if (/^(ik[o]?rodu|iwofe|osolo way|road|suite|plot|block)\b/i.test(name)) continue;
    const phone = clean(block.match(PHONE)?.[0]);
    const travelLike = /travel|tour|visa|ticket|booking|holiday|tourism|airline|vacation/i.test(block);
    if (!phone && !travelLike) continue;
    const phonePos = phone ? block.indexOf(phone) : -1;
    const tail = phonePos > 0 ? block.slice(name.length, phonePos) : '';
    const address = clean(tail).replace(/\b(?:Image|Verified|Sponsored|Reviews|Photos)\b/gi, '').replace(/\*+/g, '').slice(0, 350);
    out.push({ name, city: fallbackCity, state: fallbackState, address: address || undefined, phone: phone || undefined, services: ['Travel agency'], source, verification: 'DIRECTORY LISTED', sourceUrl });
  }
  return out;
}

async function fetchReader(url: string, source: string, cityName = '', stateName = '') {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, { headers: { 'User-Agent': 'AgencyFinder public directory indexer' }, next: { revalidate: 86400 } });
    if (!res.ok) return [];
    return parseDirectory(await res.text(), url, source, cityName, stateName);
  } catch { return []; }
}

async function batched<T>(items: T[], size: number, fn: (item: T) => Promise<any>) {
  const out: any[] = [];
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    const values = await Promise.all(chunk.map(fn));
    out.push(...values);
  }
  return out;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(4000, Math.max(100, Number(searchParams.get('limit') || 1600)));
  const jobs = CITIES.flatMap(([slug, cityName, stateName]) => Array.from({ length: 6 }, (_, i) => {
    const page = i + 1;
    return [`https://www.finelib.com/cities/${slug}/travel/travel-agencies${page > 1 ? `/page-${page}` : ''}`, 'Finelib Nigeria · Travel Agencies directory', cityName, stateName] as const;
  }));
  const businessJobs = Array.from({ length: 60 }, (_, i) => {
    const page = i + 1;
    return [`https://www.businesslist.com.ng/category/travel-agents${page > 1 ? `/page/${page}` : ''}`, 'BusinessList Nigeria · Travel Agents directory', '', 'Nigeria'] as const;
  });
  const osmPromise = fetch(OVERPASS, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'AgencyFinder/1.0 public OSM indexer' }, body: `data=${encodeURIComponent(overpassQuery())}`, next: { revalidate: 86400 } }).then(async r => r.ok ? r.json() : { elements: [] }).catch(() => ({ elements: [] }));
  const directoryJobs = [...jobs, ...businessJobs];
  const directoryGroups = await batched(directoryJobs, 8, ([url, source, c, s]) => fetchReader(url, source, c, s));
  const osm = await osmPromise;
  const osmRecords = (osm.elements || []).map((e: any) => {
    const t = e.tags || {}; const lat = e.lat ?? e.center?.lat; const lon = e.lon ?? e.center?.lon;
    const name = clean(t.name || t['name:en']); const c = city(t); const st = state(t);
    return { id: `osm-${e.type}-${e.id}`, name, city: c, state: st, address: clean([t['addr:housenumber'], t['addr:street'], t['addr:suburb'], c, st].filter(Boolean).join(', ')) || undefined, phone: clean(t.phone || t['contact:phone'] || t['contact:mobile']) || undefined, email: clean(t.email || t['contact:email']) || undefined, website: clean(t.website || t['contact:website']) || undefined, latitude: lat, longitude: lon, services: ['Travel agency'], source: 'OpenStreetMap · Overpass API', verification: 'OPENSTREETMAP LISTED', sourceUrl: `https://www.openstreetmap.org/${e.type}/${e.id}` };
  }).filter((x: any) => x.name && !/helipad|airport operations|bus transport/i.test(x.name));
  const seen = new Set<string>();
  const agencies = [...osmRecords, ...directoryGroups.flat()].filter((x: any) => {
    const normalizedName = clean(x.name).replace(/^(?:reviews|photos|sponsored|verified|\|)+/i, '').trim();
    if (!normalizedName || normalizedName.length < 3 || /^(ik[o]?rodu|iwofe|osolo way|reviews|photos)$/i.test(normalizedName)) return false;
    x.name = normalizedName;
    const key = `${normalizedName}|${clean(x.city)}|${clean(x.state)}|${clean(x.phone)}`.toLowerCase().replace(/[^a-z0-9|]+/g, '');
    if (seen.has(key)) return false; seen.add(key); return true;
  }).slice(0, limit).map((x: any, i: number) => ({ ...x, id: x.id || `dir-${i}-${clean(x.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}` }));
  return NextResponse.json({ source: SOURCE, sourceCountClaim: agencies.length, fetchedPages: jobs.length + businessJobs.length + 1, count: agencies.length, agencies });
}
