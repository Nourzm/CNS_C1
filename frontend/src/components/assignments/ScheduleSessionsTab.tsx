import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Group, Module } from '@/types/db';
import { SearchableSelect } from '@/components/ui/searchable-select';

interface ScheduleSessionsTabProps {
  groups: Group[];
  modules: Module[];
}

const SESSION_TYPES = [
  { id: 'lecture', label: 'Lecture' },
  { id: 'td',      label: 'Tutorial (TD)' },
  { id: 'tp',      label: 'Lab (TP)' },
  { id: 'exam',    label: 'Exam' },
];

const TIME_SLOTS = [
  { id: '08:30', label: '08:30 – 10:00' },
  { id: '10:10', label: '10:10 – 11:40' },
  { id: '11:50', label: '11:50 – 13:20' },
  { id: '13:30', label: '13:30 – 15:00' },
  { id: '15:10', label: '15:10 – 16:40' },
  { id: '16:50', label: '16:50 – 18:20' },
];

export default function ScheduleSessionsTab({ groups = [], modules = [] }: ScheduleSessionsTabProps) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);
  const [selectedGroupId,  setSelectedGroupId]  = useState<string | null>(null);
  const [sessionDate,  setSessionDate]  = useState('');
  const [startTime,    setStartTime]    = useState('08:30');
  const [sessionType,  setSessionType]  = useState('td');
  const [location,     setLocation]     = useState('');
  const [week,         setWeek]         = useState('1');

  // Resolve current teacher (by auth uid)
  const { data: teacher } = useQuery({
    queryKey: ['current-teacher', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('teachers')
        .select('id, full_name, role')
        .eq('auth_user_id', user!.id)
        .maybeSingle();
      return data;
    },
  });

  const isAdmin = teacher?.role === 'admin';

  // For non-admin teachers: derive the groups/modules they actually teach
  // from the sessions table (where teacher_id = teacher.id).
  // This covers both regular timetable slots and any future extra sessions.
  const { data: assignedPairs = [] } = useQuery({
    queryKey: ['teacher-session-pairs', teacher?.id],
    enabled: !!teacher?.id && !isAdmin,
    queryFn: async () => {
      const { data } = await supabase
        .from('sessions')
        .select('group_id, module_id')
        .eq('teacher_id', teacher!.id);
      // deduplicate
      const seen = new Set<string>();
      const unique: { group_id: string; module_id: string }[] = [];
      for (const row of data ?? []) {
        const key = `${row.group_id}|${row.module_id}`;
        if (!seen.has(key)) { seen.add(key); unique.push(row); }
      }
      return unique;
    },
  });

  const assignedGroupIds  = useMemo(() => [...new Set(assignedPairs.map(p => p.group_id))],  [assignedPairs]);
  const assignedModuleIds = useMemo(() => [...new Set(assignedPairs.map(p => p.module_id))], [assignedPairs]);

  const visibleGroups  = isAdmin ? groups  : groups.filter(g => assignedGroupIds.includes(g.id));
  const visibleModules = isAdmin ? modules : modules.filter(m => assignedModuleIds.includes(m.id));

  const selectedDateTime = sessionDate ? new Date(`${sessionDate}T${startTime}:00`) : null;
  const isPast = !!selectedDateTime && selectedDateTime < new Date();

  // Conflict check: does this group already have a session at the chosen date + slot?
  const conflictCheckEnabled = !!selectedGroupId && !!sessionDate && !!startTime;
  const { data: conflict } = useQuery({
    queryKey: ['session-conflict', selectedGroupId, sessionDate, startTime],
    enabled: conflictCheckEnabled,
    queryFn: async () => {
      const { data } = await supabase
        .from('sessions')
        .select(`
          id, session_type,
          modules!sessions_module_id_fkey(module_code),
          teachers!sessions_teacher_id_fkey(full_name)
        `)
        .eq('group_id', selectedGroupId!)
        .eq('session_date', sessionDate)
        .eq('start_time', startTime)
        .maybeSingle();
      return data ?? null;
    },
  });

  const isFormValid = !!selectedModuleId && !!selectedGroupId && !!sessionDate && !!startTime && !isPast && !conflict;

  const createSessionMut = useMutation({
    mutationFn: async () => {
      if (!isFormValid) throw new Error('Please fill in all required fields');
      if (!teacher?.id) throw new Error('Teacher profile not found');

      const weekNum = Math.max(1, Math.min(16, parseInt(week) || 1));

      const { error } = await supabase.from('sessions').insert({
        module_id:    selectedModuleId!,
        group_id:     selectedGroupId!,
        session_date: sessionDate,
        start_time:   startTime,
        session_type: sessionType,
        week:         weekNum,
        teacher_id:   teacher.id,
        location:     location.trim() || null,
      });

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions'] });
      qc.invalidateQueries({ queryKey: ['teacher-schedule', teacher?.id] });
      qc.invalidateQueries({ queryKey: ['admin-group-sessions', selectedGroupId] });
      qc.invalidateQueries({ queryKey: ['today'] });
      toast.success('Session scheduled successfully');
      setSelectedModuleId(null);
      setSelectedGroupId(null);
      setSessionDate('');
      setStartTime('08:30');
      setSessionType('td');
      setLocation('');
      setWeek('1');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to schedule session'),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Schedule a Session</CardTitle>
        <p className="text-sm text-muted-foreground">
          Add an extra, makeup, or extension session. It will appear in your timetable and in the admin view.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Module */}
          <div className="space-y-1">
            <Label>Module *</Label>
            <SearchableSelect
              items={visibleModules}
              value={selectedModuleId || ''}
              onChange={setSelectedModuleId}
              placeholder="Select module…"
              renderLabel={(m) => `${m.module_code} — ${m.module_name || 'Unnamed'}`}
            />
            {!isAdmin && visibleModules.length === 0 && (
              <p className="text-xs text-destructive">No modules found for your account.</p>
            )}
          </div>

          {/* Group */}
          <div className="space-y-1">
            <Label>Group *</Label>
            <SearchableSelect
              items={visibleGroups}
              value={selectedGroupId || ''}
              onChange={setSelectedGroupId}
              placeholder="Select group…"
              renderLabel={(g) => `${g.group_name} (Y${g.year})`}
            />
            {!isAdmin && visibleGroups.length === 0 && (
              <p className="text-xs text-destructive">No groups found for your account.</p>
            )}
          </div>

          {/* Date */}
          <div className="space-y-1">
            <Label>Date *</Label>
            <Input
              type="date"
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
            />
          </div>

          {/* Start time — ENSIA standard slots */}
          <div className="space-y-1">
            <Label>Start Time *</Label>
            <SearchableSelect
              items={TIME_SLOTS}
              value={startTime}
              onChange={setStartTime}
              placeholder="Select slot…"
              renderLabel={(s) => s.label}
            />
          </div>

          {/* Session type */}
          <div className="space-y-1">
            <Label>Session Type</Label>
            <SearchableSelect
              items={SESSION_TYPES}
              value={sessionType}
              onChange={setSessionType}
              placeholder="Select type…"
              renderLabel={(s) => s.label}
            />
          </div>

          {/* Location */}
          <div className="space-y-1">
            <Label>Room / Location</Label>
            <Input
              placeholder="e.g. Amphi 1, Lab 3, Tuto 22"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          {/* Week */}
          <div className="space-y-1">
            <Label>Week (1–16)</Label>
            <Input
              type="number"
              min="1"
              max="16"
              value={week}
              onChange={(e) => setWeek(e.target.value)}
            />
          </div>

          {/* Date/time feedback */}
          {sessionDate && startTime && (
            <div className={`text-xs pt-1 ${isPast ? 'text-destructive' : 'text-muted-foreground'}`}>
              {isPast
                ? '⚠ This date and time is in the past.'
                : `✓ ${selectedDateTime?.toLocaleString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
            </div>
          )}

          {/* Conflict warning */}
          {conflict && (
            <div className="col-span-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <span className="font-semibold">Slot already taken — </span>
                {`This group already has ${(conflict.modules as any)?.module_code ?? 'a session'} (${conflict.session_type}) by ${(conflict.teachers as any)?.full_name ?? 'another teacher'} at this time slot. Please choose a different time.`}
              </div>
            </div>
          )}
        </div>

        <Button
          onClick={() => createSessionMut.mutate()}
          disabled={!isFormValid || createSessionMut.isPending}
          className="w-full"
        >
          {createSessionMut.isPending ? 'Scheduling…' : 'Schedule Session'}
        </Button>
      </CardContent>
    </Card>
  );
}
