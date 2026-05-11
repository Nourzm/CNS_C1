import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
// ENSIA standard 1h30 slots — must match start_time values in DB
const TIME_SLOTS = ['08:30', '10:10', '11:50', '13:30', '15:10', '16:50'];

function normaliseTime(t: string): string {
  return t.substring(0, 5);
}

const TYPE_STYLE: Record<string, string> = {
  lecture: 'bg-blue-50  text-blue-700  border-blue-200',
  td:      'bg-amber-50 text-amber-700 border-amber-200',
  tp:      'bg-green-50 text-green-700 border-green-200',
  exam:    'bg-red-50   text-red-700   border-red-200',
};

// ---------- shared grid renderer ----------
interface GridCell {
  session_type: string;
  location: string | null;
  module_code: string;
  /** shown below module code — group name (teacher view) or teacher name (admin view) */
  label: string;
}

function TimetableGrid({ rows }: { rows: any[] }) {
  const grid = useMemo(() => {
    const result: Record<string, Record<string, GridCell>> = {};
    DAYS.forEach(d => (result[d] = {}));
    for (const row of rows) {
      const dayIndex = new Date(row.session_date).getDay();
      if (dayIndex >= 0 && dayIndex <= 4) {
        const dayName = DAYS[dayIndex];
        const slotKey = normaliseTime(row.start_time);
        if (!result[dayName][slotKey]) {
          result[dayName][slotKey] = {
            session_type: row.session_type,
            location: row.location ?? null,
            module_code: (row.modules as any)?.module_code ?? '—',
            label: row._label ?? '—',
          };
        }
      }
    }
    return result;
  }, [rows]);

  return (
    <div className="rounded-xl overflow-hidden border border-border shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="p-3 text-left font-medium text-muted-foreground w-28 border-r border-border">
                Day
              </th>
              {TIME_SLOTS.map(time => (
                <th key={time} className="p-3 text-center font-medium text-muted-foreground border-r border-border last:border-0 min-w-[140px]">
                  {time}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map(day => (
              <tr key={day} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                <td className="p-3 font-semibold bg-muted/10 border-r border-border">{day}</td>
                {TIME_SLOTS.map(time => {
                  const cell = grid[day]?.[time];
                  return (
                    <td key={time} className="p-2 border-r border-border last:border-0 h-24 align-top relative">
                      {cell ? (
                        <div className="absolute inset-1 rounded-md bg-primary/10 border border-primary/20 p-2 flex flex-col justify-between shadow-sm hover:shadow-md hover:bg-primary/15 transition-all">
                          <div>
                            <div className="font-bold text-primary text-sm truncate leading-tight" title={cell.module_code}>
                              {cell.module_code}
                            </div>
                            <div className="text-xs text-foreground/80 mt-0.5 truncate" title={cell.label}>
                              {cell.label}
                            </div>
                          </div>
                          <div className="flex justify-between items-end gap-1 mt-1">
                            <Badge variant="outline" className={`text-[10px] uppercase px-1.5 py-0 border font-medium ${TYPE_STYLE[cell.session_type] ?? 'bg-muted'}`}>
                              {cell.session_type}
                            </Badge>
                            {cell.location && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[60px] text-right" title={cell.location}>
                                {cell.location}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground/30">—</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Admin view: group selector ----------
function AdminView() {
  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data, error } = await supabase.from('groups').select('id, group_name, year').order('year').order('group_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const years = useMemo(() => [...new Set(groups.map(g => g.year))].sort(), [groups]);
  const [activeYear, setActiveYear] = useState<number | null>(null);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const yearGroups = useMemo(() => {
    const y = activeYear ?? years[years.length - 1];
    return groups.filter(g => g.year === y).sort((a, b) =>
      a.group_name.localeCompare(b.group_name, undefined, { numeric: true })
    );
  }, [groups, activeYear, years]);

  // Reset group when year changes
  useMemo(() => {
    if (yearGroups.length > 0) {
      setActiveGroup(g => (yearGroups.some(yg => yg.id === g) ? g : yearGroups[0].id));
    }
  }, [yearGroups]);

  // Fetch sessions for the active group
  const { data: rawSlots = [], isPending: slotsLoading } = useQuery({
    queryKey: ['admin-group-sessions', activeGroup],
    enabled: !!activeGroup,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id, session_date, start_time, session_type, location,
          modules!sessions_module_id_fkey(module_code),
          teachers!sessions_teacher_id_fkey(full_name)
        `)
        .eq('group_id', activeGroup!)
        .order('session_date', { ascending: true });
      if (error) throw error;
      // attach _label = teacher full_name
      return (data ?? []).map(row => ({
        ...row,
        _label: (row.teachers as any)?.full_name ?? '—',
      }));
    },
  });

  return (
    <>
      {/* Year selector */}
      {years.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {years.map(y => (
            <button
              key={y}
              onClick={() => setActiveYear(y)}
              className={`px-3 py-1 rounded-full text-sm font-medium transition-colors border ${
                (activeYear ?? years[years.length - 1]) === y
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              Year {y}
            </button>
          ))}
        </div>
      )}

      {yearGroups.length > 0 && activeGroup ? (
        <Tabs value={activeGroup} onValueChange={setActiveGroup} className="w-full">
          <ScrollArea className="w-full pb-4">
            <TabsList className="inline-flex w-max mb-4">
              {yearGroups.map(g => (
                <TabsTrigger key={g.id} value={g.id} className="px-6 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                  {g.group_name}
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          {yearGroups.map(g => (
            <TabsContent key={g.id} value={g.id} className="mt-0">
              {slotsLoading ? (
                <div className="text-center py-10 text-muted-foreground">Loading…</div>
              ) : (
                <TimetableGrid rows={rawSlots} />
              )}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="text-center py-10 text-muted-foreground">
          {groups.length === 0 ? 'Loading groups…' : 'No groups for this year.'}
        </div>
      )}
    </>
  );
}

// ---------- Teacher view: personal schedule ----------
function TeacherView({ teacherId }: { teacherId: string }) {
  const { data: rawSlots = [], isPending: slotsLoading } = useQuery({
    queryKey: ['teacher-schedule', teacherId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id, session_date, start_time, session_type, location,
          modules!sessions_module_id_fkey(module_code),
          groups!sessions_group_id_fkey(group_name)
        `)
        .eq('teacher_id', teacherId)
        .order('session_date', { ascending: true });
      if (error) throw error;
      return (data ?? []).map(row => ({
        ...row,
        _label: (row.groups as any)?.group_name ?? '—',
      }));
    },
  });

  if (slotsLoading) return <div className="text-center py-10 text-muted-foreground">Loading schedule…</div>;
  if (rawSlots.length === 0) return <div className="text-center py-10 text-muted-foreground">No sessions assigned to you this semester.</div>;

  return <TimetableGrid rows={rawSlots} />;
}

// ---------- Page ----------
export default function Timetable() {
  const { user } = useAuth();

  // Resolve teacher record (includes role) — match by auth_user_id (uid) first,
  // fall back to email so first-login linking still works.
  const { data: teacher, isPending: teacherLoading } = useQuery({
    queryKey: ['teacher-by-uid', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // Try auth_user_id first (works after first login link)
      const { data: byUid } = await supabase
        .from('teachers')
        .select('id, full_name, role')
        .eq('auth_user_id', user!.id)
        .maybeSingle();
      if (byUid) return byUid;
      // Fallback to email (handles first login before useAuth links auth_user_id)
      const { data: byEmail, error } = await supabase
        .from('teachers')
        .select('id, full_name, role')
        .eq('email', user!.email!)
        .maybeSingle();
      if (error) throw error;
      return byEmail;
    },
  });

  const isAdmin = teacher?.role === 'admin';

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold">
            {isAdmin ? 'Global Timetable' : 'My Timetable'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin
              ? 'S6 2025/2026 — weekly schedule by group'
              : teacher
              ? `S6 2025/2026 — ${teacher.full_name}`
              : 'Loading…'}
          </p>
        </div>

        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Calendar className="w-5 h-5 text-primary" />
              {isAdmin ? 'Schedule by Group' : 'Weekly Schedule'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teacherLoading ? (
              <div className="text-center py-10 text-muted-foreground">Loading…</div>
            ) : !teacher ? (
              <div className="text-center py-10 text-muted-foreground">
                Profile not found for this account.
              </div>
            ) : isAdmin ? (
              <AdminView />
            ) : (
              <TeacherView teacherId={teacher.id} />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
