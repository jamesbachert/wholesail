import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/scripts — list all active scripts
export async function GET() {
  try {
    const scripts = await prisma.callScript.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return NextResponse.json(scripts);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/scripts — create a new script
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, body: scriptBody, description } = body;

    if (!title || !scriptBody) {
      return NextResponse.json(
        { error: 'Title and body are required' },
        { status: 400 }
      );
    }

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    // Get max sort order
    const maxSort = await prisma.callScript.aggregate({
      _max: { sortOrder: true },
    });

    const script = await prisma.callScript.create({
      data: {
        title,
        slug: `${slug}-${Date.now()}`, // Ensure unique
        body: scriptBody,
        description: description || null,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });

    return NextResponse.json(script, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
