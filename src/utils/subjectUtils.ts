import { Subject, Grade } from '../types';

export const CREATIVE_ARTS_ALIASES = [
  'sub-j-ca',
  'sub-p-art',
  'sub-k-ca',
  'sub-n-cr',
  'creative art',
  'creative arts',
  'creative arts and design',
  'creative art and design',
  'creative arts & design',
  'creative art & design',
  'cad',
  'art',
  'ca',
  'crt',
  'creativity'
];

export function isCreativeArtsSubject(subjectIdOrNameOrCode: string): boolean {
  if (!subjectIdOrNameOrCode) return false;
  const clean = subjectIdOrNameOrCode.toLowerCase().trim();
  return CREATIVE_ARTS_ALIASES.some(alias => clean === alias || clean.includes('creative') || clean.includes('creativity'));
}

export function getCanonicalSubjectId(subjectRef: string, studentLevel?: string): string {
  if (!subjectRef) return subjectRef;
  if (isCreativeArtsSubject(subjectRef)) {
    if (studentLevel === 'PRIMARY') return 'sub-p-art';
    if (studentLevel === 'KINDERGARTEN') return 'sub-k-ca';
    if (studentLevel === 'NURSERY') return 'sub-n-cr';
    return 'sub-j-ca';
  }
  return subjectRef;
}

/**
 * Robust check if a given subject reference (ID, name, or code) matches a target Subject object.
 */
export function matchesSubject(subjectRef: string, subjectObj: Subject): boolean {
  if (!subjectRef || !subjectObj) return false;
  const refLower = subjectRef.toLowerCase().trim();
  const idLower = subjectObj.id.toLowerCase().trim();
  const nameLower = subjectObj.name.toLowerCase().trim();
  const codeLower = subjectObj.code.toLowerCase().trim();

  // 1. Exact ID, Name, or Code
  if (refLower === idLower || refLower === nameLower || refLower === codeLower) {
    return true;
  }

  // 2. Creative Arts cross-alias matching
  if (isCreativeArtsSubject(refLower) && isCreativeArtsSubject(idLower)) {
    return true;
  }

  // 3. Normalized character stripping (spaces, punctuation)
  const normRef = refLower.replace(/[^a-z0-9]/g, '');
  const normName = nameLower.replace(/[^a-z0-9]/g, '');
  const normCode = codeLower.replace(/[^a-z0-9]/g, '');

  if (normRef.length > 0 && (normRef === normName || normRef === normCode || normRef === idLower.replace(/[^a-z0-9]/g, ''))) {
    return true;
  }

  return false;
}

/**
 * Finds a matching grade for a student and subject, handling term, year, and subject aliases.
 */
export function findMatchingGrade(
  studentGrades: Grade[],
  subject: Subject,
  term?: string,
  year?: string
): Grade | undefined {
  if (!studentGrades || studentGrades.length === 0 || !subject) return undefined;

  // First try matching both term and year with subject alias
  const exactTermMatch = studentGrades.find(g => {
    const isTermMatch = !term || !g.term || g.term === term;
    const isYearMatch = !year || !g.year || g.year === year;
    return isTermMatch && isYearMatch && matchesSubject(g.subjectId, subject);
  });

  if (exactTermMatch) return exactTermMatch;

  // Fallback to subject match only
  return studentGrades.find(g => matchesSubject(g.subjectId, subject));
}
