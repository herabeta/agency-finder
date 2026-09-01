import { NextResponse } from 'next/server';

export const revalidate = 86400;

const SOURCE = 'BusinessList Nigeria · Travel Agents directory';
const STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara','Federal Capital Territory'];
const BAD_NAMES = /^(top travel agents|filter by city|related categories|nigeria network database|plans & pricing|view profile|send enquiry|map|website|e-mail|photos)$/i;
const TRAVEL_SIGNAL = /(travel|travels|tour|tours|trip|holiday|holidays|airline|aviation|visa|ticket|tourism|journey|vacation|umrah|hajj|airways|booking)/i;

function clean(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#39;/gi, "'").replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim();
}

function parsePage(html: string, page: number) {
  const headings = [...html.matchAll(/<h[2-5][^>]*>([\s\S]*?)<\/h[2-5]>/gi)];
  const out: any[] = [];
  for (let i = 0; i < headings.length; i++) {
    const name = clean(headings[i][1]);
    if (!name || BAD_NAMES.test(name) || name.length < 3 || name.length > 140 || !TRAVEL_SIGNAL.test(name)) continue;
    const start = headings[i].index! + headings[i][0].length;
    const end = headings[i + 1]?.index ?? Math.min(html.length, start + 7000);
    const block = html.slice(start, end);
    const text = clean(block);
    const phone = (text.match(/(?:\+?234[\s-]?(?:\(?\d{1,4}\)?[\s-]?){2,5}|0\d{3}[\s-]?\d{3}[\s-]?\d{4}|\(\+?234[^<]{4,30})/i)?.[0] || '').replace(/\s+/g, ' ').trim();
    const address = text.split(/View Profile|Send Enquiry|E-mail|Map|Website/i)[0].trim().slice(0, 280);
    const state = STATES.find(s => new RegExp(`\\b${s.replace(/ /g, '\\s+')}\\b`, 'i').test(address)) || '';
    const city = state ? address.split(',').map(x => x.trim()).filter(Boolean).find(x => new RegExp(`\\b${state.replace(/ /g, '\\s+')}\\b`, 'i').test(x)) ? address.split(',').map(x => x.trim()).slice(-3).find(x => new RegExp(`\\b${state.replace(/ /g, '\\s+')}\\b`, 'i').test(x)) || 'Unknown' : 'Unknown' : 'Unknown';
    out.push({
      id: `bl-${page}-${out.length}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 70)}`,
      name,
      city,
      state: state || 'Unknown',
      address: address || undefined,
      phone: phone || undefined,
      services: ['Travel agency'],
      source: SOURCE,
      verification: 'DIRECTORY LISTED',
      sourcePage: page,
      sourceUrl: `https://www.businesslist.com.ng/category/travel-agents/${page}`,
    });
  }
  return out;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(1600, Math.max(100, Number(searchParams.get('limit') || 1200)));
  const pages = Array.from({ length: 77 }, (_, i) => i + 1);
  const results = await Promise.all(pages.map(async page => {
    const url = page === 1 ? 'https://www.businesslist.com.ng/category/travel-agents' : `https://www.businesslist.com.ng/category/travel-agents/${page}`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 AgencyFinder public directory indexer' }, next: { revalidate: 86400 } });
      if (!res.ok) return [];
      return parsePage(await res.text(), page);
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
  return NextResponse.json({ source: SOURCE, sourceCountClaim: 1528, fetchedPages: pages.length, count: agencies.length, agencies });
}
