'use client';

/**
 * @fileoverview Conseal bulk review dashboard — Maya's keyboard-first triage workspace.
 *
 * Layout: dense queue (left) + document viewer (center). All data flows through
 * Next.js API routes so the hackathon demo satisfies full-stack requirements.
 */

import { buildMockDocumentBody, segmentContentForHighlights } from '@/lib/mockDocumentContent';
import { formatConfidence, PII_TYPE_LABELS } from '@/lib/piiLabels';
import type { Document, DocumentStatus, Redaction } from '@/types';
import { useCallback, useEffect, useRef, useState } from 'react';

/** API envelope for GET /api/documents */
interface DocumentsResponse {
  documents: Document[];
  meta: { total: number; processed: number };
}

/** API envelope for GET /api/documents/[id] */
interface DocumentDetailResponse {
  document: Document;
  redactions: Redaction[];
  content: string;
}

/** Ephemeral toast payload — auto-dismissed so Maya never clicks "OK". */
interface ToastState {
  message: string;
  tone: 'success' | 'warning';
}

/**
 * Maps document status to a left-border accent color for sub-second visual parsing.
 */
function statusAccentClass(status: DocumentStatus): string {
  switch (status) {
    case 'approved':
      return 'border-l-emerald-500';
    case 'flagged':
      return 'border-l-amber-500';
    default:
      return 'border-l-zinc-600';
  }
}

/**
 * Compact status dot — supplements border color for color-blind accessibility.
 */
function StatusDot({ status }: { status: DocumentStatus }) {
  const color =
    status === 'approved'
      ? 'bg-emerald-400'
      : status === 'flagged'
        ? 'bg-amber-400'
        : 'bg-zinc-500';

  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} aria-hidden />;
}

/**
 * Queue progress header — Maya tracks backlog clearance without mental math.
 */
function QueueProgress({ processed, total }: { processed: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((processed / total) * 100);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-zinc-400">
        <span>Queue Progress</span>
        <span className="tabular-nums text-zinc-200">
          {processed} / {total} Processed
        </span>
      </div>
      {/* Flat bar — no animation; motion slows power users */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] duration-150"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Left-panel queue row — single line title + confidence for density.
 */
function QueueItem({
  document,
  isSelected,
  onSelect,
}: {
  document: Document;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-start gap-2 border-l-2 px-3 py-2 text-left text-sm transition-colors ${statusAccentClass(document.status)} ${
        isSelected ? 'bg-zinc-800/80' : 'bg-transparent hover:bg-zinc-900'
      }`}
    >
      <StatusDot status={document.status} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-100">{document.title}</p>
        <p className="mt-0.5 text-xs text-zinc-500">
          {document.totalRedactions} spans · {formatConfidence(document.confidenceScore)} avg
        </p>
      </div>
    </button>
  );
}

/**
 * Center-panel PII highlight with Marcus explainability tooltip on hover (no click).
 */
function RedactionHighlight({ redaction }: { redaction: Redaction }) {
  const isApproved = redaction.status === 'approved';
  const highlightClass = isApproved
    ? 'bg-amber-500/25 text-amber-100 ring-1 ring-amber-500/50'
    : 'bg-zinc-700/40 text-zinc-300 ring-1 ring-dashed ring-zinc-500/60';

  return (
    <span className={`group/redaction relative cursor-help rounded px-0.5 ${highlightClass}`}>
      {redaction.text}
      {/* Tooltip appears on hover — builds trust without breaking keyboard flow */}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 hidden w-max max-w-xs -translate-x-1/2 rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-100 shadow-xl group-hover/redaction:block"
      >
        <span className="text-emerald-400">{formatConfidence(redaction.confidence)} Confidence</span>
        <span className="text-zinc-500"> · </span>
        {PII_TYPE_LABELS[redaction.type]}
      </span>
    </span>
  );
}

/**
 * Main review surface — receives keyboard focus for Space / F / arrow shortcuts.
 */
function DocumentViewer({
  title,
  content,
  redactions,
  status,
  isLoading,
}: {
  title: string | null;
  content: string;
  redactions: Redaction[];
  status: DocumentStatus | null;
  isLoading: boolean;
}) {
  const segments = segmentContentForHighlights(content, redactions);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
        Loading document…
      </div>
    );
  }

  if (!title) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
        Select a document from the queue to begin review.
      </div>
    );
  }

  const statusLabel =
    status === 'approved' ? 'Approved' : status === 'flagged' ? 'Flagged' : 'Pending review';

  const statusBadgeClass =
    status === 'approved'
      ? 'bg-emerald-500/15 text-emerald-400'
      : status === 'flagged'
        ? 'bg-amber-500/15 text-amber-400'
        : 'bg-zinc-800 text-zinc-400';

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-zinc-800 px-6 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-zinc-100">{title}</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            {redactions.length} detected spans · hover highlights for AI confidence
          </p>
        </div>
        <span className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${statusBadgeClass}`}>
          {statusLabel}
        </span>
      </header>

      {/* Monospace-adjacent prose block — readable at speed without decorative chrome */}
      <article className="flex-1 overflow-y-auto px-6 py-5">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-300">
          {segments.map((segment, index) =>
            segment.kind === 'text' ? (
              <span key={`text-${index}`}>{segment.value}</span>
            ) : (
              <RedactionHighlight key={`redaction-${segment.redaction.id}`} redaction={segment.redaction} />
            ),
          )}
        </pre>
      </article>

      {/* Always-visible shortcut legend — Maya learns once, never hunts menus */}
      <footer className="border-t border-zinc-800 px-6 py-2 text-xs text-zinc-500">
        <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-300">Space</kbd>{' '}
        Approve ·{' '}
        <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-300">F</kbd>{' '}
        Flag ·{' '}
        <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-300">↑</kbd>
        <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-300">↓</kbd>{' '}
        Navigate
      </footer>
    </div>
  );
}

/**
 * Non-blocking toast — confirms PATCH success without modal friction.
 */
function Toast({ toast }: { toast: ToastState | null }) {
  if (!toast) return null;

  const toneClass =
    toast.tone === 'success'
      ? 'border-emerald-500/40 bg-emerald-950 text-emerald-200'
      : 'border-amber-500/40 bg-amber-950 text-amber-200';

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 rounded-lg border px-4 py-2.5 text-sm font-medium shadow-lg ${toneClass}`}
      role="status"
    >
      {toast.message}
    </div>
  );
}

/**
 * Root dashboard — orchestrates API fetches, selection state, and global shortcuts.
 */
export default function ReviewDashboard() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(20);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocumentDetailResponse | null>(null);
  const [isQueueLoading, setIsQueueLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const viewerRef = useRef<HTMLElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Surfaces ephemeral feedback without stealing focus from the viewer. */
  const showToast = useCallback((message: string, tone: ToastState['tone']) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, tone });
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  }, []);

  /** Pulls the latest queue from the API — called on mount and after status PATCH. */
  const fetchQueue = useCallback(async (): Promise<Document[]> => {
    const response = await fetch('/api/documents');
    if (!response.ok) throw new Error('Failed to load document queue');
    const data: DocumentsResponse = await response.json();
    setDocuments(data.documents);
    setProcessedCount(data.meta.processed);
    setTotalCount(data.meta.total);
    return data.documents;
  }, []);

  /** Loads document detail for the center viewer. */
  const fetchDocumentDetail = useCallback(async (id: string) => {
    setIsDetailLoading(true);
    try {
      const response = await fetch(`/api/documents/${id}`);
      if (!response.ok) throw new Error('Failed to load document');
      const data: DocumentDetailResponse = await response.json();
      setDetail(data);
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  /** Initial queue load — selects first pending doc so Maya starts immediately. */
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const queue = await fetchQueue();
        if (cancelled) return;
        const firstPending = queue.find((doc) => doc.status === 'pending') ?? queue[0];
        if (firstPending) setSelectedId(firstPending.id);
      } catch {
        if (!cancelled) showToast('Could not load queue', 'warning');
      } finally {
        if (!cancelled) setIsQueueLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fetchQueue, showToast]);

  /** Refetch detail whenever selection changes. */
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    fetchDocumentDetail(selectedId);
  }, [selectedId, fetchDocumentDetail]);

  /** Keep keyboard focus on the viewer — shortcuts work without clicking first. */
  useEffect(() => {
    viewerRef.current?.focus();
  }, [selectedId, detail]);

  /**
   * Finds the next pending document after the current one for auto-advance
   * after Space (approve) or F (flag).
   */
  const findNextPendingId = useCallback(
    (currentId: string, queue: Document[]): string | null => {
      const currentIndex = queue.findIndex((doc) => doc.id === currentId);
      const afterCurrent = queue.slice(currentIndex + 1);
      const nextPending = afterCurrent.find((doc) => doc.status === 'pending');
      if (nextPending) return nextPending.id;

      const beforeCurrent = queue.slice(0, currentIndex);
      const wrapPending = beforeCurrent.find((doc) => doc.status === 'pending');
      return wrapPending?.id ?? null;
    },
    [],
  );

  /** PATCH status then refresh queue and advance — core Maya speed loop. */
  const updateStatus = useCallback(
    async (status: DocumentStatus, toastMessage: string, tone: ToastState['tone']) => {
      if (!selectedId) return;

      const response = await fetch(`/api/documents/${selectedId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        showToast('Update failed — try again', 'warning');
        return;
      }

      showToast(toastMessage, tone);
      const queue = await fetchQueue();
      const nextId = findNextPendingId(selectedId, queue);
      setSelectedId(nextId);
    },
    [selectedId, fetchQueue, findNextPendingId, showToast],
  );

  /** Arrow-key navigation within the flat queue list. */
  const navigateQueue = useCallback(
    (direction: 'up' | 'down') => {
      if (documents.length === 0 || !selectedId) return;

      const currentIndex = documents.findIndex((doc) => doc.id === selectedId);
      const delta = direction === 'up' ? -1 : 1;
      const nextIndex = Math.min(Math.max(currentIndex + delta, 0), documents.length - 1);
      setSelectedId(documents[nextIndex].id);
    },
    [documents, selectedId],
  );

  /**
   * Global keyboard listener on the viewer — Space/F/arrows never leave the hands
   * on the keyboard during high-volume triage.
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      switch (event.key) {
        case ' ':
          event.preventDefault();
          updateStatus('approved', 'Document approved', 'success');
          break;
        case 'f':
        case 'F':
          event.preventDefault();
          updateStatus('flagged', 'Document flagged for review', 'warning');
          break;
        case 'ArrowUp':
          event.preventDefault();
          navigateQueue('up');
          break;
        case 'ArrowDown':
          event.preventDefault();
          navigateQueue('down');
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [updateStatus, navigateQueue]);

  const selectedDoc = documents.find((doc) => doc.id === selectedId) ?? null;

  // Fallback content if detail fetch lags — built client-side from redactions list
  const viewerContent =
    detail?.content ??
    (selectedDoc
      ? buildMockDocumentBody(
          selectedDoc.title,
          detail?.redactions ?? [],
        )
      : '');

  return (
    <div className="flex h-screen bg-zinc-950">
      {/* Left queue — fixed width keeps viewer stable while list scrolls */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
        <div className="border-b border-zinc-800 px-4 py-3">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight text-zinc-100">Conseal</span>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-400">
              Bulk Review
            </span>
          </div>
          <QueueProgress processed={processedCount} total={totalCount} />
        </div>

        <nav className="flex-1 overflow-y-auto" aria-label="Document queue">
          {isQueueLoading ? (
            <p className="px-4 py-3 text-sm text-zinc-500">Loading queue…</p>
          ) : (
            documents.map((document) => (
              <QueueItem
                key={document.id}
                document={document}
                isSelected={document.id === selectedId}
                onSelect={() => setSelectedId(document.id)}
              />
            ))
          )}
        </nav>
      </aside>

      {/* Center viewer — tabIndex enables focus ring for keyboard-first workflow */}
      <main
        ref={viewerRef}
        tabIndex={0}
        className="flex flex-1 flex-col outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-700"
        aria-label="Document review viewer"
      >
        <DocumentViewer
          title={selectedDoc?.title ?? null}
          content={viewerContent}
          redactions={detail?.redactions ?? []}
          status={selectedDoc?.status ?? null}
          isLoading={isDetailLoading && !!selectedId}
        />
      </main>

      <Toast toast={toast} />
    </div>
  );
}
