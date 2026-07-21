/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'ADMIN' | 'TEACHER';

export type AcademicLevel = 'NURSERY' | 'PRIMARY' | 'JHS';

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
  classScoreWeight: number; // e.g., 30 for 30%
  examScoreWeight: number;  // e.g., 70 for 70%
  selectedTemplate?: string; // 'dynamic' | 'compact' | 'high-fidelity' | 'classic'
}
