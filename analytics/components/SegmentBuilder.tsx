'use client';

import { useMemo, useState } from 'react';
import { estimateSize, newCondition, MOCK_USERS, type Condition, type Segment } from '@/lib/segment-data';

export type { Condition, Segment };
export { estimateSize, exportSegmentCsv } from '@/lib/segment-data';
import ConditionRow from '@/components/ConditionRow';

interface SegmentBuilderProps {
  onSave?: (segment: Segment) => void;
}

export function SegmentBuilder({ onSave }: SegmentBuilderProps) {
  const [segment, setSegment] = useState<Segment>({
    id: 'new',
    name: 'New Segment',
    conditions: [],
    logic: 'AND',
  });
  const [saved, setSaved] = useState(false);

  const previewSize = useMemo(
    () => estimateSize(segment.conditions, segment.logic),
    [segment.conditions, segment.logic],
  );

  function updateCondition(id: string, updated: Condition) {
    setSegment((s) => ({ ...s, conditions: s.conditions.map((c) => (c.id === id ? updated : c)) }));
    setSaved(false);
  }

  function removeCondition(id: string) {
    setSegment((s) => ({ ...s, conditions: s.conditions.filter((c) => c.id !== id) }));
    setSaved(false);
  }

  function handleSave() {
    const finalSegment = { ...segment, id: segment.id === 'new' ? Math.random().toString(36).slice(2) : segment.id };
    setSaved(true);
    onSave?.(finalSegment);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-semibold dark:border-gray-700 dark:bg-gray-800 dark:text-white"
          value={segment.name}
          onChange={(e) => { setSegment((s) => ({ ...s, name: e.target.value })); setSaved(false); }}
        />
        <select
          className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
          value={segment.logic}
          onChange={(e) => { setSegment((s) => ({ ...s, logic: e.target.value as 'AND' | 'OR' })); setSaved(false); }}
        >
          <option value="AND">Match ALL (AND)</option>
          <option value="OR">Match ANY (OR)</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Preview: <strong className="text-indigo-600 dark:text-indigo-400">{previewSize}</strong> / {MOCK_USERS.length} users
          </span>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {segment.conditions.map((c) => (
          <ConditionRow
            key={c.id}
            condition={c}
            onChange={(updated) => updateCondition(c.id, updated)}
            onRemove={() => removeCondition(c.id)}
          />
        ))}
        {segment.conditions.length === 0 && (
          <p className="text-sm text-gray-400 py-2">No conditions — matches all users.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setSegment((s) => ({ ...s, conditions: [...s.conditions, newCondition()] })); setSaved(false); }}
          className="rounded-lg border border-dashed border-indigo-300 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 dark:border-indigo-700 dark:text-indigo-400 dark:hover:bg-indigo-950 transition-colors"
        >
          + Add Condition
        </button>
        <button
          onClick={handleSave}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          {saved ? '✓ Saved' : 'Save Segment'}
        </button>
      </div>
    </div>
  );
}
