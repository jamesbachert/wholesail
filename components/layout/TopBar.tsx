'use client';

import { Sun, Moon, Bell, Search, MapPin, Database, Zap } from 'lucide-react';
import { useTheme } from '@/components/shared/ThemeProvider';
import { useDataMode } from '@/components/shared/DataModeProvider';
import { useState } from 'react';

export function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const { dataMode, toggleDataMode, isLive } = useDataMode();
  const [searchFocused, setSearchFocused] = useState(false);

  return (
    <header
      className="h-16 shrink-0 flex items-center justify-between px-4 md:px-6 border-b"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-primary)',
      }}
    >
      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        <div
          className={`flex items-center gap-2 flex-1 px-3 py-2 rounded-lg border transition-all duration-200 ${
            searchFocused ? 'ring-2' : ''
          }`}
          style={{
            backgroundColor: 'var(--bg-elevated)',
            borderColor: searchFocused ? 'var(--brand-deep)' : 'var(--border-primary)',
            ...(searchFocused ? { '--tw-ring-color': 'rgba(10, 126, 140, 0.15)' } as any : {}),
          }}
        >
          <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search leads, addresses, owners..."
            className="bg-transparent text-sm outline-none flex-1"
            style={{ color: 'var(--text-primary)' }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </div>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-2">
        {/* Data Mode Toggle */}
        <button
          onClick={toggleDataMode}
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
          style={{
            backgroundColor: isLive ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-elevated)',
            color: isLive ? 'var(--success)' : 'var(--text-secondary)',
            border: isLive ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid transparent',
          }}
          title={`Switch to ${isLive ? 'mock' : 'live'} data`}
        >
          {isLive ? <Zap size={14} /> : <Database size={14} />}
          {isLive ? 'Live DB' : 'Mock Data'}
        </button>

        {/* Region indicator */}
        <div
          className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
          style={{
            backgroundColor: 'var(--bg-elevated)',
            color: 'var(--text-secondary)',
          }}
        >
          <MapPin size={14} style={{ color: 'var(--brand-deep)' }} />
          Lehigh Valley
        </div>

        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg transition-colors duration-200 hover:bg-[var(--bg-elevated)]"
          style={{ color: 'var(--text-secondary)' }}
          title="Notifications"
        >
          <Bell size={20} />
          {/* Notification dot */}
          <span className="notification-dot" />
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg transition-all duration-200 hover:bg-[var(--bg-elevated)]"
          style={{ color: 'var(--text-secondary)' }}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>

        {/* User avatar placeholder */}
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ml-1"
          style={{ background: 'linear-gradient(135deg, var(--brand-deep), var(--brand-ocean))' }}
        >
          U
        </div>
      </div>
    </header>
  );
}
