'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, MapPin, Phone, ShieldCheck, AlertTriangle, Building2, Download, Star, Save, CalendarDays, StickyNote, CheckCircle2, Filter, Database, Upload, MessageCircle } from 'lucide-react';
import { NIGERIA_LOCATIONS, NIGERIA_STATES } from '../data/nigeria';
import { NIGERIA_AGENCY_BATCH_1 } from '../data/nigeria-agencies-batch1';
import { NIGERIA_AGENCY_BATCH_2026_09_01 } from '../data/nigeria-batch-2026-09-01';

type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Converted';
type LeadCategory = 'Travel Agency' | 'Embassy' | 'High Commission' | 'Visa Centre' | 'Visa Consultant';
type LeadMeta = { saved?: boolean; status?: LeadStatus; notes?: string; followUpDate?: string };
type Lead = { id: string; name: string; city: string; state: string; area?: string; address?: string; phone?: string; services: string[]; rating?: number; reviews?: number; source?: string; verification?: string; sourceUrl?: string };

const PAGE_SIZE = 20;
const STORAGE_KEY = 'agency-finder-lead-pipeline-v1';
const IMPORT_KEY = 'agency-finder-amadeus-import-v1';

const localLeads: Lead[] = [...NIGERIA_AGENCY_BATCH_1, ...NIGERIA_AGENCY_BATCH_2026_09_01].map((x: any, i) => ({
  ...x,
  id: x.id || `ng-${i}-${String(x.name).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  city: x.city || 'Unknown',
  state: x.state || 'Unknown',
  services: Array.isArray(x.services) ? x.services : ['Travel agency'],
}));

function category(x: Lead): LeadCategory {
  const s = `${x.name} ${(x.services || []).join(' ')}`.toLowerCase();
  if (s.includes('high commission')) return 'High Commission';
  if (s.includes('embassy')) return 'Embassy';
  if (s.includes('visa centre') || s.includes('visa center')) return 'Visa Centre';
  if (s.includes('visa consultant') || s.includes('visa consultancy')) return 'Visa Consultant';
  return 'Travel Agency';
}

function score(x: Lead) {
  const r = Math.min(100, ((x.rating || 0) / 5) * 100);
  const v = x.verification === 'VERIFIED' ? 100 : x.verification === 'DIRECTORY LISTED' ? 70 : 55;
  const c = x.phone ? 90 : 35;
  const rv = Math.min(100, 35 + Math.log10(Math.max(1, x.reviews || 0)) * 20);
  return Math.round(r * 0.3 + rv * 0.2 + c * 0.2 + v * 0.3);
}

function splitDelimited(line: string, delimiter = ',') {
  const out: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { current += '"'; i++; }
      else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      out.push(current.trim()); current = '';
    } else current += ch;
  }
  out.push(current.trim());
  return out;
}

function parseImport(text: string): Lead[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const delimiter = lines[0].includes('\t') ? '\t' : lines[0].split(',').length > 1 ? ',' : ';';
  const headers = splitDelimited(lines[0], delimiter).map(x => x.toLowerCase().replace(/[^a-z0-9]+/g, ''));
  const pick = (row: string[], names: string[]) => {
    const i = headers.findIndex(h => names.some(n => h.includes(n)));
    return i >= 0 ? (row[i] || '').trim() : '';
  };
  return lines.slice(1).map((line, i) => {
    const row = splitDelimited(line, delimiter);
    const name = pick(row, ['agencyname', 'companyname', 'agency', 'name', 'travelagency', 'office']);
    if (!name) return null;
    const phone = pick(row, ['phone', 'telephone', 'mobile', 'contact']);
    return {
      id: `amadeus-${i}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${phone.replace(/\D/g, '')}`,
      name,
      city: pick(row, ['city', 'town']) || 'Abuja',
      state: pick(row, ['state', 'province', 'region']) || 'Federal Capital Territory',
      address: pick(row, ['address', 'street', 'location']),
      phone,
      services: ['Travel agency'],
      source: 'Amadeus import',
      verification: 'AMADEUS IMPORTED',
      sourceUrl: pick(row, ['website', 'url', 'web']) || undefined,
    } as Lead;
  }).filter(Boolean) as Lead[];
}

function exportCSV(rows: Lead[], meta: Record<string, LeadMeta>) {
  const cols = ['name', 'category', 'state', 'city', 'area', 'address', 'phone', 'services', 'rating', 'reviews', 'source', 'verification', 'sourceUrl', 'score', 'leadStatus', 'saved', 'notes', 'followUpDate'];
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...rows.map(x => {
    const m = meta[x.id] || {};
    return cols.map(c => esc(c === 'category' ? category(x) : c === 'services' ? x.services.join('; ') : c === 'score' ? score(x) : c === 'leadStatus' ? m.status || 'New' : c === 'saved' ? (m.saved ? 'YES' : 'NO') : c === 'notes' ? m.notes || '' : c === 'followUpDate' ? m.followUpDate || '' : (x as any)[c])).join(',');
  })].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'nigeria-travel-agency-leads.csv'; a.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const [q, setQ] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [state, setState] = useState('All Nigeria');
  const [city, setCity] = useState('All cities');
  const [service, setService] = useState('All services');
  const [verification, setVerification] = useState('All');
  const [minScore, setMinScore] = useState(0);
  const [pipeline, setPipeline] = useState<LeadStatus | 'All'>('All');
  const [savedOnly, setSavedOnly] = useState(false);
  const [meta, setMeta] = useState<Record<string, LeadMeta>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [remote, setRemote] = useState<Lead[]>([]);
  const [imported, setImported] = useState<Lead[]>([]);
  const [loadingRemote, setLoadingRemote] = useState(true);
  const [importMessage, setImportMessage] = useState('');
  const [page, setPage] = useState(1);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY); if (saved) setMeta(JSON.parse(saved));
      const importedData = localStorage.getItem(IMPORT_KEY); if (importedData) setImported(JSON.parse(importedData));
    } catch {}
    const controller = new AbortController();
    fetch('/api/nigeria-agencies?limit=4000', { signal: controller.signal })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.agencies) setRemote(d.agencies); })
      .catch(() => {})
      .finally(() => setLoadingRemote(false));
    return () => controller.abort();
  }, []);

  const persist = (next: Record<string, LeadMeta>) => {
    setMeta(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
  };
  const updateLead = (id: string, patch: LeadMeta) => persist({ ...meta, [id]: { ...(meta[id] || {}), ...patch } });

  const importFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseImport(String(reader.result || ''));
        if (!parsed.length) { setImportMessage('No agency rows detected. Export Amadeus as CSV or TSV.'); return; }
        const next = [...imported];
        const seen = new Set(next.map(x => `${x.name}|${x.city}|${x.phone || ''}`.toLowerCase()));
        for (const x of parsed) {
          const key = `${x.name}|${x.city}|${x.phone || ''}`.toLowerCase();
          if (!seen.has(key)) { seen.add(key); next.push(x); }
        }
        setImported(next);
        try { localStorage.setItem(IMPORT_KEY, JSON.stringify(next)); } catch {}
        setImportMessage(`${parsed.length} Amadeus rows imported · ${next.length} saved`);
      } catch { setImportMessage('Could not read this file. Please export Amadeus as CSV or TSV.'); }
    };
    reader.readAsText(file);
  };

  const leads = useMemo(() => {
    const out: Lead[] = []; const seen = new Set<string>();
    for (const x of [...localLeads, ...remote, ...imported]) {
      const key = `${x.name}|${x.state}|${x.city}|${x.phone || ''}`.toLowerCase().replace(/[^a-z0-9|]+/g, '');
      if (!seen.has(key)) { seen.add(key); out.push(x); }
    }
    return out;
  }, [remote, imported]);

  const cities = useMemo(() => state === 'All Nigeria' ? ['All cities', ...Array.from(new Set(Object.values(NIGERIA_LOCATIONS).flat())).sort()] : ['All cities', ...(NIGERIA_LOCATIONS[state as keyof typeof NIGERIA_LOCATIONS] || [])], [state]);
  const services = useMemo(() => ['All services', ...Array.from(new Set(leads.flatMap(x => x.services))).sort()], [leads]);

  const rows = useMemo(() => leads
    .filter(x => categoryFilter === 'All' || category(x) === categoryFilter)
    .filter(x => `${x.name} ${x.city} ${x.state} ${x.area || ''} ${x.address || ''} ${x.services.join(' ')}`.toLowerCase().includes(q.toLowerCase()))
    .filter(x => state === 'All Nigeria' || x.state === state)
    .filter(x => city === 'All cities' || x.city === city)
    .filter(x => service === 'All services' || x.services.includes(service))
    .filter(x => verification === 'All' || x.verification === verification)
    .filter(x => score(x) >= minScore)
    .filter(x => pipeline === 'All' || (meta[x.id]?.status || 'New') === pipeline)
    .filter(x => !savedOnly || !!meta[x.id]?.saved)
    .sort((a, b) => score(b) - score(a)),
    [leads, q, categoryFilter, state, city, service, verification, minScore, pipeline, savedOnly, meta]
  );

  useEffect(() => setPage(1), [q, categoryFilter, state, city, service, verification, minScore, pipeline, savedOnly]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
  const visibleRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const verified = leads.filter(x => x.verification === 'VERIFIED').length;
  const listed = leads.filter(x => x.verification === 'DIRECTORY LISTED').length;
  const covered = new Set(leads.map(x => x.state).filter(Boolean)).size;
  const converted = leads.filter(x => meta[x.id]?.status === 'Converted').length;

  return <main style={{ minHeight: '100vh', background: '#f6f7f9', color: '#17202a', fontFamily: 'Inter,system-ui,sans-serif', padding: '30px 5vw' }}>
    <div style={{ maxWidth: 1280, margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'end', marginBottom: 22 }}>
        <div><div style={eyebrow}>SALES RADAR · NIGERIA-WIDE INTELLIGENCE</div><h1 style={{ fontSize: 34, margin: '8px 0' }}>Travel Agency Lead Finder</h1><p style={{ margin: 0, color: '#7d8793' }}>Find, save, qualify and follow up travel-agency opportunities across Nigeria.</p></div>
        <div style={{ display: 'flex', gap: 8 }}><input ref={fileRef} type='file' accept='.csv,.tsv,.txt' onChange={e => { const f = e.target.files?.[0]; if (f) importFile(f); e.currentTarget.value = ''; }} style={{ display: 'none' }} /><button onClick={() => fileRef.current?.click()} style={btn}><Upload size={15}/> Import Amadeus</button><button onClick={() => exportCSV(rows, meta)} style={btn}><Download size={15}/> Export Excel/CSV</button></div>
      </header>
      {importMessage && <div style={notice}>{importMessage}</div>}

      <section style={filters}><div style={searchBox}><Search size={16}/><input value={q} onChange={e => setQ(e.target.value)} placeholder='Agency, city, area, service...' style={{ border: 0, outline: 0, padding: 10, width: '100%' }}/></div><select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option>All</option><option>Travel Agency</option><option>Embassy</option><option>High Commission</option><option>Visa Centre</option><option>Visa Consultant</option></select><select value={state} onChange={e => { setState(e.target.value); setCity('All cities'); }}><option>All Nigeria</option>{NIGERIA_STATES.map(s => <option key={s}>{s}</option>)}</select><select value={city} onChange={e => setCity(e.target.value)}>{cities.map(c => <option key={c}>{c}</option>)}</select><select value={service} onChange={e => setService(e.target.value)}>{services.map(s => <option key={s}>{s}</option>)}</select><select value={verification} onChange={e => setVerification(e.target.value)}><option>All</option><option>VERIFIED</option><option>DIRECTORY LISTED</option><option>AMADEUS IMPORTED</option><option>NEEDS VERIFICATION</option></select></section>

      <section style={stats}><Stat icon={<Building2/>} value={leads.length} label={loadingRemote ? 'Loading national index…' : 'Leads indexed'}/><Stat icon={<Database/>} value={listed} label='Directory-listed'/><Stat icon={<ShieldCheck/>} value={verified} label='Cross-checked'/><Stat icon={<MapPin/>} value={covered} label='States with data'/><Stat icon={<CheckCircle2/>} value={converted} label='Converted'/></section>

      <section style={panel}><div style={panelTitle}><Filter size={15}/> Lead Pipeline</div><div style={wrap}>{(['All','New','Contacted','Qualified','Converted'] as const).map(s => <button key={s} onClick={() => setPipeline(s)} style={{ ...pill, ...(pipeline === s ? activePill : {}) }}>{s}{s !== 'All' && <span style={{ opacity: .65, marginLeft: 5 }}>{leads.filter(x => (meta[x.id]?.status || 'New') === s).length}</span>}</button>)}<button onClick={() => setSavedOnly(!savedOnly)} style={{ ...pill, ...(savedOnly ? activePill : {}) }}><Save size={12}/> Saved only</button><select value={minScore} onChange={e => setMinScore(Number(e.target.value))} style={{ marginLeft: 'auto' }}><option value={0}>Any score</option><option value={60}>60+</option><option value={70}>70+</option><option value={80}>80+</option><option value={90}>90+</option></select></div></section>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', marginBottom: 10 }}><div><h2 style={{ fontSize: 20, margin: 0 }}>Priority opportunities</h2><p style={{ fontSize: 12, color: '#7d8793', margin: '4px 0 0' }}>{rows.length} matching leads · showing {rows.length ? ((page - 1) * PAGE_SIZE + 1) : 0}-{Math.min(page * PAGE_SIZE, rows.length)}</p></div><span style={pageInfo}>Page {page} of {totalPages}</span></div>

      <div style={{ display: 'grid', gap: 10 }}>
        {visibleRows.map(x => {
          const m = meta[x.id] || {}; const open = openId === x.id; const digits = (x.phone || '').replace(/\D/g, '');
          return <article key={x.id} style={card}>
            <div style={top}><div><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><h3 style={{ fontSize: 15, margin: 0 }}>{x.name}</h3>{x.verification === 'VERIFIED' ? <ShieldCheck size={15}/> : <AlertTriangle size={15}/>}</div><div style={sub}><MapPin size={13}/>{x.city}, {x.state}{x.area ? ` · ${x.area}` : ''}</div><div style={address}>{x.address || 'Address not listed'}</div></div><div style={{ textAlign: 'right' }}><b style={{ fontSize: 22 }}>{score(x)}</b><div style={{ fontSize: 9, color: '#7d8793' }}>OPPORTUNITY</div></div></div>
            <div style={tags}><span style={tag}>{category(x)}</span>{x.services.map(s => <span key={s} style={tag}>{s}</span>)}</div>
            <div style={bottom}><span style={sub}><Phone size={13}/>{x.phone || 'Phone not listed'}</span><span style={source}>{x.rating ? <><Star size={12} fill='currentColor'/> {x.rating} ({x.reviews || 0}) · </> : ''}{x.source || 'Public listing'}</span><div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end' }}>{digits && <><a href={`tel:${x.phone}`} style={actionLink}>☎ Call</a><a href={`https://wa.me/${digits}`} target='_blank' rel='noopener noreferrer' style={{ ...actionLink, background: '#4f46e5', color: '#fff', borderColor: '#4f46e5' }}><MessageCircle size={12}/> WhatsApp</a></>}<select value={m.status || 'New'} onChange={e => updateLead(x.id, { status: e.target.value as LeadStatus })}><option>New</option><option>Contacted</option><option>Qualified</option><option>Converted</option></select><button onClick={() => updateLead(x.id, { saved: !m.saved })} style={smallBtn}><Save size={13}/>{m.saved ? 'Saved' : 'Save'}</button><button onClick={() => setOpenId(open ? null : x.id)} style={smallBtn}>{open ? 'Close' : 'Follow-up'}</button></div></div>
            {open && <div style={follow}><label><StickyNote size={14}/><textarea value={m.notes || ''} onChange={e => updateLead(x.id, { notes: e.target.value })} placeholder='Notes about this agency...' style={{ width: '100%', minHeight: 70, border: '1px solid #dce1e6', borderRadius: 7, padding: 8 }}/></label><label><CalendarDays size={14}/><input type='date' value={m.followUpDate || ''} onChange={e => updateLead(x.id, { followUpDate: e.target.value })} style={{ display: 'block', marginTop: 6, width: '100%', border: '1px solid #dce1e6', borderRadius: 7, padding: 8 }}/><span style={{ display: 'block', marginTop: 8 }}>Status: <b>{m.status || 'New'}</b></span></label></div>}
          </article>;
        })}
        {!rows.length && <div style={{ background: '#fff', padding: 40, textAlign: 'center', borderRadius: 12 }}>No matching agencies.</div>}
      </div>

      {totalPages > 1 && <nav style={pager} aria-label='Lead pages'><button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={pageButton}>‹ Prev</button>{pageNumbers(page, totalPages).map(p => <button key={p} onClick={() => setPage(p)} style={{ ...pageButton, ...(p === page ? activePageButton : {}) }}>{p}</button>)}<button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={pageButton}>Next ›</button></nav>}

      <p style={{ fontSize: 10, color: '#9099a3', marginTop: 18 }}>National expansion is sourced from public directory listings. Imported Amadeus records are kept separate as AMADEUS IMPORTED and can be filtered before outreach.</p>
    </div>
  </main>;
}

function pageNumbers(current: number, total: number) {
  const start = Math.max(1, Math.min(current - 2, total - 4));
  const end = Math.min(total, start + 4);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) { return <div style={stat}><span>{icon}</span><div><b style={{ fontSize: 20 }}>{value}</b><div style={{ fontSize: 10, color: '#7d8793' }}>{label}</div></div></div>; }

const eyebrow = { fontSize: 11, fontWeight: 800, letterSpacing: '.12em', color: '#738091' } as const;
const btn = { border: '1px solid #d7dce1', background: '#fff', borderRadius: 9, padding: '11px 14px', display: 'flex', gap: 7, alignItems: 'center', cursor: 'pointer' } as const;
const notice = { background: '#eef6ff', border: '1px solid #cfe1f5', borderRadius: 9, padding: '9px 12px', fontSize: 11, marginBottom: 12 } as const;
const filters = { display: 'grid', gridTemplateColumns: '2fr repeat(5,1fr)', gap: 9, marginBottom: 14 } as const;
const searchBox = { background: '#fff', border: '1px solid #d7dce1', borderRadius: 9, display: 'flex', alignItems: 'center', paddingLeft: 10 } as const;
const stats = { display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 9, marginBottom: 14 } as const;
const stat = { background: '#fff', border: '1px solid #e1e5e9', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 } as const;
const panel = { background: '#fff', border: '1px solid #e1e5e9', borderRadius: 10, padding: 12, marginBottom: 18 } as const;
const panelTitle = { fontSize: 11, fontWeight: 800, color: '#52606d', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 } as const;
const wrap = { display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' } as const;
const pill = { border: '1px solid #dfe4e8', background: '#fff', color: '#475467', borderRadius: 999, padding: '7px 11px', fontSize: 11, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 } as const;
const activePill = { background: '#eef0ff', borderColor: '#cfd2ff', color: '#4f46e5' } as const;
const card = { background: '#fff', border: '1px solid #dfe4e8', borderRadius: 14, padding: 16 } as const;
const top = { display: 'flex', justifyContent: 'space-between', gap: 16 } as const;
const sub = { color: '#7d8793', fontSize: 11, display: 'flex', alignItems: 'center', gap: 5 } as const;
const address = { color: '#7d8793', fontSize: 11, marginTop: 5 } as const;
const tags = { display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0' } as const;
const tag = { background: '#f4f6f8', border: '1px solid #e5e8ec', borderRadius: 6, padding: '4px 7px', fontSize: 10, color: '#667085' } as const;
const bottom = { borderTop: '1px solid #edf0f2', paddingTop: 10, display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' } as const;
const source = { color: '#7d8793', fontSize: 10, display: 'flex', alignItems: 'center', gap: 3 } as const;
const smallBtn = { border: '1px solid #dfe4e8', background: '#fff', borderRadius: 7, padding: '7px 10px', fontSize: 10, fontWeight: 700, color: '#475467', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 } as const;
const actionLink = { border: '1px solid #dfe4e8', background: '#fff', borderRadius: 7, padding: '7px 10px', fontSize: 10, fontWeight: 700, color: '#475467', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 } as const;
const follow = { marginTop: 10, borderTop: '1px solid #edf0f2', paddingTop: 10, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, fontSize: 11 } as const;
const pageInfo = { fontSize: 11, color: '#7d8793', whiteSpace: 'nowrap' } as const;
const pager = { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, flexWrap: 'wrap', margin: '16px 0 28px' } as const;
const pageButton = { border: '1px solid #dfe4e8', borderRadius: 8, background: '#fff', color: '#17202a', padding: '7px 11px', fontSize: 11, fontWeight: 700, cursor: 'pointer' } as const;
const activePageButton = { background: '#4f46e5', color: '#fff', borderColor: '#4f46e5' } as const;
