'use client';

import React, { useState } from 'react';
import { User, Bot, Copy, Check, ShieldCheck, Sparkles } from 'lucide-react';
import { ChatMessage } from '@/lib/gemini';

interface MessageItemProps {
  message: ChatMessage & {
    id: string;
    timestamp?: string;
    sourceFileName?: string;
    highlight_ids?: string[];
  };
  onHighlightClick?: (id: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({ message, onHighlightClick }) => {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /**
   * Lightweight, robust parser for Markdown formatting into React elements:
   * Supports: Markdown tables, headers, lists, code blocks, bold, blockquotes.
   */
  const renderFormattedMarkdown = (text: string) => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let inTable = false;
    let tableRows: string[][] = [];
    let inCodeBlock = false;
    let codeContent: string[] = [];

    const flushTable = (key: number) => {
      if (tableRows.length > 0) {
        const header = tableRows[0];
        const bodyRows = tableRows.slice(1).filter((r) => !r.every((c) => c.match(/^:?-+:?$/)));
        elements.push(
          <div key={`table-${key}`} className="table-wrapper">
            <table>
              <thead>
                <tr>
                  {header.map((th, hIdx) => (
                    <th key={hIdx}>{renderInlineMarkdown(th)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx}>{renderInlineMarkdown(cell)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
        tableRows = [];
      }
      inTable = false;
    };

    const flushCode = (key: number) => {
      elements.push(
        <pre key={`code-${key}`}>
          <code>{codeContent.join('\n')}</code>
        </pre>
      );
      codeContent = [];
      inCodeBlock = false;
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();

      // Handle code block ```
      if (trimmed.startsWith('```')) {
        if (inCodeBlock) {
          flushCode(index);
        } else {
          if (inTable) flushTable(index);
          inCodeBlock = true;
        }
        return;
      }

      if (inCodeBlock) {
        codeContent.push(line);
        return;
      }

      // Handle Markdown tables: lines with pipes
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableRows = [];
        }
        const cells = trimmed
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        tableRows.push(cells);
        return;
      } else if (inTable) {
        flushTable(index);
      }

      // Handle Headers
      if (trimmed.startsWith('### ')) {
        elements.push(<h3 key={index}>{renderInlineMarkdown(trimmed.slice(4))}</h3>);
        return;
      }
      if (trimmed.startsWith('## ')) {
        elements.push(<h2 key={index}>{renderInlineMarkdown(trimmed.slice(3))}</h2>);
        return;
      }
      if (trimmed.startsWith('# ')) {
        elements.push(<h1 key={index}>{renderInlineMarkdown(trimmed.slice(2))}</h1>);
        return;
      }

      // Blockquotes
      if (trimmed.startsWith('> ')) {
        elements.push(
          <blockquote key={index}>
            {renderInlineMarkdown(trimmed.slice(2))}
          </blockquote>
        );
        return;
      }

      // Bullet lists
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        elements.push(
          <ul key={index}>
            <li>{renderInlineMarkdown(trimmed.slice(2))}</li>
          </ul>
        );
        return;
      }

      // Numbered lists
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        elements.push(
          <ol key={index} start={Number(numMatch[1])}>
            <li>{renderInlineMarkdown(numMatch[2])}</li>
          </ol>
        );
        return;
      }

      // Regular paragraph or blank line
      if (trimmed === '') {
        elements.push(<div key={index} style={{ height: 6 }} />);
      } else {
        elements.push(<p key={index}>{renderInlineMarkdown(line)}</p>);
      }
    });

    if (inTable) flushTable(lines.length);
    if (inCodeBlock) flushCode(lines.length);

    return elements;
  };

  /**
   * Helper to parse bold, inline code, task IDs, and links
   */
  const renderInlineMarkdown = (text: string): React.ReactNode => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i}>{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  return (
    <div className={`message-row ${isUser ? 'user' : 'assistant'}`}>
      <div className={`avatar ${isUser ? 'user-avatar' : 'assistant-avatar'}`}>
        {isUser ? <User size={18} /> : <Bot size={18} />}
      </div>

      <div className="message-bubble">
        <div className="bubble-meta">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="analyst-badge">
              {isUser ? 'You' : 'PM Insight Engine'}
            </span>
            {!isUser && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '0.68rem',
                  color: '#34D399',
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '1px 6px',
                  borderRadius: 4,
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}
              >
                <ShieldCheck size={11} />
                <span>Dataset Grounded</span>
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {message.timestamp && <span>{message.timestamp}</span>}
            <button
              type="button"
              className="copy-btn"
              onClick={handleCopy}
              title="Copy message text"
            >
              {copied ? <Check size={12} color="#34D399" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        <div className={isUser ? '' : 'analyst-content'}>
          {isUser ? (
            <p style={{ whiteSpace: 'pre-wrap' }}>{message.content}</p>
          ) : (
            renderFormattedMarkdown(message.content)
          )}
        </div>

        {/* Sync Highlight IDs Strip */}
        {!isUser && message.highlight_ids && message.highlight_ids.length > 0 && (
          <div
            style={{
              marginTop: '12px',
              paddingTop: '10px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '6px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.72rem',
                color: '#A5B4FC',
                fontWeight: 600,
              }}
            >
              <Sparkles size={12} color="#818CF8" />
              <span>Chart Sync Highlights:</span>
            </div>

            {message.highlight_ids.map((id) => (
              <button
                key={id}
                type="button"
                className="task-id-badge"
                style={{
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  border: '1px solid rgba(99, 102, 241, 0.4)',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: '#C7D2FE',
                }}
                onClick={() => onHighlightClick?.(id)}
                title="Click to toggle highlight on charts"
              >
                {id}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
