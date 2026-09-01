'use client';

import { useMemo, useState } from 'react';
import { Search, MapPin, Building2, ShieldCheck, Star, Phone, Globe2, ChevronDown, Radar, Plus, ExternalLink } from 'lucide-react';

type Agency = { name:string; city:string; state:string; services:string[]; score:number; verified:boolean; rating:number; reviews:number; phone:string };

const agencies: Agency[] = [
  {name:'Wakanow',city:'Lagos',state:'Lagos',services:['Flights','Hotels','Tours'],score:96,verified:true,rating:4.5,reviews:1840,phone:'+234 1 277 3000'},
  {name:'Quantum Travels',city:'Abuja',state:'FCT',services:['Corporate','Visa','Flights'],score:93,verified:true,rating:4.6,reviews:420,phone:'+234 809 999 0000'},
  {name:'Dees Travels & Tours',city:'Kano',state:'Kano',services:['Flights','Visa','Tours'],score:88,verified:true,rating:4.3,reviews:118,phone:'+234 803 000 1122'},
  {name:'Finchglow Travels',city:'Lagos',state:'Lagos',services:['Corporate','Flights','Hotels'],score:91,verified:true,rating:4.4,reviews:690,phone:'+234 1 454 7000'},
  {name:'Chasing Horizons',city:'Ibadan',state:'Oyo',services:['Tours','Hotels','Visa'],score:84,verified:false,rating:4.2,reviews:76,phone:'+234 802 111 2233'},
  {name:'Northern Travels',city:'Kaduna',state:'Kaduna',services:['Flights','Tours'],score:79,verified:false,rating:4.1,reviews:41,phone:'+234 805 555 6677'},
];

const states = ['All Nigeria','FCT','Lagos','Kano','Kaduna','Oyo','Rivers','Enugu','Ogun','Delta','Edo','Katsina','Kwara','Plateau','Akwa Ibom','Cross River'];
const services = ['All services','Flights','Hotels','Visa','Tours','Corporate'];

export default function Home() {
  const [query,setQuery]=useState(''); const [state,setState]=useState('All Nigeria'); const [service,setService]=useState('All services');
  const filtered=useMemo(()=>agencies.filter(a=>`${a.name} ${a.city} ${a.state}`.toLowerCase().includes(query.toLowerCase()) && (state==='All Nigeria'||a.state===state) && (service==='All services'||a.services.includes(service))),[query,state,service]);
  return <main>
    <aside className="sidebar">
      <div className="brand"><span className="brandMark"><Radar size={19}/></span><div><b>Agency Finder</b><small>Nigeria</small></div></div>
      <nav><a className="active"><Building2 size={18}/> Agencies</a><a><MapPin size={18}/> Nigeria Coverage</a><a><ShieldCheck size={18}/> Verification</a><a><Star size={18}/> Top Agencies</a></nav>
      <div className="sideBottom"><div className="scanBox"><Radar size={22}/><b>Discover more agencies</b><span>Scan states, cities & directories.</span><button>Start discovery <ExternalLink size={14}/></button></div><small>Agency Finder v1.0</small></div>
    </aside>
    <section className="content">
      <header><div><div className="eyebrow">NIGERIA-WIDE DIRECTORY</div><h1>Find travel agencies <span>anywhere in Nigeria.</span></h1><p>Search, verify and prioritize agencies by location and service.</p></div><button className="addBtn"><Plus size={17}/> Add agency</button></header>
      <div className="heroSearch"><Search size={20}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search agency, city or state..."/><div className="searchHint">⌘ K</div></div>
      <div className="filters"><Filter label="Location" value={state} options={states} onChange={setState}/><Filter label="Service" value={service} options={services} onChange={setService}/><div className="resultCount"><b>{filtered.length}</b> agencies found</div></div>
      <div className="stats"><Stat icon={<Building2/>} value="6+" label="Agencies indexed"/><Stat icon={<MapPin/>} value="16" label="States mapped"/><Stat icon={<ShieldCheck/>} value="4" label="Verified"/><Stat icon={<Radar/>} value="36 + FCT" label="Coverage target"/></div>
      <div className="sectionHead"><div><h2>Agency directory</h2><p>Prioritized by discovery score and data quality.</p></div><button className="sort">Highest score <ChevronDown size={16}/></button></div>
      <div className="grid">{filtered.map(a=><AgencyCard key={a.name} agency={a}/>)}{filtered.length===0&&<div className="empty">No agencies match those filters.</div>}</div>
    </section>
  </main>
}
function Filter({label,value,options,onChange}:{label:string,value:string,options:string[],onChange:(v:string)=>void}){return <label className="filter"><span>{label}</span><select value={value} onChange={e=>onChange(e.target.value)}>{options.map(o=><option key={o}>{o}</option>)}</select></label>}
function Stat({icon,value,label}:{icon:React.ReactNode,value:string,label:string}){return <div className="stat"><span>{icon}</span><div><b>{value}</b><small>{label}</small></div></div>}
function AgencyCard({agency:a}:{agency:Agency}){return <article className="card"><div className="cardTop"><div className="avatar">{a.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div className="cardTitle"><h3>{a.name}</h3><div className="location"><MapPin size={13}/>{a.city}, {a.state}</div></div><div className="score"><b>{a.score}</b><small>score</small></div></div><div className="badges">{a.services.map(s=><span key={s}>{s}</span>)}</div><div className="meta"><span><Star size={14} fill="currentColor"/> {a.rating} <em>({a.reviews})</em></span>{a.verified?<span className="verified"><ShieldCheck size={14}/> Verified</span>:<span className="pending">Needs verification</span>}</div><div className="cardActions"><button><Phone size={14}/> Call</button><button><Globe2 size={14}/> Website</button></div></article>}
