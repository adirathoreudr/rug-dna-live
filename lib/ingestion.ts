// ============================================================
// RUG DNA — Live Data Ingestion Pipeline
// Sources: Ethereum, Base, Matic, Solana via GoldRush
// ============================================================

import type { Project, Wallet, NormalizedEvent, RiskLevel, Chain, GRTransaction } from '@/types';
import db from './db';
import { nanoid } from './utils';
import {
  normalizeTxToEvent, hasApiKey, getNewDexPairs, getSolanaNewTokens,
  getSolanaTokenTransactions, getTokenHoldersPage, getEarliestTransactions,
  getWalletTransactions,
} from './goldrush';
import { computeRiskScore } from './risk-engine';
import { buildGraph } from './graph-builder';
import { shouldTriggerForensic, generateForensicCase } from './forensic-engine';
import { computeGovernanceScore } from './governance-engine';

let initialized = false;

// ─── MONITORED PROJECTS (real contracts across chains) ───────
// These are real tokens with known behavioral patterns for demo
const LIVE_PROJECTS: Array<{ tokenAddress: string; chain: string; pairAddress?: string }> = [
  // Ethereum — high-volume tokens for rich holder/tx data
  { tokenAddress: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', chain: 'eth-mainnet' }, // PEPE
  { tokenAddress: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', chain: 'eth-mainnet' }, // SHIB
  { tokenAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', chain: 'eth-mainnet' }, // UNI
  // Base
  { tokenAddress: '0x532f27101965dd16442E59d40670FaF5eBB142E4', chain: 'base-mainnet' }, // BRETT
  { tokenAddress: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', chain: 'base-mainnet' }, // DEGEN
  // Solana — REST coverage is balances-only; these ingest once the
  // Streaming integration lands and are skipped gracefully until then
  { tokenAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', chain: 'solana-mainnet' }, // BONK
  { tokenAddress: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', chain: 'solana-mainnet' }, // WIF
  { tokenAddress: 'MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5', chain: 'solana-mainnet' },  // MEW
];

// ─── INIT — fetch live data on startup ───────────────────────
export async function seedMockData() {
  if (initialized) return;
  initialized = true;

  if (!hasApiKey()) {
    console.warn('RUG DNA: No GoldRush API key — add GOLDRUSH_API_KEY to .env.local');
    await seedFallback();
    return;
  }

  // Ingest all live projects; awaited so the first request that
  // triggers seeding actually returns data instead of an empty list
  const results = await Promise.allSettled(
    LIVE_PROJECTS.map(p => ingestProject(p.tokenAddress, p.chain as Chain))
  );
  const ok = results.filter(r => r.status === 'fulfilled' && r.value).length;
  console.log(`RUG DNA: Ingested ${ok}/${LIVE_PROJECTS.length} live projects`);

  // Discover new launches (no-op until the Streaming worker lands)
  discoverNewLaunches();
}

// ─── INGEST A SINGLE PROJECT ─────────────────────────────────
export async function ingestProject(tokenAddress: string, chain: Chain): Promise<Project | null> {
  try {
    // Check if already tracked
    const existing = db.getProjectByToken(tokenAddress);
    if (existing) return existing;

    // One call: holders + token metadata + total holder count.
    // null = upstream error (rate limit/network) — do not treat as empty.
    const holdersPage = await getTokenHoldersPage(chain, tokenAddress, 100);
    if (!holdersPage) {
      console.error(`ingest: holders fetch failed for ${tokenAddress} (${chain})`);
      return null;
    }
    const { holders, meta } = holdersPage;
    if (!meta) {
      console.warn(`ingest: no REST metadata for ${tokenAddress} on ${chain} — skipped`);
      return null;
    }

    // Earliest transactions → real deployer, real launch date,
    // genuine early buyers (transactions_v3 alone is newest-first)
    const earliest = (await getEarliestTransactions(chain, tokenAddress)) ?? [];
    const firstTx = earliest[0];
    const deployerAddress = firstTx?.from_address ?? '';
    const createdAt = firstTx ? new Date(firstTx.block_signed_at).getTime() : Date.now();

    // Recent transactions → live activity events
    const txs = (chain === 'solana-mainnet'
      ? await getSolanaTokenTransactions(tokenAddress, 50)
      : await getWalletTransactions(chain, tokenAddress, 50)) ?? [];

    const projectId = nanoid();
    const project: Project = {
      id: projectId,
      tokenAddress,
      tokenSymbol: meta.symbol,
      tokenName: meta.name,
      chain,
      deployerAddress: deployerAddress || '0x0000000000000000000000000000000000000000',
      createdAt,
      updatedAt: Date.now(),
      currentRiskLevel: 'low',
      currentRiskScore: 0,
      confidence: 0,
      evidenceSummary: 'Analyzing...',
      holderCount: holdersPage.totalHolderCount ?? holders.length,
      totalSupply: meta.total_supply,
    };
    db.upsertProject(project);

    // Normalize transactions to events
    const events: NormalizedEvent[] = txs.map(tx =>
      normalizeTxToEvent(tx, projectId, chain, detectEventType(tx))
    );
    for (const ev of events) db.insertEvent(ev);

    // Build wallets from holder data — only fields actually observed
    const now = Date.now();
    const wallets: Wallet[] = holders.slice(0, 30).map(h => ({
      address: h.address,
      chain,
      firstSeen: now,
      lastSeen: now,
      transactionCount: 0,
      isDeployer: !!deployerAddress && h.address.toLowerCase() === deployerAddress.toLowerCase(),
      isSuspicious: false,
      labels: [],
      balance: h.balance,
    }));
    for (const w of wallets) db.upsertWallet(w);

    // Deployer wallet + prior contract deployments (reuse signal).
    // Contract-creation txs have no to_address.
    let deployerTxHistory: string[] = [];
    if (deployerAddress) {
      db.upsertWallet({
        address: deployerAddress,
        chain,
        firstSeen: createdAt,
        lastSeen: now,
        transactionCount: earliest.length,
        isDeployer: true,
        isSuspicious: false,
        labels: ['deployer'],
      });
      const deployerTxs = await getWalletTransactions(chain, deployerAddress, 50);
      deployerTxHistory = (deployerTxs ?? [])
        .filter(tx =>
          !tx.to_address &&
          tx.from_address.toLowerCase() === deployerAddress.toLowerCase() &&
          tx.tx_hash !== firstTx?.tx_hash
        )
        .map(tx => tx.tx_hash);
    }

    // Early buyers: senders of the genuinely earliest transactions
    const earlyBuyers = earliest.slice(0, 10)
      .filter(tx => tx.from_address && tx.from_address.toLowerCase() !== deployerAddress.toLowerCase())
      .map(tx => ({
        address: tx.from_address,
        timestamp: new Date(tx.block_signed_at).getTime(),
        fundingSource: undefined,
      }));

    // Liquidity events from tx log
    const liquidityEvents = events
      .filter(e => e.eventType === 'liquidity_add' || e.eventType === 'liquidity_remove')
      .map(e => ({
        type: e.eventType === 'liquidity_add' ? 'add' as const : 'remove' as const,
        amount: e.amountUsd ?? 0,
        timestamp: e.timestamp,
        wallet: e.fromAddress ?? '',
      }));

    // Score
    const riskInput = {
      project,
      holders,
      wallets,
      events,
      deployerTxHistory,
      earlyBuyers,
      liquidityEvents,
    };
    const riskScore = computeRiskScore(riskInput);
    db.upsertRiskScore(riskScore);

    project.currentRiskScore = riskScore.score;
    project.currentRiskLevel = riskScore.level;
    project.confidence = riskScore.confidence;
    project.evidenceSummary = riskScore.explanation.slice(0, 140);
    project.updatedAt = Date.now();
    db.upsertProject(project);

    // Graph
    const { nodes, edges } = buildGraph({ project, wallets, events, deployerAddress: project.deployerAddress });
    for (const n of nodes) db.upsertGraphNode(n);
    for (const e of edges) db.upsertGraphEdge(e);

    // Forensic — loss estimate derives from observed liquidity
    // removals; no invented figures
    if (shouldTriggerForensic(riskScore)) {
      const realizedRemovalUsd = liquidityEvents
        .filter(e => e.type === 'remove')
        .reduce((s, e) => s + e.amount, 0);
      const fc = generateForensicCase({
        project, riskScore, events,
        deployerHistory: deployerTxHistory,
        victimWallets: wallets.filter(w => !w.isSuspicious).map(w => w.address).slice(0, 20),
        estimatedLossUsd: realizedRemovalUsd,
      });
      db.upsertForensicCase(fc);
      project.forensicCaseId = fc.id;
      db.upsertProject(project);
    }

    // Governance
    const govInput = {
      project,
      holders,
      governanceEvents: events.filter(e => e.eventType === 'governance_vote' || e.eventType === 'governance_proposal'),
      totalSupply: meta.total_supply,
    };
    const govScore = computeGovernanceScore(govInput);
    db.upsertGovernanceScore(govScore);
    project.governanceScoreId = govScore.id;
    db.upsertProject(project);

    // Push live event
    db.pushLiveEvent({
      id: nanoid(),
      projectId,
      tokenSymbol: project.tokenSymbol,
      eventType: 'pair_created',
      severity: riskScore.score > 70 ? 'critical' : riskScore.score > 40 ? 'warning' : 'info',
      message: `$${project.tokenSymbol} (${chain}) — Risk: ${riskScore.score}/100 · ${riskScore.level.toUpperCase()} · ${project.holderCount} holders`,
      timestamp: Date.now(),
    });

    return project;
  } catch (err) {
    console.error(`ingestProject failed for ${tokenAddress}:`, err);
    return null;
  }
}

// ─── DISCOVER NEW LAUNCHES ────────────────────────────────────
// The legacy xy=k REST discovery endpoints are retired; these calls
// return [] until the Streaming worker (newPairs subscription) lands.
async function discoverNewLaunches() {
  try {
    const [ethPairs, basePairs, solanaPairs] = await Promise.all([
      getNewDexPairs('eth-mainnet', 'uniswap_v3', 5),
      getNewDexPairs('base-mainnet', 'uniswap_v3', 5),
      getSolanaNewTokens(5),
    ]);

    const newTokens: Array<{ address: string; chain: Chain }> = [];

    for (const p of ethPairs) {
      if (p.token0_contract_address) newTokens.push({ address: p.token0_contract_address, chain: 'eth-mainnet' });
    }
    for (const p of basePairs) {
      if (p.token0_contract_address) newTokens.push({ address: p.token0_contract_address, chain: 'base-mainnet' });
    }
    for (const p of solanaPairs) {
      if (p.token0_contract_address) newTokens.push({ address: p.token0_contract_address, chain: 'solana-mainnet' as Chain });
    }

    // Ingest top 5 new tokens (avoid overloading API)
    for (const token of newTokens.slice(0, 5)) {
      await ingestProject(token.address, token.chain);
    }

    if (newTokens.length > 0) {
      db.pushLiveEvent({
        id: nanoid(),
        projectId: 'system',
        tokenSymbol: 'SCAN',
        eventType: 'pair_created',
        severity: 'info',
        message: `New launch scan complete — ${newTokens.length} new pairs detected across ETH, Base, Solana`,
        timestamp: Date.now(),
      });
    }
  } catch (e) {
    console.error('discoverNewLaunches failed:', e);
  }
}

// ─── DETECT EVENT TYPE FROM TX ────────────────────────────────
function detectEventType(tx: GRTransaction): NormalizedEvent['eventType'] {
  const logs = tx.log_events ?? [];
  for (const log of logs) {
    const name = log.decoded?.name?.toLowerCase() ?? '';
    if (name.includes('mint') || name.includes('addliquidity')) return 'liquidity_add';
    if (name.includes('burn') || name.includes('removeliquidity')) return 'liquidity_remove';
    if (name.includes('swap')) return 'swap';
    if (name.includes('transfer')) return 'token_transfer';
  }
  return 'token_transfer';
}

// ─── FALLBACK when no API key ────────────────────────────────
async function seedFallback() {
  const FALLBACK = [
    { sym: 'PEPE', chain: 'eth-mainnet', score: 62, holders: 184000 },
    { sym: 'BRETT', chain: 'base-mainnet', score: 44, holders: 52000 },
    { sym: 'BONK', chain: 'solana-mainnet', score: 38, holders: 890000 },
    { sym: 'WIF', chain: 'solana-mainnet', score: 55, holders: 340000 },
    { sym: 'MEW', chain: 'solana-mainnet', score: 71, holders: 120000 },
  ];

  for (const f of FALLBACK) {
    const id = nanoid();
    const level = getRiskLevel(f.score);
    const project: Project = {
      id,
      tokenAddress: '0x' + id + '0'.repeat(40 - id.length),
      tokenSymbol: f.sym,
      tokenName: f.sym + ' Token',
      chain: f.chain as Chain,
      deployerAddress: '0x' + nanoid() + '0'.repeat(28),
      createdAt: Date.now() - Math.random() * 7 * 86400000,
      updatedAt: Date.now(),
      currentRiskLevel: level,
      currentRiskScore: f.score,
      confidence: 0.65 + Math.random() * 0.25,
      evidenceSummary: `Live GoldRush data requires API key. Add GOLDRUSH_API_KEY to .env.local`,
      holderCount: f.holders,
      totalSupply: '1000000000000000000000000000',
    };
    db.upsertProject(project);
    db.pushLiveEvent({
      id: nanoid(), projectId: id, tokenSymbol: f.sym,
      eventType: 'pair_created', severity: f.score > 65 ? 'warning' : 'info',
      message: `[NO API KEY] $${f.sym} on ${f.chain} — Add GOLDRUSH_API_KEY for live data`,
      timestamp: Date.now() - Math.random() * 3600000,
    });
  }
}

function getRiskLevel(score: number): RiskLevel {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'moderate';
  return 'low';
}
