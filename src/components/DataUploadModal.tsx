'use client';

import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  FileCode,
  X,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { useData } from '@/context/DataContext';

interface DataUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DataUploadModal: React.FC<DataUploadModalProps> = ({ isOpen, onClose }) => {
  const { uploadDatasetFromContent, resetToDefault, fileName, dataset } = useData();
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const processFile = (file: File) => {
    setErrorMsg(null);
    setSuccessInfo(null);

    const validExtensions = ['.csv', '.json', '.txt', '.tsv'];
    const lowerName = file.name.toLowerCase();
    const hasValidExt = validExtensions.some((ext) => lowerName.endsWith(ext));

    if (!hasValidExt && !file.type.includes('text') && !file.type.includes('json')) {
      setErrorMsg('Please upload a valid CSV, JSON, or plain-text delimited dataset.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (!content || !content.trim()) {
        setErrorMsg('The selected file is empty.');
        return;
      }

      const success = uploadDatasetFromContent(content, file.name, file.size);
      if (success) {
        setSuccessInfo(`Successfully imported "${file.name}"!`);
        setTimeout(() => {
          onClose();
          setSuccessInfo(null);
        }, 1200);
      } else {
        setErrorMsg('Could not parse structured tasks from this file. Ensure it has header columns or JSON array format.');
      }
    };
    reader.onerror = () => {
      setErrorMsg('Error reading file.');
    };
    reader.readAsText(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 560 }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-header">
          <div className="modal-title">
            <UploadCloud size={20} color="#818CF8" />
            <span>Upload Dynamic Dataset</span>
          </div>
          <button type="button" className="close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontSize: '0.84rem', color: '#94A3B8', marginBottom: 16 }}>
          Upload any project CSV or JSON file. The dashboard charts, metrics, and PM Insight Engine
          will automatically bind to your uploaded dataset in real-time.
        </p>

        {/* Drag and Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragActive ? 'var(--accent-primary)' : 'rgba(255,255,255,0.15)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '36px 20px',
            textAlign: 'center',
            backgroundColor: dragActive ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            marginBottom: 16,
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.json,.txt,.tsv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: 'rgba(99,102,241,0.15)',
              color: '#818CF8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 12px auto',
            }}
          >
            <UploadCloud size={28} />
          </div>
          <div style={{ fontWeight: 600, color: '#F8FAFC', marginBottom: 4 }}>
            Drag & drop your file here, or browse
          </div>
          <div style={{ fontSize: '0.76rem', color: '#64748B' }}>
            Supports .CSV, .JSON, .TSV (Task ID, Title, Status, Budget, Spend, Owner, etc.)
          </div>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(244,63,94,0.15)',
              border: '1px solid rgba(244,63,94,0.3)',
              color: '#FDA4AF',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 14,
            }}
          >
            <AlertTriangle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successInfo && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(16,185,129,0.15)',
              border: '1px solid rgba(16,185,129,0.3)',
              color: '#6EE7B7',
              fontSize: '0.8rem',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 14,
            }}
          >
            <CheckCircle2 size={15} />
            <span>{successInfo}</span>
          </div>
        )}

        {/* Current Dataset Info & Reset */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.78rem',
          }}
        >
          <div>
            <span style={{ color: '#94A3B8' }}>Currently Loaded: </span>
            <strong style={{ color: '#38BDF8' }}>"{fileName}"</strong>
            <span style={{ color: '#64748B' }}> ({dataset.length} tasks)</span>
          </div>

          <button
            type="button"
            className="btn-icon"
            onClick={() => {
              resetToDefault();
              setSuccessInfo('Restored default Project Management dataset.');
              setTimeout(() => {
                setSuccessInfo(null);
                onClose();
              }, 900);
            }}
            title="Restore default local Project Management file"
          >
            <RotateCcw size={13} />
            <span>Reset to Default</span>
          </button>
        </div>
      </div>
    </div>
  );
};
