// ============================================================
// RUG DNA — Database Layer
// Postgres (Neon) when DATABASE_URL is set — required for real
// deployments: serverless instances share no memory, so anything
// in-process vanishes between requests. Falls back to an
// in-memory store for local dev without a database.
// ============================================================

import { neon } from '@neondatabase/serverless';
import type {
  Project, Wallet, NormalizedEvent, GraphNode, GraphEdge,
  RiskScore, ForensicCase, GovernanceScore, LiveEvent
} from '@/types';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const usePg = !!DATABASE_URL;
const sql = usePg ? neon(DATABASE_URL) : null;

// ——— Schema (JSONB documents + indexed key columns) ———

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) schemaReady = createTables();
  return schemaReady;
}

async function createTables(): Promise<void> {
  if (!sql) return;
  await sql`CREATE TABLE IF NOT EXISTS rd_projects (
    id TEXT PRIMARY KEY, token_address TEXT NOT NULL, chain TEXT NOT NULL,
    risk_score INT NOT NULL DEFAULT 0, risk_level TEXT NOT NULL DEFAULT 'low',
    updated_at BIGINT NOT NULL DEFAULT 0, data JSONB NOT NULL)`;
  await sql`CREATE INDEX IF NOT EXISTS rd_projects_token ON rd_projects (lower(token_address))`;
  await sql`CREATE TABLE IF NOT EXISTS rd_wallets (key TEXT PRIMARY KEY, data JSONB NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS rd_events (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, ts BIGINT NOT NULL DEFAULT 0, data JSONB NOT NULL)`;
  await sql`CREATE INDEX IF NOT EXISTS rd_events_project ON rd_events (project_id, ts DESC)`;
  await sql`CREATE TABLE IF NOT EXISTS rd_graph_nodes (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, data JSONB NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS rd_graph_edges (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, data JSONB NOT NULL)`;
  await sql`CREATE INDEX IF NOT EXISTS rd_graph_nodes_project ON rd_graph_nodes (project_id)`;
  await sql`CREATE INDEX IF NOT EXISTS rd_graph_edges_project ON rd_graph_edges (project_id)`;
  await sql`CREATE TABLE IF NOT EXISTS rd_risk_scores (project_id TEXT PRIMARY KEY, data JSONB NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS rd_forensic_cases (
    id TEXT PRIMARY KEY, project_id TEXT NOT NULL, triggered_at BIGINT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'open', data JSONB NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS rd_governance_scores (project_id TEXT PRIMARY KEY, data JSONB NOT NULL)`;
  await sql`CREATE TABLE IF NOT EXISTS rd_live_events (id TEXT PRIMARY KEY, ts BIGINT NOT NULL DEFAULT 0, data JSONB NOT NULL)`;
  await sql`CREATE INDEX IF NOT EXISTS rd_live_events_ts ON rd_live_events (ts DESC)`;
}

// ——— In-memory fallback (local dev without DATABASE_URL) ———

interface MemStore {
  projects: Map<string, Project>;
  wallets: Map<string, Wallet>;
  events: NormalizedEvent[];
  graphNodes: Map<string, GraphNode>;
  graphEdges: Map<string, GraphEdge>;
  riskScores: Map<string, RiskScore>;
  forensicCases: Map<string, ForensicCase>;
  governanceScores: Map<string, GovernanceScore>;
  liveEvents: LiveEvent[];
}

const mem: MemStore = {
  projects: new Map(),
  wallets: new Map(),
  events: [],
  graphNodes: new Map(),
  graphEdges: new Map(),
  riskScores: new Map(),
  forensicCases: new Map(),
  governanceScores: new Map(),
  liveEvents: [],
};

// ——— API ———

export const db = {
  isPersistent(): boolean { return usePg; },

  // Projects
  async countProjects(): Promise<number> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`SELECT count(*)::int AS n FROM rd_projects`;
      return rows[0]?.n ?? 0;
    }
    return mem.projects.size;
  },

  // Count only real (non-demo) projects. Lets seeding re-run with a
  // real key even when the store already holds demo placeholders.
  async countRealProjects(): Promise<number> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`SELECT count(*)::int AS n FROM rd_projects WHERE (data->>'isDemo') IS DISTINCT FROM 'true'`;
      return rows[0]?.n ?? 0;
    }
    return Array.from(mem.projects.values()).filter(p => !p.isDemo).length;
  },

  // Remove demo placeholders (and their live-event rows) so real
  // data can take their place once an API key is configured.
  async purgeDemo(): Promise<void> {
    if (sql) {
      await ensureSchema();
      await sql`DELETE FROM rd_projects WHERE (data->>'isDemo') = 'true'`;
      await sql`DELETE FROM rd_live_events WHERE (data->>'projectId') IN (SELECT id FROM rd_projects WHERE (data->>'isDemo') = 'true')`;
      return;
    }
    for (const [id, p] of mem.projects) if (p.isDemo) mem.projects.delete(id);
    mem.liveEvents = mem.liveEvents.filter(e => {
      const p = mem.projects.get(e.projectId);
      return !p || !p.isDemo;
    });
  },

  async upsertProject(project: Project): Promise<void> {
    const p = { ...project, updatedAt: Date.now() };
    if (sql) {
      await ensureSchema();
      await sql`INSERT INTO rd_projects (id, token_address, chain, risk_score, risk_level, updated_at, data)
        VALUES (${p.id}, ${p.tokenAddress}, ${p.chain}, ${p.currentRiskScore}, ${p.currentRiskLevel}, ${p.updatedAt}, ${JSON.stringify(p)}::jsonb)
        ON CONFLICT (id) DO UPDATE SET token_address = EXCLUDED.token_address, chain = EXCLUDED.chain,
          risk_score = EXCLUDED.risk_score, risk_level = EXCLUDED.risk_level,
          updated_at = EXCLUDED.updated_at, data = EXCLUDED.data`;
      return;
    }
    mem.projects.set(p.id, p);
  },

  async getProject(id: string): Promise<Project | undefined> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`SELECT data FROM rd_projects WHERE id = ${id}`;
      return rows[0]?.data as Project | undefined;
    }
    return mem.projects.get(id);
  },

  async getProjectByToken(tokenAddress: string): Promise<Project | undefined> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`SELECT data FROM rd_projects WHERE lower(token_address) = ${tokenAddress.toLowerCase()} LIMIT 1`;
      return rows[0]?.data as Project | undefined;
    }
    for (const p of mem.projects.values()) {
      if (p.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()) return p;
    }
    return undefined;
  },

  async getAllProjects(): Promise<Project[]> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`SELECT data FROM rd_projects ORDER BY risk_score DESC`;
      return rows.map(r => r.data as Project);
    }
    return Array.from(mem.projects.values()).sort((a, b) => b.currentRiskScore - a.currentRiskScore);
  },

  async getProjectsByRisk(level: string): Promise<Project[]> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`SELECT data FROM rd_projects WHERE risk_level = ${level} ORDER BY risk_score DESC`;
      return rows.map(r => r.data as Project);
    }
    return Array.from(mem.projects.values())
      .filter(p => p.currentRiskLevel === level)
      .sort((a, b) => b.currentRiskScore - a.currentRiskScore);
  },

  // Wallets
  async upsertWallet(wallet: Wallet): Promise<void> {
    const key = `${wallet.chain}:${wallet.address.toLowerCase()}`;
    if (sql) {
      await ensureSchema();
      const rows = await sql`SELECT data FROM rd_wallets WHERE key = ${key}`;
      const merged = { ...(rows[0]?.data as Wallet | undefined), ...wallet, lastSeen: Date.now() };
      await sql`INSERT INTO rd_wallets (key, data) VALUES (${key}, ${JSON.stringify(merged)}::jsonb)
        ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data`;
      return;
    }
    const existing = mem.wallets.get(key);
    mem.wallets.set(key, { ...existing, ...wallet, lastSeen: Date.now() });
  },

  async getWallet(address: string, chain?: string): Promise<Wallet | undefined> {
    if (sql) {
      await ensureSchema();
      const rows = chain
        ? await sql`SELECT data FROM rd_wallets WHERE key = ${`${chain}:${address.toLowerCase()}`}`
        : await sql`SELECT data FROM rd_wallets WHERE key LIKE ${'%:' + address.toLowerCase()} LIMIT 1`;
      return rows[0]?.data as Wallet | undefined;
    }
    if (chain) return mem.wallets.get(`${chain}:${address.toLowerCase()}`);
    for (const w of mem.wallets.values()) {
      if (w.address.toLowerCase() === address.toLowerCase()) return w;
    }
    return undefined;
  },

  // Events
  async insertEvent(event: NormalizedEvent): Promise<void> {
    if (sql) {
      await ensureSchema();
      await sql`INSERT INTO rd_events (id, project_id, ts, data)
        VALUES (${event.id}, ${event.projectId}, ${event.timestamp}, ${JSON.stringify(event)}::jsonb)
        ON CONFLICT (id) DO NOTHING`;
      return;
    }
    mem.events.push(event);
    if (mem.events.length > 10000) mem.events.shift();
  },

  async getEventsByProject(projectId: string, limit = 50): Promise<NormalizedEvent[]> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`SELECT data FROM rd_events WHERE project_id = ${projectId} ORDER BY ts DESC LIMIT ${limit}`;
      return rows.map(r => r.data as NormalizedEvent);
    }
    return mem.events.filter(e => e.projectId === projectId).slice(-limit).reverse();
  },

  async getRecentEvents(limit = 100): Promise<NormalizedEvent[]> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`SELECT data FROM rd_events ORDER BY ts DESC LIMIT ${limit}`;
      return rows.map(r => r.data as NormalizedEvent);
    }
    return mem.events.slice(-limit).reverse();
  },

  // Graph
  async upsertGraphNode(node: GraphNode): Promise<void> {
    if (sql) {
      await ensureSchema();
      await sql`INSERT INTO rd_graph_nodes (id, project_id, data)
        VALUES (${node.id}, ${node.projectId}, ${JSON.stringify(node)}::jsonb)
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`;
      return;
    }
    mem.graphNodes.set(node.id, node);
  },

  async upsertGraphEdge(edge: GraphEdge): Promise<void> {
    if (sql) {
      await ensureSchema();
      await sql`INSERT INTO rd_graph_edges (id, project_id, data)
        VALUES (${edge.id}, ${edge.projectId}, ${JSON.stringify(edge)}::jsonb)
        ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`;
      return;
    }
    mem.graphEdges.set(edge.id, edge);
  },

  async getGraph(projectId: string): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
    if (sql) {
      await ensureSchema();
      const [nodeRows, edgeRows] = await Promise.all([
        sql`SELECT data FROM rd_graph_nodes WHERE project_id = ${projectId}`,
        sql`SELECT data FROM rd_graph_edges WHERE project_id = ${projectId}`,
      ]);
      return { nodes: nodeRows.map(r => r.data as GraphNode), edges: edgeRows.map(r => r.data as GraphEdge) };
    }
    return {
      nodes: Array.from(mem.graphNodes.values()).filter(n => n.projectId === projectId),
      edges: Array.from(mem.graphEdges.values()).filter(e => e.projectId === projectId),
    };
  },

  // Risk Scores
  async upsertRiskScore(score: RiskScore): Promise<void> {
    if (sql) {
      await ensureSchema();
      await sql`INSERT INTO rd_risk_scores (project_id, data) VALUES (${score.projectId}, ${JSON.stringify(score)}::jsonb)
        ON CONFLICT (project_id) DO UPDATE SET data = EXCLUDED.data`;
      return;
    }
    mem.riskScores.set(score.projectId, score);
  },

  async getRiskScore(projectId: string): Promise<RiskScore | undefined> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`SELECT data FROM rd_risk_scores WHERE project_id = ${projectId}`;
      return rows[0]?.data as RiskScore | undefined;
    }
    return mem.riskScores.get(projectId);
  },

  // Forensic Cases
  async upsertForensicCase(fc: ForensicCase): Promise<void> {
    if (sql) {
      await ensureSchema();
      await sql`INSERT INTO rd_forensic_cases (id, project_id, triggered_at, status, data)
        VALUES (${fc.id}, ${fc.projectId}, ${fc.triggeredAt}, ${fc.status}, ${JSON.stringify(fc)}::jsonb)
        ON CONFLICT (id) DO UPDATE SET triggered_at = EXCLUDED.triggered_at, status = EXCLUDED.status, data = EXCLUDED.data`;
      return;
    }
    mem.forensicCases.set(fc.id, fc);
  },

  async getForensicCase(id: string): Promise<ForensicCase | undefined> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`SELECT data FROM rd_forensic_cases WHERE id = ${id}`;
      return rows[0]?.data as ForensicCase | undefined;
    }
    return mem.forensicCases.get(id);
  },

  async getForensicCaseByProject(projectId: string): Promise<ForensicCase | undefined> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`SELECT data FROM rd_forensic_cases WHERE project_id = ${projectId} LIMIT 1`;
      return rows[0]?.data as ForensicCase | undefined;
    }
    for (const fc of mem.forensicCases.values()) {
      if (fc.projectId === projectId) return fc;
    }
    return undefined;
  },

  async getAllForensicCases(): Promise<ForensicCase[]> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`SELECT data FROM rd_forensic_cases ORDER BY triggered_at DESC`;
      return rows.map(r => r.data as ForensicCase);
    }
    return Array.from(mem.forensicCases.values()).sort((a, b) => b.triggeredAt - a.triggeredAt);
  },

  // Governance
  async upsertGovernanceScore(gs: GovernanceScore): Promise<void> {
    if (sql) {
      await ensureSchema();
      await sql`INSERT INTO rd_governance_scores (project_id, data) VALUES (${gs.projectId}, ${JSON.stringify(gs)}::jsonb)
        ON CONFLICT (project_id) DO UPDATE SET data = EXCLUDED.data`;
      return;
    }
    mem.governanceScores.set(gs.projectId, gs);
  },

  async getGovernanceScore(projectId: string): Promise<GovernanceScore | undefined> {
    if (sql) {
      await ensureSchema();
      const rows = await sql`SELECT data FROM rd_governance_scores WHERE project_id = ${projectId}`;
      return rows[0]?.data as GovernanceScore | undefined;
    }
    return mem.governanceScores.get(projectId);
  },

  // Live Events Feed
  async pushLiveEvent(event: LiveEvent): Promise<void> {
    if (sql) {
      await ensureSchema();
      await sql`INSERT INTO rd_live_events (id, ts, data) VALUES (${event.id}, ${event.timestamp}, ${JSON.stringify(event)}::jsonb)
        ON CONFLICT (id) DO NOTHING`;
      // Occasionally trim the feed to the newest 500 rows
      if (Math.random() < 0.05) {
        await sql`DELETE FROM rd_live_events WHERE id NOT IN (SELECT id FROM rd_live_events ORDER BY ts DESC LIMIT 500)`;
      }
      return;
    }
    mem.liveEvents.unshift(event);
    if (mem.liveEvents.length > 200) mem.liveEvents.pop();
  },

  async getLiveEvents(since?: number, limit = 50): Promise<LiveEvent[]> {
    if (sql) {
      await ensureSchema();
      const rows = since
        ? await sql`SELECT data FROM rd_live_events WHERE ts > ${since} ORDER BY ts DESC LIMIT ${limit}`
        : await sql`SELECT data FROM rd_live_events ORDER BY ts DESC LIMIT ${limit}`;
      return rows.map(r => r.data as LiveEvent);
    }
    const filtered = since ? mem.liveEvents.filter(e => e.timestamp > since) : mem.liveEvents;
    return filtered.slice(0, limit);
  },

  // Stats
  async getStats() {
    if (sql) {
      await ensureSchema();
      const [levels, cases, events] = await Promise.all([
        sql`SELECT risk_level, count(*)::int AS n FROM rd_projects GROUP BY risk_level`,
        sql`SELECT count(*)::int AS n FROM rd_forensic_cases WHERE status = 'open'`,
        sql`SELECT count(*)::int AS n FROM rd_events`,
      ]);
      const byLevel: Record<string, number> = {};
      let total = 0;
      for (const r of levels) { byLevel[r.risk_level as string] = r.n as number; total += r.n as number; }
      return {
        totalProjects: total,
        critical: byLevel['critical'] ?? 0,
        high: byLevel['high'] ?? 0,
        moderate: byLevel['moderate'] ?? 0,
        low: byLevel['low'] ?? 0,
        openCases: cases[0]?.n ?? 0,
        totalEvents: events[0]?.n ?? 0,
      };
    }
    const projects = Array.from(mem.projects.values());
    return {
      totalProjects: projects.length,
      critical: projects.filter(p => p.currentRiskLevel === 'critical').length,
      high: projects.filter(p => p.currentRiskLevel === 'high').length,
      moderate: projects.filter(p => p.currentRiskLevel === 'moderate').length,
      low: projects.filter(p => p.currentRiskLevel === 'low').length,
      openCases: Array.from(mem.forensicCases.values()).filter(fc => fc.status === 'open').length,
      totalEvents: mem.events.length,
    };
  },
};

export default db;
