'use client';

import React, { useRef, useEffect } from 'react';
import { Bot, Database, Sparkles, ShieldCheck } from 'lucide-react';
import { MessageItem } from './MessageItem';
import { ChatMessage } from '@/lib/gemini';
import { DatasetInfo } from '@/lib/dataset';

export interface ExtendedMessage extends ChatMessage {
  id: string;
  timestamp: string;
  sourceFileName?: string;
  highlight_ids?: string[];
}

interface MessageListProps {
  messages: ExtendedMessage[];
  isLoading: boolean;
  datasetName: string;
  recordCount: number;
  totalBudget: number;
  avgProgress: number;
  blockedCount: number;
  onSelectPrompt: (prompt: string) => void;
  onHighlightClick?: (id: string) => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  datasetName,
  recordCount,
  totalBudget,
  avgProgress,
  blockedCount,
  onSelectPrompt,
  onHighlightClick,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="messages-container">
      {messages.length === 0 ? (
        <div className="welcome-hero">
          <div className="welcome-icon-glow">
            <Bot size={32} />
          </div>
          <h2>Project Management AI Analyst</h2>
          <p>
            Connected to{' '}
            <strong style={{ color: '#38BDF8' }}>
              "{datasetName || 'Project Management '}"
            </strong>
            . Ask questions about project milestones, departmental progress,
            budgets, critical blockers, or workload distribution. The Analyst will
            answer and automatically highlight matching tasks on the live charts!
          </p>

          <div className="welcome-meta-chips">
            <div className="meta-chip">
              <Database size={13} color="#10B981" />
              <span>
                <strong>{recordCount}</strong> Tasks Loaded
              </span>
            </div>
            <div className="meta-chip">
              <span>
                Budget: <strong>${(totalBudget || 0).toLocaleString()}</strong>
              </span>
            </div>
            <div className="meta-chip">
              <span>
                Avg Progress: <strong>{avgProgress}%</strong>
              </span>
            </div>
            <div className="meta-chip">
              <span>
                Blocked Tasks:{' '}
                <strong style={{ color: '#FB7185' }}>{blockedCount}</strong>
              </span>
            </div>
            <div className="meta-chip">
              <ShieldCheck size={13} color="#6366F1" />
              <span>Strict Grounding Active</span>
            </div>
          </div>
        </div>
      ) : (
        messages.map((msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            onHighlightClick={onHighlightClick}
          />
        ))
      )}

      {/* Typing / Analysis Indicator */}
      {isLoading && (
        <div className="message-row assistant">
          <div className="avatar assistant-avatar">
            <Bot size={18} />
          </div>
          <div className="message-bubble" style={{ width: 'auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.82rem',
                color: '#A5B4FC',
              }}
            >
              <div className="typing-indicator">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
              <span>PM Insight Engine is querying dataset & calculating metrics...</span>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};
