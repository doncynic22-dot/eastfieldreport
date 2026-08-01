/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'ADMIN' | 'TEACHER';

export type AcademicLevel = 'NURSERY' | 'KINDERGARTEN' | 'PRIMARY' | 'JHS';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  password?: string;
  // For teachers:
  level?: AcademicLevel;
  subjects?: string[]; // JHS teachers strictly have at most 2 subjects
  classes?: string[];  // Classes they are registered to teach
}

export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  level: AcademicLevel;
  className: string; // e.g., 'Primary 1', 'JHS 2', 'Nursery 1'
  guardianName: string;
  guardianEmail: string;
  guardianPhone?: string;
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  level: AcademicLevel;
}

export interface Grade {
  studentId: string;
  subjectId: string;
  classScore: number; // typically out of 30 or 50
  examScore: number;  // typically out of 70 or 50
  totalScore: number; // sum, automatically graded
  gradeLetter: string;
  remarks: string;
  nurseryRemark?: 'MO' | 'O' | 'S' | 'NA';
  term: string;       // e.g., 'Term 1'
  year: string;       // e.g., '2025/2026'
  teacherId: string;
  updatedAt: string;
}

export interface Attendance {
  studentId: string;
  term: string;
  year: string;
  totalDays: number;
  daysPresent: number;
  remarks: string;
  teacherId: string;
  updatedAt: string;
}

export interface StudentBill {
  studentId: string;
  arrears: string;
  tuition: string;
  computing: string;
  utility: string;
  stationery: string;
  pta: string;
  reopeningDate?: string;
  contactNumber?: string;
  term?: string;
  year?: string;
  updatedAt?: string;
}

export interface GradingScaleRule {
  grade: string;
  minScore: number;
  maxScore: number;
  gpa: number;
  remarks: string;
}

export interface ReportConfig {
  schoolName: string;
  schoolYear: string;
  term: string;
  gradingScale: GradingScaleRule[];
  principalName: string;
  principalSignatureUrl?: string;
  schoolLogoText?: string;
  schoolLogoUrl?: string;
  classScoreWeight: number; // e.g., 50 for 50%
  examScoreWeight: number;  // e.g., 50 for 50%
  selectedTemplate?: string; // 'dynamic' | 'compact' | 'high-fidelity' | 'classic'
  reopeningDate?: string; // e.g., '2026-09-15'
  lastPromotedYear?: string; // e.g., '2026/2027'
  lastPromotionDate?: string;
  prePromotionSnapshot?: Student[];
  autoPromoteOnReopening?: boolean;
  schoolMotto?: string;
  customNoticeNote?: string;
  showPositionInClass?: boolean;
  showConductColumn?: boolean;
  showAttendanceSection?: boolean;
  accentColor?: string;
  watermarkText?: string;
}

export type FeeTypeCategory =
  | 'School Fees'
  | 'Feeding Fee'
  | 'Bus Fee'
  | 'Studies Fee'
  | 'Printing/Exam Fee'
  | 'Uniform Purchase Fee'
  | 'Mock Examination Fee'
  | string;

export type PaymentMethod = 'Cash' | 'Mobile Money' | 'Bank Transfer' | 'Cheque' | 'POS/Card';

export type PaymentStatus = 'Paid' | 'Partial' | 'Pending';

export interface FeePayment {
  id: string;
  receiptNumber: string;
  studentId: string;
  studentName: string;
  className: string;
  feeType: FeeTypeCategory;
  amountPaid: number;
  totalFeeAmount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  status: PaymentStatus;
  remarks?: string;
  recordedBy?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface FeeStructureItem {
  id: string;
  level: AcademicLevel | string;
  tuition: number;
  computing: number;
  utility: number;
  stationery: number;
  pta: number;
  uniform?: number;
  mockExam?: number;
  term: string;
  year: string;
  updatedAt?: string;
}

export interface DailyCollectionSummary {
  id: string;
  collectionDate: string;
  totalCash: number;
  totalMomo: number;
  totalBank: number;
  totalCheque: number;
  totalCollected: number;
  recordedBy: string;
  updatedAt?: string;
}

export interface SyncAuditLog {
  id: string;
  actionType: string;
  description: string;
  performedBy: string;
  status: 'SUCCESS' | 'FAILED' | 'PENDING';
  details?: string;
  timestamp: string;
  updatedAt?: string;
}
