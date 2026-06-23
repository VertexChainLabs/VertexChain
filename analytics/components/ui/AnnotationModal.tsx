'use client';

import { useState, useEffect, useRef } from 'react';
import type { Annotation } from '@/lib/annotations';

interface AnnotationModalProps {
  initial?: Annotation;
  defaultDate?: string;
  onSave: (text: string, date: string) => void;
  onClose: () => void;
}

export default function AnnotationModal({ initial, defaultDate = '', onSave, onClose }: AnnotationModalProps) {
  const [text, setText] = useState(initial?.text ?? '');
  const [date, setDate] = useState(initial?.date ?? defaultDate);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus trap: save and restore focus
  useEffect(() => {
    previousFocusRef.current = document.activeElement as HTMLElement;
    setTimeout(() => {
      const firstFocusable = modalRef.current?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      firstFocusable?.focus();
    }, 50);
    return () => {
      previousFocusRef.current?.focus();
    };
  }, []);

  // Keyboard: Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="annotation-modal-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15,23,42,0.5)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 70,
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        ref={modalRef}
        style={{
          background: '#ffffff',
          borderRadius: 20,
          padding: '24px',
          width: 'min(400px, 100%)',
          boxShadow: '0 24px 60px rgba(15,23,42,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="annotation-modal-title" style={{ margin: '0 0 18px', fontSize: 20 }}>
          {initial ? 'Edit annotation' : 'Add annotation'}
        </h2>

        <label style={{ display: 'grid', gap: 6, marginBottom: 14 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Date</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Annotation date"
            style={{ borderRadius: 10, border: '1px solid #cbd5e1', padding: '10px 12px', fontSize: 14 }}
          />
        </label>

        <label style={{ display: 'grid', gap: 6, marginBottom: 20 }}>
          <span style={{ fontSize: 13, fontWeight: 700 }}>Note</span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder="Describe this event…"
            aria-label="Annotation note"
            style={{
              borderRadius: 10,
              border: '1px solid #cbd5e1',
              padding: '10px 12px',
              fontSize: 14,
              resize: 'vertical',
              fontFamily: 'inherit',
            }}
          />
        </label>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 10,
              background: '#f8fafc',
              padding: '10px 16px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { if (text.trim() && date) onSave(text.trim(), date); }}
            style={{
              border: 'none',
              borderRadius: 10,
              background: '#6366f1',
              color: '#ffffff',
              padding: '10px 16px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
