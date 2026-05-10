'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';

type Project = { id: string; tokenSymbol: string; tokenName: string; chain: string; currentRiskScore: number; currentRiskLevel: string; confidence: number; holderCount: number; forensicCaseId?: string; updatedAt: number; };
type LiveEvent = { id: string; tokenSymbol: string; severity: string; message: string; timestamp: number; };
type Stats = { totalProjects: number; critical: number; high: number; openCases: number; };

const RISK_COLOR: Record<string,string> = { critical:'#ff3b3b', high:'#ff7a00', moderate:'#ffb300', low:'#00ff88' };
const RISK_LABEL: Record<string,string> = { critical:'Critical', high:'High', moderate:'Moderate', low:'Low' };

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<Stats>({ totalProjects:0, critical:0, high:0, openCases:0 });
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeMode, setActiveMode] = useState<'monitor'|'forensic'|'governance'>('monitor');
  const esRef = useRef<EventSource|null>(null);

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(d => {
      setProjects(d.projects || []);
      setStats(d.stats || {});
      setLoading(false);
    });
    const es = new EventSource('/api/stream');
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data);
        setEvents(prev => [ev, ...prev].slice(0, 30));
      } catch {}
    };
    return () => es.close();
  }, []);

  const filteredProjects = activeMode === 'forensic'
    ? projects.filter(p => p.forensicCaseId)
    : activeMode === 'governance'
    ? projects.filter(p => p.currentRiskScore > 40)
    : projects;

  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh', fontFamily:'Syne,sans-serif' }}>
      {/* Scan line */}
      <div style={{ position:'fixed', top:0, left:0, right:0, height:'1px', background:'linear-gradient(90deg,transparent,rgba(0,229,255,0.25),transparent)', animation:'scanLine 10s linear infinite', pointerEvents:'none', zIndex:9998 }} />

      {/* NAV */}
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 32px', borderBottom:'1px solid var(--border)', background:'rgba(8,10,15,0.9)', backdropFilter:'blur(20px)' }}>
        <div style={{ fontFamily:'Geist Mono,monospace', fontSize:13, letterSpacing:'0.15em', display:'flex', alignItems:'center', gap:10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M6 3C6 3 8 6 12 6C16 6 18 3 18 3" stroke="rgba(0,229,255,0.7)" strokeWidth="1.5"/>
            <path d="M6 21C6 21 8 18 12 18C16 18 18 21 18 21" stroke="rgba(0,229,255,0.7)" strokeWidth="1.5"/>
            <circle cx="12" cy="9" r="1.5" fill="rgba(0,229,255,0.6)"/>
            <circle cx="12" cy="12" r="1.5" fill="rgba(255,255,255,0.3)"/>
            <circle cx="12" cy="15" r="1.5" fill="rgba(255,59,59,0.6)"/>
          </svg>
          RUG DNA
        </div>
        <div style={{ display:'flex', gap:24, alignItems:'center' }}>
          {(['monitor','forensic','governance'] as const).map(m => (
            <button key={m} onClick={() => setActiveMode(m)}
              style={{ fontFamily:'Geist Mono,monospace', fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase', background:'none', border:'none', cursor:'pointer', color: activeMode===m ? 'var(--text)' : 'var(--text3)', borderBottom: activeMode===m ? '1px solid var(--text)' : '1px solid transparent', paddingBottom:2 }}>
              {m === 'monitor' ? '◈ Monitor' : m === 'forensic' ? '⬡ Forensic' : '△ Governance'}
            </button>
          ))}
          <span className="live-dot">Live</span>
          <span style={{ fontFamily:'Geist Mono,monospace', fontSize:9, color:'var(--text3)', letterSpacing:'0.1em' }}>GoldRush ●</span>
        </div>
      </nav>

      {/* TICKER */}
      <div style={{ position:'fixed', top:57, left:0, right:0, zIndex:99, overflow:'hidden', borderBottom:'1px solid var(--border)', padding:'10px 0', background:'var(--bg2)' }}>
        <div style={{ display:'flex', gap:60, animation:'ticker 40s linear infinite', width:'max-content' }}>
          {[...events, ...events].map((e,i) => (
            <span key={i} style={{ fontFamily:'Geist Mono,monospace', fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color: e.severity==='critical' ? 'var(--red)' : e.severity==='warning' ? 'var(--amber)' : 'var(--text3)', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:12 }}>
              <span style={{ fontSize:5 }}>◆</span> {e.message}
            </span>
          ))}
          {/* Static fallback */}
          {events.length === 0 && ['$RUGX — Forensic case FCS-2847 OPEN · 97% confidence', '$MOONFI — Holder concentration 61% · High risk', '$GOVTKN — 3 wallets control 91% of votes', 'GoldRush streaming — Connected · Monitoring active'].map((t,i) => (
            <span key={`s${i}`} style={{ fontFamily:'Geist Mono,monospace', fontSize:10, letterSpacing:'0.1em', textTransform:'uppercase', color:i===0?'var(--red)':i===1?'var(--amber)':'var(--text3)', whiteSpace:'nowrap', display:'flex', alignItems:'center', gap:12 }}><span style={{fontSize:5}}>◆</span>{t}</span>
          ))}
        </div>
      </div>

      {/* MAIN LAYOUT */}
      <div style={{ display:'grid', gridTemplateColumns:'260px 1fr 300px', minHeight:'100vh', paddingTop:97 }}>

        {/* SIDEBAR */}
        <aside style={{ borderRight:'1px solid var(--border)', padding:'24px 0', position:'sticky', top:97, height:'calc(100vh - 97px)', overflowY:'auto', background:'var(--bg)' }}>
          {/* Stats */}
          <div style={{ padding:'0 20px 20px', borderBottom:'1px solid var(--border)', marginBottom:20 }}>
            <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, letterSpacing:'0.2em', color:'var(--text3)', textTransform:'uppercase', marginBottom:12 }}>Intelligence Summary</div>
            {[
              { label:'Projects', val: loading ? '...' : stats.totalProjects },
              { label:'Critical', val: loading ? '...' : stats.critical, color:'var(--red)' },
              { label:'High Risk', val: loading ? '...' : stats.high, color:'#ff7a00' },
              { label:'Open Cases', val: loading ? '...' : stats.openCases, color:'var(--amber)' },
            ].map(s => (
              <div key={s.label} style={{ display:'flex', justifyContent:'space-between', padding:'6px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontFamily:'Geist Mono,monospace', fontSize:10, color:'var(--text3)' }}>{s.label}</span>
                <span style={{ fontFamily:'Geist Mono,monospace', fontSize:11, fontWeight:700, color: s.color || 'var(--text)' }}>{s.val}</span>
              </div>
            ))}
          </div>
          {/* Modes */}
          <div style={{ padding:'0 20px 20px', borderBottom:'1px solid var(--border)', marginBottom:20 }}>
            <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, letterSpacing:'0.2em', color:'var(--text3)', textTransform:'uppercase', marginBottom:10 }}>Intelligence Modes</div>
            {([['monitor','◈ Risk Monitor'],['forensic','⬡ Forensic Cases'],['governance','△ Governance']] as const).map(([m,label]) => (
              <div key={m} onClick={() => setActiveMode(m)} style={{ padding:'8px 12px', marginBottom:2, cursor:'pointer', background: activeMode===m ? 'var(--surface2)' : 'transparent', borderLeft: activeMode===m ? '2px solid var(--cyan)' : '2px solid transparent', fontFamily:'Geist Mono,monospace', fontSize:11, color: activeMode===m ? 'var(--text)' : 'var(--text2)' }}>
                {label}
              </div>
            ))}
          </div>
          {/* Chains */}
          <div style={{ padding:'0 20px' }}>
            <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, letterSpacing:'0.2em', color:'var(--text3)', textTransform:'uppercase', marginBottom:10 }}>Chains</div>
            {['Ethereum','Base','Solana ★'].map(c => (
              <div key={c} style={{ padding:'6px 12px', fontFamily:'Geist Mono,monospace', fontSize:11, color: c.includes('soon') ? 'var(--text3)' : 'var(--text2)', borderBottom:'1px solid var(--border)' }}>{c}</div>
            ))}
          </div>
        </aside>

        {/* MAIN CONTENT */}
        <main style={{ padding:'24px 32px', overflowY:'auto' }}>
          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
            <div>
              <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, letterSpacing:'0.2em', color:'var(--text3)', textTransform:'uppercase', marginBottom:4 }}>
                {activeMode === 'monitor' ? 'Active Risk Monitor' : activeMode === 'forensic' ? 'Forensic Case Files' : 'Governance Trust Analysis'}
              </div>
              <div style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.02em' }}>
                {activeMode === 'monitor' ? 'Projects — Sorted by Risk' : activeMode === 'forensic' ? 'Open Investigations' : 'Governance Intelligence'}
              </div>
            </div>
            <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, color:'var(--text3)' }}>
              {filteredProjects.length} projects · Updated just now
            </div>
          </div>

          {/* Column headers */}
          <div style={{ display:'grid', gridTemplateColumns:'90px 1fr 120px 80px 100px 80px', padding:'8px 12px', borderBottom:'1px solid var(--border)', fontFamily:'Geist Mono,monospace', fontSize:9, letterSpacing:'0.15em', color:'var(--text3)', textTransform:'uppercase' }}>
            <span>Ticker</span><span>Project</span>
            <span>Risk Bar</span><span>Score</span>
            <span>Level</span><span>{activeMode === 'forensic' ? 'Case' : 'Holders'}</span>
          </div>

          {/* Project rows */}
          {loading ? (
            <div style={{ padding:'40px 0', textAlign:'center', fontFamily:'Geist Mono,monospace', fontSize:11, color:'var(--text3)' }}>Loading intelligence data...</div>
          ) : filteredProjects.length === 0 ? (
            <div style={{ padding:'40px 0', textAlign:'center', fontFamily:'Geist Mono,monospace', fontSize:11, color:'var(--text3)' }}>No projects in this category.</div>
          ) : filteredProjects.map(p => {
            const col = RISK_COLOR[p.currentRiskLevel] || '#888';
            return (
              <Link key={p.id} href={`/project/${p.id}`} style={{ textDecoration:'none', display:'block' }}>
                <div style={{ display:'grid', gridTemplateColumns:'90px 1fr 120px 80px 100px 80px', padding:'14px 12px', borderBottom:'1px solid var(--border)', alignItems:'center', transition:'background .15s', cursor:'pointer' }}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--surface)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}>
                  <span style={{ fontFamily:'Geist Mono,monospace', fontSize:13, fontWeight:600, color:col }}>${p.tokenSymbol}</span>
                  <span style={{ fontSize:12, color:'var(--text2)' }}>{p.tokenName} · {p.chain}</span>
                  <div style={{ height:3, background:'var(--surface2)', borderRadius:1, overflow:'hidden' }}>
                    <div style={{ height:'100%', width:`${p.currentRiskScore}%`, background:col, borderRadius:1, transition:'width 1s ease' }} />
                  </div>
                  <span style={{ fontFamily:'Geist Mono,monospace', fontSize:12, fontWeight:700, color:col }}>{p.currentRiskScore}</span>
                  <span className={`badge badge-${p.currentRiskLevel}`}>{RISK_LABEL[p.currentRiskLevel]}</span>
                  <span style={{ fontFamily:'Geist Mono,monospace', fontSize:10, color:'var(--text3)' }}>
                    {activeMode === 'forensic' ? (p.forensicCaseId ? p.forensicCaseId.slice(0,8) : '—') : p.holderCount.toLocaleString()}
                  </span>
                </div>
              </Link>
            );
          })}

          {/* Add project input */}
          <div style={{ marginTop:32, padding:20, background:'var(--bg2)', border:'1px solid var(--border)' }}>
            <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, letterSpacing:'0.15em', color:'var(--text3)', textTransform:'uppercase', marginBottom:12 }}>Monitor New Project</div>
            <AddProjectForm onAdded={(p) => setProjects(prev => [p, ...prev])} />
          </div>
        </main>

        {/* INTEL SIDEBAR */}
        <aside style={{ borderLeft:'1px solid var(--border)', padding:20, position:'sticky', top:97, height:'calc(100vh - 97px)', overflowY:'auto', display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, letterSpacing:'0.2em', color:'var(--text3)', textTransform:'uppercase', marginBottom:8, paddingBottom:10, borderBottom:'1px solid var(--border)' }}>Live Intelligence Feed</div>
          {events.slice(0,12).map(e => (
            <div key={e.id} className={`intel-event ${e.severity}`} style={{ animation:'fadeUp .4s ease' }}>
              <div style={{ fontSize:11 }}>{e.message}</div>
              <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, color:'var(--text3)', marginTop:4 }}>
                {new Date(e.timestamp).toLocaleTimeString()} · {e.severity.toUpperCase()}
              </div>
            </div>
          ))}
          {events.length === 0 && (
            <div style={{ fontFamily:'Geist Mono,monospace', fontSize:10, color:'var(--text3)', textAlign:'center', paddingTop:20 }}>Connecting to stream...</div>
          )}
        </aside>
      </div>
    </div>
  );
}

function AddProjectForm({ onAdded }: { onAdded: (p: Project) => void }) {
  const [addr, setAddr] = useState('');
  const [chain, setChain] = useState('eth-mainnet');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async () => {
    if (!addr) return;
    setLoading(true);
    const r = await fetch('/api/projects', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ tokenAddress: addr, chain }) });
    const d = await r.json();
    if (d.project) onAdded(d.project);
    setAddr(''); setLoading(false);
  };
  return (
    <div style={{ display:'flex', gap:8 }}>
      <input value={addr} onChange={e => setAddr(e.target.value)} placeholder="Token contract address (0x...)"
        style={{ flex:1, padding:'8px 12px', background:'var(--bg3)', border:'1px solid var(--border2)', color:'var(--text)', fontFamily:'Geist Mono,monospace', fontSize:11, outline:'none' }} />
      <select value={chain} onChange={e => setChain(e.target.value)}
        style={{ padding:'8px 12px', background:'var(--bg3)', border:'1px solid var(--border2)', color:'var(--text)', fontFamily:'Geist Mono,monospace', fontSize:11 }}>
        <option value="eth-mainnet">ETH</option>
        <option value="base-mainnet">BASE</option>
        <option value="matic-mainnet">MATIC</option>
      <option value="solana-mainnet">SOL</option>
      </select>
      <button onClick={handleSubmit} disabled={loading}
        style={{ padding:'8px 16px', background: loading ? 'var(--surface2)' : 'var(--text)', color:'var(--bg)', fontFamily:'Geist Mono,monospace', fontSize:11, border:'none', cursor:'pointer', letterSpacing:'0.1em' }}>
        {loading ? '...' : 'ADD'}
      </button>
    </div>
  );
}
