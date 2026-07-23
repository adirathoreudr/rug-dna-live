// ============================================================
// RUG DNA — GoldRush Streaming Worker
//
// Always-on process (not a serverless function): holds the
// GoldRush Streaming API WebSocket, consumes newPairs +
// updatePairs across chains and writes projects/events into the
// shared Postgres store that the Next.js app reads from.
//
// Run:  npm run worker
// Env:  GOLDRUSH_API_KEY, DATABASE_URL   (Node >= 22)
// ============================================================

import {
  GoldRushClient,
  StreamingChain,
  StreamingProtocol,
  type NewPairsStreamResponse,
  type UpdatePairsStreamResponse,
} from '@covalenthq/client-sdk';
import db from '../lib/db';
import { nanoid } from '../lib/utils';
import { ingestProject } from '../lib/ingestion';
import { computeRiskScore } from '../lib/risk-engine';
import type { Chain, Project } from '../types';

const API_KEY = process.env.GOLDRUSH_API_KEY ?? '';
if (!API_KEY || API_KEY === 'cqt_your_key_here') {
  console.error('worker: GOLDRUSH_API_KEY is required');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('worker: DATABASE_URL is required — the worker writes to the shared Postgres store');
  process.exit(1);
}

// A long-lived worker must survive transient socket/stream faults;
// the SDK reconnects the socket, the host restarts on hard crashes.
// Repeated 401s in these logs mean the API key is wrong/rotated.
process.on('uncaughtException', (e) => console.error('worker: uncaught exception', e));
process.on('unhandledRejection', (e) => console.error('worker: unhandled rejection', e));

// When GoldRush rejects the streaming subscription for lack of
// entitlement/credits, reconnecting is futile — it just burns host
// compute and hammers the API. Detect that case and stop retrying.
let streamingHalted = false;
let creditErrorCount = 0;

function isEntitlementError(err: unknown): boolean {
  const s = JSON.stringify(err ?? '');
  return s.includes('INSUFFICIENT_CREDITS') || s.includes('AUTHENTICATION_ERROR');
}

function handleSubscriptionError(scope: string, err: unknown): void {
  if (isEntitlementError(err)) {
    creditErrorCount++;
    console.error(`worker: ${scope} rejected by GoldRush — INSUFFICIENT_CREDITS / streaming not entitled on this key`);
    // Give it one retry in case of a transient blip, then halt.
    if (creditErrorCount >= 2 && !streamingHalted) {
      streamingHalted = true;
      console.error(
        '\n==================================================================\n' +
        'worker: HALTING streaming subscriptions.\n' +
        'The GoldRush Streaming API returned INSUFFICIENT_CREDITS. The\n' +
        'newPairs/updatePairs subscriptions require streaming access/credits\n' +
        'that this GOLDRUSH_API_KEY does not have. Enable the Streaming API\n' +
        '(or top up credits) on your GoldRush plan, then redeploy.\n' +
        'The Next.js app still serves real REST data for the seed tokens.\n' +
        '==================================================================\n'
      );
      client.StreamingService.disconnect().catch(() => {});
    }
    return;
  }
  console.error(`worker: ${scope} error`, err);
}

// The SDK validates the key format synchronously at construction
let client: GoldRushClient;
try {
  client = new GoldRushClient(API_KEY, {}, {
    maxReconnectAttempts: Infinity,
    shouldRetry: () => !streamingHalted,
    onOpened: () => console.log('worker: streaming socket open'),
    onClosed: () => console.log('worker: streaming socket closed — SDK will reconnect'),
    onError: (e) => console.error('worker: streaming socket error', e),
  });
} catch (e) {
  console.error('worker: GOLDRUSH_API_KEY was rejected by the SDK — check the key:', JSON.stringify(e));
  process.exit(1);
}

interface ChainConfig {
  stream: StreamingChain;
  rest: Chain;
  protocols: StreamingProtocol[];
}

const CHAINS: ChainConfig[] = [
  {
    stream: StreamingChain.ETH_MAINNET,
    rest: 'eth-mainnet' as Chain,
    protocols: [StreamingProtocol.UNISWAP_V2, StreamingProtocol.UNISWAP_V3],
  },
  {
    stream: StreamingChain.SOLANA_MAINNET,
    rest: 'solana-mainnet' as Chain,
    protocols: [
      StreamingProtocol.RAYDIUM_AMM,
      StreamingProtocol.RAYDIUM_CPMM,
      StreamingProtocol.RAYDIUM_CLMM,
      StreamingProtocol.PUMP_FUN_AMM,
      StreamingProtocol.MOONSHOT,
    ],
  },
];

// Pairs currently watched for liquidity/price updates (per chain,
// newest-first, bounded so subscriptions stay small)
const MAX_TRACKED_PAIRS = 25;
const tracked: Map<StreamingChain, string[]> = new Map();
// Last observed liquidity per pair — rug detection baseline
const lastLiquidity: Map<string, number> = new Map();
// pair address → project token address
const pairToToken: Map<string, string> = new Map();
const unsubscribers: Map<StreamingChain, () => void> = new Map();
const resubTimers: Map<StreamingChain, NodeJS.Timeout> = new Map();

// Liquidity drop that flags a potential rug (fraction of previous)
const RUG_DROP_THRESHOLD = 0.5;
const MIN_BASELINE_LIQUIDITY_USD = 1_000;

async function onNewPair(cfg: ChainConfig, p: NewPairsStreamResponse): Promise<void> {
  try {
    const token = p.base_token;
    const tokenAddress = token?.contract_address ?? '';
    if (!tokenAddress || !p.pair_address) return;

    pairToToken.set(p.pair_address, tokenAddress);
    watchPair(cfg, p.pair_address);

    const existing = await db.getProjectByToken(tokenAddress);
    if (existing) return;

    await db.pushLiveEvent({
      id: nanoid(),
      projectId: 'discovery',
      tokenSymbol: token?.contract_ticker_symbol ?? tokenAddress.slice(0, 8),
      eventType: 'pair_created',
      severity: 'info',
      message: `New ${p.protocol} pair on ${cfg.rest}: $${token?.contract_ticker_symbol ?? tokenAddress.slice(0, 10)} — liquidity $${Math.round(p.liquidity ?? 0).toLocaleString()}`,
      timestamp: Date.now(),
      txHash: p.tx_hash ?? undefined,
    });

    if (cfg.rest === 'solana-mainnet') {
      // Solana REST has no holders/tx history — build the project
      // from the stream payload itself (real deployer, real launch tx)
      const projectId = nanoid();
      const project: Project = {
        id: projectId,
        tokenAddress,
        tokenSymbol: token?.contract_ticker_symbol ?? tokenAddress.slice(0, 8),
        tokenName: token?.contract_name ?? 'Unknown',
        chain: cfg.rest,
        deployerAddress: p.deployer_address ?? '',
        createdAt: p.block_signed_at ? new Date(p.block_signed_at).getTime() : Date.now(),
        updatedAt: Date.now(),
        currentRiskLevel: 'low',
        currentRiskScore: 0,
        confidence: 0,
        evidenceSummary: 'New launch — monitoring liquidity via stream',
        holderCount: 0,
        totalSupply: String(p.supply ?? 0),
      };
      const riskScore = computeRiskScore({
        project,
        holders: [],
        wallets: [],
        events: [],
        deployerTxHistory: [],
        earlyBuyers: [],
        liquidityEvents: [{ type: 'add', amount: p.liquidity ?? 0, timestamp: project.createdAt, wallet: p.deployer_address ?? '' }],
      });
      project.currentRiskScore = riskScore.score;
      project.currentRiskLevel = riskScore.level;
      project.confidence = riskScore.confidence;
      project.evidenceSummary = riskScore.explanation.slice(0, 140);
      await db.upsertProject(project);
      await db.upsertRiskScore(riskScore);
    } else {
      // EVM: full REST ingestion (holders, deployer history, scoring)
      await ingestProject(tokenAddress, cfg.rest);
    }
  } catch (e) {
    console.error('worker: onNewPair failed', e);
  }
}

async function onPairUpdate(cfg: ChainConfig, u: UpdatePairsStreamResponse): Promise<void> {
  try {
    const pair = u.pair_address;
    if (!pair) return;
    const liquidity = u.liquidity ?? 0;
    const prev = lastLiquidity.get(pair);
    lastLiquidity.set(pair, liquidity);
    if (prev === undefined || prev < MIN_BASELINE_LIQUIDITY_USD) return;

    const dropped = liquidity < prev * (1 - RUG_DROP_THRESHOLD);
    if (!dropped) return;

    const tokenAddress = pairToToken.get(pair) ?? u.base_token?.contract_address ?? '';
    const project = tokenAddress ? await db.getProjectByToken(tokenAddress) : undefined;
    const symbol = u.base_token?.contract_ticker_symbol ?? tokenAddress.slice(0, 8);
    const removedUsd = prev - liquidity;

    if (project) {
      await db.insertEvent({
        id: `${u.id ?? nanoid()}-liquidity_remove`,
        projectId: project.id,
        chain: project.chain,
        txHash: '',
        blockHeight: 0,
        timestamp: u.timestamp ? new Date(u.timestamp).getTime() : Date.now(),
        eventType: 'liquidity_remove',
        fromAddress: u.sender || u.trader || undefined,
        amount: String(removedUsd),
        amountUsd: removedUsd,
        rawPayload: u as unknown as Record<string, unknown>,
        riskSignals: ['liquidity_drop'],
      });

      // Re-score from stored events (real observed history)
      const events = await db.getEventsByProject(project.id, 100);
      const liquidityEvents = events
        .filter(e => e.eventType === 'liquidity_add' || e.eventType === 'liquidity_remove')
        .map(e => ({
          type: e.eventType === 'liquidity_add' ? 'add' as const : 'remove' as const,
          amount: e.amountUsd ?? 0,
          timestamp: e.timestamp,
          wallet: e.fromAddress ?? '',
        }));
      const riskScore = computeRiskScore({
        project,
        holders: [],
        wallets: [],
        events,
        deployerTxHistory: [],
        earlyBuyers: [],
        liquidityEvents,
      });
      project.currentRiskScore = Math.max(project.currentRiskScore, riskScore.score);
      project.currentRiskLevel = riskScore.score >= project.currentRiskScore ? riskScore.level : project.currentRiskLevel;
      project.updatedAt = Date.now();
      await db.upsertProject(project);
      await db.upsertRiskScore(riskScore);
    }

    await db.pushLiveEvent({
      id: nanoid(),
      projectId: project?.id ?? 'stream',
      tokenSymbol: symbol,
      eventType: 'liquidity_remove',
      severity: 'critical',
      message: `⚠ $${symbol} (${cfg.rest}) liquidity dropped ${(100 * (1 - liquidity / prev)).toFixed(0)}% — $${Math.round(prev).toLocaleString()} → $${Math.round(liquidity).toLocaleString()}`,
      timestamp: Date.now(),
    });
  } catch (e) {
    console.error('worker: onPairUpdate failed', e);
  }
}

function watchPair(cfg: ChainConfig, pairAddress: string): void {
  const list = tracked.get(cfg.stream) ?? [];
  if (list.includes(pairAddress)) return;
  list.unshift(pairAddress);
  while (list.length > MAX_TRACKED_PAIRS) {
    const evicted = list.pop();
    if (evicted) { lastLiquidity.delete(evicted); pairToToken.delete(evicted); }
  }
  tracked.set(cfg.stream, list);

  // Debounce resubscription so bursts of new pairs don't churn the socket
  const existingTimer = resubTimers.get(cfg.stream);
  if (existingTimer) clearTimeout(existingTimer);
  resubTimers.set(cfg.stream, setTimeout(() => resubscribeUpdates(cfg), 5_000));
}

function resubscribeUpdates(cfg: ChainConfig): void {
  const list = tracked.get(cfg.stream) ?? [];
  if (list.length === 0) return;
  unsubscribers.get(cfg.stream)?.();
  const unsub = client.StreamingService.subscribeToUpdatePairs(
    { chain_name: cfg.stream, pair_addresses: [...list] },
    {
      next: (data) => { void onPairUpdate(cfg, data); },
      error: (err) => handleSubscriptionError(`updatePairs (${cfg.stream})`, err),
      complete: () => console.log(`worker: updatePairs stream completed (${cfg.stream})`),
    }
  );
  unsubscribers.set(cfg.stream, unsub);
  console.log(`worker: watching ${list.length} pairs on ${cfg.stream}`);
}

function main(): void {
  console.log('worker: starting GoldRush streaming consumer');
  for (const cfg of CHAINS) {
    client.StreamingService.subscribeToNewPairs(
      { chain_name: cfg.stream, protocols: cfg.protocols },
      {
        next: (data) => { for (const p of data) void onNewPair(cfg, p); },
        error: (err) => handleSubscriptionError(`newPairs (${cfg.stream})`, err),
        complete: () => console.log(`worker: newPairs stream completed (${cfg.stream})`),
      }
    );
    console.log(`worker: subscribed to newPairs on ${cfg.stream} [${cfg.protocols.join(', ')}]`);
  }

  // Heartbeat so hosting logs show liveness
  setInterval(() => {
    const watched = [...tracked.values()].reduce((s, l) => s + l.length, 0);
    console.log(`worker: alive — watching ${watched} pairs, socket ${client.StreamingService.isConnected ? 'connected' : 'reconnecting'}`);
  }, 5 * 60_000);

  const shutdown = async () => {
    console.log('worker: shutting down');
    for (const unsub of unsubscribers.values()) unsub();
    await client.StreamingService.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
