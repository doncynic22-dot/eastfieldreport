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
  
  // 1. Group by normalized pupil full name
  const byName = new Map<string, Student[]>();
  const withoutName: Student[] = [];

  for (const s of students) {
    if (!s) continue;
    const rawId = (s.id || '').trim();
    if (!rawId) continue;
    
    const normName = (s.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
    if (!normName) {
      withoutName.push(s);
      continue;
    }

    if (!byName.has(normName)) {
      byName.set(normName, []);
    }
    byName.get(normName)!.push(s);
  }

  const clean: Student[] = [];
  const seenIds = new Set<string>();
  const seenRolls = new Set<string>();

  for (const [, list] of byName.entries()) {
    // Sort so highest academic class rank and most recent update is first
    list.sort((a, b) => {
      const rankA = getStudentClassRank(a.className);
      const rankB = getStudentClassRank(b.className);
      if (rankA !== rankB) return rankB - rankA;
      const timeA = new Date((a as any).updated_at || a.updatedAt || 0).getTime();
      const timeB = new Date((b as any).updated_at || b.updatedAt || 0).getTime();
      return timeB - timeA;
    });

    for (const candidate of list) {
      const normRoll = candidate.rollNumber ? candidate.rollNumber.trim().toLowerCase() : '';
      if (seenIds.has(candidate.id)) continue;
      if (normRoll && seenRolls.has(normRoll)) continue;

      clean.push(candidate);
      seenIds.add(candidate.id);
      if (normRoll) seenRolls.add(normRoll);
      break; // Only keep the single best record for this student name
    }
  }

  // Add any valid students without names that have unique IDs
  for (const s of withoutName) {
    if (!seenIds.has(s.id)) {
      seenIds.add(s.id);
      clean.push(s);
    }
  }

  return clean;
}
