'use client';

import React, { useState } from 'react';
import {
  X,
  Database,
  FileText,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  Search,
  Calendar,
  Users,
  ShieldAlert,
  User,
} from 'lucide-react';
import { DatasetInfo } from '@/lib/dataset';
import { useData } from '@/context/DataContext';

interface DatasetDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DatasetDrawer: React.FC<DatasetDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { dataset: records, fileName, fileSize, summary } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(records, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredRecords = records.filter((r) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      (r.Task_ID && r.Task_ID.toLowerCase().includes(term)) ||
      (r.Task_Title && r.Task_Title.toLowerCase().includes(term)) ||
      (r.Project_Name && r.Project_Name.toLowerCase().includes(term)) ||
      (r.Owner && r.Owner.toLowerCase().includes(term)) ||
      (r.Department && r.Department.toLowerCase().includes(term)) ||
      (r.Status && r.Status.toLowerCase().includes(term))
    );
  });

  const getStatusClass = (status: string) => {
    const s = (status || '').toLowerCase();
    if (s.includes('complete')) return 'status-completed';
    if (s.includes('block')) return 'status-blocked';
    if (s.includes('progress')) return 'status-in-progress';
    if (s.includes('review')) return 'status-review';
    return 'status-planned';
  };

  const getPriorityClass = (priority?: string): string => {
    const p = (priority || '').toLowerCase();
    if (p.includes('crit')) return 'priority-critical';
    if (p.includes('high')) return 'priority-high';
    if (p.includes('med')) return 'priority-medium';
    return 'priority-low';
  };

  const getRiskClass = (risk?: string): string => {
    const r = (risk || '').toLowerCase();
    if (r.includes('crit')) return 'risk-critical';
    if (r.includes('high')) return 'risk-high';
    if (r.includes('med')) return 'risk-medium';
    return 'risk-low';
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="drawer-content"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
      >
        <div className="drawer-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(16, 185, 129, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#34D399',
              }}
            >
              <Database size={20} />
            </div>
            <div>
              <h2
                id="drawer-title"
                style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F8FAFC' }}
              >
                Local Dataset Inspector
              </h2>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#94A3B8',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <span>File:</span>
                <span className="status-badge-file">"{fileName}"</span>
                <span>• {records.length} parsed JSON records</span>
                <span>• {(fileSize / 1024).toFixed(1)} KB</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn-icon"
              onClick={handleCopyJson}
              title="Copy parsed JSON array to clipboard"
            >
              {copied ? <Check size={14} color="#34D399" /> : <Copy size={14} />}
              <span>{copied ? 'Copied JSON' : 'Copy JSON'}</span>
            </button>

            <button
              type="button"
              className="close-btn"
              onClick={onClose}
              aria-label="Close drawer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="drawer-body">
          {/* Summary KPI Cards */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <span className="kpi-label">Total Allocated</span>
              <span className="kpi-val" style={{ color: '#38BDF8' }}>
                ${(summary.totalBudget || 0).toLocaleString()}
              </span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Actual Spend</span>
              <span className="kpi-val" style={{ color: '#F43F5E' }}>
                ${(summary.totalSpend || 0).toLocaleString()}
              </span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Avg Progress</span>
              <span className="kpi-val" style={{ color: '#10B981' }}>
                {summary.avgProgress}%
              </span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Blocked Tasks</span>
              <span className="kpi-val" style={{ color: '#FB7185' }}>
                {summary.blockedCount}
              </span>
            </div>
            <div className="kpi-card">
              <span className="kpi-label">Critical Risks</span>
              <span className="kpi-val" style={{ color: '#F59E0B' }}>
                {summary.criticalRiskCount}
              </span>
            </div>
          </div>

          {/* Search bar & Record count */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div
              style={{
                position: 'relative',
                flex: 1,
              }}
            >
              <Search
                size={16}
                color="#64748B"
                style={{ position: 'absolute', left: 12, top: 12 }}
              />
              <input
                type="text"
                className="form-input"
                style={{ width: '100%', paddingLeft: 38 }}
                placeholder="Search tasks, project name, owner, department..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div style={{ fontSize: '0.8rem', color: '#94A3B8' }}>
              Showing {filteredRecords.length} of {records.length} records
            </div>
          </div>

          {/* Data Table with Horizontal Scrolling */}
          <div className="table-wrapper" style={{ maxHeight: '420px', overflowX: 'auto' }}>
            <table style={{ minWidth: '1200px' }}>
              <thead>
                <tr>
                  <th>Task ID</th>
                  <th>Project</th>
                  <th>Task Title</th>
                  <th>Project Manager</th>
                  <th>Dept</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Priority</th>
                  <th>Risk</th>
                  <th>Team</th>
                  <th>Budget</th>
                  <th>Spend</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((task, idx) => {
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

                  return (
                    <tr key={task.Task_ID || idx}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#38BDF8' }}>
                        {task.Task_ID}
                      </td>
                      <td style={{ fontWeight: 600, color: '#F8FAFC' }}>
                        {task.Project_Name}
                      </td>
                      <td>{task.Task_Title}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <User size={12} color="#94A3B8" />
                          <span>{manager}</span>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.76rem', color: '#94A3B8' }}>{task.Department}</td>
                      <td>
                        <span className={`status-pill ${getStatusClass(task.Status)}`}>
                          {task.Status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <div
                            style={{
                              width: 50,
                              height: 6,
                              background: 'rgba(255,255,255,0.1)',
                              borderRadius: 3,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(100, Math.max(0, task.Progress_Percent || 0))}%`,
                                height: '100%',
                                background:
                                  task.Progress_Percent === 100
                                    ? '#10B981'
                                    : task.Progress_Percent > 50
                                    ? '#38BDF8'
                                    : '#F59E0B',
                              }}
                            />
                          </div>
                          <span style={{ fontSize: '0.74rem', color: '#94A3B8' }}>
                            {task.Progress_Percent}%
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94A3B8', fontSize: '0.74rem' }}>
                          <Calendar size={11} color="#64748B" />
                          <span>{startDateStr}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#94A3B8', fontSize: '0.74rem' }}>
                          <Calendar size={11} color="#64748B" />
                          <span>{endDateStr}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`priority-badge ${getPriorityClass(task.Priority)}`}>
                          {task.Priority || 'Medium'}
                        </span>
                      </td>
                      <td>
                        <span className={`risk-badge ${getRiskClass(task.Risk_Level)}`}>
                          <ShieldAlert size={10} />
                          {task.Risk_Level || 'Low'}
                        </span>
                      </td>
                      <td>
                        <span className="team-members-pill">
                          <Users size={11} color="#818CF8" />
                          <span>{teamCount}</span>
                        </span>
                      </td>
                      <td>${Number(task.Allocated_Budget_USD || 0).toLocaleString()}</td>
                      <td
                        style={{
                          color:
                            task.Actual_Spend_USD > task.Allocated_Budget_USD
                              ? '#FB7185'
                              : '#E2E8F0',
                        }}
                      >
                        ${Number(task.Actual_Spend_USD || 0).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
