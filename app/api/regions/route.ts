import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const regions = await prisma.region.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        state: true,
        counties: true,
        zipCodes: true,
      },
    });

    return NextResponse.json({ regions });
  } catch (error: any) {
    console.error('Error fetching regions:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
