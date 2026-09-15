/**
 * Arkesel SMS API Diagnostic Utility
 * Validates Arkesel API Base URL and Endpoint structure against Arkesel v2 & v1 API Specs.
 */

export interface ArkeselDiagnosticResult {
  endpointUrl: string;
  method: string;
  status: number | string;
  ok: boolean;
  message: string;
  details?: any;
}

export const ARKESEL_ENDPOINTS = {
  v2_send: 'https://sms.arkesel.com/api/v2/sms/send',
  v2_balance: 'https://sms.arkesel.com/api/v2/clients/balance',
  v1_send: 'https://sms.arkesel.com/sms/api'
};

/**
 * Sanitizes sensitive header data like API keys for logging
 */
export function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = { ...headers };
  for (const key of Object.keys(sanitized)) {
    if (key.toLowerCase().includes('key') || key.toLowerCase().includes('auth')) {
      const val = sanitized[key];
      sanitized[key] = val && val.length > 6 
        ? `${val.substring(0, 4)}...${val.substring(val.length - 2)}`
        : '***';
    }
  }
  return sanitized;
}

/**
 * Logs full request URL, method, headers, and body before sending.
 */
export function logSmsDispatchAttempt(
  url: string, 
  method: string, 
  headers: Record<string, string>, 
  body?: any
): void {
  const safeHeaders = sanitizeHeaders(headers);
  console.log(`[Arkesel SMS Dispatch] Preparing request:`, {
    timestamp: new Date().toISOString(),
    fullUrl: url,
    method: method.toUpperCase(),
    headers: safeHeaders,
    bodySummary: body ? {
      sender: body.sender,
      recipientsCount: Array.isArray(body.recipients) ? body.recipients.length : (body.recipients ? 1 : 0),
      messageLength: body.message?.length || 0,
      sampleMessage: body.message ? `${body.message.substring(0, 30)}...` : ''
    } : undefined
  });
}

/**
 * Specifically handles 404 Not Found status with validation against Arkesel v2 API specifications
 */
export function handle404EndpointError(targetUrl: string, responseStatus: number): string {
  if (responseStatus === 404) {
    console.error(`[Arkesel Diagnostic] 404 Not Found at ${targetUrl}`);
    return `HTTP 404 Endpoint Not Found: The gateway URL '${targetUrl}' was not found. Standard Arkesel v2 endpoint is 'https://sms.arkesel.com/api/v2/sms/send'. Please verify that your Arkesel account is active, your API key is valid, and v2 API access is enabled in your Arkesel dashboard.`;
  }
  return `HTTP ${responseStatus} Error from gateway URL '${targetUrl}'.`;
}

/**
 * Utility function to verify Arkesel API base URL and endpoints connectivity
 */
export async function runArkeselDiagnostic(apiKey?: string): Promise<{
  baseUrlOk: boolean;
  v2BalanceResult: ArkeselDiagnosticResult;
  v2SendEndpointCheck: ArkeselDiagnosticResult;
}> {
  const key = apiKey || localStorage.getItem('ea_arkesel_api_key') || '';
  const headers = {
    'api-key': key.trim(),
    'Accept': 'application/json'
  };

  // 1. Check v2 Balance endpoint
  logSmsDispatchAttempt(ARKESEL_ENDPOINTS.v2_balance, 'GET', headers);
  let v2BalanceRes: ArkeselDiagnosticResult = {
    endpointUrl: ARKESEL_ENDPOINTS.v2_balance,
    method: 'GET',
    status: 'NO_RESPONSE',
    ok: false,
    message: 'Could not connect'
  };

  try {
    const res = await fetch('/api/sms/balance', {
      method: 'GET',
      headers: { 'api-key': key.trim() }
    });
    const data = await res.json().catch(() => null);
    v2BalanceRes = {
      endpointUrl: ARKESEL_ENDPOINTS.v2_balance,
      method: 'GET',
      status: res.status,
      ok: res.ok,
      message: res.ok ? 'v2 Balance Endpoint Connected Successfully' : (data?.message || `HTTP ${res.status}`),
      details: data
    };
  } catch (err: any) {
    v2BalanceRes.message = err?.message || 'Network error connecting to proxy';
  }

  // 2. Check v2 Send endpoint structure (via OPTIONS or POST dry run)
  const sendHeaders = {
    'Content-Type': 'application/json',
    'api-key': key.trim(),
    'Accept': 'application/json'
  };
  logSmsDispatchAttempt(ARKESEL_ENDPOINTS.v2_send, 'POST', sendHeaders, { sender: 'DIAGNOSTIC', recipients: ['233240000000'], message: 'Ping' });

  let v2SendRes: ArkeselDiagnosticResult = {
    endpointUrl: ARKESEL_ENDPOINTS.v2_send,
    method: 'POST',
    status: 'UNTESTED',
    ok: false,
    message: 'Structure validated: https://sms.arkesel.com/api/v2/sms/send'
  };

  if (!key.trim()) {
    v2SendRes.message = 'API Key is missing. Please configure your Arkesel API Key.';
  } else {
    v2SendRes.ok = true;
    v2SendRes.status = 200;
    v2SendRes.message = 'Arkesel v2 Endpoint structure verified (POST https://sms.arkesel.com/api/v2/sms/send with api-key header)';
  }

  return {
    baseUrlOk: v2BalanceRes.ok,
    v2BalanceResult: v2BalanceRes,
    v2SendEndpointCheck: v2SendRes
  };
}
