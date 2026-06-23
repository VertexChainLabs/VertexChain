'use client';

import { ReactNode, useRef, useState, useCallback } from 'react';

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: Tab[];
  defaultTab?: string;
  onChange?: (id: string) => void;
}

export default function Tabs({ tabs, defaultTab, onChange }: TabsProps) {
  const [active, setActive] = useState(defaultTab ?? tabs[0]?.id);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  function select(id: string) {
    setActive(id);
    onChange?.(id);
  }

  const current = tabs.find((t) => t.id === active);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, index: number) => {
      const enabledTabs = tabs.filter((t) => !t.disabled);
      const currentEnabledIdx = enabledTabs.findIndex((t) => t.id === active);
      let nextIdx: number | undefined;

      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault();
          nextIdx = (currentEnabledIdx + 1) % enabledTabs.length;
          break;
        case 'ArrowLeft':
          e.preventDefault();
          nextIdx = (currentEnabledIdx - 1 + enabledTabs.length) % enabledTabs.length;
          break;
        case 'Home':
          e.preventDefault();
          nextIdx = 0;
          break;
        case 'End':
          e.preventDefault();
          nextIdx = enabledTabs.length - 1;
          break;
      }

      if (nextIdx !== undefined) {
        const nextTab = enabledTabs[nextIdx];
        select(nextTab.id);
        const tabIndex = tabs.findIndex((t) => t.id === nextTab.id);
        tabRefs.current[tabIndex]?.focus();
      }
    },
    [tabs, active, onChange],
  );

  return (
    <div>
      <div
        role="tablist"
        aria-label="Tabs"
        className="flex border-b border-gray-200 dark:border-gray-700"
      >
        {tabs.map((tab, index) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              ref={(el) => { tabRefs.current[index] = el; }}
              role="tab"
              tabIndex={isActive ? 0 : -1}
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              disabled={tab.disabled}
              onClick={() => !tab.disabled && select(tab.id)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={[
                'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors focus:outline-none',
                isActive
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
                tab.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {current && (
        <div
          id={`tabpanel-${current.id}`}
          role="tabpanel"
          aria-labelledby={current.id}
          className="pt-4"
        >
          {current.content}
        </div>
      )}
    </div>
  );
}
