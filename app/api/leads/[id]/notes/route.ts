import { NextRequest, NextResponse } from 'next/server';
import { addNote, updateNote, deleteNote } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (!body.content?.trim()) {
      return NextResponse.json({ error: 'Note content is required' }, { status: 400 });
    }

    const note = await addNote({ leadId: id, content: body.content.trim() });
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error('Error adding note:', error);
    return NextResponse.json({ error: 'Failed to add note' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params; // consume params
    const body = await request.json();

    if (!body.noteId || !body.content?.trim()) {
      return NextResponse.json({ error: 'noteId and content are required' }, { status: 400 });
    }

    const note = await updateNote(body.noteId, body.content.trim());
    return NextResponse.json(note);
  } catch (error) {
    console.error('Error updating note:', error);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await params; // consume params
    const noteId = request.nextUrl.searchParams.get('noteId');

    if (!noteId) {
      return NextResponse.json({ error: 'noteId is required' }, { status: 400 });
    }

    await deleteNote(noteId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
