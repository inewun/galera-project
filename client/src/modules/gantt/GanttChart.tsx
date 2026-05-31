import { useEffect, useState } from 'react';
import { Gantt, ViewMode } from 'gantt-task-react';
import type { Task as GanttTask } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';

interface GanttChartProps {
  tasks: GanttTask[];
  viewMode: ViewMode;
}

function columnWidthForMode(mode: ViewMode): number {
  switch (mode) {
    case ViewMode.Day:
      return 60;
    case ViewMode.Week:
      return 250;
    case ViewMode.Month:
      return 300;
    default:
      return 250;
  }
}

export function GanttChart({ tasks, viewMode }: GanttChartProps) {
  const [items, setItems] = useState(tasks);
  useEffect(() => setItems(tasks), [tasks]);

  const handleExpander = (t: GanttTask) => {
    setItems((prev) =>
      prev.map((x) =>
        x.id === t.id ? { ...x, hideChildren: !x.hideChildren } : x,
      ),
    );
  };

  const columnWidth = columnWidthForMode(viewMode);

  return (
    <div className="gantt-wrap">
      <Gantt
        tasks={items}
        viewMode={viewMode}
        onDateChange={() => {}}
        onProgressChange={() => {}}
        onExpanderClick={handleExpander}
        barCornerRadius={3}
        barFill={60}
        fontFamily="'Lato', system-ui, -apple-system, sans-serif"
        fontSize="13px"
        rowHeight={40}
        headerHeight={50}
        columnWidth={columnWidth}
        todayColor="rgba(26,103,163,0.10)"
        listCellWidth="220px"
      />
    </div>
  );
}
