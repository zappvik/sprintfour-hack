'use client';

/**
 * @fileoverview Conseal bulk review dashboard — Maya's keyboard-first triage workspace.
 *
 * Phase 3: roving Tab focus across PII spans, reliable auto-advance to the next
 * pending document, and a queue-cleared celebration only when the backlog is zero.
 */

import { buildMockDocumentBody, segmentContentForHighlights } from '@/lib/mockDocumentContent';
import { formatConfidence, PII_TYPE_LABELS } from '@/lib/piiLabels';
import type { Document, DocumentStatus, Redaction } from '@/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
 * Counts documents still awaiting triage — the only progress number Maya needs.
 */
function countPending(documents: Document[]): number {
  return documents.filter((doc) => doc.status === 'pending').length;
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
 * Center-panel PII span — keyboard-focusable with forced tooltip when focused.
 * Hover remains a fallback; Tab is the primary explainability path for Maya.
 */
function RedactionHighlight({
  redaction,
  isFocused,
  onFocus,
  spanRef,
}: {
  redaction: Redaction;
  isFocused: boolean;
  onFocus: () => void;
  spanRef: (el: HTMLSpanElement | null) => void;
}) {
  const isApproved = redaction.status === 'approved';
  const baseHighlight = isApproved
    ? 'bg-amber-500/25 text-amber-100 ring-1 ring-amber-500/50'
    : 'bg-zinc-700/40 text-zinc-300 ring-1 ring-dashed ring-zinc-500/60';

  // Distinct focus ring — must pop against dark slate without relying on mouse hover
  const focusHighlight = isFocused
    ? 'bg-sky-500/30 text-sky-50 ring-2 ring-sky-400 ring-offset-2 ring-offset-zinc-950'
    : baseHighlight;

  const showTooltip = isFocused;

  return (
    <span
      ref={spanRef}
      tabIndex={isFocused ? 0 : -1}
      onFocus={onFocus}
      className={`relative rounded px-0.5 outline-none ${focusHighlight}`}
      aria-label={`${PII_TYPE_LABELS[redaction.type]}, ${formatConfidence(redaction.confidence)} confidence`}
    >
      {redaction.text}
      {showTooltip && (
        <span
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-xs -translate-x-1/2 rounded-md border border-sky-500/40 bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-zinc-100 shadow-xl"
        >
          <span className="text-emerald-400">{formatConfidence(redaction.confidence)} Confidence</span>
          <span className="text-zinc-500"> · </span>
          {PII_TYPE_LABELS[redaction.type]}
        </span>
      )}
    </span>
  );
}

/**
 * Shown only when every document is approved or flagged — Maya's finish line.
 */
function QueueClearedState({ total }: { total: number }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border-4 border-emerald-500/30 bg-emerald-500/10">
        <span className="text-5xl" aria-hidden>
          ✓
        </span>
      </div>
      <h2 className="text-5xl font-extrabold tracking-tight text-emerald-400">Queue Cleared!</h2>
      <p className="mt-4 max-w-md text-lg text-zinc-400">
        All {total} documents reviewed. Safe to share with AI tools.
      </p>
    </div>
  );
}

/**
 * Main review surface — Tab roves across PII spans; article scrolls focused spans into view.
 */
function DocumentViewer({
  title,
  content,
  redactions,
  status,
  isLoading,
  focusedRedactionId,
  onFocusedRedactionChange,
  scrollContainerRef,
  spanRefs,
}: {
  title: string;
  content: string;
  redactions: Redaction[];
  status: DocumentStatus | null;
  isLoading: boolean;
  focusedRedactionId: string | null;
  onFocusedRedactionChange: (id: string) => void;
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  spanRefs: React.MutableRefObject<Map<string, HTMLSpanElement>>;
}) {
  const segments = segmentContentForHighlights(content, redactions);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
        Loading document…
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
            {redactions.length} detected spans · Tab to inspect AI confidence
          </p>
        </div>
        <span className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${statusBadgeClass}`}>
          {statusLabel}
        </span>
      </header>

      <article ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-5">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-300">
          {segments.map((segment, index) =>
            segment.kind === 'text' ? (
              <span key={`text-${index}`}>{segment.value}</span>
            ) : (
              <RedactionHighlight
                key={`redaction-${segment.redaction.id}`}
                redaction={segment.redaction}
                isFocused={focusedRedactionId === segment.redaction.id}
                onFocus={() => onFocusedRedactionChange(segment.redaction.id)}
                spanRef={(el) => {
                  if (el) spanRefs.current.set(segment.redaction.id, el);
                  else spanRefs.current.delete(segment.redaction.id);
                }}
              />
            ),
          )}
        </pre>
      </article>

      <footer className="border-t border-zinc-800 px-6 py-2 text-xs text-zinc-500">
        <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-300">Tab</kbd>
        <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-300">Shift+Tab</kbd>{' '}
        Span ·{' '}
        <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-300">Space</kbd>{' '}
        Approve ·{' '}
        <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-300">F</kbd>{' '}
        Flag ·{' '}
        <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-300">↑</kbd>
        <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-300">↓</kbd>{' '}
        Queue
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
 * Finds the next pending document in queue order, wrapping to the top when needed.
 * Called immediately after approve/flag so Maya never lands on an empty viewer mid-queue.
 */
function findNextPendingId(currentId: string, queue: Document[]): string | null {
  const pending = queue.filter((doc) => doc.status === 'pending');
  if (pending.length === 0) return null;

  const currentIndex = queue.findIndex((doc) => doc.id === currentId);

  for (let i = currentIndex + 1; i < queue.length; i++) {
    if (queue[i].status === 'pending') return queue[i].id;
  }

  for (let i = 0; i < currentIndex; i++) {
    if (queue[i].status === 'pending') return queue[i].id;
  }

  return null;
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
  const [focusedRedactionId, setFocusedRedactionId] = useState<string | null>(null);
  const viewerRef = useRef<HTMLElement>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);
  const spanRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendingCount = useMemo(() => countPending(documents), [documents]);
  const isQueueCleared = !isQueueLoading && documents.length > 0 && pendingCount === 0;

  /** Ordered PII span ids in document reading order — drives Tab roving. */
  const orderedRedactionIds = useMemo(() => {
    if (!detail) return [];
    const segments = segmentContentForHighlights(detail.content, detail.redactions);
    return segments
      .filter((segment) => segment.kind === 'redaction')
      .map((segment) => segment.redaction.id);
  }, [detail]);

  const showToast = useCallback((message: string, tone: ToastState['tone']) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, tone });
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const fetchQueue = useCallback(async (): Promise<Document[]> => {
    const response = await fetch('/api/documents');
    if (!response.ok) throw new Error('Failed to load document queue');
    const data: DocumentsResponse = await response.json();
    setDocuments(data.documents);
    setProcessedCount(data.meta.processed);
    setTotalCount(data.meta.total);
    return data.documents;
  }, []);

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

  /** Scrolls a focused span into the visible article area — no mouse wheel hunting. */
  const focusRedactionSpan = useCallback(
    (redactionId: string) => {
      setFocusedRedactionId(redactionId);

      requestAnimationFrame(() => {
        const el = spanRefs.current.get(redactionId);
        if (!el) return;
        el.focus({ preventScroll: true });
        el.scrollIntoView({ block: 'center', behavior: 'instant' });
      });
    },
    [],
  );

  /** Steps Tab / Shift+Tab across PII spans within the active document. */
  const navigateRedactionSpan = useCallback(
    (direction: 'next' | 'prev') => {
      if (orderedRedactionIds.length === 0) return;

      const currentIndex = focusedRedactionId
        ? orderedRedactionIds.indexOf(focusedRedactionId)
        : -1;

      let nextIndex: number;
      if (direction === 'next') {
        nextIndex = currentIndex < orderedRedactionIds.length - 1 ? currentIndex + 1 : 0;
      } else {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : orderedRedactionIds.length - 1;
      }

      focusRedactionSpan(orderedRedactionIds[nextIndex]);
    },
    [orderedRedactionIds, focusedRedactionId, focusRedactionSpan],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const queue = await fetchQueue();
        if (cancelled) return;
        const firstPending = queue.find((doc) => doc.status === 'pending');
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

  /**
   * Safety net: if pending docs exist but selection is null (edge race after PATCH),
   * immediately load the first pending — never show an empty viewer mid-queue.
   */
  useEffect(() => {
    if (isQueueLoading || pendingCount === 0) return;
    if (selectedId === null) {
      const firstPending = documents.find((doc) => doc.status === 'pending');
      if (firstPending) setSelectedId(firstPending.id);
    }
  }, [documents, selectedId, pendingCount, isQueueLoading]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setFocusedRedactionId(null);
      spanRefs.current.clear();
      return;
    }
    setFocusedRedactionId(null);
    spanRefs.current.clear();
    fetchDocumentDetail(selectedId);
  }, [selectedId, fetchDocumentDetail]);

  useEffect(() => {
    if (!isQueueCleared) {
      viewerRef.current?.focus();
    }
  }, [selectedId, detail, isQueueCleared]);

  const updateStatus = useCallback(
    async (status: DocumentStatus, toastMessage: string, tone: ToastState['tone']) => {
      if (!selectedId || isQueueCleared) return;

      const currentId = selectedId;

      const response = await fetch(`/api/documents/${currentId}/status`, {
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

      const nextId = findNextPendingId(currentId, queue);
      if (nextId) {
        setSelectedId(nextId);
      } else if (countPending(queue) === 0) {
        setSelectedId(null);
        setDetail(null);
      } else {
        const fallback = queue.find((doc) => doc.status === 'pending');
        setSelectedId(fallback?.id ?? null);
      }
    },
    [selectedId, isQueueCleared, fetchQueue, showToast],
  );

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (event.key === 'Tab' && !isQueueCleared && orderedRedactionIds.length > 0) {
        event.preventDefault();
        navigateRedactionSpan(event.shiftKey ? 'prev' : 'next');
        return;
      }

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
  }, [updateStatus, navigateQueue, navigateRedactionSpan, orderedRedactionIds, isQueueCleared]);

  const selectedDoc = documents.find((doc) => doc.id === selectedId) ?? null;

  const viewerContent =
    detail?.content ??
    (selectedDoc ? buildMockDocumentBody(selectedDoc.title, detail?.redactions ?? []) : '');

  const showDocumentViewer = !isQueueCleared && selectedId && selectedDoc;

  return (
    <div className="flex h-screen bg-zinc-950">
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

      <main
        ref={viewerRef}
        tabIndex={isQueueCleared ? -1 : 0}
        className="flex flex-1 flex-col outline-none focus:ring-1 focus:ring-inset focus:ring-zinc-700"
        aria-label="Document review viewer"
      >
        {isQueueCleared ? (
          <QueueClearedState total={totalCount} />
        ) : showDocumentViewer ? (
          <DocumentViewer
            title={selectedDoc.title}
            content={viewerContent}
            redactions={detail?.redactions ?? []}
            status={selectedDoc.status}
            isLoading={isDetailLoading}
            focusedRedactionId={focusedRedactionId}
            onFocusedRedactionChange={setFocusedRedactionId}
            scrollContainerRef={scrollContainerRef}
            spanRefs={spanRefs}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
            Loading next document…
          </div>
        )}
      </main>

      <Toast toast={toast} />
    </div>
  );
}
