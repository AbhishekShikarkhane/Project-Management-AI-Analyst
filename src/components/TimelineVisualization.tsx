'use client';

import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  Calendar,
  Users,
  TrendingUp,
  Clock,
  Layers,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  Clock3,
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import { ProjectTask } from '@/lib/dataset';

// Curated harmonious color palette for stacked project series
const PROJECT_COLORS = [
  '#6366F1', // Indigo
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#3B82F6', // Blue
  '#14B8A6', // Teal
  '#F43F5E', // Rose
  '#F97316', // Orange
];

interface MonthlyProjectDetail {
  projectName: string;
  tasks: ProjectTask[];
  progressSum: number;
  avgProgress: number;
  effortSharePercent: number;
  color: string;
  hasHighlightedTask: boolean;
}

interface MonthlyTimelineDataPoint {
  monthKey: string; // e.g. "2026-08" or "2026-Q3"
  monthLabel: string; // e.g. "August 2026" or "Q3 2026"
  shortLabel: string; // e.g. "Aug '26" or "Q3 '26"
  displayLabel: string; // e.g. "Q3 2026" or "Aug '26"
  timestamp: number;
  teamMembersCount: number;
  teamMembersList: string[];
  totalProgressSum: number;
  projectDetails: Record<string, MonthlyProjectDetail>;
  isCurrentHighlightMonth: boolean;
  [key: string]: any; // dynamic project keys for Recharts Bar stacking
}

export const TimelineVisualization: React.FC = () => {
  const { dataset, highlightIds } = useData();
  const [viewMode, setViewMode] = useState<'stacked100' | 'sum'>('stacked100');
  const [scaleMode, setScaleMode] = useState<'auto' | 'month' | 'quarter'>('auto');
  const [hoveredProject, setHoveredProject] = useState<string | null>(null);

  const isCrossFiltering = highlightIds.length > 0;

  // 1. Process dataset into chronological timeline with responsive Quarter/Month scaling
  const { chartData, allProjects, projectColorMap, timelineSpan } = useMemo(() => {
    if (!dataset || dataset.length === 0) {
      return {
        chartData: [] as MonthlyTimelineDataPoint[],
        allProjects: [] as string[],
        projectColorMap: {} as Record<string, string>,
        timelineSpan: { start: '', end: '', totalMonths: 0, aggregation: 'month', isAutoScaled: false },
      };
    }

    // Collect all distinct projects
    const projectsSet = new Set<string>();
    dataset.forEach((t) => {
      if (t.Project_Name) projectsSet.add(t.Project_Name);
    });
    const allProjectsList = Array.from(projectsSet).sort();

    // Assign consistent colors to projects
    const colorMap: Record<string, string> = {};
    allProjectsList.forEach((p, idx) => {
      colorMap[p] = PROJECT_COLORS[idx % PROJECT_COLORS.length];
    });

    // Calculate total time span across all tasks to decide auto-scaling
    let minTime = Infinity;
    let maxTime = -Infinity;
    dataset.forEach((task) => {
      const start =
        task.startDateObj instanceof Date && !isNaN(task.startDateObj.getTime())
          ? task.startDateObj
          : new Date(task.Start_Date || '2026-08-01');
      const due =
        task.dueDateObj instanceof Date && !isNaN(task.dueDateObj.getTime())
          ? task.dueDateObj
          : new Date(task.Due_Date || '2026-10-15');
      if (start.getTime() < minTime) minTime = start.getTime();
      if (due.getTime() > maxTime) maxTime = due.getTime();
    });

    const totalMonthsSpan =
      minTime < maxTime
        ? Math.max(1, Math.round((maxTime - minTime) / (1000 * 60 * 60 * 24 * 30.4)))
        : 1;

    // Requirement 4: If active dataset spans > 6 months, automatically aggregate by Quarter instead of Month
    const isOver6Months = totalMonthsSpan > 6;
    const effectiveAggregation: 'month' | 'quarter' =
      scaleMode === 'auto' ? (isOver6Months ? 'quarter' : 'month') : scaleMode;

    const buckets = new Map<
      string,
      {
        key: string;
        date: Date;
        label: string;
        shortLabel: string;
        tasks: ProjectTask[];
      }
    >();

    dataset.forEach((task) => {
      const start =
        task.startDateObj instanceof Date && !isNaN(task.startDateObj.getTime())
          ? task.startDateObj
          : new Date(task.Start_Date || '2026-08-01');
      const due =
        task.dueDateObj instanceof Date && !isNaN(task.dueDateObj.getTime())
          ? task.dueDateObj
          : new Date(task.Due_Date || '2026-10-15');

      const minDate = start.getTime() <= due.getTime() ? start : due;
      const maxDate = start.getTime() <= due.getTime() ? due : start;

      if (effectiveAggregation === 'quarter') {
        let cur = new Date(minDate.getFullYear(), Math.floor(minDate.getMonth() / 3) * 3, 1);
        const limit = new Date(maxDate.getFullYear(), Math.floor(maxDate.getMonth() / 3) * 3, 1);
        let step = 0;
        while (cur.getTime() <= limit.getTime() && step < 24) {
          const qNum = Math.floor(cur.getMonth() / 3) + 1;
          const qKey = `${cur.getFullYear()}-Q${qNum}`;
          if (!buckets.has(qKey)) {
            buckets.set(qKey, {
              key: qKey,
              date: new Date(cur),
              label: `Q${qNum} ${cur.getFullYear()}`,
              shortLabel: `Q${qNum} '${String(cur.getFullYear()).slice(2)}`,
              tasks: [],
            });
          }
          buckets.get(qKey)!.tasks.push(task);
          cur.setMonth(cur.getMonth() + 3);
          step++;
        }
      } else {
        let cur = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        const limit = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
        let step = 0;
        while (cur.getTime() <= limit.getTime() && step < 48) {
          const mKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`;
          if (!buckets.has(mKey)) {
            buckets.set(mKey, {
              key: mKey,
              date: new Date(cur),
              label: cur.toLocaleString('en-US', { month: 'long', year: 'numeric' }),
              shortLabel: cur.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
              tasks: [],
            });
          }
          buckets.get(mKey)!.tasks.push(task);
          cur.setMonth(cur.getMonth() + 1);
          step++;
        }
      }
    });

    // Chronologically sort keys
    const sortedKeys = Array.from(buckets.keys()).sort();

    if (sortedKeys.length === 0) {
      return {
        chartData: [],
        allProjects: allProjectsList,
        projectColorMap: colorMap,
        timelineSpan: {
          start: '',
          end: '',
          totalMonths: 0,
          aggregation: effectiveAggregation,
          isAutoScaled: isOver6Months && scaleMode === 'auto',
        },
      };
    }

    const startLabel = buckets.get(sortedKeys[0])?.label || '';
    const endLabel = buckets.get(sortedKeys[sortedKeys.length - 1])?.label || '';

    // Build Recharts data points
    const points: MonthlyTimelineDataPoint[] = sortedKeys.map((key) => {
      const bucket = buckets.get(key)!;
      const d = bucket.date;
      const monthLabel = bucket.label;
      const shortLabel = bucket.shortLabel;
      const displayLabel =
        effectiveAggregation === 'quarter'
          ? bucket.label
          : sortedKeys.length > 5
          ? bucket.shortLabel
          : bucket.label;

      // Calculate distinct team members active in this interval
      const membersSet = new Set<string>();
      bucket.tasks.forEach((t) => {
        if (t.Owner && t.Owner !== 'Unassigned') {
          membersSet.add(t.Owner);
        }
      });
      const teamMembersList = Array.from(membersSet);
      const teamMembersCount = teamMembersList.length;

      // Group tasks by project in this interval
      const projectDetails: Record<string, MonthlyProjectDetail> = {};
      let totalProgressSum = 0;

      bucket.tasks.forEach((t) => {
        const pName = t.Project_Name || 'General';
        if (!projectDetails[pName]) {
          projectDetails[pName] = {
            projectName: pName,
            tasks: [],
            progressSum: 0,
            avgProgress: 0,
            effortSharePercent: 0,
            color: colorMap[pName] || '#6366F1',
            hasHighlightedTask: false,
          };
        }
        projectDetails[pName].tasks.push(t);
        const prog = Number(t.Progress_Percent) || 0;
        projectDetails[pName].progressSum += prog;
        totalProgressSum += prog;

        if (isCrossFiltering && highlightIds.includes(t.Task_ID)) {
          projectDetails[pName].hasHighlightedTask = true;
        }
      });

      // Compute averages and 100% stacked effort shares
      Object.keys(projectDetails).forEach((pName) => {
        const p = projectDetails[pName];
        p.avgProgress = p.tasks.length > 0 ? Math.round(p.progressSum / p.tasks.length) : 0;
        p.effortSharePercent =
          totalProgressSum > 0
            ? Math.round((p.progressSum / totalProgressSum) * 1000) / 10
            : 0;
      });

      // Check if this bucket has any highlighted tasks
      const isCurrentHighlightMonth =
        isCrossFiltering &&
        bucket.tasks.some((t) => highlightIds.includes(t.Task_ID));

      const point: MonthlyTimelineDataPoint = {
        monthKey: key,
        monthLabel,
        shortLabel,
        displayLabel,
        timestamp: d.getTime(),
        teamMembersCount,
        teamMembersList,
        totalProgressSum,
        projectDetails,
        isCurrentHighlightMonth,
      };

      // Populate project values for Recharts Bar stacking
      allProjectsList.forEach((pName) => {
        const detail = projectDetails[pName];
        if (viewMode === 'stacked100') {
          point[pName] = detail ? detail.effortSharePercent : 0;
        } else {
          point[pName] = detail ? detail.progressSum : 0;
        }
      });

      return point;
    });

    return {
      chartData: points,
      allProjects: allProjectsList,
      projectColorMap: colorMap,
      timelineSpan: {
        start: startLabel,
        end: endLabel,
        totalMonths: totalMonthsSpan,
        aggregation: effectiveAggregation,
        isAutoScaled: isOver6Months && scaleMode === 'auto',
      },
    };
  }, [dataset, highlightIds, isCrossFiltering, viewMode, scaleMode]);

  if (chartData.length === 0) {
    return null;
  }

  // Find peak team members and total tasks
  const maxTeamMembers = Math.max(...chartData.map((d) => d.teamMembersCount), 1);

  return (
    <div className="chart-card" style={{ marginBottom: 16 }}>
      {/* Header with Title and Mode Controls */}
      <div className="chart-card-header" style={{ alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={17} color="#818CF8" />
            <h3 className="chart-title">Chronological Timeline & Resource Allocation</h3>
          </div>
          <p
            style={{
              fontSize: '0.73rem',
              color: '#94A3B8',
              margin: '3px 0 0 0',
              lineHeight: 1.4,
            }}
          >
            Chronological monthly timeline of project effort ({timelineSpan.start} —{' '}
            {timelineSpan.end}) stacked with active team size.
          </p>
        </div>

        {/* Scale Mode & View Mode Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Responsive Scaling Badge & Toggle (Quarter vs Month) */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '6px',
              padding: '2px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              type="button"
              onClick={() => setScaleMode('auto')}
              style={{
                background:
                  scaleMode === 'auto'
                    ? 'linear-gradient(135deg, #0284C7 0%, #2563EB 100%)'
                    : 'transparent',
                color: scaleMode === 'auto' ? '#FFFFFF' : '#94A3B8',
                border: 'none',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: scaleMode === 'auto' ? 600 : 400,
                cursor: 'pointer',
              }}
              title="Automatically aggregate by Quarter if data spans >6 months, else by Month"
            >
              Auto ({timelineSpan.aggregation === 'quarter' ? 'Quarter' : 'Month'})
            </button>
            <button
              type="button"
              onClick={() => setScaleMode('month')}
              style={{
                background:
                  scaleMode === 'month'
                    ? 'linear-gradient(135deg, #0284C7 0%, #2563EB 100%)'
                    : 'transparent',
                color: scaleMode === 'month' ? '#FFFFFF' : '#94A3B8',
                border: 'none',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: scaleMode === 'month' ? 600 : 400,
                cursor: 'pointer',
              }}
              title="Aggregate timeline by Month"
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setScaleMode('quarter')}
              style={{
                background:
                  scaleMode === 'quarter'
                    ? 'linear-gradient(135deg, #0284C7 0%, #2563EB 100%)'
                    : 'transparent',
                color: scaleMode === 'quarter' ? '#FFFFFF' : '#94A3B8',
                border: 'none',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '0.7rem',
                fontWeight: scaleMode === 'quarter' ? 600 : 400,
                cursor: 'pointer',
              }}
              title="Aggregate timeline by Quarter (Q1-Q4)"
            >
              Quarter
            </button>
          </div>

          {/* View Mode Toggle: 100% Stacked vs Progress Sum */}
          <div
            style={{
              display: 'inline-flex',
              background: 'rgba(255, 255, 255, 0.05)',
              borderRadius: '6px',
              padding: '2px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <button
              type="button"
              onClick={() => setViewMode('stacked100')}
              style={{
                background:
                  viewMode === 'stacked100'
                    ? 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)'
                    : 'transparent',
                color: viewMode === 'stacked100' ? '#FFFFFF' : '#94A3B8',
                border: 'none',
                padding: '3px 10px',
                borderRadius: '4px',
                fontSize: '0.72rem',
                fontWeight: viewMode === 'stacked100' ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="100% Stacked Column view of relative progress share"
            >
              100% Stacked
            </button>
            <button
              type="button"
              onClick={() => setViewMode('sum')}
              style={{
                background:
                  viewMode === 'sum'
                    ? 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)'
                    : 'transparent',
                color: viewMode === 'sum' ? '#FFFFFF' : '#94A3B8',
                border: 'none',
                padding: '3px 10px',
                borderRadius: '4px',
                fontSize: '0.72rem',
                fontWeight: viewMode === 'sum' ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Absolute sum of % completion stacked"
            >
              Progress Sum
            </button>
          </div>
        </div>
      </div>

      {/* Mini Metas Strip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
          padding: '8px 12px',
          background: 'rgba(15, 23, 42, 0.5)',
          borderRadius: '6px',
          border: '1px solid rgba(255, 255, 255, 0.04)',
          marginBottom: '12px',
          fontSize: '0.72rem',
          color: '#94A3B8',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Clock size={13} color="#38BDF8" />
          <span>
            Span: <strong style={{ color: '#E2E8F0' }}>{timelineSpan.totalMonths} Months</strong>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Users size={13} color="#F59E0B" />
          <span>
            Peak Team Size:{' '}
            <strong style={{ color: '#FCD34D' }}>{maxTeamMembers} Members</strong>
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <Layers size={13} color="#A78BFA" />
          <span>
            Tracked Projects:{' '}
            <strong style={{ color: '#DDD6FE' }}>{allProjects.length}</strong>
          </span>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 2,
              backgroundColor: '#F59E0B',
            }}
          />
          <span style={{ color: '#F59E0B', fontWeight: 500 }}>
            — Line: Active Team Members (Right Axis)
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div style={{ height: 280, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 12, right: 15, left: -8, bottom: 8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255, 255, 255, 0.05)"
              vertical={false}
            />

            {/* X-Axis: Chronological Responsive Scale (Quarter / Month) */}
            <XAxis
              dataKey="displayLabel"
              stroke="#64748B"
              fontSize={10}
              tickLine={false}
              interval={0}
              angle={chartData.length > 5 ? -18 : 0}
              textAnchor={chartData.length > 5 ? 'end' : 'middle'}
              height={chartData.length > 5 ? 38 : 26}
              tick={{ fill: '#94A3B8', fontSize: 10 }}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
            />

            {/* Left Y-Axis: % Completion / Effort */}
            <YAxis
              yAxisId="left"
              stroke="#64748B"
              fontSize={10}
              tickLine={false}
              domain={viewMode === 'stacked100' ? [0, 100] : [0, 'auto']}
              tickFormatter={(v) => `${v}%`}
              axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
              label={{
                value: viewMode === 'stacked100' ? '% Effort Share' : 'Sum of % Completion',
                angle: -90,
                position: 'insideLeft',
                fill: '#94A3B8',
                fontSize: 9,
                offset: 12,
              }}
            />

            {/* Right Y-Axis: Number of Team Members */}
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#F59E0B"
              fontSize={10}
              tickLine={false}
              allowDecimals={false}
              axisLine={{ stroke: 'rgba(245, 158, 11, 0.25)' }}
              label={{
                value: 'Team Members',
                angle: 90,
                position: 'insideRight',
                fill: '#F59E0B',
                fontSize: 9,
                offset: 10,
              }}
            />

            {/* Interactive Custom Tooltip */}
            <Tooltip
              content={
                <CustomTimelineTooltip
                  viewMode={viewMode}
                  highlightIds={highlightIds}
                  isCrossFiltering={isCrossFiltering}
                />
              }
            />

            {/* Stacked Project Columns */}
            {allProjects.map((projectName, idx) => {
              const baseColor = projectColorMap[projectName] || '#6366F1';
              const isHovered = hoveredProject === projectName;
              const hasHover = Boolean(hoveredProject);
              const opacity = hasHover ? (isHovered ? 1 : 0.25) : 0.88;

              return (
                <Bar
                  key={projectName}
                  yAxisId="left"
                  dataKey={projectName}
                  name={projectName}
                  stackId="projectEffort"
                  fill={baseColor}
                  fillOpacity={opacity}
                  radius={idx === allProjects.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                  onMouseEnter={() => setHoveredProject(projectName)}
                  onMouseLeave={() => setHoveredProject(null)}
                />
              );
            })}

            {/* Line Overlay: Team Members count */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="teamMembersCount"
              name="Active Team Members"
              stroke="#F59E0B"
              strokeWidth={2.5}
              dot={{
                fill: '#F59E0B',
                stroke: '#0F172A',
                strokeWidth: 2,
                r: 4,
              }}
              activeDot={{
                r: 6,
                fill: '#FBBF24',
                stroke: '#FFFFFF',
                strokeWidth: 2,
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Interactive Legend with project highlights */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px 14px',
          justifyContent: 'center',
          marginTop: '8px',
          paddingTop: '8px',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        {allProjects.map((p) => {
          const color = projectColorMap[p] || '#6366F1';
          const isSelected = hoveredProject === p;
          return (
            <div
              key={p}
              onClick={() => setHoveredProject(isSelected ? null : p)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer',
                opacity: hoveredProject && !isSelected ? 0.35 : 1,
                transition: 'opacity 0.15s ease',
              }}
              title={`Click to isolate ${p}`}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: '2px',
                  backgroundColor: color,
                  display: 'inline-block',
                }}
              />
              <span
                style={{
                  fontSize: '0.7rem',
                  color: isSelected ? '#FFFFFF' : '#CBD5E1',
                  fontWeight: isSelected ? 600 : 400,
                }}
              >
                {p}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface TooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  viewMode: 'stacked100' | 'sum';
  highlightIds: string[];
  isCrossFiltering: boolean;
}

/**
 * Rich Interactive Custom Tooltip displaying:
 * - Exact dates (Start & Due Date)
 * - Project names with color swatch
 * - Completion percentages (% Complete)
 * - Number of team members & assigned owners
 */
const CustomTimelineTooltip: React.FC<TooltipProps> = ({
  active,
  payload,
  viewMode,
  highlightIds,
  isCrossFiltering,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const dataPoint: MonthlyTimelineDataPoint = payload[0]?.payload;
  if (!dataPoint) return null;

  const {
    monthLabel,
    teamMembersCount,
    teamMembersList,
    totalProgressSum,
    projectDetails,
  } = dataPoint;

  const projectEntries = Object.values(projectDetails || {}).filter(
    (p) => p.tasks && p.tasks.length > 0
  );

  return (
    <div
      style={{
        backgroundColor: '#0B132B',
        border: '1px solid rgba(129, 140, 248, 0.3)',
        borderRadius: '10px',
        padding: '12px 14px',
        color: '#F8FAFC',
        fontSize: '11px',
        maxWidth: '360px',
        boxShadow: '0 12px 28px rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)',
        zIndex: 50,
      }}
    >
      {/* Month Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
          paddingBottom: '8px',
          marginBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Calendar size={14} color="#818CF8" />
          <strong style={{ fontSize: '0.85rem', color: '#FFFFFF' }}>{monthLabel}</strong>
        </div>

        <span
          style={{
            fontSize: '0.68rem',
            padding: '2px 6px',
            borderRadius: '4px',
            backgroundColor: 'rgba(245, 158, 11, 0.16)',
            color: '#FCD34D',
            fontWeight: 500,
          }}
        >
          {teamMembersCount} Team Member{teamMembersCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Team Members List */}
      {teamMembersList.length > 0 && (
        <div
          style={{
            marginBottom: '10px',
            fontSize: '0.69rem',
            color: '#CBD5E1',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '6px',
            lineHeight: 1.3,
          }}
        >
          <Users size={12} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            <strong style={{ color: '#FCD34D' }}>Active Staff: </strong>
            {teamMembersList.join(', ')}
          </span>
        </div>
      )}

      {/* Progress Metric Summary */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '6px 8px',
          backgroundColor: 'rgba(255, 255, 255, 0.04)',
          borderRadius: '6px',
          marginBottom: '10px',
          fontSize: '0.72rem',
        }}
      >
        <span style={{ color: '#94A3B8' }}>
          {viewMode === 'stacked100' ? 'Total Monthly Effort:' : 'Sum of Completion:'}
        </span>
        <strong style={{ color: '#38BDF8' }}>
          {viewMode === 'stacked100' ? '100% Stored' : `${totalProgressSum}%`}
        </strong>
      </div>

      {/* Project Stack Breakdown */}
      <div style={{ maxHeight: '200px', overflowY: 'auto', paddingRight: '2px' }}>
        <div
          style={{
            fontSize: '0.68rem',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            color: '#64748B',
            marginBottom: '6px',
            fontWeight: 600,
          }}
        >
          Project Segments & Tasks
        </div>

        {projectEntries.map((p) => {
          const isHighlighted =
            isCrossFiltering &&
            p.tasks.some((t) => highlightIds.includes(t.Task_ID));

          return (
            <div
              key={p.projectName}
              style={{
                marginBottom: '8px',
                padding: '6px 8px',
                borderRadius: '6px',
                backgroundColor: isHighlighted
                  ? 'rgba(129, 140, 248, 0.15)'
                  : 'rgba(255, 255, 255, 0.02)',
                border: isHighlighted
                  ? '1px solid rgba(129, 140, 248, 0.4)'
                  : '1px solid rgba(255, 255, 255, 0.04)',
              }}
            >
              {/* Project title row */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '4px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: p.color,
                      display: 'inline-block',
                    }}
                  />
                  <strong style={{ color: '#FFFFFF', fontSize: '0.75rem' }}>
                    {p.projectName}
                  </strong>
                </div>

                <span style={{ color: '#38BDF8', fontWeight: 600, fontSize: '0.72rem' }}>
                  {viewMode === 'stacked100'
                    ? `${p.effortSharePercent}% Effort`
                    : `Avg ${p.avgProgress}%`}
                </span>
              </div>

              {/* Task exact dates & completion list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {p.tasks.map((task) => {
                  const isTaskHighlighted = highlightIds.includes(task.Task_ID);
                  const isBlocked = task.Status?.toLowerCase().includes('block');
                  const isCompleted = task.Status?.toLowerCase().includes('complete');

                  return (
                    <div
                      key={task.Task_ID}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '3px 0',
                        fontSize: '0.67rem',
                        color: isTaskHighlighted ? '#FCD34D' : '#94A3B8',
                        borderTop: '1px dashed rgba(255, 255, 255, 0.05)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '190px',
                        }}
                      >
                        {isCompleted ? (
                          <CheckCircle2 size={10} color="#10B981" />
                        ) : isBlocked ? (
                          <AlertCircle size={10} color="#F43F5E" />
                        ) : (
                          <Clock3 size={10} color="#38BDF8" />
                        )}
                        <span style={{ color: '#E2E8F0' }} title={task.Task_Title}>
                          {task.Task_Title}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          flexShrink: 0,
                        }}
                      >
                        {/* Exact Dates */}
                        <span
                          style={{
                            fontSize: '0.64rem',
                            color: '#64748B',
                            fontFamily: 'monospace',
                          }}
                        >
                          {task.Start_Date} → {task.Due_Date}
                        </span>

                        {/* Completion Percentage */}
                        <span
                          style={{
                            padding: '1px 5px',
                            borderRadius: '3px',
                            backgroundColor: isCompleted
                              ? 'rgba(16, 185, 129, 0.15)'
                              : isBlocked
                              ? 'rgba(244, 63, 94, 0.15)'
                              : 'rgba(56, 189, 248, 0.15)',
                            color: isCompleted
                              ? '#34D399'
                              : isBlocked
                              ? '#FB7185'
                              : '#38BDF8',
                            fontWeight: 600,
                          }}
                        >
                          {task.Progress_Percent}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
