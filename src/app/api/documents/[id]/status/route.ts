/**
 * @fileoverview PATCH /api/documents/[id]/status — updates document review status.
 */

import { updateDocumentStatus } from '@/lib/documentStore';
import type { DocumentStatus } from '@/types';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const VALID_STATUSES: DocumentStatus[] = ['pending', 'approved'];

/**
 * Updates document workflow status.
 */
export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const status = body.status as DocumentStatus | undefined;

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: 'status must be one of: pending, approved' },
      { status: 400 },
    );
  }

  const updated = updateDocumentStatus(id, status);

  if (!updated) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  return NextResponse.json({ document: updated });
}
