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
    const cleanStr = config.reopeningDate.trim();
    const ymdMatch = cleanStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    let reopening: Date;
    if (ymdMatch) {
      reopening = new Date(parseInt(ymdMatch[1], 10), parseInt(ymdMatch[2], 10) - 1, parseInt(ymdMatch[3], 10));
    } else {
      reopening = new Date(cleanStr);
    }
    reopening.setHours(0, 0, 0, 0);

    return today >= reopening;
  }

  return false;
}

/**
 * Determines the previous class and academic level for a given class (Reverse Promotion / Undo).
 */
export function getPreviousClassAndLevel(currentClass: string, currentLevel: AcademicLevel): {
  prevClass: string;
  prevLevel: AcademicLevel;
} {
  const normalizedClass = currentClass.trim().toLowerCase();

  if (normalizedClass.includes('graduated')) {
    return {
      prevClass: 'JHS 3',
      prevLevel: 'JHS'
    };
  }

  const index = CLASS_PROGRESSION_SEQUENCE.findIndex(
    item => item.className.toLowerCase() === normalizedClass
  );

  if (index > 0) {
    const prevItem = CLASS_PROGRESSION_SEQUENCE[index - 1];
    return {
      prevClass: prevItem.className,
      prevLevel: prevItem.level
    };
  } else if (index === 0) {
    return {
      prevClass: 'Nursery 1',
      prevLevel: 'NURSERY'
    };
  } else {
    // Fallback: try number decrement if numeric
    const match = currentClass.match(/^(.+?)\s*(\d+)$/);
    if (match) {
      const prefix = match[1];
      const num = parseInt(match[2], 10);
      if (num > 1) {
        return {
          prevClass: `${prefix} ${num - 1}`,
          prevLevel: currentLevel
        };
      }
    }
    return {
      prevClass: currentClass,
      prevLevel: currentLevel
    };
  }
}

/**
 * Undoes or reverses student promotion, restoring previous student grade levels.
 * Uses snapshot if available, or algorithmic decrement as fallback.
 */
export function undoPromotion(students: Student[], snapshot?: Student[]): {
  restoredStudents: Student[];
  revertedCount: number;
} {
  let revertedCount = 0;

  if (snapshot && Array.isArray(snapshot) && snapshot.length > 0) {
    const snapshotMap = new Map(snapshot.map(s => [s.id, s]));
    const restoredStudents = students.map(student => {
      const oldRec = snapshotMap.get(student.id);
      if (oldRec && (oldRec.className !== student.className || oldRec.level !== student.level)) {
        revertedCount++;
        return {
          ...student,
          className: oldRec.className,
          level: oldRec.level
        };
      }
      return student;
    });
    return { restoredStudents, revertedCount };
  }

  // Fallback: reverse class progression index
  const restoredStudents = students.map(student => {
    const { prevClass, prevLevel } = getPreviousClassAndLevel(student.className, student.level);
    if (prevClass !== student.className || prevLevel !== student.level) {
      revertedCount++;
    }
    return {
      ...student,
      className: prevClass,
      level: prevLevel
    };
  });

  return { restoredStudents, revertedCount };
}
