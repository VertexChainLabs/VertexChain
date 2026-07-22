'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  deleteBookmark,
  getBookmarks,
  renameBookmark,
  saveBookmark,
  type Bookmark,
} from '@/lib/bookmarks';

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export default function BookmarkButton() {
  const pathname = usePathname();
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(() => setBookmarks(getBookmarks()), []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isBookmarked = pathname ? bookmarks.some((b) => b.url === pathname) : false;

  const toggleBookmark = () => {
    if (!pathname) return;
    if (isBookmarked) {
      const existing = bookmarks.find((b) => b.url === pathname);
      if (existing) {
        deleteBookmark(existing.id);
        refresh();
      }
    } else {
      const pageName =
        pathname === '/'
          ? 'Overview'
          : pathname.slice(1).replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      saveBookmark({ name: pageName, url: pathname });
      refresh();
    }
  };

  const handleRename = (id: string) => {
    if (renameValue.trim()) {
      renameBookmark(id, renameValue.trim());
      refresh();
    }
    setRenaming(null);
    setRenameValue('');
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      {/* Star toggle */}
      <button
        type="button"
        onClick={toggleBookmark}
        title={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
        className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
          isBookmarked
            ? 'border-amber-300 bg-amber-50 text-amber-500 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400'
            : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
        }`}
        aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
      >
        <StarIcon filled={isBookmarked} />
      </button>

      {/* Dropdown trigger */}
      {bookmarks.length > 0 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          title="Saved bookmarks"
          className="ml-1 flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 px-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          aria-haspopup="true"
          aria-expanded={open}
        >
          {bookmarks.length}
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* Dropdown panel */}
      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            zIndex: 60,
            minWidth: 280,
            background: '#ffffff',
            borderRadius: 16,
            border: '1px solid #e2e8f0',
            boxShadow: '0 16px 40px rgba(15,23,42,0.14)',
            padding: '10px 0',
          }}
        >
          <div
            style={{
              padding: '6px 14px 10px',
              fontSize: 11,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: '#94a3b8',
            }}
          >
            Saved views
          </div>

          {bookmarks.map((bookmark) => (
            <div
              key={bookmark.id}
              role="menuitem"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 14px',
              }}
            >
              {renaming === bookmark.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => handleRename(bookmark.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(bookmark.id);
                    if (e.key === 'Escape') { setRenaming(null); setRenameValue(''); }
                  }}
                  style={{
                    flex: 1,
                    borderRadius: 8,
                    border: '1px solid #6366f1',
                    padding: '4px 8px',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              ) : (
                <a
                  href={bookmark.url}
                  style={{
                    flex: 1,
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#1e293b',
                    textDecoration: 'none',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => setOpen(false)}
                >
                  {bookmark.name}
                </a>
              )}

              {/* Rename */}
              <button
                type="button"
                title="Rename"
                onClick={() => { setRenaming(bookmark.id); setRenameValue(bookmark.name); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 2 }}
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>

              {/* Delete */}
              <button
                type="button"
                title="Delete"
                onClick={() => { deleteBookmark(bookmark.id); refresh(); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171', padding: 2 }}
              >
                <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
