'use client';
import { useEffect, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import type { ForensicCase, TimelineEvent, ExtractionStep, EvidenceItem } from '@/types';

export default function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [fc, setFc] = useState<ForensicCase | null>(null);

  useEffect(() => {
    fetch(`/api/forensic?id=${id}`).then(r => r.json()).then(d => setFc(d.case));
  }, [id]);

  if (!fc) return <div style={{ background:'var(--bg)', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Geist Mono,monospace', fontSize:11, color:'var(--text3)' }}>Loading case file...</div>;

  const SEV_COL: Record<string,string> = { info:'var(--cyan)', warning:'var(--amber)', critical:'var(--red)' };

  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh', fontFamily:'Syne,sans-serif' }}>
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 32px', borderBottom:'1px solid var(--border)', background:'rgba(8,10,15,0.9)', backdropFilter:'blur(20px)' }}>
        <Link href="/" style={{ textDecoration:'none', color:'inherit' }}>
          <div style={{ fontFamily:'Geist Mono,monospace', fontSize:13, letterSpacing:'0.15em', cursor:'pointer' }}>RUG DNA</div>
        </Link>
        <Link href="/dashboard" style={{ fontFamily:'Geist Mono,monospace', fontSize:10, color:'var(--text2)', textDecoration:'none' }}>← MONITOR</Link>
      </nav>

      <div style={{ maxWidth:1100, margin:'0 auto', padding:'88px 32px 60px' }}>
        {/* Case header */}
        <div style={{ marginBottom:40, paddingBottom:32, borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, color:'var(--text3)', letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:8 }}>Forensic Case File · Auto-Generated</div>
          <div style={{ display:'flex', alignItems:'center', gap:16, marginBottom:12 }}>
            <div style={{ fontSize:44, fontWeight:800, color:'var(--red)', letterSpacing:'-0.02em' }}>{fc.id}</div>
            <span className="badge badge-critical" style={{ fontSize:11, padding:'6px 16px' }}>{fc.severity?.toUpperCase()} · {Math.round((fc.confidence||0)*100)}% Confidence</span>
            <span style={{ fontFamily:'Geist Mono,monospace', fontSize:10, color: fc.status==='open' ? 'var(--red)' : 'var(--green)', border:'1px solid', borderColor: fc.status==='open' ? 'rgba(255,59,59,0.3)' : 'rgba(0,255,136,0.3)', padding:'4px 10px' }}>{fc.status?.toUpperCase()}</span>
          </div>
          <div style={{ fontFamily:'Geist Mono,monospace', fontSize:12, color:'var(--text2)' }}>{`$${fc.tokenSymbol}`} · Triggered: {new Date(fc.triggeredAt).toLocaleString()}</div>
        </div>

        {/* AI Narrative */}
        <div style={{ background:'var(--bg2)', borderLeft:'3px solid var(--red)', padding:'24px 28px', marginBottom:32 }}>
          <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, color:'var(--red)', letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:12 }}>⬡ Forensic Intelligence Report</div>
          <div style={{ fontFamily:'Geist Mono,monospace', fontSize:12, color:'var(--text2)', lineHeight:1.75, whiteSpace:'pre-wrap' }}>{fc.narrative}</div>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, background:'var(--border)', marginBottom:32 }}>
          {[
            { l:'Victim Wallets', v: fc.victimWallets?.length || 0, c:'var(--red)' },
            { l:'Estimated Loss', v: fc.estimatedLoss ? `$${Math.round(fc.estimatedLoss).toLocaleString()}` : 'N/A', c:'var(--amber)' },
            { l:'Trigger Score', v: fc.triggerScore, c:'var(--red)' },
            { l:'Linked Wallets', v: fc.linkedWallets?.length || 0, c:'var(--text)' },
          ].map(s => (
            <div key={s.l} style={{ background:'var(--bg2)', padding:'20px 24px' }}>
              <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:8 }}>{s.l}</div>
              <div style={{ fontSize:28, fontWeight:800, color:s.c }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Timeline + Extraction */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1, background:'var(--border)', marginBottom:32 }}>
          <div style={{ background:'var(--bg2)', padding:28 }}>
            <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, letterSpacing:'0.15em', color:'var(--text3)', textTransform:'uppercase', marginBottom:20 }}>Incident Timeline</div>
            {(fc.timeline || []).map((t: TimelineEvent) => (
              <div key={t.id} style={{ display:'flex', gap:14, paddingBottom:20, position:'relative' }}>
                <div style={{ position:'absolute', left:7, top:16, bottom:0, width:1, background:'var(--border)' }}/>
                <div style={{ width:15, height:15, borderRadius:'50%', border:'1px solid', borderColor: SEV_COL[t.severity], background: `${SEV_COL[t.severity]}22`, flexShrink:0, marginTop:2, position:'relative', zIndex:1 }}/>
                <div>
                  <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, color:'var(--text3)', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:4 }}>{new Date(t.timestamp).toLocaleString()} · {t.label}</div>
                  <div style={{ fontFamily:'Geist Mono,monospace', fontSize:11, color:'var(--text2)', lineHeight:1.5 }}>{t.description}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background:'var(--bg2)', padding:28 }}>
            <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, letterSpacing:'0.15em', color:'var(--text3)', textTransform:'uppercase', marginBottom:20 }}>Extraction Path</div>
            {(fc.extractionPath || []).map((s: ExtractionStep) => (
              <div key={s.step} style={{ padding:'12px 0', borderBottom:'1px solid var(--border)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                  <span style={{ fontFamily:'Geist Mono,monospace', fontSize:9, color:'var(--text3)', background:'var(--surface2)', padding:'2px 6px' }}>STEP {s.step}</span>
                  <span style={{ fontFamily:'Geist Mono,monospace', fontSize:10, color:'var(--text2)' }}>{s.action}</span>
                </div>
                <div style={{ fontFamily:'Geist Mono,monospace', fontSize:10, color:'var(--text3)' }}>
                  {s.fromAddress?.slice(0,10)}... → {s.toAddress?.slice(0,10)}...
                  {s.amountUsd > 0 && <span style={{ color:'var(--amber)', marginLeft:8 }}>${s.amountUsd.toLocaleString()}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Evidence */}
        <div style={{ marginBottom:32 }}>
          <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, letterSpacing:'0.2em', color:'var(--text3)', textTransform:'uppercase', marginBottom:12 }}>Evidence Items ({fc.evidenceItems?.length || 0})</div>
          <div style={{ display:'flex', flexDirection:'column', gap:1, background:'var(--border)' }}>
            {(fc.evidenceItems || []).map((e: EvidenceItem, i: number) => (
              <div key={e.id} style={{ background:'var(--bg2)', padding:'18px 24px', display:'flex', gap:16 }}>
                <span style={{ fontFamily:'Geist Mono,monospace', fontSize:10, color:'var(--text3)', width:24, flexShrink:0 }}>{String(i+1).padStart(2,'0')}</span>
                <div style={{ flex:1 }}>
                  <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, color:'var(--cyan)', letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:4 }}>{e.signal}</div>
                  <div style={{ fontFamily:'Geist Mono,monospace', fontSize:11, color:'var(--text2)', lineHeight:1.6 }}>{e.description}</div>
                </div>
                <span style={{ fontFamily:'Geist Mono,monospace', fontSize:13, fontWeight:700, color: e.weight > 15 ? 'var(--red)' : 'var(--amber)', flexShrink:0 }}>+{e.weight}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Linked wallets */}
        <div>
          <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, letterSpacing:'0.2em', color:'var(--text3)', textTransform:'uppercase', marginBottom:12 }}>Linked Wallets ({fc.linkedWallets?.length || 0})</div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {(fc.linkedWallets || []).slice(0,20).map((w: string) => (
              <span key={w} style={{ fontFamily:'Geist Mono,monospace', fontSize:10, color:'var(--cyan)', background:'rgba(0,229,255,0.05)', border:'1px solid rgba(0,229,255,0.15)', padding:'4px 10px' }}>{w.slice(0,10)}...{w.slice(-6)}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
