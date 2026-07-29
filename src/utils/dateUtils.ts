/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Formats a reopening date string (e.g. '2026-09-15') into a human-friendly format
 * like '15th September, 2026'. Preserves already-formatted strings.
 */
export function formatReopeningDate(dateStr?: string): string {
  if (!dateStr || !dateStr.trim()) return '15th September, 2026';
  const cleanStr = dateStr.trim();
  
  // YYYY-MM-DD format check
  const ymdMatch = cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10);
    const day = parseInt(ymdMatch[3], 10);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = months[month - 1] || 'September';
    const suffix = (day % 10 === 1 && day !== 11) ? 'st'
      : (day % 10 === 2 && day !== 12) ? 'nd'
      : (day % 10 === 3 && day !== 13) ? 'rd' : 'th';
    return `${day}${suffix} ${monthName}, ${year}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY format check
  const dmyMatch = cleanStr.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10);
    const year = parseInt(dmyMatch[3], 10);
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = months[month - 1] || 'September';
    const suffix = (day % 10 === 1 && day !== 11) ? 'st'
      : (day % 10 === 2 && day !== 12) ? 'nd'
      : (day % 10 === 3 && day !== 13) ? 'rd' : 'th';
    return `${day}${suffix} ${monthName}, ${year}`;
  }
  
  return cleanStr;
}
