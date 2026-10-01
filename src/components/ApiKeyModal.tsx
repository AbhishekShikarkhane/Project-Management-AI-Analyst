'use client';

import React, { useState, useEffect } from 'react';
import { Key, X, Check, ExternalLink, ShieldCheck } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveKey: (key: string) => void;
  currentKey: string;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  onSaveKey,
  currentKey,
}) => {
  const [keyInput, setKeyInput] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    setKeyInput(currentKey || '');
  }, [currentKey, isOpen]);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveKey(keyInput.trim());
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-modal-title"
      >
        <div className="modal-header">
          <div className="modal-title" id="api-modal-title">
            <Key size={18} color="#818CF8" />
            <span>Gemini API Configuration</span>
          </div>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave}>
          <p
            style={{
              fontSize: '0.84rem',
              color: '#94A3B8',
              lineHeight: 1.5,
              marginBottom: 16,
            }}
          >
            Enter your Google Gemini API Key. The key is used by the backend to
            query the model strictly against the local{' '}
            <code style={{ color: '#38BDF8' }}>"Project Management "</code> dataset.
          </p>

          <div className="form-group">
            <label className="form-label" htmlFor="apiKeyInput">
              Gemini API Key:
            </label>
            <input
              id="apiKeyInput"
              type="password"
              className="form-input"
              placeholder="AIzaSy..."
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              autoFocus
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 20,
              fontSize: '0.78rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                color: '#64748B',
              }}
            >
              <ShieldCheck size={14} color="#10B981" />
              <span>Sent via encrypted HTTPS header</span>
            </div>

            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#818CF8',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span>Get Free Key</span>
              <ExternalLink size={12} />
            </a>
          </div>

          <button
            id="btn-save-key"
            type="submit"
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {savedSuccess ? (
              <>
                <Check size={16} />
                <span>Key Saved!</span>
              </>
            ) : (
              <span>Save & Connect</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
