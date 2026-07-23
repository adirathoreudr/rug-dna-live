import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { seedMockData } from '@/lib/ingestion';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  await seedMockData();
  const { id } = await context.params;
  const project = await db.getProject(id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  return NextResponse.json({
    project,
    riskScore: await db.getRiskScore(id),
    graph: await db.getGraph(id),
    recentEvents: await db.getEventsByProject(id, 30),
    forensicCase: project.forensicCaseId ? await db.getForensicCase(project.forensicCaseId) : undefined,
    governanceScore: await db.getGovernanceScore(id),
  });
}
