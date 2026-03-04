import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PATCH /api/sms-templates/[id] — update a template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Guard: cannot edit pre-built templates
    const existing = await prisma.smsTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    if (!existing.workspaceId) {
      return NextResponse.json({ error: 'Cannot edit pre-built templates' }, { status: 403 });
    }

    const body = await request.json();
    const { title, body: templateBody, description, language, isDefault, isActive } = body;

    const template = await prisma.smsTemplate.update({
      where: { id },
      data: {
        ...(title !== undefined && { title }),
        ...(templateBody !== undefined && { body: templateBody }),
        ...(description !== undefined && { description }),
        ...(language !== undefined && { language }),
        ...(isDefault !== undefined && { isDefault }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    // If setting as default, unset others in the same workspace + language
    if (isDefault) {
      await prisma.smsTemplate.updateMany({
        where: {
          id: { not: id },
          workspaceId: existing.workspaceId,
          language: existing.language,
        },
        data: { isDefault: false },
      });
    }

    return NextResponse.json(template);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE /api/sms-templates/[id] — soft delete a template
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Guard: cannot delete pre-built templates
    const existing = await prisma.smsTemplate.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    if (!existing.workspaceId) {
      return NextResponse.json({ error: 'Cannot delete pre-built templates' }, { status: 403 });
    }

    await prisma.smsTemplate.update({
      where: { id },
      data: { isActive: false },
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
