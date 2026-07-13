// ============================================================
// RUG DNA — GoldRush Live Data Client (@covalenthq/client-sdk)
// Supports: eth-mainnet, base-mainnet, matic-mainnet, solana-mainnet
//
// Error semantics: functions return `null` when the upstream API
// errored (rate limit, network, bad key) and `[]`/values when the
// call genuinely succeeded — callers must not treat failures as
// "zero holders / zero transactions".
// ============================================================

import { GoldRushClient, type Chain as SDKChain } from '@covalenthq/client-sdk';
import type { Chain, GRTokenHolder, GRTransaction, NormalizedEvent } from '@/types';

const API_KEY = process.env.GOLDRUSH_API_KEY ?? '';

let _client: GoldRushClient | null = null;
function client(): GoldRushClient {
  if (!_client) {
    _client = new GoldRushClient(API_KEY, {
      threadCount: 3,       // stay under low-tier RPS limits
      enableRetry: true,    // 429/5xx retries with backoff
      maxRetries: 3,
      retryDelay: 1000,
    });
  }
  return _client;
}

// GoldRush chain slugs (SDK accepts the kebab-case names)
const CHAIN_SLUG: Record<string, string> = {
  'eth-mainnet': 'eth-mainnet',
  'base-mainnet': 'base-mainnet',
  'matic-mainnet': 'matic-mainnet',
  'solana-mainnet': 'solana-mainnet',
};

function slug(chain: string): SDKChain {
  return (CHAIN_SLUG[chain] ?? chain) as SDKChain;
}

// token_holders_v2 / transactions_v3 are Foundational-chain (EVM) only;
// Solana REST coverage is limited to wallet balances.
function isSolana(chain: string): boolean {
  return chain === 'solana-mainnet';
}

export interface GRTokenMeta {
  name: string;
  symbol: string;
  decimals: number;
  total_supply: string;
}

export interface TokenHoldersPage {
  holders: GRTokenHolder[];
  meta: GRTokenMeta | null;
  totalHolderCount: number | null;
}

// ─── TOKEN HOLDERS + METADATA (one call) ─────────────────────
// The holders response carries contract name/symbol/decimals/supply,
// so metadata costs no extra request. Holder share is computed from
// balance / total_supply — the API does not return a percent field.
export async function getTokenHoldersPage(chain: string, tokenAddress: string, pageSize = 100): Promise<TokenHoldersPage | null> {
  if (isSolana(chain)) {
    console.warn(`GR: token_holders_v2 is not available on ${chain} — Solana holder data arrives with the Streaming integration`);
    return { holders: [], meta: null, totalHolderCount: null };
  }
  try {
    // The endpoint only accepts pageSize 100 or 1000
    const res = await client().BalanceService.getTokenHoldersV2ForTokenAddressByPage(
      slug(chain), tokenAddress, { pageSize: pageSize > 100 ? 1000 : 100 }
    );
    if (res.error) { console.error(`GR token_holders_v2 error (${tokenAddress}): ${res.error_message}`); return null; }

    const items = res.data?.items ?? [];
    const first = items[0];
    const totalSupply = first?.total_supply ?? null;

    const holders: GRTokenHolder[] = items.map(h => ({
      address: h?.address ?? '',
      balance: (h?.balance ?? 0n).toString(),
      percent_of_total_supply: totalSupply && totalSupply > 0n && h?.balance != null
        ? Number((h.balance * 1000000n) / totalSupply) / 10000
        : 0,
    }));

    const meta: GRTokenMeta | null = first ? {
      name: first.contract_name ?? 'Unknown',
      symbol: first.contract_ticker_symbol ?? tokenAddress.slice(0, 8),
      decimals: first.contract_decimals ?? 18,
      total_supply: (totalSupply ?? 0n).toString(),
    } : null;

    return { holders, meta, totalHolderCount: res.data?.pagination?.total_count ?? null };
  } catch (e) { console.error('GR token_holders_v2 failed:', tokenAddress, e); return null; }
}

export async function getTokenHolders(chain: string, tokenAddress: string, pageSize = 100): Promise<GRTokenHolder[] | null> {
  const page = await getTokenHoldersPage(chain, tokenAddress, pageSize);
  return page ? page.holders : null;
}

// ─── TOKEN METADATA ──────────────────────────────────────────
// There is no standalone token-metadata REST endpoint; metadata is
// derived from the holders response on EVM chains. On Solana it is
// unavailable over REST (Streaming integration supplies it).
export async function getTokenMetadata(chain: string, tokenAddress: string): Promise<GRTokenMeta | null> {
  const page = await getTokenHoldersPage(chain, tokenAddress, 1);
  return page?.meta ?? null;
}

// ─── SDK TX → GRTransaction ──────────────────────────────────
type SDKTx = {
  tx_hash?: string | null;
  block_height?: number | null;
  block_signed_at?: Date | null;
  from_address?: string | null;
  to_address?: string | null;
  value?: bigint | null;
  value_quote?: number | null;
  gas_price?: bigint | null;
  successful?: boolean | null;
  log_events?: Array<{
    decoded?: { name?: string | null; params?: Array<{ name?: string | null; value?: string | null; type?: string | null }> | null } | null;
    sender_address?: string | null;
    raw_log_topics?: string[] | null;
    raw_log_data?: string | null;
  }> | null;
};

function toGRTransaction(tx: SDKTx): GRTransaction {
  return {
    tx_hash: tx.tx_hash ?? '',
    block_height: tx.block_height ?? 0,
    block_signed_at: tx.block_signed_at ? new Date(tx.block_signed_at).toISOString() : new Date(0).toISOString(),
    from_address: tx.from_address ?? '',
    to_address: tx.to_address ?? '',
    value: (tx.value ?? 0n).toString(),
    value_quote: tx.value_quote ?? undefined,
    gas_price: (tx.gas_price ?? 0n).toString(),
    successful: tx.successful ?? true,
    log_events: (tx.log_events ?? []).map(l => ({
      decoded: l?.decoded ? {
        name: l.decoded.name ?? '',
        params: (l.decoded.params ?? []).map(p => ({ name: p?.name ?? '', value: p?.value ?? '', type: p?.type ?? '' })),
      } : undefined,
      sender_address: l?.sender_address ?? '',
      topics: l?.raw_log_topics ?? [],
      data: l?.raw_log_data ?? '',
    })),
  };
}

// ─── WALLET TRANSACTIONS (most recent first) ─────────────────
export async function getWalletTransactions(chain: string, address: string, pageSize = 50): Promise<GRTransaction[] | null> {
  if (isSolana(chain)) {
    console.warn(`GR: transactions_v3 is not available on ${chain}`);
    return [];
  }
  try {
    const res = await client().TransactionService.getAllTransactionsForAddressByPage(
      slug(chain), address, { noLogs: false }
    );
    if (res.error) { console.error(`GR transactions_v3 error (${address}): ${res.error_message}`); return null; }
    return (res.data?.items ?? []).slice(0, pageSize).map(tx => toGRTransaction(tx as SDKTx));
  } catch (e) { console.error('GR transactions_v3 failed:', address, e); return null; }
}

// ─── EARLIEST TRANSACTIONS (real deployer / launch detection) ─
// transactions_v3 returns newest-first; deployer and genuine early
// buyers must come from the dedicated earliest-transactions endpoint.
export async function getEarliestTransactions(chain: string, address: string): Promise<GRTransaction[] | null> {
  if (isSolana(chain)) return [];
  try {
    const res = await client().TransactionService.getEarliestTransactionsForAddress(slug(chain), address);
    if (res.error) { console.error(`GR earliest-txs error (${address}): ${res.error_message}`); return null; }
    return (res.data?.items ?? []).map(tx => toGRTransaction(tx as SDKTx));
  } catch (e) { console.error('GR earliest-txs failed:', address, e); return null; }
}

// ─── SOLANA: RECENT TOKEN TRANSACTIONS ───────────────────────
// Not available over REST (no Solana transactions_v3). The Streaming
// integration is the real-time source for Solana activity.
export async function getSolanaTokenTransactions(_tokenMint: string, _pageSize = 50): Promise<GRTransaction[]> {
  console.warn('GR: Solana transaction history is not available over REST — pending Streaming integration');
  return [];
}

// ─── SOLANA: WALLET BALANCES (supported on Solana REST) ──────
export async function getSolanaWalletBalances(walletAddress: string) {
  try {
    const res = await client().BalanceService.getTokenBalancesForWalletAddress('solana-mainnet' as SDKChain, walletAddress);
    if (res.error) { console.error(`GR balances error (${walletAddress}): ${res.error_message}`); return null; }
    return (res.data?.items ?? []).map(b => ({
      contract_address: b?.contract_address ?? '',
      contract_ticker_symbol: b?.contract_ticker_symbol ?? '',
      balance: (b?.balance ?? 0n).toString(),
      quote: b?.quote ?? undefined,
    }));
  } catch (e) { console.error('GR balances failed:', walletAddress, e); return null; }
}

// ─── DEX POOLS / NEW PAIRS ───────────────────────────────────
// The legacy `xy=k` REST endpoints these functions used have been
// retired from the Foundational API. New-pair discovery and pool
// liquidity now come from the GoldRush Streaming API (`newPairs` /
// `updatePairs` subscriptions) — wired in the streaming worker phase.
// These stubs intentionally make no network calls.
export async function getDexPools(_chain: string, _dex = 'uniswap_v3', _pageSize = 25) {
  return [] as Array<{ pair_address: string; token0: string; token1: string; total_liquidity_quote?: number; volume_24h_quote?: number }>;
}

export async function getNewDexPairs(_chain: string, _dex = 'uniswap_v3', _pageSize = 20) {
  return [] as Array<{ pair_address: string; token0_contract_address: string; token1_contract_address: string; token0_contract_ticker_symbol: string; token1_contract_ticker_symbol: string; block_signed_at: string; total_liquidity_quote?: number }>;
}

export async function getSolanaNewTokens(_pageSize = 20) {
  return [] as Array<{ pair_address: string; token0_contract_address: string; token1_contract_address: string; token0_contract_ticker_symbol: string; block_signed_at: string; total_liquidity_quote?: number }>;
}

// ─── NORMALIZE TX → EVENT ────────────────────────────────────
export function normalizeTxToEvent(tx: GRTransaction, projectId: string, chain: string, eventType: NormalizedEvent['eventType'] = 'token_transfer'): NormalizedEvent {
  return {
    id: `${tx.tx_hash}-${eventType}`,
    projectId,
    chain: chain as Chain,
    txHash: tx.tx_hash,
    blockHeight: tx.block_height,
    timestamp: new Date(tx.block_signed_at).getTime(),
    eventType,
    fromAddress: tx.from_address,
    toAddress: tx.to_address ?? undefined,
    amount: tx.value,
    amountUsd: tx.value_quote ?? undefined,
    rawPayload: tx as unknown as Record<string, unknown>,
    riskSignals: [],
  };
}

// ─── CHECK API KEY ────────────────────────────────────────────
export function hasApiKey(): boolean {
  return !!API_KEY && API_KEY !== 'cqt_demo' && API_KEY !== 'cqt_your_key_here';
}
