// GET /api/governance?projectId=xxx
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { seedMockData } from '@/lib/ingestion';

export async function GET(req: Request) {
  await seedMockData();
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get('projectId');

  if (projectId) {
    const gs = db.getGovernanceScore(projectId);
    if (!gs) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ governanceScore: gs });
  }

  // Return all governance scores
  const projects = db.getAllProjects();
  const scores = projects
    .map(p => db.getGovernanceScore(p.id))
    .filter(Boolean);

  return NextResponse.json({ scores });
}
