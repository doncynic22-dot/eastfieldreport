/**
 * Known baseline demo pupil IDs to be excluded from the live school registry.
 */
export const DEMO_PUPIL_IDS = new Set<string>([
  "st-105","st-110","st-n1-03","st-n1-04","st-n1-05","st-n1-06","st-n1-07","st-n1-08","st-n1-09","st-n1-10","st-n1-11","st-n1-12","st-n1-13",
  "st-111","st-112","st-n2-03","st-n2-04","st-n2-05","st-n2-06","st-n2-07","st-n2-08","st-n2-09","st-n2-10","st-n2-11","st-n2-12","st-n2-13",
  "st-106","st-113","st-kg1-03","st-kg1-04","st-kg1-05","st-kg1-06","st-kg1-07","st-kg1-08","st-kg1-09","st-kg1-10","st-kg1-11","st-kg1-12","st-kg1-13",
  "st-114","st-115","st-kg2-03","st-kg2-04","st-kg2-05","st-kg2-06","st-kg2-07","st-kg2-08","st-kg2-09","st-kg2-10","st-kg2-11","st-kg2-12","st-kg2-13",
  "st-101","st-102","st-p1-03","st-p1-04","st-p1-05","st-p1-06","st-p1-07","st-p1-08","st-p1-09","st-p1-10","st-p1-11","st-p1-12","st-p1-13","st-p1-14",
  "st-p2-01","st-p2-02","st-p2-03","st-p2-04","st-p2-05","st-p2-06","st-p2-07","st-p2-08","st-p2-09","st-p2-10","st-p2-11","st-p2-12","st-p2-13",
  "st-p3-01","st-p3-02","st-p3-03","st-p3-04","st-p3-05","st-p3-06","st-p3-07","st-p3-08","st-p3-09","st-p3-10","st-p3-11","st-p3-12","st-p3-13",
  "st-p4-01","st-p4-02","st-p4-03","st-p4-04","st-p4-05","st-p4-06","st-p4-07","st-p4-08","st-p4-09","st-p4-10","st-p4-11","st-p4-12","st-p4-13",
  "st-p5-01","st-p5-02","st-p5-03","st-p5-04","st-p5-05","st-p5-06","st-p5-07","st-p5-08","st-p5-09","st-p5-10","st-p5-11","st-p5-12","st-p5-13",
  "st-p6-01","st-p6-02","st-p6-03","st-p6-04","st-p6-05","st-p6-06","st-p6-07","st-p6-08","st-p6-09","st-p6-10","st-p6-11","st-p6-12","st-p6-13",
  "st-103","st-104","st-109","st-j1-04","st-j1-05","st-j1-06","st-j1-07","st-j1-08","st-j1-09","st-j1-10","st-j1-11","st-j1-12","st-j1-13",
  "st-107","st-108","st-j2-03","st-j2-04","st-j2-05","st-j2-06","st-j2-07","st-j2-08","st-j2-09","st-j2-10","st-j2-11","st-j2-12","st-j2-13",
  "st-j3-01","st-j3-02","st-j3-03","st-j3-04","st-j3-05","st-j3-06","st-j3-07","st-j3-08","st-j3-09","st-j3-10","st-j3-11","st-j3-12","st-j3-13"
]);

export function isDemoStudent(student?: { id?: string; rollNumber?: string; name?: string } | null): boolean {
  if (!student) return false;
  if (student.id && DEMO_PUPIL_IDS.has(student.id)) return true;
  return false;
}
