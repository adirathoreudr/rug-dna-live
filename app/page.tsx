'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

const TICKER_ITEMS = [
  { text: 'CRITICAL · $RUGX — Deployer wallet reuse detected — 97% confidence', type: 'alert' },
  { text: 'WARNING · $MOONFI — Holder concentration spike to 78%', type: 'warn' },
  { text: 'MONITOR · $DEXLP — New pair · 14 wallets funded from same source', type: '' },
  { text: 'FORENSIC CASE OPENED · FCS-2847 · Coordinated exit detected', type: 'alert' },
  { text: 'GOVERNANCE · $VOTETOKEN — 3 wallets control 91% of votes', type: 'warn' },
  { text: 'SOLANA · $BONK — 890K holders monitored · Risk: LOW', type: '' },
  { text: 'SOLANA · $WIF — Behavioral graph updated · 340K holders', type: '' },
  { text: 'BASE · $BRETT — New cluster detected · 7 wallets, shared funder', type: 'warn' },
];

const RISK_TIERS = [
  { level: 'Low', score: 12, col: '#00ff88', bg: 'rgba(0,255,136,0.1)', border: 'rgba(0,255,136,0.2)', signals: ['Deployer wallet — clean history','Holder distribution — 8,472 addresses','Liquidity — stable over 72hr','Early buyers — no cluster signal'] },
  { level: 'Moderate', score: 47, col: '#ffb300', bg: 'rgba(255,179,0,0.12)', border: 'rgba(255,179,0,0.25)', signals: ['Top-5 holders: 34% of supply','7 early wallets — shared funder','Liquidity lock: unverified','Transfer velocity: elevated'] },
  { level: 'High', score: 74, col: '#ff7a00', bg: 'rgba(255,122,0,0.12)', border: 'rgba(255,122,0,0.25)', signals: ['Deployer: 3 prior rugs matched','23 wallets funded within 4 min','Top holder: 61% supply controlled','Forensic case: pending trigger'] },
  { level: 'Critical', score: 96, col: '#ff3b3b', bg: 'rgba(255,59,59,0.12)', border: 'rgba(255,59,59,0.25)', signals: ['Case FCS-2847: OPEN','Extraction path: traced to CEX','41 victim wallets identified','Confidence: 97%'] },
];

export default function Landing() {
  const [counts, setCounts] = useState({ projects: 0, cases: 0, accuracy: 0, value: 0, latency: 0 });
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Counter animation
    const targets = { projects: 2847, cases: 341, accuracy: 94, value: 127, latency: 18 };
    const duration = 1800;
    const start = Date.now();
    const tick = () => {
      const p = Math.min((Date.now() - start) / duration, 1);
      const e = 1 - Math.pow(1 - p, 3);
      setCounts({
        projects: Math.floor(e * targets.projects),
        cases: Math.floor(e * targets.cases),
        accuracy: Math.floor(e * targets.accuracy),
        value: Math.floor(e * targets.value),
        latency: Math.floor(e * targets.latency),
      });
      if (p < 1) requestAnimationFrame(tick);
    };
    const timer = setTimeout(() => requestAnimationFrame(tick), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ background: '#080a0f', minHeight: '100vh', color: '#fff', fontFamily: 'Syne, sans-serif', overflowX: 'hidden' }}>
      {/* Scan line */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,rgba(0,229,255,0.3),transparent)', animation: 'scanLine 10s linear infinite', pointerEvents: 'none', zIndex: 9998 }} />

      {/* NAV */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 40px', borderBottom: '1px solid rgba(255,255,255,0.07)', background: 'rgba(8,10,15,0.88)', backdropFilter: 'blur(20px)' }}>
        <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 13, letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: 10 }}>
          <DnaIcon />
          RUG DNA
        </div>
        <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
          {[['#monitor', 'Monitor'], ['#forensic', 'Forensic'], ['#governance', 'Governance'], ['#architecture', 'Architecture']].map(([href, label]) => (
            <a key={href} href={href} style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.45)', textDecoration: 'none', textTransform: 'uppercase' }}>{label}</a>
          ))}
        </div>
        <Link href="/dashboard">
          <button style={btnOutline}>Launch Intelligence →</button>
        </Link>
      </nav>

      {/* HERO */}
      <section style={{ minHeight: '100vh', display: 'grid', gridTemplateRows: '1fr auto', position: 'relative', overflow: 'hidden' }}>
        {/* Circuit BG */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 70% 50%, rgba(0,229,255,0.04) 0%, transparent 70%), radial-gradient(ellipse 40% 60% at 20% 80%, rgba(155,89,255,0.03) 0%, transparent 60%)' }} />
        <CircuitBg />

        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '140px 40px 60px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.28)', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 24, height: 1, background: 'rgba(255,255,255,0.28)', display: 'inline-block' }} />
            <LiveDot /> &nbsp;·&nbsp; GoldRush Powered &nbsp;·&nbsp; ETH · BASE · SOLANA
          </div>

          <h1 style={{ fontSize: 'clamp(56px, 9vw, 118px)', fontWeight: 800, lineHeight: 0.92, letterSpacing: '-0.03em', marginBottom: 40 }}>
            <span style={{ display: 'block' }}>DETECT.</span>
            <span style={{ display: 'block' }}>INVESTIGATE.</span>
            <span style={{ display: 'block', color: 'rgba(255,255,255,0.28)' }}>TRUST-<span style={{ color: 'transparent', WebkitTextStroke: '1px rgba(255,255,255,0.28)' }}>SCORE.</span></span>
          </h1>

          <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,0.55)', maxWidth: 480, marginBottom: 52 }}>
            Onchain behavioral intelligence that decodes wallet coordination, reconstructs rug paths, and measures governance legitimacy — before the damage is done.
          </p>

          <div style={{ display: 'flex', gap: 16 }}>
            <Link href="/dashboard">
              <button style={btnPrimary}>Open Intelligence Console</button>
            </Link>
            <a href="#architecture">
              <button style={btnOutline}>View Architecture</button>
            </a>
          </div>
        </div>

        {/* Hero stats */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', gap: 0, borderTop: '1px solid rgba(255,255,255,0.07)', margin: '0 40px' }}>
          {[
            { val: counts.projects.toLocaleString(), label: 'Projects Monitored' },
            { val: counts.cases.toString(), label: 'Active Forensic Cases' },
            { val: counts.accuracy + '%', label: 'Detection Accuracy' },
            { val: '$' + counts.value + 'M', label: 'Value Protected' },
            { val: counts.latency + 'ms', label: 'Avg Alert Latency' },
          ].map((s, i) => (
            <div key={i} style={{ flex: 1, padding: '28px 0', borderRight: i < 4 ? '1px solid rgba(255,255,255,0.07)' : 'none', paddingLeft: i > 0 ? 28 : 0 }}>
              <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 4 }}>{s.val}</div>
              <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TICKER */}
      <div style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.07)', borderBottom: '1px solid rgba(255,255,255,0.07)', padding: '13px 0', background: 'rgba(12,14,20,1)' }}>
        <div style={{ display: 'flex', gap: 60, animation: 'ticker 40s linear infinite', width: 'max-content' }}>
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((t, i) => (
            <span key={i} style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: t.type === 'alert' ? '#ff3b3b' : t.type === 'warn' ? '#ffb300' : 'rgba(255,255,255,0.28)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 14 }}>
              <span style={{ fontSize: 5 }}>◆</span>{t.text}
            </span>
          ))}
        </div>
      </div>

      {/* FEATURE GRID */}
      <section id="monitor" style={{ padding: '120px 40px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, background: 'rgba(255,255,255,0.07)' }}>
          {[
            { num: '01 — BEHAVIORAL MONITORING', title: 'SEE THE\nCOORDINATION.', body: 'GoldRush streaming feeds every DEX pair creation, wallet transfer, liquidity event, and program interaction into our normalization pipeline — in real time, across Ethereum, Base, and Solana.' },
            { num: '02 — BEHAVIORAL GRAPH', title: 'TRACE THE\nNETWORK.', body: 'Every wallet, token, pair, and liquidity event becomes a node. Every funding path, transfer, and swap becomes an edge. Suspicious clusters surface automatically.' },
            { num: '03 — FORENSIC RECONSTRUCTION', title: 'AUTOPSY\nTHE RUG.', body: 'When risk crosses threshold, a case file opens automatically. Timeline reconstructed. Fund path traced. Extraction narrative generated. All grounded in observed onchain evidence.' },
            { num: '04 — GOVERNANCE TRUST', title: 'VERIFY\nTHE CLAIM.', body: 'Token distribution, voting concentration, delegate overlap, and coordinated governance behavior analyzed separately from rug risk. Decentralization claims verified with data.' },
          ].map((f, i) => (
            <div key={i} style={{ background: '#080a0f', padding: '60px 48px', transition: 'background .2s' }}
              onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#0c0e14'}
              onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = '#080a0f'}>
              <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.28)', marginBottom: 24 }}>{f.num}</div>
              <div style={{ fontSize: 42, fontWeight: 800, lineHeight: 1, letterSpacing: '-0.02em', marginBottom: 20, whiteSpace: 'pre-line' }}>{f.title}</div>
              <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: 13, lineHeight: 1.7, color: 'rgba(255,255,255,0.55)', maxWidth: 340 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* RISK TIERS */}
      <section style={{ background: '#0c0e14', padding: '120px 40px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', marginBottom: 16 }}>Risk Classification System</div>
          <h2 style={{ fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 64 }}>FOUR TIERS.<br /><span style={{ color: 'rgba(255,255,255,0.28)' }}>ONE VERDICT.</span></h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: 'rgba(255,255,255,0.07)' }}>
            {RISK_TIERS.map(t => (
              <div key={t.level} style={{ background: '#0c0e14', padding: '40px 32px', display: 'flex', flexDirection: 'column', gap: 20, transition: 'background .2s' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#111420'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = '#0c0e14'}>
                <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', padding: '4px 10px', color: t.col, background: t.bg, border: `1px solid ${t.border}`, width: 'fit-content' }}>{t.level}</span>
                <div style={{ fontSize: 56, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1, color: t.col }}>{t.score}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
                  {t.signals.map(s => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.28)' }}>
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'currentColor', opacity: 0.6, flexShrink: 0 }} />{s}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GRAPH SECTION */}
      <section style={{ padding: '120px 0', background: '#0c0e14', overflow: 'hidden' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 40px 60px' }}>
          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', marginBottom: 16 }}>Behavioral Graph Engine</div>
          <h2 style={{ fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 20 }}>THE NETWORK NEVER LIES.</h2>
          <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: 13, color: 'rgba(255,255,255,0.55)', maxWidth: 480, lineHeight: 1.7 }}>Every relationship between wallets, tokens, and liquidity events is mapped, clustered, and scored. Coordination is visible before it becomes catastrophic.</p>
        </div>
        <GraphVisualization />
      </section>

      {/* FORENSIC SECTION */}
      <section id="forensic" style={{ padding: '120px 40px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', marginBottom: 16 }}>Automated Forensic Mode</div>
        <h2 style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 60 }}>WHEN RISK BREAKS THRESHOLD,<br /><span style={{ color: 'rgba(255,255,255,0.28)' }}>THE CASE OPENS ITSELF.</span></h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, background: 'rgba(255,255,255,0.07)' }}>
          <div style={{ background: '#080a0f', padding: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
              <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase' }}>Case FCS-2847 · Auto-triggered</span>
              <span style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, padding: '4px 10px', background: 'rgba(255,59,59,0.12)', border: '1px solid rgba(255,59,59,0.25)', color: '#ff3b3b', textTransform: 'uppercase', letterSpacing: '0.12em' }}>CRITICAL</span>
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em', marginBottom: 16, lineHeight: 1.1 }}>Coordinated Exit Detected:<br />$RUGX Rug Pull Pattern</div>
            <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: 28 }}>Deployer wallet matches 3 previously confirmed rug events. 23 buyer wallets were funded from a single origin within 4 minutes of pair creation. Liquidity removed in two transactions totaling 87% of pool value.</p>
            <Link href="/dashboard">
              <button style={{ ...btnOutline, fontSize: 11, padding: '10px 20px' }}>View in Intelligence Console →</button>
            </Link>
          </div>
          <div style={{ background: '#080a0f', padding: 48 }}>
            <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', marginBottom: 16 }}>Incident Timeline</div>
            {[
              { dot: '#00e5ff', time: 'T-18h · Pair Creation', desc: '$RUGX/ETH pair created. Deployer seeds 12 ETH liquidity. First 23 buy transactions execute within 4 minutes.' },
              { dot: '#ffb300', time: 'T-12h · Concentration Spike', desc: 'Top-5 wallets accumulate 78% of supply. All trace to single funding origin. Risk score escalates to HIGH (74).' },
              { dot: '#ff3b3b', time: 'T-6h · FORENSIC TRIGGER', desc: 'Risk threshold crossed (92). Case FCS-2847 auto-created. 23 wallets begin synchronized movement.' },
              { dot: '#ff3b3b', time: 'T-0 · Extraction', desc: 'Deployer removes 87% of liquidity in 2 transactions. Funds bridge to Arbitrum. $214K estimated victim losses.' },
            ].map((t, i, arr) => (
              <div key={i} style={{ display: 'flex', gap: 14, paddingBottom: i < arr.length - 1 ? 20 : 0, position: 'relative' }}>
                {i < arr.length - 1 && <div style={{ position: 'absolute', left: 7, top: 16, bottom: 0, width: 1, background: 'rgba(255,255,255,0.07)' }} />}
                <div style={{ width: 15, height: 15, borderRadius: '50%', border: `1px solid ${t.dot}`, background: `${t.dot}22`, flexShrink: 0, marginTop: 2, position: 'relative', zIndex: 1 }} />
                <div>
                  <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)', marginBottom: 4 }}>{t.time}</div>
                  <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GOVERNANCE SECTION */}
      <section id="governance" style={{ padding: '120px 40px', background: '#0c0e14' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', marginBottom: 16 }}>Governance Trust Intelligence</div>
          <h2 style={{ fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1, marginBottom: 60 }}>DECENTRALIZATION<br /><span style={{ color: 'rgba(255,255,255,0.28)' }}>IS A CLAIM. VERIFY IT.</span></h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'rgba(255,255,255,0.07)' }}>
            {[
              { metric: 'Token Distribution Score', val: '12', valCol: '#ff3b3b', label: 'Critically concentrated. Top 3 wallets control 89% of voting supply.', pct: 8, barCol: '#ff3b3b' },
              { metric: 'Voting Behavior Analysis', val: '31', valCol: '#ffb300', label: 'Coordinated voting across 4 proposals. Same 3 wallets vote identically in 94% of cases.', pct: 22, barCol: '#ffb300' },
              { metric: 'Governance Trust Score', val: '18/100', valCol: '#9b59ff', label: "This project's decentralization claims are not credible based on observed onchain behavior.", pct: 18, barCol: '#9b59ff' },
            ].map(g => (
              <div key={g.metric} style={{ background: '#0c0e14', padding: '40px 36px', transition: 'background .2s' }}
                onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = '#111420'}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = '#0c0e14'}>
                <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', marginBottom: 16 }}>{g.metric}</div>
                <div style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1, color: g.valCol, marginBottom: 12 }}>{g.val}</div>
                <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginBottom: 20 }}>{g.label}</p>
                <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 1 }}>
                  <div style={{ height: '100%', width: `${g.pct}%`, background: g.barCol, borderRadius: 1 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BIG STATEMENT */}
      <section style={{ padding: '160px 40px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 50% at 50% 50%, rgba(0,229,255,0.025) 0%, transparent 70%)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 'clamp(48px, 8vw, 100px)', fontWeight: 800, lineHeight: 0.95, letterSpacing: '-0.03em', marginBottom: 32 }}>
            <span style={{ display: 'block', color: 'rgba(255,255,255,0.28)' }}>THE CHAIN</span>
            <span style={{ display: 'block' }}>REMEMBERS</span>
            <span style={{ display: 'block', color: 'transparent', WebkitTextStroke: '1px rgba(255,255,255,0.2)' }}>EVERYTHING.</span>
          </div>
          <p style={{ fontFamily: 'Geist Mono, monospace', fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, marginBottom: 48 }}>
            Raw blockchain activity is just noise.<br />Behavioral intelligence turns it into evidence.
          </p>
          <Link href="/dashboard">
            <button style={btnPrimary}>Enter Intelligence Console</button>
          </Link>
        </div>
      </section>

      {/* TECH STACK */}
      <section id="architecture" style={{ background: '#0c0e14', padding: '80px 40px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', marginBottom: 32 }}>Technical Architecture</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 1, background: 'rgba(255,255,255,0.07)' }}>
            {[
              { label: 'Data Backbone', name: 'GoldRush', detail: 'Streaming · Foundational · 100+ chains' },
              { label: 'Frontend', name: 'Next.js 15', detail: 'TypeScript · Tailwind · shadcn/ui' },
              { label: 'Graph Engine', name: 'D3 + SVG', detail: 'Force-directed · Real-time updates' },
              { label: 'Chains', name: 'ETH · BASE · SOL', detail: 'Ethereum · Base · Solana mainnet' },
              { label: 'Deployment', name: 'Vercel', detail: 'GitHub · Edge-ready · Instant deploy' },
            ].map(s => (
              <div key={s.label} style={{ background: '#0c0e14', padding: '28px 24px' }}>
                <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 9, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', marginBottom: 12 }}>{s.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 8 }}>{s.name}</div>
                <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 11, color: 'rgba(255,255,255,0.28)', lineHeight: 1.5 }}>{s.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: '48px 40px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 12, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>RUG DNA — Onchain Behavioral Intelligence</div>
        <div style={{ display: 'flex', gap: 28 }}>
          {['GitHub', 'Documentation', 'API', 'Superteam Earn'].map(l => (
            <a key={l} href="#" style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.28)', textDecoration: 'none', textTransform: 'uppercase' }}>{l}</a>
          ))}
        </div>
        <div style={{ fontFamily: 'Geist Mono, monospace', fontSize: 10, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
          Powered by <span style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)', padding: '3px 8px', fontSize: 9, color: '#00e5ff' }}>GoldRush</span>
        </div>
      </footer>

      <style>{`
        @keyframes scanLine { 0%{transform:translateY(-100vh)} 100%{transform:translateY(100vh)} }
        @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes pulseDot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.4;transform:scale(.7)} }
        @keyframes nodeGlow { 0%,100%{opacity:.6} 50%{opacity:1} }
      `}</style>
    </div>
  );
}

// ─── SUB-COMPONENTS ───────────────────────────────────────────

function DnaIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M6 3C6 3 8 6 12 6C16 6 18 3 18 3" stroke="rgba(0,229,255,0.7)" strokeWidth="1.5"/>
      <path d="M6 21C6 21 8 18 12 18C16 18 18 21 18 21" stroke="rgba(0,229,255,0.7)" strokeWidth="1.5"/>
      <circle cx="12" cy="9" r="1.5" fill="rgba(0,229,255,0.6)"/>
      <circle cx="12" cy="12" r="1.5" fill="rgba(255,255,255,0.3)"/>
      <circle cx="12" cy="15" r="1.5" fill="rgba(255,59,59,0.6)"/>
    </svg>
  );
}

function LiveDot() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: 'Geist Mono, monospace', fontSize: 10, letterSpacing: '0.12em', color: '#00ff88', textTransform: 'uppercase' }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88', animation: 'pulseDot 1.5s ease-in-out infinite', flexShrink: 0 }} />
      Live Intelligence
    </span>
  );
}

function CircuitBg() {
  return (
    <div style={{ position: 'absolute', right: 0, top: 0, width: '55%', height: '100%', opacity: 0.1, overflow: 'hidden' }}>
      <svg width="100%" height="100%" viewBox="0 0 600 800" preserveAspectRatio="xMidYMid slice">
        <g stroke="rgba(0,229,255,0.6)" strokeWidth="1" fill="none">
          <path d="M100 100 H300 V200 H500"/><path d="M200 50 V300 H400 V450"/>
          <path d="M50 400 H150 V300 H350"/><path d="M400 100 V600 H200 V700"/>
          <path d="M500 300 H300 V500 H100 V650"/>
        </g>
        <g fill="rgba(0,229,255,0.8)">
          {[[300,200],[400,450],[100,400],[200,700],[500,300]].map(([cx,cy],i) => (
            <circle key={i} cx={cx} cy={cy} r="4"><animate attributeName="opacity" values=".4;1;.4" dur={`${1.8+i*0.3}s`} repeatCount="indefinite"/></circle>
          ))}
        </g>
        <g fill="rgba(255,59,59,0.7)">
          <circle cx="350" cy="350" r="5"><animate attributeName="opacity" values=".3;.9;.3" dur="1.5s" repeatCount="indefinite"/></circle>
          <circle cx="150" cy="550" r="4"><animate attributeName="opacity" values=".3;.9;.3" dur="2s" repeatCount="indefinite"/></circle>
        </g>
      </svg>
    </div>
  );
}

function GraphVisualization() {
  const nodes = [
    { cx:200, cy:230, r:22, col:'#ff3b3b', label:'DEPLOYER', pulse:true },
    { cx:600, cy:230, r:20, col:'#00e5ff', label:'$TOKEN', pulse:true },
    { cx:820, cy:230, r:16, col:'#ffb300', label:'LIQUIDITY', pulse:false },
    { cx:600, cy:100, r:14, col:'#9b59ff', label:'GOVERNANCE', pulse:false },
    { cx:350, cy:160, r:8, col:'#ff3b3b', label:'W-0x7f3a', pulse:false },
    { cx:380, cy:230, r:8, col:'#ff3b3b', label:'W-0x4b2c', pulse:false },
    { cx:350, cy:300, r:8, col:'#ff3b3b', label:'W-0x9d1e', pulse:false },
    { cx:730, cy:160, r:7, col:'rgba(0,229,255,0.6)', label:'', pulse:false },
    { cx:750, cy:280, r:7, col:'rgba(0,229,255,0.6)', label:'', pulse:false },
    { cx:950, cy:200, r:6, col:'rgba(0,229,255,0.5)', label:'', pulse:false },
  ];
  return (
    <div style={{ width: '100%', height: 460, position: 'relative', overflow: 'hidden' }}>
      <svg width="100%" height="460" viewBox="0 0 1200 460" preserveAspectRatio="xMidYMid slice">
        <defs>
          <filter id="lglow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <marker id="larr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3z" fill="rgba(0,229,255,0.4)"/></marker>
          <marker id="larr-r" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3z" fill="rgba(255,59,59,0.5)"/></marker>
        </defs>
        {/* Grid */}
        {[115,230,345].map(y => <line key={y} x1="0" y1={y} x2="1200" y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>)}
        {/* Edges */}
        <g stroke="rgba(255,59,59,0.3)" strokeWidth="1.5" fill="none" strokeDasharray="5,3" markerEnd="url(#larr-r)">
          <line x1="200" y1="230" x2="350" y2="160"/><line x1="200" y1="230" x2="380" y2="230"/><line x1="200" y1="230" x2="350" y2="300"/>
        </g>
        <g stroke="rgba(0,229,255,0.2)" strokeWidth="1" fill="none" markerEnd="url(#larr)">
          <line x1="600" y1="230" x2="730" y2="160"/><line x1="600" y1="230" x2="750" y2="280"/>
          <line x1="600" y1="230" x2="820" y2="230"/><line x1="820" y1="230" x2="950" y2="200"/>
        </g>
        <g stroke="rgba(155,89,255,0.25)" strokeWidth="1" fill="none">
          <line x1="600" y1="230" x2="600" y2="100"/>
        </g>
        <line x1="380" y1="230" x2="600" y2="230" stroke="rgba(255,179,0,0.25)" strokeWidth="1.5" strokeDasharray="6,3"/>
        {/* Nodes */}
        {nodes.map((n, i) => (
          <g key={i} filter="url(#lglow)">
            <circle cx={n.cx} cy={n.cy} r={n.r + 4} fill={n.col.replace(')',',0.08)').replace('#','rgba(0,0,0,')} stroke={n.col} strokeWidth="1.5">
              {n.pulse && <animate attributeName="r" values={`${n.r+4};${n.r+8};${n.r+4}`} dur="2.5s" repeatCount="indefinite"/>}
            </circle>
            <circle cx={n.cx} cy={n.cy} r={n.r * 0.45} fill={n.col}/>
            {n.label && <text x={n.cx} y={n.cy + n.r + 14} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontFamily="Geist Mono,monospace" fontSize="8">{n.label}</text>}
          </g>
        ))}
        {/* Cluster box */}
        <rect x="155" y="130" width="260" height="195" rx="2" fill="rgba(255,59,59,0.03)" stroke="rgba(255,59,59,0.18)" strokeWidth="1" strokeDasharray="4,3"/>
        <text x="285" y="148" textAnchor="middle" fill="rgba(255,59,59,0.6)" fontFamily="Geist Mono,monospace" fontSize="9" letterSpacing="1">SUSPICIOUS CLUSTER · 3 WALLETS</text>
        {/* Legend */}
        {[['#ff3b3b','Suspicious'],['#00e5ff','Token/Buyers'],['#ffb300','Liquidity'],['#9b59ff','Governance']].map(([c,l],i) => (
          <g key={l} transform={`translate(${40 + i * 160},420)`}>
            <circle cx="0" cy="0" r="5" fill={c}/>
            <text x="10" y="4" fill="rgba(255,255,255,0.4)" fontFamily="Geist Mono,monospace" fontSize="9">{l}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  fontFamily: 'Geist Mono, monospace', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
  padding: '14px 32px', background: '#fff', color: '#080a0f', border: 'none', cursor: 'pointer',
};
const btnOutline: React.CSSProperties = {
  fontFamily: 'Geist Mono, monospace', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase',
  padding: '14px 32px', background: 'transparent', color: 'rgba(255,255,255,0.55)',
  border: '1px solid rgba(255,255,255,0.07)', cursor: 'pointer',
};
