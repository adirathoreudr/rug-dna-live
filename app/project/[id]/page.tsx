'use client';
import { useEffect, useState } from 'react';
import { use } from 'react';
import Link from 'next/link';
import type { Project, RiskScore as ProjectRiskScore, ForensicCase, GovernanceScore, NormalizedEvent, GraphNode, GraphEdge, EvidenceItem } from '@/types';

const RC: Record<string,string> = { critical:'#ff3b3b', high:'#ff7a00', moderate:'#ffb300', low:'#00ff88' };

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<{ project: Project; riskScore: ProjectRiskScore; graph: { nodes: GraphNode[]; edges: GraphEdge[] }; recentEvents: NormalizedEvent[]; forensicCase?: ForensicCase; governanceScore?: GovernanceScore } | null>(null);
  const [tab, setTab] = useState<'overview'|'graph'|'evidence'|'wallets'>('overview');

  useEffect(() => {
    fetch(`/api/projects/${id}`).then(r => r.json()).then(setData);
  }, [id]);

  if (!data) return <Loading />;
  const { project, riskScore, graph, recentEvents, forensicCase, governanceScore } = data;
  if (!project) return <div style={{ padding:40, color:'var(--text3)' }}>Project not found. <Link href="/dashboard" style={{ color:'var(--cyan)' }}>Back</Link></div>;

  const col = RC[project.currentRiskLevel] || '#888';

  return (
    <div style={{ background:'var(--bg)', minHeight:'100vh', fontFamily:'Syne,sans-serif' }}>
      <TopBar />
      <div style={{ maxWidth:1200, margin:'0 auto', padding:'88px 32px 40px' }}>
        {/* Hero header */}
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:40, paddingBottom:32, borderBottom:'1px solid var(--border)' }}>
          <div>
            <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, letterSpacing:'0.2em', color:'var(--text3)', textTransform:'uppercase', marginBottom:8 }}>
              <Link href="/dashboard" style={{ color:'var(--text3)', textDecoration:'none' }}>← Monitor</Link> · {project.chain}
            </div>
            <div style={{ fontSize:52, fontWeight:800, letterSpacing:'-0.03em', color:col, lineHeight:1 }}>${project.tokenSymbol}</div>
            <div style={{ fontFamily:'Geist Mono,monospace', fontSize:12, color:'var(--text2)', marginTop:6 }}>{project.tokenName} · {project.tokenAddress?.slice(0,12)}...{project.tokenAddress?.slice(-6)}</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <ScoreRing score={project.currentRiskScore} color={col} />
            <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, color:'var(--text3)', marginTop:6, textTransform:'uppercase', letterSpacing:'0.12em' }}>Risk Score · {project.currentRiskLevel?.toUpperCase()}</div>
            <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, color:'var(--text3)', marginTop:2 }}>Confidence: {Math.round((project.confidence||0)*100)}%</div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:1, background:'var(--border)', marginBottom:32 }}>
          {[
            { label:'Holders', val: project.holderCount?.toLocaleString() },
            { label:'Forensic Case', val: forensicCase ? forensicCase.id : 'None', color: forensicCase ? 'var(--red)' : undefined },
            { label:'Gov Trust', val: governanceScore ? `${governanceScore.trustScore}/100` : 'N/A', color: governanceScore && governanceScore.trustScore < 40 ? 'var(--violet)' : undefined },
            { label:'Events Logged', val: recentEvents?.length || 0 },
          ].map(s => (
            <div key={s.label} style={{ background:'var(--bg2)', padding:'20px 24px' }}>
              <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:8 }}>{s.label}</div>
              <div style={{ fontSize:22, fontWeight:800, color: s.color || 'var(--text)' }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* AI Narrative */}
        {riskScore?.explanation && (
          <div style={{ background:'var(--bg2)', borderLeft:'3px solid var(--cyan)', padding:'20px 24px', marginBottom:32 }}>
            <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, color:'var(--cyan)', letterSpacing:'0.2em', textTransform:'uppercase', marginBottom:10 }}>◈ Intelligence Summary</div>
            <div style={{ fontFamily:'Geist Mono,monospace', fontSize:12, color:'var(--text2)', lineHeight:1.7 }}>{riskScore.explanation}</div>
          </div>
        )}

        {/* Tabs */}
        <div style={{ display:'flex', gap:1, background:'var(--border)', marginBottom:24, width:'fit-content' }}>
          {(['overview','graph','evidence','wallets'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ fontFamily:'Geist Mono,monospace', fontSize:10, letterSpacing:'0.12em', textTransform:'uppercase', padding:'10px 20px', cursor:'pointer', border:'none', background: tab===t ? 'var(--text)' : 'var(--bg2)', color: tab===t ? 'var(--bg)' : 'var(--text3)' }}>
              {t}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {tab === 'overview' && <OverviewTab riskScore={riskScore} forensicCase={forensicCase} governanceScore={governanceScore} recentEvents={recentEvents} />}
        {tab === 'graph' && <GraphTab graph={graph} project={project} />}
        {tab === 'evidence' && <EvidenceTab riskScore={riskScore} />}
        {tab === 'wallets' && <WalletsTab graph={graph} />}
      </div>
    </div>
  );
}

function ScoreRing({ score, color }: { score: number; color: string }) {
  const r = 50, circ = 2 * Math.PI * r;
  const fill = circ * (score / 100);
  return (
    <div style={{ position:'relative', width:120, height:120, margin:'0 auto' }}>
      <svg width="120" height="120" viewBox="0 0 120 120" style={{ transform:'rotate(-90deg)' }}>
        <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10"/>
        <circle cx="60" cy="60" r={r} fill="none" stroke={color} strokeWidth="10" strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"/>
      </svg>
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:800, color }}>{score}</div>
    </div>
  );
}

function OverviewTab({ riskScore, forensicCase, governanceScore, recentEvents }: { riskScore: ProjectRiskScore; forensicCase?: ForensicCase; governanceScore?: GovernanceScore; recentEvents: NormalizedEvent[] }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:1, background:'var(--border)' }}>
      {/* Forensic */}
      <div style={{ background:'var(--bg2)', padding:28 }}>
        <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, letterSpacing:'0.15em', color:'var(--text3)', textTransform:'uppercase', marginBottom:14 }}>Forensic Status</div>
        {forensicCase ? (
          <>
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <span style={{ fontFamily:'Geist Mono,monospace', fontSize:11, color:'var(--text3)' }}>{forensicCase.id}</span>
              <span className="badge badge-critical">{forensicCase.severity}</span>
            </div>
            <div style={{ fontFamily:'Geist Mono,monospace', fontSize:11, color:'var(--text2)', lineHeight:1.6, marginBottom:16 }}>{forensicCase.summary}</div>
            <Link href={`/case/${forensicCase.id}`} style={{ fontFamily:'Geist Mono,monospace', fontSize:10, color:'var(--cyan)', textDecoration:'none', letterSpacing:'0.1em' }}>VIEW FULL CASE FILE →</Link>
          </>
        ) : (
          <div style={{ fontFamily:'Geist Mono,monospace', fontSize:11, color:'var(--text3)' }}>No forensic case. Risk below threshold.</div>
        )}
      </div>
      {/* Governance */}
      <div style={{ background:'var(--bg2)', padding:28 }}>
        <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, letterSpacing:'0.15em', color:'var(--text3)', textTransform:'uppercase', marginBottom:14 }}>Governance Trust</div>
        {governanceScore ? (
          <>
            <div style={{ fontSize:40, fontWeight:800, color:'var(--violet)', marginBottom:8 }}>{governanceScore.trustScore}<span style={{ fontSize:18, color:'var(--text3)'}}>/100</span></div>
            <div style={{ fontFamily:'Geist Mono,monospace', fontSize:11, color:'var(--text2)', lineHeight:1.6, marginBottom:12 }}>{governanceScore.explanation?.slice(0,120)}...</div>
            {([['Distribution', governanceScore.distributionScore], ['Vote Independence', governanceScore.voteIndependenceScore], ['Transparency', governanceScore.transparencyScore]] as [string, number][]).map(([l,v]) => (
              <div key={l} style={{ marginBottom:8 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontFamily:'Geist Mono,monospace', fontSize:9, color:'var(--text3)', marginBottom:3 }}><span>{l}</span><span>{v}/100</span></div>
                <div style={{ height:3, background:'var(--surface2)', borderRadius:1 }}><div style={{ height:'100%', width:`${v}%`, background:'var(--violet)', borderRadius:1 }}/></div>
              </div>
            ))}
          </>
        ) : <div style={{ fontFamily:'Geist Mono,monospace', fontSize:11, color:'var(--text3)' }}>No governance data available.</div>}
      </div>
      {/* Recent Events */}
      <div style={{ background:'var(--bg2)', padding:28, gridColumn:'span 2' }}>
        <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, letterSpacing:'0.15em', color:'var(--text3)', textTransform:'uppercase', marginBottom:14 }}>Recent Events ({recentEvents?.length || 0})</div>
        {(recentEvents || []).slice(0,8).map((e: NormalizedEvent) => (
          <div key={e.id} style={{ display:'flex', alignItems:'center', gap:16, padding:'8px 0', borderBottom:'1px solid var(--border)', fontFamily:'Geist Mono,monospace', fontSize:11 }}>
            <span className={`badge badge-${e.eventType === 'liquidity_remove' ? 'critical' : 'moderate'}`}>{e.eventType?.replace('_',' ')}</span>
            <span style={{ color:'var(--text3)', fontSize:9 }}>{new Date(e.timestamp).toLocaleString()}</span>
            <span style={{ color:'var(--text2)', flex:1 }}>{e.fromAddress?.slice(0,10)}... → {e.toAddress?.slice(0,10)}...</span>
            {e.amountUsd && <span style={{ color:'var(--text3)' }}>${e.amountUsd.toLocaleString()}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function GraphTab({ graph, project }: { graph: { nodes: GraphNode[]; edges: GraphEdge[] }; project: Project }) {
  if (!graph?.nodes?.length) return <div style={{ padding:40, fontFamily:'Geist Mono,monospace', fontSize:11, color:'var(--text3)' }}>No graph data available.</div>;
  const nodes = graph.nodes.slice(0, 30);
  const edges = graph.edges.slice(0, 50);
  const W = 800, H = 400;
  const nodeMap = new Map<string, GraphNode>(nodes.map((n: GraphNode) => [n.id, n]));
  const getColor = (n: GraphNode) => {
    const meta = n.metadata as Record<string, any>;
    if (meta.isDeployer) return '#ff3b3b';
    if (n.nodeType === 'token') return '#00e5ff';
    if (n.nodeType === 'liquidity_event') return '#ffb300';
    if (meta.isSuspicious) return '#ff7a00';
    return 'rgba(0,229,255,0.5)';
  };
  return (
    <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', padding:16 }}>
      <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.15em', marginBottom:12 }}>Behavioral Graph — {nodes.length} nodes · {edges.length} edges</div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ background:'var(--bg3)', display:'block' }}>
        <defs>
          <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <marker id="arr" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3z" fill="rgba(0,229,255,0.4)"/></marker>
        </defs>
        {/* Grid */}
        {[100,200,300].map(y => <line key={y} x1="0" y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>)}
        {[200,400,600].map(x => <line key={x} x1={x} y1="0" x2={x} y2={H} stroke="rgba(255,255,255,0.03)" strokeWidth="1"/>)}
        {/* Edges */}
        {edges.map((e: GraphEdge) => {
          const s = nodeMap.get(e.sourceId), t = nodeMap.get(e.targetId);
          if (!s?.x || !t?.x) return null;
          const isSusp = e.edgeType === 'funded_by' || e.weight > 2;
          return <line key={e.id} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke={isSusp ? 'rgba(255,59,59,0.3)' : 'rgba(0,229,255,0.15)'} strokeWidth={isSusp ? 1.5 : 1} strokeDasharray={isSusp ? '5,3' : '0'} markerEnd="url(#arr)"/>;
        })}
        {/* Nodes */}
        {nodes.map((n: GraphNode) => {
          if (!n.x || !n.y) return null;
          const r = n.nodeType === 'token' ? 18 : n.metadata?.isDeployer ? 16 : 8;
          const c = getColor(n);
          return (
            <g key={n.id} filter="url(#glow)">
              <circle cx={n.x} cy={n.y} r={r+4} fill={c.replace(')',',0.08)').replace('rgba','rgba')} stroke={c} strokeWidth="1.5">
                {n.nodeType === 'token' && <animate attributeName="r" values={`${r+4};${r+7};${r+4}`} dur="2.5s" repeatCount="indefinite"/>}
              </circle>
              <circle cx={n.x} cy={n.y} r={r*0.45} fill={c}/>
              <text x={n.x} y={n.y + r + 14} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontFamily="Geist Mono,monospace" fontSize="8">{n.label?.slice(0,12)}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ display:'flex', gap:20, marginTop:12 }}>
        {[['Deployer','#ff3b3b'],['Token','#00e5ff'],['Liquidity','#ffb300'],['Cluster','#ff7a00'],['Buyers','rgba(0,229,255,0.5)']].map(([l,c]) => (
          <span key={l} style={{ fontFamily:'Geist Mono,monospace', fontSize:9, color:'rgba(255,255,255,0.4)', display:'flex', alignItems:'center', gap:5 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:c, display:'inline-block' }}/>{l}
          </span>
        ))}
      </div>
    </div>
  );
}

function EvidenceTab({ riskScore }: { riskScore: ProjectRiskScore }) {
  if (!riskScore?.evidenceItems?.length) return <div style={{ padding:40, fontFamily:'Geist Mono,monospace', fontSize:11, color:'var(--text3)' }}>No evidence items computed.</div>;
  return (
    <div>
      <div style={{ display:'flex', flexDirection:'column', gap:1, background:'var(--border)' }}>
        {riskScore.evidenceItems.map((e: EvidenceItem, i: number) => (
          <div key={e.id} style={{ background:'var(--bg2)', padding:'20px 24px', display:'flex', gap:16 }}>
            <span style={{ fontFamily:'Geist Mono,monospace', fontSize:10, color:'var(--text3)', width:24, flexShrink:0, paddingTop:2 }}>{String(i+1).padStart(2,'0')}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:'Geist Mono,monospace', fontSize:9, letterSpacing:'0.15em', color:'var(--cyan)', textTransform:'uppercase', marginBottom:6 }}>{e.signal}</div>
              <div style={{ fontFamily:'Geist Mono,monospace', fontSize:12, color:'var(--text2)', lineHeight:1.6 }}>{e.description}</div>
              <div style={{ display:'flex', gap:16, marginTop:8 }}>
                <span style={{ fontFamily:'Geist Mono,monospace', fontSize:9, color:'var(--text3)' }}>Confidence: {Math.round(e.confidence*100)}%</span>
                <span style={{ fontFamily:'Geist Mono,monospace', fontSize:9, color:'var(--text3)' }}>Weight: {e.weight}</span>
              </div>
            </div>
            <div style={{ fontFamily:'Geist Mono,monospace', fontSize:13, fontWeight:700, color: e.weight > 15 ? 'var(--red)' : e.weight > 8 ? 'var(--amber)' : 'var(--text3)', flexShrink:0 }}>+{e.weight}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WalletsTab({ graph }: { graph: { nodes: GraphNode[] } }) {
  const wallets = (graph?.nodes || []).filter((n: GraphNode) => n.nodeType === 'wallet');
  return (
    <div style={{ overflowX:'auto' }}>
      <table className="data-table">
        <thead><tr><th>Address</th><th>Role</th><th>Risk</th><th>Cluster</th><th>Signals</th></tr></thead>
        <tbody>
          {wallets.slice(0,20).map((n: any) => (
            <tr key={n.id}>
              <td><span className="wallet-addr" style={{ fontFamily:'Geist Mono,monospace', fontSize:11, color:'var(--cyan)' }}>{n.address?.slice(0,10)}...{n.address?.slice(-6)}</span></td>
              <td style={{ color: n.metadata?.isDeployer ? 'var(--red)' : 'var(--text2)' }}>{n.metadata?.isDeployer ? 'Deployer' : n.metadata?.isSuspicious ? 'Cluster Member' : 'Buyer'}</td>
              <td style={{ color: n.riskScore > 60 ? 'var(--red)' : n.riskScore > 30 ? 'var(--amber)' : 'var(--green)' }}>{n.riskScore}</td>
              <td style={{ color:'var(--text3)' }}>{n.clusterId || '—'}</td>
              <td>{(n.metadata?.labels || []).map((l: string) => <span key={l} className="badge badge-moderate" style={{ marginRight:4 }}>{l}</span>)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopBar() {
  return (
    <nav style={{ position:'fixed', top:0, left:0, right:0, zIndex:100, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 32px', borderBottom:'1px solid var(--border)', background:'rgba(8,10,15,0.9)', backdropFilter:'blur(20px)' }}>
      <Link href="/" style={{ textDecoration:'none', color:'inherit' }}>
        <div style={{ fontFamily:'Geist Mono,monospace', fontSize:13, letterSpacing:'0.15em', cursor:'pointer' }}>RUG DNA</div>
      </Link>
      <Link href="/dashboard" style={{ fontFamily:'Geist Mono,monospace', fontSize:10, color:'var(--text2)', textDecoration:'none', letterSpacing:'0.1em' }}>← BACK TO MONITOR</Link>
    </nav>
  );
}

function Loading() {
  return <div style={{ background:'var(--bg)', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'Geist Mono,monospace', fontSize:11, color:'var(--text3)' }}>Loading intelligence data...</div>;
}
