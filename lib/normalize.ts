export function normalizeAgency(raw:any){
 const name=String(raw?.name||'').trim();
 const address=String(raw?.address||'').trim();
 const phone=String(raw?.phone||'').trim();
 const website=String(raw?.website||'').trim();
 const key=[name.toLowerCase().replace(/[^a-z0-9]+/g,' '),address.toLowerCase().replace(/[^a-z0-9]+/g,' ')].join('|');
 return { ...raw, name:name||'Unknown agency', address, phone, website, dedupeKey:key };
}
export function dedupeAgencies(rows:any[]){
 const map=new Map<string,any>();
 for(const row of rows){const a=normalizeAgency(row); const existing=map.get(a.id||a.dedupeKey); if(!existing || (a.reviews||0)>(existing.reviews||0)) map.set(a.id||a.dedupeKey,a);}
 return [...map.values()];
}
