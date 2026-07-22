import { Student, ReportConfig } from '../types';

export interface EmailDispatchOptions {
  student: Student;
  config: ReportConfig;
  stats?: {
    totalScore?: number;
    averageScore?: number;
    classRank?: number;
    totalStudents?: number;
    attendanceSummary?: string;
  };
  customNote?: string;
}

export interface BatchDispatchStatus {
  studentId: string;
  studentName: string;
  guardianEmail: string;
  guardianPhone?: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'SKIPPED';
  sentAt?: string;
  errorMessage?: string;
}

/**
 * Generates structured email report card content for a student guardian.
 */
export function generateEmailReportBody(options: EmailDispatchOptions): string {
  const { student, config, stats, customNote } = options;
  const guardianName = student.guardianName || 'Parent / Guardian';
  const schoolName = config.schoolName || 'Excel Academy';
  const term = config.term || 'Term 1';
  const schoolYear = config.schoolYear || '2025/2026';
  const principal = config.principalName || 'Head Administrator';

  let body = `Dear ${guardianName},\n\n`;
  body += `We are pleased to send you the official Softcopy Academic Report Card for your ward, ${student.name} (Roll No: ${student.rollNumber}, Class: ${student.className}), for ${term} - ${schoolYear} at ${schoolName}.\n\n`;

  body += `--------------------------------------------------\n`;
  body += `📊 ACADEMIC PERFORMANCE SUMMARY\n`;
  body += `--------------------------------------------------\n`;

  if (stats) {
    if (stats.totalScore !== undefined) {
      body += `• Cumulative Score: ${stats.totalScore.toFixed(1)}\n`;
    }
    if (stats.averageScore !== undefined) {
      body += `• Academic Average: ${stats.averageScore.toFixed(1)}%\n`;
    }
    if (stats.classRank && stats.totalStudents) {
      body += `• Class Rank: Position ${stats.classRank} out of ${stats.totalStudents} pupils\n`;
    }
    if (stats.attendanceSummary) {
      body += `• Attendance: ${stats.attendanceSummary}\n`;
    }
  } else {
    body += `• Term: ${term} (${schoolYear})\n`;
    body += `• Pupil Level: ${student.level}\n`;
  }

  body += `\n`;

  if (customNote) {
    body += `📝 Note from School Administration:\n"${customNote}"\n\n`;
  }

  body += `📎 ATTACHMENT INSTRUCTIONS:\n`;
  body += `Please view or save the attached softcopy PDF report file for detailed subject breakdowns, teacher remarks, grading scales, and official administration signatures.\n\n`;

  body += `Thank you for your continued support in ${student.name}'s educational journey.\n\n`;
  body += `Warm regards,\n`;
  body += `${principal}\n`;
  body += `${schoolName}\n`;

  return body;
}

/**
 * Constructs a mailto link populated with guardian email, subject, and report body.
 */
export function constructMailtoLink(options: EmailDispatchOptions): string {
  const { student, config } = options;
  const guardianEmail = student.guardianEmail || '';
  const term = config.term || 'Term 1';
  const schoolYear = config.schoolYear || '2025/2026';
  
  const subject = encodeURIComponent(`Academic Softcopy Report: ${student.name} - ${term} ${schoolYear}`);
  const body = encodeURIComponent(generateEmailReportBody(options));

  return `mailto:${guardianEmail}?subject=${subject}&body=${body}`;
}

/**
 * Triggers default mail composer with populated email options.
 */
export function sendGuardianEmail(options: EmailDispatchOptions): boolean {
  try {
    const link = constructMailtoLink(options);
    window.open(link, '_blank');
    return true;
  } catch (error) {
    console.error('Failed to trigger email dispatcher:', error);
    return false;
  }
}

/**
 * Constructs WhatsApp dispatch link for student's guardian.
 */
export function constructWhatsAppLink(options: EmailDispatchOptions): string {
  const { student } = options;
  const rawPhone = (student.guardianPhone || '').replace(/[^0-9]/g, '');
  const text = encodeURIComponent(generateEmailReportBody(options));
  
  if (rawPhone) {
    return `https://wa.me/${rawPhone}?text=${text}`;
  }
  return `https://wa.me/?text=${text}`;
}

/**
 * Triggers WhatsApp dispatch with populated message.
 */
export function sendWhatsAppReport(options: EmailDispatchOptions): boolean {
  try {
    const url = constructWhatsAppLink(options);
    window.open(url, '_blank');
    return true;
  } catch (error) {
    console.error('Failed to open WhatsApp dispatcher:', error);
    return false;
  }
}

/**
 * Creates batch email dispatch items for an entire class or student list.
 */
export function createBatchEmailDispatchList(
  students: Student[],
  config: ReportConfig,
  getStudentStats?: (studentId: string) => { totalScore?: number; averageScore?: number; classRank?: number; totalStudents?: number; attendanceSummary?: string },
  customNote?: string
): { student: Student; mailtoUrl: string; whatsAppUrl: string; emailBody: string; hasEmail: boolean; hasPhone: boolean }[] {
  return students.map(student => {
    const stats = getStudentStats ? getStudentStats(student.id) : undefined;
    const options: EmailDispatchOptions = { student, config, stats, customNote };
    
    return {
      student,
      mailtoUrl: constructMailtoLink(options),
      whatsAppUrl: constructWhatsAppLink(options),
      emailBody: generateEmailReportBody(options),
      hasEmail: Boolean(student.guardianEmail && student.guardianEmail.includes('@')),
      hasPhone: Boolean(student.guardianPhone && student.guardianPhone.trim().length > 5)
    };
  });
}

/**
 * Generates a combined text digest containing formatted emails for all parents in a class/school.
 */
export function generateBatchEmailDigest(
  students: Student[],
  config: ReportConfig,
  getStudentStats?: (studentId: string) => { totalScore?: number; averageScore?: number; classRank?: number; totalStudents?: number; attendanceSummary?: string },
  customNote?: string
): string {
  const items = createBatchEmailDispatchList(students, config, getStudentStats, customNote);
  const dateStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  
  let digest = `========================================================================\n`;
  digest += `OFFICIAL AUTOMATED ACADEMIC REPORT DISPATCH DIGEST\n`;
  digest += `School: ${config.schoolName || 'Excel Academy'}\n`;
  digest += `Term: ${config.term || 'Term 1'} (${config.schoolYear || '2025/2026'})\n`;
  digest += `Generated Date: ${dateStr}\n`;
  digest += `Total Pupils: ${students.length}\n`;
  digest += `========================================================================\n\n`;

  items.forEach((item, index) => {
    digest += `--- [GUARDIAN MESSAGE #${index + 1} | ${item.student.name.toUpperCase()}] ---\n`;
    digest += `Recipient Guardian Email: ${item.student.guardianEmail || 'NONE STORED'}\n`;
    digest += `Recipient Guardian Phone: ${item.student.guardianPhone || 'NONE STORED'}\n\n`;
    digest += item.emailBody;
    digest += `\n========================================================================\n\n`;
  });

  return digest;
}

