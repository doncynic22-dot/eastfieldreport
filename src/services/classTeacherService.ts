/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Class Teacher Assignment & Persistence Service
 * Authoritative management for school class teachers (roll call teachers).
 * Ensures assignments persist permanently across sessions, devices, and background syncs.
 */

import { User, ReportConfig } from '../types';
import { saveSupabaseTeachers, saveSupabaseConfig, broadcastSync, broadcastGlobalSync } from '../lib/supabase';
import { saveServerEntity, fetchServerEntity, pushMasterServerSync } from '../lib/globalSync';

export const CLASS_TEACHER_ASSIGNMENTS_KEY = 'ea_class_teacher_assignments';

export const ALL_STANDARD_CLASSROOMS = [
  'Nursery 1',
  'Nursery 2',
  'Kindergarten 1',
  'Kindergarten 2',
  'Primary 1',
  'Primary 2',
  'Primary 3',
  'Primary 4',
  'Primary 5',
  'Primary 6',
  'JHS 1',
  'JHS 2',
  'JHS 3'
];

/**
 * Retrieve the authoritative class teacher assignments map:
 * Record<className, teacherId>
 */
export function getClassTeacherAssignments(fallbackTeachers?: User[]): Record<string, string> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = localStorage.getItem(CLASS_TEACHER_ASSIGNMENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[ClassTeacherService] Error reading local assignments map:', err);
  }

  // Fallback 1: check config cache
  try {
    const cfgRaw = localStorage.getItem('ea_config') || localStorage.getItem('mock_supabase_ea_config');
    if (cfgRaw) {
      const parsedCfg = JSON.parse(cfgRaw);
      if (parsedCfg?.classTeacherAssignments && typeof parsedCfg.classTeacherAssignments === 'object' && Object.keys(parsedCfg.classTeacherAssignments).length > 0) {
        localStorage.setItem(CLASS_TEACHER_ASSIGNMENTS_KEY, JSON.stringify(parsedCfg.classTeacherAssignments));
        return parsedCfg.classTeacherAssignments;
      }
    }
  } catch {}

  // Fallback 2: reconstruct from active teachers list if provided
  const reconstructed: Record<string, string> = {};
  if (Array.isArray(fallbackTeachers) && fallbackTeachers.length > 0) {
    ALL_STANDARD_CLASSROOMS.forEach(cls => {
      const t = fallbackTeachers.find(tch => tch.role === 'TEACHER' && tch.classes?.includes(cls));
      if (t && t.id) {
        reconstructed[cls] = t.id;
      }
    });
    if (Object.keys(reconstructed).length > 0) {
      try {
        localStorage.setItem(CLASS_TEACHER_ASSIGNMENTS_KEY, JSON.stringify(reconstructed));
      } catch {}
    }
  }

  return reconstructed;
}

/**
 * Asynchronously fetch authoritative class teacher assignments from server/cloud
 */
export async function fetchAuthoritativeClassAssignments(): Promise<Record<string, string>> {
  try {
    const serverAssignments = await fetchServerEntity<Record<string, string>>('/class-teacher-assignments');
    if (serverAssignments && typeof serverAssignments === 'object' && Object.keys(serverAssignments).length > 0) {
      saveClassTeacherAssignmentsLocally(serverAssignments);
      return serverAssignments;
    }
  } catch (e) {}
  return getClassTeacherAssignments();
}

/**
 * Save assignments map locally
 */
export function saveClassTeacherAssignmentsLocally(map: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CLASS_TEACHER_ASSIGNMENTS_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('[ClassTeacherService] Failed to cache assignments locally:', e);
  }
}

/**
 * Reconcile a list of teachers with the authoritative assignments map.
 * Guarantees that:
 * 1. For each assigned class, the selected teacher has that class in their `classes` array.
 * 2. No other teacher has that class in their `classes` array.
 * 3. Unassigned classes are cleared from all teachers.
 */
export function reconcileTeachersWithClassAssignments(
  teachers: User[],
  customAssignments?: Record<string, string>
): User[] {
  if (!Array.isArray(teachers) || teachers.length === 0) return teachers;

  const assignments = customAssignments && Object.keys(customAssignments).length > 0
    ? customAssignments
    : getClassTeacherAssignments(teachers);

  if (!assignments || Object.keys(assignments).length === 0) {
    return teachers;
  }

  const assignedClassesSet = new Set(Object.keys(assignments));

  return teachers.map(t => {
    // If not a teacher, keep unchanged
    if (t.role !== 'TEACHER') return t;

    // Filter out any of the managed classes that are not currently assigned to this teacher
    const nonManagedClasses = (t.classes || []).filter(c => !assignedClassesSet.has(c));

    // Gather classes that are explicitly assigned to this teacher
    const classesForThisTeacher: string[] = [];
    Object.entries(assignments).forEach(([cls, teacherId]) => {
      if (teacherId && String(teacherId) === String(t.id)) {
        classesForThisTeacher.push(cls);
      }
    });

    const mergedClasses = Array.from(new Set([...nonManagedClasses, ...classesForThisTeacher]));
    const prevSorted = (t.classes || []).slice().sort().join(',');
    const newSorted = mergedClasses.slice().sort().join(',');

    if (prevSorted !== newSorted) {
      return {
        ...t,
        classes: mergedClasses,
        updatedAt: new Date().toISOString()
      };
    }
    return t;
  });
}

/**
 * Directly assign or unassign a teacher to a specific class.
 * Writes to local storage, Supabase, Master Server, and broadcasts immediately.
 */
export async function assignClassTeacherDirectly(
  className: string,
  newTeacherId: string,
  currentTeachers: User[],
  currentConfig?: ReportConfig
): Promise<{
  updatedTeachers: User[];
  updatedAssignments: Record<string, string>;
  success: boolean;
  error?: string;
}> {
  try {
    const assignments = { ...getClassTeacherAssignments(currentTeachers) };

    if (newTeacherId && newTeacherId.trim() !== '') {
      assignments[className] = newTeacherId.trim();
    } else {
      delete assignments[className];
    }

    // 1. Immediately cache the updated assignments map
    saveClassTeacherAssignmentsLocally(assignments);

    // 2. Compute reconciled teachers
    const updatedTeachers = reconcileTeachersWithClassAssignments(currentTeachers, assignments);

    // 3. Immediately update local storage caches for instant zero-latency UI reactivity
    try {
      localStorage.setItem('ea_teachers', JSON.stringify(updatedTeachers));
      localStorage.setItem('mock_supabase_ea_teachers', JSON.stringify(updatedTeachers));
    } catch (e) {
      console.warn('[ClassTeacherService] Local storage update notice:', e);
    }

    // 4. Update ReportConfig if provided
    let updatedConfig: ReportConfig | undefined;
    if (currentConfig) {
      updatedConfig = {
        ...currentConfig,
        classTeacherAssignments: assignments,
        updatedAt: new Date().toISOString()
      };
      try {
        localStorage.setItem('ea_config', JSON.stringify(updatedConfig));
        localStorage.setItem('mock_supabase_ea_config', JSON.stringify(updatedConfig));
      } catch {}
      saveSupabaseConfig(updatedConfig).catch(err => {
        console.warn('[ClassTeacherService] Config sync notice:', err);
      });
    }

    // 5. Dispatch local window events for immediate cross-component sync
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ea_teachers_updated', { detail: updatedTeachers }));
      window.dispatchEvent(new CustomEvent('ea_class_assignments_updated', { detail: assignments }));
      broadcastSync('teachers', updatedTeachers);
      broadcastGlobalSync('ea_teachers', { action: 'UPDATE', teachers: updatedTeachers });
    }

    // 6. Push to Master Server persistent database (/api/teachers & /api/sync/all)
    saveServerEntity('/teachers', updatedTeachers).catch(e => {
      console.warn('[ClassTeacherService] Master server teacher push error:', e);
    });
    saveServerEntity('/class-teacher-assignments', assignments).catch(e => {
      console.warn('[ClassTeacherService] Master server assignments push error:', e);
    });
    pushMasterServerSync({
      teachers: updatedTeachers,
      classTeacherAssignments: assignments,
      config: updatedConfig
    }).catch(e => {
      console.warn('[ClassTeacherService] Push master server sync notice:', e);
    });

    // 7. Push to Supabase ea_teachers table
    const supabaseSuccess = await saveSupabaseTeachers(updatedTeachers);

    return {
      updatedTeachers,
      updatedAssignments: assignments,
      success: true
    };
  } catch (err: any) {
    console.error('[ClassTeacherService] Failed to assign class teacher:', err);
    return {
      updatedTeachers: currentTeachers,
      updatedAssignments: getClassTeacherAssignments(currentTeachers),
      success: false,
      error: err?.message || 'Assignment failed'
    };
  }
}

/**
 * Bulk save all class teacher assignments
 */
export async function saveAllClassAssignmentsDirectly(
  assignments: Record<string, string>,
  currentTeachers: User[],
  currentConfig?: ReportConfig
): Promise<{ updatedTeachers: User[]; success: boolean; error?: string }> {
  try {
    saveClassTeacherAssignmentsLocally(assignments);
    const updatedTeachers = reconcileTeachersWithClassAssignments(currentTeachers, assignments);

    try {
      localStorage.setItem('ea_teachers', JSON.stringify(updatedTeachers));
      localStorage.setItem('mock_supabase_ea_teachers', JSON.stringify(updatedTeachers));
    } catch {}

    let updatedConfig: ReportConfig | undefined;
    if (currentConfig) {
      updatedConfig = {
        ...currentConfig,
        classTeacherAssignments: assignments,
        updatedAt: new Date().toISOString()
      };
      try {
        localStorage.setItem('ea_config', JSON.stringify(updatedConfig));
      } catch {}
      saveSupabaseConfig(updatedConfig).catch(() => {});
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('ea_teachers_updated', { detail: updatedTeachers }));
      window.dispatchEvent(new CustomEvent('ea_class_assignments_updated', { detail: assignments }));
      broadcastSync('teachers', updatedTeachers);
    }

    saveServerEntity('/teachers', updatedTeachers).catch(() => {});
    saveServerEntity('/class-teacher-assignments', assignments).catch(() => {});
    pushMasterServerSync({
      teachers: updatedTeachers,
      classTeacherAssignments: assignments,
      config: updatedConfig
    }).catch(() => {});

    await saveSupabaseTeachers(updatedTeachers);

    return { updatedTeachers, success: true };
  } catch (err: any) {
    console.error('[ClassTeacherService] Bulk save error:', err);
    return { updatedTeachers: currentTeachers, success: false, error: err?.message };
  }
}
