// ============================================================
// RUG DNA — Core Type Definitions
// ============================================================

export type Chain = 'eth-mainnet' | 'base-mainnet' | 'matic-mainnet' | 'solana-mainnet';

export type RiskLevel = 'low' | 'moderate' | 'high' | 'critical';

export type EventType =
  | 'pair_created'
  | 'token_transfer'
  | 'liquidity_add'
  | 'liquidity_remove'
  | 'swap'
  | 'wallet_funded'
  | 'holder_change'
  | 'governance_vote'
  | 'governance_proposal';

export type NodeType = 'wallet' | 'token' | 'pair' | 'liquidity_event' | 'governance_action';
export type EdgeType =
  | 'funded_by'
  | 'transferred_to'
  | 'swapped_on'
  | 'created_pair'
  | 'interacted_with'
  | 'voted_on';

// ——— CORE ENTITIES ———

export interface Project {
  id: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenName: string;
  chain: Chain;
  pairAddress?: string;
  deployerAddress: string;
  createdAt: number; // unix ms
  updatedAt: number;
  currentRiskLevel: RiskLevel;
  currentRiskScore: number;
  confidence: number;
  evidenceSummary: string;
  forensicCaseId?: string;
  governanceScoreId?: string;
  holderCount: number;
  totalSupply: string;
  marketCap?: number;
  liquidity?: number;
}

export interface Wallet {
  address: string;
  chain: Chain;
  firstSeen: number;
  lastSeen: number;
  transactionCount: number;
  isDeployer: boolean;
  isSuspicious: boolean;
  clusterId?: string;
  fundingSource?: string;
  labels: string[];
  balance?: string;
}

export interface NormalizedEvent {
  id: string;
  projectId: string;
  chain: Chain;
  txHash: string;
  blockHeight: number;
  timestamp: number;
  eventType: EventType;
  fromAddress?: string;
  toAddress?: string;
  tokenAddress?: string;
  amount?: string;
  amountUsd?: number;
  rawPayload: Record<string, unknown>;
  riskSignals: string[];
}

export interface GraphNode {
  id: string;
  projectId: string;
  nodeType: NodeType;
  address: string;
  label: string;
  riskScore: number;
  clusterId?: string;
  metadata: Record<string, unknown>;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  id: string;
  projectId: string;
  sourceId: string;
  targetId: string;
  edgeType: EdgeType;
  weight: number;
  timestamp: number;
  txHash?: string;
  metadata: Record<string, unknown>;
}

export interface EvidenceItem {
  id: string;
  signal: string;
  description: string;
  weight: number;
  confidence: number;
  txHashes: string[];
  wallets: string[];
  timestamp: number;
}

export interface RiskScore {
  id: string;
  projectId: string;
  score: number;
  level: RiskLevel;
  confidence: number;
  evidenceItems: EvidenceItem[];
  explanation: string;
  computedAt: number;
  triggeredForensic: boolean;

  // Signal breakdown
  deployerReuseScore: number;
  clusteringScore: number;
  concentrationScore: number;
  liquidityScore: number;
  velocityScore: number;
  patternMatchScore: number;
}

export interface ForensicCase {
  id: string;
  projectId: string;
  tokenSymbol: string;
  triggeredAt: number;
  triggerScore: number;
  severity: 'high' | 'critical';
  status: 'open' | 'closed';
  confidence: number;

  narrative: string;
  summary: string;

  timeline: TimelineEvent[];
  linkedWallets: string[];
  victimWallets: string[];
  estimatedLoss: number;
  extractionPath: ExtractionStep[];
  evidenceItems: EvidenceItem[];
}

export interface TimelineEvent {
  id: string;
  timestamp: number;
  label: string;
  description: string;
  severity: 'info' | 'warning' | 'critical';
  txHash?: string;
  wallets: string[];
}

export interface ExtractionStep {
  step: number;
  fromAddress: string;
  toAddress: string;
  amount: string;
  amountUsd: number;
  txHash: string;
  timestamp: number;
  action: string;
  chain: Chain;
}

export interface GovernanceScore {
  id: string;
  projectId: string;
  trustScore: number;
  distributionScore: number;
  voteIndependenceScore: number;
  transparencyScore: number;
  overallCredibility: 'credible' | 'questionable' | 'suspicious' | 'captured';
  explanation: string;

  topHolderCount: number;
  topHolderPercent: number;
  giniCoefficient: number;
  proposalAlignmentRate: number;
  dominantWallets: DominantWallet[];
  computedAt: number;
}

export interface DominantWallet {
  address: string;
  votingPower: number;
  proposalAlignment: number;
  fundingOrigin?: string;
  signal: string;
}

// ——— API RESPONSE SHAPES ———

export interface ProjectListResponse {
  projects: Project[];
  total: number;
  stats: {
    totalProjects: number;
    critical: number;
    high: number;
    moderate: number;
    low: number;
    openCases: number;
    totalEvents: number;
  };
  lastUpdated: number;
}

export interface ProjectDetailResponse {
  project: Project;
  riskScore: RiskScore;
  graph: { nodes: GraphNode[]; edges: GraphEdge[] };
  recentEvents: NormalizedEvent[];
  forensicCase?: ForensicCase;
  governanceScore?: GovernanceScore;
}

export interface LiveEvent {
  id: string;
  projectId: string;
  tokenSymbol: string;
  eventType: EventType;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: number;
  txHash?: string;
}

// ——— GOLDRUSH API SHAPES (subset we use) ———

export interface GRTokenHolder {
  address: string;
  balance: string;
  balance_quote?: number;
  percent_of_total_supply: number;
}

export interface GRTransaction {
  tx_hash: string;
  block_height: number;
  block_signed_at: string;
  from_address: string;
  to_address: string | null;
  value: string;
  value_quote?: number;
  gas_price: string;
  successful: boolean;
  log_events?: GRLogEvent[];
}

export interface GRLogEvent {
  decoded?: {
    name: string;
    params: Array<{ name: string; value: string; type: string }>;
  };
  sender_address: string;
  topics: string[];
  data: string;
}

export interface GRTokenBalance {
  contract_address: string;
  contract_ticker_symbol: string;
  contract_name: string;
  balance: string;
  quote?: number;
  logo_url?: string;
}
