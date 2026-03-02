import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const weights = await prisma.scoringWeight.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json(weights);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
