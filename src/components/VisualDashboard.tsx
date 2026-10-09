'use client';

import React, { useMemo, useState, useEffect } from 'react';
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
  Search,
} from 'lucide-react';
import { useData, formatCompactCurrency } from '@/context/DataContext';
import { TimelineVisualization } from './TimelineVisualization';
import { GanttChartVisualization } from './GanttChartVisualization';
import { ChartErrorBoundary } from './ChartErrorBoundary';
import { ActiveSection } from './Header';

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

        {data.avgProgress !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ color: '#94A3B8' }}>Avg Progress:</span>
            <strong style={{ color: '#10B981' }}>{data.avgProgress}%</strong>
          </div>
        )}

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

        {data.avgProgress !== undefined && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
            <span style={{ color: '#94A3B8' }}>Avg Progress:</span>
            <strong style={{ color: '#10B981' }}>{data.avgProgress}%</strong>
          </div>
        )}

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
  activeSection?: ActiveSection;
}

export const VisualDashboard: React.FC<VisualDashboardProps> = ({ onOpenUpload, activeSection }) => {
  const {
    dataset,
    rawDataset,
    filteredDataset,
    summary,
    highlightIds,
    clearHighlights,
    toggleHighlightId,
    fileName,
    resetToDefault,
    generateLiveData,
    loadPortfolioData,
    refreshFromDatabase,
    isLoading,
    isGenerating,
    error,
    filters,
    activeDepartment,
    activeStatus,
    activeRiskLevel,
    activeProject,
    setActiveDepartment,
    setActiveStatus,
    setActiveRiskLevel,
    setActiveProject,
    toggleFilter,
    clearAllFilters,
    hasActiveFilters,
  } = useData();

  const isCrossFiltering = highlightIds.length > 0;

  const showFinancials = !activeSection || activeSection === 'overview' || activeSection === 'financials';
  const showGantt = !activeSection || activeSection === 'overview' || activeSection === 'gantt';
  const showTasks = !activeSection || activeSection === 'overview' || activeSection === 'tasks';
  const showTimeline = !activeSection || activeSection === 'overview';

  // Unique filter option lists from dataset
  const availableDepartments = useMemo(() => {
    const set = new Set<string>();
    rawDataset.forEach((t) => {
      if (t.Department) set.add(t.Department);
    });
    return Array.from(set).sort();
  }, [rawDataset]);

  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    rawDataset.forEach((t) => {
      if (t.Status) set.add(t.Status);
    });
    const defaults = ['Completed', 'In Progress', 'Blocked', 'In Review', 'Planned'];
    defaults.forEach((s) => set.add(s));
    return Array.from(set);
  }, [rawDataset]);

  const availableRiskLevels = ['Critical', 'High', 'Medium', 'Low'];

  // Find highlighted tasks objects
  const highlightedTasks = useMemo(() => {
    if (!isCrossFiltering) return [];
    return dataset.filter((t) => highlightIds.includes(t.Task_ID));
  }, [dataset, highlightIds, isCrossFiltering]);

  // Component-level pagination for Main Tasks Table (15 rows per page)
  const [tablePage, setTablePage] = useState(1);
  const TABLE_PAGE_SIZE = 15;
  const displayTasks = isCrossFiltering ? highlightedTasks : dataset;
  const totalTablePages = Math.max(1, Math.ceil(displayTasks.length / TABLE_PAGE_SIZE));
  const paginatedTableTasks = useMemo(() => {
    const start = (tablePage - 1) * TABLE_PAGE_SIZE;
    return displayTasks.slice(start, start + TABLE_PAGE_SIZE);
  }, [displayTasks, tablePage]);

  useEffect(() => {
    if (tablePage > totalTablePages) {
      setTablePage(1);
    }
  }, [totalTablePages, tablePage]);

  // Financial status chart data (Spent mapped to slice sizes)
  const statusData = useMemo(() => {
    return summary.statusCounts.map((item) => {
      const isSelected = activeStatus?.toLowerCase() === item.status?.toLowerCase();
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
        isSelected,
        isHighlighted,
        opacity: activeStatus
          ? isSelected
            ? 1
            : 0.25
          : !isCrossFiltering
          ? 1
          : isHighlighted
          ? 1
          : 0.25,
      };
    });
  }, [summary.statusCounts, highlightIds, isCrossFiltering, dataset, activeStatus]);

  // Initiative budget utilization data (grouped by Department & Project Name)
  const projectBudgetData = useMemo(() => {
    return summary.projectBudgets.map((item) => {
      const isSelected = activeProject?.toLowerCase() === item.project.toLowerCase();
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
        isSelected,
        isHighlighted,
        opacity: activeProject
          ? isSelected
            ? 1
            : 0.25
          : !isCrossFiltering
          ? 1
          : isHighlighted
          ? 1
          : 0.25,
      };
    });
  }, [summary.projectBudgets, highlightIds, isCrossFiltering, dataset, activeProject]);

  // Component-level pagination for Budget Utilization Chart (15 initiatives per page)
  const [budgetPage, setBudgetPage] = useState(1);
  const BUDGET_PAGE_SIZE = 15;
  const totalBudgetPages = Math.max(1, Math.ceil(projectBudgetData.length / BUDGET_PAGE_SIZE));
  const paginatedBudgetData = useMemo(() => {
    const start = (budgetPage - 1) * BUDGET_PAGE_SIZE;
    return projectBudgetData.slice(start, start + BUDGET_PAGE_SIZE);
  }, [projectBudgetData, budgetPage]);

  useEffect(() => {
    if (budgetPage > totalBudgetPages) {
      setBudgetPage(1);
    }
  }, [totalBudgetPages, budgetPage]);

  // Department distribution data
  const deptData = useMemo(() => {
    return summary.departmentDistribution.map((item, idx) => {
      const isSelected = activeDepartment?.toLowerCase() === item.name?.toLowerCase();
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
        isSelected,
        isHighlighted,
        opacity: activeDepartment
          ? isSelected
            ? 1
            : 0.25
          : !isCrossFiltering
          ? 1
          : isHighlighted
          ? 1
          : 0.25,
      };
    });
  }, [summary.departmentDistribution, highlightIds, isCrossFiltering, dataset, activeDepartment]);

  // 1. Loading state while database synchronization is in flight
  if (isLoading && (!rawDataset || rawDataset.length === 0)) {
    return (
      <div className="visual-dashboard-container" style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div className="spinner" style={{ width: 44, height: 44, border: '3px solid rgba(99, 102, 241, 0.2)', borderTopColor: '#6366F1', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <h3 style={{ fontSize: '1.25rem', color: '#F8FAFC', fontWeight: 600 }}>
            Synchronizing Portfolio from SQLite Database...
          </h3>
          <p style={{ color: '#94A3B8', fontSize: '0.88rem', maxWidth: 460 }}>
            Querying persistent records, deterministic budget variance analytics, and Gantt timeline schedules.
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => refreshFromDatabase()}
              style={{ padding: '8px 16px', fontSize: '0.82rem' }}
            >
              Retry Sync
            </button>
            <button
              type="button"
              className="btn-icon"
              onClick={() => loadPortfolioData(150)}
              style={{ padding: '8px 16px', fontSize: '0.82rem' }}
            >
              Load 150-Task Portfolio
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. Error state if database query failed
  if (error && (!rawDataset || rawDataset.length === 0)) {
    return (
      <div className="visual-dashboard-container" style={{ padding: '60px 24px' }}>
        <div className="empty-dataset-card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)', background: 'rgba(239, 68, 68, 0.06)' }}>
          <div className="empty-icon-wrap" style={{ background: 'rgba(239, 68, 68, 0.15)' }}>
            <AlertTriangle size={32} color="#EF4444" />
          </div>
          <h3 style={{ color: '#FCA5A5' }}>Database Synchronization Error</h3>
          <p style={{ color: '#E2E8F0', marginBottom: '16px' }}>{error}</p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn-primary"
              onClick={() => refreshFromDatabase()}
              style={{ background: '#EF4444', borderColor: '#DC2626' }}
            >
              Retry Database Sync
            </button>
            {onOpenUpload && (
              <button
                type="button"
                className="btn-icon"
                onClick={onOpenUpload}
              >
                Upload File
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 3. Only show "Please Upload a Dataset" screen if the raw dataset is truly empty
  if (!rawDataset || rawDataset.length === 0) {
    return (
      <div className="visual-dashboard-container">
        <div className="empty-dataset-card">
          <div className="empty-icon-wrap">
            <UploadCloud size={32} color="#818CF8" />
          </div>
          <h3>Please Upload a Dataset</h3>
          <p>
            No active project dataset is currently loaded in memory. Upload a custom CSV/JSON file,
            generate dynamic AI tasks, or instantly load the comprehensive 100-project portfolio dataset.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '16px' }}>
            {/* Primary Action: Permanently Hardcoded 100-Project Portfolio */}
            <button
              id="btn-empty-load-portfolio"
              type="button"
              className="btn-primary"
              style={{
                width: 'auto',
                padding: '11px 22px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #0284C7 0%, #4F46E5 100%)',
                boxShadow: '0 4px 16px rgba(2, 132, 199, 0.4)',
                fontWeight: 600,
                fontSize: '0.9rem',
              }}
              onClick={() => loadPortfolioData(150)}
              title="Load deterministic 150-project portfolio with all PM edge cases (10% blocked, 15% budget overruns, schedule slippage, resource bottlenecks)"
            >
              <Layers size={17} />
              <span>Load 150-Project Portfolio</span>
            </button>

            {/* File Upload Button */}
            <button
              id="btn-empty-upload"
              type="button"
              className="btn-icon"
              style={{
                padding: '11px 20px',
                background: 'rgba(99, 102, 241, 0.15)',
                borderColor: 'rgba(99, 102, 241, 0.4)',
                color: '#C7D2FE',
                fontWeight: 500,
                fontSize: '0.88rem',
              }}
              onClick={onOpenUpload}
              title="Upload custom CSV or JSON project file"
            >
              <UploadCloud size={16} color="#818CF8" />
              <span>Upload CSV / JSON</span>
            </button>

            {/* Live Data Generator (30 Tasks) */}
            <button
              id="btn-empty-generate-live"
              type="button"
              className="btn-icon"
              style={{
                padding: '11px 20px',
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.16) 0%, rgba(6, 182, 212, 0.16) 100%)',
                borderColor: 'rgba(16, 185, 129, 0.45)',
                color: '#A7F3D0',
                fontWeight: 500,
                fontSize: '0.88rem',
              }}
              disabled={isGenerating}
              onClick={generateLiveData}
              title="Generate 30 realistic AI project tasks"
            >
              <Sparkles size={16} color="#34D399" />
              <span>{isGenerating ? 'Generating...' : 'Generate Live Data (30 Tasks)'}</span>
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              gap: '8px',
              flexWrap: 'wrap',
              justifyContent: 'center',
              fontSize: '0.78rem',
              color: '#94A3B8',
              marginTop: '4px',
            }}
          >
            <span style={{ padding: '4px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              ⚡ 10 Blocked & Critical Tasks
            </span>
            <span style={{ padding: '4px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              💰 15 Budget Overruns (120-150%)
            </span>
            <span style={{ padding: '4px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              👥 Overallocated Resource Bottlenecks
            </span>
            <span style={{ padding: '4px 10px', borderRadius: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              📅 Interactive Gantt Chart
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="visual-dashboard-container">
      {/* 1. Global Dashboard Sticky Filter Bar */}
      <div className="dashboard-filter-bar">
        <div className="filter-controls-group">
          {/* Department Dropdown */}
          <select
            id="filter-department-select"
            className="filter-select"
            value={activeDepartment || ''}
            onChange={(e) => setActiveDepartment(e.target.value || null)}
            title="Filter by Department"
          >
            <option value="">All Departments</option>
            {availableDepartments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>

          {/* Status Dropdown */}
          <select
            id="filter-status-select"
            className="filter-select"
            value={activeStatus || ''}
            onChange={(e) => setActiveStatus(e.target.value || null)}
            title="Filter by Status"
          >
            <option value="">All Statuses</option>
            {availableStatuses.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {/* Risk Level Dropdown */}
          <select
            id="filter-risk-select"
            className="filter-select"
            value={activeRiskLevel || ''}
            onChange={(e) => setActiveRiskLevel(e.target.value || null)}
            title="Filter by Risk Level"
          >
            <option value="">All Risk Levels</option>
            {availableRiskLevels.map((risk) => (
              <option key={risk} value={risk}>
                {risk} Risk
              </option>
            ))}
          </select>

          {/* Project Name Text Search Input */}
          <div className="filter-search-wrapper">
            <Search size={14} className="filter-search-icon" />
            <input
              id="filter-project-input"
              type="text"
              className="filter-search-input"
              placeholder="Search project name..."
              value={filters.project || ''}
              onChange={(e) => setActiveProject(e.target.value)}
            />
            {filters.project && (
              <button
                type="button"
                className="filter-search-clear"
                onClick={() => setActiveProject(null)}
                title="Clear project search"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Filter Stats & Reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontSize: '0.74rem',
              color: '#38BDF8',
              background: 'rgba(56, 189, 248, 0.1)',
              padding: '3px 10px',
              borderRadius: '12px',
              border: '1px solid rgba(56, 189, 248, 0.25)',
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            Showing {dataset.length} of {rawDataset.length} Tasks
          </span>

          {(hasActiveFilters || isCrossFiltering) && (
            <button
              id="btn-clear-global-filters"
              type="button"
              className="btn-clear-filter"
              onClick={clearAllFilters}
              style={{ padding: '4px 10px', fontSize: '0.72rem' }}
              title="Reset all filters"
            >
              <X size={12} />
              <span>Clear Filters</span>
            </button>
          )}
        </div>
      </div>

      {/* Portfolio Dataset Scope Bar */}
      <div className="portfolio-control-bar" style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="portfolio-info-left" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Layers size={14} color="#38BDF8" />
          <span style={{ fontSize: '0.76rem', color: '#94A3B8' }}>
            Active Dataset Scope: <strong style={{ color: '#F8FAFC' }}>{dataset.length}</strong> tasks • <strong style={{ color: '#F8FAFC' }}>{summary.projects.length}</strong> projects • <strong style={{ color: '#F8FAFC' }}>{summary.departments.length}</strong> departments
          </span>
        </div>
      </div>

      {/* Top Cross-Filtering Active Banner */}
      {(hasActiveFilters || isCrossFiltering) && (
        <div className="filter-active-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <Filter size={15} color="#38BDF8" />
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#F1F5F9' }}>
              Active Filters:
            </span>

            {/* Department Filter Tag */}
            {activeDepartment && (
              <span className="active-filter-chip">
                <span>Dept: {activeDepartment}</span>
                <button
                  type="button"
                  onClick={() => setActiveDepartment(null)}
                  title="Clear department filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {/* Status Filter Tag */}
            {activeStatus && (
              <span className="active-filter-chip">
                <span>Status: {activeStatus}</span>
                <button
                  type="button"
                  onClick={() => setActiveStatus(null)}
                  title="Clear status filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {/* Project Filter Tag */}
            {activeProject && (
              <span className="active-filter-chip">
                <span>Project: {activeProject}</span>
                <button
                  type="button"
                  onClick={() => setActiveProject(null)}
                  title="Clear project filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {/* Risk Filter Tag */}
            {activeRiskLevel && (
              <span className="active-filter-chip">
                <span>Risk: {activeRiskLevel}</span>
                <button
                  type="button"
                  onClick={() => setActiveRiskLevel(null)}
                  title="Clear risk filter"
                >
                  <X size={11} />
                </button>
              </span>
            )}

            {/* Highlighted Tasks from Analyst */}
            {isCrossFiltering && (
              <span
                className="active-filter-chip"
                style={{ background: 'rgba(99, 102, 241, 0.25)', borderColor: '#818CF8' }}
              >
                <Sparkles size={11} color="#A5B4FC" />
                <span>{highlightIds.length} Highlighted</span>
                <button
                  type="button"
                  onClick={clearHighlights}
                  title="Clear highlight cross-filtering"
                >
                  <X size={11} />
                </button>
              </span>
            )}
          </div>

          <button
            id="btn-clear-all-filters"
            type="button"
            className="btn-clear-filter"
            onClick={clearAllFilters}
            title="Reset all active cross-filters and highlights"
          >
            <X size={13} />
            <span>Clear Filters</span>
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

      {/* 3. Add friendly No Results UI state if rawDataset has records but filters yielded zero results */}
      {dataset.length === 0 ? (
        <div
          className="chart-card no-results-card"
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.6)',
            borderRadius: '12px',
            border: '1px dashed rgba(255, 255, 255, 0.15)',
            marginTop: '12px',
            marginBottom: '16px',
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '16px',
            }}
          >
            <Filter size={26} color="#F59E0B" />
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#F1F5F9', margin: '0 0 8px 0' }}>
            No Matching Tasks Found
          </h3>
          <p
            style={{
              color: '#94A3B8',
              fontSize: '0.88rem',
              maxWidth: '460px',
              margin: '0 auto 20px auto',
              lineHeight: 1.5,
            }}
          >
            No tasks match the selected filters. Please adjust your criteria or clear filters.
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              id="btn-clear-no-results-filters"
              type="button"
              className="btn-primary"
              style={{
                width: 'auto',
                padding: '9px 20px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                fontSize: '0.84rem',
                fontWeight: 600,
              }}
              onClick={clearAllFilters}
            >
              <X size={15} />
              <span>Clear All Filters</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Chronological Stacked Column Timeline Visualization */}
          {showTimeline && <TimelineVisualization />}

      {showFinancials && (
        <>
      {/* Chart 1: Financial Spend by Task Status (Donut Chart) */}
      <ChartErrorBoundary fallbackTitle="Financial Spend Chart Unavailable" onReset={clearAllFilters}>
        <div className="chart-card">
          <div className="chart-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieIcon size={16} color="#38BDF8" />
              <h3 className="chart-title">Financial Spend by Task Status</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {activeStatus && (
                <button
                  type="button"
                  className="btn-clear-filter"
                  onClick={() => setActiveStatus(null)}
                  style={{ padding: '2px 8px', fontSize: '0.68rem' }}
                  title="Reset status filter"
                >
                  <X size={11} />
                  <span>Status: {activeStatus}</span>
                </button>
              )}
              {isCrossFiltering && (
                <span className="crossfilter-indicator">Cross-Filtering Active</span>
              )}
            </div>
          </div>

          <div style={{ position: 'relative', height: 210, width: '100%' }}>
            {statusData.length === 0 ? (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94A3B8',
                  fontSize: '0.82rem',
                }}
              >
                No tasks match the selected filters. Please adjust your criteria or clear filters.
              </div>
            ) : (
              <>
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
                      onClick={(entry: any) => {
                        if (entry && entry.status) {
                          setActiveStatus(entry.status);
                        }
                      }}
                    >
                      {statusData.map((entry, index) => (
                        <Cell
                          key={`status-donut-${index}`}
                          fill={entry.color}
                          fillOpacity={entry.opacity}
                          stroke={entry.isSelected ? '#FFFFFF' : entry.isHighlighted ? '#FFFFFF' : 'rgba(15, 23, 42, 0.8)'}
                          strokeWidth={entry.isSelected ? 3 : entry.isHighlighted ? 2.5 : 1.5}
                          style={{ cursor: 'pointer', outline: 'none' }}
                          onClick={() => setActiveStatus(entry.status)}
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
              </>
            )}
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
              onClick={() => setActiveStatus(entry.status)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.71rem',
                opacity: entry.opacity,
                cursor: 'pointer',
                padding: '3px 8px',
                borderRadius: '4px',
                background: entry.isSelected ? 'rgba(56, 189, 248, 0.18)' : 'transparent',
                border: entry.isSelected ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid transparent',
                transition: 'all 0.15s ease',
              }}
              title={`Click to filter by Status: ${entry.status}`}
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
      </ChartErrorBoundary>

      {/* Chart 2: Project Initiative Budget Utilization (Horizontal Stacked Bar Chart) */}
      <ChartErrorBoundary fallbackTitle="Budget Utilization Chart Unavailable" onReset={clearAllFilters}>
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
              Horizontal progress bars by Department & Project. Click any bar to cross-filter by project.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {activeProject && (
              <button
                type="button"
                className="btn-clear-filter"
                onClick={() => setActiveProject(null)}
                style={{ padding: '2px 8px', fontSize: '0.68rem' }}
                title="Reset project filter"
              >
                <X size={11} />
                <span>Project: {activeProject}</span>
              </button>
            )}
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

        {/* Wrapper with strict max-h-[500px] and vertical scrolling */}
        <div
          className="max-h-[500px] overflow-y-auto w-full"
          style={{
            maxHeight: '500px',
            overflowY: 'auto',
            width: '100%',
          }}
        >
          {paginatedBudgetData.length === 0 ? (
            <div
              style={{
                padding: '36px 16px',
                textAlign: 'center',
                color: '#94A3B8',
                fontSize: '0.82rem',
              }}
            >
              No tasks match the selected filters. Please adjust your criteria or clear filters.
            </div>
          ) : (
            <div
              style={{
                height: Math.max(260, paginatedBudgetData.length * 40),
                width: '100%',
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={paginatedBudgetData}
                margin={{ top: 8, right: 25, left: 18, bottom: 4 }}
                onClick={(state: any) => {
                  if (state && state.activePayload && state.activePayload[0]) {
                    const p = state.activePayload[0].payload;
                    if (p?.project) {
                      setActiveProject(p.project);
                    }
                  }
                }}
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
                  {paginatedBudgetData.map((entry, idx) => (
                    <Cell
                      key={`sp-${idx}`}
                      fill={entry.burnRate > 100 ? '#1D4ED8' : '#2563EB'}
                      fillOpacity={entry.opacity}
                      stroke={entry.isSelected ? '#38BDF8' : entry.isHighlighted ? '#FFFFFF' : 'transparent'}
                      strokeWidth={entry.isSelected ? 2.5 : entry.isHighlighted ? 2 : 0}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setActiveProject(entry.project)}
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
                  {paginatedBudgetData.map((entry, idx) => (
                    <Cell
                      key={`rem-${idx}`}
                      fill="rgba(255, 255, 255, 0.14)"
                      fillOpacity={entry.opacity}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setActiveProject(entry.project)}
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
                  {paginatedBudgetData.map((entry, idx) => (
                    <Cell
                      key={`over-${idx}`}
                      fill="#EF4444"
                      fillOpacity={entry.opacity}
                      stroke={entry.isSelected ? '#38BDF8' : entry.isHighlighted ? '#FFFFFF' : 'transparent'}
                      strokeWidth={entry.isSelected ? 2.5 : entry.isHighlighted ? 2 : 0}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setActiveProject(entry.project)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

        {/* Pagination Bar for Budget Initiatives (15 per page) */}
        {projectBudgetData.length > BUDGET_PAGE_SIZE && (
          <div className="pagination-bar">
            <span style={{ color: '#94A3B8' }}>
              Showing {(budgetPage - 1) * BUDGET_PAGE_SIZE + 1} -{' '}
              {Math.min(budgetPage * BUDGET_PAGE_SIZE, projectBudgetData.length)} of{' '}
              {projectBudgetData.length} Initiatives
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="pagination-btn"
                disabled={budgetPage === 1}
                onClick={() => setBudgetPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span style={{ color: '#F1F5F9', fontWeight: 600 }}>
                Page {budgetPage} of {totalBudgetPages}
              </span>
              <button
                type="button"
                className="pagination-btn"
                disabled={budgetPage >= totalBudgetPages}
                onClick={() => setBudgetPage((p) => Math.min(totalBudgetPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      </ChartErrorBoundary>

      {/* Chart 3: Department Breakdown (Pie Chart) */}
      <ChartErrorBoundary fallbackTitle="Department Workload Chart Unavailable" onReset={clearAllFilters}>
        <div className="chart-card">
          <div className="chart-card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PieIcon size={16} color="#06B6D4" />
              <h3 className="chart-title">Tasks by Department</h3>
            </div>
            {activeDepartment && (
              <button
                type="button"
                className="btn-clear-filter"
                onClick={() => setActiveDepartment(null)}
                style={{ padding: '2px 8px', fontSize: '0.68rem' }}
                title="Reset department filter"
              >
                <X size={11} />
                <span>Dept: {activeDepartment}</span>
              </button>
            )}
          </div>

          <div style={{ height: 180, width: '100%' }}>
            {deptData.length === 0 ? (
              <div
                style={{
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94A3B8',
                  fontSize: '0.82rem',
                }}
              >
                No tasks match the selected filters. Please adjust your criteria or clear filters.
              </div>
            ) : (
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
                    onClick={(entry: any) => {
                      if (entry && entry.name) {
                        setActiveDepartment(entry.name);
                      }
                    }}
                  >
                    {deptData.map((entry, index) => (
                      <Cell
                        key={`dept-${index}`}
                        fill={entry.color}
                        fillOpacity={entry.opacity}
                        stroke={entry.isSelected ? '#FFFFFF' : entry.isHighlighted ? '#FFFFFF' : 'transparent'}
                        strokeWidth={entry.isSelected ? 3 : entry.isHighlighted ? 2 : 0}
                        style={{ cursor: 'pointer', outline: 'none' }}
                        onClick={() => setActiveDepartment(entry.name)}
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
                    onClick={(e: any) => {
                      if (e && e.value) {
                        setActiveDepartment(e.value);
                      }
                    }}
                    formatter={(value) => (
                      <span
                        style={{
                          color: activeDepartment?.toLowerCase() === value?.toLowerCase() ? '#38BDF8' : '#CBD5E1',
                          fontWeight: activeDepartment?.toLowerCase() === value?.toLowerCase() ? 700 : 500,
                          fontSize: '11px',
                          cursor: 'pointer',
                        }}
                        title={`Click to filter by Department: ${value}`}
                      >
                        {value}
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </ChartErrorBoundary>
        </>
      )}

      {/* Main Granular Data Table Component with Horizontal Scrolling */}
      {showTasks && (
      <ChartErrorBoundary fallbackTitle="Tasks Table Unavailable" onReset={clearAllFilters}>
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

        {/* Wrapper with strict max-h-[500px] and vertical scrolling */}
        <div className="table-scroll-container max-h-[500px] overflow-y-auto" style={{ maxHeight: '500px', overflowY: 'auto' }}>
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
              {paginatedTableTasks.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: '40px 16px', color: '#94A3B8' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <Filter size={24} color="#F59E0B" />
                      <span style={{ fontWeight: 600, color: '#F1F5F9', fontSize: '0.88rem' }}>
                        No tasks match the selected filters. Please adjust your criteria or clear filters.
                      </span>
                      <button
                        type="button"
                        className="btn-clear-filter"
                        onClick={clearAllFilters}
                        style={{ marginTop: '8px', padding: '5px 14px', fontSize: '0.76rem' }}
                      >
                        Clear Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTableTasks.map((task) => {
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
              }))}
            </tbody>
          </table>
        </div>

        {/* Component-Level Pagination Bar for Tasks Table (15 rows per page) */}
        {displayTasks.length > TABLE_PAGE_SIZE && (
          <div className="pagination-bar">
            <span style={{ color: '#94A3B8' }}>
              Showing {(tablePage - 1) * TABLE_PAGE_SIZE + 1} -{' '}
              {Math.min(tablePage * TABLE_PAGE_SIZE, displayTasks.length)} of{' '}
              {displayTasks.length} Tasks
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="pagination-btn"
                disabled={tablePage === 1}
                onClick={() => setTablePage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span style={{ color: '#F1F5F9', fontWeight: 600 }}>
                Page {tablePage} of {totalTablePages}
              </span>
              <button
                type="button"
                className="pagination-btn"
                disabled={tablePage >= totalTablePages}
                onClick={() => setTablePage((p) => Math.min(totalTablePages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      </ChartErrorBoundary>
      )}

      {/* Gantt Chart Component at the bottom of the dashboard layout */}
      {showGantt && <GanttChartVisualization />}
        </>
      )}
    </div>
  );
};
