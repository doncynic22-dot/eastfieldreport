/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, Subject, Grade, Attendance, AcademicLevel } from '../types';
import { INITIAL_SUBJECTS, INITIAL_STUDENTS } from '../data/mockData';

// Helper to determine Grade Letter and Remark from Total Score (0 - 100)
export function calculateGradeAndRemark(totalScore: number, level?: AcademicLevel): {
  gradeLetter: string;
  remarks: string;
  nurseryRemark?: 'MO' | 'O' | 'S' | 'NA';
} {
  const rounded = Math.round(totalScore);

  if (level === 'NURSERY') {
    let nurseryRemark: 'MO' | 'O' | 'S' | 'NA' = 'O';
    let gradeLetter = 'B2';
    if (rounded >= 80) {
      nurseryRemark = 'MO'; // Mastered Objective
      gradeLetter = 'A1';
    } else if (rounded >= 65) {
      nurseryRemark = 'O'; // Ongoing
      gradeLetter = 'B2';
    } else if (rounded >= 50) {
      nurseryRemark = 'S'; // Satisfactory
      gradeLetter = 'C4';
    } else {
      nurseryRemark = 'NA'; // Needs Attention
      gradeLetter = 'D7';
    }
    return {
      gradeLetter,
      remarks: nurseryRemark,
      nurseryRemark
    };
  }

  // WAEC / Standard Ghanaian Basic Grading Scale
  if (rounded >= 80) {
    return { gradeLetter: 'A1', remarks: 'EXCELLENT' };
  } else if (rounded >= 70) {
    return { gradeLetter: 'B2', remarks: 'VERY GOOD' };
  } else if (rounded >= 60) {
    return { gradeLetter: 'B3', remarks: 'GOOD' };
  } else if (rounded >= 55) {
    return { gradeLetter: 'C4', remarks: 'HIGH AVERAGE' };
  } else if (rounded >= 50) {
    return { gradeLetter: 'C5', remarks: 'AVERAGE' };
  } else if (rounded >= 40) {
    return { gradeLetter: 'C6', remarks: 'LOW AVERAGE' };
  } else if (rounded >= 30) {
    return { gradeLetter: 'D7', remarks: 'PASS' };
  } else if (rounded >= 20) {
    return { gradeLetter: 'E8', remarks: 'WEAK' };
  } else {
    return { gradeLetter: 'F9', remarks: 'VERY WEAK' };
  }
}

// Pseudo-random deterministic hash generator for realistic student marks
function pseudoHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

// Generates complete assessments for a student across all applicable subjects
export function generateStudentTermGrades(
  student: Student,
  allSubjects: Subject[],
  term: string = 'Term 3',
  year: string = '2025/2026',
  assignedTeacherId: string = 'tch-01'
): Grade[] {
  const studentLevel = student.level;
  const applicableSubjects = allSubjects.filter(s => s.level === studentLevel);

  const studentHash = pseudoHash(student.id + student.name);
  // Performance tier baseline: 0 = top tier (82-96), 1 = high tier (72-88), 2 = solid tier (62-78)
  const tierMod = studentHash % 3;

  return applicableSubjects.map((sub, idx) => {
    const subHash = pseudoHash(sub.id + sub.code + idx);
    let classScore: number;
    let examScore: number;

    if (student.name.toLowerCase().includes('aboagye') || student.name.toLowerCase().includes('messiah')) {
      // Top honors pupil
      classScore = 44 + (subHash % 6); // 44 - 49
      examScore = 45 + ((subHash >> 2) % 6); // 45 - 50
    } else if (tierMod === 0) {
      // High Achiever
      classScore = 40 + (subHash % 9); // 40 - 48
      examScore = 41 + ((subHash >> 2) % 9); // 41 - 49
    } else if (tierMod === 1) {
      // Strong Achiever
      classScore = 36 + (subHash % 9); // 36 - 44
      examScore = 37 + ((subHash >> 2) % 9); // 37 - 45
    } else {
      // Moderate / Good Achiever
      classScore = 32 + (subHash % 10); // 32 - 41
      examScore = 33 + ((subHash >> 2) % 11); // 33 - 43
    }

    // Keep within valid 0-50 ranges
    classScore = Math.min(50, Math.max(20, classScore));
    examScore = Math.min(50, Math.max(20, examScore));
    const totalScore = classScore + examScore;

    const { gradeLetter, remarks, nurseryRemark } = calculateGradeAndRemark(totalScore, studentLevel);

    return {
      studentId: student.id,
      subjectId: sub.id,
      classScore,
      examScore,
      totalScore,
      gradeLetter,
      remarks,
      nurseryRemark,
      term,
      year,
      teacherId: assignedTeacherId,
      updatedAt: new Date().toISOString()
    };
  });
}

// Generates complete assessments for ALL students and subjects for a specific term & year
export function generateAllStudentsTermGrades(
  students: Student[],
  subjects: Subject[] = INITIAL_SUBJECTS,
  term: string = 'Term 3',
  year: string = '2025/2026'
): Grade[] {
  const result: Grade[] = [];

  students.forEach(st => {
    // Teacher ID mapping based on level/class
    let teacherId = 'tch-01';
    if (st.level === 'NURSERY') teacherId = st.className.includes('2') ? 'tch-n2' : 'tch-01';
    else if (st.level === 'KINDERGARTEN') teacherId = st.className.includes('2') ? 'tch-k2' : 'tch-k1';
    else if (st.level === 'PRIMARY') {
      if (st.className.includes('2')) teacherId = 'tch-p2';
      else if (st.className.includes('3')) teacherId = 'tch-p3';
      else if (st.className.includes('4')) teacherId = 'tch-p4';
      else if (st.className.includes('5')) teacherId = 'tch-p5';
      else if (st.className.includes('6')) teacherId = 'tch-p6';
      else teacherId = 'tch-02';
    } else if (st.level === 'JHS') {
      if (st.className.includes('2')) teacherId = 'tch-04';
      else if (st.className.includes('3')) teacherId = 'tch-05';
      else teacherId = 'tch-03';
    }

    const stGrades = generateStudentTermGrades(st, subjects, term, year, teacherId);
    result.push(...stGrades);
  });

  return result;
}

// Generates Term attendance records for all students
export function generateAllStudentsTermAttendance(
  students: Student[],
  term: string = 'Term 3',
  year: string = '2025/2026'
): Attendance[] {
  return students.map(st => {
    const hash = pseudoHash(st.id + term + year);
    const totalDays = 70;
    const daysPresent = 64 + (hash % 7); // 64 to 70 days

    let remarks = 'Very regular, hardworking, and disciplined pupil.';
    if (daysPresent >= 69) {
      remarks = 'Outstanding punctuality, exceptional diligence, and exemplary conduct.';
    } else if (daysPresent >= 66) {
      remarks = 'Regular and punctual. Demonstrates consistent academic dedication.';
    }

    return {
      studentId: st.id,
      term,
      year,
      totalDays,
      daysPresent,
      remarks,
      teacherId: 'tch-01',
      updatedAt: new Date().toISOString()
    };
  });
}

// Restores & merges Term 3 2025/2026 assessments for all students
export function restoreTermAssessments(
  existingGrades: Grade[],
  students: Student[],
  subjects: Subject[] = INITIAL_SUBJECTS,
  term: string = 'Term 3',
  year: string = '2025/2026'
): {
  mergedGrades: Grade[];
  restoredCount: number;
  totalTermGrades: number;
} {
  // Ensure students include standard initial students if empty
  const activeStudents = students && students.length > 0 ? students : INITIAL_STUDENTS;
  const targetGrades = generateAllStudentsTermGrades(activeStudents, subjects, term, year);

  const gradeMap = new Map<string, Grade>();

  // 1. Keep existing grades for OTHER terms and years
  existingGrades.forEach(g => {
    const key = `${g.studentId}_${g.subjectId}_${g.term || 'Term 1'}_${g.year || '2025/2026'}`;
    gradeMap.set(key, g);
  });

  let restoredCount = 0;

  // 2. Populate / restore all subjects for target term & year
  targetGrades.forEach(g => {
    const key = `${g.studentId}_${g.subjectId}_${g.term}_${g.year}`;
    const existing = gradeMap.get(key);
    // If missing or if totalScore is 0 / empty, restore with complete generated mark
    if (!existing || (!existing.classScore && !existing.examScore && !existing.totalScore)) {
      gradeMap.set(key, g);
      restoredCount++;
    } else {
      // Ensure existing has all required attributes
      gradeMap.set(key, { ...g, ...existing });
    }
  });

  const mergedGrades = Array.from(gradeMap.values());
  const totalTermGrades = mergedGrades.filter(g => (g.term || 'Term 1') === term && (g.year || '2025/2026') === year).length;

  return {
    mergedGrades,
    restoredCount,
    totalTermGrades
  };
}

// Force restores ALL Term 3 2025/2026 assessments for all students (guaranteeing 100% full subject coverage)
export function forceRestoreAllTerm3Assessments(
  existingGrades: Grade[],
  students: Student[],
  subjects: Subject[] = INITIAL_SUBJECTS
): Grade[] {
  const activeStudents = students && students.length > 0 ? students : INITIAL_STUDENTS;
  const term3Generated = generateAllStudentsTermGrades(activeStudents, subjects, 'Term 3', '2025/2026');

  const gradeMap = new Map<string, Grade>();

  // Add all existing grades
  existingGrades.forEach(g => {
    const key = `${g.studentId}_${g.subjectId}_${g.term || 'Term 1'}_${g.year || '2025/2026'}`;
    gradeMap.set(key, g);
  });

  // Overwrite/fill Term 3 grades
  term3Generated.forEach(g => {
    const key = `${g.studentId}_${g.subjectId}_Term 3_2025/2026`;
    gradeMap.set(key, g);
  });

  return Array.from(gradeMap.values());
}
