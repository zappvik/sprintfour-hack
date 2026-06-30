/**
 * @fileoverview Synthetic document body text for the review viewer.
 *
 * Real PDF parsing is out of scope; we weave detected PII spans into legal boilerplate
 * so highlights align with literal substring positions in the rendered text.
 */

import type { Redaction } from '@/types';

/** Legal filler sentences between embedded PII spans — keeps the viewer readable. */
const FILLER_SENTENCES = [
  'The parties acknowledge receipt of the discovery request dated herein and agree to produce responsive materials subject to applicable privileges.',
  'Pursuant to Federal Rule of Civil Procedure 26, the producing party has conducted a reasonable search for electronically stored information.',
  'All references contained in this memorandum are subject to the protective order entered in this matter.',
  'The undersigned certifies that the information provided reflects a good-faith effort to identify protected material prior to disclosure.',
  'Counsel reserves all objections, including but not limited to attorney-client privilege and work-product doctrine.',
  'This draft is provided for internal review only and shall not be disclosed to third parties without prior written consent.',
];

/**
 * Builds a mock document body with each redaction's `text` embedded exactly once.
 * Enables deterministic highlight splitting in the viewer without offset metadata.
 */
export function buildMockDocumentBody(title: string, redactions: Redaction[]): string {
  const header = [
    'CONFIDENTIAL — ATTORNEY WORK PRODUCT',
    `File: ${title}`,
    `Review generated: ${new Date().toISOString().split('T')[0]}`,
    '',
  ].join('\n');

  if (redactions.length === 0) {
    return `${header}\nNo PII spans detected in this document.`;
  }

  const paragraphs: string[] = [];
  let fillerIndex = 0;

  for (let i = 0; i < redactions.length; i += 2) {
    const pair = redactions.slice(i, i + 2);
    const filler = FILLER_SENTENCES[fillerIndex % FILLER_SENTENCES.length];
    fillerIndex += 1;

    let sentence = filler + ' ';

    if (pair.length === 1) {
      sentence += `The record references ${pair[0].text} in connection with the matter under review.`;
    } else {
      sentence += `Identified parties include ${pair[0].text}, with related contact information ${pair[1].text} noted in the supplemental index.`;
    }

    paragraphs.push(sentence);
  }

  paragraphs.push(
    'The producing party reserves the right to supplement this production and asserts all applicable privileges. End of document.',
  );

  return `${header}\n${paragraphs.join('\n\n')}`;
}

/**
 * Splits document content into alternating plain-text and PII segments for rendering.
 * Segments are ordered by first occurrence so nested overlaps are avoided.
 */
export function segmentContentForHighlights(
  content: string,
  redactions: Redaction[],
): Array<
  | { kind: 'text'; value: string }
  | { kind: 'redaction'; value: string; redaction: Redaction }
> {
  const occurrences = redactions
    .map((redaction) => ({
      redaction,
      index: content.indexOf(redaction.text),
    }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index);

  const segments: Array<
    | { kind: 'text'; value: string }
    | { kind: 'redaction'; value: string; redaction: Redaction }
  > = [];

  let cursor = 0;

  for (const { redaction, index } of occurrences) {
    if (index < cursor) continue;

    if (index > cursor) {
      segments.push({ kind: 'text', value: content.slice(cursor, index) });
    }

    segments.push({
      kind: 'redaction',
      value: redaction.text,
      redaction,
    });

    cursor = index + redaction.text.length;
  }

  if (cursor < content.length) {
    segments.push({ kind: 'text', value: content.slice(cursor) });
  }

  return segments;
}
