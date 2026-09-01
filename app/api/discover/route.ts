import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ ok:false, error:'GOOGLE_MAPS_API_KEY is not configured in Vercel.' }, { status:503 });
  const body = await request.json().catch(()=>({}));
  const state = String(body.state || 'Lagos');
  const city = String(body.city || '');
  const services = Array.isArray(body.services) && body.services.length ? body.services : ['travel agency','tour operator','visa consultant'];
  const results: any[] = [];
  for (const service of services) {
    const textQuery = `${service} ${city ? city + ', ' : ''}${state}, Nigeria`;
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method:'POST', headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount'},
      body: JSON.stringify({ textQuery, regionCode:'NG', pageSize:20 })
    });
    if (!response.ok) continue;
    const data = await response.json();
    for (const p of data.places || []) results.push({ id:p.id, name:p.displayName?.text || 'Unknown agency', address:p.formattedAddress || '', phone:p.internationalPhoneNumber || '', website:p.websiteUri || '', rating:p.rating || 0, reviews:p.userRatingCount || 0, source:'Google Places' });
  }
  const unique = Array.from(new Map(results.map(x=>[x.id,x])).values());
  return NextResponse.json({ ok:true, count:unique.length, agencies:unique });
}
