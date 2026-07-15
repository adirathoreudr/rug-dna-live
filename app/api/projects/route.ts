// GET /api/projects
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { seedMockData } from '@/lib/ingestion';

export async function GET(req: Request) {
  await seedMockData();

  const { searchParams } = new URL(req.url);
  const riskFilter = searchParams.get('risk');
  const chain = searchParams.get('chain');

  let projects = await db.getAllProjects();

  if (riskFilter) {
    projects = projects.filter(p => p.currentRiskLevel === riskFilter);
  }
  if (chain) {
    projects = projects.filter(p => p.chain === chain);
  }

  return NextResponse.json({
    projects,
    total: projects.length,
    stats: await db.getStats(),
    lastUpdated: Date.now(),
  });
}

// POST /api/projects — ingest a new project by token address.
// Each ingest spends GoldRush API credits, so requests are validated
// and rate-limited (per instance) before any upstream call is made.
const SUPPORTED_CHAINS = new Set(['eth-mainnet', 'base-mainnet', 'matic-mainnet', 'solana-mainnet']);
const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const SOLANA_ADDRESS = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const ingestHits: number[] = [];
const INGEST_LIMIT_PER_MIN = 5;

export async function POST(req: Request) {
  let body: { tokenAddress?: unknown; chain?: unknown };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const tokenAddress = typeof body.tokenAddress === 'string' ? body.tokenAddress.trim() : '';
  const chain = typeof body.chain === 'string' ? body.chain : '';

  if (!tokenAddress || !chain) {
    return NextResponse.json({ error: 'tokenAddress and chain required' }, { status: 400 });
  }
  if (!SUPPORTED_CHAINS.has(chain)) {
    return NextResponse.json({ error: `Unsupported chain — use one of: ${[...SUPPORTED_CHAINS].join(', ')}` }, { status: 400 });
  }
  const validAddress = chain === 'solana-mainnet' ? SOLANA_ADDRESS.test(tokenAddress) : EVM_ADDRESS.test(tokenAddress);
  if (!validAddress) {
    return NextResponse.json({ error: 'Invalid token address for the selected chain' }, { status: 400 });
  }

  const now = Date.now();
  while (ingestHits.length && ingestHits[0] < now - 60_000) ingestHits.shift();
  if (ingestHits.length >= INGEST_LIMIT_PER_MIN) {
    return NextResponse.json({ error: 'Rate limit exceeded — try again in a minute' }, { status: 429 });
  }
  ingestHits.push(now);

  const { ingestProject } = await import('@/lib/ingestion');
  const project = await ingestProject(tokenAddress, chain as never);

  if (!project) {
    return NextResponse.json({ error: 'Failed to ingest project — token may have no indexed data on this chain' }, { status: 502 });
  }

  return NextResponse.json({ project }, { status: 201 });
}
