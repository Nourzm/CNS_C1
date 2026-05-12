import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/DashboardLayout';
import { CalendarPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ScheduleSessionsTab from '@/components/assignments/ScheduleSessionsTab';

export default function ScheduleSession() {
  const { data: groups = [] } = useQuery({
    queryKey: ['groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('groups')
        .select('id, group_name, year, created_at')
        .order('year')
        .order('group_name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: modules = [] } = useQuery({
    queryKey: ['modules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('modules')
        .select('id, module_code, module_name, lecturer_id, created_at')
        .order('module_code');
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl mx-auto">
        <div className="flex items-center gap-3">
          <CalendarPlus className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Schedule a Session</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Add a makeup, extension, or extra session to your timetable.
            </p>
          </div>
        </div>

        <ScheduleSessionsTab groups={groups} modules={modules} />
      </div>
    </DashboardLayout>
  );
}
