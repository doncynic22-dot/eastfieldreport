/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, StudentBill, ReportConfig } from '../types';
import { ARKESEL_ENDPOINTS, logSmsDispatchAttempt, handle404EndpointError } from '../lib/arkeselDiagnostic';

export interface ReportCardSmsTemplate {
  id: string;
  title: string;
  description: string;
  content: string;
}

export const DEFAULT_REPORT_CARD_SMS_TEMPLATES: ReportCardSmsTemplate[] = [
  {
    id: 'report-finalized',
    title: 'Report Card Finalized & Ready Alert',
    description: 'Notifies parents when official end-of-term academic reports are finalized.',
    content: 'Dear {{guardian_name}}, the {{term}} report card for {{student_name}} ({{class_name}}) has been finalized by {{school_name}}. Next term reopens on {{reopening_date}}. Outstanding balance: GH₵ {{fees_balance}}.'
  },
  {
    id: 'report-results-ready',
    title: 'Terminal Results Summary Alert',
    description: 'Quick notification alerting parents that terminal assessment results are ready.',
    content: 'Dear {{guardian_name}}, academic results for {{student_name}} ({{class_name}}) for {{term}} {{academic_year}} are now available. Contact administration or check parent portal. Reopening: {{reopening_date}}.'
  },
  {
    id: 'report-fee-notice',
    title: 'Report Ready & Fee Clearance Notice',
    description: 'Reminds guardians to settle outstanding fee balance alongside report card release.',
    content: 'Dear {{guardian_name}}, {{student_name}}\'s {{term}} report card is ready. Please ensure outstanding fee balance of GH₵ {{fees_balance}} is settled before term reopening on {{reopening_date}}. Thank you.'
  },
  {
    id: 'report-commendation',
    title: 'Academic Performance Commendation',
    description: 'Congratulatory note for top-performing pupils upon report card release.',
    content: 'Dear {{guardian_name}}, congratulations! {{student_name}}\'s {{term}} report card has been generated with commendable effort. {{school_name}} reopens on {{reopening_date}}. Fee balance: GH₵ {{fees_balance}}.'
  }
];

export interface SmsDispatchRecipientResult {
  studentId: string;
  studentName: string;
  guardianName: string;
  guardianPhone: string;
  formattedPhone: string;
  className: string;
  feeBalance: number;
  reportStatus: 'FINALIZED' | 'GRADES_ENTERED' | 'PENDING';
  status: 'ARKESEL_SENT' | 'ARKESEL_FAILED' | 'MISSING_PHONE';
  responseMsg?: string;
}

/**
 * Standardizes phone numbers to Arkesel format (e.g. 233241234567)
 */
export function formatGhanaPhoneNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '233' + cleaned.substring(1);
  }
  if (!cleaned.startsWith('233') && cleaned.length === 9) {
    cleaned = '233' + cleaned;
  }
  return cleaned;
}

/**
 * Interpolates SMS template placeholders for a given student
 */
export function interpolateReportCardTemplate(
  template: string,
  student: Student,
  config: ReportConfig,
  feeBalance: number = 0
): string {
  const schoolName = config.schoolName || 'Eastfield Academy';
  const term = config.term || 'Term 1';
  const academicYear = config.schoolYear || '2025/2026';
  const reopeningDate = config.reopeningDate || 'Next Term';
  const contactPhone = '+233 24 000 0000';

  let result = template;
  result = result.replace(/\{\{\s*guardian_name\s*\}\}/gi, student.guardianName || 'Parent / Guardian');
  result = result.replace(/\{\{\s*student_name\s*\}\}/gi, student.name || 'Pupil');
  result = result.replace(/\{\{\s*class_name\s*\}\}/gi, student.className || 'Class');
  result = result.replace(/\{\{\s*term\s*\}\}/gi, term);
  result = result.replace(/\{\{\s*academic_year\s*\}\}/gi, academicYear);
  result = result.replace(/\{\{\s*school_name\s*\}\}/gi, schoolName);
  result = result.replace(/\{\{\s*fees_balance\s*\}\}/gi, feeBalance.toFixed(2));
  result = result.replace(/\{\{\s*reopening_date\s*\}\}/gi, reopeningDate);
  result = result.replace(/\{\{\s*contact_phone\s*\}\}/gi, contactPhone);

  return result;
}

/**
 * Gets stored Arkesel API credentials from localStorage or defaults
 */
export function getArkeselCredentials(): { apiKey: string; senderId: string } {
  const apiKey = localStorage.getItem('ea_arkesel_api_key') || '';
  const senderId = localStorage.getItem('ea_arkesel_sender_id') || 'EASTFIELD';
  return { apiKey, senderId };
}

/**
 * Saves Arkesel API credentials to localStorage
 */
export function saveArkeselCredentials(apiKey: string, senderId?: string): void {
  if (apiKey !== undefined) {
    localStorage.setItem('ea_arkesel_api_key', apiKey.trim());
  }
  if (senderId !== undefined) {
    localStorage.setItem('ea_arkesel_sender_id', senderId.trim() || 'EASTFIELD');
  }
}

/**
 * Single SMS Dispatcher via Arkesel Gateway
 */
export async function sendArkeselSingleSMS(options: {
  recipientPhone: string;
  message: string;
  apiKey?: string;
  senderId?: string;
}): Promise<{ success: boolean; message: string }> {
  const { apiKey: customKey, senderId: customSender } = getArkeselCredentials();
  const apiKey = (options.apiKey || customKey).trim();
  const senderId = (options.senderId || customSender || 'EASTFIELD').trim();

  if (!apiKey) {
    return {
      success: false,
      message: 'Arkesel API Key is missing. Please configure your Arkesel API Key.'
    };
  }

  const formattedPhone = formatGhanaPhoneNumber(options.recipientPhone);
  if (!formattedPhone || formattedPhone.length < 9) {
    return {
      success: false,
      message: 'Invalid or missing parent phone number.'
    };
  }

  const arkeselPayload = {
    sender: senderId,
    recipients: [formattedPhone],
    message: options.message
  };

  // 1. Try server-side proxy route first
  let response = await fetch('/api/sms/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    body: JSON.stringify(arkeselPayload)
  }).catch(() => null);

  // 2. Fallback to direct client call to Arkesel v2 API
  if (!response || !response.ok) {
    logSmsDispatchAttempt(
      ARKESEL_ENDPOINTS.v2_send,
      'POST',
      { 'Content-Type': 'application/json', 'api-key': apiKey },
      arkeselPayload
    );

    const directV2 = await fetch(ARKESEL_ENDPOINTS.v2_send, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': apiKey
      },
      body: JSON.stringify(arkeselPayload)
    }).catch(() => null);

    if (directV2 && directV2.ok) {
      response = directV2;
    } else if (!response && directV2) {
      response = directV2;
    }
  }

  // 3. Fallback to direct Arkesel v1 GET endpoint
  if (!response || !response.ok) {
    const v1Url = `${ARKESEL_ENDPOINTS.v1_send}?action=send-sms&api_key=${encodeURIComponent(apiKey)}&to=${encodeURIComponent(formattedPhone)}&from=${encodeURIComponent(senderId)}&sms=${encodeURIComponent(options.message)}`;
    logSmsDispatchAttempt(v1Url, 'GET', {});

    const directV1 = await fetch(v1Url, { method: 'GET' }).catch(() => null);
    if (directV1 && directV1.ok) {
      response = directV1;
    }
  }

  const resData = response ? await response.json().catch(() => null) : null;

  const isSuccess = response && response.ok && (
    resData?.status === 'success' ||
    resData?.code === '100' ||
    resData?.code === 100 ||
    resData?.status === 200 ||
    resData?.message?.toLowerCase().includes('success')
  );

  if (isSuccess) {
    return {
      success: true,
      message: resData?.message || `SMS successfully delivered to ${formattedPhone} via Arkesel Gateway`
    };
  } else {
    let errorMsg = 'Arkesel Gateway Error';
    if (response && response.status === 404) {
      errorMsg = handle404EndpointError(ARKESEL_ENDPOINTS.v2_send, 404);
    } else {
      const rawError = resData?.message || resData?.error || resData?.msg || resData?.data;
      if (rawError && typeof rawError === 'string') {
        errorMsg = rawError;
      } else if (response) {
        errorMsg = `Gateway HTTP ${response.status} (Please verify API key and Sender ID)`;
      } else {
        errorMsg = 'Network connection to SMS gateway failed';
      }
    }

    return {
      success: false,
      message: errorMsg
    };
  }
}
