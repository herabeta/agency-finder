'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Search, MapPin, Building2, ShieldCheck, Star, Phone, Globe2, ChevronDown,
  Radar, Plus, RefreshCw, Mail, MessageCircle, Copy, Download, Check,
  Clock3, Sparkles, Target, Database, Activity, X
} from 'lucide-react';

type Status = 'New' | 'Contacted' | 'Qualified' | 'Won' | 'Lost';
type Agency = {
  id: string; name: string; city: string; state: string; services: string[];
  rating: number; reviews: number; phone: string; website?: string;
  verified: boolean; websiteQuality: number; socialActivity: number;
  contactCompleteness: number; score: number; status: Status;
  notes: string; lastChecked: string; source: string;
};

const NIGERIA_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River',
  'Delta','Ebonyi','Edo','Ekiti','Enugu','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina',
  'Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau',
  'Rivers','Sokoto','Taraba','Yobe','Zamfara','FCT'
];
const SERVICES = ['All services','Flights','Hotels','Visa','Tours','Corporate'];
const STATUSES: Status[] = ['New','Contacted','Qualified','Won','Lost'];

const seed: Agency[] = [
  {id:'wakanow',name:'Wakanow',city:'Lagos',state:'Lagos',services:['Flights','Hotels','Tours'],rating:4.5,reviews:1840,phone:'+234 1 277 3000',website:'https://www.wakanow.com',verified:true,websiteQuality:96,socialActivity:94,contactCompleteness:96,score:96,status:'New',notes:'Large multi-service travel brand.',lastChecked:'2026-09-01',source:'Seed / verified'},
  {id:'quantum',name:'Quantum Travels',city:'Abuja',state:'FCT',services:['Corporate','Visa','Flights'],rating:4.6,reviews:420,phone:'+234 809 999 0000',verified:true,websiteQuality:92,socialActivity:89,contactCompleteness:94,score:92,status:'New',notes:'Corporate and visa opportunity.',lastChecked:'2026-09-01',source:'Seed / verified'},
  {id:'dees',name:'Dees Travels & Tours',city:'Kano',state:'Kano',services:['Flights','Visa','Tours'],rating:4.3,reviews:118,phone:'+234 803 000 1122',verified:true,websiteQuality:84,socialActivity:78,contactCompleteness:88,score:84,status:'New',notes:'Strong regional coverage.',lastChecked:'2026-09-01',source:'Seed / verified'},
  {id:'finchglow',name:'Finchglow Travels',city:'Lagos',state:'Lagos',services:['Corporate','Flights','Hotels'],rating:4.4,reviews:690,phone:'+234 1 454 7000',verified:true,websiteQuality:94,socialActivity:91,contactCompleteness:95,score:93,status:'Qualified',notes:'High-value corporate lead.',lastChecked:'2026-09-01',source:'Seed / verified'},
  {id:'chasing',name:'Chasing Horizons',city:'Ibadan',state:'Oyo',services:['Tours','Hotels','Visa'],rating:4.2,reviews:76,phone:'+234 802 111 2233',verified:false,websiteQuality:72,socialActivity:74,contactCompleteness:76,score:74,status:'New',notes:'Needs verification before outreach.',lastChecked:'2026-09-01',source:'Seed / unverified'},
  {id:'northern',name:'Northern Travels',city:'Kaduna',state:'Kaduna',services:['Flights','Tours'],rating:4.1,reviews:41,phone:'+234 805 555 6677',verified:false,websiteQuality:64,socialActivity:61,contactCompleteness:70,score:65,status:'New',notes:'Potential regional lead.',lastChecked:'2026-09-01',source:'Seed / unverified'},
];

function calcScore(a: Agency) {
  const reviewSignal = Math.min(100, 45 + Math.log10(Math.max(1,a.reviews)) * 18);
  return Math.round(a.websiteQuality*.35 + a.socialActivity*.25 + a.contactCompleteness*.25 + reviewSignal*.15);
}

export default function Home() {
  const [agencies,setAgencies] = useState<Agency[]>(seed);
  const [query,setQuery] = useState('');
  const [state,setState] = useState('All Nigeria');
  const [service,setService] = useState('All services');
  const [scoreMin,setScoreMin] = useState(0);
  const [status,setStatus] = useState<'All'|Status>('All');
  const [view,setView] = useState<'Agencies'|'Coverage'|'Verification'|'Top Agencies'|'Pipeline'>('Agencies');
  const [selected,setSelected] = useState<Agency|null>(null);
  const [showAdd,setShowAdd] = useState(false);
  const [showOutreach,setShowOutreach] = useState<Agency|null>(null);
  const [notice,setNotice] = useState('');
  const [hydrated,setHydrated] = useState(false);

  useEffect(()=>{
    try { const saved=localStorage.getItem('agency-finder-agencies'); if(saved) setAgencies(JSON.parse(saved)); } catch {}
    setHydrated(true);
  },[]);
  useEffect(()=>{ if(hydrated) localStorage.setItem('agency-finder-agencies',JSON.stringify(agencies)); },[agencies,hydrated]);

  const filtered = useMemo(()=>agencies.filter(a=>
    `${a.name} ${a.city} ${a.state} ${a.services.join(' ')}`.toLowerCase().includes(query.toLowerCase()) &&
    (state==='All Nigeria'||a.state===state) &&
    (service==='All services'||a.services.includes(service)) &&
    a.score>=scoreMin && (status==='All'||a.status===status)
  ).sort((a,b)=>b.score-a.score),[agencies,query,state,service,scoreMin,status]);

  const updateAgency=(id:string, patch:Partial<Agency>)=>setAgencies(xs=>xs.map(a=>a.id===id?{...a,...patch}:a));
  const discover=()=>{
    setNotice('Discovery layer ready: connect Google Places / Maps, website crawl and social sources in Step 2 settings.');
    setTimeout(()=>setNotice(''),4500);
  };
  const refresh=()=>{
    setAgencies(xs=>xs.map(a=>({...a,score:calcScore(a),lastChecked:new Date().toISOString().slice(0,10)})));
    setNotice('Lead scores and last-checked dates refreshed.'); setTimeout(()=>setNotice(''),3000);
  };

  const counts = useMemo(()=>NIGERIA_STATES.reduce<Record<string,number>>((acc,s)=>{acc[s]=agencies.filter(a=>a.state===s).length;return acc;},{}),[agencies]);
  const verified=agencies.filter(a=>a.verified).length;
  const qualified=agencies.filter(a=>a.status==='Qualified').length;

  return <main>
    <aside className="sidebar">
      <div className="brand"><span className="brandMark"><Radar size={19}/></span><div><b>Sales Radar</b><small>Nigeria</small></div></div>
      <nav>
        <a className={view==='Agencies'?'active':''} onClick={()=>setView('Agencies')}><Building2 size={18}/> Agencies</a>
        <a className={view==='Coverage'?'active':''} onClick={()=>setView('Coverage')}><MapPin size={18}/> Nigeria Coverage</a>
        <a className={view==='Verification'?'active':''} onClick={()=>setView('Verification')}><ShieldCheck size={18}/> Verification</a>
        <a className={view==='Top Agencies'?'active':''} onClick={()=>setView('Top Agencies')}><Star size={18}/> Top Agencies</a>
        <a className={view==='Pipeline'?'active':''} onClick={()=>setView('Pipeline')}><Target size={18}/> Sales Pipeline</a>
      </nav>
      <div className="sideBottom">
        <div className="scanBox"><Radar size={22}/><b>Discover more agencies</b><span>Google, websites & social sources.</span><button onClick={discover}>Start discovery <Radar size={14}/></button></div>
        <small>Sales Radar v2.0</small>
      </div>
    </aside>

    <section className="content">
      {notice && <div className="notice"><Check size={15}/>{notice}</div>}
      <header><div><div className="eyebrow">NIGERIA-WIDE SALES INTELLIGENCE</div><h1>Find the <span>best travel agency opportunities.</span></h1><p>Discover, score, qualify and manage travel-agency leads from one place.</p></div><div className="headerActions"><button className="secondary" onClick={refresh}><RefreshCw size={15}/> Refresh data</button><button className="addBtn" onClick={()=>setShowAdd(true)}><Plus size={17}/> Add agency</button></div></header>

      <div className="heroSearch"><Search size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search agency, city, state or service..."/><div className="searchHint">⌘ K</div></div>
      <div className="filters">
        <label className="filter"><span>Location</span><select value={state} onChange={e=>setState(e.target.value)}><option>All Nigeria</option>{NIGERIA_STATES.map(s=><option key={s}>{s}</option>)}</select></label>
        <label className="filter"><span>Service</span><select value={service} onChange={e=>setService(e.target.value)}>{SERVICES.map(s=><option key={s}>{s}</option>)}</select></label>
        <label className="filter"><span>Minimum score</span><select value={scoreMin} onChange={e=>setScoreMin(Number(e.target.value))}><option value={0}>Any</option><option value={60}>60+</option><option value={70}>70+</option><option value={80}>80+</option><option value={90}>90+</option></select></label>
        <label className="filter"><span>Pipeline</span><select value={status} onChange={e=>setStatus(e.target.value as 'All'|Status)}><option>All</option>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></label>
        <div className="resultCount"><b>{filtered.length}</b> opportunities</div>
      </div>

      <div className="stats">
        <Stat icon={<Building2/>} value={`${agencies.length}`} label="Agencies indexed"/>
        <Stat icon={<MapPin/>} value="36 + FCT" label="States mapped"/>
        <Stat icon={<ShieldCheck/>} value={`${verified}`} label="Verified"/>
        <Stat icon={<Target/>} value={`${qualified}`} label="Qualified leads"/>
      </div>

      {view==='Coverage' ? <Coverage counts={counts} agencies={agencies} onSelect={setState}/> : view==='Pipeline' ? <Pipeline agencies={agencies} onUpdate={updateAgency} onOpen={setSelected}/> : view==='Verification' ? <Verification agencies={agencies} onUpdate={updateAgency} onOpen={setSelected}/> : <>
        <div className="sectionHead"><div><h2>{view==='Top Agencies'?'Top opportunities':'Agency directory'}</h2><p>{view==='Top Agencies'?'Highest sales score first.':'Prioritized by score, data quality and qualification.'}</p></div><button className="sort" onClick={refresh}><Activity size={14}/> Live score model</button></div>
        <div className="grid">{(view==='Top Agencies'?filtered.filter(a=>a.score>=80):filtered).map(a=><AgencyCard key={a.id} agency={a} onOpen={setSelected} onOutreach={setShowOutreach} onUpdate={updateAgency}/>)}{filtered.length===0&&<div className="empty">No agencies match those filters.</div>}</div>
      </>}
    </section>

    {selected && <Detail agency={selected} onClose={()=>setSelected(null)} onUpdate={updateAgency} onOutreach={()=>{setShowOutreach(selected);setSelected(null)}}/>}
    {showOutreach && <Outreach agency={showOutreach} onClose={()=>setShowOutreach(null)} onUpdate={updateAgency}/>} 
    {showAdd && <AddAgency onClose={()=>setShowAdd(false)} onAdd={a=>{setAgencies(xs=>[...xs,a]);setShowAdd(false);}}/>}
  </main>
}

function Stat({icon,value,label}:{icon:React.ReactNode,value:string,label:string}){return <div className="stat"><span>{icon}</span><div><b>{value}</b><small>{label}</small></div></div>}

function AgencyCard({agency:a,onOpen,onOutreach,onUpdate}:{agency:Agency,onOpen:(a:Agency)=>void,onOutreach:(a:Agency)=>void,onUpdate:(id:string,p:Partial<Agency>)=>void}){
  return <article className="card">
    <div className="cardTop"><div className="avatar">{a.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div className="cardTitle"><h3>{a.name}</h3><div className="location"><MapPin size={13}/>{a.city}, {a.state}</div></div><div className="score"><b>{a.score}</b><small>score</small></div></div>
    <div className="badges">{a.services.map(s=><span key={s}>{s}</span>)}</div>
    <div className="meta"><span><Star size={14} fill="currentColor"/> {a.rating} <em>({a.reviews})</em></span>{a.verified?<span className="verified"><ShieldCheck size={14}/> Verified</span>:<span className="pending">Needs verification</span>}</div>
    <div className="leadRow"><span className={`status ${a.status.toLowerCase()}`}>{a.status}</span><span className="source"><Database size={12}/> {a.source}</span></div>
    <div className="cardActions"><button onClick={()=>onOutreach(a)}><Sparkles size={14}/> Personalize</button><button onClick={()=>onOpen(a)}><Target size={14}/> Lead detail</button></div>
    <div className="cardActions secondaryActions"><button onClick={()=>window.location.href=`tel:${a.phone}`}><Phone size={14}/> Call</button><button onClick={()=>a.website&&window.open(a.website,'_blank')}><Globe2 size={14}/> Website</button></div>
    <select className="statusSelect" value={a.status} onChange={e=>onUpdate(a.id,{status:e.target.value as Status})}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select>
  </article>
}

function Coverage({counts,agencies,onSelect}:{counts:Record<string,number>,agencies:Agency[],onSelect:(s:string)=>void}){return <div className="coverage"><div className="coverageIntro"><div><h2>All 36 States + FCT</h2><p>Coverage is ready for state-by-state discovery. States with 0 leads are discovery targets.</p></div><div className="coverageBadge"><MapPin size={17}/>{agencies.length} indexed</div></div><div className="stateGrid">{NIGERIA_STATES.map(s=><button key={s} className={counts[s]?'mapped':''} onClick={()=>onSelect(s)}><span>{s}</span><b>{counts[s]||0}</b></button>)}</div></div>}

function Verification({agencies,onUpdate,onOpen}:{agencies:Agency[],onUpdate:(id:string,p:Partial<Agency>)=>void,onOpen:(a:Agency)=>void}){const pending=agencies.filter(a=>!a.verified);return <div className="panel"><div className="panelTitle"><div><h2>Verification queue</h2><p>Review unverified agencies before high-volume outreach.</p></div><ShieldCheck size={24}/></div>{pending.map(a=><div className="queueRow" key={a.id}><div><b>{a.name}</b><small>{a.city}, {a.state} · {a.phone}</small></div><span className="pending">Needs verification</span><button onClick={()=>onOpen(a)}>Review</button><button onClick={()=>onUpdate(a.id,{verified:true,status:'Qualified'})}><Check size={14}/> Verify</button></div>)}{!pending.length&&<div className="empty">Verification queue is clear.</div>}</div>}

function Pipeline({agencies,onUpdate,onOpen}:{agencies:Agency[],onUpdate:(id:string,p:Partial<Agency>)=>void,onOpen:(a:Agency)=>void}){return <div className="pipeline">{STATUSES.map(s=><div className="stage" key={s}><div className="stageHead"><b>{s}</b><span>{agencies.filter(a=>a.status===s).length}</span></div>{agencies.filter(a=>a.status===s).map(a=><button className="pipelineCard" key={a.id} onClick={()=>onOpen(a)}><b>{a.name}</b><small>{a.city}, {a.state}</small><span>{a.score} score</span><select value={a.status} onClick={e=>e.stopPropagation()} onChange={e=>onUpdate(a.id,{status:e.target.value as Status})}>{STATUSES.map(x=><option key={x}>{x}</option>)}</select></button>)}</div>)}</div>}

function Detail({agency:a,onClose,onUpdate,onOutreach}:{agency:Agency,onClose:()=>void,onUpdate:(id:string,p:Partial<Agency>)=>void,onOutreach:()=>void}){return <div className="overlay"><div className="modal detail"><button className="close" onClick={onClose}><X/></button><div className="detailHead"><div className="avatar big">{a.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><div className="eyebrow">LEAD DETAIL</div><h2>{a.name}</h2><p><MapPin size={13}/> {a.city}, {a.state}</p></div><div className="bigScore"><b>{a.score}</b><small>opportunity</small></div></div><div className="detailGrid"><Metric label="Website quality" value={a.websiteQuality}/><Metric label="Social activity" value={a.socialActivity}/><Metric label="Contact completeness" value={a.contactCompleteness}/><Metric label="Reviews" value={a.reviews}/></div><div className="pain"><b>Notes / pain point</b><p>{a.notes}</p></div><div className="detailActions"><button onClick={onOutreach}><Sparkles size={15}/> Generate outreach</button><select value={a.status} onChange={e=>onUpdate(a.id,{status:e.target.value as Status})}>{STATUSES.map(s=><option key={s}>{s}</option>)}</select></div><small className="lastChecked"><Clock3 size={13}/> Last checked {a.lastChecked} · Source: {a.source}</small></div></div>}
function Metric({label,value}:{label:string,value:number}){return <div className="metric"><small>{label}</small><b>{value}</b><div className="bar"><i style={{width:`${Math.min(100,value)}%`}}/></div></div>}

function Outreach({agency:a,onClose,onUpdate}:{agency:Agency,onClose:()=>void,onUpdate:(id:string,p:Partial<Agency>)=>void}){
  const [channel,setChannel]=useState<'Email'|'WhatsApp'>('Email');
  const offer=a.services.includes('Corporate')?'corporate travel management':a.services.includes('Visa')?'visa and holiday support':a.services.includes('Hotels')?'hotel and holiday packages':'travel service support';
  const opener=`Hi ${a.name} team, I came across your travel services in ${a.city}. I noticed your focus on ${a.services.slice(0,2).join(' and ')} and wanted to explore whether ${offer} could help you generate more qualified enquiries. Would you be open to a quick conversation?`;
  const copy=async()=>{await navigator.clipboard?.writeText(opener);onUpdate(a.id,{status:'Contacted'});};
  const csv=()=>{const blob=new Blob([`Agency,Channel,Message\n"${a.name}","${channel}","${opener.replaceAll('"','""')}"`],{type:'text/csv'});const url=URL.createObjectURL(blob);const el=document.createElement('a');el.href=url;el.download=`${a.id}-outreach.csv`;el.click();URL.revokeObjectURL(url);};
  const whatsapp=`https://wa.me/${a.phone.replace(/\D/g,'')}?text=${encodeURIComponent(opener)}`;
  return <div className="overlay"><div className="modal outreach"><button className="close" onClick={onClose}><X/></button><div className="eyebrow">AI-ASSISTED OUTREACH</div><h2>{a.name}</h2><p>Personalized from agency services, location and lead score.</p><div className="channelTabs"><button className={channel==='Email'?'chosen':''} onClick={()=>setChannel('Email')}><Mail size={15}/> Email</button><button className={channel==='WhatsApp'?'chosen':''} onClick={()=>setChannel('WhatsApp')}><MessageCircle size={15}/> WhatsApp</button></div><textarea value={opener} readOnly/><div className="outreachActions"><button onClick={copy}><Copy size={15}/> Copy & mark contacted</button><button onClick={csv}><Download size={15}/> Export</button>{channel==='WhatsApp'&&<button onClick={()=>window.open(whatsapp,'_blank')}><MessageCircle size={15}/> Open WhatsApp</button>}{channel==='Email'&&<button onClick={()=>window.location.href=`mailto:?subject=${encodeURIComponent(`Travel partnership opportunity — ${a.name}`)}&body=${encodeURIComponent(opener)}`}><Mail size={15}/> Open email</button>}</div></div></div>}

function AddAgency({onClose,onAdd}:{onClose:()=>void,onAdd:(a:Agency)=>void}){const [name,setName]=useState('');const [city,setCity]=useState('');const [state,setState]=useState('Lagos');const [phone,setPhone]=useState('');return <div className="overlay"><div className="modal add"><button className="close" onClick={onClose}><X/></button><div className="eyebrow">MANUAL LEAD ENTRY</div><h2>Add agency</h2><div className="formGrid"><input placeholder="Agency name" value={name} onChange={e=>setName(e.target.value)}/><input placeholder="City" value={city} onChange={e=>setCity(e.target.value)}/><select value={state} onChange={e=>setState(e.target.value)}>{NIGERIA_STATES.map(s=><option key={s}>{s}</option>)}</select><input placeholder="Phone" value={phone} onChange={e=>setPhone(e.target.value)}/></div><button className="addBtn full" disabled={!name||!city} onClick={()=>onAdd({id:`manual-${Date.now()}`,name,city,state,phone,services:['Flights'],rating:0,reviews:0,verified:false,websiteQuality:50,socialActivity:50,contactCompleteness:phone?70:30,score:50,status:'New',notes:'Manual entry — verify before outreach.',lastChecked:new Date().toISOString().slice(0,10),source:'Manual'})}><Plus size={16}/> Save agency</button></div></div>}
