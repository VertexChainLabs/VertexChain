'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import BookmarkButton from '@/components/ui/BookmarkButton';
import SearchBar from '@/components/ui/SearchBar';
import KeyboardShortcuts from '@/components/ui/KeyboardShortcuts';
import HeaderLogo from '@/components/Header';
import {
  OverviewIcon,
  UsersIcon,
  GeoIcon,
  ExportIcon,
  ErrorsIcon,
  SegmentsIcon,
  WordCloudIcon,
  CollabIcon,
  MenuIcon,
  CloseIcon,
  SunIcon,
  MoonIcon,
} from '@/components/ui/icons';

// ── Nav config ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Overview',      href: '/',              icon: OverviewIcon },
  { label: 'Users',         href: '/users',          icon: UsersIcon },
  { label: 'Geographic',    href: '/geographic',     icon: GeoIcon },
  { label: 'Export',        href: '/export',         icon: ExportIcon },
  { label: 'Errors',        href: '/errors',         icon: ErrorsIcon },
  { label: 'Segments',      href: '/segments',       icon: SegmentsIcon },
  { label: 'Word Cloud',    href: '/word-cloud',     icon: WordCloudIcon },
  { label: 'Collaboration', href: '/collaboration',  icon: CollabIcon },
] as const;

const DATE_RANGES = ['7D', '30D', '90D', '1Y'] as const;
type DateRange = typeof DATE_RANGES[number];

// ── Props ─────────────────────────────────────────────────────────────────────

interface LayoutProps {
  children: React.ReactNode;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname();
  const router = useRouter();

  // Sidebar: expanded (lg default) or icon-only
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  // Mobile drawer open state
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Dark mode
  const [dark, setDark] = useState(false);
  // Selected date range
  const [dateRange, setDateRange] = useState<DateRange>('30D');
  // Search open state (controlled by keyboard shortcut)
  const [searchOpen, setSearchOpen] = useState(false);

  // Initialise dark mode from storage / system preference
  useEffect(() => {
    const stored = localStorage.getItem('vertexchain-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored === 'dark' || (!stored && prefersDark);
    setDark(isDark);
    document.documentElement.classList.toggle('dark', isDark);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const toggleDark = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      document.documentElement.classList.toggle('dark', next);
      localStorage.setItem('vertexchain-theme', next ? 'dark' : 'light');
      return next;
    });
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarExpanded((v) => !v);
  }, []);

  // Keyboard shortcut: E → navigate to export page
  const handleExport = useCallback(() => {
    router.push('/export');
  }, [router]);

  // ── Sidebar content (shared between desktop + mobile drawer) ──────────────

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <HeaderLogo expanded={sidebarExpanded || mobile} />

      {/* Divider */}
      <div className="mx-3 mb-2 h-px bg-gray-100 dark:bg-gray-800" />

      {/* Nav label */}
      {(sidebarExpanded || mobile) && (
        <p className="mb-1 px-4 text-[10px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
          Navigation
        </p>
      )}

      {/* Nav items */}
      <nav className="flex-1 space-y-0.5 px-2">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`nav-link group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                !sidebarExpanded && !mobile ? 'justify-center px-2' : ''
              } ${
                active
                  ? 'nav-active bg-indigo-50 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
              }`}
              title={!sidebarExpanded && !mobile ? label : undefined}
            >
              <span className="shrink-0">
                <Icon size={18} />
              </span>
              {(sidebarExpanded || mobile) && (
                <span className="truncate">{label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: collapse toggle (desktop only) */}
      {!mobile && (
        <div className="border-t border-gray-100 p-2 dark:border-gray-800">
          <button
            onClick={toggleSidebar}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label={sidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`transition-transform duration-200 ${sidebarExpanded ? '' : 'rotate-180'}`}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            {sidebarExpanded && <span>Collapse</span>}
          </button>
        </div>
      )}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      {/* ── Desktop sidebar ──────────────────────────────────────────────────── */}
      <aside
        className={`sidebar-transition hidden shrink-0 overflow-hidden border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:flex lg:flex-col ${
          sidebarExpanded ? 'lg:w-56' : 'lg:w-16'
        }`}
      >
        <SidebarContent />
      </aside>

      {/* ── Mobile drawer overlay ────────────────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile drawer panel ──────────────────────────────────────────────── */}
      <aside
        aria-label="Mobile navigation"
        className={`sidebar-transition fixed inset-y-0 left-0 z-50 w-64 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 lg:hidden ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-end p-2">
          <button
            onClick={() => setDrawerOpen(false)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close menu"
          >
            <CloseIcon size={20} />
          </button>
        </div>
        <SidebarContent mobile />
      </aside>

      {/* ── Main column ──────────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Header */}
        <header className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900 sm:px-6">

          {/* Mobile hamburger */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden"
            aria-label="Open menu"
          >
            <MenuIcon />
          </button>

          {/* Page title — derived from current nav item */}
          <h1 className="text-sm font-semibold text-gray-900 dark:text-white sm:text-base">
            {NAV_ITEMS.find((n) => n.href === pathname)?.label ?? 'Dashboard'}
          </h1>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            {/* Search bar (issue #155) */}
            <SearchBar open={searchOpen} onClose={() => setSearchOpen(false)} />

            {/* Date range selector */}
            <div className="flex items-center rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-700 dark:bg-gray-800">
              {DATE_RANGES.map((range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                    dateRange === range
                      ? 'bg-white text-indigo-600 shadow-sm dark:bg-gray-700 dark:text-indigo-400'
                      : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  {range}
                </button>
              ))}
            </div>

            {/* Bookmark button */}
            <BookmarkButton />

            {/* Dark mode toggle */}
            <button
              onClick={toggleDark}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? <SunIcon /> : <MoonIcon />}
            </button>

            {/* User avatar */}
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400">
                GP
              </div>
              <span className="hidden text-sm font-medium text-gray-700 dark:text-gray-300 sm:block">
                Admin
              </span>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>

      {/* Keyboard shortcuts (issue #152) */}
      <KeyboardShortcuts
        onSearch={() => setSearchOpen(true)}
        onToggleDark={toggleDark}
        onExport={handleExport}
      />
    </div>
  );
}
