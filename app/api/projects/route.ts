// GET /api/projects
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { seedMockData } from '@/lib/ingestion';

export async function GET(req: Request) {
  await seedMockData();

  const { searchParams } = new URL(req.url);
  const riskFilter = searchParams.get('risk');
  const chain = searchParams.get('chain');

  let projects = db.getAllProjects();

  if (riskFilter) {
    projects = projects.filter(p => p.currentRiskLevel === riskFilter);
  }
  if (chain) {
    projects = projects.filter(p => p.chain === chain);
  }

  return NextResponse.json({
    projects,
    total: projects.length,
    stats: db.getStats(),
    lastUpdated: Date.now(),
  });
}

// POST /api/projects — ingest a new project by token address
export async function POST(req: Request) {
  const body = await req.json();
  const { tokenAddress, chain } = body;

  if (!tokenAddress || !chain) {
    return NextResponse.json({ error: 'tokenAddress and chain required' }, { status: 400 });
  }

  const { ingestProject } = await import('@/lib/ingestion');
  const project = await ingestProject(tokenAddress, chain);

  if (!project) {
    return NextResponse.json({ error: 'Failed to ingest project' }, { status: 500 });
  }

  return NextResponse.json({ project }, { status: 201 });
}
