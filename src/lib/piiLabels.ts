/**
 * @fileoverview Human-readable PII labels and type-specific color tokens.
 *
 * Consistent colors across center highlights and right-panel cards let Maya
 * scan by category (e.g. rose = SSN, violet = names) without reading every label.
 */

import type { PiiType } from '@/types';

/** Maps detector type codes to plain-language labels. */
export const PII_TYPE_LABELS: Record<PiiType, string> = {
  PERSON_NAME: 'Person Name',
  EMAIL: 'Email Address',
  PHONE: 'Phone Number',
  SSN: 'Social Security Number',
  ADDRESS: 'Street Address',
  DATE_OF_BIRTH: 'Date of Birth',
  ACCOUNT_NUMBER: 'Account Number',
  CREDIT_CARD: 'Credit Card Number',
  DRIVERS_LICENSE: "Driver's License",
  MEDICAL_RECORD: 'Medical Record Identifier',
  IP_ADDRESS: 'IP Address',
  EMPLOYER_ID: 'Employer / Organization ID',
};

/** Tailwind class bundles per PII type — tuned for dark zinc backgrounds. */
export interface PiiTypeColors {
  /** Center span when marked for redaction */
  redactedBg: string;
  redactedText: string;
  /** Center span when kept visible (overruled) */
  visibleText: string;
  visibleUnderline: string;
  /** Right-panel card type badge */
  badgeBg: string;
  badgeText: string;
  /** Right-panel card left accent */
  cardAccent: string;
}

export const PII_TYPE_COLORS: Record<PiiType, PiiTypeColors> = {
  PERSON_NAME: {
    redactedBg: 'bg-violet-700',
    redactedText: 'text-violet-700',
    visibleText: 'text-violet-200',
    visibleUnderline: 'decoration-violet-400',
    badgeBg: 'bg-violet-500/20',
    badgeText: 'text-violet-300',
    cardAccent: 'border-l-violet-500',
  },
  EMAIL: {
    redactedBg: 'bg-sky-700',
    redactedText: 'text-sky-700',
    visibleText: 'text-sky-200',
    visibleUnderline: 'decoration-sky-400',
    badgeBg: 'bg-sky-500/20',
    badgeText: 'text-sky-300',
    cardAccent: 'border-l-sky-500',
  },
  PHONE: {
    redactedBg: 'bg-cyan-700',
    redactedText: 'text-cyan-700',
    visibleText: 'text-cyan-200',
    visibleUnderline: 'decoration-cyan-400',
    badgeBg: 'bg-cyan-500/20',
    badgeText: 'text-cyan-300',
    cardAccent: 'border-l-cyan-500',
  },
  SSN: {
    redactedBg: 'bg-rose-800',
    redactedText: 'text-rose-800',
    visibleText: 'text-rose-200',
    visibleUnderline: 'decoration-rose-400',
    badgeBg: 'bg-rose-500/20',
    badgeText: 'text-rose-300',
    cardAccent: 'border-l-rose-500',
  },
  ADDRESS: {
    redactedBg: 'bg-orange-700',
    redactedText: 'text-orange-700',
    visibleText: 'text-orange-200',
    visibleUnderline: 'decoration-orange-400',
    badgeBg: 'bg-orange-500/20',
    badgeText: 'text-orange-300',
    cardAccent: 'border-l-orange-500',
  },
  DATE_OF_BIRTH: {
    redactedBg: 'bg-pink-700',
    redactedText: 'text-pink-700',
    visibleText: 'text-pink-200',
    visibleUnderline: 'decoration-pink-400',
    badgeBg: 'bg-pink-500/20',
    badgeText: 'text-pink-300',
    cardAccent: 'border-l-pink-500',
  },
  ACCOUNT_NUMBER: {
    redactedBg: 'bg-amber-700',
    redactedText: 'text-amber-700',
    visibleText: 'text-amber-200',
    visibleUnderline: 'decoration-amber-400',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    cardAccent: 'border-l-amber-500',
  },
  CREDIT_CARD: {
    redactedBg: 'bg-red-800',
    redactedText: 'text-red-800',
    visibleText: 'text-red-200',
    visibleUnderline: 'decoration-red-400',
    badgeBg: 'bg-red-500/20',
    badgeText: 'text-red-300',
    cardAccent: 'border-l-red-500',
  },
  DRIVERS_LICENSE: {
    redactedBg: 'bg-indigo-700',
    redactedText: 'text-indigo-700',
    visibleText: 'text-indigo-200',
    visibleUnderline: 'decoration-indigo-400',
    badgeBg: 'bg-indigo-500/20',
    badgeText: 'text-indigo-300',
    cardAccent: 'border-l-indigo-500',
  },
  MEDICAL_RECORD: {
    redactedBg: 'bg-fuchsia-700',
    redactedText: 'text-fuchsia-700',
    visibleText: 'text-fuchsia-200',
    visibleUnderline: 'decoration-fuchsia-400',
    badgeBg: 'bg-fuchsia-500/20',
    badgeText: 'text-fuchsia-300',
    cardAccent: 'border-l-fuchsia-500',
  },
  IP_ADDRESS: {
    redactedBg: 'bg-teal-700',
    redactedText: 'text-teal-700',
    visibleText: 'text-teal-200',
    visibleUnderline: 'decoration-teal-400',
    badgeBg: 'bg-teal-500/20',
    badgeText: 'text-teal-300',
    cardAccent: 'border-l-teal-500',
  },
  EMPLOYER_ID: {
    redactedBg: 'bg-lime-700',
    redactedText: 'text-lime-700',
    visibleText: 'text-lime-200',
    visibleUnderline: 'decoration-lime-400',
    badgeBg: 'bg-lime-500/20',
    badgeText: 'text-lime-300',
    cardAccent: 'border-l-lime-500',
  },
};

/**
 * Formats confidence as a percentage string for display.
 */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
