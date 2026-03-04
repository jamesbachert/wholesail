import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/workspaces/[id] — update workspace name
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name } = body;

    const workspace = await prisma.workspace.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
      },
    });

    return NextResponse.json(workspace);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/workspaces/[id] — delete workspace
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Guard: check for custom scripts/templates referencing this workspace
    const [scriptCount, templateCount] = await Promise.all([
      prisma.callScript.count({ where: { workspaceId: id, isActive: true } }),
      prisma.smsTemplate.count({ where: { workspaceId: id, isActive: true } }),
    ]);

    if (scriptCount > 0 || templateCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete workspace with ${scriptCount + templateCount} active scripts/templates. Delete them first.` },
        { status: 400 }
      );
    }

    await prisma.workspace.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
