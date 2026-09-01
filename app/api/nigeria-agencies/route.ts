import { NextResponse } from 'next/server';

export const revalidate = 86400;

const SOURCE = 'Finelib Nigeria · Travel Agencies directory';
const CITIES: Array<[string, string, string]> = [
  ['lagos', 'Lagos', 'Lagos'], ['abuja', 'Abuja', 'Federal Capital Territory'], ['port-harcourt', 'Port Harcourt', 'Rivers'],
  ['ibadan', 'Ibadan', 'Oyo'], ['kano', 'Kano', 'Kano'], ['benin-city', 'Benin City', 'Edo'], ['kaduna', 'Kaduna', 'Kaduna'],
  ['jos', 'Jos', 'Plateau'], ['enugu', 'Enugu', 'Enugu'], ['owerri', 'Owerri', 'Imo'], ['ilorin', 'Ilorin', 'Kwara'],
  ['akure', 'Akure', 'Ondo'], ['calabar', 'Calabar', 'Cross River'], ['uyo', 'Uyo', 'Akwa Ibom'],
  ['maiduguri', 'Maiduguri', 'Borno'], ['abeokuta', 'Abeokuta', 'Ogun'], ['asaba', 'Asaba', 'Delta'], ['awka', 'Awka', 'Anambra']
];
const BAD_NAMES = /^(travel agencies|travel agency|airline ticketing agencies|car hire services|hotel reservations and bookings|tour operators|travel management|visa consulting agencies|previous|next|more info|write a review|see also|travel services|nigeria travel agencies)$/i;
const PHONE = /(?:\+?234[\s-]?(?:\(?\d{1,4}\)?[\s-]?){2,6}|0\d{3}[\s-]?\d{3}[\s-]?\d{4}|0\d{1,3}[\s-]?\d{5,8})/i;

function clean(value: string) {
  return value
    .replace(/\[Image[^\]]*\]/gi, ' ')
    .replace(/\[More info\]\([^)]*\)/gi, ' ')
    .replace(/\[Write a Review\]\([^)]*\)/gi, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"').replace(/&#x27;/gi, "'")
    .replace(/\s+/g, ' ').trim();
}

function parseReader(text: string, page: number, city: string, state: string, slug: string) {
  const out: any[] = [];
  const blocks = text.split(/\n(?=\s*(?:#{2,6}\s+)?\d+\s*[^\n]+)/g);
  for (const raw of blocks) {
    const block = clean(raw);
    const m = block.match(/^(?:#{2,6}\s*)?(\d+)\s*([^\n]{3,140}?)(?:\s+Image|\s+Suite|\s+No\.?\s+|\s+Plot\s+|\s+Block\s+|\s+Shop\s+|\s+Road\s+|\s+\d{2,4}[,\s])/i);
    if (!m) continue;
    const name = clean(m[2]).replace(/\s+Image.*$/i, '').trim();
    if (!name || BAD_NAMES.test(name) || name.length < 3 || name.length > 140) continue;
    const phone = (block.match(PHONE)?.[0] || '').trim();
    const phonePos = phone ? block.indexOf(phone) : -1;
    const tail = phonePos >= 0 ? block.slice(m[0].length, phonePos) : block.slice(m[0].length, m[0].length + 500);
    const address = clean(tail).replace(/^(?:Image\s*)+/i, '').trim().slice(0, 350);
    if (!phone && !/travel|tour|visa|ticket|booking|holiday|tourism/i.test(block)) continue;
    out.push({
      id: `fl-${slug}-${page}-${out.length}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60)}`,
      name,
      city,
      state,
      address: address || undefined,
      phone: phone || undefined,
      services: ['Travel agency'],
      source: SOURCE,
      verification: 'DIRECTORY LISTED',
      sourcePage: page,
      sourceUrl: `https://www.finelib.com/cities/${slug}/travel/travel-agencies${page > 1 ? `/page-${page}` : ''}`,
    });
  }
  return out;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(1600, Math.max(100, Number(searchParams.get('limit') || 1200)));
  const pages = Array.from({ length: 6 }, (_, i) => i + 1);
  const jobs = CITIES.flatMap(([slug, city, state]) => pages.map(page => ({ slug, city, state, page })));
  const results = await Promise.all(jobs.map(async ({ slug, city, state, page }) => {
    const sourceUrl = `https://www.finelib.com/cities/${slug}/travel/travel-agencies${page > 1 ? `/page-${page}` : ''}`;
    const readerUrl = `https://r.jina.ai/${sourceUrl}`;
    try {
      const res = await fetch(readerUrl, { headers: { 'User-Agent': 'AgencyFinder public directory indexer' }, next: { revalidate: 86400 } });
      if (!res.ok) return [];
      return parseReader(await res.text(), page, city, state, slug);
    } catch {
      return [];
    }
  }));
  const seen = new Set<string>();
  const agencies = results.flat().filter(x => {
    const key = `${x.name}|${x.state}|${x.city}|${x.phone || ''}`.toLowerCase().replace(/[^a-z0-9|]+/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
  return NextResponse.json({ source: SOURCE, sourceCountClaim: agencies.length, fetchedPages: jobs.length, count: agencies.length, agencies });
}
