/**
 * @fileoverview Builds Maya's anonymized document output from triage decisions.
 *
 * Checked spans are replaced with stable tokens (e.g. [PII_TOKEN_01]) so the
 * result is safe to share with AI tools while preserving document structure.
 */

import type { Redaction } from '@/types';

/**
 * Assigns stable replacement tokens to approved spans in reading order.
 */
export function buildTokenMap(redactions: Redaction[]): Map<string, string> {
  const approved = redactions
    .filter((redaction) => redaction.status === 'approved')
    .map((redaction) => ({
      redaction,
      index: 0,
    }));

  const map = new Map<string, string>();
  approved.forEach((item, index) => {
    map.set(
      item.redaction.id,
      `[PII_TOKEN_${String(index + 1).padStart(2, '0')}]`,
    );
  });
  return map;
}

/**
 * Produces anonymized text by replacing approved spans with token placeholders.
 */
export function buildAnonymizedOutput(content: string, redactions: Redaction[]): string {
  const occurrences = redactions
    .filter((redaction) => redaction.status === 'approved')
    .map((redaction) => ({
      redaction,
      index: content.indexOf(redaction.text),
    }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index);

  if (occurrences.length === 0) {
    return content;
  }

  const tokenMap = buildTokenMap(redactions);
  const parts: string[] = [];
  let cursor = 0;

  for (const { redaction, index } of occurrences) {
    if (index < cursor) continue;

    parts.push(content.slice(cursor, index));
    parts.push(tokenMap.get(redaction.id) ?? '[PII_REDACTED]');
    cursor = index + redaction.text.length;
  }

  parts.push(content.slice(cursor));
  return parts.join('');
}

/**
 * Counts how many spans are marked for anonymization in the current document.
 */
export function countAnonymizedSpans(redactions: Redaction[]): number {
  return redactions.filter((redaction) => redaction.status === 'approved').length;
}
