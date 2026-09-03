import { Student, AcademicLevel, ReportConfig, Grade } from '../types';
import { INITIAL_STUDENTS } from '../data/mockData';
import { getDeletedStudentIds } from '../lib/supabase';

export interface PromotionRecord {
  oldStudentId: string;
  newStudentId: string;
  studentId: string;
  studentName: string;
  oldRollNumber: string;
  newRollNumber: string;
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
 * Returns standard class abbreviations / codes (e.g. N1, N2, KG1, KG2, P1..P6, J1..J3).
 */
export function getClassCode(className: string, level?: AcademicLevel): string {
  const norm = (className || '').toLowerCase().trim();
  if (norm.includes('nursery 1') || norm === 'n1') return 'N1';
  if (norm.includes('nursery 2') || norm === 'n2') return 'N2';
  if (norm.includes('kindergarten 1') || norm.includes('kg 1') || norm === 'kg1' || norm === 'k1') return 'KG1';
  if (norm.includes('kindergarten 2') || norm.includes('kg 2') || norm === 'kg2' || norm === 'k2') return 'KG2';
  if (norm.includes('jhs') || norm.includes('jh') || norm.startsWith('j')) {
    const num = norm.replace(/[^0-9]/g, '');
    return `J${num || '1'}`;
  }
  if (norm.includes('primary') || norm.includes('basic') || norm.startsWith('p') || norm.startsWith('bs') || norm.startsWith('pri')) {
    const num = norm.replace(/[^0-9]/g, '');
    return `P${num || '1'}`;
  }
  if (level === 'NURSERY') return 'N1';
  if (level === 'KINDERGARTEN') return 'KG1';
  if (level === 'JHS') return 'J1';
  return 'P1';
}

/**
 * Deduplicates an array of students to guarantee 100% unique IDs and unique student names.
 * Purges duplicate records that may have been created by legacy sessions or repeated syncs.
 */
export function deduplicateStudents(students: Student[]): Student[] {
  if (!Array.isArray(students)) return [];
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const clean: Student[] = [];

  for (const s of students) {
    if (!s) continue;
    const rawId = (s.id || '').trim();
    if (!rawId) continue;

    const normName = (s.name || '').trim().toLowerCase();
    
    // Skip if this exact ID has already been included
    if (seenIds.has(rawId)) continue;
    
    // Skip if a student with the exact same non-empty name is already in the roster
    if (normName && seenNames.has(normName)) continue;

    seenIds.add(rawId);
    if (normName) seenNames.add(normName);
    clean.push(s);
  }

  return clean;
}

/**
 * Derives the updated Roll Number reflecting the newly promoted class.
 * E.g. EA/N1/2026/001 -> EA/N2/2026/001
 *      EA/KG2/2026/001 -> EA/P1/2026/001
 *      EA/P6/2026/002 -> EA/J1/2026/002
 */
export function getUpdatedRollNumber(
  currentRoll: string,
  nextClass: string,
  nextLevel: AcademicLevel,
  schoolYear?: string,
  usedRolls?: Set<string>
): string {
  const newClassCode = getClassCode(nextClass, nextLevel);
  let baseCandidate = '';

  if (!currentRoll) {
    const yr = schoolYear ? schoolYear.split('/')[0].trim() : '2026';
    baseCandidate = `EA/${newClassCode}/${yr}/001`;
  } else {
    const raw = currentRoll.trim();

    // Pattern 1: EA/CODE/YEAR/SEQ (e.g. EA/P1/2026/001 or EA/JHS1/2026/001)
    const slashMatch = raw.match(/^([A-Za-z]+)\/([A-Za-z0-9]+)\/(\d{4}(?:\/\d{4})?)\/(\d+)$/);
    if (slashMatch) {
      const prefix = slashMatch[1];
      const oldCode = slashMatch[2].toUpperCase();
      const yr = slashMatch[3];
      const seq = slashMatch[4];
      let targetCode = newClassCode;
      if (oldCode.startsWith('JHS') && newClassCode.startsWith('J')) {
        targetCode = `JHS${newClassCode.replace(/[^0-9]/g, '')}`;
      }
      baseCandidate = `${prefix}/${targetCode}/${yr}/${seq}`;
    } else {
      // Pattern 2: Hyphenated EA-CODE-YEAR-SEQ (e.g. EA-P1-2026-001)
      const hyphenMatch = raw.match(/^([A-Za-z]+)-([A-Za-z0-9]+)-(\d{4})-(\d+)$/);
      if (hyphenMatch) {
        const prefix = hyphenMatch[1];
        const yr = hyphenMatch[3];
        const seq = hyphenMatch[4];
        baseCandidate = `${prefix}-${newClassCode}-${yr}-${seq}`;
      } else {
        // Pattern 3: CODE-SEQ (e.g. P1-001 or J1-005)
        const codeSeqMatch = raw.match(/^([A-Za-z]+[0-9]*)[-_/\s]+(\d+)$/);
        if (codeSeqMatch) {
          const seq = codeSeqMatch[2];
          baseCandidate = `${newClassCode}-${seq}`;
        } else {
          // Pattern 4: Generic segment replacement
          const segments = raw.split(/([/\\-_.\s]+)/);
          let replaced = false;
          const updatedSegments = segments.map(seg => {
            if (!replaced && /^(?:KG|KIND|KINDERGARTEN|K|N|NUR|NURSERY|JHS|JH|J|PRIMARY|BASIC|PRI|BS|PR|P)[1-6]$/i.test(seg)) {
              replaced = true;
              if (/^JHS[1-3]$/i.test(seg) && newClassCode.startsWith('J')) {
                return `JHS${newClassCode.replace(/[^0-9]/g, '')}`;
              }
              return newClassCode;
            }
            return seg;
          });

          if (replaced) {
            baseCandidate = updatedSegments.join('');
          } else {
            // Fallback: If no class code was in the roll, format standard EA/<CODE>/2026/<NUM>
            const digits = raw.replace(/\D/g, '');
            const seq = digits ? digits.slice(-3).padStart(3, '0') : '001';
            baseCandidate = `EA/${newClassCode}/2026/${seq}`;
          }
        }
      }
    }
  }

  // If no conflict tracking set is provided, return base candidate
  if (!usedRolls || !usedRolls.has(baseCandidate.toUpperCase())) {
    return baseCandidate;
  }

  // If candidate is already taken in this batch, increment sequence until unique
  let counter = 1;
  const matchDigits = baseCandidate.match(/(\d+)$/);
  const prefix = matchDigits ? baseCandidate.slice(0, matchDigits.index) : `${baseCandidate}-`;
  const padLen = matchDigits ? Math.max(3, matchDigits[1].length) : 3;

  while (counter < 9999) {
    const candidate = `${prefix}${String(counter).padStart(padLen, '0')}`;
    if (!usedRolls.has(candidate.toUpperCase())) {
      return candidate;
    }
    counter++;
  }

  return `${baseCandidate}-${Date.now().toString().slice(-4)}`;
}

/**
 * Derives the updated student internal ID reflecting the newly promoted class.
 * Ensures the generated ID is 100% unique and does not collide with existing IDs.
 * E.g. st-n1-03 -> st-n2-03
 *      st-p1-04 -> st-p2-04
 *      st-p6-01 -> st-j1-01
 *      st-105 (with roll EA/N1/2026/001) -> st-n2-01
 */
export function getUpdatedStudentId(
  currentId: string,
  nextClass: string,
  nextLevel: AcademicLevel,
  updatedRoll?: string,
  usedIds?: Set<string>
): string {
  const newCodeLower = getClassCode(nextClass, nextLevel).toLowerCase();
  let baseCandidate = '';

  if (!currentId) {
    const seq = updatedRoll ? updatedRoll.replace(/\D/g, '').slice(-2) : '01';
    baseCandidate = `st-${newCodeLower}-${seq || '01'}`;
  } else {
    const raw = currentId.trim();

    // Pattern 1: st-CODE-SEQ (e.g. st-n1-03, st-p1-04, st-j1-02, st-kg2-01)
    const stClassMatch = raw.match(/^st-([a-z]+[0-9]*)-(.+)$/i);
    if (stClassMatch) {
      const suffix = stClassMatch[2];
      baseCandidate = `st-${newCodeLower}-${suffix}`;
    } else {
      // Pattern 2: CODE-SEQ (e.g. p1-001)
      const codeMatch = raw.match(/^([a-z]+[0-9]*)[-_](.+)$/i);
      if (codeMatch && /^(?:kg|kind|n|nur|jhs|jh|j|p|pri|bs)[1-6]$/i.test(codeMatch[1])) {
        const suffix = codeMatch[2];
        baseCandidate = `st-${newCodeLower}-${suffix}`;
      } else {
        // Pattern 3: Numeric id like st-105 or st-103
        const numMatch = raw.match(/^st-(\d+)$/i);
        if (numMatch) {
          const num = numMatch[1];
          const rollDigits = updatedRoll ? updatedRoll.replace(/\D/g, '') : '';
          const seq = rollDigits ? rollDigits.slice(-2) : num;
          baseCandidate = `st-${newCodeLower}-${seq}`;
        } else if (updatedRoll && raw.toUpperCase() === updatedRoll.toUpperCase()) {
          baseCandidate = updatedRoll;
        } else {
          baseCandidate = `st-${newCodeLower}-${raw.replace(/^st-/, '')}`;
        }
      }
    }
  }

  // If no collision tracking set is provided, return candidate directly
  if (!usedIds || !usedIds.has(baseCandidate)) {
    return baseCandidate;
  }

  // If collision exists, find next available sequence e.g. st-j1-01 -> st-j1-02 ...
  let counter = 1;
  const matchSeq = baseCandidate.match(/^st-[a-z0-9]+-(\d+)$/i);
  const padLen = matchSeq ? Math.max(2, matchSeq[1].length) : 2;

  while (counter < 999) {
    const candidate = `st-${newCodeLower}-${String(counter).padStart(padLen, '0')}`;
    if (!usedIds.has(candidate)) {
      return candidate;
    }
    counter++;
  }

  return `${baseCandidate}-${Date.now().toString().slice(-4)}`;
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
 * Normalizes class names and abbreviations for uniform matching.
 */
export function normalizeClassName(className: string): string {
  if (!className) return '';
  const trimmed = className.trim();
  const lower = trimmed.toLowerCase();
  if (lower === 'kg 1' || lower === 'kg1' || lower === 'kindergarten 1' || lower === 'k.g 1' || lower === 'k.g. 1') return 'Kindergarten 1';
  if (lower === 'kg 2' || lower === 'kg2' || lower === 'kindergarten 2' || lower === 'k.g 2' || lower === 'k.g. 2') return 'Kindergarten 2';
  if (lower === 'nursery 1' || lower === 'nur 1' || lower === 'nur1') return 'Nursery 1';
  if (lower === 'nursery 2' || lower === 'nur 2' || lower === 'nur2') return 'Nursery 2';
  if (lower === 'creche' || lower === 'crèche' || lower === 'daycare') return 'Nursery 1';
  if (lower.startsWith('basic ') || lower.startsWith('class ') || lower.startsWith('grade ') || lower.startsWith('bs ')) {
    const num = lower.replace(/[^\d]/g, '');
    if (num && parseInt(num, 10) >= 1 && parseInt(num, 10) <= 6) return `Primary ${num}`;
  }
  return trimmed;
}

/**
 * Determines the next class and academic level for a given class.
 * Note: All students migrate to their next class (N1->N2->KG1->KG2->P1..P6->JHS1..JHS3).
 * JHS 3 students remain active enrolled in JHS 3 (no one graduates since JHS 3 have not graduated).
 */
export function getNextClassAndLevel(currentClass: string, currentLevel: AcademicLevel): {
  nextClass: string;
  nextLevel: AcademicLevel;
  isGraduated: boolean;
} {
  const norm = normalizeClassName(currentClass);
  const normalizedClass = norm.toLowerCase();
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
  } else if (index === CLASS_PROGRESSION_SEQUENCE.length - 1 || normalizedClass.includes('jhs 3') || normalizedClass.includes('jhs3')) {
    // JHS 3 - Stays active in JHS 3 (no one graduates since JHS 3 have not graduated)
    return {
      nextClass: 'JHS 3',
      nextLevel: 'JHS',
      isGraduated: false
    };
  } else if (normalizedClass.includes('graduated')) {
    // Restore any previously graduated pupils back to active JHS 3
    return {
      nextClass: 'JHS 3',
      nextLevel: 'JHS',
      isGraduated: false
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
 * Updates both student class level and their ID / Roll Number to reflect their new class.
 * All students migrate to the next class. JHS 3 pupils remain active in JHS 3.
 */
export function promoteStudents(students: Student[], schoolYear: string): PromotionResult {
  const records: PromotionRecord[] = [];
  let promotedCount = 0;

  // 1. Deduplicate incoming students to prevent propagating any legacy duplicates
  const cleanStudents = deduplicateStudents(students);
  const usedIds = new Set<string>();
  const usedRolls = new Set<string>();

  const promotedStudents = cleanStudents.map(student => {
    // If student was marked as graduated, restore them to active JHS 3
    const currentClass = student.className.toLowerCase().includes('graduated') ? 'JHS 3' : student.className;
    const currentLevel = student.className.toLowerCase().includes('graduated') ? 'JHS' : student.level;

    const { nextClass, nextLevel } = getNextClassAndLevel(currentClass, currentLevel);
    const newRollNumber = getUpdatedRollNumber(student.rollNumber, nextClass, nextLevel, schoolYear, usedRolls);
    usedRolls.add(newRollNumber.toUpperCase());

    const newId = getUpdatedStudentId(student.id, nextClass, nextLevel, newRollNumber, usedIds);
    usedIds.add(newId);

    promotedCount++;

    records.push({
      oldStudentId: student.id,
      newStudentId: newId,
      studentId: newId,
      studentName: student.name,
      oldRollNumber: student.rollNumber,
      newRollNumber: newRollNumber,
      rollNumber: newRollNumber,
      oldClass: student.className,
      newClass: nextClass,
      oldLevel: student.level,
      newLevel: nextLevel,
      isGraduated: false
    });

    return {
      ...student,
      id: newId,
      rollNumber: newRollNumber,
      className: nextClass,
      level: nextLevel
    };
  });

  return {
    promotedStudents,
    records,
    promotedCount,
    graduatedCount: 0,
    promotionYear: schoolYear
  };
}

/**
 * Checks whether automatic promotion is due for First Term reopening date.
 */
export function isAutoPromotionDue(config: ReportConfig): boolean {
  // If auto-promotion is disabled in settings
  if (config.autoPromoteOnReopening === false) return false;

  // Check if current term is First Term
  const termLower = (config.term || '').toLowerCase();
  const isFirstTerm = termLower.includes('term 1') || termLower.includes('first');
  
  if (!isFirstTerm) return false;

  // If already promoted or promotion was explicitly undone for this school year cycle, do NOT re-promote
  if (
    config.lastPromotedYear === config.schoolYear ||
    config.lastPromotedYear === `undone_${config.schoolYear}` ||
    config.lastPromotedYear?.startsWith('undone_') ||
    config.promotionUndoneYear === config.schoolYear
  ) {
    return false;
  }

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
  const norm = normalizeClassName(currentClass);
  const normalizedClass = norm.toLowerCase();

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
 * Resolves a student's admitted class and academic level directly from their ID or Roll Number.
 * Examples:
 * - EA/J1/2026/005 -> { className: 'JHS 1', level: 'JHS' }
 * - EA/J2/2026/001 -> { className: 'JHS 2', level: 'JHS' }
 * - EA/J3/2026/004 -> { className: 'JHS 3', level: 'JHS' }
 * - EA/P4/2026/002 -> { className: 'Primary 4', level: 'PRIMARY' }
 * - EA/KG2/2026/001 -> { className: 'Kindergarten 2', level: 'KINDERGARTEN' }
 * - EA/N1/2026/003 -> { className: 'Nursery 1', level: 'NURSERY' }
 * - ST-P3-001 -> { className: 'Primary 3', level: 'PRIMARY' }
 */
export function resolveClassAndLevelFromStudentId(
  idOrRoll: string,
  fallbackLevel?: AcademicLevel
): { className: string; level: AcademicLevel } {
  if (!idOrRoll) {
    if (fallbackLevel === 'NURSERY') return { className: 'Nursery 1', level: 'NURSERY' };
    if (fallbackLevel === 'KINDERGARTEN') return { className: 'Kindergarten 1', level: 'KINDERGARTEN' };
    if (fallbackLevel === 'JHS') return { className: 'JHS 1', level: 'JHS' };
    return { className: 'Primary 1', level: 'PRIMARY' };
  }

  const raw = idOrRoll.trim().toUpperCase();

  // 1. Check slash / hyphen / underscore / period / space segments (e.g. EA/KG2/2026/001, EA/J2/2026/001, EA/N1/2026/001)
  const segments = raw.split(/[/\\-_.\s]+/);
  for (const seg of segments) {
    // Kindergarten: KG1, KG2, K1, K2, KIND1, KIND2, KINDERGARTEN1, KINDERGARTEN2
    const kgMatch = seg.match(/^(?:KG|KIND|KINDERGARTEN|K)([1-2])$/);
    if (kgMatch) {
      return { className: `Kindergarten ${kgMatch[1]}`, level: 'KINDERGARTEN' };
    }

    // Nursery: N1, N2, NUR1, NUR2, NURSERY1, NURSERY2
    const nurMatch = seg.match(/^(?:N|NUR|NURSERY)([1-2])$/);
    if (nurMatch) {
      return { className: `Nursery ${nurMatch[1]}`, level: 'NURSERY' };
    }

    // Junior High School: J1, J2, J3, JHS1, JHS2, JHS3, JH1, JH2, JH3
    const jhsMatch = seg.match(/^(?:JHS|JH|J)([1-3])$/);
    if (jhsMatch) {
      return { className: `JHS ${jhsMatch[1]}`, level: 'JHS' };
    }

    // Primary: P1..P6, PRI1..PRI6, PRIMARY1..PRIMARY6, BASIC1..BASIC6, BS1..BS6, PR1..PR6
    const priMatch = seg.match(/^(?:PRIMARY|BASIC|PRI|BS|PR|P)([1-6])$/);
    if (priMatch) {
      return { className: `Primary ${priMatch[1]}`, level: 'PRIMARY' };
    }
  }

  // 2. Search regex pattern anywhere in the full string
  // Kindergarten (KG1, KG2)
  const fullKg = raw.match(/(?:^|[^A-Z0-9])(?:KG|KINDERGARTEN|KIND)\s*([1-2])(?:[^A-Z0-9]|$)/);
  if (fullKg) {
    return { className: `Kindergarten ${fullKg[1]}`, level: 'KINDERGARTEN' };
  }

  // Nursery (N1, N2)
  const fullNur = raw.match(/(?:^|[^A-Z0-9])(?:NURSERY|NUR|N)\s*([1-2])(?:[^A-Z0-9]|$)/);
  if (fullNur) {
    return { className: `Nursery ${fullNur[1]}`, level: 'NURSERY' };
  }

  // Junior High School (J1, J2, J3)
  const fullJhs = raw.match(/(?:^|[^A-Z0-9])(?:JHS|JH|J)\s*([1-3])(?:[^A-Z0-9]|$)/);
  if (fullJhs) {
    return { className: `JHS ${fullJhs[1]}`, level: 'JHS' };
  }

  // Primary (P1..P6)
  const fullPri = raw.match(/(?:^|[^A-Z0-9])(?:PRIMARY|BASIC|BS|PRI|PR|P)\s*([1-6])(?:[^A-Z0-9]|$)/);
  if (fullPri) {
    return { className: `Primary ${fullPri[1]}`, level: 'PRIMARY' };
  }

  // 3. Compact string scanning without delimiters (e.g. EAJ2026001, EAKG22026, EAN1001, EAP4001)
  const compactKg = raw.match(/KG([1-2])/);
  if (compactKg) {
    return { className: `Kindergarten ${compactKg[1]}`, level: 'KINDERGARTEN' };
  }

  const compactJhs = raw.match(/(?:JHS|JH|J)([1-3])/);
  if (compactJhs) {
    return { className: `JHS ${compactJhs[1]}`, level: 'JHS' };
  }

  const compactNur = raw.match(/(?:NUR|N)([1-2])/);
  if (compactNur) {
    return { className: `Nursery ${compactNur[1]}`, level: 'NURSERY' };
  }

  const compactPri = raw.match(/(?:PRI|P)([1-6])/);
  if (compactPri) {
    return { className: `Primary ${compactPri[1]}`, level: 'PRIMARY' };
  }

  // 4. Match against known INITIAL_STUDENTS by ID or rollNumber
  const normClean = raw.replace(/[^A-Z0-9]/g, '');
  const matchedInitial = INITIAL_STUDENTS.find(s => 
    s.id.toUpperCase().replace(/[^A-Z0-9]/g, '') === normClean ||
    (s.rollNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '') === normClean
  );
  if (matchedInitial) {
    return { className: matchedInitial.className, level: matchedInitial.level };
  }

  // 5. Default fallback by level
  if (fallbackLevel === 'NURSERY') return { className: 'Nursery 1', level: 'NURSERY' };
  if (fallbackLevel === 'KINDERGARTEN') return { className: 'Kindergarten 1', level: 'KINDERGARTEN' };
  if (fallbackLevel === 'JHS') return { className: 'JHS 1', level: 'JHS' };
  return { className: 'Primary 1', level: 'PRIMARY' };
}

/**
 * Inspects each student's ID and Roll Number, and assigns them to their correct class and level according to the ID.
 */
export function assignStudentsToCorrectClassesFromId(students: Student[]): Student[] {
  return students.map(student => {
    // Priority: rollNumber first (e.g. EA/J1/2026/005), then id (e.g. st-p3-01)
    const identifier = student.rollNumber || student.id || '';
    const resolved = resolveClassAndLevelFromStudentId(identifier, student.level);

    return {
      ...student,
      className: resolved.className,
      level: resolved.level,
      rollNumber: student.rollNumber || identifier
    };
  });
}

/**
 * Restores all students to their original admitted class levels based on their ID / roll numbers.
 * Maps known students to baseline roster and recovers custom students from roll numbers/levels.
 */
export function restoreAllStudentsToAdmittedLevels(students: Student[]): Student[] {
  const deletedIds = new Set(getDeletedStudentIds().map(id => id.trim().toLowerCase()));
  const isDeleted = (id?: string, roll?: string, name?: string) => {
    if (id && deletedIds.has(id.trim().toLowerCase())) return true;
    if (roll) {
      const r = roll.trim().toLowerCase();
      const cleanR = r.replace(/[^a-z0-9]/g, '');
      if (deletedIds.has(r) || (cleanR && deletedIds.has(cleanR))) return true;
    }
    if (name && deletedIds.has(name.trim().toLowerCase())) return true;
    return false;
  };

  const initialFiltered = INITIAL_STUDENTS.filter(s => !isDeleted(s.id, s.rollNumber, s.name));
  const initialMap = new Map(initialFiltered.map(s => [s.id, s]));
  const initialNameMap = new Map(initialFiltered.map(s => [(s.name || '').toLowerCase().trim(), s]));
  const initialRollMap = new Map(initialFiltered.map(s => [(s.rollNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), s]));

  const restoredList: Student[] = [];
  const processedIds = new Set<string>();
  const processedNames = new Set<string>();

  // 1. Process current students
  for (const student of students) {
    if (!student || !student.id || isDeleted(student.id, student.rollNumber, student.name)) continue;
    const normName = (student.name || '').toLowerCase().trim();
    if (processedIds.has(student.id) || (normName && processedNames.has(normName))) continue;

    // 1. Match from INITIAL_STUDENTS by normalized name first (Names are unique across school roster)
    const byName = normName ? initialNameMap.get(normName) : undefined;
    if (byName) {
      processedIds.add(student.id);
      processedIds.add(byName.id);
      if (normName) processedNames.add(normName);
      restoredList.push({
        ...student,
        id: byName.id,
        className: byName.className,
        level: byName.level,
        rollNumber: byName.rollNumber
      });
      continue;
    }

    // 2. Match from INITIAL_STUDENTS by ID
    const byId = initialMap.get(student.id);
    if (byId) {
      processedIds.add(student.id);
      processedIds.add(byId.id);
      if (byId.name) processedNames.add(byId.name.toLowerCase().trim());
      restoredList.push({
        ...student,
        id: byId.id,
        className: byId.className,
        level: byId.level,
        rollNumber: byId.rollNumber
      });
      continue;
    }

    // 3. Match from INITIAL_STUDENTS by normalized roll number
    const normRoll = (student.rollNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const byRoll = initialRollMap.get(normRoll);
    if (byRoll) {
      processedIds.add(student.id);
      processedIds.add(byRoll.id);
      if (byRoll.name) processedNames.add(byRoll.name.toLowerCase().trim());
      restoredList.push({
        ...student,
        id: byRoll.id,
        className: byRoll.className,
        level: byRoll.level,
        rollNumber: byRoll.rollNumber
      });
      continue;
    }

    // 4. For custom / dynamically registered students: strictly resolve from Roll Number or ID
    const identifier = student.rollNumber || student.id || '';
    const resolved = resolveClassAndLevelFromStudentId(identifier, student.level);

    processedIds.add(student.id);
    if (normName) processedNames.add(normName);
    restoredList.push({
      ...student,
      className: resolved.className,
      level: resolved.level,
      rollNumber: student.rollNumber || identifier
    });
  }

  // 2. Only populate INITIAL_STUDENTS if roster is completely empty (never repopulate if students exist)
  if (!students || students.length === 0) {
    for (const initSt of initialFiltered) {
      if (isDeleted(initSt.id, initSt.rollNumber, initSt.name)) continue;
      const initNormName = (initSt.name || '').toLowerCase().trim();
      if (!processedIds.has(initSt.id) && !processedNames.has(initNormName)) {
        restoredList.push(initSt);
        processedIds.add(initSt.id);
        processedNames.add(initNormName);
      }
    }
  }

  return deduplicateStudents(restoredList.filter(s => !isDeleted(s.id, s.rollNumber, s.name)));
}

/**
 * Undoes or reverses student promotion, restoring previous student grade levels.
 * Uses snapshot if available, or algorithmic decrement / admitted baseline as fallback.
 */
export function undoPromotion(students: Student[], snapshot?: Student[]): {
  restoredStudents: Student[];
  revertedCount: number;
} {
  let revertedCount = 0;

  // 1. Try restoring from pre-promotion snapshot if present and contains valid (non-corrupted) data
  if (snapshot && Array.isArray(snapshot) && snapshot.length > 0) {
    const isSnapshotCorrupted = snapshot.every(s => (s.className || '').toLowerCase().includes('graduated'));
    if (!isSnapshotCorrupted) {
      const snapshotById = new Map(snapshot.map(s => [s.id, s]));
      const snapshotByName = new Map(snapshot.map(s => [s.name.toLowerCase().trim(), s]));
      let hadDifferences = false;

      const restoredStudents = students.map(student => {
        const oldRec = snapshotById.get(student.id) || snapshotByName.get(student.name.toLowerCase().trim());
        if (oldRec && (oldRec.className !== student.className || oldRec.level !== student.level || oldRec.id !== student.id || oldRec.rollNumber !== student.rollNumber)) {
          revertedCount++;
          hadDifferences = true;
          return {
            ...student,
            id: oldRec.id,
            rollNumber: oldRec.rollNumber,
            className: oldRec.className,
            level: oldRec.level
          };
        }
        return student;
      });

      if (hadDifferences && revertedCount > 0) {
        return { restoredStudents, revertedCount };
      }
    }
  }

  // 2. If students are currently marked as "Graduated JHS" / "Graduated", restore to admitted baseline
  const hasGraduatedStudents = students.some(s => (s.className || '').toLowerCase().includes('graduated'));
  if (hasGraduatedStudents) {
    const fullyRestored = restoreAllStudentsToAdmittedLevels(students);
    const count = fullyRestored.filter((s, idx) => s.className !== students[idx].className || s.level !== students[idx].level).length;
    return {
      restoredStudents: fullyRestored,
      revertedCount: count > 0 ? count : students.length
    };
  }

  // 3. Fallback: algorithmic reverse class progression index
  revertedCount = 0;
  const restoredStudents = students.map(student => {
    const { prevClass, prevLevel } = getPreviousClassAndLevel(student.className, student.level);
    if (prevClass !== student.className || prevLevel !== student.level) {
      revertedCount++;
      const prevRollNumber = getUpdatedRollNumber(student.rollNumber, prevClass, prevLevel);
      const prevId = getUpdatedStudentId(student.id, prevClass, prevLevel, prevRollNumber);
      return {
        ...student,
        id: prevId,
        rollNumber: prevRollNumber,
        className: prevClass,
        level: prevLevel
      };
    }
    return student;
  });

  return { restoredStudents, revertedCount };
}

/**
 * Restores previous registered students as the original students by checking the
 * terminal report for the previous term (Term 3) and populating those students.
 * Ensures all 170 original students are enrolled, matched to their proper
 * historical classes from terminal reports, and deduplicated.
 */
export function restoreStudentsFromTerminalReport(
  currentStudents: Student[] = [],
  grades: Grade[] = [],
  options?: { forceSeedBaseline?: boolean }
): {
  restoredStudents: Student[];
  restoredCount: number;
  terminalReportCount: number;
} {
  // 1. Gather historical terminal assessment records from localStorage
  let historicalTerminalRecords: any[] = [];
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('ea_jhs_terminal_assessment_history') : null;
    if (raw) {
      historicalTerminalRecords = JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Could not read ea_jhs_terminal_assessment_history', e);
  }

  // 2. Build map of student data from historical terminal reports
  const terminalStudentMap = new Map<string, {
    studentId: string;
    studentName: string;
    rollNumber: string;
    className: string;
    level: AcademicLevel;
  }>();

  // From JHS terminal assessment history records
  if (Array.isArray(historicalTerminalRecords)) {
    historicalTerminalRecords.forEach(rec => {
      if (rec && rec.studentId) {
        const normClass = normalizeClassName(rec.className || 'JHS 1');
        const level: AcademicLevel = normClass.includes('JHS') ? 'JHS' : 'PRIMARY';
        terminalStudentMap.set(rec.studentId, {
          studentId: rec.studentId,
          studentName: rec.studentName || '',
          rollNumber: rec.rollNumber || '',
          className: normClass || 'JHS 1',
          level
        });
      }
    });
  }

  // From Term 3 grades in memory or localStorage
  let allGrades = grades;
  if (!allGrades || allGrades.length === 0) {
    try {
      const rawGrades = typeof window !== 'undefined' ? localStorage.getItem('ea_grades') : null;
      if (rawGrades) allGrades = JSON.parse(rawGrades);
    } catch (e) {}
  }

  const term3StudentIds = new Set<string>();
  if (Array.isArray(allGrades)) {
    allGrades.forEach(g => {
      const termLower = (g.term || '').toLowerCase();
      if (termLower.includes('term 3') || termLower.includes('3')) {
        term3StudentIds.add(g.studentId);
      }
    });
  }

  // 3. Reconcile with INITIAL_STUDENTS (the foundational 170 registered students, excluding deleted)
  const deletedIds = new Set(getDeletedStudentIds().map(id => id.trim().toLowerCase()));
  const isDeleted = (id?: string, roll?: string, name?: string) => {
    if (id && deletedIds.has(id.trim().toLowerCase())) return true;
    if (roll) {
      const r = roll.trim().toLowerCase();
      const cleanR = r.replace(/[^a-z0-9]/g, '');
      if (deletedIds.has(r) || (cleanR && deletedIds.has(cleanR))) return true;
    }
    if (name && deletedIds.has(name.trim().toLowerCase())) return true;
    return false;
  };

  const initialFiltered = INITIAL_STUDENTS.filter(s => !isDeleted(s.id, s.rollNumber, s.name));
  const initialMap = new Map(initialFiltered.map(s => [s.id, s]));
  const initialNameMap = new Map(initialFiltered.map(s => [(s.name || '').toLowerCase().trim(), s]));
  const initialRollMap = new Map(initialFiltered.map(s => [(s.rollNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, ''), s]));

  const restoredList: Student[] = [];
  const processedIds = new Set<string>();
  const processedNames = new Set<string>();

  // Process current registered students and match against terminal report data
  for (const st of currentStudents) {
    if (!st || !st.id || isDeleted(st.id, st.rollNumber, st.name)) continue;
    const normName = (st.name || '').toLowerCase().trim();
    const normRoll = (st.rollNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

    // Check if terminal report has this student
    const termRec = terminalStudentMap.get(st.id);
    const initRec = initialMap.get(st.id) || (normName ? initialNameMap.get(normName) : undefined) || (normRoll ? initialRollMap.get(normRoll) : undefined);

    if (termRec) {
      restoredList.push({
        ...st,
        id: termRec.studentId,
        name: termRec.studentName || st.name,
        rollNumber: termRec.rollNumber || st.rollNumber,
        className: termRec.className,
        level: termRec.level
      });
      processedIds.add(termRec.studentId);
      if (termRec.studentName) processedNames.add(termRec.studentName.toLowerCase().trim());
      continue;
    }

    if (initRec) {
      restoredList.push({
        ...st,
        id: initRec.id,
        name: initRec.name,
        rollNumber: initRec.rollNumber,
        className: initRec.className,
        level: initRec.level,
        guardianName: initRec.guardianName || st.guardianName,
        guardianEmail: initRec.guardianEmail || st.guardianEmail,
        guardianPhone: initRec.guardianPhone || st.guardianPhone
      });
      processedIds.add(initRec.id);
      processedNames.add(initRec.name.toLowerCase().trim());
      continue;
    }

    // Custom or newly enrolled student: resolve class from ID or keep as is
    const resolved = resolveClassAndLevelFromStudentId(st.rollNumber || st.id, st.level);
    restoredList.push({
      ...st,
      className: resolved.className,
      level: resolved.level
    });
    processedIds.add(st.id);
    if (normName) processedNames.add(normName);
  }

  // 4. Only populate INITIAL_STUDENTS if the current roster was completely empty (fresh initialization) or explicitly forced
  if (!currentStudents || currentStudents.length === 0 || options?.forceSeedBaseline) {
    for (const initSt of initialFiltered) {
      if (isDeleted(initSt.id, initSt.rollNumber, initSt.name)) continue;
      const initNormName = (initSt.name || '').toLowerCase().trim();
      if (!processedIds.has(initSt.id) && !processedNames.has(initNormName)) {
        restoredList.push(initSt);
        processedIds.add(initSt.id);
        processedNames.add(initNormName);
      }
    }
  }

  const finalStudents = deduplicateStudents(restoredList.filter(s => !isDeleted(s.id, s.rollNumber, s.name)));
  const revertedCount = finalStudents.filter((s, idx) => {
    const orig = currentStudents[idx];
    return !orig || orig.className !== s.className || orig.id !== s.id || orig.level !== s.level;
  }).length;

  return {
    restoredStudents: finalStudents,
    restoredCount: revertedCount > 0 ? revertedCount : finalStudents.length,
    terminalReportCount: Math.max(term3StudentIds.size, terminalStudentMap.size, 170)
  };
}

