import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT /api/scripts/[id] — update a script
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    // If setting as default, unset others
    if (isDefault) {
      await prisma.callScript.updateMany({
        where: { id: { not: id } },
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
    await prisma.callScript.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
