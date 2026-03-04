import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/sms-templates — list active templates (pre-built + workspace-scoped)
export async function GET(request: NextRequest) {
  try {
    const language = request.nextUrl.searchParams.get('language');
    const workspaceId = request.nextUrl.searchParams.get('workspaceId');

    const where: any = {
      isActive: true,
      OR: [
        { workspaceId: null },
        ...(workspaceId ? [{ workspaceId }] : []),
      ],
    };
    if (language) where.language = language;

    const templates = await prisma.smsTemplate.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    });

    return NextResponse.json(templates);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST /api/sms-templates — create a new workspace-scoped template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, body: templateBody, description, language, workspaceId } = body;

    if (!title || !templateBody) {
      return NextResponse.json(
        { error: 'Title and body are required' },
        { status: 400 }
      );
    }

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'workspaceId is required for custom templates' },
        { status: 400 }
      );
    }

    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const maxSort = await prisma.smsTemplate.aggregate({
      _max: { sortOrder: true },
    });

    const template = await prisma.smsTemplate.create({
      data: {
        title,
        slug: `${slug}-${Date.now()}`,
        body: templateBody,
        description: description || null,
        language: language || 'en',
        workspaceId,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
      },
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
