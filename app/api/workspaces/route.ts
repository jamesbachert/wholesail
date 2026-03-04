import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/workspaces — list all workspaces
export async function GET() {
  try {
    const workspaces = await prisma.workspace.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ workspaces });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/workspaces — create a new workspace
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const slug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const workspace = await prisma.workspace.create({
      data: {
        name: name.trim(),
        slug: `${slug}-${Date.now()}`,
      },
    });

    return NextResponse.json(workspace, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
