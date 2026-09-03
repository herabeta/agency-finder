import { NextResponse } from 'next/server';

export const revalidate = 86400;
const SOURCE = 'Public Nigerian directories + OpenStreetMap';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const CITIES: Array<[string,string,string]> = [
  ['lagos','Lagos','Lagos'],['abuja','Abuja','Federal Capital Territory'],['port-harcourt','Port Harcourt','Rivers'],['ibadan','Ibadan','Oyo'],['kano','Kano','Kano'],['benin-city','Benin City','Edo'],['kaduna','Kaduna','Kaduna'],['jos','Jos','Plateau'],['enugu','Enugu','Enugu'],['owerri','Owerri','Imo'],['ilorin','Ilorin','Kwara'],['akure','Akure','Ondo'],['calabar','Calabar','Cross River'],['uyo','Uyo','Akwa Ibom'],['maiduguri','Maiduguri','Borno'],['abeokuta','Abeokuta','Ogun'],['asaba','Asaba','Delta'],['awka','Awka','Anambra']
];
const PHONE=/(?:\+?234[\s-]?(?:\(?\d{1,4}\)?[\s-]?){2,6}|0\d{3}[\s-]?\d{3}[\s-]?\d{4}|0\d{1,3}[\s-]?\d{5,8})/i;
const BAD=/^(travel agencies|travel agency|airline ticketing agencies|car hire services|hotel reservations and bookings|tour operators|travel management|visa consulting agencies|previous|next|more info|write a review|see also|travel services|nigeria travel agencies|photos|reviews|title:|url source:|directory|home|contact)$/i;
const NON_AGENCY=/(?:driving school|school of motoring|bus stop|auto services|car wash|transport company|courier|logistics\s+only|primary school|motor park|estate agent|real estate)/i;
function clean(v:unknown){return String(v??'').replace(/\s+/g,' ').trim();}
function city(t:any,f=''){return clean(t['addr:city']||t['addr:town']||t['addr:municipality']||t['is_in:city']||f)}
function state(t:any,f='Nigeria'){return clean(t['addr:state']||t['is_in:state']||f)}
function normalizeName(v:string){return clean(v).replace(/^[|•·\-:]+/,'').replace(/\s*[|•·]+\s*$/,'').replace(/\b(?:verified|sponsored)\b/gi,'').replace(/\s+/g,' ').trim();}
function overpassQuery(){return `[out:json][timeout:120];area["ISO3166-1"="NG"][admin_level=2]->.ng;(nwr["tourism"="travel_agency"](area.ng);nwr["shop"="travel_agency"](area.ng);nwr["office"="travel_agency"](area.ng);nwr["amenity"="travel_agency"](area.ng););out center tags;`}
function parseDirectory(text:string,url:string,source:string,fallbackCity='',fallbackState='Nigeria'){
 const out:any[]=[]; const normalized=text.replace(/\r/g,'').replace(/\u00a0/g,' ');
 const starts=[...normalized.matchAll(/(?:^|\n|\s)(?:#{1,6}\s*)?(\d{1,4})\s+(?=[A-Za-z][A-Za-z0-9&'().\- ]{2,120})/g)].map(m=>m.index!+m[0].search(/\d/));
 const blocks:string[]=[]; if(starts.length){for(let i=0;i<starts.length;i++)blocks.push(normalized.slice(starts[i],starts[i+1]??normalized.length))}else blocks.push(...normalized.split(/\n{2,}/));
 for(const raw of blocks){
  let block=clean(raw).replace(/^\d{1,4}\s+/,'').replace(/^#{1,6}\s*/,'').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\*+/g,'');
  if(!block||/url source:|title: list of travel agencies/i.test(block)||NON_AGENCY.test(block))continue;
  const phone=clean(block.match(PHONE)?.[0]);
  const phonePos=phone?block.indexOf(phone):-1;
  let namePart=phonePos>0?block.slice(0,phonePos):block;
  namePart=namePart.replace(/\b(?:verified|sponsored|reviews?|photos?)\b.*$/i,'').trim();
  const cutPatterns=[/\s+is\s+(?:a|an|located|your|one)\b/i,/\s+(?:provides|offers|offering|specializes|deals in|has been|was established)\b/i,/\s+(?:suite|plot|block|shop|address|road|street|avenue|crescent|close|way|plaza)\b/i,/\s+\d{1,5}[A-Za-z]?[, ]/i,/\s+-\s+(?:Lagos|Abuja|Kano|Nigeria|Port Harcourt|Ibadan)\b/i];
  let cut=namePart.length; for(const p of cutPatterns){const m=namePart.search(p);if(m>2)cut=Math.min(cut,m)}
  let name=normalizeName(namePart.slice(0,Math.min(cut,120)));
  name=name.replace(/^(?:review|more info|write a review|photos|sponsored|verified)\s*/i,'').trim();
  if(!name||name.length<3||name.length>120||BAD.test(name)||NON_AGENCY.test(name))continue;
  if(/^(ik[o]?rodu|iwofe|osolo way|road|suite|plot|block|abuja fct|nigeria|lagos|abuja|kano)$/i.test(name))continue;
  const travelLike=/travel|tour|visa|ticket|booking|holiday|tourism|airline|vacation/i.test(block);
  if(!phone&&!travelLike)continue;
  const tail=phonePos>name.length?block.slice(name.length,phonePos):'';
  const address=clean(tail).replace(/\b(?:Image|Verified|Sponsored|Reviews|Photos)\b/gi,'').replace(/\*+/g,'').slice(0,350);
  out.push({name,city:fallbackCity,state:fallbackState,address:address||undefined,phone:phone||undefined,services:['Travel agency'],source,verification:'DIRECTORY LISTED',sourceUrl:url});
 }
 return out;
}
async function fetchReader(url:string,source:string,c='',s=''){try{const r=await fetch(`https://r.jina.ai/${url}`,{headers:{'User-Agent':'AgencyFinder public directory indexer'},next:{revalidate:86400}});if(!r.ok)return[];return parseDirectory(await r.text(),url,source,c,s)}catch{return[]}}
async function batched<T>(items:T[],size:number,fn:(x:T)=>Promise<any>){const out:any[]=[];for(let i=0;i<items.length;i+=size)out.push(...(await Promise.all(items.slice(i,i+size).map(fn))));return out}
export async function GET(request:Request){
 const {searchParams}=new URL(request.url); const limit=Math.min(4000,Math.max(100,Number(searchParams.get('limit')||4000)));
 const jobs=CITIES.flatMap(([slug,c,s])=>Array.from({length:6},(_,i)=>{const p=i+1;return [`https://www.finelib.com/cities/${slug}/travel/travel-agencies${p>1?`/page-${p}`:''}`,'Finelib Nigeria · Travel Agencies directory',c,s] as const}));
 const businessJobs=Array.from({length:60},(_,i)=>{const p=i+1;return [`https://www.businesslist.com.ng/category/travel-agents${p>1?`/page/${p}`:''}`,'BusinessList Nigeria · Travel Agents directory','','Nigeria'] as const});
 const branchesJobs=Array.from({length:45},(_,i)=>{const p=i+1;return [`https://branches.com.ng/branches/Travel-Agents-in-Nigeria${p>1?`&page=${p}&id=Travel-Agents-in-Nigeria&action=branches`:''}`,'Branches.com.ng · Travel Agents in Nigeria','','Nigeria'] as const});
 const goAfricaJobs=Array.from({length:104},(_,i)=>{const p=i+1;return [`https://www.goafricaonline.com/ng/directory/travel-agencies${p>1?`?p=${p}`:''}`,'Go Africa Online · Travel Agencies directory','','Nigeria'] as const});
 const osmPromise=fetch(OVERPASS,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'AgencyFinder/1.0 public OSM indexer'},body:`data=${encodeURIComponent(overpassQuery())}`,next:{revalidate:86400}}).then(async r=>r.ok?r.json():{elements:[]}).catch(()=>({elements:[]}));
 const groups=await batched([...jobs,...businessJobs,...branchesJobs,...goAfricaJobs],8,([u,s,c,st])=>fetchReader(u,s,c,st));
 const osm=await osmPromise; const osmRecords=(osm.elements||[]).map((e:any)=>{const t=e.tags||{};const name=normalizeName(t.name||t['name:en']);const lat=e.lat??e.center?.lat,lon=e.lon??e.center?.lon,c=city(t),st=state(t);return{id:`osm-${e.type}-${e.id}`,name,city:c,state:st,address:clean([t['addr:housenumber'],t['addr:street'],t['addr:suburb'],c,st].filter(Boolean).join(', '))||undefined,phone:clean(t.phone||t['contact:phone']||t['contact:mobile'])||undefined,email:clean(t.email||t['contact:email'])||undefined,website:clean(t.website||t['contact:website'])||undefined,latitude:lat,longitude:lon,services:['Travel agency'],source:'OpenStreetMap · Overpass API',verification:'OPENSTREETMAP LISTED',sourceUrl:`https://www.openstreetmap.org/${e.type}/${e.id}`}}).filter((x:any)=>x.name&&!NON_AGENCY.test(x.name)&&!/helipad|airport operations|bus transport/i.test(x.name));
 const seen=new Map<string,any>(); for(const x of [...osmRecords,...groups.flat()]){x.name=normalizeName(x.name);if(!x.name||x.name.length<3||BAD.test(x.name)||NON_AGENCY.test(x.name))continue;const nameKey=x.name.toLowerCase().replace(/[^a-z0-9]+/g,'');const phoneKey=clean(x.phone).replace(/\D/g,'');const locationKey=`${clean(x.city)}|${clean(x.state)}`.toLowerCase().replace(/[^a-z0-9|]+/g,'');const key=phoneKey?`phone|${phoneKey}`:`name|${nameKey}|${locationKey}`;if(!seen.has(key))seen.set(key,x)}
 const agencies=[...seen.values()].slice(0,limit).map((x:any,i:number)=>({...x,id:x.id||`dir-${i}-${clean(x.name).toLowerCase().replace(/[^a-z0-9]+/g,'-')}`}));
 return NextResponse.json({source:SOURCE,sourceCountClaim:agencies.length,fetchedPages:jobs.length+businessJobs.length+branchesJobs.length+goAfricaJobs.length+1,count:agencies.length,agencies});
}
