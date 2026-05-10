// GET /api/solana — Solana-specific intelligence endpoint
import { NextResponse } from 'next/server';
import { seedMockData } from '@/lib/ingestion';
import db from '@/lib/db';
import { getSolanaNewTokens, hasApiKey } from '@/lib/goldrush';

export const dynamic = 'force-dynamic';

export async function GET() {
  await seedMockData();

  const allProjects = db.getAllProjects();
  const solanaProjects = allProjects.filter(p => p.chain === 'solana-mainnet');

  let newLaunches: any[] = [];
  if (hasApiKey()) {
    try { newLaunches = await getSolanaNewTokens(10); } catch {}
  }

  return NextResponse.json({
    chain: 'solana-mainnet',
    monitoredProjects: solanaProjects.length,
    projects: solanaProjects,
    newLaunches: newLaunches.slice(0, 10),
    stats: {
      critical: solanaProjects.filter(p => p.currentRiskLevel === 'critical').length,
      high: solanaProjects.filter(p => p.currentRiskLevel === 'high').length,
      total: solanaProjects.length,
    },
    apiKeyPresent: hasApiKey(),
  });
}
