'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ChartErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Chart component error caught by ChartErrorBoundary:', error, errorInfo);
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          className="chart-card chart-error-boundary"
          style={{
            padding: '32px 20px',
            textAlign: 'center',
            background: 'rgba(239, 68, 68, 0.06)',
            borderRadius: '10px',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            margin: '8px 0',
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '12px',
            }}
          >
            <AlertTriangle size={22} color="#EF4444" />
          </div>
          <h4 style={{ color: '#F1F5F9', fontSize: '0.92rem', margin: '0 0 6px 0', fontWeight: 600 }}>
            {this.props.fallbackTitle || 'Unable to Render Visualization'}
          </h4>
          <p style={{ color: '#94A3B8', fontSize: '0.78rem', margin: '0 0 16px 0', maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto' }}>
            No tasks match the selected filters, or data format is unexpected. Adjust your criteria or clear filters.
          </p>
          <button
            type="button"
            className="btn-icon"
            onClick={this.handleReset}
            style={{
              margin: '0 auto',
              background: 'rgba(255, 255, 255, 0.08)',
              borderColor: 'rgba(255, 255, 255, 0.15)',
              color: '#F8FAFC',
              fontSize: '0.76rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
            }}
          >
            <RefreshCw size={13} />
            <span>Reset View</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
