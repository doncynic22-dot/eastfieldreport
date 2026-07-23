import { Student, AcademicLevel, ReportConfig } from '../types';

export interface PromotionRecord {
  studentId: string;
  studentName: string;
  rollNumber: string;
  oldClass: string;
  newClass: string;
  oldLevel: AcademicLevel;
  newLevel: AcademicLevel;
  isGraduated: boolean;
}

export interface PromotionResult {
  promotedStudents: Student[];
  records: PromotionRecord[];
  promotedCount: number;
  graduatedCount: number;
  promotionYear: string;
}

/**
 * Ordered grade progression mapping across Nursery, Primary, and JHS levels.
 */
export const CLASS_PROGRESSION_SEQUENCE: { className: string; level: AcademicLevel }[] = [
  // Nursery Level
  { className: 'Nursery 1', level: 'NURSERY' },
  { className: 'Nursery 2', level: 'NURSERY' },
  // Kindergarten Level
  { className: 'Kindergarten 1', level: 'KINDERGARTEN' },
  { className: 'Kindergarten 2', level: 'KINDERGARTEN' },
  // Primary Level
  { className: 'Primary 1', level: 'PRIMARY' },
  { className: 'Primary 2', level: 'PRIMARY' },
  { className: 'Primary 3', level: 'PRIMARY' },
  { className: 'Primary 4', level: 'PRIMARY' },
  { className: 'Primary 5', level: 'PRIMARY' },
  { className: 'Primary 6', level: 'PRIMARY' },
  // JHS Level
  { className: 'JHS 1', level: 'JHS' },
  { className: 'JHS 2', level: 'JHS' },
  { className: 'JHS 3', level: 'JHS' }
];

/**
 * Determines the next class and academic level for a given class.
 */
export function getNextClassAndLevel(currentClass: string, currentLevel: AcademicLevel): {
  nextClass: string;
  nextLevel: AcademicLevel;
  isGraduated: boolean;
} {
  const normalizedClass = currentClass.trim().toLowerCase();
  const index = CLASS_PROGRESSION_SEQUENCE.findIndex(
    item => item.className.toLowerCase() === normalizedClass
  );

  if (index >= 0 && index < CLASS_PROGRESSION_SEQUENCE.length - 1) {
    const nextItem = CLASS_PROGRESSION_SEQUENCE[index + 1];
    return {
      nextClass: nextItem.className,
      nextLevel: nextItem.level,
      isGraduated: false
    };
  } else if (index === CLASS_PROGRESSION_SEQUENCE.length - 1) {
    // Graduated JHS 3
    return {
      nextClass: 'Graduated JHS',
      nextLevel: 'JHS',
      isGraduated: true
    };
  } else if (normalizedClass.includes('graduated')) {
    // Already graduated
    return {
      nextClass: currentClass,
      nextLevel: currentLevel,
      isGraduated: true
    };
  } else {
    // Fallback: try number increment if numeric (e.g., 'Primary 1' -> 'Primary 2')
    const match = currentClass.match(/^(.+?)\s*(\d+)$/);
    if (match) {
      const prefix = match[1];
      const num = parseInt(match[2], 10);
      return {
        nextClass: `${prefix} ${num + 1}`,
        nextLevel: currentLevel,
        isGraduated: false
      };
    }
    return {
      nextClass: currentClass,
      nextLevel: currentLevel,
      isGraduated: false
    };
  }
}

/**
 * Promotes an array of students to their next grade level.
 */
export function promoteStudents(students: Student[], schoolYear: string): PromotionResult {
  const records: PromotionRecord[] = [];
  let promotedCount = 0;
  let graduatedCount = 0;

  const promotedStudents = students.map(student => {
    // If student is already marked as graduated, keep them as is
    if (student.className.toLowerCase().includes('graduated')) {
      records.push({
        studentId: student.id,
        studentName: student.name,
        rollNumber: student.rollNumber,
        oldClass: student.className,
        newClass: student.className,
        oldLevel: student.level,
        newLevel: student.level,
        isGraduated: true
      });
      return student;
    }

    const { nextClass, nextLevel, isGraduated } = getNextClassAndLevel(student.className, student.level);

    if (isGraduated) {
      graduatedCount++;
    } else {
      promotedCount++;
    }

    records.push({
      studentId: student.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      oldClass: student.className,
      newClass: nextClass,
      oldLevel: student.level,
      newLevel: nextLevel,
      isGraduated
    });

    return {
      ...student,
      className: nextClass,
      level: nextLevel
    };
  });

  return {
    promotedStudents,
    records,
    promotedCount,
    graduatedCount,
    promotionYear: schoolYear
  };
}

/**
 * Checks whether automatic promotion is due for First Term reopening date.
 */
export function isAutoPromotionDue(config: ReportConfig): boolean {
  // Check if current term is First Term
  const termLower = (config.term || '').toLowerCase();
  const isFirstTerm = termLower.includes('term 1') || termLower.includes('first');
  
  if (!isFirstTerm) return false;

  // If already promoted for this school year cycle, return false
  if (config.lastPromotedYear === config.schoolYear) return false;

  // Check reopening date if provided
  if (config.reopeningDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reopening = new Date(config.reopeningDate);
    reopening.setHours(0, 0, 0, 0);

    return today >= reopening;
  }

  return false;
}
