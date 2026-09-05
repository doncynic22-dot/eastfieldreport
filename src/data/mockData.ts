/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Student, Subject, User, GradingScaleRule, ReportConfig, Grade, Attendance, FeePayment, ClassroomInventoryRecord, BookStockItem, BookSaleRecord } from '../types';

export const INITIAL_CLASSES = {
  NURSERY: ['Nursery 1', 'Nursery 2'],
  KINDERGARTEN: ['Kindergarten 1', 'Kindergarten 2'],
  PRIMARY: ['Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6'],
  JHS: ['JHS 1', 'JHS 2', 'JHS 3']
};

export const INITIAL_SUBJECTS: Subject[] = [
  // Nursery
  { id: 'sub-n-cr', name: 'CREATIVITY', code: 'CRT', level: 'NURSERY' },
  { id: 'sub-n-lit', name: 'LITERACY / LANGUAGE', code: 'LIT', level: 'NURSERY' },
  { id: 'sub-n-num', name: 'NUMERACY', code: 'NUM', level: 'NURSERY' },
  { id: 'sub-n-pho', name: 'PHONICS', code: 'PHO', level: 'NURSERY' },
  { id: 'sub-n-psy', name: 'PSYCHOMOTOR SKILLS', code: 'PSY', level: 'NURSERY' },

  // Kindergarten
  { id: 'sub-k-lit', name: 'LITERACY / LANGUAGE', code: 'LIT', level: 'KINDERGARTEN' },
  { id: 'sub-k-num', name: 'NUMERACY', code: 'NUM', level: 'KINDERGARTEN' },
  { id: 'sub-k-owop', name: 'OUR WORLD OUR PEOPLE', code: 'OWOP', level: 'KINDERGARTEN' },
  { id: 'sub-k-ca', name: 'CREATIVE ARTS', code: 'CA', level: 'KINDERGARTEN' },
  { id: 'sub-k-wrt', name: 'WRITING', code: 'WRT', level: 'KINDERGARTEN' },

  // Primary
  { id: 'sub-p-eng', name: 'English language', code: 'ENG', level: 'PRIMARY' },
  { id: 'sub-p-math', name: 'Mathematics', code: 'MAT', level: 'PRIMARY' },
  { id: 'sub-p-sci', name: 'Science', code: 'SCI', level: 'PRIMARY' },
  { id: 'sub-p-his', name: 'History', code: 'HIS', level: 'PRIMARY' },
  { id: 'sub-p-rme', name: 'Religious and Moral Education', code: 'RME', level: 'PRIMARY' },
  { id: 'sub-p-gh', name: 'Akuapem Twi', code: 'TWI', level: 'PRIMARY' },
  { id: 'sub-p-art', name: 'Creative Arts', code: 'ART', level: 'PRIMARY' },
  { id: 'sub-p-soc', name: 'Our World Our People', code: 'OWOP', level: 'PRIMARY' },
  { id: 'sub-p-ict', name: 'Computing', code: 'COMP', level: 'PRIMARY' },
  { id: 'sub-p-fr', name: 'French', code: 'FRE', level: 'PRIMARY' },

  // JHS
  { id: 'sub-j-eng', name: 'English language', code: 'ENG', level: 'JHS' },
  { id: 'sub-j-math', name: 'Mathematics', code: 'MAT', level: 'JHS' },
  { id: 'sub-j-sci', name: 'Science', code: 'SCI', level: 'JHS' },
  { id: 'sub-j-soc', name: 'Social Studies', code: 'SOC', level: 'JHS' },
  { id: 'sub-j-car', name: 'Career Technology', code: 'CAR', level: 'JHS' },
  { id: 'sub-j-rme', name: 'Religious and Moral Education', code: 'RME', level: 'JHS' },
  { id: 'sub-j-gh', name: 'Akuapem Twi', code: 'TWI', level: 'JHS' },
  { id: 'sub-j-ca', name: 'Creative Arts and Design', code: 'CAD', level: 'JHS' },
  { id: 'sub-j-fr', name: 'French', code: 'FRE', level: 'JHS' },
  { id: 'sub-j-ict', name: 'Computing', code: 'COMP', level: 'JHS' }
];

export const INITIAL_STUDENTS: Student[] = [];

export const INITIAL_GRADING_SCALE: GradingScaleRule[] = [
  { grade: 'A1', minScore: 80, maxScore: 100, gpa: 4.0, remarks: 'HIGHEST' },
  { grade: 'B2', minScore: 70, maxScore: 79.9, gpa: 3.5, remarks: 'HIGHER' },
  { grade: 'B3', minScore: 60, maxScore: 69.9, gpa: 3.0, remarks: 'HIGH' },
  { grade: 'C4', minScore: 55, maxScore: 59.9, gpa: 2.5, remarks: 'HIGH AVERAGE' },
  { grade: 'C5', minScore: 50, maxScore: 54.9, gpa: 2.0, remarks: 'AVERAGE' },
  { grade: 'C6', minScore: 40, maxScore: 49.9, gpa: 1.5, remarks: 'LOW AVERAGE' },
  { grade: 'D7', minScore: 30, maxScore: 39.9, gpa: 1.0, remarks: 'LOW' },
  { grade: 'E8', minScore: 20, maxScore: 29.9, gpa: 0.5, remarks: 'LOWER' },
  { grade: 'F9', minScore: 0, maxScore: 19.9, gpa: 0.0, remarks: 'LOWEST' }
];

export const DEFAULT_REPORT_CONFIG: ReportConfig = {
  schoolName: 'Eastfield Academy',
  schoolYear: '2025/2026',
  term: 'Term 1',
  gradingScale: INITIAL_GRADING_SCALE,
  principalName: 'Dr. Evelyn Asare-Bediako',
  schoolLogoText: 'EA',
  classScoreWeight: 50, // 50% Class Score
  examScoreWeight: 50,  // 50% Terminal Exams
  selectedTemplate: 'dynamic',
  reopeningDate: '2026-09-15',
  autoPromoteOnReopening: false,
  schoolMotto: 'Knowledge, Character & Excellence',
  customNoticeNote: '',
  showPositionInClass: true,
  showConductColumn: true,
  showAttendanceSection: true,
  accentColor: '#1e1b4b',
  watermarkText: 'EASTFIELD ACADEMY'
};

export const INITIAL_USERS: User[] = [
  // Nursery
  { id: "tch-01", name: "Kojo Mensah (Nursery 1)", email: "nursery@eastfield.com", role: "TEACHER", password: "password123", level: "NURSERY", classes: ["Nursery 1"], subjects: ["sub-n-lit", "sub-n-num"] },
  { id: "tch-n2", name: "Esi Agyeman (Nursery 2)", email: "nursery2@eastfield.com", role: "TEACHER", password: "password123", level: "NURSERY", classes: ["Nursery 2"], subjects: ["sub-n-cr", "sub-n-pho"] },
  // Kindergarten
  { id: "tch-k1", name: "Akosua Boakye (KG 1)", email: "kg1@eastfield.com", role: "TEACHER", password: "password123", level: "KINDERGARTEN", classes: ["Kindergarten 1"], subjects: ["sub-k-lit", "sub-k-num"] },
  { id: "tch-k2", name: "Kofi Osei (KG 2)", email: "kg2@eastfield.com", role: "TEACHER", password: "password123", level: "KINDERGARTEN", classes: ["Kindergarten 2"], subjects: ["sub-k-owop", "sub-k-ca"] },
  // Primary
  { id: "tch-02", name: "Ama Serwaa (Primary 1)", email: "primary@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 1"], subjects: ["sub-p-math", "sub-p-eng"] },
  { id: "tch-p2", name: "Kwame Nkrumah (Primary 2)", email: "primary2@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 2"], subjects: ["sub-p-math", "sub-p-eng"] },
  { id: "tch-p3", name: "Abena Darko (Primary 3)", email: "primary3@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 3"], subjects: ["sub-p-math", "sub-p-sci"] },
  { id: "tch-p4", name: "Yaa Asantewaa (Primary 4)", email: "primary4@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 4"], subjects: ["sub-p-eng", "sub-p-soc"] },
  { id: "tch-p5", name: "Kofi Addo (Primary 5)", email: "primary5@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 5"], subjects: ["sub-p-math", "sub-p-rme"] },
  { id: "tch-p6", name: "Adwoa Mansa (Primary 6)", email: "primary6@eastfield.com", role: "TEACHER", password: "password123", level: "PRIMARY", classes: ["Primary 6"], subjects: ["sub-p-eng", "sub-p-ict"] },
  // JHS (Unassigned initially so Admin can assign each class teacher)
  { id: "tch-03", name: "Kwesi Appiah", email: "jhs@eastfield.com", role: "TEACHER", password: "password123", level: "JHS", classes: [], subjects: ["sub-j-math", "sub-j-ca"] },
  { id: "tch-04", name: "Abena Gyamfi", email: "jhs2@eastfield.com", role: "TEACHER", password: "password123", level: "JHS", classes: [], subjects: ["sub-j-eng", "sub-j-sci"] },
  { id: "tch-05", name: "Yaw Asamoah", email: "jhs3@eastfield.com", role: "TEACHER", password: "password123", level: "JHS", classes: [], subjects: ["sub-j-soc", "sub-j-rme"] }
];

function getInitialGradeData(): Grade[] {
  const list: Grade[] = [];
  const subjectsByLevel: Record<string, Subject[]> = {
    NURSERY: INITIAL_SUBJECTS.filter(s => s.level === 'NURSERY'),
    KINDERGARTEN: INITIAL_SUBJECTS.filter(s => s.level === 'KINDERGARTEN'),
    PRIMARY: INITIAL_SUBJECTS.filter(s => s.level === 'PRIMARY'),
    JHS: INITIAL_SUBJECTS.filter(s => s.level === 'JHS')
  };

  const terms = ['Term 3', 'Term 1'];
  
  INITIAL_STUDENTS.forEach((st, sIdx) => {
    const subs = subjectsByLevel[st.level] || [];
    
    // Determine teacher ID
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

    terms.forEach((term, tIdx) => {
      subs.forEach((sub, subIdx) => {
        const seed = (sIdx * 17) + (subIdx * 11) + (tIdx * 7);
        let classScore = 36 + (seed % 12);
        let examScore = 38 + ((seed * 3) % 11);

        if (st.name.toLowerCase().includes('messiah') || st.name.toLowerCase().includes('kwame asante')) {
          classScore = 44 + (seed % 5);
          examScore = 46 + ((seed * 2) % 4);
        } else if (sIdx % 4 === 1) {
          classScore = 41 + (seed % 8);
          examScore = 42 + ((seed * 2) % 7);
        }

        classScore = Math.min(50, Math.max(25, classScore));
        examScore = Math.min(50, Math.max(25, examScore));
        const totalScore = classScore + examScore;

        let gradeLetter = 'B2';
        let remarks = 'VERY GOOD';
        let nurseryRemark: 'MO' | 'O' | 'S' | 'NA' | undefined = undefined;

        if (st.level === 'NURSERY') {
          if (totalScore >= 80) {
            nurseryRemark = 'MO';
            gradeLetter = 'A1';
            remarks = 'MO';
          } else if (totalScore >= 65) {
            nurseryRemark = 'O';
            gradeLetter = 'B2';
            remarks = 'O';
          } else {
            nurseryRemark = 'S';
            gradeLetter = 'C4';
            remarks = 'S';
          }
        } else {
          if (totalScore >= 80) {
            gradeLetter = 'A1';
            remarks = 'EXCELLENT';
          } else if (totalScore >= 70) {
            gradeLetter = 'B2';
            remarks = 'VERY GOOD';
          } else if (totalScore >= 60) {
            gradeLetter = 'B3';
            remarks = 'GOOD';
          } else if (totalScore >= 55) {
            gradeLetter = 'C4';
            remarks = 'HIGH AVERAGE';
          } else {
            gradeLetter = 'C5';
            remarks = 'AVERAGE';
          }
        }

        list.push({
          studentId: st.id,
          subjectId: sub.id,
          classScore,
          examScore,
          totalScore,
          gradeLetter,
          remarks,
          nurseryRemark,
          term,
          year: '2025/2026',
          teacherId,
          updatedAt: new Date().toISOString()
        });
      });
    });
  });

  return list;
}

export const INITIAL_GRADES: Grade[] = getInitialGradeData();

function getInitialAttendanceData(): Attendance[] {
  const list: Attendance[] = [];
  const terms = ['Term 3', 'Term 1'];
  
  INITIAL_STUDENTS.forEach((st, idx) => {
    terms.forEach(term => {
      const daysPresent = 65 + ((idx * 3) % 6);
      list.push({
        studentId: st.id,
        term,
        year: '2025/2026',
        totalDays: 70,
        daysPresent,
        remarks: daysPresent >= 69 ? 'Outstanding punctuality and exemplary conduct.' : 'Very regular, hardworking, and attentive in class.',
        teacherId: 'tch-01',
        updatedAt: new Date().toISOString()
      });
    });
  });

  return list;
}

export const INITIAL_ATTENDANCE: Attendance[] = getInitialAttendanceData();

export const INITIAL_FEE_PAYMENTS: FeePayment[] = [];

export const DEFAULT_INVENTORY_DATA: ClassroomInventoryRecord[] = [];

export const DEFAULT_BOOK_STOCK_ITEMS: BookStockItem[] = [
  // Textbooks
  {
    id: 'bk-tb-01',
    title: 'Aki-Ola Core Mathematics for JHS',
    category: 'Textbook',
    publication: 'Aki-Ola Publications',
    subjectType: 'Mathematics',
    targetClass: 'JHS 1 - JHS 3',
    unitPrice: 85.0,
    costPrice: 65.0,
    quantityInStock: 150,
    quantitySold: 42,
    quantityRemaining: 108,
    lowStockThreshold: 20,
    shelfLocation: 'Shelf A-1 (Math)',
    notes: 'Approved NaCCA curriculum textbook for Junior High School.',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  },
  {
    id: 'bk-tb-02',
    title: 'Approachers Integrated Science for JHS',
    category: 'Textbook',
    publication: 'Approachers Series',
    subjectType: 'Science',
    targetClass: 'JHS 1 - JHS 3',
    unitPrice: 90.0,
    costPrice: 70.0,
    quantityInStock: 120,
    quantitySold: 35,
    quantityRemaining: 85,
    lowStockThreshold: 15,
    shelfLocation: 'Shelf A-2 (Science)',
    notes: 'Complete with practical experiments and examination review exercises.',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  },
  {
    id: 'bk-tb-03',
    title: 'Alpha & Omega English Language for Primary',
    category: 'Textbook',
    publication: 'Alpha & Omega',
    subjectType: 'English Language',
    targetClass: 'Primary 4 - Primary 6',
    unitPrice: 65.0,
    costPrice: 48.0,
    quantityInStock: 100,
    quantitySold: 28,
    quantityRemaining: 72,
    lowStockThreshold: 15,
    shelfLocation: 'Shelf B-1 (English)',
    notes: 'Comprehensive grammar, comprehension, and vocabulary builder.',
    createdAt: '2026-01-12T08:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  },
  {
    id: 'bk-tb-04',
    title: 'Excellence Social Studies for Primary Schools',
    category: 'Textbook',
    publication: 'Excellence Publications',
    subjectType: 'Social Studies',
    targetClass: 'Primary 1 - Primary 6',
    unitPrice: 60.0,
    costPrice: 45.0,
    quantityInStock: 80,
    quantitySold: 18,
    quantityRemaining: 62,
    lowStockThreshold: 15,
    shelfLocation: 'Shelf B-2 (Social)',
    notes: 'Cultural studies, history, and citizenship education.',
    createdAt: '2026-01-12T08:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  },
  {
    id: 'bk-tb-05',
    title: 'Winmat Computing for Basic Schools',
    category: 'Textbook',
    publication: 'Winmat Publishers',
    subjectType: 'Computing / ICT',
    targetClass: 'All Classes',
    unitPrice: 75.0,
    costPrice: 55.0,
    quantityInStock: 90,
    quantitySold: 25,
    quantityRemaining: 65,
    lowStockThreshold: 15,
    shelfLocation: 'Shelf C-1 (ICT)',
    notes: 'Hands-on practical computing and algorithmic thinking.',
    createdAt: '2026-01-15T08:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  },
  {
    id: 'bk-tb-06',
    title: 'Sedco Religious & Moral Education (RME)',
    category: 'Textbook',
    publication: 'Sedco Publishing',
    subjectType: 'Religious and Moral Education',
    targetClass: 'Primary 1 - Primary 6',
    unitPrice: 55.0,
    costPrice: 40.0,
    quantityInStock: 70,
    quantitySold: 14,
    quantityRemaining: 56,
    lowStockThreshold: 15,
    shelfLocation: 'Shelf C-2 (RME)',
    notes: 'Moral values, social responsibility and world religions.',
    createdAt: '2026-01-15T08:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  },
  {
    id: 'bk-tb-07',
    title: 'Pearson Akuapem Twi Reader',
    category: 'Textbook',
    publication: 'Pearson Ghana',
    subjectType: 'Akuapem Twi',
    targetClass: 'All Classes',
    unitPrice: 50.0,
    costPrice: 38.0,
    quantityInStock: 60,
    quantitySold: 12,
    quantityRemaining: 48,
    lowStockThreshold: 10,
    shelfLocation: 'Shelf D-1 (Languages)',
    notes: 'Graded local Ghanaian language reader.',
    createdAt: '2026-01-18T08:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z'
  },

  // Customised Exercise Books
  {
    id: 'bk-eb-01',
    title: 'Custom Branded 40-Page Exercise Book (Single Line)',
    category: 'Customised Exercise Book',
    publication: 'Eastfield Academy Press / Crest Edition',
    subjectType: 'General / Writing',
    targetClass: 'All Classes',
    unitPrice: 8.0,
    costPrice: 5.5,
    quantityInStock: 1200,
    quantitySold: 480,
    quantityRemaining: 720,
    lowStockThreshold: 100,
    shelfLocation: 'Main Store Bay 1',
    notes: 'Full-colour embossed school crest cover with student bio box on back.',
    createdAt: '2026-01-05T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z'
  },
  {
    id: 'bk-eb-02',
    title: 'Custom Branded 60-Page Exercise Book (Broad Line)',
    category: 'Customised Exercise Book',
    publication: 'Eastfield Academy Press / Crest Edition',
    subjectType: 'English / Literacy',
    targetClass: 'Kindergarten & Primary 1-3',
    unitPrice: 10.0,
    costPrice: 7.0,
    quantityInStock: 800,
    quantitySold: 320,
    quantityRemaining: 480,
    lowStockThreshold: 80,
    shelfLocation: 'Main Store Bay 1',
    notes: 'Special wide ruling for early childhood handwriting development.',
    createdAt: '2026-01-05T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z'
  },
  {
    id: 'bk-eb-03',
    title: 'Custom Branded 80-Page Exercise Book (Single Line)',
    category: 'Customised Exercise Book',
    publication: 'Eastfield Academy Press / Crest Edition',
    subjectType: 'General / Notes',
    targetClass: 'Primary 4 - JHS 3',
    unitPrice: 12.0,
    costPrice: 8.5,
    quantityInStock: 950,
    quantitySold: 410,
    quantityRemaining: 540,
    lowStockThreshold: 90,
    shelfLocation: 'Main Store Bay 2',
    notes: 'High-gsm woodfree paper with durable coated school crest cover.',
    createdAt: '2026-01-05T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z'
  },
  {
    id: 'bk-eb-04',
    title: 'Custom Branded Math Grid Exercise Book (Square Ruled)',
    category: 'Customised Exercise Book',
    publication: 'Eastfield Academy Press / Crest Edition',
    subjectType: 'Mathematics',
    targetClass: 'All Classes',
    unitPrice: 10.0,
    costPrice: 7.0,
    quantityInStock: 750,
    quantitySold: 260,
    quantityRemaining: 490,
    lowStockThreshold: 75,
    shelfLocation: 'Main Store Bay 2',
    notes: 'Standard 7mm square grids for arithmetic, geometry and tabular calculations.',
    createdAt: '2026-01-05T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z'
  },
  {
    id: 'bk-eb-05',
    title: 'Custom Branded Drawing & Sketch Book',
    category: 'Customised Exercise Book',
    publication: 'Eastfield Academy Press / Crest Edition',
    subjectType: 'Creative Arts & Design',
    targetClass: 'All Classes',
    unitPrice: 15.0,
    costPrice: 10.5,
    quantityInStock: 400,
    quantitySold: 95,
    quantityRemaining: 305,
    lowStockThreshold: 40,
    shelfLocation: 'Main Store Bay 3',
    notes: 'Cartridge drawing paper for art, shading, and technical sketching.',
    createdAt: '2026-01-08T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z'
  },
  {
    id: 'bk-eb-06',
    title: 'Custom Branded 120-Page Hardcover Notebook',
    category: 'Customised Exercise Book',
    publication: 'Eastfield Academy Press / Crest Edition',
    subjectType: 'General / JHS',
    targetClass: 'JHS 1 - JHS 3',
    unitPrice: 22.0,
    costPrice: 16.0,
    quantityInStock: 350,
    quantitySold: 110,
    quantityRemaining: 240,
    lowStockThreshold: 30,
    shelfLocation: 'Cabinet 3',
    notes: 'Reinforced sewn hardback spine for major notes and record keeping.',
    createdAt: '2026-01-08T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z'
  },

  // Customised Textbooks
  {
    id: 'bk-ct-01',
    title: 'Eastfield Custom Phonics & Early Literacy Workbook',
    category: 'Customised Textbook',
    publication: 'Eastfield Academy Press',
    subjectType: 'Literacy / Language',
    targetClass: 'Kindergarten & Primary 1',
    unitPrice: 45.0,
    costPrice: 32.0,
    quantityInStock: 200,
    quantitySold: 78,
    quantityRemaining: 122,
    lowStockThreshold: 25,
    shelfLocation: 'Shelf E-1 (Custom)',
    notes: 'Specially authored school curriculum workbook with audio-visual phonics drills.',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z'
  },
  {
    id: 'bk-ct-02',
    title: 'Eastfield Custom Mental Math & Speed Drills Booklet',
    category: 'Customised Textbook',
    publication: 'Eastfield Academy Press',
    subjectType: 'Mathematics',
    targetClass: 'Primary 1 - Primary 6',
    unitPrice: 40.0,
    costPrice: 28.0,
    quantityInStock: 250,
    quantitySold: 95,
    quantityRemaining: 155,
    lowStockThreshold: 30,
    shelfLocation: 'Shelf E-2 (Custom)',
    notes: 'Daily mental computation drills, times table mastery and olympiad problems.',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z'
  },
  {
    id: 'bk-ct-03',
    title: 'Eastfield ICT Practical Lab Guide & Workbook',
    category: 'Customised Textbook',
    publication: 'Eastfield Academy Press',
    subjectType: 'Computing / ICT',
    targetClass: 'Primary 4 - JHS 3',
    unitPrice: 48.0,
    costPrice: 34.0,
    quantityInStock: 180,
    quantitySold: 60,
    quantityRemaining: 120,
    lowStockThreshold: 20,
    shelfLocation: 'Shelf E-3 (Custom)',
    notes: 'Step-by-step practical computer lab manual including typing and coding.',
    createdAt: '2026-01-12T08:00:00.000Z',
    updatedAt: '2026-09-02T08:00:00.000Z'
  }
];

export const DEFAULT_BOOK_SALES: BookSaleRecord[] = [
  {
    id: 'sale-001',
    receiptNumber: 'BK-2026-0001',
    buyerName: 'Charles Osei',
    buyerType: 'Parent',
    studentId: 'st-105',
    className: 'Nursery 1',
    contactNumber: '+233551234567',
    items: [
      {
        bookId: 'bk-eb-01',
        title: 'Custom Branded 40-Page Exercise Book (Single Line)',
        category: 'Customised Exercise Book',
        publication: 'Eastfield Academy Press / Crest Edition',
        subjectType: 'General / Writing',
        quantity: 5,
        unitPrice: 8.0,
        totalPrice: 40.0
      },
      {
        bookId: 'bk-eb-02',
        title: 'Custom Branded 60-Page Exercise Book (Broad Line)',
        category: 'Customised Exercise Book',
        publication: 'Eastfield Academy Press / Crest Edition',
        subjectType: 'English / Literacy',
        quantity: 4,
        unitPrice: 10.0,
        totalPrice: 40.0
      },
      {
        bookId: 'bk-ct-01',
        title: 'Eastfield Custom Phonics & Early Literacy Workbook',
        category: 'Customised Textbook',
        publication: 'Eastfield Academy Press',
        subjectType: 'Literacy / Language',
        quantity: 1,
        unitPrice: 45.0,
        totalPrice: 45.0
      }
    ],
    subtotal: 125.0,
    discount: 0,
    totalAmount: 125.0,
    paymentMethod: 'Cash',
    paymentReference: 'CSH-001',
    saleDate: '2026-09-02',
    saleTime: '08:45',
    recordedBy: 'Administrator',
    remarks: 'Term 1 starter pack bundle for Abena Osei',
    createdAt: '2026-09-02T08:45:00.000Z'
  },
  {
    id: 'sale-002',
    receiptNumber: 'BK-2026-0002',
    buyerName: 'Seth Ofori',
    buyerType: 'Parent',
    studentId: 'st-106',
    className: 'Kindergarten 1',
    contactNumber: '+233241112233',
    items: [
      {
        bookId: 'bk-eb-01',
        title: 'Custom Branded 40-Page Exercise Book (Single Line)',
        category: 'Customised Exercise Book',
        publication: 'Eastfield Academy Press / Crest Edition',
        subjectType: 'General / Writing',
        quantity: 6,
        unitPrice: 8.0,
        totalPrice: 48.0
      },
      {
        bookId: 'bk-eb-04',
        title: 'Custom Branded Math Grid Exercise Book (Square Ruled)',
        category: 'Customised Exercise Book',
        publication: 'Eastfield Academy Press / Crest Edition',
        subjectType: 'Mathematics',
        quantity: 3,
        unitPrice: 10.0,
        totalPrice: 30.0
      },
      {
        bookId: 'bk-eb-05',
        title: 'Custom Branded Drawing & Sketch Book',
        category: 'Customised Exercise Book',
        publication: 'Eastfield Academy Press / Crest Edition',
        subjectType: 'Creative Arts & Design',
        quantity: 1,
        unitPrice: 15.0,
        totalPrice: 15.0
      }
    ],
    subtotal: 93.0,
    discount: 3.0,
    totalAmount: 90.0,
    paymentMethod: 'Mobile Money',
    paymentReference: 'MM-9923847291',
    saleDate: '2026-09-02',
    saleTime: '09:15',
    recordedBy: 'Administrator',
    remarks: 'Paid via MTN MoMo',
    createdAt: '2026-09-02T09:15:00.000Z'
  },
  {
    id: 'sale-003',
    receiptNumber: 'BK-2026-0003',
    buyerName: 'Madam Mansa Adjei',
    buyerType: 'Parent',
    studentId: '',
    className: 'JHS 2',
    contactNumber: '+233208765432',
    items: [
      {
        bookId: 'bk-tb-01',
        title: 'Aki-Ola Core Mathematics for JHS',
        category: 'Textbook',
        publication: 'Aki-Ola Publications',
        subjectType: 'Mathematics',
        quantity: 1,
        unitPrice: 85.0,
        totalPrice: 85.0
      },
      {
        bookId: 'bk-tb-02',
        title: 'Approachers Integrated Science for JHS',
        category: 'Textbook',
        publication: 'Approachers Series',
        subjectType: 'Science',
        quantity: 1,
        unitPrice: 90.0,
        totalPrice: 90.0
      },
      {
        bookId: 'bk-eb-03',
        title: 'Custom Branded 80-Page Exercise Book (Single Line)',
        category: 'Customised Exercise Book',
        publication: 'Eastfield Academy Press / Crest Edition',
        subjectType: 'General / Notes',
        quantity: 4,
        unitPrice: 12.0,
        totalPrice: 48.0
      }
    ],
    subtotal: 223.0,
    discount: 0,
    totalAmount: 223.0,
    paymentMethod: 'Cash',
    paymentReference: 'CSH-003',
    saleDate: '2026-09-02',
    saleTime: '09:40',
    recordedBy: 'Administrator',
    remarks: 'JHS standard books purchase',
    createdAt: '2026-09-02T09:40:00.000Z'
  }
];
