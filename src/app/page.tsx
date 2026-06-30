'use client';

/**
 * @fileoverview Conseal 3-pane triage dashboard — Queue | Document | Redaction List.
 *
 * Keyboard focus lives in the right panel. Up/Down roves cards; Space/Enter toggles
 * redact vs keep visible; the center panel sync-scrolls to the active span.
 */

import { buildMockDocumentBody, segmentContentForHighlights } from '@/lib/mockDocumentContent';
import { formatConfidence, PII_TYPE_COLORS, PII_TYPE_LABELS } from '@/lib/piiLabels';
import type { Document, DocumentStatus, Redaction, RedactionStatus } from '@/types';
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

/** Ephemeral toast payload */
interface ToastState {
  message: string;
  tone: 'success' | 'warning';
}

function countPending(documents: Document[]): number {
  return documents.filter((doc) => doc.status === 'pending').length;
}

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

function StatusDot({ status }: { status: DocumentStatus }) {
  const color =
    status === 'approved'
      ? 'bg-emerald-400'
      : status === 'flagged'
        ? 'bg-amber-400'
        : 'bg-zinc-500';

  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} aria-hidden />;
}

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
 * Center-panel span — type-colored block when redacted, dashed type-colored underline when overruled.
 */
function RedactionHighlight({
  redaction,
  isActive,
  spanRef,
}: {
  redaction: Redaction;
  isActive: boolean;
  spanRef: (el: HTMLSpanElement | null) => void;
}) {
  const isRedacted = redaction.status === 'approved';
  const colors = PII_TYPE_COLORS[redaction.type];

  const styleClass = isRedacted
    ? `${colors.redactedBg} ${colors.redactedText} select-none`
    : `${colors.visibleText} underline decoration-dashed underline-offset-4 ${colors.visibleUnderline}`;

  const activeRing = isActive ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-950' : '';

  return (
    <span
      ref={spanRef}
      data-redaction-id={redaction.id}
      className={`rounded-sm px-0.5 ${styleClass} ${activeRing}`}
      aria-label={
        isRedacted
          ? `Redacted: ${PII_TYPE_LABELS[redaction.type]}`
          : `Kept visible (overruled): ${PII_TYPE_LABELS[redaction.type]}`
      }
    >
      {redaction.text}
    </span>
  );
}

/** Compact banner when the full queue is done — workspace stays open for revisits. */
function QueueClearedBanner() {
  return (
    <div className="shrink-0 border-b border-emerald-500/30 bg-emerald-950/60 px-5 py-2 text-center">
      <span className="text-sm font-bold text-emerald-400">Queue Cleared!</span>
      <span className="ml-2 text-xs text-emerald-300/70">
        All documents reviewed — use [ ] to browse or click any file in the queue
      </span>
    </div>
  );
}

function DocumentViewer({
  title,
  content,
  redactions,
  status,
  isLoading,
  isQueueCleared,
  activeRedactionId,
  scrollContainerRef,
  spanRefs,
}: {
  title: string;
  content: string;
  redactions: Redaction[];
  status: DocumentStatus | null;
  isLoading: boolean;
  isQueueCleared: boolean;
  activeRedactionId: string | null;
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  spanRefs: React.MutableRefObject<Map<string, HTMLSpanElement>>;
}) {
  const segments = segmentContentForHighlights(content, redactions);

  if (isLoading) {
    return (
      <div className="col-span-6 flex items-center justify-center border-x border-zinc-800 text-sm text-zinc-500">
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
    <section className="col-span-6 flex min-h-0 flex-col border-x border-zinc-800 bg-zinc-950">
      {isQueueCleared && <QueueClearedBanner />}
      <header className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-5 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-zinc-100">{title}</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            Colored blocks = redacted by type · dashed underline = kept visible
          </p>
        </div>
        <span className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${statusBadgeClass}`}>
          {statusLabel}
        </span>
      </header>

      <article ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-300">
          {segments.map((segment, index) =>
            segment.kind === 'text' ? (
              <span key={`text-${index}`}>{segment.value}</span>
            ) : (
              <RedactionHighlight
                key={`redaction-${segment.redaction.id}`}
                redaction={segment.redaction}
                isActive={activeRedactionId === segment.redaction.id}
                spanRef={(el) => {
                  if (el) spanRefs.current.set(segment.redaction.id, el);
                  else spanRefs.current.delete(segment.redaction.id);
                }}
              />
            ),
          )}
        </pre>
      </article>
    </section>
  );
}

/**
 * Right-panel triage card — checkbox drives redact vs keep-visible decision.
 */
function RedactionCard({
  redaction,
  isActive,
  onActivate,
  onToggle,
  cardRef,
}: {
  redaction: Redaction;
  isActive: boolean;
  onActivate: () => void;
  onToggle: () => void;
  cardRef: (el: HTMLDivElement | null) => void;
}) {
  const isRedacted = redaction.status === 'approved';
  const isRejected = redaction.status === 'rejected';
  const colors = PII_TYPE_COLORS[redaction.type];

  return (
    <div
      ref={cardRef}
      tabIndex={isActive ? 0 : -1}
      role="button"
      onClick={onActivate}
      className={`rounded-md border border-l-2 p-3 transition-colors outline-none ${colors.cardAccent} ${
        isActive
          ? 'border-emerald-500 ring-2 ring-emerald-500 bg-zinc-900'
          : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
      } ${isRejected ? 'opacity-50' : ''}`}
      aria-pressed={isRedacted}
    >
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={isRedacted}
          onChange={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          onClick={(event) => event.stopPropagation()}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-950"
          aria-label={isRedacted ? 'Redact this span' : 'Keep this span visible'}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colors.badgeBg} ${colors.badgeText}`}
            >
              {PII_TYPE_LABELS[redaction.type]}
            </span>
            <span className="shrink-0 text-xs font-medium text-emerald-400">
              {formatConfidence(redaction.confidence)}
            </span>
          </div>
          <p
            className={`mt-1.5 break-words text-sm text-zinc-200 ${
              isRejected ? 'line-through decoration-zinc-500' : ''
            }`}
          >
            {redaction.text}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Right panel — keyboard focus anchor; cards drive center-panel sync-scroll.
 */
function RedactionListPanel({
  redactions,
  activeRedactionId,
  onActivate,
  onToggle,
  onFinishDocument,
  isLoading,
  cardRefs,
  panelRef,
}: {
  redactions: Redaction[];
  activeRedactionId: string | null;
  onActivate: (id: string) => void;
  onToggle: (id: string) => void;
  onFinishDocument: () => void;
  isLoading: boolean;
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  panelRef: React.RefObject<HTMLElement | null>;
}) {
  return (
    <aside
      ref={panelRef}
      className="col-span-3 flex min-h-0 flex-col border-l border-zinc-800 bg-zinc-950"
      aria-label="Redaction triage list"
    >
      <header className="shrink-0 border-b border-zinc-800 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-100">PII Spans</h2>
        <p className="mt-0.5 text-xs text-zinc-500">{redactions.length} detected in document</p>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {isLoading ? (
          <p className="px-1 text-sm text-zinc-500">Loading spans…</p>
        ) : redactions.length === 0 ? (
          <p className="px-1 text-sm text-zinc-500">No PII spans in this document.</p>
        ) : (
          <div className="space-y-2">
            {redactions.map((redaction) => (
              <RedactionCard
                key={redaction.id}
                redaction={redaction}
                isActive={activeRedactionId === redaction.id}
                onActivate={() => onActivate(redaction.id)}
                onToggle={() => onToggle(redaction.id)}
                cardRef={(el) => {
                  if (el) cardRefs.current.set(redaction.id, el);
                  else cardRefs.current.delete(redaction.id);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-zinc-800 px-4 py-2.5 text-xs text-zinc-500">
        <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-300">↑</kbd>
        <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-300">↓</kbd>{' '}
        Spans ·{' '}
        <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-300">Space</kbd>{' '}
        Toggle ·{' '}
        <button
          type="button"
          onClick={onFinishDocument}
          className="ml-1 rounded border border-emerald-600/40 bg-emerald-950/50 px-2 py-0.5 text-emerald-400 hover:bg-emerald-900/50"
        >
          Finish
        </button>
        <span className="ml-1 text-zinc-600">or</span>{' '}
        <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-300">D</kbd>
      </footer>
    </aside>
  );
}

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

export default function ReviewDashboard() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(20);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocumentDetailResponse | null>(null);
  const [redactions, setRedactions] = useState<Redaction[]>([]);
  const [isQueueLoading, setIsQueueLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [activeRedactionId, setActiveRedactionId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLElement>(null);
  const spanRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const rightPanelRef = useRef<HTMLElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendingCount = useMemo(() => countPending(documents), [documents]);
  const isQueueCleared = !isQueueLoading && documents.length > 0 && pendingCount === 0;

  const orderedRedactionIds = useMemo(() => redactions.map((r) => r.id), [redactions]);

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
      setRedactions(data.redactions);
      const firstId = data.redactions[0]?.id ?? null;
      setActiveRedactionId(firstId);
    } finally {
      setIsDetailLoading(false);
    }
  }, []);

  /** Activates a card and sync-scrolls the matching center span into view. */
  const activateRedaction = useCallback((redactionId: string) => {
    setActiveRedactionId(redactionId);

    requestAnimationFrame(() => {
      const card = cardRefs.current.get(redactionId);
      card?.focus({ preventScroll: true });

      const span = spanRefs.current.get(redactionId);
      span?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  const navigateRedactionCard = useCallback(
    (direction: 'up' | 'down') => {
      if (orderedRedactionIds.length === 0) return;

      const currentIndex = activeRedactionId
        ? orderedRedactionIds.indexOf(activeRedactionId)
        : -1;

      let nextIndex: number;
      if (direction === 'down') {
        nextIndex =
          currentIndex < orderedRedactionIds.length - 1 ? currentIndex + 1 : 0;
      } else {
        nextIndex =
          currentIndex > 0 ? currentIndex - 1 : orderedRedactionIds.length - 1;
      }

      activateRedaction(orderedRedactionIds[nextIndex]);
    },
    [orderedRedactionIds, activeRedactionId, activateRedaction],
  );

  /** Cycles through all documents in queue order — works even after queue is cleared. */
  const navigateQueue = useCallback(
    (direction: 'prev' | 'next') => {
      if (documents.length === 0) return;

      if (!selectedId) {
        setSelectedId(documents[0].id);
        return;
      }

      const currentIndex = documents.findIndex((doc) => doc.id === selectedId);
      const nextIndex =
        direction === 'next'
          ? (currentIndex + 1) % documents.length
          : (currentIndex - 1 + documents.length) % documents.length;

      setSelectedId(documents[nextIndex].id);
    },
    [documents, selectedId],
  );

  const toggleRedaction = useCallback(
    async (redactionId: string) => {
      if (!selectedId) return;

      const current = redactions.find((r) => r.id === redactionId);
      if (!current) return;

      const nextStatus: RedactionStatus =
        current.status === 'approved' ? 'rejected' : 'approved';

      const response = await fetch(
        `/api/documents/${selectedId}/redactions/${redactionId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus }),
        },
      );

      if (!response.ok) {
        showToast('Could not update span', 'warning');
        return;
      }

      const data: { redaction: Redaction } = await response.json();
      setRedactions((prev) =>
        prev.map((r) => (r.id === redactionId ? data.redaction : r)),
      );
      setDetail((prev) =>
        prev
          ? {
              ...prev,
              redactions: prev.redactions.map((r) =>
                r.id === redactionId ? data.redaction : r,
              ),
            }
          : prev,
      );
    },
    [selectedId, redactions, showToast],
  );

  const finishDocument = useCallback(async () => {
    if (!selectedId) return;

    const currentId = selectedId;

    const response = await fetch(`/api/documents/${currentId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'approved' }),
    });

    if (!response.ok) {
      showToast('Could not finish document', 'warning');
      return;
    }

    const queue = await fetchQueue();
    const nextId = findNextPendingId(currentId, queue);

    if (nextId) {
      showToast('Document finished — advancing queue', 'success');
      setSelectedId(nextId);
    } else if (countPending(queue) === 0) {
      showToast('Queue cleared!', 'success');
      // Keep current document open so Maya can keep reviewing or browse with [ ]
    } else {
      const fallback = queue.find((doc) => doc.status === 'pending');
      if (fallback) {
        showToast('Document finished — advancing queue', 'success');
        setSelectedId(fallback.id);
      }
    }
  }, [selectedId, fetchQueue, showToast]);

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

  /** Ensures a document is always selected when the queue has items. */
  useEffect(() => {
    if (isQueueLoading || documents.length === 0) return;
    if (selectedId === null) {
      const firstPending = documents.find((doc) => doc.status === 'pending') ?? documents[0];
      setSelectedId(firstPending.id);
    }
  }, [documents, selectedId, isQueueLoading]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      setRedactions([]);
      setActiveRedactionId(null);
      spanRefs.current.clear();
      cardRefs.current.clear();
      return;
    }
    spanRefs.current.clear();
    cardRefs.current.clear();
    fetchDocumentDetail(selectedId);
  }, [selectedId, fetchDocumentDetail]);

  /** Sync-scroll center span whenever the active right-panel card changes. */
  useEffect(() => {
    if (!activeRedactionId || isDetailLoading) return;

    requestAnimationFrame(() => {
      const span = spanRefs.current.get(activeRedactionId);
      span?.scrollIntoView({ behavior: 'smooth', block: 'center' });

      const card = cardRefs.current.get(activeRedactionId);
      card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      card?.focus({ preventScroll: true });
    });
  }, [activeRedactionId, isDetailLoading]);

  /** Focus the right panel when a document loads — keyboard home base for Maya. */
  useEffect(() => {
    if (!isDetailLoading && redactions.length > 0 && activeRedactionId) {
      requestAnimationFrame(() => {
        cardRefs.current.get(activeRedactionId)?.focus({ preventScroll: true });
      });
    }
  }, [isDetailLoading, redactions.length, activeRedactionId, selectedId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (event.key === '[') {
        event.preventDefault();
        navigateQueue('prev');
        return;
      }

      if (event.key === ']') {
        event.preventDefault();
        navigateQueue('next');
        return;
      }

      if (orderedRedactionIds.length === 0) return;

      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          navigateRedactionCard('up');
          break;
        case 'ArrowDown':
          event.preventDefault();
          navigateRedactionCard('down');
          break;
        case ' ':
        case 'Enter':
          if (activeRedactionId) {
            event.preventDefault();
            toggleRedaction(activeRedactionId);
          }
          break;
        case 'd':
        case 'D':
          event.preventDefault();
          finishDocument();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    navigateRedactionCard,
    navigateQueue,
    toggleRedaction,
    finishDocument,
    activeRedactionId,
    orderedRedactionIds,
  ]);

  const selectedDoc = documents.find((doc) => doc.id === selectedId) ?? null;

  const viewerContent =
    detail?.content ??
    (selectedDoc ? buildMockDocumentBody(selectedDoc.title, redactions) : '');

  const showWorkspace = selectedId && selectedDoc;

  return (
    <div className="grid h-screen grid-cols-12 bg-zinc-950">
      <aside className="col-span-3 flex min-h-0 flex-col border-r border-zinc-800 bg-zinc-950">
        <div className="shrink-0 border-b border-zinc-800 px-4 py-3">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight text-zinc-100">Conseal</span>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-400">
              Bulk Review
            </span>
          </div>
          <QueueProgress processed={processedCount} total={totalCount} />
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto" aria-label="Document queue">
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

        <footer className="shrink-0 border-t border-zinc-800 px-4 py-2 text-xs text-zinc-500">
          <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-300">[</kbd>
          <kbd className="rounded border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 text-zinc-300">]</kbd>{' '}
          Prev / next document
        </footer>
      </aside>

      {showWorkspace ? (
        <>
          <DocumentViewer
            title={selectedDoc.title}
            content={viewerContent}
            redactions={redactions}
            status={selectedDoc.status}
            isLoading={isDetailLoading}
            isQueueCleared={isQueueCleared}
            activeRedactionId={activeRedactionId}
            scrollContainerRef={scrollContainerRef}
            spanRefs={spanRefs}
          />

          <RedactionListPanel
            redactions={redactions}
            activeRedactionId={activeRedactionId}
            onActivate={activateRedaction}
            onToggle={toggleRedaction}
            onFinishDocument={finishDocument}
            isLoading={isDetailLoading}
            cardRefs={cardRefs}
            panelRef={rightPanelRef}
          />
        </>
      ) : (
        <div className="col-span-9 flex items-center justify-center text-sm text-zinc-500">
          Loading document…
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}
