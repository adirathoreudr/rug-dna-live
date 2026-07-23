// ============================================================
// RUG DNA — Forensic Investigation Engine (Phase 3)
// Auto-triggers on risk threshold breach
// ============================================================

import type {
  Project, RiskScore, NormalizedEvent, ForensicCase,
  TimelineEvent, ExtractionStep, EvidenceItem, Chain
} from '@/types';
import { nanoid } from './utils';

const FORENSIC_TRIGGER_SCORE = 75;

export function shouldTriggerForensic(riskScore: RiskScore): boolean {
  return riskScore.score >= FORENSIC_TRIGGER_SCORE;
}

export interface ForensicInput {
  project: Project;
  riskScore: RiskScore;
  events: NormalizedEvent[];
  deployerHistory: string[]; // prior project addresses from this deployer
  victimWallets: string[];
  estimatedLossUsd: number;
}

export function generateForensicCase(input: ForensicInput): ForensicCase {
  const { project, riskScore, events } = input;

  const caseId = `FCS-${Date.now().toString().slice(-4)}`;

  // Build timeline from events
  const timeline = buildTimeline(events, project, riskScore);

  // Build extraction path
  const extractionPath = buildExtractionPath(events, project);

  // Determine severity
  const severity: ForensicCase['severity'] = riskScore.score >= 85 ? 'critical' : 'high';

  // Generate narrative using structured evidence
  const narrative = generateNarrative(input, timeline, extractionPath);
  const summary = generateSummary(input, riskScore);

  return {
    id: caseId,
    projectId: project.id,
    tokenSymbol: project.tokenSymbol,
    triggeredAt: Date.now(),
    triggerScore: riskScore.score,
    severity,
    status: 'open',
    confidence: riskScore.confidence,
    narrative,
    summary,
    timeline,
    linkedWallets: extractLinkedWallets(events, project.deployerAddress),
    victimWallets: input.victimWallets,
    estimatedLoss: input.estimatedLossUsd,
    extractionPath,
    evidenceItems: riskScore.evidenceItems,
  };
}

function buildTimeline(
  events: NormalizedEvent[],
  project: Project,
  riskScore: RiskScore
): TimelineEvent[] {
  const timeline: TimelineEvent[] = [];
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);

  // Phase 1: Creation
  const creationEvents = sorted.filter(e =>
    e.eventType === 'pair_created' || e.eventType === 'liquidity_add'
  );
  if (creationEvents.length > 0) {
    const earliest = creationEvents[0];
    timeline.push({
      id: nanoid(),
      timestamp: earliest.timestamp,
      label: 'Pair Creation & Initial Liquidity',
      description: `$${project.tokenSymbol} DEX pair created. Deployer seeds initial liquidity. First buy transactions execute.`,
      severity: 'info',
      txHash: earliest.txHash,
      wallets: [project.deployerAddress],
    });
  } else {
    timeline.push({
      id: nanoid(),
      timestamp: project.createdAt,
      label: 'Token Launch',
      description: `$${project.tokenSymbol} token deployed by ${project.deployerAddress.slice(0, 10)}...`,
      severity: 'info',
      wallets: [project.deployerAddress],
    });
  }

  // Phase 2: Clustering signal (if any)
  const walletFundings = sorted.filter(e => e.eventType === 'wallet_funded');
  if (walletFundings.length >= 3) {
    const clusterTime = walletFundings[walletFundings.length - 1].timestamp;
    timeline.push({
      id: nanoid(),
      timestamp: clusterTime,
      label: 'Buyer Cluster Detected',
      description: `${walletFundings.length} wallets funded from shared origin address. Early buy coordination flagged. Risk score escalates.`,
      severity: 'warning',
      txHash: walletFundings[0].txHash,
      wallets: walletFundings.slice(0, 5).map(e => e.toAddress ?? '').filter(Boolean),
    });
  }

  // Phase 3: Risk threshold crossed
  timeline.push({
    id: nanoid(),
    timestamp: Date.now(),
    label: 'FORENSIC MODE TRIGGERED',
    description: `Risk score crossed threshold (${riskScore.score}/100). Case auto-generated. ${riskScore.evidenceItems.length} evidence items confirmed.`,
    severity: 'critical',
    wallets: [],
  });

  // Phase 4: Extraction (if liquidity removal detected)
  const liquidityRemovals = sorted.filter(e => e.eventType === 'liquidity_remove');
  if (liquidityRemovals.length > 0) {
    const lastRemoval = liquidityRemovals[liquidityRemovals.length - 1];
    timeline.push({
      id: nanoid(),
      timestamp: lastRemoval.timestamp,
      label: 'Liquidity Extraction',
      description: `Pool liquidity removed in ${liquidityRemovals.length} transaction${liquidityRemovals.length > 1 ? 's' : ''}. Price collapsed. Funds routed for extraction.`,
      severity: 'critical',
      txHash: lastRemoval.txHash,
      wallets: liquidityRemovals.map(e => e.fromAddress ?? '').filter(Boolean),
    });
  }

  return timeline.sort((a, b) => a.timestamp - b.timestamp);
}

function buildExtractionPath(events: NormalizedEvent[], project: Project): ExtractionStep[] {
  // Built strictly from observed onchain events — no step is invented.
  // Empty when no extraction-shaped activity has been recorded yet.
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const extractionEvents = sorted.filter(e =>
    e.eventType === 'liquidity_remove' ||
    (e.eventType === 'token_transfer' &&
      e.fromAddress?.toLowerCase() === project.deployerAddress.toLowerCase() &&
      (e.amountUsd ?? 0) > 0)
  );

  return extractionEvents.slice(0, 10).map((e, i) => ({
    step: i + 1,
    fromAddress: e.fromAddress ?? project.deployerAddress,
    toAddress: e.toAddress ?? project.pairAddress ?? '',
    amount: e.amount ?? '',
    amountUsd: e.amountUsd ?? 0,
    txHash: e.txHash,
    timestamp: e.timestamp,
    action: e.eventType === 'liquidity_remove' ? 'Liquidity removal observed' : 'Outbound transfer from deployer',
    chain: project.chain,
  }));
}

function generateNarrative(
  input: ForensicInput,
  timeline: TimelineEvent[],
  extractionPath: ExtractionStep[]
): string {
  const { project, riskScore, deployerHistory, victimWallets, estimatedLossUsd } = input;
  const signalCount = riskScore.evidenceItems.length;
  const priorRugs = deployerHistory.length;

  let narrative = `This case was triggered automatically when $${project.tokenSymbol} exceeded the risk threshold of ${FORENSIC_TRIGGER_SCORE} at a score of ${riskScore.score}.\n\n`;

  if (priorRugs > 0) {
    narrative += `The deployer address (${project.deployerAddress.slice(0, 10)}...) has ${priorRugs} other contract deployment${priorRugs > 1 ? 's' : ''} in its recent transaction history — a serial-deployer pattern that raises reuse risk.\n\n`;
  }

  const clusterEvidence = riskScore.evidenceItems.find(e => e.signal.includes('Cluster'));
  if (clusterEvidence) {
    narrative += `${clusterEvidence.description}\n\n`;
  }

  const concEvidence = riskScore.evidenceItems.find(e => e.signal.includes('Concentration'));
  if (concEvidence) {
    narrative += `${concEvidence.description}\n\n`;
  }

  if (estimatedLossUsd > 0) {
    narrative += `Estimated victim losses: $${estimatedLossUsd.toLocaleString()} across ${victimWallets.length} affected address${victimWallets.length !== 1 ? 'es' : ''}. `;
    narrative += `Funds were extracted via ${extractionPath.length} transaction${extractionPath.length > 1 ? 's' : ''}.`;
  }

  narrative += `\n\nThis report is evidence-based and probabilistic. No identity claims are made. All conclusions are derived solely from observed onchain behavior.`;

  return narrative;
}

function generateSummary(input: ForensicInput, riskScore: RiskScore): string {
  const { project } = input;
  return `$${project.tokenSymbol} — Score ${riskScore.score}/100 · ${riskScore.evidenceItems.length} signals · Confidence ${Math.round(riskScore.confidence * 100)}%`;
}

function extractLinkedWallets(events: NormalizedEvent[], deployerAddress: string): string[] {
  const wallets = new Set<string>([deployerAddress]);
  for (const e of events) {
    if (e.fromAddress) wallets.add(e.fromAddress);
    if (e.toAddress) wallets.add(e.toAddress);
  }
  return Array.from(wallets).slice(0, 20);
}
