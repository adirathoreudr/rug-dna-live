'use client';
import { useEffect, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import type { GovernanceScore, Project, DominantWallet } from '@/types';

export default function GovernancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [gs, setGs] = useState<GovernanceScore | null>(null);
  const [proj, setProj] = useState<Project | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${id}`).then(r => r.json()).then(d => {
      setProj(d.project);
      setGs(d.governanceScore);
    });
  }, [id]);

  if (!gs || !proj) return <div style={{ background:'var(--bg)', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Geist Mono,monospace', fontSize:11, color:'var(--text3)' }}>Loading governance data...</div>;

  const credColor: Record<string,string> = { credible:'var(--green)', questionable:'var(--amber)', suspicious:'#ff7a00', captured:'var(--violet)' };
  const cc = credColor[gs.overallCredibility] || 'var(--text)';

  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh', fontFamily:'Syne,sans-serif' }}>
      <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 32px', borderBottom:'1px solid var(--border)', background:'rgba(8,10,15,0.9)', backdropFilter:'blur(20px)' }}>
        <Link href="/" style={{ textDecoration:'none', color:'inherit' }}>
          <div style={{ fontFamily:'Geist Mono,monospace', fontSize:13, letterSpacing:'0.15em', cursor:'pointer' }}>RUG DNA</div>
        </Link>
        <Link href={`/project/${id}`} style={{ fontFamily:'Geist Mono,monospace', fontSize:10, color:'var(--text2)', textDecoration:'none' }}>← PROJECT</Link>
      </nav>
      <div style={{ maxWidth:1100, margin:'0 auto', padding:'88px 32px 60px' }}>
        <div style={{ marginBottom:40, paddingBottom:28, borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, color:'var(--text3)', letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:8 }}>△ Governance Trust Analysis</div>
          <div style={{ fontSize:44, fontWeight:800, letterSpacing:'-0.02em', color:'var(--violet)', lineHeight:1 }}>${proj.tokenSymbol}</div>
          <div style={{ fontFamily:'Geist Mono,monospace', fontSize:12, color:'var(--text2)', marginTop:6 }}>{proj.tokenName}</div>
        </div>

        {/* Trust Score */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr', gap:1, background:'var(--border)', marginBottom:32 }}>
          <div style={{ background:'var(--bg2)', padding:40, textAlign:'center' }}>
            <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:16 }}>Governance Trust Score</div>
            <div style={{ fontSize:72, fontWeight:800, color:'var(--violet)', lineHeight:1, marginBottom:4 }}>{gs.trustScore}</div>
            <div style={{ fontSize:24, color:'var(--text3)' }}>/100</div>
            <div style={{ marginTop:16 }}>
              <span style={{ fontFamily:'Geist Mono,monospace', fontSize:9, padding:'5px 14px', border:'1px solid', borderColor:`${cc}44`, background:`${cc}14`, color:cc, textTransform:'uppercase', letterSpacing:'0.12em' }}>{gs.overallCredibility}</span>
            </div>
          </div>
          <div style={{ background:'var(--bg2)', padding:32 }}>
            <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:16 }}>Analysis</div>
            <div style={{ fontFamily:'Geist Mono,monospace', fontSize:12, color:'var(--text2)', lineHeight:1.75, marginBottom:24 }}>{gs.explanation}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {([['Distribution Score', gs.distributionScore, gs.distributionScore < 40 ? 'var(--red)' : gs.distributionScore < 70 ? 'var(--amber)' : 'var(--green)'],
                ['Vote Independence', gs.voteIndependenceScore, gs.voteIndependenceScore < 40 ? 'var(--red)' : 'var(--amber)'],
                ['Transparency', gs.transparencyScore, gs.transparencyScore < 40 ? 'var(--amber)' : 'var(--green)']
              ] as [string, number, string][]).map(([l,v,c]) => (
                <div key={l}>
                  <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'Geist Mono,monospace', fontSize:10, color:'var(--text3)', marginBottom:4 }}>
                    <span>{l}</span><span style={{ color:c }}>{v}/100</span>
                  </div>
                  <div style={{ height:3, background:'var(--surface2)', borderRadius:1 }}>
                    <div style={{ height:'100%', width:`${v}%`, background:c, borderRadius:1, transition:'width 1s ease' }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:1, background:'var(--border)', marginBottom:32 }}>
          {[
            { l:'Top Holder %', v:`${gs.topHolderPercent?.toFixed(1)}%`, c: gs.topHolderPercent > 50 ? 'var(--red)' : 'var(--amber)' },
            { l:'Gini Coefficient', v: gs.giniCoefficient?.toFixed(2), c: gs.giniCoefficient > 0.7 ? 'var(--red)' : 'var(--amber)' },
            { l:'Proposal Alignment', v:`${gs.proposalAlignmentRate}%`, c: gs.proposalAlignmentRate > 80 ? 'var(--red)' : 'var(--amber)' },
          ].map(s => (
            <div key={s.l} style={{ background:'var(--bg2)', padding:'24px 28px' }}>
              <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:8 }}>{s.l}</div>
              <div style={{ fontSize:36, fontWeight:800, color:s.c }}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Dominant wallets */}
        {gs.dominantWallets?.length > 0 && (
          <div>
            <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, letterSpacing:'0.2em', color:'var(--text3)', textTransform:'uppercase', marginBottom:12 }}>Dominant Governance Wallets</div>
            <table className="data-table">
              <thead><tr><th>Address</th><th>Voting Power</th><th>Alignment</th><th>Signal</th></tr></thead>
              <tbody>
                {gs.dominantWallets.map((w: DominantWallet) => (
                  <tr key={w.address}>
                    <td><span style={{ fontFamily:'Geist Mono,monospace', fontSize:11, color:'var(--cyan)' }}>{w.address?.slice(0,10)}...{w.address?.slice(-6)}</span></td>
                    <td style={{ color: w.votingPower > 30 ? 'var(--red)' : 'var(--amber)', fontWeight:700 }}>{w.votingPower?.toFixed(1)}%</td>
                    <td style={{ color:'var(--text2)' }}>{w.proposalAlignment > 0 ? `${w.proposalAlignment}%` : '—'}</td>
                    <td style={{ color: w.signal === 'Dominant controller' ? 'var(--red)' : 'var(--text2)' }}>{w.signal}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
