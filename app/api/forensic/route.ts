// GET /api/forensic — list all cases
// GET /api/forensic?id=FCS-xxx — get specific case
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { seedMockData } from '@/lib/ingestion';

export async function GET(req: Request) {
  await seedMockData();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (id) {
    const fc = await db.getForensicCase(id);
    if (!fc) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    return NextResponse.json({ case: fc });
  }

  const cases = await db.getAllForensicCases();
  return NextResponse.json({ cases, total: cases.length });
}
