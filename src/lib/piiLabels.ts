/**
 * @fileoverview Human-readable PII labels for Marcus's explainability tooltips.
 *
 * Raw enum values (e.g. `SSN`) are opaque to paralegals; friendly labels build
 * trust on hover without an extra click or modal interrupting Maya's flow.
 */

import type { PiiType } from '@/types';

/** Maps detector type codes to plain-language labels shown in hover tooltips. */
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

/**
 * Formats confidence as a percentage string for tooltip display.
 */
export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}
