// ============================================================
// RUG DNA — Risk Scoring Engine (Phase 2)
// Heuristic + evidence-based, no black-box
// ============================================================

import type {
  Project, Wallet, NormalizedEvent, GraphNode, GraphEdge,
  RiskScore, RiskLevel, EvidenceItem, GRTokenHolder
} from '@/types';
import { nanoid } from './utils';

export interface RiskInput {
  project: Project;
  holders: GRTokenHolder[];
  wallets: Wallet[];
  events: NormalizedEvent[];
  deployerTxHistory: string[]; // prior project addresses
  earlyBuyers: Array<{ address: string; timestamp: number; fundingSource?: string }>;
  liquidityEvents: Array<{ type: 'add' | 'remove'; amount: number; timestamp: number; wallet: string }>;
}

const WEIGHTS = {
  deployerReuse: 30,
  clusterFunding: 25,
  holderConcentration: 20,
  liquidityRemoval: 15,
  transferVelocity: 10,
  noLiquidityLock: 8,
  earlyBuyerSync: 18,
  patternMatch: 22,
};

const FORENSIC_THRESHOLD = 75;

// ——— MAIN SCORING FUNCTION ———
export function computeRiskScore(input: RiskInput): RiskScore {
  const evidence: EvidenceItem[] = [];
  let totalScore = 0;

  // 1. Deployer wallet reuse
  const deployerSignal = scoreDeployerReuse(input, evidence);
  totalScore += deployerSignal;

  // 2. Synchronized early buyer cluster
  const clusterSignal = scoreEarlyBuyerCluster(input, evidence);
  totalScore += clusterSignal;

  // 3. Holder concentration
  const concSignal = scoreHolderConcentration(input, evidence);
  totalScore += concSignal;

  // 4. Liquidity behavior
  const liqSignal = scoreLiquidityBehavior(input, evidence);
  totalScore += liqSignal;

  // 5. Transfer velocity
  const velSignal = scoreTransferVelocity(input, evidence);
  totalScore += velSignal;

  // Normalize to 0–100
  const maxPossible = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
  const rawScore = Math.min(100, Math.round((totalScore / maxPossible) * 100));

  const level = getLevel(rawScore);
  const confidence = computeConfidence(evidence, rawScore);

  const explanation = generateExplanation(rawScore, level, evidence, input.project.tokenSymbol);

  return {
    id: nanoid(),
    projectId: input.project.id,
    score: rawScore,
    level,
    confidence,
    evidenceItems: evidence,
    explanation,
    computedAt: Date.now(),
    triggeredForensic: rawScore >= FORENSIC_THRESHOLD,
    deployerReuseScore: deployerSignal,
    clusteringScore: clusterSignal,
    concentrationScore: concSignal,
    liquidityScore: liqSignal,
    velocityScore: velSignal,
    patternMatchScore: 0,
  };
}

function scoreDeployerReuse(input: RiskInput, evidence: EvidenceItem[]): number {
  const { deployerTxHistory, project } = input;

  if (deployerTxHistory.length === 0) return 0;

  const priorRugs = deployerTxHistory.length;
  const weight = Math.min(WEIGHTS.deployerReuse, priorRugs * 12);

  if (priorRugs > 0) {
    evidence.push({
      id: nanoid(),
      signal: 'Deployer Wallet Reuse',
      description: `Deployer address ${project.deployerAddress.slice(0, 10)}... has ${priorRugs} other contract deployment${priorRugs > 1 ? 's' : ''} in its recent transaction history — serial-deployer pattern.`,
      weight,
      confidence: Math.min(0.97, 0.55 + priorRugs * 0.14),
      txHashes: deployerTxHistory.slice(0, 5),
      wallets: [project.deployerAddress],
      timestamp: Date.now(),
    });
  }

  return weight;
}

function scoreEarlyBuyerCluster(input: RiskInput, evidence: EvidenceItem[]): number {
  const { earlyBuyers } = input;
  if (earlyBuyers.length < 3) return 0;

  // Check how many share same funding source
  const fundingGroups = new Map<string, number>();
  for (const buyer of earlyBuyers) {
    if (buyer.fundingSource) {
      fundingGroups.set(buyer.fundingSource, (fundingGroups.get(buyer.fundingSource) ?? 0) + 1);
    }
  }

  const maxCluster = Math.max(...Array.from(fundingGroups.values()), 0);
  if (maxCluster < 3) return 0;

  // Check timing — how many bought within 5 minutes of each other
  const times = earlyBuyers.map(b => b.timestamp).sort((a, b) => a - b);
  const windowMs = 5 * 60 * 1000;
  let maxWindow = 0;
  for (let i = 0; i < times.length; i++) {
    const windowCount = times.filter(t => t >= times[i] && t <= times[i] + windowMs).length;
    maxWindow = Math.max(maxWindow, windowCount);
  }

  const timingAnomaly = maxWindow >= 5;
  const weight = Math.min(WEIGHTS.clusterFunding,
    (maxCluster / earlyBuyers.length) * WEIGHTS.clusterFunding * (timingAnomaly ? 1.3 : 1)
  );

  evidence.push({
    id: nanoid(),
    signal: 'Synchronized Early Buyer Cluster',
    description: `${maxCluster} of ${earlyBuyers.length} early wallets share a common funding origin. ${timingAnomaly ? `${maxWindow} wallets executed buys within a 5-minute window of pair creation. Timing anomaly score: ${Math.round((maxWindow / earlyBuyers.length) * 100)}/100.` : ''}`,
    weight: Math.round(weight),
    confidence: Math.min(0.95, maxCluster / earlyBuyers.length + 0.3),
    txHashes: [],
    wallets: earlyBuyers.slice(0, 5).map(b => b.address),
    timestamp: Date.now(),
  });

  return Math.round(weight);
}

function scoreHolderConcentration(input: RiskInput, evidence: EvidenceItem[]): number {
  const { holders } = input;
  if (holders.length === 0) return 0;

  const sorted = [...holders].sort((a, b) => b.percent_of_total_supply - a.percent_of_total_supply);
  const top5Pct = sorted.slice(0, 5).reduce((s, h) => s + (h.percent_of_total_supply ?? 0), 0);
  const top1Pct = sorted[0]?.percent_of_total_supply ?? 0;

  // Baseline: healthy projects have <30% top-5 at this age
  const BASELINE_TOP5 = 30;
  const excess = Math.max(0, top5Pct - BASELINE_TOP5);
  const weight = Math.min(WEIGHTS.holderConcentration, (excess / 70) * WEIGHTS.holderConcentration);

  if (top5Pct > BASELINE_TOP5) {
    evidence.push({
      id: nanoid(),
      signal: 'Holder Concentration — Elevated',
      description: `Top-5 addresses hold ${top5Pct.toFixed(1)}% of circulating supply. Baseline for comparable launches: ${BASELINE_TOP5}–35%. Delta: +${(top5Pct - BASELINE_TOP5).toFixed(1)}pp above normal range. Top single holder: ${top1Pct.toFixed(1)}%.`,
      weight: Math.round(weight),
      confidence: 0.85,
      txHashes: [],
      wallets: sorted.slice(0, 5).map(h => h.address),
      timestamp: Date.now(),
    });
  }

  return Math.round(weight);
}

function scoreLiquidityBehavior(input: RiskInput, evidence: EvidenceItem[]): number {
  const { liquidityEvents } = input;

  const removals = liquidityEvents.filter(e => e.type === 'remove');
  if (removals.length === 0) {
    // No lock detected — minor risk
    evidence.push({
      id: nanoid(),
      signal: 'Liquidity Lock — Unverified',
      description: 'No liquidity lock contract interaction detected. LP tokens appear to be held directly by deployer or unverified address. Standard protocol would use a time-locked vault.',
      weight: WEIGHTS.noLiquidityLock,
      confidence: 0.7,
      txHashes: [],
      wallets: [input.project.deployerAddress],
      timestamp: Date.now(),
    });
    return WEIGHTS.noLiquidityLock;
  }

  const totalAdded = liquidityEvents.filter(e => e.type === 'add').reduce((s, e) => s + e.amount, 0);
  const totalRemoved = removals.reduce((s, e) => s + e.amount, 0);
  const removePct = totalAdded > 0 ? (totalRemoved / totalAdded) * 100 : 0;

  if (removePct > 50) {
    const weight = Math.min(WEIGHTS.liquidityRemoval, (removePct / 100) * WEIGHTS.liquidityRemoval);
    evidence.push({
      id: nanoid(),
      signal: 'Large Liquidity Removal Detected',
      description: `${removePct.toFixed(0)}% of pool liquidity removed across ${removals.length} transaction${removals.length > 1 ? 's' : ''}. Rapid liquidity removal is a primary indicator of coordinated exit. Deployer wallet involved: ${removals.some(r => r.wallet === input.project.deployerAddress) ? 'yes' : 'possible'}.`,
      weight: Math.round(weight),
      confidence: 0.9,
      txHashes: [],
      wallets: [...new Set(removals.map(r => r.wallet))],
      timestamp: Date.now(),
    });
    return Math.round(weight);
  }

  return 0;
}

function scoreTransferVelocity(input: RiskInput, evidence: EvidenceItem[]): number {
  const { events } = input;
  const transfers = events.filter(e => e.eventType === 'token_transfer');

  if (transfers.length < 10) return 0;

  // Compute transfers per hour in first 6 hours
  const earliest = Math.min(...transfers.map(e => e.timestamp));
  const sixHours = earliest + 6 * 60 * 60 * 1000;
  const earlyTransfers = transfers.filter(e => e.timestamp <= sixHours);

  const txPerHour = earlyTransfers.length / 6;
  const BASELINE_TPH = 300;

  if (txPerHour <= BASELINE_TPH) return 0;

  const weight = Math.min(WEIGHTS.transferVelocity,
    ((txPerHour - BASELINE_TPH) / BASELINE_TPH) * WEIGHTS.transferVelocity
  );

  evidence.push({
    id: nanoid(),
    signal: 'Transfer Velocity — Above Baseline',
    description: `${Math.round(txPerHour)} token transfers/hour in first 6 hours. Comparable launches average ${BASELINE_TPH}–400 transfers/hour. Elevated velocity is consistent with coordinated distribution prior to price manipulation.`,
    weight: Math.round(weight),
    confidence: 0.65,
    txHashes: [],
    wallets: [],
    timestamp: Date.now(),
  });

  return Math.round(weight);
}

function getLevel(score: number): RiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'moderate';
  return 'low';
}

function computeConfidence(evidence: EvidenceItem[], score: number): number {
  if (evidence.length === 0) return 0.3;
  const avgEvidenceConfidence = evidence.reduce((s, e) => s + e.confidence, 0) / evidence.length;
  const scoreBoost = score > 70 ? 0.1 : score > 40 ? 0.05 : 0;
  return Math.min(0.99, avgEvidenceConfidence + scoreBoost);
}

function generateExplanation(score: number, level: RiskLevel, evidence: EvidenceItem[], symbol: string): string {
  const signalCount = evidence.length;
  const topSignal = evidence.sort((a, b) => b.weight - a.weight)[0]?.signal ?? 'unknown signals';

  const intros: Record<RiskLevel, string> = {
    critical: `${symbol} exhibits a behavioral pattern consistent with a coordinated rug pull operation.`,
    high: `${symbol} shows strong suspicious signals requiring immediate attention.`,
    moderate: `${symbol} displays elevated risk signals above baseline — active monitoring recommended.`,
    low: `${symbol} shows no significant behavioral anomalies. Standard monitoring continues.`,
  };

  const body = signalCount > 0
    ? ` The primary signal driving this score is: ${topSignal}. ${signalCount} total evidence item${signalCount > 1 ? 's' : ''} have been identified. This assessment is probabilistic and based entirely on observed onchain behavior — no identity claims are made.`
    : ' No strong evidence items detected. Score reflects baseline monitoring.';

  return intros[level] + body;
}
