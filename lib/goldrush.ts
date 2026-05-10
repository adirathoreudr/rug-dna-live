// ============================================================
// RUG DNA — GoldRush Live Data Client
// Supports: eth-mainnet, base-mainnet, matic-mainnet, solana-mainnet
// ============================================================

import type { Chain, GRTokenHolder, GRTransaction, NormalizedEvent } from '@/types';

const API_KEY = process.env.GOLDRUSH_API_KEY ?? '';
const BASE = 'https://api.covalenthq.com/v1';

// Solana uses a different base endpoint via GoldRush
const SOLANA_BASE = 'https://api.covalenthq.com/v1';

// GoldRush chain slugs
const CHAIN_SLUG: Record<string, string> = {
  'eth-mainnet': 'eth-mainnet',
  'base-mainnet': 'base-mainnet',
  'matic-mainnet': 'matic-mainnet',
  'solana-mainnet': 'solana-mainnet',
};

async function grFetch<T>(path: string, isStream = false): Promise<T | null> {
  if (!API_KEY) { console.warn('No GOLDRUSH_API_KEY set'); return null; }
  try {
    const url = `${BASE}${path}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${API_KEY}` },
      next: { revalidate: 60 },
    });
    if (!res.ok) { console.error(`GR ${res.status}: ${path}`); return null; }
    const json = await res.json();
    if (json.error) { console.error(`GR error: ${json.error_message}`); return null; }
    return json.data as T;
  } catch (e) { console.error('GR fetch failed:', path, e); return null; }
}

// ─── TOKEN HOLDERS ───────────────────────────────────────────
export async function getTokenHolders(chain: string, tokenAddress: string, pageSize = 100): Promise<GRTokenHolder[]> {
  const slug = CHAIN_SLUG[chain] ?? chain;
  const data = await grFetch<{ items: GRTokenHolder[] }>(
    `/${slug}/tokens/${tokenAddress}/token_holders_v2/?page-size=${pageSize}&key=${API_KEY}`
  );
  return data?.items ?? [];
}

// ─── WALLET TRANSACTIONS ─────────────────────────────────────
export async function getWalletTransactions(chain: string, address: string, pageSize = 50): Promise<GRTransaction[]> {
  const slug = CHAIN_SLUG[chain] ?? chain;
  const data = await grFetch<{ items: GRTransaction[] }>(
    `/${slug}/address/${address}/transactions_v3/?page-size=${pageSize}&key=${API_KEY}`
  );
  return data?.items ?? [];
}

// ─── TOKEN METADATA ──────────────────────────────────────────
export async function getTokenMetadata(chain: string, tokenAddress: string) {
  const slug = CHAIN_SLUG[chain] ?? chain;
  // EVM chains
  if (chain !== 'solana-mainnet') {
    const data = await grFetch<{ items: Array<{ contract_name: string; contract_ticker_symbol: string; contract_decimals: number; total_supply: string }> }>(
      `/${slug}/tokens/${tokenAddress}/?key=${API_KEY}`
    );
    const item = data?.items?.[0];
    if (!item) return null;
    return { name: item.contract_name, symbol: item.contract_ticker_symbol, decimals: item.contract_decimals, total_supply: item.total_supply };
  }
  // Solana — use balances endpoint
  const data = await grFetch<{ items: Array<{ contract_name: string; contract_ticker_symbol: string; contract_decimals: number; total_supply: string }> }>(
    `/solana-mainnet/tokens/${tokenAddress}/?key=${API_KEY}`
  );
  const item = data?.items?.[0];
  if (!item) return null;
  return { name: item.contract_name || 'Unknown', symbol: item.contract_ticker_symbol || tokenAddress.slice(0, 8), decimals: item.contract_decimals || 9, total_supply: item.total_supply || '0' };
}

// ─── SOLANA: RECENT TOKEN TRANSACTIONS ───────────────────────
export async function getSolanaTokenTransactions(tokenMint: string, pageSize = 50): Promise<GRTransaction[]> {
  const data = await grFetch<{ items: GRTransaction[] }>(
    `/solana-mainnet/address/${tokenMint}/transactions_v3/?page-size=${pageSize}&key=${API_KEY}`
  );
  return data?.items ?? [];
}

// ─── SOLANA: WALLET BALANCES (to find early holders) ─────────
export async function getSolanaWalletBalances(walletAddress: string) {
  const data = await grFetch<{ items: Array<{ contract_address: string; contract_ticker_symbol: string; balance: string; quote?: number }> }>(
    `/solana-mainnet/address/${walletAddress}/balances_v2/?key=${API_KEY}`
  );
  return data?.items ?? [];
}

// ─── DEX POOLS (EVM) ─────────────────────────────────────────
export async function getDexPools(chain: string, dex = 'uniswap_v3', pageSize = 25) {
  const slug = CHAIN_SLUG[chain] ?? chain;
  const data = await grFetch<{ items: Array<{ pair_address: string; token0: string; token1: string; total_liquidity_quote?: number; volume_24h_quote?: number }> }>(
    `/${slug}/xy=k/${dex}/pools/?page-size=${pageSize}&key=${API_KEY}`
  );
  return data?.items ?? [];
}

// ─── NEW DEX PAIRS (recent launches) ─────────────────────────
export async function getNewDexPairs(chain: string, dex = 'uniswap_v3', pageSize = 20) {
  const slug = CHAIN_SLUG[chain] ?? chain;
  const data = await grFetch<{ items: Array<{ pair_address: string; token0_contract_address: string; token1_contract_address: string; token0_contract_ticker_symbol: string; token1_contract_ticker_symbol: string; block_signed_at: string; total_liquidity_quote?: number }> }>(
    `/${slug}/xy=k/${dex}/pools/new/?page-size=${pageSize}&key=${API_KEY}`
  );
  return data?.items ?? [];
}

// ─── SOLANA: NEW TOKEN LAUNCHES via GoldRush ─────────────────
export async function getSolanaNewTokens(pageSize = 20) {
  // GoldRush Solana DEX pairs (Raydium / Orca)
  const raydium = await grFetch<{ items: Array<{ pair_address: string; token0_contract_address: string; token1_contract_address: string; token0_contract_ticker_symbol: string; block_signed_at: string; total_liquidity_quote?: number }> }>(
    `/solana-mainnet/xy=k/raydium/pools/new/?page-size=${pageSize}&key=${API_KEY}`
  );
  return raydium?.items ?? [];
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
export function hasApiKey(): boolean { return !!API_KEY && API_KEY !== 'cqt_demo'; }
