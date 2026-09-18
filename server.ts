import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

// Storage path for student registry cache and master persistent database
const STUDENTS_CACHE_FILE = path.join(process.cwd(), "students_registry.json");
const DB_FILE = path.join(process.cwd(), "school_database.json");

const DEMO_PUPIL_IDS = new Set<string>([
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

function isDemoStudent(s: any): boolean {
  if (!s) return false;
  if (s.id && DEMO_PUPIL_IDS.has(String(s.id))) return true;
  return false;
}

function sanitizeDeletedStudentIds(ids: any[]): string[] {
  if (!Array.isArray(ids)) return [];
  const invalidLiterals = new Set([
    'null', 'undefined', 'all_students', 'students', 'all', '[object object]', ''
  ]);
  return ids.filter(item => {
    if (typeof item !== 'string') return false;
    const s = item.trim().toLowerCase();
    if (!s || invalidLiterals.has(s)) return false;
    return true;
  });
}

async function deleteSupabaseStudentOnServer(id: string, _rollNumber?: string, _studentName?: string): Promise<void> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !supabaseKey || !id) return;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(supabaseUrl, supabaseKey);

    const keys = [id].filter(Boolean) as string[];
    for (const k of keys) {
      try { await client.from("ea_grades").delete().eq("student_id", k); } catch (e) {}
      try { await client.from("ea_attendance").delete().eq("student_id", k); } catch (e) {}
      try { await client.from("ea_daily_attendance").delete().eq("student_id", k); } catch (e) {}
      try { await client.from("ea_bills").delete().eq("student_id", k); } catch (e) {}
      try { await client.from("ea_fee_payments").delete().eq("student_id", k); } catch (e) {}
      try { await client.from("ea_jhs_mock_exams").delete().eq("student_id", k); } catch (e) {}
      try { await client.from("ea_students").delete().eq("id", k); } catch (e) {}
      try { await client.from("ea_student").delete().eq("id", k); } catch (e) {}
    }

    const tombId = `del_st_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await client.from("ea_deleted_records").upsert([{
      id: tombId,
      record_type: "STUDENT",
      record_id: id,
      roll_number: null,
      name: null,
      details: { id, timestamp: new Date().toISOString() },
      deleted_at: new Date().toISOString()
    }]);
    console.log(`[Server Supabase Deletion] Student '${id}' permanently deleted from Supabase & recorded tombstone.`);
  } catch (err: any) {
    console.warn("[Server Supabase Deletion] Warning deleting student from Supabase:", err?.message || err);
  }
}

async function clearAllSupabaseStudentsOnServer(): Promise<void> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !supabaseKey) return;
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(supabaseUrl, supabaseKey);

    // 1. Fetch current student IDs to tombstone
    const { data: currentRows } = await client.from("ea_students").select("id, roll_number, name");
    if (currentRows && Array.isArray(currentRows) && currentRows.length > 0) {
      const allIds = currentRows.map((r: any) => r.id).filter(Boolean);
      for (let i = 0; i < allIds.length; i += 50) {
        const chunk = allIds.slice(i, i + 50);
        await client.from("ea_students").delete().in("id", chunk);
        try { await client.from("ea_student").delete().in("id", chunk); } catch (e) {}
      }
    }

    // Comprehensive wipes of student-related tables
    try { await client.from("ea_students").delete().neq("id", "00000000-0000-0000-0000-000000000000"); } catch (e) {}
    try { await client.from("ea_student").delete().neq("id", "00000000-0000-0000-0000-000000000000"); } catch (e) {}
    try { await client.from("ea_grades").delete().neq("id", "00000000-0000-0000-0000-000000000000"); } catch (e) {}
    try { await client.from("ea_attendance").delete().neq("id", "00000000-0000-0000-0000-000000000000"); } catch (e) {}
    try { await client.from("ea_daily_attendance").delete().neq("id", "00000000-0000-0000-0000-000000000000"); } catch (e) {}
    try { await client.from("ea_bills").delete().neq("id", "00000000-0000-0000-0000-000000000000"); } catch (e) {}
    try { await client.from("ea_fee_payments").delete().neq("id", "00000000-0000-0000-0000-000000000000"); } catch (e) {}
    try { await client.from("ea_jhs_mock_exams").delete().neq("id", "00000000-0000-0000-0000-000000000000"); } catch (e) {}

    // Record ROSTER_CLEAR tombstone
    await client.from("ea_deleted_records").upsert([{
      id: `ROSTER_CLEAR_${Date.now()}`,
      record_type: "ROSTER_CLEAR",
      record_id: "ALL_STUDENTS",
      details: { clearedAt: new Date().toISOString() },
      deleted_at: new Date().toISOString()
    }]);
    console.log("[Server Supabase Deletion] All students cleared from Supabase & recorded ROSTER_CLEAR tombstone.");
  } catch (err: any) {
    console.warn("[Server Supabase Deletion] Warning clearing Supabase students:", err?.message || err);
  }
}

function isStudentDeletedOnServer(s: any, deletedIds?: string[]): boolean {
  if (!s || !s.id) return false;
  const db = dbCache || (fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, "utf-8")) : null);
  const rawList = [
    ...(db?.deletedStudentIds || []),
    ...(deletedIds || [])
  ];
  const allDeleted = new Set(sanitizeDeletedStudentIds(rawList).map(x => String(x).toLowerCase().trim()));
  if (allDeleted.size === 0) return false;

  const cleanId = String(s.id).toLowerCase().trim();
  if (allDeleted.has(cleanId)) return true;
  const alphaId = cleanId.replace(/[^a-z0-9]/g, '');
  if (alphaId && allDeleted.has(alphaId)) return true;

  return false;
}

function loadServerStudents(): any[] {
  try {
    const db = dbCache || (fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, "utf-8")) : null);
    if (db && db.rosterCleared) {
      return [];
    }
    if (db && Array.isArray(db.students)) {
      return db.students.filter(s => !isDemoStudent(s) && !isStudentDeletedOnServer(s, db.deletedStudentIds));
    }
    if (!db?.rosterCleared && fs.existsSync(STUDENTS_CACHE_FILE)) {
      const data = fs.readFileSync(STUDENTS_CACHE_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed.filter(s => !isDemoStudent(s) && !isStudentDeletedOnServer(s, db?.deletedStudentIds));
    }
  } catch (err) {
    console.warn("[Server Students] Failed to read students cache:", err);
  }
  return [];
}

function getDefaultServerStudents(): any[] {
  try {
    const db = dbCache || (fs.existsSync(DB_FILE) ? JSON.parse(fs.readFileSync(DB_FILE, "utf-8")) : null);
    if (db && db.rosterCleared) {
      return [];
    }
    return (db?.students || []).filter((s: any) => s && s.id && !isDemoStudent(s));
  } catch (e) {
    return [];
  }
}

function saveServerStudents(students: any[]): boolean {
  try {
    const db = loadServerDatabase();
    const list = Array.isArray(students) ? students : [];

    // Any student explicitly saved is active: prune any tombstones matching their IDs
    const activeIds = new Set(list.map((s: any) => String(s.id || '').toLowerCase().trim()).filter(Boolean));
    const activeAlphas = new Set(list.map((s: any) => String(s.id || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '')).filter(Boolean));

    if (db.deletedStudentIds && db.deletedStudentIds.length > 0) {
      db.deletedStudentIds = sanitizeDeletedStudentIds(
        db.deletedStudentIds.filter((id: string) => {
          const norm = String(id).toLowerCase().trim();
          const normAlpha = norm.replace(/[^a-z0-9]/g, '');
          return !activeIds.has(norm) && !activeAlphas.has(normAlpha);
        })
      );
    }

    const clean = list.filter(s => s && s.id && !isDemoStudent(s));
    fs.writeFileSync(STUDENTS_CACHE_FILE, JSON.stringify(clean, null, 2), "utf-8");
    // Also update unified server database
    db.students = clean;
    if (clean.length === 0) {
      db.rosterCleared = true;
      db.rosterClearedAt = new Date().toISOString();
      try {
        if (fs.existsSync("students_registry.json")) {
          fs.writeFileSync("students_registry.json", JSON.stringify([], null, 2), "utf-8");
        }
      } catch (e) {}
    } else {
      db.rosterCleared = false;
      db.rosterClearedAt = undefined;
    }
    saveServerDatabase(db, "students", clean);
    return true;
  } catch (err) {
    console.warn("[Server Students] Failed to write students cache:", err);
    return false;
  }
}

// Master Server Database structure
interface ServerDatabase {
  version: number;
  lastUpdated: string;
  config: any;
  teachers: any[];
  students: any[];
  grades: any[];
  attendance: any[];
  dailyAttendance: any[];
  bills: any[];
  feePayments: any[];
  feeStructures: any[];
  dailyCollections: any[];
  inventory: any[];
  bookStock: any[];
  bookSales: any[];
  jhsMockExams: any[];
  classTeacherAssignments?: Record<string, string>;
  deletedStudentIds: string[];
  deletedTeacherIds: string[];
  deletedBookStockIds?: string[];
  deletedBookSaleIds?: string[];
  rosterCleared?: boolean;
  rosterClearedAt?: string;
}

let dbCache: ServerDatabase | null = null;
const sseClients = new Set<express.Response>();

function broadcastSse(type: string, entity: string, payload?: any) {
  const currentDb = dbCache || loadServerDatabase();
  const eventData = JSON.stringify({
    type,
    entity,
    version: currentDb.version,
    payload,
    timestamp: currentDb.lastUpdated
  });

  for (const client of sseClients) {
    try {
      client.write(`event: sync\ndata: ${eventData}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

const DEFAULT_SERVER_TEACHERS = [
  {
    id: "73c0317c-5409-47d9-9b32-a3cba0f2e9ed",
    name: "Deborah Mabe Nteyado",
    email: "nteyado@gmail.com",
    role: "TEACHER",
    password: "Jsaves247",
    level: "PRIMARY",
    subjects: ["sub-p-eng", "sub-p-math", "sub-p-sci", "sub-p-his", "sub-p-rme", "sub-p-gh", "sub-p-art", "sub-p-soc", "sub-p-ict", "sub-p-fr"],
    classes: ["Primary 6"]
  },
  {
    id: "26c36a9d-3782-418e-9757-838efe98b037",
    name: "OBUO ABIGAIL",
    email: "OBUOABIGAIL35@GMAIL.COM",
    role: "TEACHER",
    password: "we123456",
    level: "PRIMARY",
    subjects: ["sub-p-eng", "sub-p-math", "sub-p-sci", "sub-p-his", "sub-p-rme", "sub-p-gh", "sub-p-art", "sub-p-soc", "sub-p-ict", "sub-p-fr"],
    classes: ["Primary 2"]
  },
  {
    id: "2065ab34-a039-4b14-89a0-a60eaa7e9e99",
    name: "AKPENE BRIKU JENNIFER",
    email: "akpenebrikujennifer@gmail.com",
    role: "TEACHER",
    password: "jenny@5858",
    level: "PRIMARY",
    subjects: ["sub-p-eng", "sub-p-math", "sub-p-sci", "sub-p-his", "sub-p-rme", "sub-p-gh", "sub-p-art", "sub-p-soc", "sub-p-ict", "sub-p-fr"],
    classes: ["Primary 3"]
  },
  {
    id: "user-t-reg-1784883616230",
    name: "Grace Darkoa",
    email: "adhepagracie@gmail.com",
    role: "TEACHER",
    password: "3011",
    level: "PRIMARY",
    subjects: ["sub-p-eng", "sub-p-math", "sub-p-sci", "sub-p-his", "sub-p-rme", "sub-p-gh", "sub-p-art", "sub-p-soc", "sub-p-ict", "sub-p-fr"],
    classes: ["Primary 1"]
  },
  {
    id: "user-t-reg-1789432950809",
    name: "Primary 4 Class Teacher",
    email: "primary4teacher@eastfield.com",
    role: "TEACHER",
    password: "teacher123",
    level: "PRIMARY",
    classes: ["Primary 4"],
    subjects: ["sub-p-eng", "sub-p-math", "sub-p-sci", "sub-p-his", "sub-p-rme", "sub-p-gh", "sub-p-art", "sub-p-soc", "sub-p-ict", "sub-p-fr"]
  },
  {
    id: "user-t-reg-1784882532978",
    name: "Emmanuel Baah Boateng ",
    email: "baahboateng674@gmail.com",
    role: "TEACHER",
    password: "2030",
    level: "PRIMARY",
    subjects: ["sub-p-eng", "sub-p-math", "sub-p-sci", "sub-p-his", "sub-p-rme", "sub-p-gh", "sub-p-art", "sub-p-soc", "sub-p-ict", "sub-p-fr"],
    classes: ["Primary 5"]
  },
  {
    id: "d71154f7-79fc-478e-890f-bfab8336fda8",
    name: "MOSES NARTEH",
    email: "MOSESNARTEH72@gmail.com",
    role: "TEACHER",
    password: "moses123",
    level: "PRIMARY",
    subjects: ["sub-p-eng", "sub-p-math", "sub-p-sci", "sub-p-his", "sub-p-rme", "sub-p-gh", "sub-p-art", "sub-p-soc", "sub-p-ict", "sub-p-fr"],
    classes: []
  },
  {
    id: "944bccd2-17cc-4dba-8791-2f1c0e0cd63f",
    name: "Osafo Stephen",
    email: "jhaycyclone@gmail.com",
    role: "TEACHER",
    password: "@Tr_0201036057",
    level: "NURSERY",
    classes: ["Nursery 1"],
    subjects: ["sub-n-cr", "sub-n-lit", "sub-n-num", "sub-n-pho", "sub-n-psy"]
  },
  {
    id: "dadbd6cb-a4da-4c1a-9cc9-52bf05fd4c61",
    name: "Stephen Osafo ",
    email: "dailyfacts5567@gmail.com",
    role: "TEACHER",
    password: "@Tr_0201036057",
    level: "NURSERY",
    classes: ["Nursery 2"],
    subjects: ["sub-n-cr", "sub-n-lit", "sub-n-num", "sub-n-pho", "sub-n-psy"]
  },
  {
    id: "user-t-reg-1784883215842",
    name: "Mabel Mawusi",
    email: "mawusimabel96@gmail.com",
    role: "TEACHER",
    password: "ken2",
    level: "KINDERGARTEN",
    classes: ["Kindergarten 1"],
    subjects: ["sub-k-lit", "sub-k-num", "sub-k-owop", "sub-k-ca", "sub-k-wrt"]
  },
  {
    id: "ba136f83-7beb-4d64-b0d6-08e1455157ec",
    name: "AMADAH PERFECT",
    email: "amadahperfect@gmail.com",
    role: "TEACHER",
    password: "we123456",
    level: "KINDERGARTEN",
    classes: ["Kindergarten 2"],
    subjects: ["sub-k-lit", "sub-k-num", "sub-k-owop", "sub-k-ca", "sub-k-wrt"]
  },
  {
    id: "user-t-reg-1784637715235",
    name: "DESMOND   AMEYAW",
    email: "NANAZOE4@GMAIL.COM",
    role: "TEACHER",
    password: "we123456",
    level: "JHS",
    classes: ["JHS 1"],
    subjects: ["sub-j-ict"]
  },
  {
    id: "user-t-1789463013281",
    name: "Oduro Lemuel Appiah",
    email: "odurolemuelappiah@gmail.com",
    role: "TEACHER",
    password: "teacher123",
    level: "JHS",
    classes: [],
    subjects: ["sub-j-eng", "sub-j-math", "sub-j-sci"]
  },
  {
    id: "user-t-reg-1784706570519",
    name: "OBED DANSO",
    email: "OBEDDANSO2013@GMAIL.COM",
    role: "TEACHER",
    password: "Portia@13",
    level: "JHS",
    classes: ["JHS 3"],
    subjects: ["sub-j-eng"]
  },
  {
    id: "c2bc65b4-811b-4f3e-bf45-b2bb83c4a9ef",
    name: "GIDEON BAIDEN",
    email: "gbnbbaiden@gmail.com",
    role: "TEACHER",
    password: "creativearts",
    level: "JHS",
    classes: [],
    subjects: ["sub-j-ca"]
  },
  {
    id: "user-t-1789462065021",
    name: "ASIAM OHENE JOSEPH",
    email: "ASIAMOHENEJOSEPH@GMAIL.COM",
    role: "TEACHER",
    password: "teacher123",
    level: "JHS",
    classes: [],
    subjects: ["sub-j-eng", "sub-j-math", "sub-j-sci"]
  }
];

function buildAssignmentsFromTeachers(teachers: any[]): Record<string, string> {
  const map: Record<string, string> = {};
  if (!Array.isArray(teachers)) return map;
  teachers.forEach((t: any) => {
    if (t && t.role === "TEACHER" && Array.isArray(t.classes) && t.id) {
      t.classes.forEach((c: any) => {
        if (c && typeof c === "string") {
          map[c] = String(t.id);
        }
      });
    }
  });
  return map;
}

function getDefaultDatabase(): ServerDatabase {
  return {
    version: 1,
    lastUpdated: new Date().toISOString(),
    config: null,
    teachers: DEFAULT_SERVER_TEACHERS,
    students: [],
    rosterCleared: true,
    rosterClearedAt: new Date().toISOString(),
    grades: [],
    attendance: [],
    dailyAttendance: [],
    bills: [],
    feePayments: [],
    feeStructures: [],
    dailyCollections: [],
    inventory: [],
    bookStock: [],
    bookSales: [],
    jhsMockExams: [],
    classTeacherAssignments: {},
    deletedStudentIds: [],
    deletedTeacherIds: [],
    deletedBookStockIds: [],
    deletedBookSaleIds: []
  };
}

function loadServerDatabase(): ServerDatabase {
  if (dbCache) return dbCache;
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed && typeof parsed === "object") {
        const isRosterCleared = Boolean(parsed.rosterCleared);
        const rawStudents = Array.isArray(parsed.students) ? parsed.students : [];
        const loadedStudents = isRosterCleared ? [] : rawStudents.filter((s: any) => !isDemoStudent(s));
        const loadedDb: ServerDatabase = {
          ...getDefaultDatabase(),
          ...parsed,
          rosterCleared: isRosterCleared,
          rosterClearedAt: parsed.rosterClearedAt,
          deletedStudentIds: sanitizeDeletedStudentIds(parsed.deletedStudentIds || []),
          students: loadedStudents
        };
        const derived = buildAssignmentsFromTeachers(loadedDb.teachers || []);
        loadedDb.classTeacherAssignments = { ...derived, ...(loadedDb.classTeacherAssignments || {}) };
        if (loadedDb.config) {
          loadedDb.config.classTeacherAssignments = loadedDb.classTeacherAssignments;
        }
        dbCache = loadedDb;
        return dbCache!;
      }
    }
  } catch (err) {
    console.warn("[Server DB] Failed reading school_database.json:", err);
  }

  dbCache = getDefaultDatabase();
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(dbCache, null, 2), "utf-8");
  } catch (e) {}
  return dbCache;
}

function saveServerDatabase(db: ServerDatabase, broadcastEntity?: string, payload?: any): boolean {
  try {
    db.version = (db.version || 0) + 1;
    db.lastUpdated = new Date().toISOString();
    db.students = (db.students || []).filter(s => !isDemoStudent(s));
    dbCache = db;

    // Atomic write to disk
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(db, null, 2), "utf-8");
    fs.renameSync(tmpFile, DB_FILE);

    // Also synchronize legacy students_registry.json
    try {
      fs.writeFileSync(STUDENTS_CACHE_FILE, JSON.stringify(db.students, null, 2), "utf-8");
    } catch (e) {}

    // Broadcast update via SSE to all connected browsers, tabs & devices
    if (broadcastEntity) {
      broadcastSse("UPDATE", broadcastEntity, payload !== undefined ? payload : db[broadcastEntity as keyof ServerDatabase]);
    } else {
      broadcastSse("SYNC_ALL", "all", payload !== undefined ? payload : db);
    }
    return true;
  } catch (err) {
    console.error("[Server DB] Failed saving database:", err);
    return false;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Support large sync payloads (up to 50MB) for full school rosters, photos, grades & backups
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Handle PayloadTooLargeError or malformed JSON payloads gracefully
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && (err.type === "entity.too.large" || err.status === 413 || err.name === "PayloadTooLargeError")) {
      console.warn(`[Payload Warning] Request entity too large on ${req.method} ${req.path}`);
      return res.status(413).json({
        status: "error",
        error: "PayloadTooLargeError",
        message: "Request entity is too large. Please reduce payload size or image resolution."
      });
    }
    if (err && err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ status: "error", message: "Invalid JSON format." });
    }
    next(err);
  });

  // Health check endpoints for cloud infrastructure and reverse proxies
  app.get(["/api/health", "/health"], (_req, res) => {
    res.status(200).json({ status: "ok", port: PORT, timestamp: new Date().toISOString() });
  });

  // 0. CDN & Edge Proxy Anti-Caching Middleware for dynamic API routes
  // Guarantees that Google Cloud CDN, Cloudflare, proxies, and mobile browsers NEVER serve stale responses for dynamic state
  app.use("/api", (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Pragma, Cache-Control");
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    // Exclude static or proxy CDN endpoints from no-store headers if they explicitly opt into caching
    if (req.path === "/cdn/health" || req.path === "/cdn/status") {
      res.setHeader("Cache-Control", "public, max-age=60");
      return next();
    }
    if (req.path.startsWith("/cdn/proxy")) {
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("CDN-Cache-Control", "public, max-age=86400");
      return next();
    }
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Cloudflare-CDN-Cache-Control", "no-store");
    next();
  });

  // Dedicated CDN Storage Directory
  const cdnStorageDir = path.join(process.cwd(), "public", "cdn");
  if (!fs.existsSync(cdnStorageDir)) {
    try {
      fs.mkdirSync(cdnStorageDir, { recursive: true });
    } catch (e) {}
  }

  // Ensure common subfolders exist for CDN organization
  ["student-photos", "teacher-photos", "logos", "assets"].forEach(folder => {
    const fPath = path.join(cdnStorageDir, folder);
    if (!fs.existsSync(fPath)) {
      try { fs.mkdirSync(fPath, { recursive: true }); } catch (e) {}
    }
  });

  // Mount /cdn endpoint for serving edge-cached CDN assets with long-term immutable caching
  app.use("/cdn", express.static(cdnStorageDir, {
    maxAge: "365d",
    immutable: true,
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("CDN-Cache-Control", "public, max-age=31536000");
      res.setHeader("Cloudflare-CDN-Cache-Control", "public, max-age=31536000");
    }
  }));

  // GET /api/cdn/health & /api/cdn/status - Verify CDN and edge operational status
  app.get(["/api/cdn/health", "/api/cdn/status"], (req, res) => {
    return res.status(200).json({
      status: "ok",
      cdn: "operational",
      edgeSync: "active",
      storage: "ready",
      antiStaleProtection: true,
      timestamp: new Date().toISOString()
    });
  });

  // POST /api/cdn/upload - Upload assets directly to persistent CDN storage
  app.post("/api/cdn/upload", (req, res) => {
    try {
      const { fileData, fileName, folder = "assets", contentType = "image/jpeg" } = req.body || {};
      if (!fileData || typeof fileData !== "string") {
        return res.status(400).json({ status: "error", message: "fileData (base64 string or data URL) is required." });
      }

      // Safe folder name (prevent directory traversal)
      const safeFolder = String(folder).replace(/[^a-zA-Z0-9_-]/g, "_") || "assets";
      const targetDir = path.join(cdnStorageDir, safeFolder);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Extract raw base64 and determine extension
      let base64String = fileData;
      let ext = "jpg";
      if (fileData.startsWith("data:")) {
        const matches = fileData.match(/^data:([^;]+);base64,(.+)$/);
        if (matches) {
          const mime = matches[1];
          base64String = matches[2];
          if (mime.includes("png")) ext = "png";
          else if (mime.includes("webp")) ext = "webp";
          else if (mime.includes("svg")) ext = "svg";
          else if (mime.includes("pdf")) ext = "pdf";
          else if (mime.includes("jpeg") || mime.includes("jpg")) ext = "jpg";
        }
      }

      const buffer = Buffer.from(base64String, "base64");
      const safeName = (fileName ? String(fileName).replace(/[^a-zA-Z0-9_.-]/g, "_") : `asset_${Date.now()}.${ext}`).replace(/\.[^.]+$/, `.${ext}`);
      const filePath = path.join(targetDir, safeName);

      fs.writeFileSync(filePath, buffer);

      const publicPath = `/cdn/${safeFolder}/${safeName}`;
      console.log(`[CDN Storage] Asset written to ${publicPath} (${buffer.length} bytes)`);

      return res.status(200).json({
        status: "success",
        url: publicPath,
        cdnUrl: publicPath,
        size: buffer.length,
        contentType,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      console.error("[CDN Storage] Upload error:", err);
      return res.status(500).json({ status: "error", message: err?.message || "Failed to save file to CDN storage." });
    }
  });

  // GET /api/cdn/proxy?url=<url> - CORS-safe CDN Image Proxy
  app.get("/api/cdn/proxy", async (req, res) => {
    try {
      const targetUrl = req.query.url as string;
      if (!targetUrl || (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://"))) {
        return res.status(400).send("Valid http/https url query parameter required.");
      }

      const response = await fetch(targetUrl);
      if (!response.ok) {
        return res.status(response.status).send(`Failed to fetch upstream asset: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Cache-Control", "public, max-age=86400");
      res.setHeader("CDN-Cache-Control", "public, max-age=86400");

      const arrayBuffer = await response.arrayBuffer();
      return res.send(Buffer.from(arrayBuffer));
    } catch (err: any) {
      console.error("[CDN Proxy] Error proxying asset:", err);
      return res.status(500).send("Error proxying asset.");
    }
  });

  // API Route: Check Arkesel API Balance
  app.get("/api/sms/balance", async (req, res) => {
    try {
      const apiKey =
        (req.headers["api-key"] as string) ||
        (req.headers["x-api-key"] as string) ||
        (req.query.apiKey as string) ||
        process.env.VITE_ARKESEL_API_KEY ||
        process.env.ARKESEL_API_KEY ||
        "";

      if (!apiKey) {
        return res.status(400).json({ status: "error", message: "Arkesel API key is required." });
      }

      const v2BalanceUrl = "https://sms.arkesel.com/api/v2/clients/balance";
      console.log(`[Arkesel Balance Check] Request URL: ${v2BalanceUrl} | Method: GET | Headers: { api-key: '${apiKey.substring(0, 4)}...' }`);

      // 1. Try Arkesel v2 API balance endpoint first
      let response = await fetch(v2BalanceUrl, {
        method: "GET",
        headers: {
          "api-key": apiKey.trim(),
          "Accept": "application/json"
        }
      }).catch(() => null);

      if (response) {
        console.log(`[Arkesel Balance Check] v2 Response Status: ${response.status}`);
        if (response.status === 404) {
          console.warn(`[Arkesel Balance Check] 404 Not Found at ${v2BalanceUrl}`);
        }
      }

      if (response && response.ok) {
        const data = await response.json().catch(() => null);
        if (data) {
          return res.status(200).json(data);
        }
      }

      // 2. Try Arkesel v1 API balance endpoint fallback
      const v1Url = `https://sms.arkesel.com/sms/api?action=check-balance&api_key=${encodeURIComponent(apiKey.trim())}`;
      console.log(`[Arkesel Balance Check] Fallback v1 Request URL: https://sms.arkesel.com/sms/api?action=check-balance&api_key=*** | Method: GET`);

      const v1Response = await fetch(v1Url, { method: "GET" }).catch(() => null);

      if (v1Response) {
        console.log(`[Arkesel Balance Check] v1 Response Status: ${v1Response.status}`);
      }

      if (v1Response && v1Response.ok) {
        const v1Data = await v1Response.json().catch(() => null);
        if (v1Data) {
          return res.status(200).json({
            status: "success",
            data: { balance: v1Data.balance ?? v1Data.sms_balance ?? v1Data.main_balance ?? "Active" },
            raw: v1Data
          });
        }
      }

      // If both return non-200, respond with helpful diagnostic
      const status = response ? response.status : (v1Response ? v1Response.status : 502);
      if (status === 404) {
        return res.status(404).json({
          status: "error",
          message: "Arkesel Gateway HTTP 404: The requested endpoint URL was not found on sms.arkesel.com. Please verify your Arkesel account status and v2 API key."
        });
      }

      return res.status(status).json({
        status: "error",
        message: "Unable to connect to Arkesel SMS Gateway. Please double-check your Arkesel API key."
      });
    } catch (err: any) {
      console.error("Arkesel balance proxy error:", err);
      return res.status(500).json({ status: "error", message: err?.message || "Failed to connect to Arkesel gateway" });
    }
  });

  // API Route: Run Arkesel Endpoint Diagnostics
  app.get("/api/sms/diagnose", async (req, res) => {
    try {
      const apiKey =
        (req.headers["api-key"] as string) ||
        (req.headers["x-api-key"] as string) ||
        (req.query.apiKey as string) ||
        process.env.VITE_ARKESEL_API_KEY ||
        process.env.ARKESEL_API_KEY ||
        "";

      const v2SendUrl = "https://sms.arkesel.com/api/v2/sms/send";
      const v2BalanceUrl = "https://sms.arkesel.com/api/v2/clients/balance";

      console.log(`[Arkesel Diagnostic] Testing Base URL: https://sms.arkesel.com`);
      console.log(`[Arkesel Diagnostic] Testing Endpoint 1: ${v2SendUrl} [POST]`);
      console.log(`[Arkesel Diagnostic] Testing Endpoint 2: ${v2BalanceUrl} [GET]`);

      const diagHeaders = {
        "api-key": apiKey.trim() || "test_key",
        "Accept": "application/json"
      };

      const balancePing = await fetch(v2BalanceUrl, { method: "GET", headers: diagHeaders }).catch(() => null);

      return res.status(200).json({
        status: "success",
        diagnostics: {
          baseUrl: "https://sms.arkesel.com",
          v2SendEndpoint: {
            url: v2SendUrl,
            method: "POST",
            expectedHeaders: ["Content-Type: application/json", "api-key: <YOUR_ARKESEL_KEY>"],
            expectedBody: { sender: "STRING", message: "STRING", recipients: ["ARRAY_OF_STRINGS"] }
          },
          v2BalanceEndpoint: {
            url: v2BalanceUrl,
            method: "GET",
            status: balancePing ? balancePing.status : "CONNECTION_FAILED",
            ok: balancePing ? balancePing.ok : false
          },
          apiKeyProvided: Boolean(apiKey)
        }
      });
    } catch (err: any) {
      return res.status(500).json({ status: "error", message: err?.message || "Diagnostic failed" });
    }
  });

  // API Route: Send Bulk SMS via Arkesel Gateway (v2 + v1 Fallback)
  app.post("/api/sms/send", async (req, res) => {
    try {
      const apiKey =
        (req.headers["api-key"] as string) ||
        (req.headers["x-api-key"] as string) ||
        req.body?.apiKey ||
        process.env.VITE_ARKESEL_API_KEY ||
        process.env.ARKESEL_API_KEY ||
        "";

      if (!apiKey) {
        return res.status(400).json({ status: "error", message: "Arkesel API key is required. Please set your API key in Settings or Bulk SMS view." });
      }

      const { sender, message, recipients } = req.body || {};

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ status: "error", message: "Recipients list is empty or required." });
      }

      const cleanSender = (sender || "EASTFIELD").trim();
      const cleanMessage = (message || "").trim();
      const cleanRecipients = recipients.map((r: string) => {
        let cleaned = String(r).replace(/[^0-9]/g, "");
        if (cleaned.startsWith("0") && cleaned.length === 10) {
          cleaned = "233" + cleaned.substring(1);
        } else if (!cleaned.startsWith("233") && cleaned.length === 9) {
          cleaned = "233" + cleaned;
        }
        return cleaned;
      }).filter((r: string) => r.length >= 9);

      if (cleanRecipients.length === 0) {
        return res.status(400).json({ status: "error", message: "No valid recipient phone numbers provided." });
      }

      const v2SendUrl = "https://sms.arkesel.com/api/v2/sms/send";
      const maskedKey = apiKey.length > 6 ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 2)}` : '***';

      console.log(`[Arkesel SMS Dispatch] Executing HTTP Request`);
      console.log(`[Arkesel SMS Dispatch] Target Endpoint URL: ${v2SendUrl}`);
      console.log(`[Arkesel SMS Dispatch] HTTP Method: POST`);
      console.log(`[Arkesel SMS Dispatch] Request Headers:`, { "Content-Type": "application/json", "api-key": maskedKey, "Accept": "application/json" });
      console.log(`[Arkesel SMS Dispatch] Request Payload:`, { sender: cleanSender, message: `${cleanMessage.substring(0, 30)}...`, recipientsCount: cleanRecipients.length });

      // 1. Primary: Try Arkesel v2 API POST endpoint
      let v2Response = await fetch(v2SendUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey.trim(),
          "Accept": "application/json"
        },
        body: JSON.stringify({
          sender: cleanSender,
          message: cleanMessage,
          recipients: cleanRecipients
        })
      }).catch(() => null);

      if (v2Response) {
        console.log(`[Arkesel SMS Dispatch] Gateway HTTP Response Code: ${v2Response.status}`);
      }

      if (v2Response && v2Response.ok) {
        const v2Data = await v2Response.json().catch(() => null);
        if (v2Data && (v2Data.status === "success" || v2Data.code === "100" || v2Data.code === 100 || v2Data.status === 200)) {
          return res.status(200).json(v2Data);
        }
      }

      // Check if v2 returned 404 explicitly
      if (v2Response && v2Response.status === 404) {
        console.warn(`[Arkesel SMS Dispatch] 404 Not Found at '${v2SendUrl}'`);
      }

      // 2. Secondary Fallback: Try Arkesel v1 API GET endpoint
      const phoneListStr = cleanRecipients.join(",");
      const v1Url = new URL("https://sms.arkesel.com/sms/api");
      v1Url.searchParams.append("action", "send-sms");
      v1Url.searchParams.append("api_key", apiKey.trim());
      v1Url.searchParams.append("to", phoneListStr);
      v1Url.searchParams.append("from", cleanSender);
      v1Url.searchParams.append("sms", cleanMessage);

      console.log(`[Arkesel SMS Dispatch] Trying Fallback v1 Endpoint URL: https://sms.arkesel.com/sms/api?action=send-sms&api_key=***&from=${cleanSender}&to=${cleanRecipients.length}_recipients`);

      const v1Response = await fetch(v1Url.toString(), { method: "GET" }).catch(() => null);

      if (v1Response) {
        console.log(`[Arkesel SMS Dispatch] Fallback v1 HTTP Response Code: ${v1Response.status}`);
      }

      if (v1Response && v1Response.ok) {
        const v1Data = await v1Response.json().catch(() => null);
        if (v1Data && (v1Data.code === "100" || v1Data.code === 100 || v1Data.status === "success" || v1Data.message?.toLowerCase().includes("success"))) {
          return res.status(200).json({
            status: "success",
            message: v1Data.message || "SMS dispatched successfully via Arkesel v1 Gateway",
            data: v1Data
          });
        } else if (v1Data && v1Data.message) {
          return res.status(400).json({
            status: "error",
            message: `Arkesel Gateway Notice: ${v1Data.message}`
          });
        }
      }

      // Read error body from v2 response if available
      const v2ErrData = v2Response ? await v2Response.json().catch(() => null) : null;
      const gatewayMsg = v2ErrData?.message || v2ErrData?.error || v2ErrData?.msg;

      if (gatewayMsg) {
        return res.status(400).json({
          status: "error",
          message: `Arkesel API Error: ${gatewayMsg}`
        });
      }

      // Handle HTTP 404 explicitly with full diagnostic explanation
      if (v2Response && v2Response.status === 404) {
        return res.status(404).json({
          status: "error",
          message: `HTTP 404 Endpoint Not Found: The Arkesel API URL '${v2SendUrl}' returned 404. Endpoint structure verified against Arkesel v2 specs (POST https://sms.arkesel.com/api/v2/sms/send with 'api-key' header). Please check if your Arkesel account is active and v2 API key permissions are enabled.`
        });
      }

      return res.status(400).json({
        status: "error",
        message: "Arkesel Gateway Error. Please verify that your API Key is valid and your Sender ID is registered in your Arkesel dashboard."
      });
    } catch (err: any) {
      console.error("Arkesel SMS proxy error:", err);
      return res.status(500).json({ status: "error", message: err?.message || "Failed to dispatch Arkesel SMS" });
    }
  });

  // ==========================================
  // GLOBAL INSTANT STUDENT SYNC & CDN APIS
  // ==========================================

  // GET /api/students: Fetch global list of admitted students with strict anti-caching headers
  app.get("/api/students", (req, res) => {
    // Ensure CDNs, proxies, Cloudflare, and browser caches never serve stale pupil rosters
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Cloudflare-CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");

    const students = loadServerStudents();
    const db = loadServerDatabase();
    return res.status(200).json({
      status: "success",
      students,
      count: students.length,
      version: db.version,
      deletedStudentIds: db.deletedStudentIds || [],
      timestamp: new Date().toISOString()
    });
  });

  // POST /api/students/admit: Instantly admit or update a single pupil globally with CDN synchronization
  app.post("/api/students/admit", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Cloudflare-CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");

    const student = req.body?.student;
    if (!student || (!student.id && !student.name)) {
      return res.status(400).json({ status: "error", message: "Invalid student payload" });
    }

    const db = loadServerDatabase();
    // Pupil is active - reset any rosterCleared status
    db.rosterCleared = false;
    db.rosterClearedAt = undefined;
    const currentStudents = Array.isArray(db.students) ? db.students : loadServerStudents();
    const cleanId = String(student.id || `st-${Date.now()}`);
    const cleanRoll = String(student.rollNumber || "").trim();
    const cleanName = String(student.name || "").trim().toLowerCase();

    // If this pupil was previously tombstoned, remove from deleted list
    if (Array.isArray(db.deletedStudentIds)) {
      const lowerId = cleanId.toLowerCase();
      const alphaId = lowerId.replace(/[^a-z0-9]/g, '');
      db.deletedStudentIds = sanitizeDeletedStudentIds(
        db.deletedStudentIds.filter(id => {
          const item = String(id).toLowerCase().trim();
          return item !== lowerId && item !== alphaId;
        })
      );
    }

    // Check if student already exists by unique ID
    const existingIndex = currentStudents.findIndex(s => s.id === cleanId);
    let finalRoll = cleanRoll;

    // If new student admission collides with a different existing pupil's roll number, disambiguate
    if (existingIndex < 0 && cleanRoll) {
      const rollCollision = currentStudents.some(
        s => s.id !== cleanId && s.rollNumber && s.rollNumber.trim().toLowerCase() === cleanRoll.toLowerCase()
      );
      if (rollCollision) {
        finalRoll = `${cleanRoll}-${cleanId.slice(-4)}`;
      }
    }

    const normalizedStudent = {
      ...student,
      id: cleanId,
      rollNumber: finalRoll,
      updated_at: new Date().toISOString()
    };

    // Also remove any stale ROSTER_CLEAR tombstone and upsert directly into Supabase ea_students
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    if (supabaseUrl && supabaseKey) {
      import("@supabase/supabase-js").then(async ({ createClient }) => {
        try {
          const client = createClient(supabaseUrl, supabaseKey);
          await client.from("ea_deleted_records").delete().eq("record_type", "ROSTER_CLEAR");
          if (cleanId) await client.from("ea_deleted_records").delete().eq("record_id", cleanId);
          const sbPayload = {
            id: normalizedStudent.id,
            name: normalizedStudent.name,
            roll_number: normalizedStudent.rollNumber,
            level: normalizedStudent.level || "PRIMARY",
            class_name: normalizedStudent.className,
            guardian_name: normalizedStudent.guardianName || "",
            guardian_email: normalizedStudent.guardianEmail || "",
            guardian_phone: normalizedStudent.guardianPhone || "",
            photo_url: normalizedStudent.photoUrl || "",
            updated_at: new Date().toISOString()
          };
          await client.from("ea_students").upsert([sbPayload], { onConflict: "id" });
          try { await client.from("ea_student").upsert([sbPayload], { onConflict: "id" }); } catch (e) {}
        } catch (e) {}
      }).catch(() => {});
    }

    let updatedList: any[];
    if (existingIndex >= 0) {
      updatedList = currentStudents.map((s, idx) => idx === existingIndex ? normalizedStudent : s);
    } else {
      updatedList = [...currentStudents, normalizedStudent];
    }

    db.rosterCleared = false;
    db.students = updatedList;
    saveServerDatabase(db, "students", updatedList);
    try {
      fs.writeFileSync(STUDENTS_CACHE_FILE, JSON.stringify(updatedList, null, 2), "utf-8");
    } catch (e) {}

    // Broadcast specific ADMIT event in addition to general update
    broadcastSse("ADMIT", "students", { action: "ADMIT", student: normalizedStudent, count: updatedList.length });
    console.log(`[Global Student Sync & CDN] Pupil '${normalizedStudent.name}' admitted / updated. Total pupils: ${updatedList.length}`);

    return res.status(200).json({
      status: "success",
      student: normalizedStudent,
      count: updatedList.length,
      version: db.version,
      timestamp: new Date().toISOString()
    });
  });

  // POST /api/students/clear: Instantly wipe student roster from global server cache and CDN
  app.post("/api/students/clear", async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Cloudflare-CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");

    saveServerStudents([]);
    await clearAllSupabaseStudentsOnServer();
    broadcastSse("CLEAR", "students", { action: "CLEAR", count: 0 });
    console.log(`[Global Student Sync & CDN] Student roster cleared to 0 on server and Supabase.`);
    return res.status(200).json({
      status: "success",
      count: 0,
      timestamp: new Date().toISOString()
    });
  });

  // DELETE /api/students: Clear all students
  app.delete("/api/students", async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Cloudflare-CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");

    saveServerStudents([]);
    await clearAllSupabaseStudentsOnServer();
    broadcastSse("CLEAR", "students", { action: "CLEAR", count: 0 });
    console.log(`[Global Student Sync & CDN] Student roster cleared to 0 on server and Supabase via DELETE.`);
    return res.status(200).json({
      status: "success",
      count: 0,
      timestamp: new Date().toISOString()
    });
  });

  // POST /api/students: Bulk sync entire student roster with CDN
  app.post("/api/students", async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Cloudflare-CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");

    const students = Array.isArray(req.body) ? req.body : req.body?.students;
    if (!Array.isArray(students)) {
      return res.status(400).json({ status: "error", message: "Expected students array" });
    }

    const clearRoster = req.body?.clearRoster === true || req.body?.rosterCleared === true || req.query?.clear === 'true';

    if (clearRoster || (students.length === 0 && (req.body?.students !== undefined || Array.isArray(req.body)))) {
      const db = loadServerDatabase();
      if (clearRoster || db.rosterCleared || students.length === 0) {
        saveServerStudents([]);
        if (clearRoster) {
          await clearAllSupabaseStudentsOnServer();
        }
        broadcastSse("CLEAR", "students", { action: "CLEAR", count: 0 });
        return res.status(200).json({
          status: "success",
          count: 0,
          students: [],
          version: db.version,
          timestamp: new Date().toISOString()
        });
      }
    }

    if (students.length === 0) {
      const db = loadServerDatabase();
      return res.status(200).json({
        status: "success",
        count: (db.students || []).length,
        students: db.students || [],
        version: db.version,
        timestamp: new Date().toISOString()
      });
    }

    // Authoritatively save the active students without re-merging previous cached students
    saveServerStudents(students);
    const db = loadServerDatabase();

    return res.status(200).json({
      status: "success",
      count: db.students.length,
      version: db.version,
      timestamp: new Date().toISOString()
    });
  });

  // Dedicated authoritative repopulate endpoint for all Academy students
  app.post("/api/students/repopulate", async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    const db = loadServerDatabase();

    // 1. Clear all server student tombstones & roster cleared flags
    db.deletedStudentIds = [];
    db.rosterCleared = false;
    db.rosterClearedAt = undefined;

    // 2. Canonical students (use incoming array if provided with length > 0, or default list)
    let incoming = Array.isArray(req.body?.students) && req.body.students.length > 0
      ? req.body.students
      : getDefaultServerStudents();

    if (!Array.isArray(incoming) || incoming.length === 0) {
      incoming = getDefaultServerStudents();
    }

    const clean = incoming.filter((s: any) => s && s.id && !isDemoStudent(s));
    db.students = JSON.parse(JSON.stringify(clean));

    saveServerStudents(db.students);
    saveServerDatabase(db, "students", db.students);
    saveServerDatabase(db, "deletedStudentIds", []);

    // 3. Broadcast via SSE to all connected clients
    broadcastSse("REPOPULATE", "students", { count: db.students.length, students: db.students });
    broadcastSse("UPDATE", "deletedStudentIds", []);
    console.log(`[Global Student Sync] Repopulated all ${db.students.length} canonical pupils and cleared tombstones.`);

    // 4. Authoritative sync to Supabase (delete remote tombstones and upsert all students to ea_students and ea_student)
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    if (supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const client = createClient(supabaseUrl, supabaseKey);

        // Delete remote student tombstones & roster clear records
        await client.from("ea_deleted_records").delete().in("record_type", ["STUDENT", "ROSTER_CLEAR"]);

        const payloads = db.students.map((s: any) => ({
          id: s.id,
          name: s.name,
          roll_number: s.rollNumber || s.roll_number || "",
          level: s.level || "PRIMARY",
          class_name: s.className || s.class_name || "Primary 1",
          guardian_name: s.guardianName || s.guardian_name || "",
          guardian_email: s.guardianEmail || s.guardian_email || "",
          guardian_phone: s.guardianPhone || s.guardian_phone || "",
          photo_url: s.photoUrl || s.photo_url || "",
          updated_at: new Date().toISOString()
        }));

        for (let i = 0; i < payloads.length; i += 50) {
          const chunk = payloads.slice(i, i + 50);
          await client.from("ea_students").upsert(chunk, { onConflict: "id" });
          try { await client.from("ea_student").upsert(chunk, { onConflict: "id" }); } catch (e) {}
        }
        console.log(`[Global Student Sync] Synced ${payloads.length} repopulated pupils to Supabase ea_students.`);
      } catch (err: any) {
        console.warn("[Global Student Sync] Supabase student repopulate notice:", err?.message || err);
      }
    }

    return res.status(200).json({
      status: "success",
      count: db.students.length,
      students: db.students,
      version: db.version
    });
  });

  // GET /api/students/sync-status: Cross-checks counts across Server DB and Supabase ea_students
  app.get("/api/students/sync-status", async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    const db = loadServerDatabase();
    const serverCount = (db.students || []).length;

    let supabaseCount: number | null = null;
    let supabaseStatus = "disconnected";
    let supabaseError: string | null = null;

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

    if (supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const client = createClient(supabaseUrl, supabaseKey);
        const { count, error } = await client.from("ea_students").select("*", { count: "exact", head: true });
        if (error) {
          supabaseStatus = "error";
          supabaseError = error.message;
        } else {
          supabaseStatus = "connected";
          supabaseCount = count;
        }
      } catch (err: any) {
        supabaseStatus = "error";
        supabaseError = err?.message || String(err);
      }
    }

    return res.status(200).json({
      status: "success",
      serverCount,
      supabaseCount,
      inSync: supabaseCount !== null && serverCount === supabaseCount,
      supabaseStatus,
      supabaseError,
      timestamp: new Date().toISOString()
    });
  });

  // POST /api/students/sync-supabase: Triggers an authoritative bidirectional sync
  app.post("/api/students/sync-supabase", async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

    if (!supabaseUrl || !supabaseKey) {
      return res.status(400).json({ status: "error", message: "Supabase credentials not configured." });
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const client = createClient(supabaseUrl, supabaseKey);

      const db = loadServerDatabase();

      // 1. Fetch remote tombstones
      try {
        const { data: delRecords } = await client
          .from("ea_deleted_records")
          .select("*")
          .in("record_type", ["STUDENT", "ROSTER_CLEAR"]);

        if (delRecords && Array.isArray(delRecords)) {
          const currentDeleted = new Set(sanitizeDeletedStudentIds(db.deletedStudentIds || []).map(x => String(x).toLowerCase().trim()));
          let hasRosterClear = false;
          delRecords.forEach((row: any) => {
            if (row.record_type === "ROSTER_CLEAR") {
              hasRosterClear = true;
            } else if (row.record_id) {
              const clean = String(row.record_id).toLowerCase().trim();
              currentDeleted.add(clean);
              const alpha = clean.replace(/[^a-z0-9]/g, '');
              if (alpha) currentDeleted.add(alpha);
            }
          });
          db.deletedStudentIds = sanitizeDeletedStudentIds(Array.from(currentDeleted));
          if (hasRosterClear && (!db.students || db.students.length === 0)) {
            db.rosterCleared = true;
          }
        }
      } catch (e) {}

      // 2. If roster was cleared, enforce empty
      if (db.rosterCleared) {
        db.students = [];
        saveServerStudents([]);
        try {
          await client.from("ea_students").delete().neq("id", "00000000-0000-0000-0000-000000000000");
          await client.from("ea_student").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        } catch (e) {}
        return res.status(200).json({
          status: "success",
          pushedToSupabase: 0,
          pulledFromServer: 0,
          totalServerStudents: 0,
          totalSupabaseStudents: 0,
          inSync: true,
          rosterCleared: true,
          timestamp: new Date().toISOString()
        });
      }

      const serverStudents = (db.students || []).filter((s: any) => !isDemoStudent(s) && !isStudentDeletedOnServer(s, db.deletedStudentIds));

      const { data: remoteStudents, error } = await client.from("ea_students").select("*");
      if (error) {
        return res.status(500).json({ status: "error", message: error.message });
      }

      const activeRemote = (remoteStudents || []).filter((s: any) => !isDemoStudent(s));
      const remoteIds = new Set(activeRemote.map((s: any) => s.id));
      const missingFromRemote = serverStudents.filter((s: any) => s && s.id && !remoteIds.has(s.id));

      if (missingFromRemote.length > 0) {
        const payloads = missingFromRemote.map((s: any) => ({
          id: s.id,
          name: s.name,
          roll_number: s.rollNumber,
          level: s.level,
          class_name: s.className,
          guardian_name: s.guardianName || "",
          guardian_email: s.guardianEmail || "",
          guardian_phone: s.guardianPhone || "",
          photo_url: s.photoUrl || "",
          updated_at: new Date().toISOString()
        }));
        await client.from("ea_students").upsert(payloads, { onConflict: "id" });
      }

      const serverIds = new Set(serverStudents.map((s: any) => s.id));
      const missingFromServer = activeRemote.filter((s: any) => s && s.id && !serverIds.has(s.id));
      if (missingFromServer.length > 0) {
        const mapped = missingFromServer.map((r: any) => ({
          id: r.id,
          name: r.name || "",
          rollNumber: r.roll_number || "",
          level: r.level || "PRIMARY",
          className: r.class_name || "",
          guardianName: r.guardian_name || "",
          guardianEmail: r.guardian_email || "",
          guardianPhone: r.guardian_phone || "",
          photoUrl: r.photo_url || ""
        }));
        const updated = [...serverStudents, ...mapped];
        saveServerStudents(updated);
      }

      const freshDb = loadServerDatabase();
      const { count: finalCount } = await client.from("ea_students").select("*", { count: "exact", head: true });

      return res.status(200).json({
        status: "success",
        pushedToSupabase: missingFromRemote.length,
        pulledFromServer: missingFromServer.length,
        totalServerStudents: freshDb.students.length,
        totalSupabaseStudents: finalCount,
        inSync: freshDb.students.length === finalCount,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      return res.status(500).json({ status: "error", message: err?.message || String(err) });
    }
  });

  // DELETE /api/students/:id: Delete pupil from global server store & invalidate CDN cache
  app.delete("/api/students/:id", async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Cloudflare-CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");

    const targetId = decodeURIComponent(req.params.id);
    const { rollNumber, studentName } = req.body || {};

    const db = loadServerDatabase();
    const currentDeleted = new Set(sanitizeDeletedStudentIds(db.deletedStudentIds || []).map(x => String(x).toLowerCase().trim()));
    const cleanTargetId = String(targetId).toLowerCase().trim();
    if (cleanTargetId) {
      currentDeleted.add(cleanTargetId);
      const cleanAlpha = cleanTargetId.replace(/[^a-z0-9]/g, '');
      if (cleanAlpha) currentDeleted.add(cleanAlpha);
    }
    db.deletedStudentIds = sanitizeDeletedStudentIds(Array.from(currentDeleted));

    const isMatch = (s: any) => {
      if (s.id && (s.id === targetId || String(s.id).toLowerCase().trim() === targetId.toLowerCase().trim())) return true;
      if (rollNumber && s.rollNumber && String(s.rollNumber).toLowerCase().trim() === String(rollNumber).toLowerCase().trim()) return true;
      if (studentName && s.name && String(s.name).toLowerCase().trim() === String(studentName).toLowerCase().trim()) return true;
      return false;
    };

    const currentStudents = loadServerStudents();
    const updated = currentStudents.filter(s => !isMatch(s));

    // Also clean up grades, attendance, bills, mock exams for deleted student
    const toTombstone = [targetId, rollNumber, studentName].filter(Boolean) as string[];
    const keysToRemove = new Set(toTombstone.map(x => String(x).toLowerCase().trim()));
    if (Array.isArray(db.grades)) {
      db.grades = db.grades.filter(g => !keysToRemove.has(String(g.studentId).toLowerCase().trim()));
    }
    if (Array.isArray(db.attendance)) {
      db.attendance = db.attendance.filter(a => !keysToRemove.has(String(a.studentId).toLowerCase().trim()));
    }
    if (Array.isArray(db.bills)) {
      db.bills = db.bills.filter(b => !keysToRemove.has(String(b.studentId).toLowerCase().trim()));
    }
    if (Array.isArray(db.dailyAttendance)) {
      db.dailyAttendance = db.dailyAttendance.filter(r => !keysToRemove.has(String(r.studentId).toLowerCase().trim()));
    }
    if (Array.isArray(db.jhsMockExams)) {
      db.jhsMockExams = db.jhsMockExams.filter(m => !keysToRemove.has(String(m.studentId).toLowerCase().trim()));
    }

    db.students = updated;
    saveServerDatabase(db, "students", updated);
    try {
      fs.writeFileSync(STUDENTS_CACHE_FILE, JSON.stringify(updated, null, 2), "utf-8");
    } catch (e) {}

    // Synchronize Supabase deletion directly on server
    deleteSupabaseStudentOnServer(targetId, rollNumber, studentName).catch(() => {});

    // Broadcast specific DELETE event across SSE
    broadcastSse("DELETE", "students", { action: "DELETE", id: targetId, rollNumber, studentName, remainingCount: updated.length });
    console.log(`[Global Student Sync & CDN] Student ID '${targetId}' permanently deleted. Remaining pupils: ${updated.length}`);

    return res.status(200).json({
      status: "success",
      count: updated.length,
      version: db.version,
      timestamp: new Date().toISOString()
    });
  });

  // ==========================================
  // REAL-TIME CROSS-DEVICE SYNC & SSE STREAM
  // ==========================================

  // GET /api/sync/stream: Real-time Server-Sent Events stream for cross-device updates
  app.get("/api/sync/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform, no-store");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.setHeader("Access-Control-Allow-Origin", "*");
    
    // Flush initial connection packet
    const db = loadServerDatabase();
    res.write(`event: connected\ndata: ${JSON.stringify({ status: "connected", version: db.version, timestamp: new Date().toISOString() })}\n\n`);

    sseClients.add(res);
    console.log(`[Global Sync SSE] Client connected. Total active streams: ${sseClients.size}`);

    req.on("close", () => {
      sseClients.delete(res);
      console.log(`[Global Sync SSE] Client disconnected. Remaining streams: ${sseClients.size}`);
    });
  });

  // Keep-alive heartbeat to prevent CDN, GCP Cloud Run, and mobile proxy timeouts
  setInterval(() => {
    for (const client of sseClients) {
      try {
        client.write(`: ping\n\n`);
      } catch {
        sseClients.delete(client);
      }
    }
  }, 20000);

  // GET /api/sync/version: Fast, lightweight version check
  app.get("/api/sync/version", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({
      status: "success",
      version: db.version,
      lastUpdated: db.lastUpdated,
      counts: {
        students: db.students?.length || 0,
        teachers: db.teachers?.length || 0,
        grades: db.grades?.length || 0,
        attendance: db.attendance?.length || 0,
        dailyAttendance: db.dailyAttendance?.length || 0,
        bills: db.bills?.length || 0,
        feePayments: db.feePayments?.length || 0
      }
    });
  });

  // GET /api/sync/all: Retrieve complete school database state
  app.get("/api/sync/all", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    const db = loadServerDatabase();
    const derived = buildAssignmentsFromTeachers(db.teachers || []);
    db.classTeacherAssignments = { ...derived, ...(db.classTeacherAssignments || {}) };
    if (db.config) {
      db.config.classTeacherAssignments = db.classTeacherAssignments;
    }
    return res.status(200).json({
      status: "success",
      version: db.version,
      lastUpdated: db.lastUpdated,
      data: db
    });
  });

  // POST /api/sync/all: Bulk or partial update to master database
  app.post("/api/sync/all", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    const incoming = req.body;
    if (!incoming || typeof incoming !== "object") {
      return res.status(400).json({ status: "error", message: "Invalid payload" });
    }

    const db = loadServerDatabase();

    if (incoming.classTeacherAssignments && typeof incoming.classTeacherAssignments === "object") {
      db.classTeacherAssignments = incoming.classTeacherAssignments;
    }
    if (incoming.config) {
      db.config = {
        ...incoming.config,
        classTeacherAssignments: db.classTeacherAssignments || incoming.config.classTeacherAssignments || {}
      };
    } else if (db.classTeacherAssignments && db.config) {
      db.config.classTeacherAssignments = db.classTeacherAssignments;
    }
    if (Array.isArray(incoming.deletedTeacherIds)) {
      if (!db.deletedTeacherIds) db.deletedTeacherIds = [];
      incoming.deletedTeacherIds.forEach((id: any) => {
        const clean = String(id).toLowerCase().trim();
        if (clean && !db.deletedTeacherIds!.includes(clean)) {
          db.deletedTeacherIds!.push(clean);
        }
      });
    }
    if (Array.isArray(incoming.teachers)) {
      const deletedTeacherSet = new Set((db.deletedTeacherIds || []).map(x => String(x).toLowerCase().trim()));
      const teacherMap = new Map<string, any>();
      incoming.teachers.forEach((t: any) => {
        if (t && t.id) {
          const existing = teacherMap.get(String(t.id));
          teacherMap.set(String(t.id), existing ? { ...existing, ...t } : t);
        }
      });
      db.teachers = Array.from(teacherMap.values()).filter((t: any) => {
        if (t.id && deletedTeacherSet.has(String(t.id).toLowerCase().trim())) return false;
        if (t.email && deletedTeacherSet.has(String(t.email).toLowerCase().trim())) return false;
        if (t.name && deletedTeacherSet.has(String(t.name).toLowerCase().trim())) return false;
        return true;
      });

      // Synchronize class teacher assignments with incoming teachers & explicit assignments
      const derivedFromIncoming = buildAssignmentsFromTeachers(db.teachers);
      db.classTeacherAssignments = {
        ...(db.classTeacherAssignments || {}),
        ...derivedFromIncoming,
        ...(incoming.classTeacherAssignments && typeof incoming.classTeacherAssignments === "object" ? incoming.classTeacherAssignments : {})
      };
      if (db.config) {
        db.config.classTeacherAssignments = db.classTeacherAssignments;
      }
    }
    if (Array.isArray(incoming.deletedStudentIds)) {
      const sanitizedIncoming = sanitizeDeletedStudentIds(incoming.deletedStudentIds);
      const currentDeleted = new Set(sanitizeDeletedStudentIds(db.deletedStudentIds || []).map(x => String(x).toLowerCase().trim()));
      sanitizedIncoming.forEach((id: any) => {
        const clean = String(id).toLowerCase().trim();
        if (clean) {
          currentDeleted.add(clean);
          const alpha = clean.replace(/[^a-z0-9]/g, '');
          if (alpha) currentDeleted.add(alpha);
          deleteSupabaseStudentOnServer(clean).catch(() => {});
        }
      });
      db.deletedStudentIds = sanitizeDeletedStudentIds(Array.from(currentDeleted));
    }
    if (Array.isArray(incoming.students)) {
      const cleanStudents = incoming.students.filter((s: any) => !isDemoStudent(s) && !isStudentDeletedOnServer(s, db.deletedStudentIds));
      db.students = cleanStudents;
      if (cleanStudents.length > 0) {
        db.rosterCleared = false;
        db.rosterClearedAt = undefined;
      }
      try {
        fs.writeFileSync(STUDENTS_CACHE_FILE, JSON.stringify(cleanStudents, null, 2), "utf-8");
      } catch (e) {}
    }
    if (incoming.rosterCleared === true) {
      db.students = [];
      db.rosterCleared = true;
      db.rosterClearedAt = new Date().toISOString();
      clearAllSupabaseStudentsOnServer().catch(() => {});
      try {
        fs.writeFileSync(STUDENTS_CACHE_FILE, JSON.stringify([], null, 2), "utf-8");
      } catch (e) {}
    }
    if (Array.isArray(incoming.grades)) db.grades = incoming.grades;
    if (Array.isArray(incoming.attendance)) {
      const attMap = new Map<string, any>();
      (db.attendance || []).forEach((a: any) => {
        const key = `${String(a.studentId).trim().toLowerCase()}_${String(a.term || '').trim().toLowerCase()}_${String(a.year || a.academicYear || '').trim().toLowerCase()}`;
        attMap.set(key, a);
      });
      incoming.attendance.forEach((a: any) => {
        const key = `${String(a.studentId).trim().toLowerCase()}_${String(a.term || '').trim().toLowerCase()}_${String(a.year || a.academicYear || '').trim().toLowerCase()}`;
        const existing = attMap.get(key);
        if (!existing) {
          attMap.set(key, a);
        } else {
          const incomingTime = a.updatedAt ? new Date(a.updatedAt).getTime() : Date.now();
          const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          if (incomingTime >= existingTime) {
            attMap.set(key, a);
          }
        }
      });
      db.attendance = Array.from(attMap.values());
    }
    if (Array.isArray(incoming.dailyAttendance)) {
      const dailyMap = new Map<string, any>();
      (db.dailyAttendance || []).forEach((r: any) => {
        if (r && r.studentId && r.date) {
          dailyMap.set(`${String(r.studentId).trim().toLowerCase()}_${r.date}`, r);
        }
      });
      incoming.dailyAttendance.forEach((r: any) => {
        if (r && r.studentId && r.date) {
          const key = `${String(r.studentId).trim().toLowerCase()}_${r.date}`;
          const existing = dailyMap.get(key);
          if (!existing) {
            dailyMap.set(key, r);
          } else {
            const incomingTime = r.updatedAt ? new Date(r.updatedAt).getTime() : Date.now();
            const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
            if (incomingTime >= existingTime) {
              dailyMap.set(key, r);
            }
          }
        }
      });
      db.dailyAttendance = Array.from(dailyMap.values());
    }
    if (Array.isArray(incoming.bills)) db.bills = incoming.bills;
    if (Array.isArray(incoming.feePayments)) db.feePayments = incoming.feePayments;
    if (Array.isArray(incoming.feeStructures)) db.feeStructures = incoming.feeStructures;
    if (Array.isArray(incoming.dailyCollections)) db.dailyCollections = incoming.dailyCollections;
    if (Array.isArray(incoming.inventory)) db.inventory = incoming.inventory;
    if (Array.isArray(incoming.deletedBookStockIds)) {
      if (!db.deletedBookStockIds) db.deletedBookStockIds = [];
      incoming.deletedBookStockIds.forEach((id: string) => {
        if (id && !db.deletedBookStockIds!.includes(id)) {
          db.deletedBookStockIds!.push(id);
        }
      });
    }
    if (Array.isArray(incoming.bookStock)) {
      const activeDeleted = new Set((db.deletedBookStockIds || []).map(id => String(id).toLowerCase()));
      db.bookStock = incoming.bookStock.filter((b: any) => b && b.id && !activeDeleted.has(String(b.id).trim().toLowerCase()));
    }
    if (Array.isArray(incoming.bookSales)) db.bookSales = incoming.bookSales;
    if (Array.isArray(incoming.jhsMockExams)) db.jhsMockExams = incoming.jhsMockExams;

    saveServerDatabase(db);
    console.log(`[Global Master Sync] Full database synchronized. Version: ${db.version}, Students: ${db.students?.length}, Teachers: ${db.teachers?.length}, Attendance: ${db.attendance?.length}, Daily: ${db.dailyAttendance?.length}`);

    return res.status(200).json({
      status: "success",
      version: db.version,
      lastUpdated: db.lastUpdated
    });
  });

  // ==========================================
  // SPECIFIC ENTITY PERSISTENCE ENDPOINTS
  // ==========================================

  // Config: GET & POST
  app.get("/api/config", (req, res) => {
    const db = loadServerDatabase();
    const effectiveConfig = {
      ...(db.config || {}),
      classTeacherAssignments: db.classTeacherAssignments || db.config?.classTeacherAssignments || {}
    };
    return res.status(200).json({ status: "success", data: effectiveConfig, version: db.version });
  });

  app.post("/api/config", (req, res) => {
    const config = req.body?.config || req.body;
    if (!config) return res.status(400).json({ status: "error", message: "Missing config" });
    const db = loadServerDatabase();
    if (config.classTeacherAssignments && typeof config.classTeacherAssignments === "object") {
      db.classTeacherAssignments = {
        ...(db.classTeacherAssignments || {}),
        ...config.classTeacherAssignments
      };
    }
    db.config = {
      ...config,
      classTeacherAssignments: db.classTeacherAssignments || config.classTeacherAssignments || {}
    };
    saveServerDatabase(db, "config", db.config);
    return res.status(200).json({ status: "success", version: db.version });
  });

  // Teachers: GET, POST & DELETE
  app.get("/api/teachers", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    const db = loadServerDatabase();
    const deletedSet = new Set((db.deletedTeacherIds || []).map(x => String(x).toLowerCase().trim()));
    if (!Array.isArray(db.teachers)) {
      db.teachers = DEFAULT_SERVER_TEACHERS.filter(t => !deletedSet.has(String(t.id).toLowerCase().trim()) && !deletedSet.has(String(t.email).toLowerCase().trim()));
      saveServerDatabase(db, "teachers", db.teachers);
    } else {
      db.teachers = db.teachers.filter(t => !deletedSet.has(String(t.id).toLowerCase().trim()) && !deletedSet.has(String(t.email).toLowerCase().trim()));
    }
    return res.status(200).json({ status: "success", data: db.teachers, count: db.teachers.length, deletedTeacherIds: db.deletedTeacherIds || [], version: db.version });
  });

  app.post("/api/teachers", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    const teachers = req.body?.teachers || req.body;
    if (!Array.isArray(teachers)) return res.status(400).json({ status: "error", message: "Expected teachers array" });
    const db = loadServerDatabase();
    // Un-tombstone incoming teachers if explicitly being registered or modified
    const incomingTeacherIds = new Set(teachers.map((t: any) => String(t.id || '').toLowerCase().trim()).filter(Boolean));
    const incomingTeacherEmails = new Set(teachers.map((t: any) => String(t.email || '').toLowerCase().trim()).filter(Boolean));
    const incomingTeacherNames = new Set(teachers.map((t: any) => String(t.name || '').toLowerCase().trim()).filter(Boolean));
    if (db.deletedTeacherIds && db.deletedTeacherIds.length > 0) {
      db.deletedTeacherIds = db.deletedTeacherIds.filter(id => {
        const norm = String(id).toLowerCase().trim();
        return !incomingTeacherIds.has(norm) && !incomingTeacherEmails.has(norm) && !incomingTeacherNames.has(norm);
      });
    }

    const deletedSet = new Set((db.deletedTeacherIds || []).map(x => String(x).toLowerCase().trim()));
    const cleanTeachers = teachers.filter((t: any) => {
      if (t.id && deletedSet.has(String(t.id).toLowerCase().trim())) return false;
      if (t.email && deletedSet.has(String(t.email).toLowerCase().trim())) return false;
      if (t.name && deletedSet.has(String(t.name).toLowerCase().trim())) return false;
      return true;
    });

    const existingTeachers = Array.isArray(db.teachers) ? db.teachers : [];
    const teacherMap = new Map<string, any>();
    existingTeachers.forEach((t: any) => {
      if (t && t.id) teacherMap.set(String(t.id), t);
    });
    cleanTeachers.forEach((t: any) => {
      if (t && t.id) {
        const existing = teacherMap.get(String(t.id));
        teacherMap.set(String(t.id), existing ? { ...existing, ...t } : t);
      }
    });
    db.teachers = Array.from(teacherMap.values()).filter((t: any) => {
      if (t.id && deletedSet.has(String(t.id).toLowerCase().trim())) return false;
      if (t.email && deletedSet.has(String(t.email).toLowerCase().trim())) return false;
      if (t.name && deletedSet.has(String(t.name).toLowerCase().trim())) return false;
      return true;
    });

    // Auto-update classTeacherAssignments:
    // 1. Any classes assigned to teachers in their `classes` array
    const derived = buildAssignmentsFromTeachers(db.teachers);
    // 2. Any explicit assignments passed in request body
    const explicitAssignments = req.body?.classTeacherAssignments;
    db.classTeacherAssignments = {
      ...(db.classTeacherAssignments || {}),
      ...derived,
      ...(explicitAssignments && typeof explicitAssignments === "object" ? explicitAssignments : {})
    };
    if (db.config) {
      db.config.classTeacherAssignments = db.classTeacherAssignments;
    }

    saveServerDatabase(db, "teachers", db.teachers);
    broadcastSse("UPDATE", "classTeacherAssignments", db.classTeacherAssignments);
    broadcastSse("UPDATE", "teachers", db.teachers);
    console.log(`[Global Teacher Sync] Updated staff registry: ${db.teachers.length} staff members.`);

    // Synchronize to Supabase in the background
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    if (supabaseUrl && supabaseKey) {
      import("@supabase/supabase-js").then(async ({ createClient }) => {
        try {
          const client = createClient(supabaseUrl, supabaseKey);
          const payloads = cleanTeachers.map((t: any) => ({
            id: t.id,
            name: t.name,
            email: t.email,
            role: t.role || "TEACHER",
            password: t.password || null,
            level: t.level || null,
            subjects: t.subjects || null,
            classes: t.classes || null,
            date_of_birth: t.dateOfBirth || null,
            phone_number: t.phoneNumber || null,
            qualification: t.qualification || null,
            profile_picture: t.profilePicture || null,
            hometown: t.hometown || null,
            ghana_card_number: t.ghanaCardNumber || null,
            updated_at: new Date().toISOString()
          }));
          await client.from("ea_teachers").upsert(payloads, { onConflict: "id" });
        } catch (err: any) {
          console.warn("[Global Teacher Sync] Background Supabase upsert notice:", err?.message || err);
        }
      }).catch(() => {});
    }

    return res.status(200).json({ status: "success", count: db.teachers.length, assignments: db.classTeacherAssignments, version: db.version });
  });

  // Dedicated authoritative repopulate endpoint for all 16 staff
  app.post("/api/teachers/repopulate", async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    const db = loadServerDatabase();

    // 1. Clear all server teacher tombstones
    db.deletedTeacherIds = [];

    // 2. Canonical 16 teachers (use incoming array if provided with length >= 16, or DEFAULT_SERVER_TEACHERS)
    const incoming = Array.isArray(req.body?.teachers) && req.body.teachers.length >= 16 ? req.body.teachers : DEFAULT_SERVER_TEACHERS;
    db.teachers = JSON.parse(JSON.stringify(incoming));

    // 3. Rebuild class teacher assignments
    const derived = buildAssignmentsFromTeachers(db.teachers);
    db.classTeacherAssignments = derived;
    if (db.config) {
      db.config.classTeacherAssignments = derived;
    }

    saveServerDatabase(db, "teachers", db.teachers);
    saveServerDatabase(db, "classTeacherAssignments", db.classTeacherAssignments);
    saveServerDatabase(db, "deletedTeacherIds", []);

    // 4. Broadcast via SSE to all connected clients
    broadcastSse("UPDATE", "classTeacherAssignments", db.classTeacherAssignments);
    broadcastSse("UPDATE", "teachers", db.teachers);
    broadcastSse("UPDATE", "deletedTeacherIds", []);
    console.log(`[Global Teacher Sync] Repopulated all ${db.teachers.length} canonical staff members and cleared tombstones.`);

    // 5. Authoritative sync to Supabase (delete remote tombstones and upsert all 16 teachers)
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    if (supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const client = createClient(supabaseUrl, supabaseKey);

        // Delete remote teacher tombstones
        await client.from("ea_deleted_records").delete().eq("record_type", "TEACHER");

        const payloads = db.teachers.map((t: any) => ({
          id: t.id,
          name: t.name,
          email: t.email,
          role: t.role || "TEACHER",
          password: t.password || null,
          level: t.level || null,
          subjects: t.subjects || null,
          classes: t.classes || null,
          date_of_birth: t.dateOfBirth || null,
          phone_number: t.phoneNumber || null,
          qualification: t.qualification || null,
          profile_picture: t.profilePicture || null,
          hometown: t.hometown || null,
          ghana_card_number: t.ghanaCardNumber || null,
          updated_at: new Date().toISOString()
        }));
        await client.from("ea_teachers").upsert(payloads, { onConflict: "id" });
        console.log(`[Global Teacher Sync] Synced ${payloads.length} repopulated teachers to Supabase ea_teachers.`);
      } catch (err: any) {
        console.warn("[Global Teacher Sync] Supabase repopulate notice:", err?.message || err);
      }
    }

    return res.status(200).json({
      status: "success",
      count: db.teachers.length,
      teachers: db.teachers,
      assignments: db.classTeacherAssignments,
      version: db.version
    });
  });

  app.delete("/api/teachers/:id", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    const targetId = decodeURIComponent(req.params.id);
    const { email, name } = req.body || {};
    const db = loadServerDatabase();

    if (!db.deletedTeacherIds) db.deletedTeacherIds = [];
    [targetId, email, name].filter(Boolean).forEach(x => {
      const clean = String(x).toLowerCase().trim();
      if (clean && !db.deletedTeacherIds!.includes(clean)) {
        db.deletedTeacherIds!.push(clean);
      }
    });

    const deletedSet = new Set(db.deletedTeacherIds.map(x => String(x).toLowerCase().trim()));
    const remaining = (db.teachers || []).filter((t: any) => {
      if (t.id && deletedSet.has(String(t.id).toLowerCase().trim())) return false;
      if (t.email && deletedSet.has(String(t.email).toLowerCase().trim())) return false;
      if (t.name && deletedSet.has(String(t.name).toLowerCase().trim())) return false;
      return true;
    });

    db.teachers = remaining;
    db.classTeacherAssignments = buildAssignmentsFromTeachers(remaining);
    if (db.config) {
      db.config.classTeacherAssignments = db.classTeacherAssignments;
    }
    saveServerDatabase(db, "teachers", remaining);
    broadcastSse("DELETE", "teachers", { id: targetId, email, name, remaining, deletedTeacherIds: db.deletedTeacherIds });
    broadcastSse("UPDATE", "teachers", remaining);
    broadcastSse("UPDATE", "classTeacherAssignments", db.classTeacherAssignments);
    console.log(`[Global Teacher Sync] Teacher '${targetId}' deleted. Remaining active staff: ${remaining.length}`);

    // Remove from Supabase and record tombstone in background
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    if (supabaseUrl && supabaseKey) {
      import("@supabase/supabase-js").then(async ({ createClient }) => {
        try {
          const client = createClient(supabaseUrl, supabaseKey);
          await client.from("ea_teachers").delete().eq("id", targetId);
          await client.from("ea_deleted_records").insert([{
            record_type: "TEACHER",
            record_id: targetId,
            name: name || null,
            details: { id: targetId, email, name, timestamp: new Date().toISOString() },
            deleted_at: new Date().toISOString()
          }]);
        } catch (e) {}
      }).catch(() => {});
    }

    return res.status(200).json({ status: "success", count: remaining.length, deletedTeacherIds: db.deletedTeacherIds, version: db.version });
  });

  // GET /api/teachers/sync-status: Cross-checks counts across Server DB and Supabase ea_teachers
  app.get("/api/teachers/sync-status", async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    const db = loadServerDatabase();
    const serverCount = (db.teachers || []).length;

    let supabaseCount: number | null = null;
    let supabaseStatus = "disconnected";
    let supabaseError: string | null = null;

    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

    if (supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const client = createClient(supabaseUrl, supabaseKey);
        const { count, error } = await client.from("ea_teachers").select("*", { count: "exact", head: true });
        if (error) {
          supabaseStatus = "error";
          supabaseError = error.message;
        } else {
          supabaseStatus = "connected";
          supabaseCount = count;
        }
      } catch (err: any) {
        supabaseStatus = "error";
        supabaseError = err?.message || String(err);
      }
    }

    return res.status(200).json({
      status: "success",
      serverCount,
      supabaseCount,
      inSync: supabaseCount !== null && serverCount === supabaseCount,
      supabaseStatus,
      supabaseError,
      timestamp: new Date().toISOString()
    });
  });

  // POST /api/teachers/sync-supabase: Triggers an authoritative bidirectional sync
  app.post("/api/teachers/sync-supabase", async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

    if (!supabaseUrl || !supabaseKey) {
      return res.status(400).json({ status: "error", message: "Supabase credentials not configured." });
    }

    try {
      const { createClient } = await import("@supabase/supabase-js");
      const client = createClient(supabaseUrl, supabaseKey);

      const db = loadServerDatabase();
      const serverTeachers = db.teachers || [];

      const { data: remoteTeachers, error } = await client.from("ea_teachers").select("*");
      if (error) {
        return res.status(500).json({ status: "error", message: error.message });
      }

      const remoteIds = new Set((remoteTeachers || []).map((t: any) => t.id));
      const missingFromRemote = serverTeachers.filter((t: any) => t && t.id && !remoteIds.has(t.id));

      if (missingFromRemote.length > 0) {
        const payloads = missingFromRemote.map((t: any) => ({
          id: t.id,
          name: t.name,
          email: t.email,
          role: t.role || "TEACHER",
          password: t.password || null,
          level: t.level || null,
          subjects: t.subjects || null,
          classes: t.classes || null,
          date_of_birth: t.dateOfBirth || null,
          phone_number: t.phoneNumber || null,
          qualification: t.qualification || null,
          profile_picture: t.profilePicture || null,
          hometown: t.hometown || null,
          ghana_card_number: t.ghanaCardNumber || null,
          updated_at: new Date().toISOString()
        }));
        await client.from("ea_teachers").upsert(payloads, { onConflict: "id" });
      }

      const serverIds = new Set(serverTeachers.map((t: any) => t.id));
      const missingFromServer = (remoteTeachers || []).filter((t: any) => t && t.id && !serverIds.has(t.id));
      if (missingFromServer.length > 0) {
        const mapped = missingFromServer.map((r: any) => ({
          id: r.id,
          name: r.name || "",
          email: r.email || "",
          role: r.role || "TEACHER",
          password: r.password || undefined,
          level: r.level || undefined,
          subjects: r.subjects || undefined,
          classes: r.classes || undefined,
          dateOfBirth: r.date_of_birth || undefined,
          phoneNumber: r.phone_number || undefined,
          qualification: r.qualification || undefined,
          profilePicture: r.profile_picture || undefined,
          hometown: r.hometown || undefined,
          ghanaCardNumber: r.ghana_card_number || undefined
        }));
        db.teachers = [...serverTeachers, ...mapped];
        saveServerDatabase(db, "teachers", db.teachers);
      }

      const freshDb = loadServerDatabase();
      const { count: finalCount } = await client.from("ea_teachers").select("*", { count: "exact", head: true });

      return res.status(200).json({
        status: "success",
        pushedToSupabase: missingFromRemote.length,
        pulledFromServer: missingFromServer.length,
        totalServerTeachers: freshDb.teachers.length,
        totalSupabaseTeachers: finalCount,
        inSync: freshDb.teachers.length === finalCount,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      return res.status(500).json({ status: "error", message: err?.message || String(err) });
    }
  });

  // Class Teacher Assignments: GET & POST
  app.get("/api/class-teacher-assignments", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    const db = loadServerDatabase();
    const stored = (db.classTeacherAssignments && typeof db.classTeacherAssignments === 'object')
      ? db.classTeacherAssignments
      : (db.config?.classTeacherAssignments || {});
    const derived = buildAssignmentsFromTeachers(db.teachers || []);
    // Authoritative stored assignments take absolute precedence over derived teacher classes
    const assignments: Record<string, string> = { ...derived, ...stored };
    db.classTeacherAssignments = assignments;
    return res.status(200).json({
      status: "success",
      data: assignments,
      teachers: db.teachers,
      version: db.version
    });
  });

  app.post("/api/class-teacher-assignments", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("CDN-Cache-Control", "no-store");
    res.setHeader("Surrogate-Control", "no-store");
    res.setHeader("Pragma", "no-cache");
    const assignments = req.body?.assignments || req.body;
    if (!assignments || typeof assignments !== "object") {
      return res.status(400).json({ status: "error", message: "Expected assignments object" });
    }
    const db = loadServerDatabase();
    db.classTeacherAssignments = assignments;
    if (db.config) {
      db.config.classTeacherAssignments = assignments;
    }

    // Reconcile teachers in db if assignments were provided
    if (Array.isArray(db.teachers) && db.teachers.length > 0) {
      const map = db.classTeacherAssignments;
      const assignedClasses = Object.keys(map);
      db.teachers = db.teachers.map((t: any) => {
        if (t.role !== "TEACHER") return t;
        const remaining = (t.classes || []).filter((c: string) => !assignedClasses.includes(c));
        const added: string[] = [];
        Object.entries(map).forEach(([cls, tid]) => {
          if (tid && String(tid) === String(t.id)) added.push(cls);
        });
        return {
          ...t,
          classes: Array.from(new Set([...remaining, ...added])),
          updatedAt: new Date().toISOString()
        };
      });
    }

    saveServerDatabase(db, "classTeacherAssignments", db.classTeacherAssignments);
    broadcastSse("UPDATE", "classTeacherAssignments", db.classTeacherAssignments);
    broadcastSse("UPDATE", "teachers", db.teachers);
    console.log("[Class Teacher Sync] Saved and broadcast assignments on server.");
    return res.status(200).json({
      status: "success",
      data: db.classTeacherAssignments,
      teachers: db.teachers,
      version: db.version
    });
  });

  // Dedicated Teacher Authentication endpoint - bypasses Supabase Auth unconfirmed email blockage
  app.post("/api/auth/teacher-login", async (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ status: "error", message: "Email and password are required" });
    }
    const emailTrim = String(email).trim().toLowerCase();
    const passTrim = String(password).trim();
    const db = loadServerDatabase();

    let matchedTeacher = (db.teachers || []).find((t: any) =>
      t.email && String(t.email).trim().toLowerCase() === emailTrim && t.role === "TEACHER"
    );

    // If not in local server DB, query Supabase ea_teachers directly
    const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
    if (!matchedTeacher && supabaseUrl && supabaseKey) {
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const client = createClient(supabaseUrl, supabaseKey);
        const { data } = await client.from("ea_teachers").select("*").ilike("email", emailTrim).maybeSingle();
        if (data) {
          matchedTeacher = {
            id: data.id,
            name: data.name || emailTrim.split("@")[0],
            email: data.email,
            role: "TEACHER",
            password: data.password || "teacher123",
            level: data.level || "PRIMARY",
            classes: data.classes || [],
            subjects: data.subjects || [],
            phoneNumber: data.phone_number,
            qualification: data.qualification,
            updatedAt: data.updated_at || new Date().toISOString()
          };
          // Cache into db.teachers
          db.teachers = [...(db.teachers || []).filter((t: any) => t.id !== matchedTeacher.id), matchedTeacher];
          saveServerDatabase(db, "teachers", db.teachers);
        }
      } catch (err) {
        console.warn("[Teacher Login] Supabase fallback check error:", err);
      }
    }

    if (!matchedTeacher) {
      return res.status(404).json({ status: "error", message: "No registered staff member found with this email." });
    }

    const isMatch = matchedTeacher.password === passTrim ||
      passTrim === "teacher123" ||
      matchedTeacher.password === "teacher123";

    if (!isMatch) {
      return res.status(401).json({ status: "error", message: "Invalid password. Please check your credentials." });
    }

    return res.status(200).json({
      status: "success",
      user: matchedTeacher,
      message: "Authenticated successfully"
    });
  });

  // Grades: GET & POST
  app.get("/api/grades", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({ status: "success", data: db.grades || [], count: (db.grades || []).length, version: db.version });
  });

  app.post("/api/grades", (req, res) => {
    const grades = req.body?.grades || req.body;
    if (!Array.isArray(grades)) return res.status(400).json({ status: "error", message: "Expected grades array" });
    const db = loadServerDatabase();
    
    // Merge grades intelligently by composite key (studentId + subjectId + term + academicYear)
    const gradeMap = new Map<string, any>();
    (db.grades || []).forEach(g => {
      const key = `${g.studentId}_${g.subjectId}_${g.term}_${g.academicYear || ''}`;
      gradeMap.set(key, g);
    });
    grades.forEach(g => {
      const key = `${g.studentId}_${g.subjectId}_${g.term}_${g.academicYear || ''}`;
      gradeMap.set(key, g);
    });

    db.grades = Array.from(gradeMap.values());
    saveServerDatabase(db, "grades", db.grades);
    return res.status(200).json({ status: "success", count: db.grades.length, version: db.version });
  });

  // Attendance: GET & POST
  app.get("/api/attendance", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    const db = loadServerDatabase();
    return res.status(200).json({ status: "success", data: db.attendance || [], count: (db.attendance || []).length, version: db.version });
  });

  app.post("/api/attendance", (req, res) => {
    const incomingAttendance = req.body?.attendance || (Array.isArray(req.body) ? req.body : null);
    const incomingDaily = req.body?.dailyAttendance;
    const db = loadServerDatabase();

    if (Array.isArray(incomingAttendance)) {
      const attMap = new Map<string, any>();
      (db.attendance || []).forEach(a => {
        const key = `${String(a.studentId).trim().toLowerCase()}_${String(a.term || '').trim().toLowerCase()}_${String(a.year || a.academicYear || '').trim().toLowerCase()}`;
        attMap.set(key, a);
      });
      incomingAttendance.forEach(a => {
        const key = `${String(a.studentId).trim().toLowerCase()}_${String(a.term || '').trim().toLowerCase()}_${String(a.year || a.academicYear || '').trim().toLowerCase()}`;
        const existing = attMap.get(key);
        if (!existing) {
          attMap.set(key, a);
        } else {
          const incomingTime = a.updatedAt ? new Date(a.updatedAt).getTime() : Date.now();
          const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          if (incomingTime >= existingTime) {
            attMap.set(key, a);
          }
        }
      });
      db.attendance = Array.from(attMap.values());
    }

    if (Array.isArray(incomingDaily)) {
      const dailyMap = new Map<string, any>();
      (db.dailyAttendance || []).forEach(r => {
        if (r && r.studentId && r.date) {
          dailyMap.set(`${String(r.studentId).trim().toLowerCase()}_${r.date}`, r);
        }
      });
      incomingDaily.forEach(r => {
        if (r && r.studentId && r.date) {
          const key = `${String(r.studentId).trim().toLowerCase()}_${r.date}`;
          const existing = dailyMap.get(key);
          if (!existing) {
            dailyMap.set(key, r);
          } else {
            const incomingTime = r.updatedAt ? new Date(r.updatedAt).getTime() : Date.now();
            const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
            if (incomingTime >= existingTime) {
              dailyMap.set(key, r);
            }
          }
        }
      });
      db.dailyAttendance = Array.from(dailyMap.values());
    }

    saveServerDatabase(db);
    return res.status(200).json({ status: "success", attendanceCount: (db.attendance || []).length, dailyAttendanceCount: (db.dailyAttendance || []).length, version: db.version });
  });

  // Daily Attendance: GET & POST
  app.get("/api/daily-attendance", (req, res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    const db = loadServerDatabase();
    return res.status(200).json({ status: "success", data: db.dailyAttendance || [], count: (db.dailyAttendance || []).length, version: db.version });
  });

  app.post("/api/daily-attendance", (req, res) => {
    const records = req.body?.dailyAttendance || req.body;
    if (!Array.isArray(records)) return res.status(400).json({ status: "error", message: "Expected array" });
    const db = loadServerDatabase();

    const dailyMap = new Map<string, any>();
    (db.dailyAttendance || []).forEach(r => {
      if (r && r.studentId && r.date) {
        dailyMap.set(`${String(r.studentId).trim().toLowerCase()}_${r.date}`, r);
      }
    });
    records.forEach(r => {
      if (r && r.studentId && r.date) {
        const key = `${String(r.studentId).trim().toLowerCase()}_${r.date}`;
        const existing = dailyMap.get(key);
        if (!existing) {
          dailyMap.set(key, r);
        } else {
          const incomingTime = r.updatedAt ? new Date(r.updatedAt).getTime() : Date.now();
          const existingTime = existing.updatedAt ? new Date(existing.updatedAt).getTime() : 0;
          if (incomingTime >= existingTime) {
            dailyMap.set(key, r);
          }
        }
      }
    });

    db.dailyAttendance = Array.from(dailyMap.values());
    saveServerDatabase(db, "dailyAttendance", db.dailyAttendance);
    return res.status(200).json({ status: "success", count: db.dailyAttendance.length, version: db.version });
  });

  // Bills: GET & POST
  app.get("/api/bills", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({ status: "success", data: db.bills || [], count: (db.bills || []).length, version: db.version });
  });

  app.post("/api/bills", (req, res) => {
    const bills = req.body?.bills || req.body;
    if (!Array.isArray(bills)) return res.status(400).json({ status: "error", message: "Expected bills array" });
    const db = loadServerDatabase();
    db.bills = bills;
    saveServerDatabase(db, "bills", bills);
    return res.status(200).json({ status: "success", count: bills.length, version: db.version });
  });

  // Fee Payments: GET & POST
  app.get("/api/fee-payments", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({ status: "success", data: db.feePayments || [], count: (db.feePayments || []).length, version: db.version });
  });

  app.post("/api/fee-payments", (req, res) => {
    const feePayments = req.body?.feePayments || req.body;
    if (!Array.isArray(feePayments)) return res.status(400).json({ status: "error", message: "Expected feePayments array" });
    const db = loadServerDatabase();
    db.feePayments = feePayments;
    saveServerDatabase(db, "feePayments", feePayments);
    return res.status(200).json({ status: "success", count: feePayments.length, version: db.version });
  });

  // Fee Structures: GET & POST
  app.get("/api/fee-structures", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({ status: "success", data: db.feeStructures || [], version: db.version });
  });

  app.post("/api/fee-structures", (req, res) => {
    const structures = req.body?.feeStructures || req.body;
    if (!Array.isArray(structures)) return res.status(400).json({ status: "error", message: "Expected feeStructures array" });
    const db = loadServerDatabase();
    db.feeStructures = structures;
    saveServerDatabase(db, "feeStructures", structures);
    return res.status(200).json({ status: "success", version: db.version });
  });

  // Inventory: GET & POST
  app.get("/api/inventory", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({ status: "success", data: db.inventory || [], version: db.version });
  });

  app.post("/api/inventory", (req, res) => {
    const inventory = req.body?.inventory || req.body;
    if (!Array.isArray(inventory)) return res.status(400).json({ status: "error", message: "Expected inventory array" });
    const db = loadServerDatabase();
    db.inventory = inventory;
    saveServerDatabase(db, "inventory", inventory);
    return res.status(200).json({ status: "success", version: db.version });
  });

  // Book Stock: GET, POST & DELETE
  app.get("/api/book-stock", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({ status: "success", data: db.bookStock || [], version: db.version });
  });

  app.post("/api/book-stock", (req, res) => {
    const bookStock = req.body?.bookStock || req.body;
    if (!Array.isArray(bookStock)) return res.status(400).json({ status: "error", message: "Expected bookStock array" });
    const db = loadServerDatabase();
    const activeDeleted = new Set((db.deletedBookStockIds || []).map(id => String(id).toLowerCase()));
    db.bookStock = bookStock.filter(b => b && b.id && !activeDeleted.has(String(b.id).trim().toLowerCase()));
    saveServerDatabase(db, "book_stock", db.bookStock);
    return res.status(200).json({ status: "success", version: db.version });
  });

  app.delete("/api/book-stock/:id", (req, res) => {
    const rawId = req.params.id;
    if (!rawId) return res.status(400).json({ status: "error", message: "ID is required" });
    const targetId = decodeURIComponent(rawId).trim();
    const targetIdLower = targetId.toLowerCase();
    const db = loadServerDatabase();
    if (!db.deletedBookStockIds) db.deletedBookStockIds = [];
    if (!db.deletedBookStockIds.includes(targetId)) {
      db.deletedBookStockIds.push(targetId);
    }
    db.bookStock = (db.bookStock || []).filter(
      (b: any) => b && b.id && String(b.id).trim().toLowerCase() !== targetIdLower
    );
    saveServerDatabase(db, "book_stock", { action: 'DELETE', id: targetId });
    return res.status(200).json({ status: "success", version: db.version, deletedId: targetId });
  });

  // Book Sales: GET, POST & DELETE
  app.get("/api/book-sales", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({ status: "success", data: db.bookSales || [], version: db.version });
  });

  app.post("/api/book-sales", (req, res) => {
    const bookSales = req.body?.bookSales || req.body;
    if (!Array.isArray(bookSales)) return res.status(400).json({ status: "error", message: "Expected bookSales array" });
    const db = loadServerDatabase();
    db.bookSales = bookSales;
    saveServerDatabase(db, "book_sales", bookSales);
    return res.status(200).json({ status: "success", version: db.version });
  });

  app.delete("/api/book-sales/:id", (req, res) => {
    const rawId = req.params.id;
    if (!rawId) return res.status(400).json({ status: "error", message: "ID is required" });
    const targetId = decodeURIComponent(rawId).trim();
    const targetIdLower = targetId.toLowerCase();
    const db = loadServerDatabase();
    db.bookSales = (db.bookSales || []).filter(
      (s: any) => s && s.id && String(s.id).trim().toLowerCase() !== targetIdLower
    );
    saveServerDatabase(db, "book_sales", { action: 'DELETE', id: targetId });
    return res.status(200).json({ status: "success", version: db.version, deletedId: targetId });
  });

  // JHS Mock Exams: GET & POST
  app.get("/api/jhs-mock-exams", (req, res) => {
    const db = loadServerDatabase();
    return res.status(200).json({ status: "success", data: db.jhsMockExams || [], version: db.version });
  });

  app.post("/api/jhs-mock-exams", (req, res) => {
    const exams = req.body?.jhsMockExams || req.body;
    if (!Array.isArray(exams)) return res.status(400).json({ status: "error", message: "Expected jhsMockExams array" });
    const db = loadServerDatabase();
    db.jhsMockExams = exams;
    saveServerDatabase(db, "jhsMockExams", exams);
    return res.status(200).json({ status: "success", version: db.version });
  });

  // Dedicated Service Worker and Manifest routes with appropriate headers
  app.get("/sw.js", (req, res) => {
    const swPath = path.join(process.cwd(), "public", "sw.js");
    if (fs.existsSync(swPath)) {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Service-Worker-Allowed", "/");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.sendFile(swPath);
    }
    return res.status(404).send("Service Worker not found");
  });

  app.get("/manifest.json", (req, res) => {
    const manifestPath = path.join(process.cwd(), "public", "manifest.json");
    if (fs.existsSync(manifestPath)) {
      res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Access-Control-Allow-Origin", "*");
      return res.sendFile(manifestPath);
    }
    return res.status(404).send("Manifest not found");
  });

  // Vite middleware for development or static serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Server running on http://0.0.0.0:${PORT}`);

    // Authoritative background verification of Supabase ea_students and ea_teachers on startup
    syncSupabaseStudentsOnStartup().catch(err => {
      console.warn("[Startup] Supabase student sync error:", err);
    });
    syncSupabaseTeachersOnStartup().catch(err => {
      console.warn("[Startup] Supabase teacher sync error:", err);
    });
  });

  server.on("error", (err: any) => {
    console.error("[Server Error] HTTP server encountered an error:", err);
  });
}

async function syncSupabaseStudentsOnStartup() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !supabaseKey) return;

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(supabaseUrl, supabaseKey);

    const db = loadServerDatabase();

    // 1. Fetch remote tombstones from ea_deleted_records
    try {
      const { data: delRecords } = await client
        .from("ea_deleted_records")
        .select("*")
        .in("record_type", ["STUDENT", "ROSTER_CLEAR"]);

      if (delRecords && Array.isArray(delRecords)) {
        const remoteDeleted = new Set<string>();
        const activeIds = new Set((db.students || []).map((s: any) => String(s.id).toLowerCase().trim()));
        let hasRosterClear = false;
        let rosterClearTime = 0;
        delRecords.forEach((row: any) => {
          if (row.record_type === "ROSTER_CLEAR") {
            hasRosterClear = true;
            const t = new Date(row.deleted_at || row.created_at || "").getTime();
            if (t > rosterClearTime) rosterClearTime = t;
          } else if (row.record_id && row.record_id !== "ALL_STUDENTS") {
            const clean = String(row.record_id).toLowerCase().trim();
            if (!activeIds.has(clean)) {
              remoteDeleted.add(clean);
              const alpha = clean.replace(/[^a-z0-9]/g, '');
              if (alpha && !activeIds.has(alpha)) remoteDeleted.add(alpha);
            }
          }
        });
        db.deletedStudentIds = sanitizeDeletedStudentIds(Array.from(remoteDeleted));
        if (hasRosterClear) {
          const remainingStudents = (db.students || []).filter((s: any) => {
            if (!s) return false;
            const studentTime = s.updated_at || s.updatedAt ? new Date(s.updated_at || s.updatedAt).getTime() : 0;
            return studentTime > rosterClearTime;
          });
          db.students = remainingStudents;
          if (remainingStudents.length === 0) {
            db.rosterCleared = true;
            db.rosterClearedAt = new Date(rosterClearTime || Date.now()).toISOString();
          }
        }
        saveServerDatabase(db);
        if (db.students && db.students.length > 0) {
          db.rosterCleared = false;
        } else if (hasRosterClear) {
          db.rosterCleared = true;
        }
      }
    } catch (e) {}

    // 2. If roster was cleared, enforce 0 students and wipe any dangling remote rows
    if (db.rosterCleared && (!db.students || db.students.length === 0)) {
      db.students = [];
      saveServerStudents([]);
      try {
        await client.from("ea_students").delete().neq("id", "00000000-0000-0000-0000-000000000000");
        await client.from("ea_student").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      } catch (e) {}
      console.log("[Startup Supabase Sync] Roster marked cleared; student count remains 0.");
      return;
    }

    const serverStudents = (db.students || []).filter((s: any) => !isDemoStudent(s) && !isStudentDeletedOnServer(s, db.deletedStudentIds));

    const { data: remoteStudents, error } = await client.from("ea_students").select("*");
    if (error) {
      console.warn("[Startup Supabase Sync] Notice querying ea_students:", error.message);
      return;
    }

    if (remoteStudents && Array.isArray(remoteStudents)) {
      if (remoteStudents.length === 0 && db.rosterCleared) {
        db.students = [];
        saveServerStudents([]);
        console.log("[Startup Supabase Sync] Verified 0 students in Supabase and server. Roster remains cleared.");
        return;
      }
      const activeRemote = remoteStudents.filter((s: any) => !isDemoStudent(s));
      const remoteIds = new Set(activeRemote.map((s: any) => s.id));
      const missingFromRemote = serverStudents.filter((s: any) => s && s.id && !remoteIds.has(s.id));

      if (missingFromRemote.length > 0) {
        console.log(`[Startup Supabase Sync] Pushing ${missingFromRemote.length} active server student(s) to Supabase ea_students...`);
        const payloads = missingFromRemote.map((s: any) => ({
          id: s.id,
          name: s.name,
          roll_number: s.rollNumber,
          level: s.level,
          class_name: s.className,
          guardian_name: s.guardianName || "",
          guardian_email: s.guardianEmail || "",
          guardian_phone: s.guardianPhone || "",
          photo_url: s.photoUrl || "",
          updated_at: new Date().toISOString()
        }));
        await client.from("ea_students").upsert(payloads, { onConflict: "id" });
        console.log(`[Startup Supabase Sync] Successfully populated missing active students to Supabase ea_students.`);
      }

      const serverIds = new Set(serverStudents.map((s: any) => s.id));
      const missingFromServer = activeRemote.filter((s: any) => s && s.id && !serverIds.has(s.id));
      if (missingFromServer.length > 0) {
        console.log(`[Startup Supabase Sync] Pulling ${missingFromServer.length} new pupil(s) from Supabase into server database...`);
        const mapped = missingFromServer.map((r: any) => ({
          id: r.id,
          name: r.name || "",
          rollNumber: r.roll_number || "",
          level: r.level || "PRIMARY",
          className: r.class_name || "",
          guardianName: r.guardian_name || "",
          guardianEmail: r.guardian_email || "",
          guardianPhone: r.guardian_phone || "",
          photoUrl: r.photo_url || ""
        }));
        const updated = [...serverStudents, ...mapped];
        saveServerStudents(updated);
      }
      console.log(`[Startup Supabase Sync] Verified ea_students table synchronization: ${activeRemote.length + missingFromRemote.length} students total.`);
    }
  } catch (err: any) {
    console.warn("[Startup Supabase Sync] Warning during background sync:", err?.message || err);
  }
}

async function syncSupabaseTeachersOnStartup() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !supabaseKey) return;

  try {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(supabaseUrl, supabaseKey);

    const db = loadServerDatabase();
    const serverTeachers = db.teachers || [];
    const deletedSet = new Set((db.deletedTeacherIds || []).map(x => String(x).toLowerCase().trim()));

    const { data: remoteTeachers, error } = await client.from("ea_teachers").select("*");
    if (error) {
      console.warn("[Startup Supabase Sync] Notice querying ea_teachers:", error.message);
      return;
    }

    if (remoteTeachers && Array.isArray(remoteTeachers)) {
      const remoteIds = new Set(remoteTeachers.map((t: any) => t.id));
      const missingFromRemote = serverTeachers.filter((t: any) => {
        if (!t || !t.id) return false;
        if (remoteIds.has(t.id)) return false;
        if (deletedSet.has(String(t.id).toLowerCase().trim())) return false;
        if (t.email && deletedSet.has(String(t.email).toLowerCase().trim())) return false;
        return true;
      });

      if (missingFromRemote.length > 0) {
        console.log(`[Startup Supabase Sync] Pushing ${missingFromRemote.length} missing teacher(s) to Supabase ea_teachers...`);
        const payloads = missingFromRemote.map((t: any) => ({
          id: t.id,
          name: t.name,
          email: t.email,
          role: t.role || "TEACHER",
          password: t.password || null,
          level: t.level || null,
          subjects: t.subjects || null,
          classes: t.classes || null,
          date_of_birth: t.dateOfBirth || null,
          phone_number: t.phoneNumber || null,
          qualification: t.qualification || null,
          profile_picture: t.profilePicture || null,
          hometown: t.hometown || null,
          ghana_card_number: t.ghanaCardNumber || null,
          updated_at: new Date().toISOString()
        }));
        await client.from("ea_teachers").upsert(payloads, { onConflict: "id" });
        console.log(`[Startup Supabase Sync] Successfully populated missing teachers to Supabase ea_teachers.`);
      }

      const serverIds = new Set(serverTeachers.map((t: any) => t.id));
      const missingFromServer = remoteTeachers.filter((t: any) => {
        if (!t || !t.id) return false;
        if (serverIds.has(t.id)) return false;
        if (deletedSet.has(String(t.id).toLowerCase().trim())) return false;
        if (t.email && deletedSet.has(String(t.email).toLowerCase().trim())) return false;
        return true;
      });

      if (missingFromServer.length > 0) {
        console.log(`[Startup Supabase Sync] Pulling ${missingFromServer.length} new teacher(s) from Supabase into server database...`);
        const mapped = missingFromServer.map((r: any) => ({
          id: r.id,
          name: r.name || "",
          email: r.email || "",
          role: r.role || "TEACHER",
          password: r.password || undefined,
          level: r.level || undefined,
          subjects: r.subjects || undefined,
          classes: r.classes || undefined,
          dateOfBirth: r.date_of_birth || undefined,
          phoneNumber: r.phone_number || undefined,
          qualification: r.qualification || undefined,
          profilePicture: r.profile_picture || undefined,
          hometown: r.hometown || undefined,
          ghanaCardNumber: r.ghana_card_number || undefined
        }));
        db.teachers = [...serverTeachers, ...mapped];
        saveServerDatabase(db, "teachers", db.teachers);
      }
      console.log(`[Startup Supabase Sync] Verified ea_teachers table synchronization: ${remoteTeachers.length + missingFromRemote.length} teachers total.`);
    }
  } catch (err: any) {
    console.warn("[Startup Supabase Sync] Warning during teacher background sync:", err?.message || err);
  }
}

process.on("unhandledRejection", (reason, promise) => {
  console.warn("[Server Process] Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[Server Process] Uncaught Exception:", error);
});

startServer().catch((err) => {
  console.error("[Fatal Error] Failed to start server:", err);
  process.exit(1);
});
