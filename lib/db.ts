// ============================================================
// RUG DNA — Database Layer (SQLite via better-sqlite3)
// In-memory for hackathon, swap with PostgreSQL for prod
// ============================================================

import type {
  Project, Wallet, NormalizedEvent, GraphNode, GraphEdge,
  RiskScore, ForensicCase, GovernanceScore, LiveEvent
} from '@/types';

// We use a global in-memory store since better-sqlite3 requires
// native bindings that may not compile in all envs.
// This is a JSON store that behaves identically for the hackathon.

interface DBStore {
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

// Singleton store
const store: DBStore = {
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

// ——— PROJECT OPERATIONS ———

export const db = {
  // Projects
  upsertProject(project: Project): void {
    store.projects.set(project.id, { ...project, updatedAt: Date.now() });
  },

  getProject(id: string): Project | undefined {
    return store.projects.get(id);
  },

  getProjectByToken(tokenAddress: string): Project | undefined {
    for (const p of store.projects.values()) {
      if (p.tokenAddress.toLowerCase() === tokenAddress.toLowerCase()) return p;
    }
    return undefined;
  },

  getAllProjects(): Project[] {
    return Array.from(store.projects.values())
      .sort((a, b) => b.currentRiskScore - a.currentRiskScore);
  },

  getProjectsByRisk(level: string): Project[] {
    return Array.from(store.projects.values())
      .filter(p => p.currentRiskLevel === level)
      .sort((a, b) => b.currentRiskScore - a.currentRiskScore);
  },

  // Wallets
  upsertWallet(wallet: Wallet): void {
    const key = `${wallet.chain}:${wallet.address.toLowerCase()}`;
    const existing = store.wallets.get(key);
    store.wallets.set(key, { ...existing, ...wallet, lastSeen: Date.now() });
  },

  getWallet(address: string): Wallet | undefined {
    for (const w of store.wallets.values()) {
      if (w.address.toLowerCase() === address.toLowerCase()) return w;
    }
    return undefined;
  },

  // Events
  insertEvent(event: NormalizedEvent): void {
    store.events.push(event);
    // Keep last 10k events in memory
    if (store.events.length > 10000) store.events.shift();
  },

  getEventsByProject(projectId: string, limit = 50): NormalizedEvent[] {
    return store.events
      .filter(e => e.projectId === projectId)
      .slice(-limit)
      .reverse();
  },

  getRecentEvents(limit = 100): NormalizedEvent[] {
    return store.events.slice(-limit).reverse();
  },

  // Graph
  upsertGraphNode(node: GraphNode): void {
    store.graphNodes.set(node.id, node);
  },

  upsertGraphEdge(edge: GraphEdge): void {
    store.graphEdges.set(edge.id, edge);
  },

  getGraph(projectId: string): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const nodes = Array.from(store.graphNodes.values())
      .filter(n => n.projectId === projectId);
    const edges = Array.from(store.graphEdges.values())
      .filter(e => e.projectId === projectId);
    return { nodes, edges };
  },

  // Risk Scores
  upsertRiskScore(score: RiskScore): void {
    store.riskScores.set(score.projectId, score);
  },

  getRiskScore(projectId: string): RiskScore | undefined {
    return store.riskScores.get(projectId);
  },

  // Forensic Cases
  upsertForensicCase(fc: ForensicCase): void {
    store.forensicCases.set(fc.id, fc);
  },

  getForensicCase(id: string): ForensicCase | undefined {
    return store.forensicCases.get(id);
  },

  getForensicCaseByProject(projectId: string): ForensicCase | undefined {
    for (const fc of store.forensicCases.values()) {
      if (fc.projectId === projectId) return fc;
    }
    return undefined;
  },

  getAllForensicCases(): ForensicCase[] {
    return Array.from(store.forensicCases.values())
      .sort((a, b) => b.triggeredAt - a.triggeredAt);
  },

  // Governance
  upsertGovernanceScore(gs: GovernanceScore): void {
    store.governanceScores.set(gs.projectId, gs);
  },

  getGovernanceScore(projectId: string): GovernanceScore | undefined {
    return store.governanceScores.get(projectId);
  },

  // Live Events Feed
  pushLiveEvent(event: LiveEvent): void {
    store.liveEvents.unshift(event);
    if (store.liveEvents.length > 200) store.liveEvents.pop();
  },

  getLiveEvents(since?: number, limit = 50): LiveEvent[] {
    const filtered = since
      ? store.liveEvents.filter(e => e.timestamp > since)
      : store.liveEvents;
    return filtered.slice(0, limit);
  },

  // Stats
  getStats() {
    const projects = Array.from(store.projects.values());
    return {
      totalProjects: projects.length,
      critical: projects.filter(p => p.currentRiskLevel === 'critical').length,
      high: projects.filter(p => p.currentRiskLevel === 'high').length,
      moderate: projects.filter(p => p.currentRiskLevel === 'moderate').length,
      low: projects.filter(p => p.currentRiskLevel === 'low').length,
      openCases: Array.from(store.forensicCases.values()).filter(fc => fc.status === 'open').length,
      totalEvents: store.events.length,
    };
  },
};

export default db;
