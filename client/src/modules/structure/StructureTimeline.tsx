import { useRef, useEffect, useCallback } from 'react';
import { Timeline } from 'vis-timeline/standalone';
import { DataSet } from 'vis-data';
import 'vis-timeline/styles/vis-timeline-graph2d.css';
import type { StructResult } from './data';
import { toVisData } from './visTransform';
import { EmptyState } from '../../components/EmptyState';

/* ─────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────── */

function ms(dayCount: number): number {
  return dayCount * 24 * 60 * 60 * 1000;
}

/* ─────────────────────────────────────────────
 * StructureTimeline
 * ───────────────────────────────────────────── */

interface StructureTimelineProps {
  result: StructResult;
}

export function StructureTimeline({ result }: StructureTimelineProps) {
  const { roots, hiddenNoDateCount } = result;

  const containerRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<Timeline | null>(null);

  /* ── Инициализация / обновление Timeline ── */

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Очищаем предыдущий экземпляр
    if (timelineRef.current) {
      timelineRef.current.destroy();
      timelineRef.current = null;
    }

    // Если нет корней — не создаём Timeline (покажется EmptyState)
    if (roots.length === 0) return;

    const data = toVisData(result);
    const groupsDataSet = new DataSet(data.groups);
    const itemsDataSet = new DataSet(data.items);

    const options = {
      stack: true,
      orientation: { axis: 'top' },
      zoomable: true,
      moveable: true,
      horizontalScroll: false,
      margin: { item: 4, axis: 8 },
      showCurrentTime: true,
      zoomMin: ms(2),         // не ближе ~2 дней
      zoomMax: ms(366 * 5),   // не дальше ~5 лет
      groupOrder: (a: { id: string }, b: { id: string }) => {
        // Порядок groups тот же, что в toVisData (родитель раньше детей)
        const idxA = data.groups.findIndex((g) => g.id === a.id);
        const idxB = data.groups.findIndex((g) => g.id === b.id);
        return idxA - idxB;
      },
    };

    const timeline = new Timeline(container, itemsDataSet, groupsDataSet, options);
    timelineRef.current = timeline;

    // Начальное окно: диапазон всех range-айтемов
    const rangeItems = data.items.filter((it) => it.type === 'range');
    if (rangeItems.length > 0) {
      let minStart = rangeItems[0].start.getTime();
      let maxEnd = rangeItems[0].end.getTime();
      for (const it of rangeItems) {
        const s = it.start.getTime();
        const e = it.end.getTime();
        if (s < minStart) minStart = s;
        if (e > maxEnd) maxEnd = e;
      }
      const padding = (maxEnd - minStart) * 0.1;
      timeline.setWindow(
        new Date(minStart - padding),
        new Date(maxEnd + padding),
      );
    }

    // Drill-down: клик по группе → фокус на её agg-периоде
    timeline.on('click', (props: { group?: string }) => {
      if (!props.group) return;
      const aggItem = data.items.find(
        (it) => it.id === 'agg:' + props.group,
      );
      if (aggItem) {
        const windowPadding = (aggItem.end.getTime() - aggItem.start.getTime()) * 0.08;
        timeline.setWindow(
          new Date(aggItem.start.getTime() - windowPadding),
          new Date(aggItem.end.getTime() + windowPadding),
        );
      }
    });

    return () => {
      timeline.destroy();
      timelineRef.current = null;
    };
  }, [result, roots.length]);

  /* ── Обработчики тулбара ── */

  const handleMonth = useCallback(() => {
    const t = timelineRef.current;
    if (!t) return;
    const range = t.getWindow();
    const center = (range.start.getTime() + range.end.getTime()) / 2;
    const half = ms(30 * 6); // ~12 месяцев
    t.setWindow(new Date(center - half), new Date(center + half));
  }, []);

  const handleWeek = useCallback(() => {
    const t = timelineRef.current;
    if (!t) return;
    const range = t.getWindow();
    const center = (range.start.getTime() + range.end.getTime()) / 2;
    const half = ms(7 * 4); // ~8 недель
    t.setWindow(new Date(center - half), new Date(center + half));
  }, []);

  const handleDay = useCallback(() => {
    const t = timelineRef.current;
    if (!t) return;
    const range = t.getWindow();
    const center = (range.start.getTime() + range.end.getTime()) / 2;
    const half = ms(6); // ~12 дней
    t.setWindow(new Date(center - half), new Date(center + half));
  }, []);

  const handleFit = useCallback(() => {
    timelineRef.current?.fit();
  }, []);

  /* ── Рендер ── */

  if (roots.length === 0) {
    return <EmptyState message="Нет групп" />;
  }

  return (
    <div className="planner__wrap">
      {/* Тулбар */}
      <div className="planner__toolbar">
        <button className="planner__toolbar-btn" onClick={handleDay}>
          День
        </button>
        <button className="planner__toolbar-btn" onClick={handleWeek}>
          Неделя
        </button>
        <button className="planner__toolbar-btn" onClick={handleMonth}>
          Месяц
        </button>
        <button className="planner__toolbar-btn planner__toolbar-btn--fit" onClick={handleFit}>
          Уместить всё
        </button>
      </div>

      {/* Контейнер vis-timeline */}
      <div className="planner__container" ref={containerRef} />

      {/* Скрытые задачи без дат */}
      {hiddenNoDateCount > 0 && (
        <p className="gantt-view__hidden-info">
          Скрыто задач без дат: {hiddenNoDateCount}
        </p>
      )}
    </div>
  );
}
