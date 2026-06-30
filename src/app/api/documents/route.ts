/**
 * @fileoverview GET /api/documents — returns Maya's full bulk review queue.
 */

import { getAllDocuments } from '@/lib/documentStore';
import { NextResponse } from 'next/server';

/**
 * Lists all documents in the queue.
 */
export async function GET(): Promise<NextResponse> {
  const documents = getAllDocuments();

  return NextResponse.json({ documents });
}
