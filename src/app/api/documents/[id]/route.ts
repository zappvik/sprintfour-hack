/**
 * @fileoverview GET /api/documents/[id] — single document with redactions and viewer text.
 */

import { buildMockDocumentBody } from '@/lib/mockDocumentContent';
import { getDocumentById, getRedactionsForDocument } from '@/lib/documentStore';
import { NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * Fetches one document, its PII spans, and synthetic body text for the center panel.
 */
export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { id } = await context.params;
  const document = getDocumentById(id);

  if (!document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  const redactions = getRedactionsForDocument(id);
  const content = buildMockDocumentBody(document.title, redactions);

  return NextResponse.json({
    document,
    redactions,
    content,
  });
}
