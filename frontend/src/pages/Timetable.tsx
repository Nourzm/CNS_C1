import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday'];
// ENSIA standard 1h30 slots (6 per day) — must match start_time values in DB (HH:MM)
// S1: 08:30–10:00  S2: 10:10–11:40  S3: 11:50–13:20
// S4: 13:30–15:00  S5: 15:10–16:40  S6: 16:50–18:20
const TIME_SLOTS = ['08:30', '10:10', '11:50', '13:30', '15:10', '16:50'];

/** Normalise "HH:MM:SS" or "HH:MM" → "HH:MM" for grid lookup */
function normaliseTime(t: string): string {
  return t.substring(0, 5);
}

/** Colour per session type */
const TYPE_STYLE: Record<string, string> = {
  lecture: 'bg-blue-50  text-blue-700  border-blue-200',
  td:      'bg-amber-50 text-amber-700 border-amber-200',
  tp:      'bg-green-50 text-green-700 border-green-200',
  exam:    'bg-red-50   text-red-700   border-red-200',
};

interface SlotCell {
  session_type: string;
  location: string | null;
  module_code: string;
  group_name: string;
}

export default function Timetable() {
  const { user } = useAuth();

  // 1. Resolve the teacher DB record from the logged-in user's email
  const { data: teacher, isPending: teacherLoading } = useQuery({
    queryKey: ['teacher-by-email', user?.email],
    enabled: !!user?.email,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('teachers')
        .select('id, full_name')
        .eq('email', user!.email!)
        .maybeSingle();
      if (error) throw error;
      return data; // null if not found
    },
  });

  // 2. Fetch all sessions belonging to this teacher
  const { data: rawSlots = [], isPending: slotsLoading } = useQuery({
    queryKey: ['teacher-schedule', teacher?.id],
    enabled: !!teacher?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          session_date,
          start_time,
          session_type,
          location,
          modules!sessions_module_id_fkey(module_code),
          groups!sessions_group_id_fkey(group_name)
        `)
        .eq('teacher_id', teacher!.id)
        .order('session_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // 3. Build grid[day][timeSlot]
  const grid = useMemo(() => {
    const result: Record<string, Record<string, SlotCell>> = {};
    DAYS.forEach(d => (result[d] = {}));
    for (const row of rawSlots) {
      const dayIndex = new Date(row.session_date).getDay();
      if (dayIndex >= 0 && dayIndex <= 4) {
        const dayName = DAYS[dayIndex];
        const slotKey = normaliseTime(row.start_time);
        if (!result[dayName][slotKey]) {
          result[dayName][slotKey] = {
            session_type: row.session_type,
            location: row.location ?? null,
            module_code: (row.modules as any)?.module_code ?? '—',
            group_name: (row.groups as any)?.group_name ?? '—',
          };
        }
      }
    }
    return result;
  }, [rawSlots]);

  const isLoading = teacherLoading || slotsLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold">My Timetable</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {teacher
              ? `S6 2025/2026 — ${teacher.full_name}`
              : 'Weekly schedule — loading…'}
          </p>
        </div>

        <Card className="border-t-4 border-t-primary shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Calendar className="w-5 h-5 text-primary" />
              Weekly Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-10 text-muted-foreground">Loading schedule…</div>
            ) : !teacher ? (
              <div className="text-center py-10 text-muted-foreground">
                Teacher profile not found for this account.
              </div>
            ) : rawSlots.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                No sessions assigned to you this semester.
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden border border-border shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-muted/50 border-b border-border">
                        <th className="p-3 text-left font-medium text-muted-foreground w-28 border-r border-border">
                          Day
                        </th>
                        {TIME_SLOTS.map(time => (
                          <th
                            key={time}
                            className="p-3 text-center font-medium text-muted-foreground border-r border-border last:border-0 min-w-[140px]"
                          >
                            {time}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {DAYS.map(day => (
                        <tr
                          key={day}
                          className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors"
                        >
                          <td className="p-3 font-semibold bg-muted/10 border-r border-border">
                            {day}
                          </td>
                          {TIME_SLOTS.map(time => {
                            const cell = grid[day]?.[time];
                            return (
                              <td
                                key={time}
                                className="p-2 border-r border-border last:border-0 h-24 align-top relative"
                              >
                                {cell ? (
                                  <div className="absolute inset-1 rounded-md bg-primary/10 border border-primary/20 p-2 flex flex-col justify-between shadow-sm hover:shadow-md hover:bg-primary/15 transition-all">
                                    {/* Top: module code + group */}
                                    <div>
                                      <div
                                        className="font-bold text-primary text-sm truncate leading-tight"
                                        title={cell.module_code}
                                      >
                                        {cell.module_code}
                                      </div>
                                      <div className="font-semibold text-foreground text-xs mt-0.5">
                                        {cell.group_name}
                                      </div>
                                    </div>
                                    {/* Bottom: session type badge + room */}
                                    <div className="flex justify-between items-end gap-1 mt-1">
                                      <Badge
                                        variant="outline"
                                        className={`text-[10px] uppercase px-1.5 py-0 border font-medium ${
                                          TYPE_STYLE[cell.session_type] ?? 'bg-muted'
                                        }`}
                                      >
                                        {cell.session_type}
                                      </Badge>
                                      {cell.location && (
                                        <span
                                          className="text-[10px] text-muted-foreground truncate max-w-[60px] text-right"
                                          title={cell.location}
                                        >
                                          {cell.location}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground/30">
                                    —
                                  </div>
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
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
