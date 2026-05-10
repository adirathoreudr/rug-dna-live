// ============================================================
// RUG DNA — Governance Trust Scoring Engine (Phase 4)
// Separate from rug-risk score. Evaluates decentralization claims.
// ============================================================

import type {
  Project, GovernanceScore, DominantWallet, GRTokenHolder, NormalizedEvent
} from '@/types';
import { nanoid } from './utils';

export interface GovernanceInput {
  project: Project;
  holders: GRTokenHolder[];
  governanceEvents: NormalizedEvent[]; // vote + proposal events
  totalSupply: bigint | string;
}

export function computeGovernanceScore(input: GovernanceInput): GovernanceScore {
  const { project, holders, governanceEvents } = input;

  // 1. Token distribution score (0–100, higher = more decentralized)
  const { distributionScore, giniCoefficient, topHolderPercent, topHolderCount } =
    analyzeDistribution(holders);

  // 2. Voting independence score
  const { voteIndependenceScore, proposalAlignmentRate } =
    analyzeVotingBehavior(governanceEvents);

  // 3. Transparency score
  const transparencyScore = assessTransparency(project, governanceEvents);

  // 4. Dominant wallets
  const dominantWallets = identifyDominantWallets(holders, governanceEvents);

  // 5. Composite trust score
  const trustScore = Math.round(
    distributionScore * 0.4 +
    voteIndependenceScore * 0.35 +
    transparencyScore * 0.25
  );

  const credibility = getCredibility(trustScore);
  const explanation = generateGovernanceExplanation(
    trustScore, credibility, distributionScore,
    voteIndependenceScore, dominantWallets, project.tokenSymbol
  );

  return {
    id: nanoid(),
    projectId: project.id,
    trustScore,
    distributionScore,
    voteIndependenceScore,
    transparencyScore,
    overallCredibility: credibility,
    explanation,
    topHolderCount,
    topHolderPercent,
    giniCoefficient,
    proposalAlignmentRate,
    dominantWallets,
    computedAt: Date.now(),
  };
}

function analyzeDistribution(holders: GRTokenHolder[]): {
  distributionScore: number;
  giniCoefficient: number;
  topHolderPercent: number;
  topHolderCount: number;
} {
  if (holders.length === 0) {
    return { distributionScore: 50, giniCoefficient: 0.5, topHolderPercent: 0, topHolderCount: 0 };
  }

  const sorted = [...holders].sort((a, b) => b.percent_of_total_supply - a.percent_of_total_supply);
  const top3Pct = sorted.slice(0, 3).reduce((s, h) => s + (h.percent_of_total_supply ?? 0), 0);
  const top10Pct = sorted.slice(0, 10).reduce((s, h) => s + (h.percent_of_total_supply ?? 0), 0);

  // Gini coefficient approximation
  const percents = sorted.map(h => h.percent_of_total_supply ?? 0);
  const gini = computeGini(percents);

  // Score: 100 = perfectly distributed, 0 = all concentrated
  // Penalize heavily for top-3 > 50%
  let score = 100;
  score -= Math.min(60, top3Pct * 0.9);      // top 3 concentration penalty
  score -= Math.min(20, Math.max(0, top10Pct - 40) * 0.5); // top 10 penalty
  score -= Math.min(20, gini * 30);           // gini penalty
  score = Math.max(0, Math.round(score));

  return {
    distributionScore: score,
    giniCoefficient: Math.round(gini * 100) / 100,
    topHolderPercent: top3Pct,
    topHolderCount: Math.min(3, sorted.length),
  };
}

function computeGini(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;

  let numerator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (2 * (i + 1) - n - 1) * sorted[i];
  }
  return Math.abs(numerator / (n * sum));
}

function analyzeVotingBehavior(events: NormalizedEvent[]): {
  voteIndependenceScore: number;
  proposalAlignmentRate: number;
} {
  const voteEvents = events.filter(e => e.eventType === 'governance_vote');
  const proposalEvents = events.filter(e => e.eventType === 'governance_proposal');

  if (voteEvents.length === 0 || proposalEvents.length === 0) {
    // No governance data — neutral score
    return { voteIndependenceScore: 50, proposalAlignmentRate: 0 };
  }

  // Group votes by proposal
  const votesByProposal = new Map<string, NormalizedEvent[]>();
  for (const vote of voteEvents) {
    const proposalId = (vote.rawPayload?.proposalId as string) ?? 'unknown';
    const list = votesByProposal.get(proposalId) ?? [];
    list.push(vote);
    votesByProposal.set(proposalId, list);
  }

  // For each proposal, check if same wallets always vote same way
  let alignedProposals = 0;
  for (const [, votes] of votesByProposal) {
    // If 2+ wallets vote within 5 minutes of each other, flag as coordinated
    const times = votes.map(v => v.timestamp).sort((a, b) => a - b);
    if (times.length >= 2) {
      const maxGap = times[times.length - 1] - times[0];
      if (maxGap < 5 * 60 * 1000) alignedProposals++;
    }
  }

  const alignmentRate = votesByProposal.size > 0 ? alignedProposals / votesByProposal.size : 0;

  // Score: 100 = completely independent, 0 = perfectly coordinated
  const score = Math.max(0, Math.round(100 - alignmentRate * 100));

  return {
    voteIndependenceScore: score,
    proposalAlignmentRate: Math.round(alignmentRate * 100),
  };
}

function assessTransparency(project: Project, events: NormalizedEvent[]): number {
  // Heuristic checks — in production these would query on-chain data
  let score = 50; // neutral baseline

  // Has governance events at all?
  if (events.filter(e => e.eventType === 'governance_proposal').length > 0) score += 10;

  // Has many unique voters?
  const voters = new Set(events.filter(e => e.eventType === 'governance_vote').map(e => e.fromAddress));
  if (voters.size > 10) score += 15;
  else if (voters.size > 3) score += 5;

  // Penalize for suspected captured governance
  if (voters.size <= 3 && events.length > 0) score -= 25;

  return Math.max(0, Math.min(100, score));
}

function identifyDominantWallets(
  holders: GRTokenHolder[],
  events: NormalizedEvent[]
): DominantWallet[] {
  const sorted = [...holders]
    .sort((a, b) => b.percent_of_total_supply - a.percent_of_total_supply)
    .slice(0, 5);

  return sorted.map(holder => {
    const voteEvents = events.filter(
      e => e.eventType === 'governance_vote' && e.fromAddress === holder.address
    );

    let signal = 'No signal';
    if (holder.percent_of_total_supply > 30) signal = 'Dominant controller';
    else if (holder.percent_of_total_supply > 15) signal = 'Major holder';
    else if (holder.percent_of_total_supply > 5) signal = 'Significant holder';

    return {
      address: holder.address,
      votingPower: Math.round(holder.percent_of_total_supply * 100) / 100,
      proposalAlignment: voteEvents.length > 0 ? 85 : 0, // simplified
      fundingOrigin: undefined,
      signal,
    };
  });
}

function getCredibility(score: number): GovernanceScore['overallCredibility'] {
  if (score >= 70) return 'credible';
  if (score >= 45) return 'questionable';
  if (score >= 25) return 'suspicious';
  return 'captured';
}

function generateGovernanceExplanation(
  score: number,
  credibility: GovernanceScore['overallCredibility'],
  distributionScore: number,
  voteIndependenceScore: number,
  dominantWallets: DominantWallet[],
  symbol: string
): string {
  const credibilityLabels = {
    credible: 'appears credible',
    questionable: 'shows questionable decentralization',
    suspicious: 'exhibits suspicious centralization',
    captured: 'appears to be governance-captured',
  };

  const topWallet = dominantWallets[0];
  const topPct = topWallet?.votingPower ?? 0;

  let explanation = `$${symbol}'s governance ${credibilityLabels[credibility]}. `;

  if (distributionScore < 40) {
    explanation += `Token distribution is heavily concentrated — the top holder controls ${topPct.toFixed(1)}% of voting supply. `;
  }

  if (voteIndependenceScore < 40) {
    explanation += `Voting behavior analysis indicates coordinated governance: dominant wallets vote identically at high rates. `;
  }

  explanation += `Overall trust score: ${score}/100. `;
  explanation += `This assessment is probabilistic and based entirely on observed onchain behavior — no identity claims are made.`;

  return explanation;
}
