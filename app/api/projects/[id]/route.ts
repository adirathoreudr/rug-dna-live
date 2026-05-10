import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { seedMockData } from '@/lib/ingestion';

export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  await seedMockData();
  const { id } = await context.params;
  const project = db.getProject(id);
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  return NextResponse.json({
    project,
    riskScore: db.getRiskScore(id),
    graph: db.getGraph(id),
    recentEvents: db.getEventsByProject(id, 30),
    forensicCase: project.forensicCaseId ? db.getForensicCase(project.forensicCaseId) : undefined,
    governanceScore: db.getGovernanceScore(id),
  });
}
