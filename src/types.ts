/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CustomInventoryItem {
  id?: string;
  name: string;
  quantity: number;
}

export interface ClassroomInventoryRecord {
  id: string;
  locationName: string; // e.g., 'Primary 1', 'Staff Room', 'Main Yard'
  category: 'Classroom' | 'Administrative' | 'Facility' | 'Transport' | 'Kitchen' | 'Other';
  studentChairs: number;
  studentTables: number;
  textbooks: number;
  washrooms: number;
  sinks: number;
  buses: number;
  teacherChairs: number;
  teacherTables: number;
  computers?: number;
  projectors?: number;
  wallCharts?: number;
  customItems?: CustomInventoryItem[];
  notes?: string;
  updatedAt: string;
}

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
  dateOfBirth?: string;
  phoneNumber?: string;
  qualification?: string;
  profilePicture?: string;
  hometown?: string;
  ghanaCardNumber?: string;
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
  photoUrl?: string; // Passport size photograph URL/Base64
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

export type DailyAttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface DailyAttendanceRecord {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  status: DailyAttendanceStatus;
  term: string;
  year: string;
  teacherId: string;
  notes?: string;
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
  promotionUndoneYear?: string; // e.g., '2025/2026'
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
  updatedAt?: string;
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

export interface JHSMockExamRecord {
  id: string;
  studentId: string;
  studentName: string;
  rollNumber: string;
  className: string;
  examTitle: string;
  academicYear: string;
  scores: {
    [subjectKey: string]: number;
  };
  remarks?: string;
  updatedAt: string;
  updatedBy?: string;
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

export type BookStockCategory = 'Textbook' | 'Customised Exercise Book' | 'Customised Textbook';

export interface BookStockItem {
  id: string;
  title: string;
  category: BookStockCategory;
  publication: string;
  subjectType: string;
  targetClass: string;
  unitPrice: number;
  costPrice?: number;
  quantityInStock: number;
  quantitySold: number;
  quantityRemaining: number;
  lowStockThreshold: number;
  shelfLocation?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface BookSaleItem {
  bookId: string;
  title: string;
  category: BookStockCategory;
  publication: string;
  subjectType: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface BookSaleRecord {
  id: string;
  receiptNumber: string;
  buyerName: string;
  buyerType: 'Student' | 'Parent' | 'Teacher' | 'Walk-in / Other';
  studentId?: string;
  className?: string;
  contactNumber?: string;
  items: BookSaleItem[];
  subtotal: number;
  discount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  paymentReference?: string;
  saleDate: string; // YYYY-MM-DD
  saleTime: string; // HH:mm
  recordedBy: string;
  remarks?: string;
  createdAt: string;
  updatedAt?: string;
}
