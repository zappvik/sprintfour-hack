/**
 * @fileoverview In-memory mutable document store for the mock API layer.
 *
 * PATCH endpoints mutate documents and individual redaction spans so Maya's
 * triage decisions persist across requests within a dev session.
 */

import { MOCK_DOCUMENTS, MOCK_REDACTIONS } from '@/lib/mockData';
import type { Document, DocumentStatus, Redaction, RedactionStatus } from '@/types';

/** Live copy of the queue; seeded from Phase 1 mock data on cold start. */
let documents: Document[] = MOCK_DOCUMENTS.map((doc) => ({ ...doc }));

/** Mutable redaction index — checkbox toggles in the right panel write here. */
let redactions: Redaction[] = MOCK_REDACTIONS.map((r) => ({ ...r }));

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
 * Returns live redactions for a document, including any triage edits.
 */
export function getRedactionsForDocument(docId: string): Redaction[] {
  return redactions.filter((r) => r.docId === docId);
}

/**
 * Updates a document's workflow status after Maya finishes reviewing a file.
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
 * Toggles a single PII span between redact (approved) and keep visible (rejected).
 *
 * @returns Updated redaction, or `null` if not found.
 */
export function updateRedactionStatus(
  redactionId: string,
  status: RedactionStatus,
): Redaction | null {
  const index = redactions.findIndex((r) => r.id === redactionId);
  if (index === -1) return null;

  redactions[index] = { ...redactions[index], status };
  return redactions[index];
}

/**
 * Counts documents no longer awaiting triage — powers the queue progress bar.
 */
export function getProcessedCount(): number {
  return documents.filter((doc) => doc.status === 'approved' || doc.status === 'flagged').length;
}
