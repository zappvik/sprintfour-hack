'use client';

/**
 * @fileoverview Conseal 3-pane bulk anonymization workstation — Queue | Document | PII List.
 *
 * Maya's goal is anonymizing high-volume case files: review spans fast, preview safe
 * output, and advance through the queue without leaving the keyboard.
 */

import { buildAnonymizedOutput, countAnonymizedSpans } from '@/lib/anonymizeOutput';
import { buildMockDocumentBody, segmentContentForHighlights } from '@/lib/mockDocumentContent';
import { formatConfidence, PII_TYPE_LABELS } from '@/lib/piiLabels';
import { MOCK_DOCUMENTS, MOCK_REDACTIONS } from '@/lib/mockData';
import {
  getDocumentDetail,
  listDocuments,
  seedSidecar,
  sidecarHealthCheck,
  updateDocumentStatus,
  updateRedactionStatus,
} from '@/lib/sidecarClient';
import type { Document, DocumentStatus, Redaction, RedactionStatus } from '@/types';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/** Document detail payload from the sidecar */
interface DocumentDetailResponse {
  document: Document;
  redactions: Redaction[];
  content: string;
}

interface SidecarSeedDocument {
  id: string;
  title: string;
  character_count: number;
  total_redactions: number;
  confidence_score: number;
  status: DocumentStatus;
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

/** Ephemeral toast payload */
interface ToastState {
  message: string;
  tone: 'success' | 'warning';
}

/** Center panel display mode — original source vs anonymized output preview */
type ViewMode = 'original' | 'anonymized';

function countPending(documents: Document[]): number {
  return documents.filter((doc) => doc.status === 'pending').length;
}

function statusAccentClass(status: DocumentStatus): string {
  switch (status) {
    case 'approved':
      return 'border-l-emerald-500';
    default:
      return 'border-l-zinc-600';
  }
}

/**
 * Surfaces Maya's end-of-day pressure: how many files are left vs anonymized.
 */
function QueueThroughput({ total, remaining, anonymized }: { total: number; remaining: number; anonymized: number }) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-xs">
      <p className="font-medium text-zinc-300">{remaining} remaining · {anonymized} anonymized</p>
      <p className="mt-0.5 text-zinc-500">{total} case files in queue</p>
    </div>
  );
}

/** Shown when the local Python sidecar is not running. */
function SidecarOfflineBanner({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="col-span-9 flex flex-col items-center justify-center gap-3 border-x border-zinc-800 px-8 text-center">
      <p className="text-sm font-semibold text-amber-300">Local anonymizer sidecar is offline</p>
      <p className="max-w-md text-xs text-zinc-400">
        Start it with:{' '}
        <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-zinc-200">
          python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
        </code>
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:bg-zinc-800"
      >
        Retry connection
      </button>
    </div>
  );
}

function StatusDot({ status }: { status: DocumentStatus }) {
  const color =
    status === 'approved'
      ? 'bg-emerald-400'
      : 'bg-zinc-500';

  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} aria-hidden />;
}

function QueueItem({
  document,
  isSelected,
  onSelect,
  itemRef,
}: {
  document: Document;
  isSelected: boolean;
  onSelect: () => void;
  itemRef: (el: HTMLButtonElement | null) => void;
}) {
  return (
    <button
      ref={itemRef}
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

/** Highlights replacement tokens in anonymized output preview. */
function AnonymizedToken({ token }: { token: string }) {
  return (
    <span className="rounded bg-emerald-700/80 px-1 font-semibold text-emerald-100">{token}</span>
  );
}

function renderAnonymizedPreview(text: string): ReactNode[] {
  return text.split(/(\[PII_TOKEN_\d{2}\])/).map((part, index) =>
    /^\[PII_TOKEN_\d{2}\]$/.test(part) ? (
      <AnonymizedToken key={`token-${index}`} token={part} />
    ) : (
      <span key={`text-${index}`}>{part}</span>
    ),
  );
}

/**
 * Center-panel span — green strikethrough = marked for anonymization.
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
  const isAnonymized = redaction.status === 'approved';
  const styleClass = isAnonymized
    ? 'bg-emerald-600/35 text-emerald-100 font-semibold line-through decoration-emerald-300/80 shadow-sm'
    : 'text-zinc-300 underline decoration-zinc-500 decoration-dashed underline-offset-4';

  const activeRing = isActive ? 'ring-2 ring-emerald-400 ring-offset-2 ring-offset-zinc-950' : '';

  return (
    <span
      ref={spanRef}
      data-redaction-id={redaction.id}
      className={`rounded-sm px-0.5 ${styleClass} ${activeRing}`}
      aria-label={
        isAnonymized
          ? `Anonymize: ${PII_TYPE_LABELS[redaction.type]}`
          : `Keep visible: ${PII_TYPE_LABELS[redaction.type]}`
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
      <span className="text-sm font-bold text-emerald-400">Queue Anonymized!</span>
      <span className="ml-2 text-xs text-emerald-300/70">
        All case files processed — use [ ] to browse or click any file in the queue
      </span>
    </div>
  );
}

function DocumentViewer({
  title,
  content,
  anonymizedContent,
  redactions,
  status,
  isLoading,
  isQueueCleared,
  viewMode,
  onViewModeChange,
  onCopyAnonymized,
  onDownloadAnonymized,
  activeRedactionId,
  scrollContainerRef,
  spanRefs,
}: {
  title: string;
  content: string;
  anonymizedContent: string;
  redactions: Redaction[];
  status: DocumentStatus | null;
  isLoading: boolean;
  isQueueCleared: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onCopyAnonymized: () => void;
  onDownloadAnonymized: () => void;
  activeRedactionId: string | null;
  scrollContainerRef: React.RefObject<HTMLElement | null>;
  spanRefs: React.MutableRefObject<Map<string, HTMLSpanElement>>;
}) {
  const segments = segmentContentForHighlights(content, redactions);
  const anonymizedSpanCount = countAnonymizedSpans(redactions);

  if (isLoading) {
    return (
      <div className="col-span-6 flex items-center justify-center border-x border-zinc-800 text-sm text-zinc-500">
        Loading document…
      </div>
    );
  }

  const statusLabel =
    status === 'approved' ? 'Anonymized' : 'Pending review';

  const statusBadgeClass =
    status === 'approved'
      ? 'bg-emerald-500/15 text-emerald-400'
      : 'bg-zinc-800 text-zinc-400';

  return (
    <section className="col-span-6 flex min-h-0 flex-col border-x border-zinc-800 bg-zinc-950">
      {isQueueCleared && <QueueClearedBanner />}
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-800 px-5 py-3">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-zinc-100">{title}</h1>
          <p className="mt-0.5 text-xs text-zinc-500">
            {viewMode === 'original'
              ? 'Green strikethrough = anonymize · dashed underline = keep visible'
              : `${anonymizedSpanCount} spans replaced with safe tokens`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex rounded border border-zinc-700 text-xs">
            <button
              type="button"
              onClick={() => onViewModeChange('original')}
              className={`px-2 py-1 ${viewMode === 'original' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400'}`}
            >
              Original (O)
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('anonymized')}
              className={`px-2 py-1 ${viewMode === 'anonymized' ? 'bg-emerald-900/50 text-emerald-300' : 'text-zinc-400'}`}
            >
              Anonymized (A)
            </button>
          </div>
          <span className={`rounded px-2 py-1 text-xs font-medium ${statusBadgeClass}`}>
            {statusLabel}
          </span>
          {viewMode === 'anonymized' && (
            <>
              <button
                type="button"
                onClick={onCopyAnonymized}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-800"
              >
                Copy safe output
              </button>
              <button
                type="button"
                onClick={onDownloadAnonymized}
                className="rounded border border-emerald-700/50 bg-emerald-950/40 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-900/40"
              >
                Download .txt
              </button>
            </>
          )}
        </div>
      </header>

      <article ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-300">
          {viewMode === 'original'
            ? segments.map((segment, index) =>
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
              )
            : renderAnonymizedPreview(anonymizedContent)}
        </pre>
      </article>
    </section>
  );
}

/**
 * Right-panel triage card — checkbox marks span for anonymization in output.
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
  const isAnonymized = redaction.status === 'approved';
  const isRejected = redaction.status === 'rejected';

  return (
    <div
      ref={cardRef}
      tabIndex={isActive ? 0 : -1}
      role="button"
      onClick={onActivate}
      className={`rounded-md border border-l-2 border-l-emerald-500 p-3 transition-colors outline-none ${
        isActive
          ? 'border-emerald-500 ring-2 ring-emerald-500 bg-zinc-900'
          : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
      } ${isRejected ? 'opacity-50' : ''}`}
      aria-pressed={isAnonymized}
    >
      <div className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={isAnonymized}
          onChange={(event) => {
            event.stopPropagation();
            onToggle();
          }}
          onClick={(event) => event.stopPropagation()}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-950"
          aria-label={isAnonymized ? 'Anonymize this span' : 'Keep this span visible'}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300">
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
  onAnonymizeAndContinue,
  onUndoAnonymizations,
  isLoading,
  cardRefs,
  panelRef,
}: {
  redactions: Redaction[];
  activeRedactionId: string | null;
  onActivate: (id: string) => void;
  onToggle: (id: string) => void;
  onAnonymizeAndContinue: () => void;
  onUndoAnonymizations: () => void;
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
        <p className="mt-1 text-[11px] text-zinc-400">
          Checked = Anonymize in output · Unchecked = Keep visible
        </p>
        <p className="mt-1 text-[11px] text-emerald-400/80">
          {countAnonymizedSpans(redactions)} spans marked for replacement
        </p>
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
          onClick={onAnonymizeAndContinue}
          className="ml-1 rounded border border-emerald-600/40 bg-emerald-950/50 px-2 py-0.5 text-emerald-400 hover:bg-emerald-900/50"
        >
          Anonymize &amp; next (D)
        </button>
        <button
          type="button"
          onClick={onUndoAnonymizations}
          className="ml-1 rounded border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-zinc-300 hover:bg-zinc-800"
        >
          Undo anonymizations (U)
        </button>
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

/**
 * Converts existing UI redaction types into backend detector-like kinds for seeding.
 */
function mapPiiTypeToKind(type: Redaction['type']): string {
  switch (type) {
    case 'SSN':
      return 'ssn';
    case 'EMAIL':
      return 'email';
    case 'ACCOUNT_NUMBER':
    case 'CREDIT_CARD':
    case 'DRIVERS_LICENSE':
      return 'api_key';
    default:
      return 'secret_heuristic';
  }
}

/**
 * Prepares sidecar seed documents from the current mock queue and redaction set.
 */
function buildSidecarSeedDocuments(): SidecarSeedDocument[] {
  return MOCK_DOCUMENTS.map((document) => {
    const redactions = MOCK_REDACTIONS.filter((redaction) => redaction.docId === document.id);
    const content = buildMockDocumentBody(document.title, redactions);

    const seededRedactions = redactions.map((redaction) => {
      const start = content.indexOf(redaction.text);
      const end = start < 0 ? -1 : start + redaction.text.length;
      return {
        id: redaction.id,
        kind: mapPiiTypeToKind(redaction.type),
        confidence: redaction.confidence,
        original: redaction.text,
        start,
        end,
        status: redaction.status,
      };
    });

    return {
      id: document.id,
      title: document.title,
      character_count: document.characterCount,
      total_redactions: document.totalRedactions,
      confidence_score: document.confidenceScore,
      status: document.status,
      content,
      redactions: seededRedactions,
    };
  });
}

export default function ReviewDashboard() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DocumentDetailResponse | null>(null);
  const [redactions, setRedactions] = useState<Redaction[]>([]);
  const [isQueueLoading, setIsQueueLoading] = useState(true);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [activeRedactionId, setActiveRedactionId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('original');
  const [sidecarOffline, setSidecarOffline] = useState(false);
  const scrollContainerRef = useRef<HTMLElement>(null);
  const spanRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const queueItemRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const rightPanelRef = useRef<HTMLElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendingCount = useMemo(() => countPending(documents), [documents]);
  const anonymizedCount = useMemo(
    () => documents.filter((doc) => doc.status === 'approved').length,
    [documents],
  );
  const isQueueCleared = !isQueueLoading && documents.length > 0 && pendingCount === 0;

  const orderedRedactionIds = useMemo(() => redactions.map((r) => r.id), [redactions]);

  const showToast = useCallback((message: string, tone: ToastState['tone']) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, tone });
    toastTimerRef.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const fetchQueue = useCallback(async (): Promise<Document[]> => {
    const documents = await listDocuments();
    setDocuments(documents);
    setSidecarOffline(false);
    return documents;
  }, []);

  const retrySidecarConnection = useCallback(async () => {
    setIsQueueLoading(true);
    setSidecarOffline(false);
    try {
      const healthy = await sidecarHealthCheck();
      if (!healthy) throw new Error('Sidecar is not reachable');

      const existing = await listDocuments();
      if (existing.length === 0) {
        await seedSidecar(buildSidecarSeedDocuments());
      }

      const queue = await fetchQueue();
      const firstPending = queue.find((doc) => doc.status === 'pending') ?? queue[0];
      if (firstPending) setSelectedId(firstPending.id);
    } catch {
      setSidecarOffline(true);
      showToast('Sidecar still offline', 'warning');
    } finally {
      setIsQueueLoading(false);
    }
  }, [fetchQueue, showToast]);

  const fetchDocumentDetail = useCallback(async (id: string) => {
    setIsDetailLoading(true);
    try {
      const data: DocumentDetailResponse = await getDocumentDetail(id);
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

      try {
        const persistedStatus = await updateRedactionStatus(selectedId, redactionId, nextStatus);
        setRedactions((prev) =>
          prev.map((r) =>
            r.id === redactionId ? { ...r, status: persistedStatus } : r,
          ),
        );
        setDetail((prev) =>
          prev
            ? {
                ...prev,
                redactions: prev.redactions.map((r) =>
                  r.id === redactionId ? { ...r, status: persistedStatus } : r,
                ),
              }
            : prev,
        );
      } catch {
        showToast('Could not update span', 'warning');
      }
    },
    [selectedId, redactions, showToast],
  );

  /**
   * Clears all current-document anonymization marks so Maya can restart triage fast.
   */
  const undoAnonymizations = useCallback(async () => {
    if (!selectedId) return;

    const anonymizedRedactions = redactions.filter((redaction) => redaction.status === 'approved');
    if (anonymizedRedactions.length === 0) {
      showToast('No anonymizations to undo', 'warning');
      return;
    }

    const results = await Promise.all(
      anonymizedRedactions.map(async (redaction) => {
        const status = await updateRedactionStatus(selectedId, redaction.id, 'rejected');
        return { id: redaction.id, status };
      }),
    );

    const updatedById = new Map(results.map((item) => [item.id, item.status]));

    setRedactions((prev) =>
      prev.map((redaction) =>
        updatedById.has(redaction.id)
          ? { ...redaction, status: updatedById.get(redaction.id) ?? redaction.status }
          : redaction,
      ),
    );
    setDetail((prev) =>
      prev
        ? {
            ...prev,
            redactions: prev.redactions.map(
              (redaction) =>
                updatedById.has(redaction.id)
                  ? { ...redaction, status: updatedById.get(redaction.id) ?? redaction.status }
                  : redaction,
            ),
          }
        : prev,
    );

    showToast('All anonymizations undone', 'success');
  }, [selectedId, redactions, showToast]);

  const anonymizeAndContinue = useCallback(async () => {
    if (!selectedId) return;

    const currentId = selectedId;

    try {
      await updateDocumentStatus(currentId, 'approved');
    } catch {
      showToast('Could not anonymize document', 'warning');
      return;
    }

    const queue = await fetchQueue();
    const nextId = findNextPendingId(currentId, queue);

    if (nextId) {
      showToast('Document anonymized — advancing queue', 'success');
      setSelectedId(nextId);
    } else if (countPending(queue) === 0) {
      showToast('Queue anonymized!', 'success');
    } else {
      const fallback = queue.find((doc) => doc.status === 'pending');
      if (fallback) {
        showToast('Document anonymized — advancing queue', 'success');
        setSelectedId(fallback.id);
      }
    }
  }, [selectedId, fetchQueue, showToast]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const healthy = await sidecarHealthCheck();
        if (!healthy) {
          throw new Error('Sidecar is not reachable');
        }

        const existing = await listDocuments();
        if (!cancelled && existing.length === 0) {
          await seedSidecar(buildSidecarSeedDocuments());
        }

        const queue = await fetchQueue();
        if (cancelled) return;
        const firstPending = queue.find((doc) => doc.status === 'pending') ?? queue[0];
        if (firstPending) setSelectedId(firstPending.id);
      } catch {
        if (!cancelled) {
          setSidecarOffline(true);
          showToast('Could not load queue', 'warning');
        }
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
      setViewMode('original');
      spanRefs.current.clear();
      cardRefs.current.clear();
      return;
    }
    setViewMode('original');
    spanRefs.current.clear();
    cardRefs.current.clear();
    fetchDocumentDetail(selectedId);
  }, [selectedId, fetchDocumentDetail]);

  /**
   * Keeps the left queue panel aligned with keyboard navigation ([ and ]).
   * This prevents Maya from losing visual context when jumping between files.
   */
  useEffect(() => {
    if (!selectedId) return;
    const queueItem = queueItemRefs.current.get(selectedId);
    queueItem?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedId]);

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
          anonymizeAndContinue();
          break;
        case 'u':
        case 'U':
          event.preventDefault();
          undoAnonymizations();
          break;
        case 'o':
        case 'O':
          event.preventDefault();
          setViewMode('original');
          break;
        case 'a':
        case 'A':
          event.preventDefault();
          setViewMode('anonymized');
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
    anonymizeAndContinue,
    undoAnonymizations,
    activeRedactionId,
    orderedRedactionIds,
  ]);

  const selectedDoc = documents.find((doc) => doc.id === selectedId) ?? null;

  const viewerContent =
    detail?.content ??
    (selectedDoc ? buildMockDocumentBody(selectedDoc.title, redactions) : '');

  const anonymizedContent = useMemo(
    () => buildAnonymizedOutput(viewerContent, redactions),
    [viewerContent, redactions],
  );

  const copyAnonymizedOutput = useCallback(async () => {
    if (!anonymizedContent) return;
    try {
      await navigator.clipboard.writeText(anonymizedContent);
      showToast('Safe output copied to clipboard', 'success');
    } catch {
      showToast('Could not copy to clipboard', 'warning');
    }
  }, [anonymizedContent, showToast]);

  const downloadAnonymizedOutput = useCallback(() => {
    if (!anonymizedContent || !selectedDoc) return;
    const safeTitle = selectedDoc.title.replace(/[^\w.-]+/g, '_').slice(0, 80);
    const blob = new Blob([anonymizedContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${safeTitle}-anonymized.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast('Safe output downloaded', 'success');
  }, [anonymizedContent, selectedDoc, showToast]);

  const showWorkspace = selectedId && selectedDoc && !sidecarOffline;

  return (
    <div className="grid h-screen grid-cols-12 bg-zinc-950">
      <aside className="col-span-3 flex min-h-0 flex-col border-r border-zinc-800 bg-zinc-950">
        <div className="shrink-0 border-b border-zinc-800 px-4 py-3">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm font-bold tracking-tight text-zinc-100">Conseal</span>
            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium uppercase text-zinc-400">
              Anonymize
            </span>
          </div>
          {!isQueueLoading && documents.length > 0 && (
            <QueueThroughput
              total={documents.length}
              remaining={pendingCount}
              anonymized={anonymizedCount}
            />
          )}
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
                itemRef={(el) => {
                  if (el) queueItemRefs.current.set(document.id, el);
                  else queueItemRefs.current.delete(document.id);
                }}
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

      {sidecarOffline ? (
        <SidecarOfflineBanner onRetry={retrySidecarConnection} />
      ) : showWorkspace ? (
        <>
          <DocumentViewer
            title={selectedDoc.title}
            content={viewerContent}
            anonymizedContent={anonymizedContent}
            redactions={redactions}
            status={selectedDoc.status}
            isLoading={isDetailLoading}
            isQueueCleared={isQueueCleared}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onCopyAnonymized={copyAnonymizedOutput}
            onDownloadAnonymized={downloadAnonymizedOutput}
            activeRedactionId={activeRedactionId}
            scrollContainerRef={scrollContainerRef}
            spanRefs={spanRefs}
          />

          <RedactionListPanel
            redactions={redactions}
            activeRedactionId={activeRedactionId}
            onActivate={activateRedaction}
            onToggle={toggleRedaction}
            onAnonymizeAndContinue={anonymizeAndContinue}
            onUndoAnonymizations={undoAnonymizations}
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
