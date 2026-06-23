'use client';

import { useState, useRef, useEffect, useId } from 'react';

export interface SelectOption {
  value: string;
  label: string;
  group?: string;
  disabled?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  value?: string | string[];
  onChange?: (value: string | string[]) => void;
  placeholder?: string;
  multiple?: boolean;
  searchable?: boolean;
  disabled?: boolean;
  label?: string;
}

export default function Select({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  multiple = false,
  searchable = false,
  disabled = false,
  label,
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const ref = useRef<HTMLDivElement>(null);

  const selected = multiple
    ? (Array.isArray(value) ? value : [])
    : (typeof value === 'string' ? value : '');

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase()),
  );

  const allFiltered = filtered;

  const groups = Array.from(new Set(filtered.map((o) => o.group ?? ''))).filter(Boolean);
  const ungrouped = filtered.filter((o) => !o.group);

  const isSelected = (val: string) =>
    multiple ? (selected as string[]).includes(val) : selected === val;

  const toggle = (val: string) => {
    if (multiple) {
      const arr = selected as string[];
      const next = arr.includes(val) ? arr.filter((v) => v !== val) : [...arr, val];
      onChange?.(next);
    } else {
      onChange?.(val);
      setOpen(false);
    }
  };

  const displayLabel = multiple
    ? (selected as string[]).length
      ? (selected as string[]).map((v) => options.find((o) => o.value === v)?.label ?? v).join(', ')
      : placeholder
    : options.find((o) => o.value === selected)?.label ?? placeholder;

  const triggerId = useId();
  const listboxId = `select-listbox-${triggerId}`;

  function handleTriggerKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'Enter':
      case ' ':
      case 'ArrowDown':
        e.preventDefault();
        setOpen(true);
        setActiveIndex(0);
        break;
    }
  }

  function handleListboxKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, allFiltered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        if (activeIndex >= 0 && allFiltered[activeIndex] && !allFiltered[activeIndex].disabled) {
          toggle(allFiltered[activeIndex].value);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
        break;
    }
  }

  const renderOption = (opt: SelectOption) => {
    const idx = allFiltered.indexOf(opt);
    const isFocused = idx === activeIndex;
    return (
      <button
        key={opt.value}
        id={`select-option-${opt.value}`}
        type="button"
        role="option"
        aria-selected={isSelected(opt.value)}
        disabled={opt.disabled}
        onClick={() => !opt.disabled && toggle(opt.value)}
        className={`w-full text-left px-3 py-1.5 text-sm rounded flex items-center gap-2 transition-colors ${
          opt.disabled
            ? 'opacity-40 cursor-not-allowed'
            : isSelected(opt.value)
            ? 'bg-brand/10 text-brand font-medium'
            : isFocused
            ? 'bg-gray-100 dark:bg-gray-700'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200'
        }`}
      >
        {multiple && (
          <span className={`h-3.5 w-3.5 rounded border ${isSelected(opt.value) ? 'bg-brand border-brand' : 'border-gray-300'}`} />
        )}
        {opt.label}
      </button>
    );
  };

  return (
    <div ref={ref} className="relative flex flex-col gap-1">
      {label && (
        <label htmlFor={triggerId} className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <button
        id={triggerId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleTriggerKeyDown}
        className="flex h-9 w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate">{displayLabel}</span>
        <svg className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800">
          {searchable && (
            <div className="p-2 border-b border-gray-100 dark:border-gray-700">
              <input
                autoFocus
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search…"
                className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </div>
          )}
          <div
            id={listboxId}
            role="listbox"
            aria-label={label || 'Options'}
            onKeyDown={handleListboxKeyDown}
            className="max-h-52 overflow-y-auto p-1"
          >
            {ungrouped.map(renderOption)}
            {groups.map((group) => (
              <div key={group} role="group" aria-label={group}>
                <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">{group}</p>
                {filtered.filter((o) => o.group === group).map(renderOption)}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">No options found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
