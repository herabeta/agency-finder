'use client';

import {useEffect,useMemo,useState} from 'react';
import {ChevronLeft,ChevronRight,MapPin,Phone,Search} from 'lucide-react';

type Lead={id:string;name:string;city:string;state:string;area?:string;address?:string;phone?:string;services?:string[];source?:string;verification?:string};

const PER_PAGE=20;

export default function LeadsPage(){
  const [leads,setLeads]=useState<Lead[]>([]);
  const [q,setQ]=useState('');
  const [page,setPage]=useState(1);
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    fetch('/api/nigeria-agencies?limit=4000')
      .then(r=>r.ok?r.json():null)
      .then(d=>setLeads(Array.isArray(d?.agencies)?d.agencies:[]))
      .catch(()=>setLeads([]))
      .finally(()=>setLoading(false));
  },[]);

  const rows=useMemo(()=>{
    const term=q.trim().toLowerCase();
    return leads.filter(x=>!term||`${x.name} ${x.city} ${x.state} ${x.area||''} ${x.address||''} ${(x.services||[]).join(' ')}`.toLowerCase().includes(term));
  },[leads,q]);

  const totalPages=Math.max(1,Math.ceil(rows.length/PER_PAGE));
  const safePage=Math.min(page,totalPages);
  const visible=rows.slice((safePage-1)*PER_PAGE,safePage*PER_PAGE);
  const start=rows.length?((safePage-1)*PER_PAGE)+1:0;
  const end=Math.min(safePage*PER_PAGE,rows.length);

  return <main style={{minHeight:'100vh',background:'#f6f7f9',color:'#17202a',fontFamily:'Inter,system-ui,sans-serif',padding:'30px 5vw'}}>
    <div style={{maxWidth:1280,margin:'0 auto'}}>
      <div style={{marginBottom:22}}>
        <div style={{fontSize:11,fontWeight:800,letterSpacing:'.12em',color:'#738091'}}>SALES RADAR · LEAD DATABASE</div>
        <h1 style={{fontSize:34,margin:'8px 0'}}>Travel Agency Leads</h1>
        <p style={{margin:0,color:'#7d8793'}}>20 leads per page · automatically loaded from the live public lead index.</p>
      </div>

      <div style={{display:'flex',gap:10,alignItems:'center',marginBottom:18,background:'#fff',border:'1px solid #e2e6eb',borderRadius:10,padding:'4px 12px'}}>
        <Search size={16}/>
        <input value={q} onChange={e=>{setQ(e.target.value);setPage(1)}} placeholder='Search agency, city, area or service...' style={{border:0,outline:0,padding:10,width:'100%',background:'transparent'}}/>
      </div>

      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,color:'#7d8793',fontSize:12}}>
        <span>{loading?'Loading leads…':`${start}–${end} of ${rows.length} leads`}</span>
        <span>Page {safePage} of {totalPages}</span>
      </div>

      <div style={{display:'grid',gap:10}}>
        {visible.map(x=><article key={x.id} style={{background:'#fff',border:'1px solid #e3e7eb',borderRadius:12,padding:16}}>
          <div style={{display:'flex',justifyContent:'space-between',gap:15}}>
            <div>
              <h3 style={{fontSize:15,margin:'0 0 7px'}}>{x.name}</h3>
              <div style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'#66717d'}}><MapPin size={13}/>{x.city||'—'}, {x.state||'—'}{x.area?` · ${x.area}`:''}</div>
              <div style={{fontSize:12,color:'#7d8793',marginTop:5}}>{x.address||'Address not listed'}</div>
            </div>
            <div style={{fontSize:10,fontWeight:700,color:'#738091',textAlign:'right'}}>{x.verification||'PUBLIC LISTING'}</div>
          </div>
          <div style={{display:'flex',gap:12,alignItems:'center',marginTop:13,fontSize:12}}>
            <span style={{display:'flex',alignItems:'center',gap:5}}><Phone size={13}/>{x.phone||'Phone not listed'}</span>
            <span style={{color:'#7d8793',marginLeft:'auto'}}>{x.source||'Public source'}</span>
          </div>
        </article>)}
        {!loading&&!visible.length&&<div style={{background:'#fff',padding:40,textAlign:'center',borderRadius:12}}>No matching leads.</div>}
      </div>

      <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:8,marginTop:20}}>
        <button disabled={safePage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} style={navBtn}><ChevronLeft size={15}/> Previous</button>
        {Array.from({length:Math.min(totalPages,7)},(_,i)=>{
          const p=totalPages<=7?i+1:Math.min(Math.max(safePage-3,1)+i,totalPages);
          return <button key={p} onClick={()=>setPage(p)} style={{...pageBtn,...(p===safePage?activePageBtn:{})}}>{p}</button>;
        })}
        <button disabled={safePage>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} style={navBtn}>Next <ChevronRight size={15}/></button>
      </div>
    </div>
  </main>
}

const navBtn={display:'flex',alignItems:'center',gap:5,border:'1px solid #dce1e6',background:'#fff',borderRadius:8,padding:'8px 11px',cursor:'pointer'};
const pageBtn={minWidth:34,border:'1px solid #dce1e6',background:'#fff',borderRadius:8,padding:'8px 10px',cursor:'pointer'};
const activePageBtn={background:'#17202a',color:'#fff',borderColor:'#17202a'};
