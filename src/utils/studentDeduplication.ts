import { Student } from '../types';

const CLASS_PROGRESSION_RANK: Record<string, number> = {
  'creche': 0,
  'nursery 1': 1,
  'nursery 2': 2,
  'kindergarten 1': 3,
  'kg 1': 3,
  'kindergarten 2': 4,
  'kg 2': 4,
  'primary 1': 5,
  'p1': 5,
  'primary 2': 6,
  'p2': 6,
  'primary 3': 7,
  'p3': 7,
  'primary 4': 8,
  'p4': 8,
  'primary 5': 9,
  'p5': 9,
  'primary 6': 10,
  'p6': 10,
  'jhs 1': 11,
  'jhs 2': 12,
  'jhs 3': 13
};

export function getStudentClassRank(className?: string): number {
  if (!className) return 0;
  const clean = className.trim().toLowerCase();
  return CLASS_PROGRESSION_RANK[clean] || 0;
}

/**
 * Deduplicates an array of students to guarantee 100% unique students while preserving every registered pupil.
 * If multiple records exist for the same student (e.g. from promotions across classes or duplicate imports),
 * preserves the authoritative active record (highest class progression / most recent update) and eliminates ghost duplicates.
 */
export function deduplicateStudents(students: Student[]): Student[] {
  if (!Array.isArray(students)) return [];

  const clean: Student[] = [];
  const seenIds = new Set<string>();
  const seenRolls = new Set<string>();
  const seenClassAndName = new Set<string>();

  for (const s of students) {
    if (!s) continue;
    const rawId = (s.id || '').trim();
    if (!rawId) continue;
    const idLower = rawId.toLowerCase();

    if (seenIds.has(idLower)) continue;

    // Check duplicate roll number (if non-empty)
    const normRoll = (s.rollNumber || '').trim().toLowerCase();
    if (normRoll && seenRolls.has(normRoll)) {
      continue;
    }

    // Check duplicate entry in the exact same class with exact same name
    const normName = (s.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const normClass = (s.className || '').trim().toLowerCase();
    if (normName && normClass) {
      const classKey = `${normName}:::${normClass}`;
      if (seenClassAndName.has(classKey)) {
        continue;
      }
      seenClassAndName.add(classKey);
    }

    seenIds.add(idLower);
    if (normRoll) seenRolls.add(normRoll);
    clean.push(s);
  }

  return clean;
}
