/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, Subject, User, GradingScaleRule, ReportConfig, Grade, Attendance, FeePayment, ClassroomInventoryRecord } from '../types';

export const INITIAL_CLASSES = {
  NURSERY: ['Nursery 1', 'Nursery 2'],
  KINDERGARTEN: ['Kindergarten 1', 'Kindergarten 2'],
  PRIMARY: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'],
  JHS: ['JHS 1', 'JHS 2', 'JHS 3']
};

export const INITIAL_SUBJECTS: Subject[] = [
  // Nursery
  { id: 'sub-n-cr', name: 'CREATIVITY', code: 'CRT', level: 'NURSERY' },
  { id: 'sub-n-lit', name: 'LITERACY / LANGUAGE', code: 'LIT', level: 'NURSERY' },
  { id: 'sub-n-num', name: 'NUMERACY', code: 'NUM', level: 'NURSERY' },
  { id: 'sub-n-pho', name: 'PHONICS', code: 'PHO', level: 'NURSERY' },
  { id: 'sub-n-psy', name: 'PSYCHOMOTOR SKILLS', code: 'PSY', level: 'NURSERY' },

  // Kindergarten
  { id: 'sub-k-lit', name: 'LITERACY / LANGUAGE', code: 'LIT', level: 'KINDERGARTEN' },
  { id: 'sub-k-num', name: 'NUMERACY', code: 'NUM', level: 'KINDERGARTEN' },
  { id: 'sub-k-owop', name: 'OUR WORLD OUR PEOPLE', code: 'OWOP', level: 'KINDERGARTEN' },
  { id: 'sub-k-ca', name: 'CREATIVE ARTS', code: 'CA', level: 'KINDERGARTEN' },
  { id: 'sub-k-wrt', name: 'WRITING', code: 'WRT', level: 'KINDERGARTEN' },

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
  { id: "st-101", name: "Kwame Asante", rollNumber: "ST-001", level: "PRIMARY", className: "Primary 1", guardianName: "Emmanuel Asante", guardianEmail: "emmanuel@asante.com", guardianPhone: "+233241234567" },
  { id: "st-102", name: "Ama Boateng", rollNumber: "ST-002", level: "PRIMARY", className: "Primary 1", guardianName: "Kofi Boateng", guardianEmail: "kofi@boateng.com", guardianPhone: "+233501234567" },
  { id: "st-103", name: "Kofi Mensah", rollNumber: "ST-003", level: "JHS", className: "JHS 1", guardianName: "Yao Mensah", guardianEmail: "yao@mensah.com", guardianPhone: "+233271234567" },
  { id: "st-104", name: "Yaa Asantewaa", rollNumber: "ST-004", level: "JHS", className: "JHS 1", guardianName: "Maame Asantewaa", guardianEmail: "maame@asantewaa.com", guardianPhone: "+233201234567" },
  { id: "st-105", name: "Abena Osei", rollNumber: "ST-005", level: "NURSERY", className: "Nursery 1", guardianName: "Charles Osei", guardianEmail: "charles@osei.com", guardianPhone: "+233551234567" },
  { id: "st-106", name: "Yaw Ofori", rollNumber: "ST-006", level: "KINDERGARTEN", className: "Kindergarten 1", guardianName: "Seth Ofori", guardianEmail: "seth@ofori.com", guardianPhone: "+233241112233" },
  { id: "st-107", name: "Ebenezer Osei-Kofi", rollNumber: "ST-007", level: "JHS", className: "JHS 2", guardianName: "Daniel Osei-Kofi", guardianEmail: "daniel@osei-kofi.com", guardianPhone: "+233249876543" },
  { id: "st-108", name: "Akosua Mansah", rollNumber: "ST-008", level: "JHS", className: "JHS 2", guardianName: "Grace Mansah", guardianEmail: "grace@mansah.com", guardianPhone: "+233509876543" },
  { id: "st-109", name: "Aboagye Messiah", rollNumber: "ST-009", level: "JHS", className: "JHS 1", guardianName: "Mr. Aboagye", guardianEmail: "aboagye@eastfield.com", guardianPhone: "+233241234568" },
  { id: "st-110", name: "Kofi Badu", rollNumber: "ST-010", level: "NURSERY", className: "Nursery 1", guardianName: "Kwaku Badu", guardianEmail: "badu@eastfield.com", guardianPhone: "+233241230001" },
  { id: "st-111", name: "Adwoa Saah", rollNumber: "ST-011", level: "NURSERY", className: "Nursery 2", guardianName: "Madam Saah", guardianEmail: "saah@eastfield.com", guardianPhone: "+233241230002" },
  { id: "st-112", name: "Kwaku Ananse", rollNumber: "ST-012", level: "NURSERY", className: "Nursery 2", guardianName: "Poku Ananse", guardianEmail: "ananse@eastfield.com", guardianPhone: "+233241230003" },
  { id: "st-113", name: "Efya Pokua", rollNumber: "ST-013", level: "KINDERGARTEN", className: "Kindergarten 1", guardianName: "Osei Poku", guardianEmail: "poku@eastfield.com", guardianPhone: "+233241230004" },
  { id: "st-114", name: "Kwadwo Sheldon", rollNumber: "ST-014", level: "KINDERGARTEN", className: "Kindergarten 2", guardianName: "Samuel Sheldon", guardianEmail: "sheldon@eastfield.com", guardianPhone: "+233241230005" },
  { id: "st-115", name: "Akua Donkor", rollNumber: "ST-015", level: "KINDERGARTEN", className: "Kindergarten 2", guardianName: "Isaac Donkor", guardianEmail: "donkor@eastfield.com", guardianPhone: "+233241230006" }
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
  selectedTemplate: 'dynamic',
  reopeningDate: '2026-09-15',
  autoPromoteOnReopening: true,
  schoolMotto: 'Knowledge, Character & Excellence',
  customNoticeNote: '',
  showPositionInClass: true,
  showConductColumn: true,
  showAttendanceSection: true,
  accentColor: '#1e1b4b',
  watermarkText: 'EASTFIELD ACADEMY'
};

export const INITIAL_USERS: User[] = [
  // Nursery
  { id: "tch-01", name: "Kojo Mensah (Nursery 1)", email: "nursery@eastfield.com", role: "TEACHER", password: "password123", level: "NURSERY", classes: ["Nursery 1"], subjects: ["sub-n-lit", "sub-n-num"] },
  { id: "tch-n2", name: "Esi Agyeman (Nursery 2)", email: "nursery2@eastfield.com", role: "TEACHER", password: "password123", level: "NURSERY", classes: ["Nursery 2"], subjects: ["sub-n-cr", "sub-n-pho"] },
  // Kindergarten
  { id: "tch-k1", name: "Akosua Boakye (KG 1)", email: "kg1@eastfield.com", role: "TEACHER", password: "password123", level: "KINDERGARTEN", classes: ["Kindergarten 1"], subjects: ["sub-k-lit", "sub-k-num"] },
  { id: "tch-k2", name: "Kofi Osei (KG 2)", email: "kg2@eastfield.com", role: "TEACHER", password: "password123", level: "KINDERGARTEN", classes: ["Kindergarten 2"], subjects: ["sub-k-owop", "sub-k-ca"] },
  // Primary
  { id: "tch-02", name: "Ama Serwaa (Primary 1)", email: "primary@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 1"], subjects: ["sub-p-math", "sub-p-eng"] },
  { id: "tch-p2", name: "Kwame Nkrumah (Primary 2)", email: "primary2@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 2"], subjects: ["sub-p-math", "sub-p-eng"] },
  { id: "tch-p3", name: "Abena Darko (Primary 3)", email: "primary3@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 3"], subjects: ["sub-p-math", "sub-p-sci"] },
  { id: "tch-p4", name: "Yaa Asantewaa (Primary 4)", email: "primary4@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 4"], subjects: ["sub-p-eng", "sub-p-soc"] },
  { id: "tch-p5", name: "Kofi Addo (Primary 5)", email: "primary5@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 5"], subjects: ["sub-p-math", "sub-p-rme"] },
  { id: "tch-p6", name: "Adwoa Mansa (Primary 6)", email: "primary6@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 6"], subjects: ["sub-p-eng", "sub-p-ict"] },
  // JHS (Unassigned initially so Admin can assign each class teacher)
  { id: "tch-03", name: "Kwesi Appiah", email: "jhs@eastfield.com", role: "TEACHER", password: "password123", level: "JHS", classes: [], subjects: ["sub-j-math", "sub-j-ca"] },
  { id: "tch-04", name: "Abena Gyamfi", email: "jhs2@eastfield.com", role: "TEACHER", password: "password123", level: "JHS", classes: [], subjects: ["sub-j-eng", "sub-j-sci"] },
  { id: "tch-05", name: "Yaw Asamoah", email: "jhs3@eastfield.com", role: "TEACHER", password: "password123", level: "JHS", classes: [], subjects: ["sub-j-soc", "sub-j-rme"] }
];

export const INITIAL_GRADES: Grade[] = [
  { studentId: "st-101", subjectId: "sub-p-eng", classScore: 25, examScore: 60, totalScore: 85, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-02", updatedAt: new Date().toISOString() },
  { studentId: "st-101", subjectId: "sub-p-math", classScore: 20, examScore: 55, totalScore: 75, gradeLetter: "B2", remarks: "VERY GOOD", term: "Term 1", year: "2025/2026", teacherId: "tch-02", updatedAt: new Date().toISOString() },
  { studentId: "st-102", subjectId: "sub-p-eng", classScore: 22, examScore: 50, totalScore: 72, gradeLetter: "B2", remarks: "VERY GOOD", term: "Term 1", year: "2025/2026", teacherId: "tch-02", updatedAt: new Date().toISOString() },
  { studentId: "st-103", subjectId: "sub-j-math", classScore: 28, examScore: 65, totalScore: 93, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-03", updatedAt: new Date().toISOString() },
  { studentId: "st-103", subjectId: "sub-j-ca", classScore: 41, examScore: 44, totalScore: 85, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-03", updatedAt: new Date().toISOString() },
  { studentId: "st-104", subjectId: "sub-j-ca", classScore: 39, examScore: 42, totalScore: 81, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-03", updatedAt: new Date().toISOString() },
  { studentId: "st-107", subjectId: "sub-j-ca", classScore: 42, examScore: 45, totalScore: 87, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-03", updatedAt: new Date().toISOString() },
  { studentId: "st-108", subjectId: "sub-j-ca", classScore: 38, examScore: 40, totalScore: 78, gradeLetter: "B2", remarks: "VERY GOOD", term: "Term 1", year: "2025/2026", teacherId: "tch-03", updatedAt: new Date().toISOString() },
  // Restored grades for Aboagye Messiah (st-109) - JHS 1
  { studentId: "st-109", subjectId: "sub-j-eng", classScore: 42, examScore: 46, totalScore: 88, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-03", updatedAt: new Date().toISOString() },
  { studentId: "st-109", subjectId: "sub-j-math", classScore: 45, examScore: 48, totalScore: 93, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-03", updatedAt: new Date().toISOString() },
  { studentId: "st-109", subjectId: "sub-j-sci", classScore: 44, examScore: 45, totalScore: 89, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-03", updatedAt: new Date().toISOString() },
  { studentId: "st-109", subjectId: "sub-j-soc", classScore: 40, examScore: 43, totalScore: 83, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-03", updatedAt: new Date().toISOString() },
  { studentId: "st-109", subjectId: "sub-j-car", classScore: 41, examScore: 44, totalScore: 85, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-03", updatedAt: new Date().toISOString() },
  { studentId: "st-109", subjectId: "sub-j-rme", classScore: 43, examScore: 47, totalScore: 90, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-03", updatedAt: new Date().toISOString() },
  { studentId: "st-109", subjectId: "sub-j-gh", classScore: 39, examScore: 42, totalScore: 81, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-03", updatedAt: new Date().toISOString() },
  { studentId: "st-109", subjectId: "sub-j-ca", classScore: 44, examScore: 46, totalScore: 90, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-03", updatedAt: new Date().toISOString() },
  { studentId: "st-109", subjectId: "sub-j-fr", classScore: 38, examScore: 40, totalScore: 78, gradeLetter: "B2", remarks: "VERY GOOD", term: "Term 1", year: "2025/2026", teacherId: "tch-03", updatedAt: new Date().toISOString() },
  { studentId: "st-109", subjectId: "sub-j-ict", classScore: 45, examScore: 47, totalScore: 92, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-03", updatedAt: new Date().toISOString() },
  // Nursery 1 Grades (st-105 Abena Osei, st-110 Kofi Badu)
  { studentId: "st-105", subjectId: "sub-n-cr", classScore: 45, examScore: 45, totalScore: 90, gradeLetter: "A1", remarks: "MO", nurseryRemark: "MO", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-105", subjectId: "sub-n-lit", classScore: 42, examScore: 43, totalScore: 85, gradeLetter: "A1", remarks: "MO", nurseryRemark: "MO", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-105", subjectId: "sub-n-num", classScore: 38, examScore: 37, totalScore: 75, gradeLetter: "B2", remarks: "O", nurseryRemark: "O", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-105", subjectId: "sub-n-pho", classScore: 45, examScore: 45, totalScore: 90, gradeLetter: "A1", remarks: "MO", nurseryRemark: "MO", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-105", subjectId: "sub-n-psy", classScore: 45, examScore: 45, totalScore: 90, gradeLetter: "A1", remarks: "MO", nurseryRemark: "MO", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },

  { studentId: "st-110", subjectId: "sub-n-cr", classScore: 38, examScore: 37, totalScore: 75, gradeLetter: "B2", remarks: "O", nurseryRemark: "O", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-110", subjectId: "sub-n-lit", classScore: 45, examScore: 45, totalScore: 90, gradeLetter: "A1", remarks: "MO", nurseryRemark: "MO", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-110", subjectId: "sub-n-num", classScore: 42, examScore: 43, totalScore: 85, gradeLetter: "A1", remarks: "MO", nurseryRemark: "MO", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-110", subjectId: "sub-n-pho", classScore: 38, examScore: 37, totalScore: 75, gradeLetter: "B2", remarks: "O", nurseryRemark: "O", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-110", subjectId: "sub-n-psy", classScore: 45, examScore: 45, totalScore: 90, gradeLetter: "A1", remarks: "MO", nurseryRemark: "MO", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },

  // Nursery 2 Grades (st-111 Adwoa Saah, st-112 Kwaku Ananse)
  { studentId: "st-111", subjectId: "sub-n-cr", classScore: 45, examScore: 45, totalScore: 90, gradeLetter: "A1", remarks: "MO", nurseryRemark: "MO", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-111", subjectId: "sub-n-lit", classScore: 45, examScore: 45, totalScore: 90, gradeLetter: "A1", remarks: "MO", nurseryRemark: "MO", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-111", subjectId: "sub-n-num", classScore: 42, examScore: 43, totalScore: 85, gradeLetter: "A1", remarks: "MO", nurseryRemark: "MO", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-111", subjectId: "sub-n-pho", classScore: 45, examScore: 45, totalScore: 90, gradeLetter: "A1", remarks: "MO", nurseryRemark: "MO", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-111", subjectId: "sub-n-psy", classScore: 38, examScore: 37, totalScore: 75, gradeLetter: "B2", remarks: "O", nurseryRemark: "O", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },

  { studentId: "st-112", subjectId: "sub-n-cr", classScore: 38, examScore: 37, totalScore: 75, gradeLetter: "B2", remarks: "O", nurseryRemark: "O", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-112", subjectId: "sub-n-lit", classScore: 38, examScore: 37, totalScore: 75, gradeLetter: "B2", remarks: "O", nurseryRemark: "O", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-112", subjectId: "sub-n-num", classScore: 45, examScore: 45, totalScore: 90, gradeLetter: "A1", remarks: "MO", nurseryRemark: "MO", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-112", subjectId: "sub-n-pho", classScore: 42, examScore: 43, totalScore: 85, gradeLetter: "A1", remarks: "MO", nurseryRemark: "MO", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-112", subjectId: "sub-n-psy", classScore: 45, examScore: 45, totalScore: 90, gradeLetter: "A1", remarks: "MO", nurseryRemark: "MO", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },

  // Kindergarten 1 Grades (st-106 Yaw Ofori, st-113 Efya Pokua)
  { studentId: "st-106", subjectId: "sub-k-lit", classScore: 45, examScore: 45, totalScore: 90, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-106", subjectId: "sub-k-num", classScore: 42, examScore: 43, totalScore: 85, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-106", subjectId: "sub-k-owop", classScore: 38, examScore: 37, totalScore: 75, gradeLetter: "B2", remarks: "VERY GOOD", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-106", subjectId: "sub-k-ca", classScore: 45, examScore: 45, totalScore: 90, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-106", subjectId: "sub-k-wrt", classScore: 42, examScore: 43, totalScore: 85, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },

  { studentId: "st-113", subjectId: "sub-k-lit", classScore: 38, examScore: 37, totalScore: 75, gradeLetter: "B2", remarks: "VERY GOOD", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-113", subjectId: "sub-k-num", classScore: 45, examScore: 45, totalScore: 90, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-113", subjectId: "sub-k-owop", classScore: 45, examScore: 45, totalScore: 90, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-113", subjectId: "sub-k-ca", classScore: 42, examScore: 43, totalScore: 85, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-113", subjectId: "sub-k-wrt", classScore: 38, examScore: 37, totalScore: 75, gradeLetter: "B2", remarks: "VERY GOOD", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },

  // Kindergarten 2 Grades (st-114 Kwadwo Sheldon, st-115 Akua Donkor)
  { studentId: "st-114", subjectId: "sub-k-lit", classScore: 45, examScore: 45, totalScore: 90, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-114", subjectId: "sub-k-num", classScore: 45, examScore: 45, totalScore: 90, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-114", subjectId: "sub-k-owop", classScore: 42, examScore: 43, totalScore: 85, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-114", subjectId: "sub-k-ca", classScore: 45, examScore: 45, totalScore: 90, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-114", subjectId: "sub-k-wrt", classScore: 45, examScore: 45, totalScore: 90, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },

  { studentId: "st-115", subjectId: "sub-k-lit", classScore: 42, examScore: 43, totalScore: 85, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-115", subjectId: "sub-k-num", classScore: 38, examScore: 37, totalScore: 75, gradeLetter: "B2", remarks: "VERY GOOD", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-115", subjectId: "sub-k-owop", classScore: 45, examScore: 45, totalScore: 90, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-115", subjectId: "sub-k-ca", classScore: 38, examScore: 37, totalScore: 75, gradeLetter: "B2", remarks: "VERY GOOD", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-115", subjectId: "sub-k-wrt", classScore: 42, examScore: 43, totalScore: 85, gradeLetter: "A1", remarks: "EXCELLENT", term: "Term 1", year: "2025/2026", teacherId: "tch-01", updatedAt: new Date().toISOString() }
];

export const INITIAL_ATTENDANCE: Attendance[] = [
  { studentId: "st-101", term: "Term 1", year: "2025/2026", totalDays: 70, daysPresent: 68, remarks: "Very regular and punctual. Keep it up!", teacherId: "tch-02", updatedAt: new Date().toISOString() },
  { studentId: "st-102", term: "Term 1", year: "2025/2026", totalDays: 70, daysPresent: 62, remarks: "Good attendance. Well done.", teacherId: "tch-02", updatedAt: new Date().toISOString() },
  { studentId: "st-103", term: "Term 1", year: "2025/2026", totalDays: 70, daysPresent: 70, remarks: "Perfect attendance score!", teacherId: "tch-03", updatedAt: new Date().toISOString() },
  { studentId: "st-105", term: "Term 1", year: "2025/2026", totalDays: 70, daysPresent: 68, remarks: "Very enthusiastic in class activities.", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-106", term: "Term 1", year: "2025/2026", totalDays: 70, daysPresent: 69, remarks: "Shows remarkable progress and discipline.", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-107", term: "Term 1", year: "2025/2026", totalDays: 70, daysPresent: 69, remarks: "Excellent attendance record.", teacherId: "tch-03", updatedAt: new Date().toISOString() },
  { studentId: "st-108", term: "Term 1", year: "2025/2026", totalDays: 70, daysPresent: 67, remarks: "Very good attendance.", teacherId: "tch-03", updatedAt: new Date().toISOString() },
  { studentId: "st-109", term: "Term 1", year: "2025/2026", totalDays: 70, daysPresent: 70, remarks: "Outstanding academic performance and perfect attendance.", teacherId: "tch-03", updatedAt: new Date().toISOString() },
  { studentId: "st-110", term: "Term 1", year: "2025/2026", totalDays: 70, daysPresent: 65, remarks: "Good participation.", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-111", term: "Term 1", year: "2025/2026", totalDays: 70, daysPresent: 70, remarks: "Excellent presence.", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-112", term: "Term 1", year: "2025/2026", totalDays: 70, daysPresent: 66, remarks: "Very active child.", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-113", term: "Term 1", year: "2025/2026", totalDays: 70, daysPresent: 68, remarks: "Bright and punctual.", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-114", term: "Term 1", year: "2025/2026", totalDays: 70, daysPresent: 70, remarks: "Punctual and smart.", teacherId: "tch-01", updatedAt: new Date().toISOString() },
  { studentId: "st-115", term: "Term 1", year: "2025/2026", totalDays: 70, daysPresent: 67, remarks: "Punctual and friendly.", teacherId: "tch-01", updatedAt: new Date().toISOString() }
];

export const INITIAL_FEE_PAYMENTS: FeePayment[] = [];

export const DEFAULT_INVENTORY_DATA: ClassroomInventoryRecord[] = [
  { id: 'inv-complab', locationName: 'Computer Lab / ICT Centre', category: 'Facility', studentChairs: 40, studentTables: 20, textbooks: 50, washrooms: 0, sinks: 1, buses: 0, teacherChairs: 2, teacherTables: 2, computers: 35, projectors: 2, customItems: [{ name: 'High-speed Fibre Router', quantity: 1 }, { name: 'UPS Power Backups', quantity: 12 }, { name: 'Interactive Whiteboard', quantity: 1 }], notes: '35 Desktop PCs, 2 Ceiling Projectors, High-speed Fibre Router & UPS Backups', updatedAt: new Date().toISOString() },
  { id: 'inv-n1', locationName: 'Nursery 1', category: 'Classroom', studentChairs: 25, studentTables: 12, textbooks: 50, washrooms: 1, sinks: 2, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 0, projectors: 0, customItems: [{ name: 'Toy Storage Bins', quantity: 4 }, { name: 'Foam Play Mats', quantity: 10 }], notes: 'Includes play mats and toy boxes', updatedAt: new Date().toISOString() },
  { id: 'inv-n2', locationName: 'Nursery 2', category: 'Classroom', studentChairs: 25, studentTables: 12, textbooks: 55, washrooms: 1, sinks: 2, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 0, projectors: 0, customItems: [{ name: 'Toy Storage Bins', quantity: 4 }], notes: 'Good condition', updatedAt: new Date().toISOString() },
  { id: 'inv-k1', locationName: 'Kindergarten 1', category: 'Classroom', studentChairs: 30, studentTables: 15, textbooks: 70, washrooms: 1, sinks: 2, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 0, projectors: 0, customItems: [{ name: 'Wall Clock', quantity: 1 }], notes: 'Newly repainted desks', updatedAt: new Date().toISOString() },
  { id: 'inv-k2', locationName: 'Kindergarten 2', category: 'Classroom', studentChairs: 30, studentTables: 15, textbooks: 75, washrooms: 1, sinks: 2, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 0, projectors: 0, customItems: [{ name: 'Magnetic Board', quantity: 1 }], notes: 'Standard setup', updatedAt: new Date().toISOString() },
  { id: 'inv-p1', locationName: 'Primary 1', category: 'Classroom', studentChairs: 35, studentTables: 18, textbooks: 110, washrooms: 0, sinks: 1, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 0, projectors: 0, customItems: [{ name: 'Whiteboard', quantity: 1 }], notes: 'NaCCA curriculum textbooks assigned', updatedAt: new Date().toISOString() },
  { id: 'inv-p2', locationName: 'Primary 2', category: 'Classroom', studentChairs: 35, studentTables: 18, textbooks: 115, washrooms: 0, sinks: 1, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 0, projectors: 0, customItems: [{ name: 'Whiteboard', quantity: 1 }], notes: 'Single desks', updatedAt: new Date().toISOString() },
  { id: 'inv-p3', locationName: 'Primary 3', category: 'Classroom', studentChairs: 38, studentTables: 19, textbooks: 120, washrooms: 0, sinks: 1, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 0, projectors: 0, customItems: [{ name: 'Science Demo Kits', quantity: 2 }, { name: 'Whiteboard', quantity: 1 }], notes: 'Science lab kits included', updatedAt: new Date().toISOString() },
  { id: 'inv-p4', locationName: 'Primary 4', category: 'Classroom', studentChairs: 40, studentTables: 20, textbooks: 130, washrooms: 0, sinks: 1, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 0, projectors: 0, customItems: [{ name: 'Whiteboard', quantity: 1 }], notes: 'Standard classroom', updatedAt: new Date().toISOString() },
  { id: 'inv-p5', locationName: 'Primary 5', category: 'Classroom', studentChairs: 40, studentTables: 20, textbooks: 135, washrooms: 0, sinks: 1, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 1, projectors: 1, customItems: [{ name: 'Smart Projection Screen', quantity: 1 }], notes: 'Includes 1 classroom PC and ceiling projector', updatedAt: new Date().toISOString() },
  { id: 'inv-p6', locationName: 'Primary 6', category: 'Classroom', studentChairs: 42, studentTables: 21, textbooks: 140, washrooms: 0, sinks: 1, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 1, projectors: 1, customItems: [{ name: 'Ceiling Fan', quantity: 4 }], notes: 'National exam preparation text library & smart projector', updatedAt: new Date().toISOString() },
  { id: 'inv-j1', locationName: 'JHS 1', category: 'Classroom', studentChairs: 45, studentTables: 45, textbooks: 180, washrooms: 0, sinks: 1, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 1, projectors: 1, customItems: [{ name: 'Wall Mounted Speakers', quantity: 2 }], notes: 'Individual study desks & presentation screen', updatedAt: new Date().toISOString() },
  { id: 'inv-j2', locationName: 'JHS 2', category: 'Classroom', studentChairs: 45, studentTables: 45, textbooks: 185, washrooms: 0, sinks: 1, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 1, projectors: 1, customItems: [{ name: 'Wall Mounted Speakers', quantity: 2 }], notes: 'Individual study desks & presentation screen', updatedAt: new Date().toISOString() },
  { id: 'inv-j3', locationName: 'JHS 3', category: 'Classroom', studentChairs: 45, studentTables: 45, textbooks: 200, washrooms: 0, sinks: 1, buses: 0, teacherChairs: 1, teacherTables: 1, computers: 1, projectors: 1, customItems: [{ name: 'BECE Revision Chart Stands', quantity: 3 }], notes: 'BECE preparation reference books & smart projector', updatedAt: new Date().toISOString() },
  { id: 'inv-staff', locationName: 'Staff Common Room', category: 'Administrative', studentChairs: 0, studentTables: 0, textbooks: 40, washrooms: 2, sinks: 3, buses: 0, teacherChairs: 18, teacherTables: 8, computers: 4, projectors: 1, customItems: [{ name: 'Water Dispenser', quantity: 1 }, { name: 'Microwave Oven', quantity: 1 }, { name: 'Heavy Duty Copier / Printer', quantity: 1 }], notes: 'Teacher lounge, conference table, 4 workstation PCs', updatedAt: new Date().toISOString() },
  { id: 'inv-admin', locationName: 'Admin & Principal Office', category: 'Administrative', studentChairs: 8, studentTables: 3, textbooks: 30, washrooms: 1, sinks: 2, buses: 0, teacherChairs: 4, teacherTables: 4, computers: 5, projectors: 1, customItems: [{ name: 'Fireproof Vault Safe', quantity: 1 }, { name: 'Notice Board', quantity: 2 }], notes: 'Executive visitor chairs, office PCs & administrative printer setup', updatedAt: new Date().toISOString() },
  { id: 'inv-wash', locationName: 'Central Washroom Block', category: 'Facility', studentChairs: 0, studentTables: 0, textbooks: 0, washrooms: 12, sinks: 14, buses: 0, teacherChairs: 0, teacherTables: 0, computers: 0, projectors: 0, customItems: [{ name: 'Automated Hand Dryers', quantity: 4 }], notes: '6 Boys, 6 Girls, handwashing stations', updatedAt: new Date().toISOString() },
  { id: 'inv-transport', locationName: 'Transport Yard', category: 'Transport', studentChairs: 0, studentTables: 0, textbooks: 0, washrooms: 1, sinks: 2, buses: 4, teacherChairs: 0, teacherTables: 0, computers: 0, projectors: 0, customItems: [{ name: 'Emergency First Aid Kits', quantity: 4 }, { name: 'Fire Extinguishers', quantity: 4 }], notes: '4 Eastfield Academy School Buses with safety gear', updatedAt: new Date().toISOString() }
];
