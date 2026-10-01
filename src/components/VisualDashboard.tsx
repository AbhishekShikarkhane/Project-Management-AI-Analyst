'use client';

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from 'recharts';
import {
  BarChart3,
  PieChart as PieIcon,
  Filter,
  X,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Layers,
  Sparkles,
  ExternalLink,
  UploadCloud,
  FileSpreadsheet,
  Wallet,
  Users,
  Calendar,
  ShieldAlert,
  User,
} from 'lucide-react';
import { useData, formatCompactCurrency } from '@/context/DataContext';
import { TimelineVisualization } from './TimelineVisualization';

export const getStatusColor = (status: string): string => {
  const s = (status || '').toLowerCase();
  // Red for At Risk / Blocked / Delayed / Critical (Prompt requirement: "Red for At Risk")
  if (s.includes('risk') || s.includes('block') || s.includes('delay') || s.includes('critical')) {
    return '#EF4444';
  }
  // Blue for Completed / Done (Prompt requirement: "Blue for Completed")
  if (s.includes('complete') || s.includes('done')) {
    return '#3B82F6';
  }
  // Emerald for In Progress / On Track
  if (s.includes('progress') || s.includes('track') || s.includes('active')) {
    return '#10B981';
  }
  // Amber for In Review / Pending / QA
  if (s.includes('review') || s.includes('pending') || s.includes('qa')) {
    return '#F59E0B';
  }
  // Violet for Planned / Not Started
  if (s.includes('plan')) {
    return '#8B5CF6';
  }
  return '#06B6D4';
};

export const getPriorityClass = (priority?: string): string => {
  const p = (priority || '').toLowerCase();
  if (p.includes('crit')) return 'priority-critical';
  if (p.includes('high')) return 'priority-high';
  if (p.includes('med')) return 'priority-medium';
  return 'priority-low';
};

export const getRiskClass = (risk?: string): string => {
  const r = (risk || '').toLowerCase();
  if (r.includes('crit')) return 'risk-critical';
  if (r.includes('high')) return 'risk-high';
  if (r.includes('med')) return 'risk-medium';
  return 'risk-low';
};

export const getStatusClass = (status?: string): string => {
  const s = (status || '').toLowerCase();
  if (s.includes('complete') || s.includes('done')) return 'status-completed';
  if (s.includes('block')) return 'status-blocked';
  if (s.includes('review') || s.includes('pending') || s.includes('qa')) return 'status-review';
  if (s.includes('plan')) return 'status-planned';
  return 'status-in-progress';
};

interface StatusTooltipProps {
  active?: boolean;
  payload?: any[];
}

const FinancialStatusTooltip: React.FC<StatusTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  if (!data) return null;
  const statusColor = data.color || getStatusColor(data.status);

  return (
    <div
      style={{
        backgroundColor: '#0B132B',
        border: `1px solid ${statusColor}88`,
        borderRadius: '8px',
        padding: '10px 14px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.6)',
        color: '#F8FAFC',
        fontSize: '11px',
        minWidth: '210px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '6px',
          marginBottom: '6px',
        }}
      >
        <span
          style={{
            width: 9,
            height: 9,
            borderRadius: '50%',
            backgroundColor: statusColor,
            display: 'inline-block',
          }}
        />
        <strong style={{ fontSize: '0.84rem', color: '#FFFFFF' }}>{data.status}</strong>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ color: '#94A3B8' }}>Sum of Spent (USD):</span>
          <strong style={{ color: '#F8FAFC', fontFamily: 'monospace' }}>
            ${Number(data.spend).toLocaleString()}
          </strong>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ color: '#94A3B8' }}>Percentage of Total:</span>
          <strong style={{ color: '#38BDF8' }}>{data.percentage}%</strong>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ color: '#94A3B8' }}>Allocated Budget:</span>
          <span style={{ color: '#CBD5E1' }}>${Number(data.budget || 0).toLocaleString()}</span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ color: '#94A3B8' }}>Associated Tasks:</span>
          <span style={{ color: '#CBD5E1' }}>{data.count} tasks</span>
        </div>
      </div>
    </div>
  );
};

const InitiativeYAxisTick: React.FC<any> = ({ x, y, payload }) => {
  const text = payload?.value || '';
  const [dept, proj] = text.includes(' • ') ? text.split(' • ') : ['', text];
  const shortProj = proj && proj.length > 20 ? proj.slice(0, 20) + '…' : proj || text;
  const shortDept = dept && dept.length > 22 ? dept.slice(0, 22) + '…' : dept;

  return (
    <g transform={`translate(${x},${y})`}>
      <title>{text}</title>
      <text
        x={-10}
        y={-3}
        textAnchor="end"
        fill="#F1F5F9"
        fontSize={10.5}
        fontWeight={600}
      >
        {shortProj}
      </text>
      {dept && (
        <text
          x={-10}
          y={9}
          textAnchor="end"
          fill="#94A3B8"
          fontSize={8.5}
        >
          {shortDept}
        </text>
      )}
    </g>
  );
};

interface BurnRateTooltipProps {
  active?: boolean;
  payload?: any[];
}

const BudgetBurnRateTooltip: React.FC<BurnRateTooltipProps> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0]?.payload;
  if (!data) return null;

  const burnRate =
    data.burnRate ??
    (data.budget > 0 ? (data.spend / data.budget) * 100 : 0);
  const isOverBudget = data.spend > data.budget;
  const variance = data.budget - data.spend;

  return (
    <div
      style={{
        backgroundColor: '#0B132B',
        border: `1px solid ${isOverBudget ? '#EF4444' : '#38BDF8'}88`,
        borderRadius: '8px',
        padding: '10px 14px',
        boxShadow: '0 10px 25px rgba(0, 0, 0, 0.6)',
        color: '#F8FAFC',
        fontSize: '11px',
        minWidth: '220px',
      }}
    >
      <div
        style={{
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          paddingBottom: '6px',
          marginBottom: '6px',
        }}
      >
        <strong style={{ fontSize: '0.85rem', color: '#FFFFFF', display: 'block' }}>
          {data.project}
        </strong>
        <span style={{ fontSize: '0.7rem', color: '#818CF8' }}>
          Department: {data.department}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ color: '#94A3B8' }}>Sum of Budget:</span>
          <strong style={{ color: '#F8FAFC', fontFamily: 'monospace' }}>
            ${Number(data.budget).toLocaleString()}
          </strong>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ color: '#94A3B8' }}>Sum of Spent:</span>
          <strong style={{ color: '#38BDF8', fontFamily: 'monospace' }}>
            ${Number(data.spend).toLocaleString()}
          </strong>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            alignItems: 'center',
          }}
        >
          <span style={{ color: '#94A3B8' }}>Budget Burn Rate:</span>
          <span
            style={{
              padding: '1px 6px',
              borderRadius: '4px',
              fontSize: '0.72rem',
              fontWeight: 700,
              backgroundColor: isOverBudget
                ? 'rgba(239, 68, 68, 0.18)'
                : burnRate >= 85
                ? 'rgba(245, 158, 11, 0.18)'
                : 'rgba(16, 185, 129, 0.18)',
              color: isOverBudget ? '#EF4444' : burnRate >= 85 ? '#F59E0B' : '#10B981',
            }}
          >
            {Number(burnRate).toFixed(1)}% {isOverBudget ? '(Over Budget)' : ''}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ color: '#94A3B8' }}>Variance:</span>
          <span
            style={{
              color: variance >= 0 ? '#10B981' : '#EF4444',
              fontFamily: 'monospace',
              fontWeight: 600,
            }}
          >
            {variance >= 0
              ? `+$${variance.toLocaleString()} remaining`
              : `-$${Math.abs(variance).toLocaleString()} overrun`}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <span style={{ color: '#94A3B8' }}>Tasks:</span>
          <span style={{ color: '#CBD5E1' }}>{data.taskCount || 1} tasks</span>
        </div>
      </div>
    </div>
  );
};

const DEPT_COLORS = ['#6366F1', '#06B6D4', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6'];

interface VisualDashboardProps {
  onOpenUpload?: () => void;
}

export const VisualDashboard: React.FC<VisualDashboardProps> = ({ onOpenUpload }) => {
  const {
    dataset,
    summary,
    highlightIds,
    clearHighlights,
    toggleHighlightId,
    fileName,
    resetToDefault,
    generateLiveData,
    isGenerating,
  } = useData();

  const isCrossFiltering = highlightIds.length > 0;

  // Find highlighted tasks objects
  const highlightedTasks = useMemo(() => {
    if (!isCrossFiltering) return [];
    return dataset.filter((t) => highlightIds.includes(t.Task_ID));
  }, [dataset, highlightIds, isCrossFiltering]);

  // Financial status chart data (Spent mapped to slice sizes)
  const statusData = useMemo(() => {
    return summary.statusCounts.map((item) => {
      const isHighlighted =
        isCrossFiltering &&
        dataset.some(
          (t) =>
            highlightIds.includes(t.Task_ID) &&
            t.Status?.toLowerCase() === item.status?.toLowerCase()
        );
      return {
        ...item,
        color: getStatusColor(item.status),
        isHighlighted,
        opacity: !isCrossFiltering ? 1 : isHighlighted ? 1 : 0.25,
      };
    });
  }, [summary.statusCounts, highlightIds, isCrossFiltering, dataset]);

  // Initiative budget utilization data (grouped by Department & Project Name)
  const projectBudgetData = useMemo(() => {
    return summary.projectBudgets.map((item) => {
      const isHighlighted =
        isCrossFiltering &&
        dataset.some(
          (t) =>
            highlightIds.includes(t.Task_ID) &&
            t.Project_Name?.toLowerCase() === item.project.toLowerCase() &&
            t.Department?.toLowerCase() === item.department.toLowerCase()
        );

      const spendPortion = Math.min(item.spend, item.budget);
      const remaining = Math.max(0, item.budget - item.spend);
      const overSpend = Math.max(0, item.spend - item.budget);

      return {
        ...item,
        spendPortion,
        remaining,
        overSpend,
        isHighlighted,
        opacity: !isCrossFiltering ? 1 : isHighlighted ? 1 : 0.25,
      };
    });
  }, [summary.projectBudgets, highlightIds, isCrossFiltering, dataset]);

  // Department distribution data
  const deptData = useMemo(() => {
    return summary.departmentDistribution.map((item, idx) => {
      const isHighlighted =
        isCrossFiltering &&
        dataset.some(
          (t) =>
            highlightIds.includes(t.Task_ID) &&
            t.Department?.toLowerCase() === item.name?.toLowerCase()
        );
      return {
        ...item,
        color: DEPT_COLORS[idx % DEPT_COLORS.length],
        isHighlighted,
        opacity: !isCrossFiltering ? 1 : isHighlighted ? 1 : 0.25,
      };
    });
  }, [summary.departmentDistribution, highlightIds, isCrossFiltering, dataset]);

  // Placeholder when no dataset is present
  if (dataset.length === 0) {
    return (
      <div className="visual-dashboard-container">
        <div className="empty-dataset-card">
          <div className="empty-icon-wrap">
            <UploadCloud size={32} color="#818CF8" />
          </div>
          <h3>Please Upload a Dataset</h3>
          <p>
            No active project dataset is currently loaded in memory. Upload a CSV or JSON file
            to populate the real-time status charts, budgets, and departmental metrics.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn-primary"
              style={{ width: 'auto', padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              onClick={onOpenUpload}
            >
              <UploadCloud size={16} />
              <span>Upload CSV / JSON</span>
            </button>
            <button
              type="button"
              className="btn-icon"
              style={{
                padding: '10px 18px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.16) 0%, rgba(6, 182, 212, 0.16) 100%)',
                borderColor: 'rgba(16, 185, 129, 0.45)',
                color: '#A7F3D0',
              }}
              disabled={isGenerating}
              onClick={generateLiveData}
              title="Generate 30 realistic AI project tasks"
            >
              <Sparkles size={15} color="#34D399" />
              <span>{isGenerating ? 'Generating...' : 'Generate Live Data (30 Tasks)'}</span>
            </button>
            <button
              type="button"
              className="btn-icon"
              style={{ padding: '10px 18px' }}
              onClick={resetToDefault}
              title="Load the default local Project Management file"
            >
              <FileSpreadsheet size={15} color="#38BDF8" />
              <span>Load Default File</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="visual-dashboard-container">
      {/* Top Cross-Filtering Active Banner */}
      {isCrossFiltering && (
        <div className="filter-active-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} color="#818CF8" />
            <span>
              <strong>{highlightIds.length}</strong> task
              {highlightIds.length > 1 ? 's' : ''} highlighted by Analyst:{' '}
              <span className="highlight-tag-list">
                {highlightIds.slice(0, 4).join(', ')}
                {highlightIds.length > 4 && ` +${highlightIds.length - 4} more`}
              </span>
            </span>
          </div>

          <button
            type="button"
            className="btn-clear-filter"
            onClick={clearHighlights}
            title="Reset highlight cross-filtering"
          >
            <X size={13} />
            <span>Clear Highlight</span>
          </button>
        </div>
      )}

      {/* Quick KPI Stat Strip */}
      <div className="visual-kpi-row">
        {/* KPI 1: Total Allocated Budget (Prominent Financial Context) */}
        <div
          className={`visual-kpi-card ${isCrossFiltering ? 'dimmed' : ''}`}
          title={`Total Allocated Budget: $${(summary.totalBudget || 0).toLocaleString()}`}
        >
          <div className="kpi-icon-wrap" style={{ color: '#818CF8' }}>
            <Wallet size={14} />
          </div>
          <div>
            <div className="kpi-small-label">Total Allocated Budget</div>
            <div className="kpi-small-val" style={{ color: '#818CF8' }}>
              {formatCompactCurrency(summary.totalBudget)}
            </div>
          </div>
        </div>

        {/* KPI 2: Budget Spent (Positioned directly next to Total Allocated Budget) */}
        <div
          className={`visual-kpi-card ${isCrossFiltering ? 'dimmed' : ''}`}
          title={`Budget Spent: $${(summary.totalSpend || 0).toLocaleString()}`}
        >
          <div className="kpi-icon-wrap" style={{ color: '#FBBF24' }}>
            <DollarSign size={14} />
          </div>
          <div>
            <div className="kpi-small-label">Budget Spent</div>
            <div className="kpi-small-val" style={{ color: '#FBBF24' }}>
              {formatCompactCurrency(summary.totalSpend)}
            </div>
          </div>
        </div>

        {/* KPI 3: Total Tasks */}
        <div className={`visual-kpi-card ${isCrossFiltering ? 'dimmed' : ''}`}>
          <div className="kpi-icon-wrap" style={{ color: '#38BDF8' }}>
            <Layers size={14} />
          </div>
          <div>
            <div className="kpi-small-label">Tasks</div>
            <div className="kpi-small-val">{dataset.length}</div>
          </div>
        </div>

        {/* KPI 4: Avg Progress */}
        <div className={`visual-kpi-card ${isCrossFiltering ? 'dimmed' : ''}`}>
          <div className="kpi-icon-wrap" style={{ color: '#10B981' }}>
            <TrendingUp size={14} />
          </div>
          <div>
            <div className="kpi-small-label">Avg Progress</div>
            <div className="kpi-small-val">{summary.avgProgress}%</div>
          </div>
        </div>

        {/* KPI 5: Blocked */}
        <div
          className={`visual-kpi-card ${
            isCrossFiltering &&
            highlightedTasks.some((t) => t.Status?.toLowerCase().includes('block'))
              ? 'glow-accent'
              : isCrossFiltering
              ? 'dimmed'
              : ''
          }`}
        >
          <div className="kpi-icon-wrap" style={{ color: '#FB7185' }}>
            <AlertTriangle size={14} />
          </div>
          <div>
            <div className="kpi-small-label">Blocked</div>
            <div className="kpi-small-val" style={{ color: '#FB7185' }}>
              {summary.blockedCount}
            </div>
          </div>
        </div>
      </div>

      {/* Chronological Stacked Column Timeline Visualization */}
      <TimelineVisualization />

      {/* Chart 1: Financial Spend by Task Status (Donut Chart) */}
      <div className="chart-card">
        <div className="chart-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieIcon size={16} color="#38BDF8" />
            <h3 className="chart-title">Financial Spend by Task Status</h3>
          </div>
          {isCrossFiltering && (
            <span className="crossfilter-indicator">Cross-Filtering Active</span>
          )}
        </div>

        <div style={{ position: 'relative', height: 210, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                dataKey="spend"
                nameKey="status"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={80}
                paddingAngle={3}
              >
                {statusData.map((entry, index) => (
                  <Cell
                    key={`status-donut-${index}`}
                    fill={entry.color}
                    fillOpacity={entry.opacity}
                    stroke={entry.isHighlighted ? '#FFFFFF' : 'rgba(15, 23, 42, 0.8)'}
                    strokeWidth={entry.isHighlighted ? 2.5 : 1.5}
                  />
                ))}
              </Pie>
              <Tooltip content={<FinancialStatusTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Donut Center Label */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none',
            }}
          >
            <div
              style={{
                fontSize: '0.64rem',
                color: '#94A3B8',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Total Spend
            </div>
            <div style={{ fontSize: '0.86rem', fontWeight: 700, color: '#FFFFFF' }}>
              ${((summary.totalSpend || 0) / 1000).toFixed(0)}k
            </div>
          </div>
        </div>

        {/* Status Legend & Financial Breakdown */}
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
          {statusData.map((entry) => (
            <div
              key={entry.status}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.71rem',
                opacity: entry.opacity,
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '2px',
                  backgroundColor: entry.color,
                  display: 'inline-block',
                }}
              />
              <span style={{ color: '#CBD5E1', fontWeight: 500 }}>{entry.status}:</span>
              <strong style={{ color: '#FFFFFF' }}>
                ${Number(entry.spend).toLocaleString()}
              </strong>
              <span style={{ color: '#64748B', fontSize: '0.67rem' }}>
                ({entry.percentage}%)
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chart 2: Project Initiative Budget Utilization (Horizontal Stacked Bar Chart) */}
      <div className="chart-card">
        <div className="chart-card-header" style={{ alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DollarSign size={16} color="#34D399" />
              <h3 className="chart-title">Budget Utilization by Initiative</h3>
            </div>
            <p
              style={{
                fontSize: '0.7rem',
                color: '#94A3B8',
                margin: '3px 0 0 0',
                lineHeight: 1.4,
              }}
            >
              Horizontal progress bars by Department & Project. Dark Blue fills up the gray budget allocation.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.69rem',
                color: '#94A3B8',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  backgroundColor: '#2563EB',
                  display: 'inline-block',
                }}
              />
              <span>Spent</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.69rem',
                color: '#94A3B8',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  display: 'inline-block',
                }}
              />
              <span>Remaining Budget</span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.69rem',
                color: '#EF4444',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  backgroundColor: '#EF4444',
                  display: 'inline-block',
                }}
              />
              <span>Over Budget</span>
            </div>
          </div>
        </div>

        <div
          style={{
            height: Math.max(260, projectBudgetData.length * 44),
            width: '100%',
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={projectBudgetData}
              margin={{ top: 8, right: 25, left: 18, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255, 255, 255, 0.05)"
                horizontal={false}
              />
              <XAxis
                type="number"
                stroke="#64748B"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
              />
              <YAxis
                type="category"
                dataKey="displayName"
                stroke="#94A3B8"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.1)' }}
                width={155}
                interval={0}
                tick={<InitiativeYAxisTick />}
              />
              <Tooltip content={<BudgetBurnRateTooltip />} />

              {/* Progress bar visual: Spent portion (Dark Blue) filling up Remaining Budget (Light Gray) */}
              <Bar
                dataKey="spendPortion"
                name="Sum of Spent"
                stackId="budgetProgress"
                fill="#2563EB"
                radius={[0, 0, 0, 0]}
              >
                {projectBudgetData.map((entry, idx) => (
                  <Cell
                    key={`sp-${idx}`}
                    fill={entry.burnRate > 100 ? '#1D4ED8' : '#2563EB'}
                    fillOpacity={entry.opacity}
                    stroke={entry.isHighlighted ? '#FFFFFF' : 'transparent'}
                    strokeWidth={entry.isHighlighted ? 2 : 0}
                  />
                ))}
              </Bar>

              <Bar
                dataKey="remaining"
                name="Remaining Budget"
                stackId="budgetProgress"
                fill="rgba(255, 255, 255, 0.14)"
                radius={[0, 3, 3, 0]}
              >
                {projectBudgetData.map((entry, idx) => (
                  <Cell
                    key={`rem-${idx}`}
                    fill="rgba(255, 255, 255, 0.14)"
                    fillOpacity={entry.opacity}
                  />
                ))}
              </Bar>

              {/* Over Budget extension in red if initiative spend > budget */}
              <Bar
                dataKey="overSpend"
                name="Over Budget Deficit"
                stackId="budgetProgress"
                fill="#EF4444"
                radius={[0, 3, 3, 0]}
              >
                {projectBudgetData.map((entry, idx) => (
                  <Cell
                    key={`over-${idx}`}
                    fill="#EF4444"
                    fillOpacity={entry.opacity}
                    stroke={entry.isHighlighted ? '#FFFFFF' : 'transparent'}
                    strokeWidth={entry.isHighlighted ? 2 : 0}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Chart 3: Department Breakdown (Pie Chart) */}
      <div className="chart-card">
        <div className="chart-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieIcon size={16} color="#06B6D4" />
            <h3 className="chart-title">Tasks by Department</h3>
          </div>
        </div>

        <div style={{ height: 180, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={deptData}
                dataKey="count"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={65}
                innerRadius={35}
                paddingAngle={3}
              >
                {deptData.map((entry, index) => (
                  <Cell
                    key={`dept-${index}`}
                    fill={entry.color}
                    fillOpacity={entry.opacity}
                    stroke={entry.isHighlighted ? '#FFFFFF' : 'transparent'}
                    strokeWidth={entry.isHighlighted ? 2 : 0}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: 'rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: '#F8FAFC',
                }}
              />
              <Legend
                formatter={(value) => (
                  <span style={{ color: '#CBD5E1', fontSize: '11px' }}>{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Main Granular Data Table Component with Horizontal Scrolling */}
      <div className="chart-card" style={{ marginBottom: 0 }}>
        <div className="chart-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={15} color="#A5B4FC" />
            <h3 className="chart-title">
              {isCrossFiltering ? 'Filtered Project Tasks' : 'Main Project Tasks & Metrics'}
            </h3>
            <span
              style={{
                fontSize: '0.72rem',
                color: '#38BDF8',
                background: 'rgba(56, 189, 248, 0.1)',
                padding: '2px 8px',
                borderRadius: '12px',
                border: '1px solid rgba(56, 189, 248, 0.25)',
              }}
            >
              {isCrossFiltering ? `${highlightedTasks.length} Highlighted` : `${dataset.length} Tasks`}
            </span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#64748B' }}>
            ↔ Scroll horizontally • Click row to toggle highlight
          </span>
        </div>

        <div className="table-scroll-container" style={{ maxHeight: '400px' }}>
          <table className="dashboard-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Project Manager</th>
                <th>Department</th>
                <th>Status</th>
                <th>Progress</th>
                <th>Start Date</th>
                <th>End Date</th>
                <th>Priority</th>
                <th>Risk Level</th>
                <th>Team Members</th>
                <th>Budget / Spend</th>
              </tr>
            </thead>
            <tbody>
              {(isCrossFiltering ? highlightedTasks : dataset).map((task) => {
                const isSelected = highlightIds.includes(task.Task_ID);
                const manager = task.Project_Manager || task.Owner || 'Unassigned';
                const startDateStr =
                  task.Start_Date ||
                  (task.startDateObj ? task.startDateObj.toISOString().split('T')[0] : '—');
                const endDateStr =
                  task.End_Date ||
                  task.Due_Date ||
                  (task.endDateObj ? task.endDateObj.toISOString().split('T')[0] : '—');
                const teamCount =
                  task.Number_of_Team_Members ?? task.Team_Members_Count ?? 1;
                const budgetVal = Number(task.Allocated_Budget_USD || task.Budget || 0);
                const spendVal = Number(task.Actual_Spend_USD || task.Spent || 0);

                return (
                  <tr
                    key={task.Task_ID}
                    className={`clickable-row ${isSelected ? 'selected-row' : ''}`}
                    onClick={() => toggleHighlightId(task.Task_ID)}
                    title="Click row to toggle AI cross-filtering & chart highlight"
                  >
                    {/* Task */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="task-id-badge">{task.Task_ID}</span>
                        <div>
                          <div style={{ fontWeight: 600, color: '#F1F5F9', fontSize: '0.82rem' }}>
                            {task.Task_Title}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#64748B' }}>
                            {task.Project_Name}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Project Manager */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={13} color="#94A3B8" />
                        <span style={{ fontWeight: 500, color: '#E2E8F0' }}>{manager}</span>
                      </div>
                    </td>

                    {/* Department */}
                    <td>
                      <span style={{ color: '#94A3B8', fontSize: '0.78rem' }}>
                        {task.Department}
                      </span>
                    </td>

                    {/* Status */}
                    <td>
                      <span className={`status-pill ${getStatusClass(task.Status)}`}>
                        {task.Status}
                      </span>
                    </td>

                    {/* Progress */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '95px' }}>
                        <div
                          style={{
                            flex: 1,
                            height: 6,
                            background: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: 3,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.min(100, Math.max(0, task.Progress_Percent || 0))}%`,
                              height: '100%',
                              background:
                                (task.Progress_Percent || 0) >= 100
                                  ? '#10B981'
                                  : (task.Progress_Percent || 0) >= 50
                                  ? '#38BDF8'
                                  : '#F59E0B',
                              borderRadius: 3,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#CBD5E1',
                            minWidth: '32px',
                          }}
                        >
                          {task.Progress_Percent}%
                        </span>
                      </div>
                    </td>

                    {/* Start Date */}
                    <td>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          color: '#94A3B8',
                          fontSize: '0.75rem',
                        }}
                      >
                        <Calendar size={12} color="#64748B" />
                        <span>{startDateStr}</span>
                      </div>
                    </td>

                    {/* End Date */}
                    <td>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '5px',
                          color: '#94A3B8',
                          fontSize: '0.75rem',
                        }}
                      >
                        <Calendar size={12} color="#64748B" />
                        <span>{endDateStr}</span>
                      </div>
                    </td>

                    {/* Priority */}
                    <td>
                      <span className={`priority-badge ${getPriorityClass(task.Priority)}`}>
                        {task.Priority || 'Medium'}
                      </span>
                    </td>

                    {/* Risk Level */}
                    <td>
                      <span className={`risk-badge ${getRiskClass(task.Risk_Level)}`}>
                        <ShieldAlert size={10} />
                        {task.Risk_Level || 'Low'}
                      </span>
                    </td>

                    {/* Number of Team Members */}
                    <td>
                      <span className="team-members-pill">
                        <Users size={12} color="#818CF8" />
                        <span>{teamCount}</span>
                      </span>
                    </td>

                    {/* Budget / Spend */}
                    <td>
                      <div style={{ fontSize: '0.76rem' }}>
                        <span style={{ color: '#E2E8F0', fontWeight: 600 }}>
                          ${spendVal.toLocaleString()}
                        </span>
                        <span style={{ color: '#64748B' }}> / ${budgetVal.toLocaleString()}</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
