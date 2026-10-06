'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import {
  Calendar,
  Layers,
  Filter,
  X,
  Clock,
  Sparkles,
  ShieldAlert,
  AlertTriangle,
  User,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { useData, cleanNumber } from '@/context/DataContext';
import { ProjectTask } from '@/lib/dataset';
import { ChartErrorBoundary } from './ChartErrorBoundary';

/**
 * Robust date parser ensuring 100% genuine JavaScript Date objects in local time.
 * Prevents UTC string rollover and protects against NaN or missing dates.
 */
function toValidDate(val: any, fallbackStr: string): Date {
  if (val instanceof Date && !isNaN(val.getTime())) {
    return new Date(val.getFullYear(), val.getMonth(), val.getDate(), 0, 0, 0);
  }
  const str = String(val || fallbackStr || '').trim();
  // YYYY-MM-DD
  const ymd = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (ymd) {
    const year = parseInt(ymd[1], 10);
    const month = parseInt(ymd[2], 10) - 1;
    const day = parseInt(ymd[3], 10);
    return new Date(year, month, day, 0, 0, 0);
  }
  // MM/DD/YYYY
  const mdy = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (mdy) {
    const year = parseInt(mdy[3], 10);
    const month = parseInt(mdy[1], 10) - 1;
    const day = parseInt(mdy[2], 10);
    return new Date(year, month, day, 0, 0, 0);
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  }
  return new Date(2026, 7, 1, 0, 0, 0);
}

function toValidEndDate(val: any, startDate: Date, fallbackStr: string): Date {
  const parsed = toValidDate(val, fallbackStr);
  // End of day (23:59:59) so the graphical bar covers the entire due date
  const endOfDay = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 23, 59, 59);
  if (endOfDay.getTime() <= startDate.getTime()) {
    // Ensure end date is strictly after start date
    return new Date(startDate.getTime() + 24 * 60 * 60 * 1000 - 1);
  }
  return endOfDay;
}

/**
 * Dynamic bar color assignment matching the dashboard PM legend:
 * - Red: Status === 'Blocked' or Risk_Level === 'Critical'
 * - Green: Status === 'Completed'
 * - Orange: Risk_Level === 'High'
 * - Purple: Status === 'Planned'
 * - Cyan/Blue: Status === 'In Progress' (default)
 */
function getGanttTaskColors(task: ProjectTask) {
  const status = String(task.Status || '').trim().toLowerCase();
  const risk = String(task.Risk_Level || '').trim().toLowerCase();

  // 1. Red: Status === 'Blocked' or Risk_Level === 'Critical'
  if (status.includes('block') || risk.includes('crit')) {
    return {
      backgroundColor: '#EF4444',
      backgroundSelectedColor: '#DC2626',
      progressColor: '#B91C1C',
      progressSelectedColor: '#991B1B',
    };
  }

  // 2. Green: Status === 'Completed'
  if (status.includes('complete') || status.includes('done')) {
    return {
      backgroundColor: '#10B981',
      backgroundSelectedColor: '#059669',
      progressColor: '#047857',
      progressSelectedColor: '#065F46',
    };
  }

  // 3. Orange: Risk_Level === 'High'
  if (risk.includes('high')) {
    return {
      backgroundColor: '#F59E0B',
      backgroundSelectedColor: '#D97706',
      progressColor: '#B45309',
      progressSelectedColor: '#92400E',
    };
  }

  // 4. Purple: Status === 'Planned'
  if (status.includes('plan')) {
    return {
      backgroundColor: '#8B5CF6',
      backgroundSelectedColor: '#7C3AED',
      progressColor: '#6D28D9',
      progressSelectedColor: '#5B21B6',
    };
  }

  // 5. Cyan/Blue: Status === 'In Progress' (default)
  return {
    backgroundColor: '#0284C7',
    backgroundSelectedColor: '#0369A1',
    progressColor: '#075985',
    progressSelectedColor: '#0C4A6E',
  };
}

interface CustomTooltipProps {
  task: Task;
}

const CustomGanttTooltip: React.FC<CustomTooltipProps> = ({ task }) => {
  const meta: ProjectTask | undefined = (task as any)._rawTask;
  if (!meta) return null;

  const startStr = task.start instanceof Date ? task.start.toISOString().split('T')[0] : String(task.start);
  const endStr = task.end instanceof Date ? task.end.toISOString().split('T')[0] : String(task.end);
  const budget = Number(meta.Allocated_Budget_USD || meta.Budget || 0);
  const spend = Number(meta.Actual_Spend_USD || meta.Spent || 0);
  const isOverBudget = spend > budget;
  const isBlocked = String(meta.Status || '').toLowerCase().includes('block');

  return (
    <div
      style={{
        backgroundColor: '#0B132B',
        border: '1px solid rgba(56, 189, 248, 0.4)',
        borderRadius: '8px',
        padding: '12px 16px',
        color: '#F8FAFC',
        fontSize: '11px',
        boxShadow: '0 12px 30px rgba(0, 0, 0, 0.75)',
        minWidth: '260px',
        maxWidth: '340px',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '8px',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span
            style={{
              fontFamily: 'monospace',
              fontWeight: 700,
              fontSize: '0.74rem',
              color: '#38BDF8',
              background: 'rgba(56, 189, 248, 0.12)',
              padding: '2px 6px',
              borderRadius: '4px',
            }}
          >
            {meta.Task_ID}
          </span>
          <span
            style={{
              fontSize: '0.68rem',
              padding: '2px 7px',
              borderRadius: '4px',
              fontWeight: 600,
              backgroundColor: isBlocked ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)',
              color: isBlocked ? '#F87171' : '#34D399',
            }}
          >
            {meta.Status}
          </span>
        </div>
        <div style={{ fontWeight: 600, fontSize: '0.86rem', color: '#FFFFFF', marginTop: '4px' }}>
          {meta.Task_Title}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#818CF8', marginTop: '2px' }}>
          {meta.Project_Name} • {meta.Department}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94A3B8' }}>Timeline:</span>
          <span style={{ color: '#E2E8F0', fontFamily: 'monospace' }}>
            {startStr} → {endStr}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#94A3B8' }}>Progress:</span>
          <strong style={{ color: task.progress >= 100 ? '#10B981' : '#38BDF8' }}>
            {task.progress}%
          </strong>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94A3B8' }}>Assignee:</span>
          <span style={{ color: '#CBD5E1' }}>{meta.Owner || meta.Project_Manager || 'Sarah Connor'}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ color: '#94A3B8' }}>Budget / Spend:</span>
          <span style={{ color: isOverBudget ? '#EF4444' : '#E2E8F0', fontFamily: 'monospace' }}>
            ${spend.toLocaleString()} / ${budget.toLocaleString()}
          </span>
        </div>

        {meta.Blocker_Details && meta.Blocker_Details !== 'None' && (
          <div
            style={{
              marginTop: '6px',
              padding: '6px 8px',
              borderRadius: '4px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#FCA5A5',
              fontSize: '0.7rem',
              lineHeight: 1.35,
            }}
          >
            <strong>Blocker:</strong> {meta.Blocker_Details}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Compact custom TaskList Header (width: 350px)
 * Keeps the table clean so the graphical timeline grid on the right has ample room.
 */
const CustomTaskListHeader: React.FC<{
  headerHeight: number;
  rowWidth: string;
  fontFamily: string;
  fontSize: string;
}> = ({ headerHeight }) => {
  return (
    <div
      style={{
        height: headerHeight,
        display: 'flex',
        alignItems: 'center',
        background: '#0B132B',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        fontWeight: 600,
        fontSize: '0.72rem',
        color: '#94A3B8',
        boxSizing: 'border-box',
        width: '350px',
        minWidth: '350px',
      }}
    >
      <div
        style={{
          width: '180px',
          minWidth: '180px',
          padding: '0 10px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        Task Name
      </div>
      <div
        style={{
          width: '85px',
          minWidth: '85px',
          textAlign: 'center',
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        From
      </div>
      <div
        style={{
          width: '85px',
          minWidth: '85px',
          textAlign: 'center',
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        To
      </div>
    </div>
  );
};

/**
 * Compact custom TaskList Table (width: 350px)
 */
const CustomTaskListTable: React.FC<{
  rowHeight: number;
  rowWidth: string;
  fontFamily: string;
  fontSize: string;
  locale: string;
  tasks: Task[];
  selectedTaskId: string;
  setSelectedTask: (taskId: string) => void;
  onExpanderClick: (task: Task) => void;
}> = ({ rowHeight, tasks, selectedTaskId, setSelectedTask }) => {
  return (
    <div
      style={{
        background: '#0B132B',
        borderRight: '1px solid rgba(255, 255, 255, 0.1)',
        fontSize: '0.72rem',
        boxSizing: 'border-box',
        width: '350px',
        minWidth: '350px',
      }}
    >
      {tasks.map((task) => {
        const isSelected = task.id === selectedTaskId;
        const startStr =
          task.start instanceof Date
            ? `${String(task.start.getMonth() + 1).padStart(2, '0')}/${String(task.start.getDate()).padStart(2, '0')}`
            : '';
        const endStr =
          task.end instanceof Date
            ? `${String(task.end.getMonth() + 1).padStart(2, '0')}/${String(task.end.getDate()).padStart(2, '0')}`
            : '';
        const meta: ProjectTask | undefined = (task as any)._rawTask;

        return (
          <div
            key={task.id}
            onClick={() => setSelectedTask(task.id)}
            style={{
              height: rowHeight,
              display: 'flex',
              alignItems: 'center',
              borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
              background: isSelected ? 'rgba(56, 189, 248, 0.14)' : 'transparent',
              cursor: 'pointer',
              boxSizing: 'border-box',
              color: '#F1F5F9',
              width: '350px',
              minWidth: '350px',
            }}
            title={`${task.name} • ${meta?.Department || ''}`}
          >
            <div
              style={{
                width: '180px',
                minWidth: '180px',
                padding: '0 10px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontWeight: 500,
              }}
            >
              <span style={{ color: '#38BDF8', fontWeight: 600, marginRight: '4px' }}>
                {meta?.Task_ID || task.id}
              </span>
              <span>{meta?.Task_Title || task.name}</span>
            </div>
            <div
              style={{
                width: '85px',
                minWidth: '85px',
                textAlign: 'center',
                color: '#94A3B8',
                fontFamily: 'monospace',
                fontSize: '0.7rem',
                borderLeft: '1px solid rgba(255, 255, 255, 0.04)',
              }}
            >
              {startStr}
            </div>
            <div
              style={{
                width: '85px',
                minWidth: '85px',
                textAlign: 'center',
                color: '#94A3B8',
                fontFamily: 'monospace',
                fontSize: '0.7rem',
                borderLeft: '1px solid rgba(255, 255, 255, 0.04)',
              }}
            >
              {endStr}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const GanttChartVisualization: React.FC = () => {
  const {
    dataset,
    rawDataset,
    filters,
    hasActiveFilters,
    clearAllFilters,
    toggleHighlightId,
    highlightIds,
  } = useData();

  // 4. View Mode Toggles: Day, Week, Month
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.Month);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Dynamic column width zooms the grid in/out smoothly based on ViewMode
  const columnWidth = useMemo(() => {
    switch (viewMode) {
      case ViewMode.Day:
        return 65;
      case ViewMode.Week:
        return 130;
      case ViewMode.Month:
        return 220;
      default:
        return 160;
    }
  }, [viewMode]);

  // Map dataset into gantt-task-react Task structure with verified Date objects and dynamic status colors
  const ganttTasks: Task[] = useMemo(() => {
    if (!dataset || dataset.length === 0) return [];

    return dataset.map((item, index) => {
      // 1. Guaranteed valid Date instances for start and end
      const start = toValidDate(
        item.Start_Date || item.startDateObj || (item as any)['Start Date'],
        '2026-08-01'
      );
      const end = toValidEndDate(
        item.Due_Date || item.dueDateObj || item.End_Date || (item as any)['Due Date'],
        start,
        '2026-08-25'
      );

      // 2. Dynamic Status & Risk Colors applied directly to task.styles
      const colorStyles = getGanttTaskColors(item);
      const isHighlighted = highlightIds.includes(item.Task_ID);
      const progressVal = Math.min(100, Math.max(0, cleanNumber(item.Progress_Percent, 0)));

      return {
        id: item.Task_ID || `T-${index + 1}`,
        name: `${item.Task_ID}: ${item.Task_Title}`,
        start,
        end,
        type: 'task',
        progress: progressVal,
        styles: {
          backgroundColor: isHighlighted ? '#818CF8' : colorStyles.backgroundColor,
          backgroundSelectedColor: isHighlighted ? '#6366F1' : colorStyles.backgroundSelectedColor,
          progressColor: isHighlighted ? '#4F46E5' : colorStyles.progressColor,
          progressSelectedColor: isHighlighted ? '#3730A3' : colorStyles.progressSelectedColor,
        },
        isDisabled: false,
        project: item.Project_Name,
        _rawTask: item,
      } as Task & { _rawTask: ProjectTask };
    });
  }, [dataset, highlightIds]);

  // Calculate synchronized height fitting comfortably within 500px container
  const ganttHeight = useMemo(() => {
    return Math.min(420, Math.max(160, ganttTasks.length * 38));
  }, [ganttTasks.length]);

  if (!isMounted) {
    return (
      <div className="chart-card" style={{ padding: '24px', textAlign: 'center', color: '#94A3B8' }}>
        <Clock size={20} className="pulse-dot" style={{ display: 'inline-block', marginBottom: '8px' }} />
        <div>Initializing Gantt Engine...</div>
      </div>
    );
  }

  return (
    <div className="chart-card gantt-card-wrapper" style={{ marginTop: '16px', marginBottom: '8px' }}>
      {/* Header with Title, Active Filters & View Mode Selector */}
      <div className="chart-card-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={17} color="#38BDF8" />
            <h3 className="chart-title" style={{ fontSize: '0.98rem' }}>
              Interactive Project Gantt Timeline
            </h3>
            <span
              style={{
                fontSize: '0.72rem',
                color: '#38BDF8',
                background: 'rgba(56, 189, 248, 0.12)',
                padding: '2px 8px',
                borderRadius: '12px',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                fontWeight: 600,
              }}
            >
              {dataset.length} {dataset.length === 1 ? 'Task' : 'Tasks'}
              {hasActiveFilters && ` (of ${rawDataset.length})`}
            </span>
          </div>
          <p style={{ fontSize: '0.72rem', color: '#94A3B8', margin: '4px 0 0 0' }}>
            Interactive Gantt schedule. Red bars designate Critical/Blocked paths, Green denotes Completed, Cyan indicates In Progress.
          </p>
        </div>

        {/* View Mode & Filter Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Active Filter Pill */}
          {hasActiveFilters && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                background: 'rgba(99, 102, 241, 0.18)',
                border: '1px solid rgba(99, 102, 241, 0.4)',
                color: '#C7D2FE',
                fontSize: '0.72rem',
                fontWeight: 600,
              }}
            >
              <Filter size={11} color="#A5B4FC" />
              <span>
                Filtered by: {[filters.department, filters.status, filters.project, filters.riskLevel].filter(Boolean).join(' • ')}
              </span>
              <button
                type="button"
                onClick={clearAllFilters}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#CBD5E1',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                }}
                title="Reset active filter"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* 4. View Mode Selector (Day, Week, Month) */}
          <div
            style={{
              display: 'inline-flex',
              background: 'rgba(15, 23, 42, 0.8)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '6px',
              padding: '2px',
            }}
          >
            <button
              id="gantt-view-day"
              type="button"
              className={`view-mode-btn ${viewMode === ViewMode.Day ? 'active' : ''}`}
              onClick={() => setViewMode(ViewMode.Day)}
            >
              Day
            </button>
            <button
              id="gantt-view-week"
              type="button"
              className={`view-mode-btn ${viewMode === ViewMode.Week ? 'active' : ''}`}
              onClick={() => setViewMode(ViewMode.Week)}
            >
              Week
            </button>
            <button
              id="gantt-view-month"
              type="button"
              className={`view-mode-btn ${viewMode === ViewMode.Month ? 'active' : ''}`}
              onClick={() => setViewMode(ViewMode.Month)}
            >
              Month
            </button>
          </div>
        </div>
      </div>

      {/* 3. Gantt Dynamic Status Colors Legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          flexWrap: 'wrap',
          padding: '6px 14px',
          marginBottom: '10px',
          background: 'rgba(15, 23, 42, 0.5)',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
          fontSize: '0.72rem',
        }}
      >
        <span style={{ color: '#94A3B8', fontWeight: 600 }}>Bar Status Legend:</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#EF4444' }} />
          <span style={{ color: '#CBD5E1' }}>Critical / Blocked (Red)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#10B981' }} />
          <span style={{ color: '#CBD5E1' }}>Completed (Green)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#0284C7' }} />
          <span style={{ color: '#CBD5E1' }}>In Progress (Cyan/Blue)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#F59E0B' }} />
          <span style={{ color: '#CBD5E1' }}>High Risk (Orange)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: '#8B5CF6' }} />
          <span style={{ color: '#CBD5E1' }}>Planned (Purple)</span>
        </div>
      </div>

      {/* Gantt Chart Content */}
      <ChartErrorBoundary fallbackTitle="Gantt Timeline Chart Unavailable" onReset={clearAllFilters}>
        {ganttTasks.length === 0 ? (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              background: 'rgba(15, 23, 42, 0.4)',
              borderRadius: '8px',
              border: '1px dashed rgba(255, 255, 255, 0.1)',
            }}
          >
            <AlertTriangle size={24} color="#F59E0B" style={{ margin: '0 auto 8px auto' }} />
            <div style={{ color: '#F1F5F9', fontWeight: 600, fontSize: '0.88rem' }}>
              No tasks match the selected filters. Please adjust your criteria or clear filters.
            </div>
            <p style={{ color: '#94A3B8', fontSize: '0.78rem', margin: '4px 0 12px 0' }}>
              Reset or change your filter selections to display matching project schedules.
            </p>
            <button
              type="button"
              className="btn-icon"
              style={{
                margin: '0 auto',
                background: 'rgba(99, 102, 241, 0.2)',
                borderColor: 'rgba(99, 102, 241, 0.4)',
                color: '#FFFFFF',
              }}
              onClick={clearAllFilters}
            >
              Clear Filters
            </button>
          </div>
        ) : (
          /* 1 & 2. Scrollable container (strict max-h-[500px]) with visual timeline grid taking remaining width on right */
          <div
            className="gantt-scroll-wrapper max-h-[500px] overflow-y-auto overflow-x-auto"
            style={{
              maxHeight: '500px',
              overflowY: 'auto',
              overflowX: 'auto',
              borderRadius: '8px',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              background: '#0B132B',
            }}
          >
            <div style={{ width: '100%', minWidth: '850px' }}>
              <Gantt
                tasks={ganttTasks}
                viewMode={viewMode}
                onClick={(task) => toggleHighlightId(task.id)}
                headerHeight={44}
                columnWidth={columnWidth}
                listCellWidth="116px"
                rowHeight={38}
                ganttHeight={ganttHeight}
                barCornerRadius={4}
                barFill={70}
                barProgressColor="rgba(255, 255, 255, 0.25)"
                barProgressSelectedColor="rgba(255, 255, 255, 0.35)"
                barBackgroundColor="#0284C7"
                barBackgroundSelectedColor="#0369A1"
                todayColor="rgba(56, 189, 248, 0.25)"
                TaskListHeader={CustomTaskListHeader}
                TaskListTable={CustomTaskListTable}
                TooltipContent={({ task }) => <CustomGanttTooltip task={task} />}
              />
            </div>
          </div>
        )}
      </ChartErrorBoundary>
    </div>
  );
};
