export async function GET() {
  const url = 'https://www.businesslist.com.ng/category/travel-agents/2';
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 AgencyFinder research client' }, cache: 'no-store' });
  const html = await res.text();
  return new Response(JSON.stringify({ status: res.status, length: html.length, sample: html.slice(0, 12000) }, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8' } });
}
