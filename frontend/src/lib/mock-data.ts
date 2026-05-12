import type {
  Group,
  Module,
  Student,
  Session,
  Attendance,
  AttendanceStatus,
  SessionRow,
  DashboardStats,
  WeeklyPoint,
  ModuleRatePoint,
  RankedStudent,
  TrendSnapshot,
  HeatmapCell,
  ModuleDetail,
  GroupDetail,
  SessionDetail,
  GroupWithRate,
  StudentWithRate,
  RosterEntry,
  SpoofLogEntry,
  AuditLogEntry,
  SystemHealth,
  Teacher,
  StudentSessionEntry,
  StudentProfileData,
} from '@/types/db';
import { supabase } from '@/integrations/supabase/client';
import { createSession as createBackendSession } from '@/lib/api';

// ---------- adapters: DB rows -> frontend types ----------
function adaptModule(r: any): Module {
  return {
    id: r.id,
    module_name: r.name ?? r.module_name ?? '',
    module_code: r.module_code ?? '',
    lecturer_id: r.lecturer_id,
    academic_year: r.academic_year,
    semester: r.semester,
    created_at: r.created_at ?? '',
  };
}
function adaptStudent(r: any): Student {
  return {
    id: r.id,
    student_number: r.student_number,
    full_name: r.full_name,
    email: '',
    photo_url: r.photo_url ?? null,
    created_at: r.created_at ?? '',
  };
}
function adaptGroup(r: any): Group {
  return { id: r.id, group_name: r.group_name, year: r.year, created_at: r.created_at ?? '' };
}
function adaptTeacher(r: any): Teacher {
  return {
    id: r.id, full_name: r.full_name, email: r.email ?? '',
    role: r.role ?? 'teacher', auth_user_id: r.auth_user_id, created_at: r.created_at ?? '',
  };
}
function adaptSession(r: any): Session {
  return {
    id: r.id,
    module_id: r.module_id,
    group_id: r.group_id,
    session_date: r.session_date,
    start_time: r.start_time?.slice(0, 5) ?? r.start_time,
    end_time: undefined,
    actual_started_at: r.actual_started_at ?? null,
    actual_ended_at: r.actual_ended_at ?? null,
    duration_seconds: r.duration_seconds ?? null,
    session_type: r.session_type,
    week: r.week,
    created_at: r.created_at ?? '',
  };
}
function adaptAttendance(r: any): Attendance {
  return {
    id: r.id,
    session_id: r.session_id,
    student_id: r.student_id,
    status: r.status,
    confidence: r.confidence ?? null,
    marked_at: r.marked_at,
    updated_at: r.updated_at,
  };
}

// ---------- low-level fetchers ----------
async function fetchAll<T>(table: string, adapter: (r: any) => T): Promise<T[]> {
  const { data, error } = await supabase.from(table).select('*');
  if (error) { console.error(`fetch ${table}`, error); return []; }
  return (data ?? []).map(adapter);
}

// ---------- helpers ----------
async function getCurrentTeacher(): Promise<Teacher | null> {
  const { data: u } = await supabase.auth.getUser();
  if (u.user && u.user.email) {
    // 1. If auth_user_id exists on a proper row, return it
    const { data: rows } = await supabase
      .from('teachers').select('*').eq('auth_user_id', u.user.id).maybeSingle();
    if (rows) return adaptTeacher(rows);

    // 2. Check if a ghost row exists (id === auth_user.id) 
    const { data: byId } = await supabase
      .from('teachers').select('*').eq('id', u.user.id).maybeSingle();

    // 3. Find the REAL predefined row by email
    const { data: byEmail } = await supabase
      .from('teachers').select('*').eq('email', u.user.email).maybeSingle();

    if (byEmail) {
      // Clean up the ghost row if it exists AND it's not the real row
      if (byId && byId.id !== byEmail.id) {
         await supabase.from('teachers').delete().eq('id', byId.id);
      }
      
      // Link the real row!
      await supabase.from('teachers').update({ auth_user_id: u.user.id }).eq('id', byEmail.id);
      byEmail.auth_user_id = u.user.id;
      return adaptTeacher(byEmail);
    }
    
    // If no predefined row, but we have a ghost row, return it
    if (byId) return adaptTeacher(byId);
  }
  return null;
}


async function getTeacherScope(teacher: Teacher | null) {
  const scope: {
    isTeacher: boolean;
    myGroupIds: Set<string>;
    myModuleIds: Set<string>;
    sessionFilter: (s: Session) => boolean;
  } = {
    isTeacher: false,
    myGroupIds: new Set<string>(),
    myModuleIds: new Set<string>(),
    sessionFilter: (s: Session) => !!s || true,
  };
  if (teacher && teacher.role !== 'admin') {
    scope.isTeacher = true;
    // 1. module_groups assignments (lecturer-style teachers)
    const { data: mgData } = await supabase.from('module_groups').select('module_id, group_id').eq('assigned_teacher_id', teacher.id);
    for (const mg of mgData ?? []) {
      scope.myGroupIds.add((mg as any).group_id);
      scope.myModuleIds.add((mg as any).module_id);
    }
    // 2. sessions.teacher_id assignments (covers teachers without module_groups entries)
    const { data: sessData } = await supabase.from('sessions').select('module_id, group_id').eq('teacher_id', teacher.id);
    for (const s of sessData ?? []) {
      scope.myGroupIds.add((s as any).group_id);
      scope.myModuleIds.add((s as any).module_id);
    }
    scope.sessionFilter = (s: Session) => scope.myModuleIds.has(s.module_id) && scope.myGroupIds.has(s.group_id);
  }
  return scope;
}

function filterSessions(rows: Session[], f: { moduleId?: string; groupId?: string }): Session[] {

  return rows.filter((s) => {
    if (f.moduleId && s.module_id !== f.moduleId) return false;
    if (f.groupId && s.group_id !== f.groupId) return false;
    return true;
  });
}

function buildSessionRow(
  sess: Session,
  modules: Module[],
  groups: Group[],
  attendance: Attendance[],
): SessionRow {
  const mod = modules.find((m) => m.id === sess.module_id)!;
  const grp = groups.find((g) => g.id === sess.group_id)!;
  const att = attendance.filter((a) => a.session_id === sess.id);
  const present = att.filter((a) => a.status === 'present').length;
  const absent = att.filter((a) => a.status === 'absent').length;
  return {
    session: sess, module: mod, group: grp,
    total_students: att.length,
    present_count: present, absent_count: absent,
    attendance_rate: att.length ? present / att.length : 0,
  };
}

function getDemoToday(_sessions: Session[]): string {
  // Always use real today so live-attendance sessions match the actual date
  return new Date().toISOString().slice(0, 10);
}

export interface DashboardFilters {
  moduleId?: string;
  groupId?: string;
}

// ---------- the api ----------
export const api = {
  async getCurrentTeacher(): Promise<Teacher | null> {
    return getCurrentTeacher();
  },

  async getModules(): Promise<Module[]> {
    const teacher = await getCurrentTeacher();
    const scope = await getTeacherScope(teacher);
    const modulesAll = await fetchAll<Module>('modules', adaptModule);
    return scope.isTeacher ? modulesAll.filter(m => scope.myModuleIds.has(m.id)) : modulesAll;
  },
  async getGroups(): Promise<Group[]> {
    return fetchAll('groups', adaptGroup);
  },

  async getVisibleGroups(): Promise<Group[]> {
    const teacher = await getCurrentTeacher();
    if (!teacher || teacher.role === 'admin') return fetchAll('groups', adaptGroup);

    const [groupsAll, mgRows, sessRows] = await Promise.all([
      fetchAll<Group>('groups', adaptGroup),
      supabase.from('module_groups').select('group_id, module_id, assigned_teacher_id'),
      // Also pick up groups via direct session assignments (sessions.teacher_id)
      supabase.from('sessions').select('group_id').eq('teacher_id', teacher.id),
    ]);

    if (mgRows.error) {
      console.error('module_groups visible groups', mgRows.error);
      return [];
    }

    const groupIds = new Set<string>();
    for (const row of mgRows.data ?? []) {
      if (teacher.role === 'lecturer') {
        groupIds.add((row as any).group_id);
      } else if ((row as any).assigned_teacher_id === teacher.id) {
        groupIds.add((row as any).group_id);
      }
    }
    // Include groups from sessions directly assigned to this teacher
    for (const row of sessRows.data ?? []) {
      groupIds.add((row as any).group_id);
    }
    return groupsAll.filter((g) => groupIds.has(g.id));
  },

  async getSessions(): Promise<Session[]> {
    return fetchAll('sessions', adaptSession);
  },

  async getStats(f: DashboardFilters = {}): Promise<DashboardStats> {
    const teacher = await getCurrentTeacher();
    const scope = await getTeacherScope(teacher);

    const [sessionsAll, modulesAll, groupsAll, attendanceAll, sgRows] = await Promise.all([
      fetchAll<Session>('sessions', adaptSession),
      fetchAll<Module>('modules', adaptModule),
      fetchAll<Group>('groups', adaptGroup),
      fetchAll<Attendance>('attendance', adaptAttendance),
      supabase.from('student_groups').select('*')
    ]);
    
    const fs = filterSessions(sessionsAll, f).filter(scope.sessionFilter);

    const ids = new Set(fs.map((s) => s.id));
    const att = attendanceAll.filter((a) => ids.has(a.session_id));
    const present = att.filter((a) => a.status === 'present').length;

    let scopedGroups = scope.isTeacher ? groupsAll.filter(g => scope.myGroupIds.has(g.id)) : groupsAll;
    if (f.groupId) {
      scopedGroups = scopedGroups.filter(g => g.id === f.groupId);
    }
    const scopedGroupIds = new Set(scopedGroups.map(g => g.id));
    const scopedStudentIds = new Set((sgRows.data ?? []).filter((sg: any) => scopedGroupIds.has(sg.group_id)).map((sg: any) => sg.student_id));
    const totalStudents = scopedStudentIds.size;

    const scopedModules = scope.isTeacher ? modulesAll.filter(m => scope.myModuleIds.has(m.id)) : modulesAll;

    const maxWeek = fs.length > 0 ? Math.max(...fs.map((s) => s.week)) : 0;
    const thisWeekSessions = fs.filter((s) => s.week === maxWeek);
    const doneThisWeek = thisWeekSessions.filter(s => !!s.actual_ended_at).length;

    return {
      total_students: totalStudents,
      total_modules: f.moduleId ? 1 : scopedModules.length,
      total_groups: f.groupId ? 1 : scopedGroups.length,
      total_sessions: fs.length,
      sessions_this_week: thisWeekSessions.length,
      sessions_done_this_week: doneThisWeek,
      overall_attendance_rate: att.length ? present / att.length : 0,
    };
  },

  async getWeeklyAttendance(f: DashboardFilters = {}): Promise<WeeklyPoint[]> {
    const teacher = await getCurrentTeacher();
    const scope = await getTeacherScope(teacher);
    const [sessionsAll, attendanceAll] = await Promise.all([
      fetchAll<Session>('sessions', adaptSession),
      fetchAll<Attendance>('attendance', adaptAttendance),
    ]);
    const fs = filterSessions(sessionsAll, f).filter(scope.sessionFilter);
    const byWeek = new Map<number, { present: number; total: number; sessions: number }>();
    for (const sess of fs) {
      const slot = byWeek.get(sess.week) ?? { present: 0, total: 0, sessions: 0 };
      slot.sessions += 1;
      const att = attendanceAll.filter((a) => a.session_id === sess.id);
      slot.total += att.length;
      slot.present += att.filter((a) => a.status === 'present').length;
      byWeek.set(sess.week, slot);
    }
    return [...byWeek.entries()].sort((a, b) => a[0] - b[0]).map(([week, v]) => ({
      week, sessions: v.sessions, attendance_rate: v.total ? v.present / v.total : 0,
    }));
  },

  async getAttendanceRateByModule(f: DashboardFilters = {}): Promise<ModuleRatePoint[]> {
    const teacher = await getCurrentTeacher();
    const scope = await getTeacherScope(teacher);
    const [sessionsAll, attendanceAll, modulesAll] = await Promise.all([
      fetchAll<Session>('sessions', adaptSession),
      fetchAll<Attendance>('attendance', adaptAttendance),
      fetchAll<Module>('modules', adaptModule),
    ]);
    const fs = filterSessions(sessionsAll, f).filter(scope.sessionFilter);
    const byModule = new Map<string, { present: number; total: number }>();
    for (const sess of fs) {
      const slot = byModule.get(sess.module_id) ?? { present: 0, total: 0 };
      const att = attendanceAll.filter((a) => a.session_id === sess.id);
      slot.total += att.length;
      slot.present += att.filter((a) => a.status === 'present').length;
      byModule.set(sess.module_id, slot);
    }
    return modulesAll.filter((m) => byModule.has(m.id)).map((m) => {
      const v = byModule.get(m.id)!;
      return {
        module_code: m.module_code,
        module_name: m.module_name,
        attendance_rate: v.total ? v.present / v.total : 0,
      };
    });
  },

  async getRecentSessions(f: DashboardFilters = {}, limit = 4): Promise<SessionRow[]> {
    const teacher = await getCurrentTeacher();
    const scope = await getTeacherScope(teacher);
    const [sessionsAll, modulesAll, groupsAll, attendanceAll] = await Promise.all([
      fetchAll<Session>('sessions', adaptSession),
      fetchAll<Module>('modules', adaptModule),
      fetchAll<Group>('groups', adaptGroup),
      fetchAll<Attendance>('attendance', adaptAttendance),
    ]);
    return filterSessions(sessionsAll, f).filter(scope.sessionFilter).slice()
      .sort((a, b) => (b.session_date + b.start_time).localeCompare(a.session_date + a.start_time))
      .slice(0, limit)
      .map((s) => buildSessionRow(s, modulesAll, groupsAll, attendanceAll));
  },

  async getStudentRanking(
    f: DashboardFilters = {},
    limit = 3,
  ): Promise<{ worst: RankedStudent[]; best: RankedStudent[] }> {
    const [sessionsAll, attendanceAll, studentsAll] = await Promise.all([
      fetchAll<Session>('sessions', adaptSession),
      fetchAll<Attendance>('attendance', adaptAttendance),
      fetchAll<Student>('students', adaptStudent),
    ]);
    const fs = filterSessions(sessionsAll, f);
    const ids = new Set(fs.map((s) => s.id));
    const scope = attendanceAll.filter((a) => ids.has(a.session_id));
    const per = new Map<string, { attended: number; absent: number; total: number }>();
    for (const a of scope) {
      const s = per.get(a.student_id) ?? { attended: 0, absent: 0, total: 0 };
      s.total += 1;
      if (a.status === 'present') s.attended += 1; else s.absent += 1;
      per.set(a.student_id, s);
    }
    const ranked: RankedStudent[] = [...per.entries()]
      .map(([id, v]) => ({
        student: studentsAll.find((s) => s.id === id)!,
        attended: v.attended, absent: v.absent, total: v.total,
        attendance_rate: v.total ? v.attended / v.total : 0,
      }))
      .filter((r) => r.student && r.total > 0);
    return {
      worst: [...ranked].sort((a, b) => a.attendance_rate - b.attendance_rate).slice(0, limit),
      best: [...ranked].sort((a, b) => b.attendance_rate - a.attendance_rate).slice(0, limit),
    };
  },

  async getTrend(f: DashboardFilters = {}): Promise<TrendSnapshot | null> {
    const weekly = await api.getWeeklyAttendance(f);
    if (weekly.length < 2) return null;
    const cur = weekly[weekly.length - 1];
    const prev = weekly[weekly.length - 2];
    return {
      current_week: cur.week, previous_week: prev.week,
      current_rate: cur.attendance_rate, previous_rate: prev.attendance_rate,
      delta: cur.attendance_rate - prev.attendance_rate,
    };
  },

  async getHeatmap(f: DashboardFilters = {}): Promise<HeatmapCell[]> {
    const [sessionsAll, attendanceAll] = await Promise.all([
      fetchAll<Session>('sessions', adaptSession),
      fetchAll<Attendance>('attendance', adaptAttendance),
    ]);
    const fs = filterSessions(sessionsAll, f);
    const buckets = new Map<string, { present: number; total: number; sessions: number }>();
    for (const sess of fs) {
      const d = new Date(sess.session_date);
      const jsDay = d.getUTCDay(); // 0=Sun, 1=Mon, …, 6=Sat
      if (jsDay === 5 || jsDay === 6) continue; // skip Fri & Sat (ENSIA workweek: Sun–Thu)
      const dow = jsDay; // Sun=0, Mon=1, Tue=2, Wed=3, Thu=4
      const key = `${dow}|${sess.start_time}`;
      const att = attendanceAll.filter((a) => a.session_id === sess.id);
      const b = buckets.get(key) ?? { present: 0, total: 0, sessions: 0 };
      b.sessions += 1; b.total += att.length;
      b.present += att.filter((a) => a.status === 'present').length;
      buckets.set(key, b);
    }
    return [...buckets.entries()].map(([key, v]) => {
      const [dow, slot] = key.split('|');
      return {
        day_of_week: Number(dow),
        time_slot: slot,
        attendance_rate: v.total ? v.present / v.total : 0,
        session_count: v.sessions,
      };
    });
  },

  async getModuleDetail(moduleId: string): Promise<ModuleDetail | null> {
    const [{ data: mRow }, mgsRows, sessionsAll, attendanceAll, groupsAll, teachersAll] =
      await Promise.all([
        supabase.from('modules').select('*').eq('id', moduleId).maybeSingle(),
        supabase.from('module_groups').select('*').eq('module_id', moduleId),
        fetchAll<Session>('sessions', adaptSession),
        fetchAll<Attendance>('attendance', adaptAttendance),
        fetchAll<Group>('groups', adaptGroup),
        fetchAll<Teacher>('teachers', adaptTeacher),
      ]);
    if (!mRow) return null;
    const mod = adaptModule(mRow);
    const lecturer = teachersAll.find((t) => t.id === mod.lecturer_id) ?? null;
    const mgs = (mgsRows.data ?? []) as any[];
    const uniqueGroupIds = Array.from(new Set(mgs.map(mg => mg.group_id)));
    const groupsOut: GroupWithRate[] = uniqueGroupIds.map((gid) => {
      const grp = groupsAll.find((g) => g.id === gid)!;
      const fs = sessionsAll.filter((s) => s.module_id === moduleId && s.group_id === gid);
      const ids = new Set(fs.map((s) => s.id));
      const att = attendanceAll.filter((a) => ids.has(a.session_id));
      const present = att.filter((a) => a.status === 'present').length;
      
      const groupMgs = mgs.filter(mg => mg.group_id === gid);
      const groupTeacher = groupMgs.find((mg) => mg.assigned_teacher_id) ?? null;
      const assignedTeacher = groupTeacher ? teachersAll.find(t => t.id === groupTeacher.assigned_teacher_id) : null;
      
      return {
        ...grp,
        attendance_rate: att.length ? present / att.length : 0,
        session_count: fs.length,
        assigned_teacher_name: assignedTeacher?.full_name ?? null,
        assigned_teacher_name_td: assignedTeacher?.full_name ?? null,
        assigned_teacher_name_tp: null,
        assigned_teacher_id_td: groupTeacher?.assigned_teacher_id ?? null,
        assigned_teacher_id_tp: null,
      };
    });
    const allFs = sessionsAll.filter((s) => s.module_id === moduleId);
    const allIds = new Set(allFs.map((s) => s.id));
    const allAtt = attendanceAll.filter((a) => allIds.has(a.session_id));
    const overallPresent = allAtt.filter((a) => a.status === 'present').length;
    return {
      module: mod, lecturer, groups: groupsOut,
      overall_rate: allAtt.length ? overallPresent / allAtt.length : 0,
      total_sessions: allFs.length,
    };
  },

  async getTeacherSessionTypes(): Promise<Record<string, string[]>> {
    const { data, error } = await supabase.from('module_groups').select('assigned_teacher_id');
    if (error) { console.error('module_groups', error); return {}; }
    const map: Record<string, Set<string>> = {};
    for (const row of (data ?? []) as any[]) {
      const tid = row.assigned_teacher_id;
      if (!tid) continue;
      if (!map[tid]) map[tid] = new Set();
      map[tid].add('td');
    }
    const out: Record<string, string[]> = {};
    for (const k of Object.keys(map)) out[k] = Array.from(map[k]);
    return out;
  },

  async getGroupDetail(groupId: string): Promise<GroupDetail | null> {
    const [
      { data: gRow },
      sgRows,
      sessionsAll,
      attendanceAll,
      modulesAll,
      mgRows,
      studentsAll,
    ] = await Promise.all([
      supabase.from('groups').select('*').eq('id', groupId).maybeSingle(),
      supabase.from('student_groups').select('student_id').eq('group_id', groupId),
      fetchAll<Session>('sessions', adaptSession),
      fetchAll<Attendance>('attendance', adaptAttendance),
      fetchAll<Module>('modules', adaptModule),
      supabase.from('module_groups').select('module_id').eq('group_id', groupId),
      fetchAll<Student>('students', adaptStudent),
    ]);
    if (!gRow) return null;
    const grp = adaptGroup(gRow);
    const studentIds: string[] = (sgRows.data ?? []).map((r: any) => r.student_id);
    const groupSessions = sessionsAll.filter((s) => s.group_id === groupId);
    const groupSessionIds = new Set(groupSessions.map((s) => s.id));
    const studentsOut: StudentWithRate[] = studentIds.map((sid) => {
      const att = attendanceAll.filter((a) => a.student_id === sid && groupSessionIds.has(a.session_id));
      const attended = att.filter((a) => a.status === 'present').length;
      const absent = att.filter((a) => a.status === 'absent').length;
      return {
        student: studentsAll.find((s) => s.id === sid)!,
        attendance_rate: att.length ? attended / att.length : 0,
        absent, total: att.length,
      };
    }).filter((r) => r.student).sort((a, b) => a.attendance_rate - b.attendance_rate);
    const moduleIds = new Set((mgRows.data ?? []).map((r: any) => r.module_id));
    const grpModules = modulesAll.filter((m) => moduleIds.has(m.id));
    const att = attendanceAll.filter((a) => groupSessionIds.has(a.session_id));
    const present = att.filter((a) => a.status === 'present').length;
    return {
      group: grp, students: studentsOut, modules: grpModules,
      overall_rate: att.length ? present / att.length : 0,
    };
  },

  async getSessionDetail(sessionId: string): Promise<SessionDetail | null> {
    // All queries are targeted — no full-table scans.
    const { data: sRow } = await supabase
      .from('sessions')
      .select(`*, modules:modules!sessions_module_id_fkey(*), groups:groups!sessions_group_id_fkey(*)`)
      .eq('id', sessionId)
      .maybeSingle();
    if (!sRow) return null;

    const sess = adaptSession(sRow as any);
    const mod  = adaptModule((sRow as any).modules ?? {});
    const grp  = adaptGroup((sRow as any).groups ?? {});

    // Fetch only students in this group (not the whole students table)
    const [sgRows, attRows] = await Promise.all([
      supabase
        .from('student_groups')
        .select('student_id, students!student_groups_student_id_fkey(id, full_name, student_number, photo_url, created_at)')
        .eq('group_id', sess.group_id),
      supabase.from('attendance').select('*').eq('session_id', sessionId),
    ]);

    const sessAtt = ((attRows.data ?? []) as any[]).map(adaptAttendance);
    const byStudent = new Map(sessAtt.map((a) => [a.student_id, a]));
    const roster: RosterEntry[] = ((sgRows.data ?? []) as any[]).map((r) => {
      const stu = r.students ? adaptStudent(r.students) : null;
      if (!stu) return null;
      const a = byStudent.get(r.student_id);
      return {
        student: stu,
        status: (a?.status ?? 'not_marked') as RosterEntry['status'],
        confidence: a?.confidence ?? null,
        marked_at: a?.marked_at ?? null,
      };
    }).filter(Boolean) as RosterEntry[];

    const present = roster.filter((r) => r.status === 'present').length;
    const absent  = roster.filter((r) => r.status === 'absent').length;
    const spoof   = roster.filter((r) => r.status === 'spoof').length;
    return {
      session: sess, module: mod, group: grp, roster,
      present_count: present, absent_count: absent, spoof_count: spoof,
      attendance_rate: roster.length ? present / roster.length : 0,
    };
  },

  async getTodaySessions(): Promise<SessionRow[]> {
    const teacher = await getCurrentTeacher();
    const today = getDemoToday([]);

    // Build teacher scope OR filter so we only pull rows the teacher owns —
    // avoids the full-table RLS scan (can_see_module per row → 500).
    let teacherOrFilter: string | null = null;
    if (teacher && teacher.role !== 'admin') {
      const { data: mgData } = await supabase
        .from('module_groups')
        .select('module_id, group_id')
        .eq('assigned_teacher_id', teacher.id);

      // direct teacher_id assignment  OR  module_groups combo
      const parts: string[] = [`teacher_id.eq.${teacher.id}`];
      for (const mg of mgData ?? []) {
        parts.push(`and(module_id.eq.${(mg as any).module_id},group_id.eq.${(mg as any).group_id})`);
      }
      teacherOrFilter = parts.join(',');
    }

    // Single targeted query: today's sessions + embedded module/group rows
    let query = supabase
      .from('sessions')
      .select(`*, modules:modules!sessions_module_id_fkey(*), groups:groups!sessions_group_id_fkey(*)`)
      .eq('session_date', today)
      .order('start_time');

    if (teacherOrFilter) {
      query = (query as any).or(teacherOrFilter);
    }

    const { data, error } = await query;
    if (error) { console.error('getTodaySessions', error); return []; }

    return (data ?? []).map((row: any): SessionRow => ({
      session: adaptSession(row),
      module: adaptModule(row.modules ?? {}),
      group: adaptGroup(row.groups ?? {}),
      total_students: 0,
      present_count: 0,
      absent_count: 0,
      attendance_rate: 0,
    }));
  },

  async getLiveSession() {
    // Reuse getTodaySessions (already targeted/scoped) to pick the "live" session
    const todayRows = await api.getTodaySessions();
    if (todayRows.length === 0) return null;
    const liveRow = todayRows[Math.floor(todayRows.length / 2)] ?? todayRows[0];
    const sessId = liveRow.session.id;

    // Fetch attendance only for this one session — no full table scan
    const { data: attData } = await supabase
      .from('attendance')
      .select('*, students!attendance_student_id_fkey(id, full_name, student_number, photo_url)')
      .eq('session_id', sessId);

    const sessAtt = (attData ?? []) as any[];
    const recognizedAtt = sessAtt.filter((a) => a.status === 'present' || a.status === 'spoof');
    const last = recognizedAtt.slice(-5).reverse().map((a) => ({
      student: a.students ? adaptStudent(a.students) : null,
      confidence: a.confidence ?? 0,
      at: a.marked_at,
    })).filter((x) => x.student);

    return {
      row: liveRow,
      recognized: recognizedAtt.length,
      total: sessAtt.length,
      last_recognized: last,
    };
  },

  async updateAttendanceStatus(
    sessionId: string,
    studentId: string,
    newStatus: AttendanceStatus,
  ): Promise<void> {
    const now = new Date().toISOString();
    const { data: prevRow } = await supabase
      .from('attendance').select('status')
      .eq('session_id', sessionId).eq('student_id', studentId).maybeSingle();
    const prevStatus: AttendanceStatus | 'not_marked' =
      (prevRow?.status as AttendanceStatus | undefined) ?? 'not_marked';

    const { error } = await supabase.from('attendance').upsert(
      { session_id: sessionId, student_id: studentId, status: newStatus, updated_at: now },
      { onConflict: 'session_id,student_id' },
    );
    if (error) { console.error('upsert attendance', error); throw error; }

    const actor = await getCurrentTeacher();
    const { error: e2 } = await supabase.from('audit_log').insert({
      actor_id: actor?.id ?? null,
      session_id: sessionId,
      student_id: studentId,
      prev_status: prevStatus,
      new_status: newStatus,
    });
    if (e2) console.error('audit_log insert', e2);
  },

  async getSpoofLog(f: DashboardFilters = {}): Promise<SpoofLogEntry[]> {
    const [sessionsAll, modulesAll, groupsAll, studentsAll, attRows] = await Promise.all([
      fetchAll<Session>('sessions', adaptSession),
      fetchAll<Module>('modules', adaptModule),
      fetchAll<Group>('groups', adaptGroup),
      fetchAll<Student>('students', adaptStudent),
      supabase.from('attendance').select('*').eq('status', 'spoof'),
    ]);
    const fs = filterSessions(sessionsAll, f);
    const ids = new Set(fs.map((s) => s.id));
    return ((attRows.data ?? []).map(adaptAttendance) as Attendance[])
      .filter((a) => ids.has(a.session_id))
      .sort((a, b) => (b.marked_at ?? '').localeCompare(a.marked_at ?? ''))
      .map((a) => {
        const sess = sessionsAll.find((s) => s.id === a.session_id)!;
        return {
          attendance_id: a.id,
          student: studentsAll.find((s) => s.id === a.student_id)!,
          session: sess,
          module: modulesAll.find((m) => m.id === sess.module_id)!,
          group: groupsAll.find((g) => g.id === sess.group_id)!,
          marked_at: a.marked_at,
        };
      })
      .filter((e) => e.student);
  },

  async getAuditLog(limit = 100): Promise<AuditLogEntry[]> {
    const [{ data: rows }, sessionsAll, modulesAll, groupsAll, studentsAll, teachersAll] =
      await Promise.all([
        supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(limit),
        fetchAll<Session>('sessions', adaptSession),
        fetchAll<Module>('modules', adaptModule),
        fetchAll<Group>('groups', adaptGroup),
        fetchAll<Student>('students', adaptStudent),
        fetchAll<Teacher>('teachers', adaptTeacher),
      ]);
    if (!rows) return [];
    return rows.map((r: any) => {
      const sess = sessionsAll.find((s) => s.id === r.session_id);
      const stu = studentsAll.find((s) => s.id === r.student_id);
      const actor =
        teachersAll.find((t) => t.id === r.actor_id) ??
        ({ id: '', full_name: 'Unknown', email: '', role: 'teacher', created_at: '' } as Teacher);
      const mod = sess ? modulesAll.find((m) => m.id === sess.module_id) : undefined;
      const grp = sess ? groupsAll.find((g) => g.id === sess.group_id) : undefined;
      return {
        id: r.id,
        at: r.at,
        actor,
        session: sess!,
        module: mod!,
        group: grp!,
        student: stu!,
        prev_status: (r.prev_status ?? 'not_marked') as AuditLogEntry['prev_status'],
        new_status: r.new_status as AttendanceStatus,
      };
    }).filter((e) => e.session && e.student && e.module && e.group);
  },

  async getSystemHealth(): Promise<SystemHealth> {
    const all = await fetchAll<Attendance>('attendance', adaptAttendance);
    const total = all.length;
    const present = all.filter((a) => a.status === 'present');
    const spoof = all.filter((a) => a.status === 'spoof');
    const recognized = present.length + spoof.length;
    const avgConf = present.length
      ? present.reduce((acc, a) => acc + (a.confidence ?? 0), 0) / present.length
      : 0;
    const byDate = new Map<string, { recognized: number; spoof: number }>();
    for (const a of all) {
      const date = (a.marked_at ?? '').slice(0, 10);
      if (!date) continue;
      const slot = byDate.get(date) ?? { recognized: 0, spoof: 0 };
      if (a.status === 'present' || a.status === 'spoof') slot.recognized += 1;
      if (a.status === 'spoof') slot.spoof += 1;
      byDate.set(date, slot);
    }
    const daily_counts = [...byDate.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-7)
      .map(([date, v]) => ({ date, recognized: v.recognized, spoof: v.spoof }));
    return {
      avg_confidence: avgConf,
      match_rate: total ? recognized / total : 0,
      spoof_rate: total ? spoof.length / total : 0,
      total_marked: total,
      daily_counts,
    };
  },

  async getStudentProfile(studentId: string): Promise<StudentProfileData | null> {
    const [
      { data: stuRow },
      sgRows,
      { data: embRows },
      sessionsAll,
      attendanceAll,
      modulesAll,
      groupsAll,
    ] = await Promise.all([
      supabase.from('students').select('*').eq('id', studentId).maybeSingle(),
      supabase.from('student_groups').select('group_id').eq('student_id', studentId),
      supabase.from('student_embeddings').select('id').eq('student_id', studentId),
      fetchAll<Session>('sessions', adaptSession),
      fetchAll<Attendance>('attendance', adaptAttendance),
      fetchAll<Module>('modules', adaptModule),
      fetchAll<Group>('groups', adaptGroup),
    ]);
    if (!stuRow) return null;
    const student = adaptStudent(stuRow);
    const groupIds: string[] = (sgRows.data ?? []).map((r: any) => r.group_id);
    const groups = groupsAll.filter((g) => groupIds.includes(g.id));

    const mySessions = sessionsAll.filter((s) => groupIds.includes(s.group_id));
    const mySessionIds = new Set(mySessions.map((s) => s.id));
    const myAtt = attendanceAll.filter(
      (a) => a.student_id === studentId && mySessionIds.has(a.session_id),
    );
    const attBySession = new Map(myAtt.map((a) => [a.session_id, a]));

    const attended = myAtt.filter((a) => a.status === 'present').length;
    const absent = myAtt.filter((a) => a.status === 'absent').length;
    const spoof = myAtt.filter((a) => a.status === 'spoof').length;

    const sessions: StudentSessionEntry[] = mySessions
      .slice()
      .sort((a, b) =>
        (b.session_date + b.start_time).localeCompare(a.session_date + a.start_time),
      )
      .map((s) => {
        const a = attBySession.get(s.id);
        return {
          session: s,
          module: modulesAll.find((m) => m.id === s.module_id)!,
          group: groupsAll.find((g) => g.id === s.group_id)!,
          status: (a?.status ?? 'not_marked') as AttendanceStatus | 'not_marked',
          confidence: a?.confidence ?? null,
          marked_at: a?.marked_at ?? null,
        };
      })
      .filter((e) => e.module && e.group);

    const byWeek = new Map<number, { present: number; total: number }>();
    for (const s of mySessions) {
      const a = attBySession.get(s.id);
      const slot = byWeek.get(s.week) ?? { present: 0, total: 0 };
      slot.total += 1;
      if (a?.status === 'present') slot.present += 1;
      byWeek.set(s.week, slot);
    }
    const weekly_rates: WeeklyPoint[] = [...byWeek.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([week, v]) => ({
        week,
        attendance_rate: v.total ? v.present / v.total : 0,
        sessions: v.total,
      }));

    return {
      student,
      groups,
      embedding_count: (embRows ?? []).length,
      total_sessions: mySessions.length,
      attended,
      absent,
      spoof,
      attendance_rate: mySessions.length ? attended / mySessions.length : 0,
      sessions,
      weekly_rates,
    };
  },

  // ---- session finalization ----
  async finalizeSession(
    sessionId: string,
    timing?: { startedAt?: string | null; endedAt?: string },
  ): Promise<number> {
    const { data: sRow } = await supabase
      .from('sessions').select('group_id').eq('id', sessionId).maybeSingle();
    if (!sRow) return 0;
    const endedAt = timing?.endedAt ?? new Date().toISOString();
    if (timing) {
      const startedAt = timing.startedAt ?? endedAt;
      const durationSeconds = Math.max(
        0,
        Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000),
      );
      const { error: sessionUpdateError } = await supabase
        .from('sessions')
        .update({
          actual_started_at: startedAt,
          actual_ended_at: endedAt,
          duration_seconds: durationSeconds,
        })
        .eq('id', sessionId);
      if (sessionUpdateError) {
        console.error('session duration update failed', sessionUpdateError);
        throw new Error(
          sessionUpdateError.code === 'PGRST204'
            ? 'Session duration columns are missing. Apply the latest Supabase migration, then try again.'
            : `Failed to update session duration: ${sessionUpdateError.message}`,
        );
      }
    }
    const { data: sgRows } = await supabase
      .from('student_groups').select('student_id').eq('group_id', (sRow as any).group_id);
    const allIds: string[] = (sgRows ?? []).map((r: any) => r.student_id);
    const { data: attRows } = await supabase
      .from('attendance').select('student_id,status').eq('session_id', sessionId);
    const done = new Set(
      (attRows ?? [])
        .filter((r: any) => r.status === 'present' || r.status === 'spoof')
        .map((r: any) => r.student_id),
    );
    const toMark = allIds.filter((sid) => !done.has(sid));
    if (toMark.length === 0) return 0;
    const actor = await getCurrentTeacher();
    await supabase.from('attendance').upsert(
      toMark.map((student_id) => ({ session_id: sessionId, student_id, status: 'absent', updated_at: endedAt })),
      { onConflict: 'session_id,student_id' },
    );
    await supabase.from('audit_log').insert(
      toMark.map((student_id) => ({
        actor_id: actor?.id ?? null,
        session_id: sessionId,
        student_id,
        prev_status: 'not_marked',
        new_status: 'absent',
      })),
    );
    return toMark.length;
  },

  // ---- student CRUD ----
  async updateStudent(
    studentId: string,
    patch: { full_name: string; student_number: string },
  ): Promise<void> {
    const { error } = await supabase.from('students').update(patch).eq('id', studentId);
    if (error) throw error;
  },

  async deleteStudent(studentId: string): Promise<void> {
    const { error } = await supabase.from('students').delete().eq('id', studentId);
    if (error) {
      if ((error as any).code === '23503')
        throw new Error('Cannot delete — student has attendance records.');
      throw error;
    }
  },

  // ---- module CRUD ----
  async deleteModule(moduleId: string): Promise<void> {
    const { error } = await supabase.from('modules').delete().eq('id', moduleId);
    if (error) {
      if ((error as any).code === '23503')
        throw new Error('Cannot delete — module has linked sessions or groups.');
      throw error;
    }
  },

  // ---- bulk CSV import ----
  async importStudents(
    rows: { full_name: string; student_number: string; group_name: string }[],
  ): Promise<{ ok: number; skipped: number; errors: string[] }> {
    const allGroups = await fetchAll<Group>('groups', adaptGroup);
    const groupByName = new Map(allGroups.map((g) => [g.group_name.toLowerCase().trim(), g.id]));
    let ok = 0, skipped = 0;
    const errors: string[] = [];
    for (const row of rows) {
      const gid = groupByName.get(row.group_name.toLowerCase().trim());
      if (!gid) {
        errors.push(`"${row.full_name}": group "${row.group_name}" not found`);
        skipped++;
        continue;
      }
      const { data: stu, error: e1 } = await supabase
        .from('students')
        .upsert(
          { student_number: row.student_number.trim(), full_name: row.full_name.trim() },
          { onConflict: 'student_number' },
        )
        .select('id')
        .single();
      if (e1 || !stu) {
        errors.push(`"${row.full_name}": ${e1?.message ?? 'insert failed'}`);
        skipped++;
        continue;
      }
      const { error: e2 } = await supabase
        .from('student_groups')
        .upsert(
          { student_id: (stu as any).id, group_id: gid },
          { onConflict: 'student_id,group_id', ignoreDuplicates: true },
        );
      if (e2) {
        errors.push(`"${row.full_name}": group link — ${e2.message}`);
        skipped++;
        continue;
      }
      ok++;
    }
    return { ok, skipped, errors };
  },
  // ---- teacher management (used by TeachersList page) ----
  async getAllTeachers(): Promise<Teacher[]> {
    return fetchAll<Teacher>('teachers', adaptTeacher);
  },

  async updateTeacher(id: string, patch: { full_name?: string; email?: string }): Promise<void> {
    const { error } = await supabase.from('teachers').update(patch).eq('id', id);
    if (error) throw error;
  },

  async deleteTeacher(id: string): Promise<void> {
    const { error } = await supabase.from('teachers').delete().eq('id', id);
    if (error) {
      if ((error as any).code === '23503')
        throw new Error('Cannot delete — teacher has linked records.');
      throw error;
    }
  },

  async importTeachers(rows: { full_name: string; email: string }[]): Promise<{ ok: number; skipped: number; errors: string[] }> {
    let ok = 0, skipped = 0; const errors: string[] = [];
    for (const r of rows) {
      const { data, error } = await supabase.from('teachers').upsert(
        { full_name: r.full_name.trim(), email: r.email.trim() },
        { onConflict: 'email', ignoreDuplicates: true },
      ).select('id').single();
      if (error || !data) {
        errors.push(`${r.full_name}: ${error?.message ?? 'insert failed'}`);
        skipped++;
        continue;
      }
      ok++;
    }
    return { ok, skipped, errors };
  },

  async assignTeacherToGroup(groupId: string, moduleId: string, teacherId: string): Promise<void> {
    const { data: updatedRows, error: updateError } = await supabase
      .from('module_groups')
      .update({ assigned_teacher_id: teacherId })
      .eq('module_id', moduleId)
      .eq('group_id', groupId)
      .select('module_id');

    if (updateError) throw updateError;
    if ((updatedRows ?? []).length > 0) return;

    const { error: insertError } = await supabase
      .from('module_groups')
      .insert({
        module_id: moduleId,
        group_id: groupId,
        assigned_teacher_id: teacherId,
      });
    if (insertError) throw insertError;
  },

  async updateModule(moduleId: string, patch: { lecturer_id?: string }): Promise<void> {
    const { error } = await supabase
      .from('modules')
      .update(patch)
      .eq('id', moduleId);
    if (error) throw error;
  },

  async createSession(data: {
    module_id: string;
    group_id: string;
    session_date: string;
    start_time: string;
    session_type: 'lecture' | 'td' | 'tp' | 'exam';
    week: number;
  }): Promise<void> {
    await createBackendSession(data);
  },


};
