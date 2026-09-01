export type DiscoveredAgency = { id:string; name:string; address:string; phone:string; website:string; rating:number; reviews:number; source:string; state?:string; city?:string };
export function normalizeAgency(x:DiscoveredAgency):DiscoveredAgency { return {...x,name:x.name.trim(),address:x.address.trim(),phone:x.phone.trim(),website:x.website.trim()}; }
export function dedupeAgencies(items:DiscoveredAgency[]) { const seen=new Map<string,DiscoveredAgency>(); for(const raw of items){const x=normalizeAgency(raw); const key=(x.id||`${x.name}|${x.address}`).toLowerCase(); if(!seen.has(key)) seen.set(key,x);} return [...seen.values()]; }
export function discoveryQuery(state:string, city:string, kind='travel agency'){ return `${kind} ${city ? city+', ' : ''}${state}, Nigeria`; }
