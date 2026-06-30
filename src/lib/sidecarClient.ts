/**
 * @fileoverview Frontend client for the local Python FastAPI sidecar.
 *
 * The desktop build talks directly to localhost sidecar instead of Next API
 * routes so exported static assets can still perform full data operations.
 */

import type { Document, Redaction, RedactionStatus } from '@/types';

const SIDECAR_BASE_URL =
  process.env.NEXT_PUBLIC_SIDECAR_URL ?? 'http://127.0.0.1:8000';

interface SidecarListDocumentsResponse {
  documents: Document[];
}

interface SidecarDocumentResponse {
  document_id: string;
  status: Document['status'];
  title: string;
  character_count: number;
  total_redactions: number;
  confidence_score: number;
  content: string;
  redactions: Record<
    string,
    {
      kind: string;
      confidence: number;
      original: string;
      start: number;
      end: number;
      status: RedactionStatus;
    }
  >;
}

interface SeedPayloadDocument {
  id: string;
  title: string;
  character_count: number;
  total_redactions: number;
  confidence_score: number;
  status: Document['status'];
  content: string;
  redactions: Array<{
    id: string;
    kind: string;
    confidence: number;
    original: string;
    start: number;
    end: number;
    status: RedactionStatus;
  }>;
}

function createRedaction(docId: string, token: string, value: SidecarDocumentResponse['redactions'][string]): Redaction {
  return {
    id: token,
    docId,
    text: value.original,
    type: mapKindToPiiType(value.kind),
    confidence: value.confidence,
    status: value.status,
  };
}

/**
 * Maps sidecar detection kinds into existing UI category labels.
 */
function mapKindToPiiType(kind: string): Redaction['type'] {
  switch (kind) {
    case 'ssn':
      return 'SSN';
    case 'email':
      return 'EMAIL';
    case 'api_key':
      return 'ACCOUNT_NUMBER';
    case 'secret_heuristic':
      return 'ACCOUNT_NUMBER';
    default:
      return 'PERSON_NAME';
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Sidecar request failed (${response.status}): ${body}`);
  }
  return response.json() as Promise<T>;
}

export async function sidecarHealthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${SIDECAR_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Seeds sidecar persistence with the current frontend queue model.
 */
export async function seedSidecar(documents: SeedPayloadDocument[]): Promise<void> {
  const response = await fetch(`${SIDECAR_BASE_URL}/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ documents }),
  });
  await parseResponse(response);
}

export async function listDocuments(): Promise<Document[]> {
  const response = await fetch(`${SIDECAR_BASE_URL}/documents`);
  const data = await parseResponse<SidecarListDocumentsResponse>(response);
  return data.documents;
}

export async function getDocumentDetail(docId: string): Promise<{
  document: Document;
  redactions: Redaction[];
  content: string;
}> {
  const response = await fetch(`${SIDECAR_BASE_URL}/documents/${docId}`);
  const data = await parseResponse<SidecarDocumentResponse>(response);

  const redactions = Object.entries(data.redactions).map(([token, value]) =>
    createRedaction(docId, token, value),
  );

  return {
    document: {
      id: docId,
      title: data.title,
      characterCount: data.character_count,
      totalRedactions: data.total_redactions,
      confidenceScore: data.confidence_score,
      status: data.status,
    },
    redactions,
    content: data.content,
  };
}

export async function updateDocumentStatus(
  docId: string,
  status: Document['status'],
): Promise<void> {
  const response = await fetch(`${SIDECAR_BASE_URL}/documents/${docId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  await parseResponse(response);
}

export async function updateRedactionStatus(
  docId: string,
  redactionId: string,
  status: RedactionStatus,
): Promise<RedactionStatus> {
  const response = await fetch(
    `${SIDECAR_BASE_URL}/documents/${docId}/redactions/${redactionId}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    },
  );
  const data = await parseResponse<{ status: RedactionStatus }>(response);
  return data.status;
}

