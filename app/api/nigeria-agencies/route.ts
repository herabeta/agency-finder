import { NextResponse } from 'next/server';
import { ABUJA_EMBASSIES } from '../../../data/abuja-embassies';

export const revalidate = 86400;
const SOURCE = 'Public Nigerian directories + OpenStreetMap + Abuja diplomatic missions';
const OVERPASS = 'https://overpass-api.de/api/interpreter';
const ABUJA_DISTRICTS: Array<[string,string]> = [['wuse','Wuse'],['gwarinpa','Gwarinpa'],['maitama','Maitama'],['jabi','Jabi'],['asokoro','Asokoro'],['garki','Garki'],['central-business-district','Central Business District']];
const PHONE=/(?:\+?234[\s-]?(?:\(?\d{1,4}\)?[\s-]?){2,6}|0\d{3}[\s-]?\d{3}[\s-]?\d{4}|0\d{1,3}[\s-]?\d{5,8})/gi;
const BAD=/^(?:!\s*)?(?:image(?:\s*\d+)?|img(?:\s*\d+)?|markdown content.*|title:.*|url source:.*|travel|travels|travel agencies|travel agency|travel agents|compare travel agencies|download travel guides|travel guides.*|travel agencies.*services|travel & transportation|visa(?: & immigration)?|tourism|tourist(?: destinations)?|tourist|previous|next|more info|write a review|see also|travel services|nigeria travel agencies|photos|reviews|directory|home|contact)$/i;
const NON_AGENCY=/(?:driving school|school of motoring|bus stop|auto services|car wash|transport company|courier|logistics\s+only|primary school|motor park|estate agent|real estate|pension limited)/i;
const DESCRIPTION=/^(?:we are|your |comprehensive |expert |simplifying |helping you |affordable |exciting |travel and tour services|travel company in nigeria|canada visa|easy canada|trusted |one-stop|premium pension|premium )/i;
const SENTENCE=/\b(?:is|are|provide|provides|offers|offer|includes|helps|strives|focused|situated|featuring|specializes|specialise|was established|has been|for flight bookings|for car rentals|for visa assistance|for study abroad|car rentals|visa assistance|study abroad)\b/i;
const DIRECTORY_NAV=/\b(?:abuja\s+lagos\d+|kano\d+|ibadan\d+|kaduna\d+|port harcourt\d+|benin city\d+|maiduguri\d+|zaria\d+|jos\d+)\b/i;
function clean(v:unknown){return String(v??'').replace(/\s+/g,' ').trim();}
function normalizeName(v:string){return clean(v).replace(/^\d+\s*\|\s*/,'').replace(/^[|•·\-:]+/,'').replace(/\s*[|•·]+\s*$/,'').replace(/\b(?:verified|sponsored)\b/gi,'').replace(/\s+/g,' ').trim();}
function invalidName(name:string){const n=normalizeName(name);return !n||n.length<3||n.length>80||BAD.test(n)||NON_AGENCY.test(n)||DIRECTORY_NAV.test(n)||SENTENCE.test(n)||/^!?(?:image|img)\s*\d*$/i.test(n)||DESCRIPTION.test(n)||/^\+?234(?:\s*\(?0\)?)?\s*$/i.test(n)||/^\+?[0-9().\s-]+$/.test(n);}
function firstLinkedName(text:string){
 const patterns=[/(?:^|\n)\s*\d+\s*\|?\s*\[([^\]]+)\]\(/i,/(?:^|\n)\s*\d+\s*\[([^\]]+)\]\(/i];
 for(const p of patterns){const m=text.match(p);if(m?.[1]){const n=normalizeName(m[1]);if(!invalidName(n))return n;}}
 return '';
}
function parseDirectory(text:string,url:string,source:string,fallbackCity='Abuja',fallbackState='Federal Capital Territory'){
 const out:any[]=[]; const normalized=text.replace(/\r/g,'').replace(/\u00a0/g,' '); const blocks=normalized.split(/\n{2,}/);
 for(const raw of blocks){
  let block=clean(raw); if(!block||/url source:|title: list of travel agencies/i.test(block)||NON_AGENCY.test(block))continue;
  let name=firstLinkedName(block);
  if(!name){
   const stripped=block.replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\*+/g,'').replace(/^\d{1,4}[.)]?\s+/,'').replace(/^#{1,6}\s*/,'');
   const phoneMatches=stripped.match(PHONE)||[]; const phonePos=phoneMatches[0]?stripped.indexOf(phoneMatches[0]):-1;
   let namePart=phonePos>0?stripped.slice(0,phonePos):stripped; namePart=namePart.replace(/\b(?:verified|sponsored|reviews?|photos?)\b.*$/i,'').trim();
   const cuts=[/\s+is\s+(?:a|an|located|your|one)\b/i,/\s+(?:provides|offers|offering|specializes|deals in|has been|was established)\b/i,/\s+(?:suite|plot|block|shop|address|road|street|avenue|crescent|close|way|plaza)\b/i,/\s+\d{1,5}[A-Za-z]?[, ]/i];
   let cut=namePart.length;for(const p of cuts){const m=namePart.search(p);if(m>2)cut=Math.min(cut,m)} name=normalizeName(namePart.slice(0,Math.min(cut,120)));
  }
  if(invalidName(name))continue;
  const phoneMatches=block.match(PHONE)||[]; const phone=clean(phoneMatches[0]); const travelLike=/travel|tour|visa|ticket|booking|holiday|tourism|airline|vacation/i.test(block); if(!phone&&!travelLike)continue;
  const nameIndex=block.indexOf(name); const phoneIndex=phone?block.indexOf(phone,nameIndex+name.length):-1;
  const tail=phoneIndex>nameIndex?block.slice(nameIndex+name.length,phoneIndex):'';
  const address=clean(tail).replace(/\[([^\]]+)\]\([^)]*\)/g,'').replace(/\b(?:Image|Verified|Sponsored|Reviews?|Photos?|More info|Write a Review|Map|Website|View Profile|Send Enquiry)\b/gi,'').replace(/^\d+\s*\|\s*/,'').slice(0,350);
  out.push({name,city:fallbackCity,state:fallbackState,address:address||undefined,phone:phone||undefined,services:['Travel agency'],source,verification:'DIRECTORY LISTED',sourceUrl:url});
 }
 return out;
}
async function fetchReader(url:string,source:string,c='Abuja',s='Federal Capital Territory'){try{const r=await fetch(`https://r.jina.ai/${url}`,{headers:{'User-Agent':'AgencyFinder public directory indexer'},next:{revalidate:86400},signal:AbortSignal.timeout(9000)});if(!r.ok)return[];return parseDirectory(await r.text(),url,source,c,s)}catch{return[]}}
export async function GET(request:Request){
 const {searchParams}=new URL(request.url); const limit=Math.min(4000,Math.max(100,Number(searchParams.get('limit')||4000)));
 const districtJobs=ABUJA_DISTRICTS.map(([slug,c])=>[`https://www.finelib.com/cities/abuja/abuja-cadastral-and-districts/${slug}/travel-agencies`,'Finelib Nigeria · Abuja district Travel Agencies',c,'Federal Capital Territory'] as const);
 const finelibJobs=Array.from({length:6},(_,i)=>{const p=i+1;return [`https://www.finelib.com/cities/abuja/travel/travel-agencies${p>1?`/page-${p}`:''}`,'Finelib Nigeria · Abuja Travel Agencies','Abuja','Federal Capital Territory'] as const});
 const businessJobs=Array.from({length:17},(_,i)=>{const p=i+1;return [p===1?'https://www.businesslist.com.ng/category/travel-agents/city%3Aabuja':`https://www.businesslist.com.ng/category/travel-agents/city%3Aabuja/page/${p}`,'BusinessList Nigeria · Abuja Travel Agents','Abuja','Federal Capital Territory'] as const});
 const jobs=[...finelibJobs,...districtJobs,...businessJobs];
 const osmPromise=fetch(OVERPASS,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'AgencyFinder/1.0 public OSM indexer'},body:`data=${encodeURIComponent(`[out:json][timeout:60];area["ISO3166-1"="NG"][admin_level=2]->.ng;nwr["tourism"="travel_agency"](area.ng);out center tags;`)}`,next:{revalidate:86400},signal:AbortSignal.timeout(12000)}).then(async r=>r.ok?r.json():{elements:[]}).catch(()=>({elements:[]}));
 const groups=(await Promise.all(jobs.map(([u,s,c,st])=>fetchReader(u,s,c,st)))).flat(); const osm=await osmPromise;
 const osmRecords=(osm.elements||[]).map((e:any)=>{const t=e.tags||{};const name=normalizeName(t.name||t['name:en']);return{id:`osm-${e.type}-${e.id}`,name,city:clean(t['addr:city']||t['addr:town']||'Abuja'),state:clean(t['addr:state']||'Federal Capital Territory'),address:clean([t['addr:housenumber'],t['addr:street'],t['addr:suburb'],'Abuja'].filter(Boolean).join(', '))||undefined,phone:clean(t.phone||t['contact:phone']||t['contact:mobile'])||undefined,email:clean(t.email||t['contact:email'])||undefined,website:clean(t.website||t['contact:website'])||undefined,services:['Travel agency'],source:'OpenStreetMap · Overpass API',verification:'OPENSTREETMAP LISTED',sourceUrl:`https://www.openstreetmap.org/${e.type}/${e.id}`}}).filter((x:any)=>!invalidName(x.name));
 const embassyRecords=ABUJA_EMBASSIES.map(x=>({...x}));
 const seen=new Map<string,any>();for(const x of [...osmRecords,...groups,...embassyRecords]){x.name=normalizeName(x.name);if(invalidName(x.name))continue;const nameKey=x.name.toLowerCase().replace(/[^a-z0-9]+/g,'');const phoneKey=clean(x.phone).replace(/\D/g,'');const locationKey=`${clean(x.city)}|${clean(x.state)}`.toLowerCase().replace(/[^a-z0-9|]+/g,'');const key=phoneKey?`phone|${phoneKey}`:`name|${nameKey}|${locationKey}`;if(!seen.has(key))seen.set(key,x)}
 const agencies=[...seen.values()].slice(0,limit).map((x:any,i:number)=>({...x,id:x.id||`abuja-${i}-${clean(x.name).toLowerCase().replace(/[^a-z0-9]+/g,'-')}`}));
 return NextResponse.json({source:SOURCE,scope:'Abuja-first live directory index · travel agencies + embassies/high commissions',sourceCountClaim:agencies.length,fetchedPages:jobs.length+1,count:agencies.length,agencies});
}
