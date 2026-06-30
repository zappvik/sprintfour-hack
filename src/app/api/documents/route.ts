/**
 * @fileoverview GET /api/documents — returns Maya's full bulk review queue.
 */

import { getAllDocuments, getProcessedCount } from '@/lib/documentStore';
import { NextResponse } from 'next/server';

/**
 * Lists all documents in the queue with aggregate progress metadata.
 */
export async function GET(): Promise<NextResponse> {
  const documents = getAllDocuments();

  return NextResponse.json({
    documents,
    meta: {
      total: documents.length,
      processed: getProcessedCount(),
    },
  });
}
