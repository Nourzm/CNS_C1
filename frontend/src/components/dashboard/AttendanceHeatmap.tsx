import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { HeatmapCell } from '@/types/db';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu']; // ENSIA workweek

function cellColor(rate: number | undefined): string {
  if (rate === undefined) return 'bg-muted/30';
  // green scale
  if (rate >= 0.9) return 'bg-emerald-600/80 text-white';
  if (rate >= 0.8) return 'bg-emerald-500/70 text-white';
  if (rate >= 0.7) return 'bg-amber-400/70';
  if (rate >= 0.6) return 'bg-orange-500/70 text-white';
  return 'bg-red-500/80 text-white';
}

export function AttendanceHeatmap({ cells }: { cells: HeatmapCell[] }) {
  const slots = [...new Set(cells.map((c) => c.time_slot))].sort();
  const lookup = new Map<string, HeatmapCell>();
  for (const c of cells) lookup.set(`${c.day_of_week}|${c.time_slot}`, c);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Attendance heatmap (day × time)</CardTitle>
      </CardHeader>
      <CardContent>
        {slots.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center">No sessions</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="p-2 text-left text-muted-foreground font-normal">Time</th>
                  {DAYS.map((d) => <th key={d} className="p-2 text-muted-foreground font-normal">{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {slots.map((slot) => (
                  <tr key={slot}>
                    <td className="p-2 font-mono text-muted-foreground">{slot}</td>
                    {DAYS.map((_, dIdx) => {
                      const c = lookup.get(`${dIdx}|${slot}`);
                      const color = cellColor(c?.attendance_rate);
                      return (
                        <td key={dIdx} className="p-1">
                          <div
                            className={`rounded-md h-10 flex items-center justify-center ${color}`}
                            title={c ? `${(c.attendance_rate * 100).toFixed(0)}% · ${c.session_count} sessions` : 'No sessions'}
                          >
                            {c ? `${Math.round(c.attendance_rate * 100)}%` : ''}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
              <span>Legend:</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-500/80" /> &lt;60%</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500/70" /> 60–70%</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400/70" /> 70–80%</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-500/70" /> 80–90%</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-600/80" /> &ge;90%</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
