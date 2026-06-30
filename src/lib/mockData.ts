/**
 * @fileoverview Mock backend for Conseal Phase 1 — Maya's bulk document queue.
 *
 * Hardcoded JSON-shaped data replaces a real PII engine so we can invest entirely
 * in volume UX: confidence variance simulates messy AI output Maya must triage fast.
 */

import type { Document, PiiType, Redaction, RedactionStatus } from '../types';

/** Internal seed for building a redaction row before aggregation onto its parent doc. */
interface RedactionSeed {
  text: string;
  type: PiiType;
  confidence: number;
  status: RedactionStatus;
}

/** Document template before derived fields (counts, averages) are computed. */
interface DocumentSeed {
  id: string;
  title: string;
  characterCount: number;
  status: Document['status'];
  redactions: RedactionSeed[];
}

/**
 * Rounds a mean confidence to two decimals for stable display in dense data tables.
 */
function roundConfidence(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Derives aggregate {@link Document} fields from raw redaction seeds.
 * Keeps mock authoring DRY — authors edit spans; totals stay consistent.
 */
function buildDocument(seed: DocumentSeed): { document: Document; redactions: Redaction[] } {
  const redactions: Redaction[] = seed.redactions.map((r, index) => ({
    id: `red-${seed.id}-${String(index + 1).padStart(2, '0')}`,
    docId: seed.id,
    text: r.text,
    type: r.type,
    confidence: r.confidence,
    status: r.status,
  }));

  const confidenceScore =
    redactions.length === 0
      ? 0
      : roundConfidence(redactions.reduce((sum, r) => sum + r.confidence, 0) / redactions.length);

  const document: Document = {
    id: seed.id,
    title: seed.title,
    characterCount: seed.characterCount,
    totalRedactions: redactions.length,
    confidenceScore,
    status: seed.status,
  };

  return { document, redactions };
}

/**
 * Authoritative document + redaction seeds representing Maya's end-of-day backlog.
 *
 * Confidence spread is intentional: paralegals see both slam-dunk spans (0.95+) and
 * ambiguous tokens (0.52–0.70) that must not be bulk-approved without scrutiny.
 */
const DOCUMENT_SEEDS: DocumentSeed[] = [
  {
    id: 'doc-001',
    title: 'Q3_Earnings_Draft_v2.pdf',
    characterCount: 28450,
    status: 'pending',
    redactions: [
      { text: 'Robert Chen', type: 'PERSON_NAME', confidence: 0.97, status: 'approved' },
      { text: 'rchen@meridian-capital.com', type: 'EMAIL', confidence: 0.99, status: 'approved' },
      { text: '212-555-0147', type: 'PHONE', confidence: 0.94, status: 'approved' },
      { text: 'Acct # 8847291034', type: 'ACCOUNT_NUMBER', confidence: 0.88, status: 'approved' },
      { text: 'Meridian Capital LLC', type: 'EMPLOYER_ID', confidence: 0.61, status: 'rejected' },
    ],
  },
  {
    id: 'doc-002',
    title: 'Deposition_Transcript_04.txt',
    characterCount: 67200,
    status: 'pending',
    redactions: [
      { text: 'Maria Santos', type: 'PERSON_NAME', confidence: 0.96, status: 'approved' },
      { text: 'DOB: 03/14/1978', type: 'DATE_OF_BIRTH', confidence: 0.91, status: 'approved' },
      { text: '742 Evergreen Terrace, Springfield', type: 'ADDRESS', confidence: 0.85, status: 'approved' },
      { text: 'SSN 523-44-8912', type: 'SSN', confidence: 0.98, status: 'approved' },
      { text: 'Dr. Alan Whitmore', type: 'PERSON_NAME', confidence: 0.72, status: 'approved' },
      { text: 'MRN-00928471', type: 'MEDICAL_RECORD', confidence: 0.89, status: 'approved' },
      { text: 'the defendant', type: 'PERSON_NAME', confidence: 0.48, status: 'rejected' },
    ],
  },
  {
    id: 'doc-003',
    title: 'Merger_Agreement_Redline.docx',
    characterCount: 145800,
    status: 'flagged',
    redactions: [
      { text: 'James Whitfield III', type: 'PERSON_NAME', confidence: 0.95, status: 'approved' },
      { text: 'j.whitfield@acquireco.io', type: 'EMAIL', confidence: 0.99, status: 'approved' },
      { text: 'Delaware Corp ID 4829103', type: 'EMPLOYER_ID', confidence: 0.67, status: 'rejected' },
      { text: '192.168.0.44', type: 'IP_ADDRESS', confidence: 0.58, status: 'rejected' },
      { text: 'One Liberty Plaza, New York, NY 10006', type: 'ADDRESS', confidence: 0.92, status: 'approved' },
    ],
  },
  {
    id: 'doc-004',
    title: 'Employee_Termination_Letter_HR.pdf',
    characterCount: 4200,
    status: 'pending',
    redactions: [
      { text: 'Patricia Nguyen', type: 'PERSON_NAME', confidence: 0.98, status: 'approved' },
      { text: 'patricia.nguyen@corp.internal', type: 'EMAIL', confidence: 0.99, status: 'approved' },
      { text: 'EMP-10482', type: 'EMPLOYER_ID', confidence: 0.76, status: 'approved' },
      { text: '415-555-0198', type: 'PHONE', confidence: 0.93, status: 'approved' },
    ],
  },
  {
    id: 'doc-005',
    title: 'Litigation_Hold_Notice_2024.pdf',
    characterCount: 8900,
    status: 'approved',
    redactions: [
      { text: 'General Counsel Office', type: 'PERSON_NAME', confidence: 0.55, status: 'rejected' },
      { text: 'legal-hold@hartwell-industries.com', type: 'EMAIL', confidence: 0.97, status: 'approved' },
      { text: 'Case No. CV-2024-11829', type: 'ACCOUNT_NUMBER', confidence: 0.64, status: 'rejected' },
      { text: 'David Hartwell', type: 'PERSON_NAME', confidence: 0.96, status: 'approved' },
    ],
  },
  {
    id: 'doc-006',
    title: 'Witness_Statement_Kowalski.pdf',
    characterCount: 12300,
    status: 'pending',
    redactions: [
      { text: 'Thomas Kowalski', type: 'PERSON_NAME', confidence: 0.97, status: 'approved' },
      { text: 'DL# K4829103 (WI)', type: 'DRIVERS_LICENSE', confidence: 0.94, status: 'approved' },
      { text: '608-555-0133', type: 'PHONE', confidence: 0.91, status: 'approved' },
      { text: '4821 Oak Ridge Dr, Madison WI 53711', type: 'ADDRESS', confidence: 0.87, status: 'approved' },
      { text: 'Tom K.', type: 'PERSON_NAME', confidence: 0.69, status: 'approved' },
      { text: 'March 2022', type: 'DATE_OF_BIRTH', confidence: 0.41, status: 'rejected' },
    ],
  },
  {
    id: 'doc-007',
    title: 'Board_Minutes_Confidential.docx',
    characterCount: 35600,
    status: 'pending',
    redactions: [
      { text: 'Eleanor Vance', type: 'PERSON_NAME', confidence: 0.95, status: 'approved' },
      { text: 'evance@board.nexatech.com', type: 'EMAIL', confidence: 0.98, status: 'approved' },
      { text: 'NexaTech Holdings', type: 'EMPLOYER_ID', confidence: 0.71, status: 'rejected' },
    ],
  },
  {
    id: 'doc-008',
    title: 'Insurance_Claim_Form_8842.pdf',
    characterCount: 15800,
    status: 'flagged',
    redactions: [
      { text: 'Susan Delgado', type: 'PERSON_NAME', confidence: 0.96, status: 'approved' },
      { text: '4532-8890-1123-5567', type: 'CREDIT_CARD', confidence: 0.99, status: 'approved' },
      { text: 'Policy # HLT-9928471', type: 'ACCOUNT_NUMBER', confidence: 0.82, status: 'approved' },
      { text: 'DOB 11/02/1965', type: 'DATE_OF_BIRTH', confidence: 0.9, status: 'approved' },
      { text: 'Claimant', type: 'PERSON_NAME', confidence: 0.44, status: 'rejected' },
      { text: '303-555-0176', type: 'PHONE', confidence: 0.88, status: 'approved' },
      { text: 'ICD-10 M54.5', type: 'MEDICAL_RECORD', confidence: 0.53, status: 'rejected' },
      { text: '99214', type: 'MEDICAL_RECORD', confidence: 0.38, status: 'rejected' },
    ],
  },
  {
    id: 'doc-009',
    title: 'Patent_Disclosure_Inventor_Submission.pdf',
    characterCount: 42100,
    status: 'pending',
    redactions: [
      { text: 'Dr. Yuki Tanaka', type: 'PERSON_NAME', confidence: 0.97, status: 'approved' },
      { text: 'y.tanaka@innovatelabs.org', type: 'EMAIL', confidence: 0.99, status: 'approved' },
      { text: 'Innovate Labs Inc.', type: 'EMPLOYER_ID', confidence: 0.68, status: 'rejected' },
      { text: '650-555-0124', type: 'PHONE', confidence: 0.92, status: 'approved' },
    ],
  },
  {
    id: 'doc-010',
    title: 'Settlement_Agreement_DRAFT_v5.docx',
    characterCount: 52300,
    status: 'pending',
    redactions: [
      { text: 'Harrison & Blake LLP', type: 'EMPLOYER_ID', confidence: 0.59, status: 'rejected' },
      { text: 'Michael Harrison', type: 'PERSON_NAME', confidence: 0.96, status: 'approved' },
      { text: 'mharrison@harrisonblake.com', type: 'EMAIL', confidence: 0.99, status: 'approved' },
      { text: '$2,450,000.00', type: 'ACCOUNT_NUMBER', confidence: 0.51, status: 'rejected' },
      { text: 'SSN ending 4471', type: 'SSN', confidence: 0.79, status: 'approved' },
      { text: '8800 Venice Blvd, Los Angeles CA 90034', type: 'ADDRESS', confidence: 0.9, status: 'approved' },
      { text: '213-555-0188', type: 'PHONE', confidence: 0.94, status: 'approved' },
    ],
  },
  {
    id: 'doc-011',
    title: 'Subpoena_Response_Exhibit_B.pdf',
    characterCount: 98700,
    status: 'pending',
    redactions: [
      { text: 'Angela Brooks', type: 'PERSON_NAME', confidence: 0.95, status: 'approved' },
      { text: 'abrooks@state.gov', type: 'EMAIL', confidence: 0.98, status: 'approved' },
      { text: '202-555-0163', type: 'PHONE', confidence: 0.93, status: 'approved' },
      { text: 'Badge # 4829', type: 'EMPLOYER_ID', confidence: 0.74, status: 'approved' },
      { text: 'FOIA Request 2024-1182', type: 'ACCOUNT_NUMBER', confidence: 0.45, status: 'rejected' },
    ],
  },
  {
    id: 'doc-012',
    title: 'Corporate_Travel_Expense_Report_Q2.xlsx',
    characterCount: 11200,
    status: 'pending',
    redactions: [
      { text: 'Kevin O\'Malley', type: 'PERSON_NAME', confidence: 0.97, status: 'approved' },
      { text: 'komalley@globalventures.co', type: 'EMAIL', confidence: 0.99, status: 'approved' },
      { text: '4532-8890-4421-9901', type: 'CREDIT_CARD', confidence: 0.98, status: 'approved' },
      { text: 'EMP-7721', type: 'EMPLOYER_ID', confidence: 0.81, status: 'approved' },
      { text: 'Boston Logan Intl', type: 'ADDRESS', confidence: 0.42, status: 'rejected' },
    ],
  },
  {
    id: 'doc-013',
    title: 'Expert_Witness_Report_Dr_Patel.pdf',
    characterCount: 78900,
    status: 'flagged',
    redactions: [
      { text: 'Dr. Anika Patel', type: 'PERSON_NAME', confidence: 0.98, status: 'approved' },
      { text: 'apatel@forensicmed.com', type: 'EMAIL', confidence: 0.99, status: 'approved' },
      { text: 'License MD-482910', type: 'MEDICAL_RECORD', confidence: 0.86, status: 'approved' },
      { text: 'Patient X', type: 'PERSON_NAME', confidence: 0.57, status: 'rejected' },
      { text: '10.0.0.52', type: 'IP_ADDRESS', confidence: 0.62, status: 'rejected' },
      { text: '312-555-0144', type: 'PHONE', confidence: 0.91, status: 'approved' },
      { text: 'Northwestern Memorial Hospital', type: 'ADDRESS', confidence: 0.66, status: 'rejected' },
    ],
  },
  {
    id: 'doc-014',
    title: 'NDA_Counterparty_Redline_v3.docx',
    characterCount: 22400,
    status: 'pending',
    redactions: [
      { text: 'Victor Ashford', type: 'PERSON_NAME', confidence: 0.96, status: 'approved' },
      { text: 'vashford@sterlingpartners.com', type: 'EMAIL', confidence: 0.99, status: 'approved' },
      { text: 'Sterling Partners GP', type: 'EMPLOYER_ID', confidence: 0.7, status: 'rejected' },
      { text: '917-555-0191', type: 'PHONE', confidence: 0.94, status: 'approved' },
    ],
  },
  {
    id: 'doc-015',
    title: 'Internal_Audit_Findings_2024.pdf',
    characterCount: 44500,
    status: 'pending',
    redactions: [
      { text: 'Linda Okonkwo', type: 'PERSON_NAME', confidence: 0.95, status: 'approved' },
      { text: 'lokonkwo@audit.internal', type: 'EMAIL', confidence: 0.98, status: 'approved' },
      { text: 'Acct 4492018837', type: 'ACCOUNT_NUMBER', confidence: 0.91, status: 'approved' },
      { text: 'SSN 601-22-4491', type: 'SSN', confidence: 0.99, status: 'approved' },
      { text: 'VP of Finance', type: 'PERSON_NAME', confidence: 0.39, status: 'rejected' },
      { text: '404-555-0129', type: 'PHONE', confidence: 0.89, status: 'approved' },
    ],
  },
  {
    id: 'doc-016',
    title: 'Client_Intake_Form_Morrison.pdf',
    characterCount: 6800,
    status: 'pending',
    redactions: [
      { text: 'Claire Morrison', type: 'PERSON_NAME', confidence: 0.98, status: 'approved' },
      { text: 'DOB: 07/22/1990', type: 'DATE_OF_BIRTH', confidence: 0.94, status: 'approved' },
      { text: 'cmorrison@gmail.com', type: 'EMAIL', confidence: 0.99, status: 'approved' },
      { text: '503-555-0167', type: 'PHONE', confidence: 0.92, status: 'approved' },
      { text: '1842 Pine St, Portland OR 97205', type: 'ADDRESS', confidence: 0.88, status: 'approved' },
      { text: 'DL OR-8829104', type: 'DRIVERS_LICENSE', confidence: 0.93, status: 'approved' },
      { text: 'Spouse: Jordan M.', type: 'PERSON_NAME', confidence: 0.73, status: 'approved' },
    ],
  },
  {
    id: 'doc-017',
    title: 'Regulatory_Filing_SEC_8K_Draft.pdf',
    characterCount: 31200,
    status: 'approved',
    redactions: [
      { text: 'CFO Sarah Lin', type: 'PERSON_NAME', confidence: 0.94, status: 'approved' },
      { text: 'slin@publicco.com', type: 'EMAIL', confidence: 0.98, status: 'approved' },
      { text: 'CIK 0001829103', type: 'EMPLOYER_ID', confidence: 0.77, status: 'approved' },
      { text: '212-555-0112', type: 'PHONE', confidence: 0.9, status: 'approved' },
    ],
  },
  {
    id: 'doc-018',
    title: 'Discovery_Production_Log_Batch_12.csv',
    characterCount: 5400,
    status: 'pending',
    redactions: [
      { text: 'file:///C:/Users/jdoe/Documents', type: 'ADDRESS', confidence: 0.52, status: 'rejected' },
      { text: 'John Doe', type: 'PERSON_NAME', confidence: 0.91, status: 'approved' },
      { text: 'jdoe@contractor.net', type: 'EMAIL', confidence: 0.97, status: 'approved' },
      { text: '10.20.30.41', type: 'IP_ADDRESS', confidence: 0.95, status: 'approved' },
      { text: 'BATES-00048291', type: 'ACCOUNT_NUMBER', confidence: 0.63, status: 'rejected' },
    ],
  },
  {
    id: 'doc-019',
    title: 'Arbitration_Demand_Letter.pdf',
    characterCount: 18700,
    status: 'pending',
    redactions: [
      { text: 'Rachel Stein', type: 'PERSON_NAME', confidence: 0.97, status: 'approved' },
      { text: 'rstein@claimant-law.com', type: 'EMAIL', confidence: 0.99, status: 'approved' },
      { text: '646-555-0183', type: 'PHONE', confidence: 0.93, status: 'approved' },
      { text: 'Claim # ARB-2024-8821', type: 'ACCOUNT_NUMBER', confidence: 0.84, status: 'approved' },
      { text: 'Respondent Corp', type: 'EMPLOYER_ID', confidence: 0.5, status: 'rejected' },
      { text: '350 5th Ave, New York NY 10118', type: 'ADDRESS', confidence: 0.89, status: 'approved' },
      { text: 'Damages exceeding $500,000', type: 'ACCOUNT_NUMBER', confidence: 0.46, status: 'rejected' },
      { text: 'SSN ***-**-8821', type: 'SSN', confidence: 0.81, status: 'approved' },
    ],
  },
  {
    id: 'doc-020',
    title: 'Privileged_Communication_Attorney_Client.pdf',
    characterCount: 9600,
    status: 'pending',
    redactions: [
      { text: 'William Torres', type: 'PERSON_NAME', confidence: 0.96, status: 'approved' },
      { text: 'wtorres@torreslaw.com', type: 'EMAIL', confidence: 0.99, status: 'approved' },
      { text: 'Client: Apex Manufacturing', type: 'EMPLOYER_ID', confidence: 0.58, status: 'rejected' },
      { text: '312-555-0199', type: 'PHONE', confidence: 0.92, status: 'approved' },
      { text: 'Matter # 2024-1847', type: 'ACCOUNT_NUMBER', confidence: 0.71, status: 'approved' },
    ],
  },
];

const built = DOCUMENT_SEEDS.map(buildDocument);

/**
 * Maya's full bulk queue — 20 documents with precomputed aggregates for list rendering.
 */
export const MOCK_DOCUMENTS: Document[] = built.map((b) => b.document);

/**
 * Flattened redaction index across all queue documents.
 * Lookup by `docId` powers per-document review panes without nested fetches.
 */
export const MOCK_REDACTIONS: Redaction[] = built.flatMap((b) => b.redactions);

/**
 * Returns redactions for a single document — mirrors a future `GET /documents/:id/redactions`.
 */
export function getRedactionsByDocId(docId: string): Redaction[] {
  return MOCK_REDACTIONS.filter((r) => r.docId === docId);
}

/**
 * Returns a document by id — mirrors a future `GET /documents/:id`.
 */
export function getDocumentById(docId: string): Document | undefined {
  return MOCK_DOCUMENTS.find((d) => d.id === docId);
}

/**
 * Queue summary stats for Maya's dashboard header (pending count, avg confidence, etc.).
 */
export function getQueueStats(): {
  total: number;
  pending: number;
  approved: number;
  flagged: number;
  averageConfidence: number;
} {
  const pending = MOCK_DOCUMENTS.filter((d) => d.status === 'pending').length;
  const approved = MOCK_DOCUMENTS.filter((d) => d.status === 'approved').length;
  const flagged = MOCK_DOCUMENTS.filter((d) => d.status === 'flagged').length;
  const averageConfidence = roundConfidence(
    MOCK_DOCUMENTS.reduce((sum, d) => sum + d.confidenceScore, 0) / MOCK_DOCUMENTS.length,
  );

  return {
    total: MOCK_DOCUMENTS.length,
    pending,
    approved,
    flagged,
    averageConfidence,
  };
}
