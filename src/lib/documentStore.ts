/**
 * @fileoverview In-memory mutable document store for the mock API layer.
 *
 * PATCH endpoints mutate this store so Maya's keyboard approvals persist across
 * requests within a dev session. Data resets on server restart — acceptable for
 * hackathon demo; production would write to a database.
 */

import { MOCK_DOCUMENTS, MOCK_REDACTIONS } from '@/lib/mockData';
import type { Document, DocumentStatus, Redaction } from '@/types';

/** Live copy of the queue; seeded from Phase 1 mock data on cold start. */
let documents: Document[] = MOCK_DOCUMENTS.map((doc) => ({ ...doc }));

/**
 * Returns the full document queue in stable list order (Maya's sort key).
 */
export function getAllDocuments(): Document[] {
  return documents;
}

/**
 * Looks up a single document by primary key.
 */
export function getDocumentById(id: string): Document | undefined {
  return documents.find((doc) => doc.id === id);
}

/**
 * Returns redactions for a document. Redactions are static in Phase 2 — only
 * document-level status changes via PATCH.
 */
export function getRedactionsForDocument(docId: string): Redaction[] {
  return MOCK_REDACTIONS.filter((r) => r.docId === docId);
}

/**
 * Updates a document's workflow status after Maya approves or flags via keyboard.
 *
 * @returns Updated document, or `null` if id not found.
 */
export function updateDocumentStatus(id: string, status: DocumentStatus): Document | null {
  const index = documents.findIndex((doc) => doc.id === id);
  if (index === -1) return null;

  documents[index] = { ...documents[index], status };
  return documents[index];
}

/**
 * Counts documents no longer awaiting triage — powers the queue progress bar.
 */
export function getProcessedCount(): number {
  return documents.filter((doc) => doc.status === 'approved' || doc.status === 'flagged').length;
}
