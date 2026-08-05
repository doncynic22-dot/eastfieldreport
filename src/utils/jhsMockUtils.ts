/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Subject, Student } from '../types';

export interface JHSMockSubjectScore {
  subjectId: string;
  subjectName: string;
  subjectCode: string;
  score: number; // 0 to 100
  grade: number; // 1 to 9
}

export interface JHSMockExamRecord {
  id: string; // e.g. "mock_st103_2026_m1"
  studentId: string;
  studentName: string;
  rollNumber: string;
  className: string; // e.g. "JHS 3"
  examTitle: string; // e.g. "Mock 1", "Mock 2", "Mock 3", "BECE Final Mock"
  academicYear: string; // e.g. "2025/2026"
  scores: {
    [subjectKey: string]: number; // key can be subjectId or subjectCode or subjectName
  };
  remarks?: string;
  updatedAt: string;
  updatedBy?: string;
}

/**
 * Official Ghana BECE Grading Scale
 * 90 - 100 => Grade 1 (Highest / Distinction)
 * 80 - 89  => Grade 2 (Higher / Distinction)
 * 70 - 79  => Grade 3 (High / Credit)
 * 60 - 69  => Grade 4 (High Average / Credit)
 * 55 - 59  => Grade 5 (Average / Credit)
 * 50 - 54  => Grade 6 (Low Average / Pass)
 * 45 - 49  => Grade 7 (Low / Pass)
 * 40 - 44  => Grade 8 (Lower / Pass)
 * 0 - 39   => Grade 9 (Lowest / Fail)
 */
export function calculateBECEGrade(mark: number): number {
  if (mark === undefined || mark === null || isNaN(mark) || mark < 0) return 9;
  const score = Math.round(mark);
  if (score >= 90) return 1;
  if (score >= 80) return 2;
  if (score >= 70) return 3;
  if (score >= 60) return 4;
  if (score >= 55) return 5;
  if (score >= 50) return 6;
  if (score >= 45) return 7;
  if (score >= 40) return 8;
  return 9;
}

export function getBECEGradeMeta(grade: number) {
  switch (grade) {
    case 1:
      return { label: 'Grade 1', remark: 'HIGHEST (Distinction)', badgeClass: 'bg-emerald-600 text-white' };
    case 2:
      return { label: 'Grade 2', remark: 'HIGHER (Distinction)', badgeClass: 'bg-emerald-500 text-white' };
    case 3:
      return { label: 'Grade 3', remark: 'HIGH (Credit)', badgeClass: 'bg-blue-600 text-white' };
    case 4:
      return { label: 'Grade 4', remark: 'HIGH AVERAGE (Credit)', badgeClass: 'bg-blue-500 text-white' };
    case 5:
      return { label: 'Grade 5', remark: 'AVERAGE (Credit)', badgeClass: 'bg-cyan-600 text-white' };
    case 6:
      return { label: 'Grade 6', remark: 'LOW AVERAGE (Pass)', badgeClass: 'bg-amber-500 text-mauve-950 font-black' };
    case 7:
      return { label: 'Grade 7', remark: 'LOW (Pass)', badgeClass: 'bg-orange-500 text-white' };
    case 8:
      return { label: 'Grade 8', remark: 'LOWER (Pass)', badgeClass: 'bg-amber-600 text-white' };
    case 9:
    default:
      return { label: 'Grade 9', remark: 'LOWEST (Fail)', badgeClass: 'bg-red-600 text-white' };
  }
}

/**
 * BECE Core Subjects Identification
 * 1. English Language (ENG)
 * 2. Mathematics (MAT)
 * 3. Integrated Science / Science (SCI)
 * 4. Social Studies (SOC)
 */
export function isCoreSubject(subject: Subject): boolean {
  const code = (subject.code || '').toUpperCase();
  const name = (subject.name || '').toLowerCase();
  const id = (subject.id || '').toLowerCase();

  if (code === 'ENG' || code === 'MAT' || code === 'SCI' || code === 'SOC') return true;
  if (id.includes('eng') || id.includes('math') || id.includes('sci') || id.includes('soc')) return true;
  if (name.includes('english') || name.includes('math') || name.includes('science') || name.includes('social')) return true;

  return false;
}

export function getCoreSubjectType(subject: Subject): 'ENGLISH' | 'MATHS' | 'SCIENCE' | 'SOCIAL' | null {
  const code = (subject.code || '').toUpperCase();
  const name = (subject.name || '').toLowerCase();
  const id = (subject.id || '').toLowerCase();

  if (code === 'ENG' || id.includes('eng') || name.includes('english')) return 'ENGLISH';
  if (code === 'MAT' || id.includes('math') || name.includes('math')) return 'MATHS';
  if (code === 'SCI' || id.includes('sci') || name.includes('science')) return 'SCIENCE';
  if (code === 'SOC' || id.includes('soc') || name.includes('social')) return 'SOCIAL';

  return null;
}

export interface ComputedBECECalculations {
  rawScore: number;
  totalSubjectsTaken: number;
  coreGrades: {
    english?: { score: number; grade: number };
    maths?: { score: number; grade: number };
    science?: { score: number; grade: number };
    social?: { score: number; grade: number };
  };
  coreAggregate: number; // sum of 4 core grades (missing cores default to 9)
  bestTwoElectives: Array<{ subjectName: string; score: number; grade: number }>;
  bestTwoElectiveAggregate: number;
  totalAggregate: number; // 4 cores + best 2 electives (6 = perfect score)
  hasAllCoreScores: boolean;
  performanceBand: string;
}

export function computeBECECalculations(
  scores: { [subjectKey: string]: number },
  jhsSubjects: Subject[]
): ComputedBECECalculations {
  let totalSubjectsTaken = 0;

  const coreGrades: ComputedBECECalculations['coreGrades'] = {};
  const electiveItems: Array<{ subjectName: string; score: number; grade: number }> = [];

  // Match subject scores
  jhsSubjects.forEach((sub) => {
    // lookup score by sub.id, sub.code, or sub.name
    let val: number | undefined = scores[sub.id];
    if (val === undefined) val = scores[sub.code];
    if (val === undefined) val = scores[sub.name];

    if (val !== undefined && val !== null && !isNaN(val) && val >= 0) {
      const score = Math.min(100, Math.max(0, val));
      const grade = calculateBECEGrade(score);
      totalSubjectsTaken += 1;

      const coreType = getCoreSubjectType(sub);
      if (coreType === 'ENGLISH') {
        coreGrades.english = { score, grade };
      } else if (coreType === 'MATHS') {
        coreGrades.maths = { score, grade };
      } else if (coreType === 'SCIENCE') {
        coreGrades.science = { score, grade };
      } else if (coreType === 'SOCIAL') {
        coreGrades.social = { score, grade };
      } else {
        electiveItems.push({ subjectName: sub.name, score, grade });
      }
    }
  });

  // Also check if scores object has keys that were not directly in jhsSubjects
  Object.keys(scores).forEach((k) => {
    const val = scores[k];
    if (val !== undefined && val !== null && !isNaN(val) && val >= 0) {
      const alreadyCounted = jhsSubjects.some((s) => s.id === k || s.code === k || s.name === k);
      if (!alreadyCounted) {
        const score = Math.min(100, Math.max(0, val));
        const grade = calculateBECEGrade(score);
        totalSubjectsTaken += 1;
        
        const lowerK = k.toLowerCase();
        if (lowerK.includes('eng') && !coreGrades.english) coreGrades.english = { score, grade };
        else if (lowerK.includes('math') && !coreGrades.maths) coreGrades.maths = { score, grade };
        else if (lowerK.includes('sci') && !coreGrades.science) coreGrades.science = { score, grade };
        else if (lowerK.includes('soc') && !coreGrades.social) coreGrades.social = { score, grade };
        else electiveItems.push({ subjectName: k, score, grade });
      }
    }
  });

  const engG = coreGrades.english?.grade ?? 9;
  const matG = coreGrades.maths?.grade ?? 9;
  const sciG = coreGrades.science?.grade ?? 9;
  const socG = coreGrades.social?.grade ?? 9;

  const coreAggregate = engG + matG + sciG + socG;
  const hasAllCoreScores = !!(coreGrades.english && coreGrades.maths && coreGrades.science && coreGrades.social);

  // Sort electives by best grade (lowest numerical grade value is best)
  electiveItems.sort((a, b) => a.grade - b.grade || b.score - a.score);

  const bestTwoElectives = electiveItems.slice(0, 2);
  const el1G = bestTwoElectives[0]?.grade ?? 9;
  const el2G = bestTwoElectives[1]?.grade ?? 9;
  const bestTwoElectiveAggregate = el1G + el2G;

  const totalAggregate = coreAggregate + bestTwoElectiveAggregate;

  let performanceBand = 'Distinction';
  if (totalAggregate <= 12) performanceBand = 'DISTINCTION (Grade A)';
  else if (totalAggregate <= 20) performanceBand = 'MERIT (Grade B)';
  else if (totalAggregate <= 30) performanceBand = 'CREDIT (Grade C)';
  else if (totalAggregate <= 36) performanceBand = 'PASS (Grade D)';
  else performanceBand = 'NEEDS IMPROVEMENT';

  // Calculate rawScore as sum of marks of the 4 cores + best 2 electives (6 subjects used for aggregate)
  const engScore = coreGrades.english?.score ?? 0;
  const matScore = coreGrades.maths?.score ?? 0;
  const sciScore = coreGrades.science?.score ?? 0;
  const socScore = coreGrades.social?.score ?? 0;

  const el1Score = bestTwoElectives[0]?.score ?? 0;
  const el2Score = bestTwoElectives[1]?.score ?? 0;

  const rawScore = engScore + matScore + sciScore + socScore + el1Score + el2Score;

  return {
    rawScore,
    totalSubjectsTaken,
    coreGrades,
    coreAggregate,
    bestTwoElectives,
    bestTwoElectiveAggregate,
    totalAggregate,
    hasAllCoreScores,
    performanceBand,
  };
}

export const INITIAL_JHS3_MOCK_RECORDS: JHSMockExamRecord[] = [];

export function getStoredJHSMockRecords(): JHSMockExamRecord[] {
  try {
    const saved = localStorage.getItem('ea_jhs_mock_records');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed reading ea_jhs_mock_records from localStorage:', e);
  }
  return INITIAL_JHS3_MOCK_RECORDS;
}

export function saveStoredJHSMockRecords(records: JHSMockExamRecord[]): void {
  try {
    localStorage.setItem('ea_jhs_mock_records', JSON.stringify(records));
    localStorage.setItem('mock_supabase_ea_jhs_mock_records', JSON.stringify(records));
    window.dispatchEvent(new Event('ea_jhs_mock_updated'));
  } catch (e) {
    console.warn('Failed saving ea_jhs_mock_records to localStorage:', e);
  }
}

