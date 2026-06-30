/**
 * @fileoverview PATCH /api/documents/[id]/redactions/[redactionId] — toggle redact / keep visible.
 */

import { getDocumentById, updateRedactionStatus } from '@/lib/documentStore';
import type { RedactionStatus } from '@/types';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ id: string; redactionId: string }>;
}

const VALID_STATUSES: RedactionStatus[] = ['approved', 'rejected'];

/**
 * Updates one PII span's triage status from the right-panel checkbox / keyboard toggle.
 */
export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { id: docId, redactionId } = await context.params;

  if (!getDocumentById(docId)) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const status = body.status as RedactionStatus | undefined;

  if (!status || !VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: "status must be 'approved' or 'rejected'" },
      { status: 400 },
    );
  }

  const updated = updateRedactionStatus(redactionId, status);

  if (!updated || updated.docId !== docId) {
    return NextResponse.json({ error: 'Redaction not found' }, { status: 404 });
  }

  return NextResponse.json({ redaction: updated });
}
