import { Attendance, DailyAttendanceRecord, Student } from '../types';

export interface CalculatedStudentAttendance {
  daysPresent: number;
  totalDays: number;
  daysAbsent: number;
  rate: number;
  remarks: string;
}

/**
 * Calculates a student's term attendance strictly based on:
 * - Number of days marked PRESENT for each student
 * - Against the total number of days attendance was marked for the whole term (for the student's class)
 */
export function calculateStudentTermAttendance(
  student: Student,
  term: string,
  schoolYear: string,
  dailyAttendance: DailyAttendanceRecord[],
  attendance: Attendance[],
  allStudents: Student[]
): CalculatedStudentAttendance {
  if (!student) {
    return { daysPresent: 0, totalDays: 0, daysAbsent: 0, rate: 0, remarks: 'Not Recorded' };
  }

  const sId = (student.id || '').trim().toLowerCase();
  const sRoll = (student.rollNumber || '').trim().toLowerCase();
  const sClass = (student.className || '').trim().toLowerCase();

  const matchesStudent = (recordStudentId: string): boolean => {
    if (!recordStudentId) return false;
    const clean = recordStudentId.trim().toLowerCase();
    return (sId !== '' && clean === sId) || (sRoll !== '' && clean === sRoll);
  };

  // 1. Get all daily records for this active term & year (resilient to casing and missing values)
  const normTerm = (term || '').trim().toLowerCase();
  const normYear = (schoolYear || '').trim();

  const termDailyRecords = (dailyAttendance || []).filter(r => {
    if (!r) return false;
    const rTerm = (r.term || '').trim().toLowerCase();
    const rYear = (r.year || '').trim();
    const termOk = !normTerm || !rTerm || rTerm === normTerm;
    const yearOk = !normYear || !rYear || rYear === normYear;
    return termOk && yearOk;
  });

  // 2. Build fast lookup map for all students to resolve classes
  const studentMap = new Map<string, Student>();
  (allStudents || []).forEach(s => {
    if (s.id) studentMap.set(s.id.trim().toLowerCase(), s);
    if (s.rollNumber) studentMap.set(s.rollNumber.trim().toLowerCase(), s);
  });

  // 3. Identify all dates on which attendance was marked for this student's class (or for this student)
  const markedDates = new Set<string>();

  termDailyRecords.forEach(r => {
    if (!r.date) return;
    if (matchesStudent(r.studentId)) {
      markedDates.add(r.date);
    } else {
      const recId = (r.studentId || '').trim().toLowerCase();
      const recStudent = studentMap.get(recId);
      if (recStudent && recStudent.className && sClass && recStudent.className.trim().toLowerCase() === sClass) {
        markedDates.add(r.date);
      }
    }
  });

  // 4. Find all daily records specifically for this student
  const studentDailyLogs = termDailyRecords.filter(r => matchesStudent(r.studentId));
  studentDailyLogs.forEach(r => {
    if (r.date) markedDates.add(r.date);
  });

  // 5. If daily attendance has been recorded for this student/class in this term
  if (markedDates.size > 0) {
    const presentDates = new Set<string>();
    studentDailyLogs.forEach(r => {
      if (r.date && r.status === 'PRESENT') {
        presentDates.add(r.date);
      }
    });

    const daysPresent = presentDates.size;
    const totalDays = Math.max(markedDates.size, daysPresent);
    const daysAbsent = Math.max(0, totalDays - daysPresent);
    const rate = totalDays > 0 ? Math.round((daysPresent / totalDays) * 100) : 0;

    // Determine conduct / punctuality remark
    let autoRemark = 'Regular';
    if (rate >= 90) {
      autoRemark = 'Outstanding punctuality and exemplary conduct.';
    } else if (rate >= 75) {
      autoRemark = 'Regular, hardworking, and attentive in class.';
    } else if (rate >= 60) {
      autoRemark = 'Satisfactory attendance; encouraged to maintain punctuality.';
    } else {
      autoRemark = 'Irregular attendance; requires parental support and improvement.';
    }

    const existingAtt = (attendance || []).find(a => {
      if (!a || !matchesStudent(a.studentId)) return false;
      const aTerm = (a.term || '').trim().toLowerCase();
      const aYear = (a.year || '').trim();
      const termOk = !normTerm || !aTerm || aTerm === normTerm;
      const yearOk = !normYear || !aYear || aYear === normYear;
      return termOk && yearOk;
    });

    return {
      daysPresent,
      totalDays,
      daysAbsent,
      rate,
      remarks: existingAtt?.remarks || autoRemark
    };
  }

  // 6. If no daily roll call records exist, fall back to any manually entered Attendance record
  const existingAtt = (attendance || []).find(a => {
    if (!a || !matchesStudent(a.studentId)) return false;
    const aTerm = (a.term || '').trim().toLowerCase();
    const aYear = (a.year || '').trim();
    const termOk = !normTerm || !aTerm || aTerm === normTerm;
    const yearOk = !normYear || !aYear || aYear === normYear;
    return termOk && yearOk;
  });

  if (existingAtt && existingAtt.totalDays > 0) {
    const daysPresent = Math.min(existingAtt.daysPresent, existingAtt.totalDays);
    const totalDays = existingAtt.totalDays;
    const daysAbsent = Math.max(0, totalDays - daysPresent);
    const rate = totalDays > 0 ? Math.round((daysPresent / totalDays) * 100) : 0;
    return {
      daysPresent,
      totalDays,
      daysAbsent,
      rate,
      remarks: existingAtt.remarks || 'Regular'
    };
  }

  // 7. Default if no attendance has been marked at all yet
  return {
    daysPresent: 0,
    totalDays: 0,
    daysAbsent: 0,
    rate: 0,
    remarks: existingAtt?.remarks || 'Not Recorded'
  };
}

/**
 * Helper to get all distinct dates attendance was marked for a class in a given term
 */
export function getTermMarkedDatesCount(
  className: string,
  term: string,
  schoolYear: string,
  dailyAttendance: DailyAttendanceRecord[],
  allStudents: Student[]
): number {
  const dates = new Set<string>();
  const studentMap = new Map<string, Student>();
  allStudents.forEach(s => studentMap.set(s.id, s));

  dailyAttendance.forEach(r => {
    if ((!term || r.term === term) && (!schoolYear || r.year === schoolYear)) {
      if (className === 'ALL') {
        dates.add(r.date);
      } else {
        const s = studentMap.get(r.studentId);
        if (s && s.className === className) {
          dates.add(r.date);
        }
      }
    }
  });

  return dates.size;
}
