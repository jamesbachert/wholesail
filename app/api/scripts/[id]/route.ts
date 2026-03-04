import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/scripts/[id] — update a script
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Guard: cannot edit pre-built scripts
    const existing = await prisma.callScript.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 });
    }
    if (!existing.workspaceId) {
      return NextResponse.json({ error: 'Cannot edit pre-built scripts' }, { status: 403 });
    }

    const body = await request.json();
    const { title, body: scriptBody, description, isDefault, isActive } = body;

    const script = await prisma.callScript.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(scriptBody !== undefined && { body: scriptBody }),
        ...(description !== undefined && { description }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // If setting as default, unset others in the same workspace
    if (isDefault) {
      await prisma.callScript.updateMany({
        where: { id: { not: id }, workspaceId: existing.workspaceId },
        data: { isDefault: false },
      });
    }

    return NextResponse.json(script);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/scripts/[id] — soft delete a script
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Guard: cannot delete pre-built scripts
    const existing = await prisma.callScript.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Script not found' }, { status: 404 });
    }
    if (!existing.workspaceId) {
      return NextResponse.json({ error: 'Cannot delete pre-built scripts' }, { status: 403 });
    }

    await prisma.callScript.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
