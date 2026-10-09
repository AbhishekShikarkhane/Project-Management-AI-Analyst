'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Sparkles,
  AlertCircle,
  LayoutDashboard,
  MessageSquare,
  Columns,
  RefreshCw,
} from 'lucide-react';
import { Header, ActiveSection } from './Header';
import { MessageList, ExtendedMessage } from './MessageList';
import { QuickSuggestions } from './QuickSuggestions';
import { DatasetDrawer } from './DatasetDrawer';
import { ApiKeyModal } from './ApiKeyModal';
import { DataUploadModal } from './DataUploadModal';
import { VisualDashboard } from './VisualDashboard';
import { useData } from '@/context/DataContext';

export const ChatInterface: React.FC = () => {
  const {
    dataset,
    fileName,
    summary,
    highlightIds,
    setHighlightIds,
    clearHighlights,
    toggleHighlightId,
    generateLiveData,
    loadPortfolioData,
    refreshFromDatabase,
    clearDataset,
    isGenerating,
  } = useData();

  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Workspace active view section & layout mode
  const [activeSection, setActiveSection] = useState<ActiveSection>('overview');
  const [viewMode, setViewMode] = useState<'split' | 'dashboard' | 'chat'>('split');

  // Modals & Drawers
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);

  // Layout mode for responsive screens: 'split' | 'visuals' | 'chat'
  const [mobileView, setMobileView] = useState<'split' | 'visuals' | 'chat'>('split');

  // API Key management
  const [apiKey, setApiKey] = useState<string>('');

  // Selected Gemini Model (gemini-3.5-flash default, supported & fast)
  const [selectedModel, setSelectedModel] = useState('gemini-3.5-flash');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load saved API key from localStorage if exists
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key_analyst');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    if (key) {
      localStorage.setItem('gemini_api_key_analyst', key);
    } else {
      localStorage.removeItem('gemini_api_key_analyst');
    }
    setErrorMessage(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        160
      )}px`;
    }
  };

  // Submit query to Gemini analyst API
  const handleSubmit = async (e?: React.FormEvent, overrideText?: string) => {
    if (e) e.preventDefault();
    const queryText = (overrideText || inputValue).trim();
    if (!queryText || isLoading) return;

    setErrorMessage(null);
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const userMessage: ExtendedMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: queryText,
      timestamp: timeString,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
    setIsLoading(true);

    try {
      const history = messages.slice(-6).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        headers['x-gemini-api-key'] = apiKey;
      }

      // Send the current dynamic dataset array in the body
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: queryText,
          dataset,
          history,
          model: selectedModel,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data?.code === 'AUTH_REQUIRED') {
          setIsApiKeyModalOpen(true);
          setErrorMessage(
            'A Gemini API Key is required to perform data analysis. Please enter your API key.'
          );
        } else {
          setErrorMessage(data?.error || 'Failed to complete analysis.');
        }
        return;
      }

      // Extract answer safely using prioritized field resolution and JSON unwrapping (Priority 1)
      let textResponse = '';
      if (typeof data.answer === 'string' && data.answer.trim()) {
        textResponse = data.answer.trim();
      } else if (typeof data.text_response === 'string' && data.text_response.trim()) {
        textResponse = data.text_response.trim();
      } else if (typeof data.response === 'string' && data.response.trim()) {
        textResponse = data.response.trim();
      } else if (typeof data === 'string') {
        textResponse = data.trim();
      }

      // If textResponse looks like serialized or unclosed JSON, unwrap the inner answer
      if (
        textResponse.includes('"text_response"') ||
        textResponse.includes('"answer"') ||
        textResponse.startsWith('{')
      ) {
        try {
          const parsed = JSON.parse(textResponse);
          if (parsed && typeof parsed.answer === 'string') {
            textResponse = parsed.answer;
          } else if (parsed && typeof parsed.text_response === 'string') {
            textResponse = parsed.text_response;
          }
        } catch {
          const markerMatch = textResponse.match(/"(?:text_response|answer)"\s*:\s*"/);
          if (markerMatch && markerMatch.index !== undefined) {
            const startIndex = markerMatch.index + markerMatch[0].length;
            let extracted = textResponse.slice(startIndex);
            const endMatch = extracted.match(/"(?:\s*,\s*"highlight_ids"|\s*\}|\s*$)/);
            if (endMatch && endMatch.index !== undefined) {
              extracted = extracted.slice(0, endMatch.index);
            } else if (extracted.endsWith('"}') || extracted.endsWith('"\n}')) {
              extracted = extracted.replace(/"\s*\}\s*$/, '');
            } else if (extracted.endsWith('"')) {
              extracted = extracted.slice(0, -1);
            }
            textResponse = extracted;
          } else if (textResponse.startsWith('{') && textResponse.endsWith('}')) {
            textResponse = textResponse.slice(1, -1).trim();
          }
        }
      }

      // Convert any literal \n and \" sequences if present
      if (textResponse.includes('\\n')) {
        textResponse = textResponse.replace(/\\n/g, '\n');
      }
      if (textResponse.includes('\\"')) {
        textResponse = textResponse.replace(/\\"/g, '"');
      }
      if (textResponse.includes('\\r')) {
        textResponse = textResponse.replace(/\\r/g, '');
      }

      const returnedHighlightIds: string[] = Array.isArray(data.highlight_ids)
        ? data.highlight_ids
        : [];

      // Update global highlight IDs for cross-filtering charts and tables!
      if (returnedHighlightIds.length > 0) {
        setHighlightIds(returnedHighlightIds);
      }

      const analystMessage: ExtendedMessage = {
        id: `analyst-${Date.now()}`,
        role: 'assistant',
        content: textResponse,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sourceFileName: data.meta?.sourceFileName || fileName,
        highlight_ids: returnedHighlightIds,
      };

      setMessages((prev) => [...prev, analystMessage]);
    } catch (err: any) {
      console.error('Submit query error:', err);
      setErrorMessage(err?.message || 'Network error connecting to the Gemini backend.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleExportReport = () => {
    if (messages.length === 0) return;
    const dateStr = new Date().toISOString().split('T')[0];
    let report = `# PM Insight Engine — Data Analysis Report\n`;
    report += `**Generated**: ${new Date().toLocaleString()}\n`;
    report += `**Active Dataset**: ${fileName}\n`;
    report += `**Total Records**: ${dataset.length}\n`;
    report += `**Total Budget**: $${summary.totalBudget.toLocaleString()}\n`;
    report += `**Total Spend**: $${summary.totalSpend.toLocaleString()}\n\n---\n\n`;

    messages.forEach((m) => {
      const author = m.role === 'user' ? '### 👤 User Query' : '### 🤖 PM Insight Engine';
      report += `${author} (${m.timestamp})\n\n${m.content}\n\n`;
      if (m.highlight_ids && m.highlight_ids.length > 0) {
        report += `*Highlighted Tasks: ${m.highlight_ids.join(', ')}*\n\n`;
      }
      report += `---\n\n`;
    });

    const blob = new Blob([report], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `PM_Insight_Engine_Analysis_${dateStr}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app-workspace-layout min-h-screen w-full">
      {/* Top Header & Navigation */}
      <Header
        datasetName={fileName}
        recordCount={dataset.length}
        hasApiKey={Boolean(apiKey)}
        activeSection={activeSection}
        onSelectSection={(section) => {
          setActiveSection(section);
          if (section === 'chat') {
            setViewMode('chat');
          } else if (viewMode === 'chat') {
            setViewMode('split');
          }
        }}
        viewMode={viewMode}
        onChangeViewMode={setViewMode}
        onOpenUpload={() => setIsUploadModalOpen(true)}
        onGenerateLiveData={generateLiveData}
        onLoadPortfolio={() => loadPortfolioData(150)}
        onResetDashboard={() => {
          clearDataset();
          clearHighlights();
          setMessages([]);
        }}
        isGenerating={isGenerating}
        onOpenDataset={() => setIsDrawerOpen(true)}
        onOpenApiKey={() => setIsApiKeyModalOpen(true)}
        onClearChat={() => {
          setMessages([]);
          clearHighlights();
        }}
        onExportReport={handleExportReport}
        messageCount={messages.length}
      />

        {/* Main Content: Flexible Dashboard + Copilot Panels */}
        <div className={`main-content-split ${viewMode === 'dashboard' ? 'single-dashboard' : ''} ${viewMode === 'chat' ? 'single-chat' : ''}`}>
          {/* Left Column: Visual Dashboard */}
          <section
            aria-label="Real-time Visualizations"
            style={{
              display: viewMode === 'split' || viewMode === 'dashboard' ? 'flex' : 'none',
              flex: viewMode === 'dashboard' ? '1 1 100%' : undefined,
              flexDirection: 'column',
              minWidth: 0,
            }}
          >
            <VisualDashboard
              onOpenUpload={() => setIsUploadModalOpen(true)}
              activeSection={activeSection}
            />
          </section>

          {/* Right Column: AI Chat Analyst Copilot */}
          <main
            className="chat-main"
            style={{
              margin: 0,
              display: viewMode === 'split' || viewMode === 'chat' ? 'flex' : 'none',
              flex: viewMode === 'chat' ? '1 1 100%' : undefined,
              maxWidth: viewMode === 'chat' ? '100%' : undefined,
            }}
          >
          {/* Statusbar */}
          <div className="chat-statusbar">
            <div className="status-indicator">
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: '#10B981',
                  display: 'inline-block',
                }}
              />
              <span>Dataset:</span>
              <span className="status-badge-file">"{fileName}"</span>
              {highlightIds.length > 0 && (
                <span
                  style={{
                    color: '#818CF8',
                    fontWeight: 600,
                    marginLeft: 6,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Sparkles size={11} />
                  <span>{highlightIds.length} synced</span>
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#64748B' }}>Model:</span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#CBD5E1',
                  fontSize: '0.74rem',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                <option value="gemini-3.5-flash">Gemini 3.5 Flash (Recommended)</option>
                <option value="gemini-flash-latest">Gemini Flash Latest</option>
                <option value="gemini-3.8-flash">Gemini 3.8 Flash</option>
                <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
              </select>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div
              style={{
                padding: '10px 20px',
                background: 'rgba(244, 63, 94, 0.12)',
                borderBottom: '1px solid rgba(244, 63, 94, 0.3)',
                color: '#FDA4AF',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={16} color="#FB7185" style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
              {!apiKey && (
                <button
                  type="button"
                  className="btn-icon"
                  style={{
                    background: 'rgba(244, 63, 94, 0.2)',
                    borderColor: 'rgba(244, 63, 94, 0.4)',
                    color: '#FFFFFF',
                    padding: '3px 10px',
                  }}
                  onClick={() => setIsApiKeyModalOpen(true)}
                >
                  Enter API Key
                </button>
              )}
            </div>
          )}

          {/* Messages Scrollable List */}
          <MessageList
            messages={messages}
            isLoading={isLoading}
            datasetName={fileName}
            recordCount={dataset.length}
            totalBudget={summary.totalBudget}
            avgProgress={summary.avgProgress}
            blockedCount={summary.blockedCount}
            onSelectPrompt={(p) => handleSubmit(undefined, p)}
            onHighlightClick={(id) => toggleHighlightId(id)}
          />

          {/* Quick Analytical Suggestions */}
          <QuickSuggestions
            onSelectQuery={(q) => handleSubmit(undefined, q)}
            disabled={isLoading}
          />

          {/* Input Bar */}
          <div className="chat-input-bar">
            <div className="input-container">
              <textarea
                ref={textareaRef}
                id="chat-textarea"
                className="chat-textarea"
                rows={1}
                placeholder="Ask anything about the project dataset (e.g. 'Which tasks are blocked?', 'Compare budget vs spend')..."
                value={inputValue}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={isLoading}
              />
            </div>

            <button
              id="chat-send-btn"
              type="button"
              className="send-button"
              disabled={!inputValue.trim() || isLoading}
              onClick={() => handleSubmit()}
              aria-label="Send query"
            >
              <Send size={18} />
            </button>
          </div>
        </main>
      </div>

      {/* Dataset Drawer */}
      <DatasetDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />

      {/* Dynamic Data Upload Modal */}
      <DataUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
      />

      {/* API Key Modal */}
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        onSaveKey={handleSaveApiKey}
        currentKey={apiKey}
      />
    </div>
  );
};
