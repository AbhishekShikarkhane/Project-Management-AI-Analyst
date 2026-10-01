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
  Wand2,
} from 'lucide-react';

interface HeaderProps {
  datasetName: string;
  recordCount: number;
  hasApiKey: boolean;
  onOpenDataset: () => void;
  onOpenUpload: () => void;
  onGenerateLiveData: () => void;
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
  onOpenDataset,
  onOpenUpload,
  onGenerateLiveData,
  isGenerating = false,
  onOpenApiKey,
  onClearChat,
  onExportReport,
  messageCount,
}) => {
  return (
    <header className="app-header">
      <div className="brand-wrapper">
        <div className="brand-logo-icon">
          <Bot size={24} />
        </div>
        <div className="brand-info">
          <h1>
            PM Insight Engine
            <span className="brand-badge">Strict Grounding</span>
          </h1>
          <div className="brand-subtitle">
            <Sparkles size={12} color="#A5B4FC" />
            <span>Project Management Intelligence Platform</span>
          </div>
        </div>
      </div>

      <div className="header-actions">
        {/* Generate Live Data Button */}
        <button
          id="btn-generate-live-data"
          type="button"
          className="btn-icon"
          disabled={isGenerating}
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.16) 0%, rgba(6, 182, 212, 0.16) 100%)',
            borderColor: 'rgba(16, 185, 129, 0.45)',
            color: '#A7F3D0',
            fontWeight: 600,
          }}
          onClick={onGenerateLiveData}
          title="Fetch 30 AI-generated project tasks with randomized budgets, progress & blockers"
        >
          {isGenerating ? (
            <>
              <span className="pulse-dot" style={{ backgroundColor: '#10B981' }} />
              <span>Generating AI Data...</span>
            </>
          ) : (
            <>
              <Sparkles size={14} color="#34D399" />
              <span>Generate Live Data</span>
            </>
          )}
        </button>

        {/* Upload Dataset Button */}
        <button
          id="btn-upload-dataset"
          type="button"
          className="btn-icon"
          style={{ background: 'rgba(99, 102, 241, 0.15)', borderColor: 'rgba(99, 102, 241, 0.35)', color: '#C7D2FE' }}
          onClick={onOpenUpload}
          title="Upload custom CSV or JSON dataset"
        >
          <UploadCloud size={14} color="#818CF8" />
          <span>Upload Data</span>
        </button>

        {/* Dataset Pill */}
        <button
          id="btn-dataset-pill"
          type="button"
          className="dataset-pill"
          onClick={onOpenDataset}
          title="Click to inspect raw dataset records & statistics"
        >
          <span className="pulse-dot" />
          <Database size={14} />
          <span>
            {datasetName || 'Project Management '}
            {recordCount > 0 && ` [${recordCount}]`}
          </span>
        </button>

        {/* API Key Config */}
        <button
          id="btn-api-key"
          type="button"
          className={`btn-icon ${hasApiKey ? 'active' : ''}`}
          onClick={onOpenApiKey}
          title="Configure Gemini API Key"
        >
          <Key size={14} />
          <span>{hasApiKey ? 'API Key Active' : 'Set API Key'}</span>
        </button>

        {/* Export Analysis */}
        {messageCount > 0 && (
          <button
            id="btn-export-chat"
            type="button"
            className="btn-icon"
            onClick={onExportReport}
            title="Export full analysis session as a Markdown report"
          >
            <Download size={14} />
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
            title="Clear current conversation"
          >
            <Trash2 size={14} />
            <span>Clear</span>
          </button>
        )}
      </div>
    </header>
  );
};
