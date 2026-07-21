/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, Subject, User, GradingScaleRule, ReportConfig, Grade, Attendance } from '../types';

export const INITIAL_CLASSES = {
  NURSERY: ['Nursery 1', 'Nursery 2', 'Kindergarten 1', 'Kindergarten 2'],
  PRIMARY: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'],
  JHS: ['JHS 1', 'JHS 2', 'JHS 3']
};

export const INITIAL_SUBJECTS: Subject[] = [
  // Nursery
  { id: 'sub-n-env', name: 'OWOP', code: 'OWOP', level: 'NURSERY' },
  { id: 'sub-n-lit', name: 'LITERACY', code: 'LIT', level: 'NURSERY' },
  { id: 'sub-n-num', name: 'NUMERACY', code: 'NUM', level: 'NURSERY' },
  { id: 'sub-n-cr', name: 'CREATIVITY', code: 'CRT', level: 'NURSERY' },
  { id: 'sub-n-wri', name: 'WRITING', code: 'WRI', level: 'NURSERY' },

  // Primary
  { id: 'sub-p-eng', name: 'English language', code: 'ENG', level: 'PRIMARY' },
  { id: 'sub-p-math', name: 'Mathematics', code: 'MAT', level: 'PRIMARY' },
  { id: 'sub-p-sci', name: 'Science', code: 'SCI', level: 'PRIMARY' },
  { id: 'sub-p-his', name: 'History', code: 'HIS', level: 'PRIMARY' },
  { id: 'sub-p-rme', name: 'Religious and Moral Education', code: 'RME', level: 'PRIMARY' },
  { id: 'sub-p-gh', name: 'Akuapem Twi', code: 'TWI', level: 'PRIMARY' },
  { id: 'sub-p-art', name: 'Creative Arts', code: 'ART', level: 'PRIMARY' },
  { id: 'sub-p-soc', name: 'Our World Our People', code: 'OWOP', level: 'PRIMARY' },
  { id: 'sub-p-ict', name: 'Computing', code: 'COMP', level: 'PRIMARY' },
  { id: 'sub-p-fr', name: 'French', code: 'FRE', level: 'PRIMARY' },

  // JHS
  { id: 'sub-j-eng', name: 'English language', code: 'ENG', level: 'JHS' },
  { id: 'sub-j-math', name: 'Mathematics', code: 'MAT', level: 'JHS' },
  { id: 'sub-j-sci', name: 'Science', code: 'SCI', level: 'JHS' },
  { id: 'sub-j-soc', name: 'Social Studies', code: 'SOC', level: 'JHS' },
  { id: 'sub-j-car', name: 'Career Technology', code: 'CAR', level: 'JHS' },
  { id: 'sub-j-rme', name: 'Religious and Moral Education', code: 'RME', level: 'JHS' },
  { id: 'sub-j-gh', name: 'Akuapem Twi', code: 'TWI', level: 'JHS' },
  { id: 'sub-j-ca', name: 'Creative Arts and Design', code: 'CAD', level: 'JHS' },
  { id: 'sub-j-fr', name: 'French', code: 'FRE', level: 'JHS' },
  { id: 'sub-j-ict', name: 'Computing', code: 'COMP', level: 'JHS' }
];

export const INITIAL_STUDENTS: Student[] = [
  { id: "st-101", name: "Kwame Asante", rollNumber: "ST-001", level: "PRIMARY", className: "Primary 1", guardianName: "Emmanuel Asante", guardianEmail: "emmanuel@asante.com" },
  { id: "st-102", name: "Ama Boateng", rollNumber: "ST-002", level: "PRIMARY", className: "Primary 1", guardianName: "Kofi Boateng", guardianEmail: "kofi@boateng.com" },
  { id: "st-103", name: "Kofi Mensah", rollNumber: "ST-003", level: "JHS", className: "JHS 1", guardianName: "Yao Mensah", guardianEmail: "yao@mensah.com" },
  { id: "st-104", name: "Yaa Asantewaa", rollNumber: "ST-004", level: "JHS", className: "JHS 1", guardianName: "Maame Asantewaa", guardianEmail: "maame@asantewaa.com" },
  { id: "st-105", name: "Abena Osei", rollNumber: "ST-005", level: "NURSERY", className: "Nursery 1", guardianName: "Charles Osei", guardianEmail: "charles@osei.com" }
];

export const INITIAL_GRADING_SCALE: GradingScaleRule[] = [
  { grade: 'A1', minScore: 80, maxScore: 100, gpa: 4.0, remarks: 'HIGHEST' },
  { grade: 'B2', minScore: 70, maxScore: 79.9, gpa: 3.5, remarks: 'HIGHER' },
  { grade: 'B3', minScore: 60, maxScore: 69.9, gpa: 3.0, remarks: 'HIGH' },
  { grade: 'C4', minScore: 55, maxScore: 59.9, gpa: 2.5, remarks: 'HIGH AVERAGE' },
  { grade: 'C5', minScore: 50, maxScore: 54.9, gpa: 2.0, remarks: 'AVERAGE' },
  { grade: 'C6', minScore: 40, maxScore: 49.9, gpa: 1.5, remarks: 'LOW AVERAGE' },
  { grade: 'D7', minScore: 30, maxScore: 39.9, gpa: 1.0, remarks: 'LOW' },
  { grade: 'E8', minScore: 20, maxScore: 29.9, gpa: 0.5, remarks: 'LOWER' },
  { grade: 'F9', minScore: 0, maxScore: 19.9, gpa: 0.0, remarks: 'LOWEST' }
];

export const DEFAULT_REPORT_CONFIG: ReportConfig = {
  schoolName: 'Eastfield Academy',
  schoolYear: '2025/2026',
  term: 'Term 1',
  gradingScale: INITIAL_GRADING_SCALE,
  principalName: 'Dr. Evelyn Asare-Bediako',
  schoolLogoText: 'EA',
  classScoreWeight: 50, // 50% Class Score
  examScoreWeight: 50,  // 50% Terminal Exams
  selectedTemplate: 'dynamic'
};

export const INITIAL_USERS: User[] = [
  { id: "tch-01", name: "Kojo Mensah (Nursery)", email: "nursery@eastfield.com", role: "TEACHER", password: "password123", level: "NURSERY", classes: ["Nursery 1", "Nursery 2"], subjects: ["sub-n-lit", "sub-n-num"] },
  { id: "tch-02", name: "Ama Serwaa (Primary)", email: "primary@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 1", "Primary 2"], subjects: ["sub-p-math", "sub-p-eng"] },
  { id: "tch-03", name: "Kwesi Appiah (JHS)", email: "jhs@eastfield.com", role: "TEACHER", password: "password123", level: "JHS", classes: ["JHS 1", "JHS 2"], subjects: ["sub-j-math", "sub-j-sci"] }
];

export const INITIAL_GRADES: Grade[] = [
  { studentId: "st-101", subjectId: "sub-p-eng", classScore: 25, examScore: 60, totalScore: 85, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-02", updatedAt: new Date().toISOString() },
  { studentId: "st-101", subjectId: "sub-p-math", classScore: 20, examScore: 55, totalScore: 75, gradeLetter: "B2", remarks: "VERY GOOD", term: "Term 1", year: "2025/2026", teacherId: "tch-02", updatedAt: new Date().toISOString() },
  { studentId: "st-102", subjectId: "sub-p-eng", classScore: 22, examScore: 50, totalScore: 72, gradeLetter: "B2", remarks: "VERY GOOD", term: "Term 1", year: "2025/2026", teacherId: "tch-02", updatedAt: new Date().toISOString() },
  { studentId: "st-103", subjectId: "sub-j-math", classScore: 28, examScore: 65, totalScore: 93, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-03", updatedAt: new Date().toISOString() }
];

export const INITIAL_ATTENDANCE: Attendance[] = [
  { studentId: "st-101", term: "Term 1", year: "2025/2026", totalDays: 70, daysPresent: 68, remarks: "Very regular and punctual. Keep it up!", teacherId: "tch-02", updatedAt: new Date().toISOString() },
  { studentId: "st-102", term: "Term 1", year: "2025/2026", totalDays: 70, daysPresent: 62, remarks: "Good attendance. Well done.", teacherId: "tch-02", updatedAt: new Date().toISOString() },
  { studentId: "st-103", term: "Term 1", year: "2025/2026", totalDays: 70, daysPresent: 70, remarks: "Perfect attendance score!", teacherId: "tch-03", updatedAt: new Date().toISOString() }
];
