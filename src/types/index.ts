/**
 * @fileoverview Core domain types for Conseal — a high-volume PII redaction queue.
 *
 * These types model Maya's (paralegal) bulk workflow: documents enter the queue
 * with AI-detected spans, she triages by confidence, and approves or rejects at speed.
 * Shapes are intentionally flat and serializable so the mock backend can swap for a
 * real API later without UI refactors.
 */

/**
 * Lifecycle state of a document in Maya's review queue.
 *
 * - `pending`  — Awaiting review; default for incoming bulk uploads.
 * - `approved` — All redactions accepted; safe to export/share with AI tools.
 * - `flagged`  — Needs attention (low confidence aggregate or manual flag); stays in queue.
 */
export type DocumentStatus = 'pending' | 'approved' | 'flagged';

/**
 * Triage outcome for an individual PII span after Maya's review.
 *
 * - `approved` — Span will be redacted in the final anonymized output.
 * - `rejected` — False positive; span is kept as-is in the source document.
 */
export type RedactionStatus = 'approved' | 'rejected';

/**
 * Categories of personally identifying information the mock detector surfaces.
 *
 * Mirrors common legal/corporate PII taxonomies so the UI can group, filter,
 * and color-code spans without coupling to a real ML model.
 */
export type PiiType =
  | 'PERSON_NAME'
  | 'EMAIL'
  | 'PHONE'
  | 'SSN'
  | 'ADDRESS'
  | 'DATE_OF_BIRTH'
  | 'ACCOUNT_NUMBER'
  | 'CREDIT_CARD'
  | 'DRIVERS_LICENSE'
  | 'MEDICAL_RECORD'
  | 'IP_ADDRESS'
  | 'EMPLOYER_ID';

/**
 * A single document in Maya's bulk anonymization queue.
 *
 * Aggregates (`totalRedactions`, `confidenceScore`) are denormalized for at-a-glance
 * triage in list views — Maya scans hundreds of rows without opening each file.
 */
export interface Document {
  /** Stable UUID-style identifier; used for routing and bulk selection keys. */
  id: string;

  /** Original filename as uploaded; familiar naming helps Maya spot priority cases. */
  title: string;

  /**
   * Approximate character length of source text.
   * Surfaces doc size in the queue so Maya can batch small files first.
   */
  characterCount: number;

  /**
   * Count of AI-detected PII spans awaiting or completed review.
   * Precomputed to avoid N+1 lookups when rendering the bulk queue table.
   */
  totalRedactions: number;

  /**
   * Mean confidence (0–1) across all redactions in this document.
   * Low averages drive `flagged` status and warm/red confidence chips in the UI.
   */
  confidenceScore: number;

  /** Current position in Maya's review workflow. */
  status: DocumentStatus;
}

/**
 * A detected PII span within a document — the atomic unit of Maya's approve/reject actions.
 *
 * `text` holds the literal substring to redact (mock data only; production would use offsets).
 * `confidence` reflects detector certainty and powers keyboard-driven bulk approval thresholds.
 */
export interface Redaction {
  /** Unique span identifier; stable across re-renders for focus and undo stacks. */
  id: string;

  /** Parent document {@link Document.id}. */
  docId: string;

  /** Literal detected substring shown in the side-by-side review pane. */
  text: string;

  /** PII category for filtering, legend colors, and export rule mapping. */
  type: PiiType;

  /**
   * Model confidence in [0, 1]. Values below ~0.75 typically warrant manual review
   * before Maya hits bulk-approve on high-confidence batches.
   */
  confidence: number;

  /** Maya's triage decision; `approved` and `rejected` only after explicit review. */
  status: RedactionStatus;
}
