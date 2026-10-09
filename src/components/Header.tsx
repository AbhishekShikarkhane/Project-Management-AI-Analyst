'use client';

import React from 'react';
import {
  Database,
  Key,
  Trash2,
  Download,
  Bot,
  Sparkles,
  UploadCloud,
  Layers,
  RotateCcw,
  LayoutDashboard,
  DollarSign,
  Calendar,
  Table as TableIcon,
  MessageSquare,
  Columns,
} from 'lucide-react';

export type ActiveSection = 'overview' | 'financials' | 'gantt' | 'tasks' | 'chat';

interface HeaderProps {
  datasetName: string;
  recordCount: number;
  hasApiKey: boolean;
  activeSection: ActiveSection;
  onSelectSection: (section: ActiveSection) => void;
  viewMode: 'split' | 'dashboard' | 'chat';
  onChangeViewMode: (mode: 'split' | 'dashboard' | 'chat') => void;
  onOpenDataset: () => void;
  onOpenUpload: () => void;
  onGenerateLiveData: () => void;
  onLoadPortfolio?: () => void;
  onResetDashboard?: () => void;
  isGenerating?: boolean;
  onOpenApiKey: () => void;
  onClearChat: () => void;
  onExportReport: () => void;
  messageCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  datasetName,
  recordCount,
  hasApiKey,
  activeSection,
  onSelectSection,
  viewMode,
  onChangeViewMode,
  onOpenDataset,
  onOpenUpload,
  onGenerateLiveData,
  onLoadPortfolio,
  onResetDashboard,
  isGenerating = false,
  onOpenApiKey,
  onClearChat,
  onExportReport,
  messageCount,
}) => {
  const navTabs: { id: ActiveSection; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: 'overview', label: 'Portfolio Overview', icon: LayoutDashboard },
    { id: 'financials', label: 'Budget & Variance', icon: DollarSign },
    { id: 'gantt', label: 'Gantt Timeline', icon: Calendar },
    { id: 'tasks', label: 'Task Master Table', icon: TableIcon },
    { id: 'chat', label: 'AI Analyst Copilot', icon: Bot },
  ];

  return (
    <header className="app-header-container">
      {/* Primary Brand & Actions Bar */}
      <div className="app-header-top">
        <div className="brand-wrapper">
          <div className="brand-logo-icon">
            <Bot size={22} />
          </div>
          <div className="brand-info">
            <h1 className="brand-title-row">
              <span>PM Insight Engine</span>
              <span className="brand-badge">SQLite Grounded</span>
            </h1>
            <div className="brand-subtitle">
              <Sparkles size={11} color="#A5B4FC" />
              <span>Project Management Analytics Platform</span>
            </div>
          </div>
        </div>

        {/* Global Toolbar Actions */}
        <div className="header-actions">
          {/* Load 150-Project Portfolio Button */}
          {onLoadPortfolio && (
            <button
              id="btn-header-load-portfolio"
              type="button"
              className="btn-icon"
              style={{
                background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.16) 0%, rgba(99, 102, 241, 0.16) 100%)',
                borderColor: 'rgba(56, 189, 248, 0.45)',
                color: '#38BDF8',
                fontWeight: 600,
              }}
              onClick={onLoadPortfolio}
              title="Load authoritative 150-project portfolio dataset from SQLite database"
            >
              <Layers size={13} color="#38BDF8" />
              <span>Load 150-Project Portfolio</span>
            </button>
          )}

          {/* Generate Live Data Button */}
          <button
            id="btn-generate-live-data"
            type="button"
            className="btn-icon"
            disabled={isGenerating}
            style={{
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.14) 0%, rgba(6, 182, 212, 0.14) 100%)',
              borderColor: 'rgba(16, 185, 129, 0.4)',
              color: '#A7F3D0',
              fontWeight: 600,
            }}
            onClick={onGenerateLiveData}
            title="Fetch 30 AI-generated project tasks"
          >
            {isGenerating ? (
              <>
                <span className="pulse-dot" style={{ backgroundColor: '#10B981' }} />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Sparkles size={13} color="#34D399" />
                <span>Generate Live Data</span>
              </>
            )}
          </button>

          {/* Upload Dataset Button */}
          <button
            id="btn-upload-dataset"
            type="button"
            className="btn-icon"
            style={{ background: 'rgba(99, 102, 241, 0.14)', borderColor: 'rgba(99, 102, 241, 0.35)', color: '#C7D2FE' }}
            onClick={onOpenUpload}
            title="Upload custom CSV or JSON dataset"
          >
            <UploadCloud size={13} color="#818CF8" />
            <span>Upload Data</span>
          </button>

          {/* Active Dataset Status Pill */}
          <button
            id="btn-dataset-pill"
            type="button"
            className="dataset-pill"
            onClick={onOpenDataset}
            title="Click to inspect raw database records & statistics"
          >
            <span className="pulse-dot" />
            <Database size={13} />
            <span>
              {datasetName || 'Project Portfolio'}
              {recordCount > 0 && ` [${recordCount}]`}
            </span>
          </button>

          {/* Reset Dashboard */}
          {recordCount > 0 && onResetDashboard && (
            <button
              id="btn-reset-dashboard"
              type="button"
              className="btn-icon"
              style={{
                background: 'rgba(239, 68, 68, 0.12)',
                borderColor: 'rgba(239, 68, 68, 0.3)',
                color: '#FCA5A5',
              }}
              onClick={onResetDashboard}
              title="Clear dataset and return to empty state"
            >
              <RotateCcw size={13} color="#F87171" />
              <span>Reset</span>
            </button>
          )}

          {/* API Key */}
          <button
            id="btn-api-key"
            type="button"
            className={`btn-icon ${hasApiKey ? 'active' : ''}`}
            onClick={onOpenApiKey}
            title="Configure Gemini API Key"
          >
            <Key size={13} />
            <span>{hasApiKey ? 'API Key Active' : 'Set API Key'}</span>
          </button>

          {/* Export Report */}
          {messageCount > 0 && (
            <button
              id="btn-export-chat"
              type="button"
              className="btn-icon"
              onClick={onExportReport}
              title="Export analysis session as Markdown"
            >
              <Download size={13} />
              <span>Export</span>
            </button>
          )}

          {/* Clear Chat */}
          {messageCount > 0 && (
            <button
              id="btn-clear-chat"
              type="button"
              className="btn-icon"
              onClick={onClearChat}
              title="Clear chat history"
            >
              <Trash2 size={13} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* Secondary Top Navigation Bar: Section Tabs & View Modes */}
      <nav className="app-nav-bar" aria-label="Main Navigation">
        <div className="nav-tabs-wrapper">
          {navTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                id={`nav-tab-${tab.id}`}
                type="button"
                className={`nav-tab-btn ${isActive ? 'active' : ''}`}
                onClick={() => {
                  onSelectSection(tab.id);
                  if (tab.id === 'chat') {
                    onChangeViewMode('chat');
                  } else if (viewMode === 'chat') {
                    onChangeViewMode('split');
                  }
                }}
              >
                <Icon size={15} className="tab-icon" />
                <span className="tab-label">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* View Mode Switcher */}
        <div className="header-view-mode-toggle" aria-label="Workspace View Mode">
          <span className="view-mode-label">Layout:</span>
          <div className="view-mode-buttons">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'split' ? 'active' : ''}`}
              onClick={() => onChangeViewMode('split')}
              title="Split View (Dashboard + Copilot side by side)"
            >
              <Columns size={13} />
              <span>Split</span>
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'dashboard' ? 'active' : ''}`}
              onClick={() => onChangeViewMode('dashboard')}
              title="Dashboard Focus (Full Width Visuals)"
            >
              <LayoutDashboard size={13} />
              <span>Analytics</span>
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'chat' ? 'active' : ''}`}
              onClick={() => onChangeViewMode('chat')}
              title="AI Chat Focus (Full Width Copilot)"
            >
              <MessageSquare size={13} />
              <span>Copilot</span>
            </button>
          </div>
        </div>
      </nav>
    </header>
  );
};
