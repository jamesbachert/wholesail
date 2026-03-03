'use client';

import { Sun, Moon, Bell, Search, MapPin, ChevronDown, Check } from 'lucide-react';
import { useTheme } from '@/components/shared/ThemeProvider';
import { useRegion } from '@/components/shared/RegionProvider';
import { useState, useRef, useEffect } from 'react';

export function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const { activeRegion, regions, setActiveRegion, loading: regionLoading } = useRegion();
  const [searchFocused, setSearchFocused] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);

  // Outside-click dismiss for region dropdown
  useEffect(() => {
    if (!regionOpen) return;
    function handleClick(e: MouseEvent) {
      if (regionRef.current && !regionRef.current.contains(e.target as Node)) {
        setRegionOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [regionOpen]);

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
        {/* Region dropdown */}
        <div className="relative hidden md:block" ref={regionRef}>
          <button
            onClick={() => setRegionOpen(!regionOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 hover:bg-[var(--bg-elevated)]"
            style={{
              backgroundColor: regionOpen ? 'var(--bg-elevated)' : 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
            }}
          >
            <MapPin size={14} style={{ color: 'var(--brand-deep)' }} />
            {regionLoading ? 'Loading...' : activeRegion?.name || 'Select Region'}
            <ChevronDown
              size={12}
              style={{
                color: 'var(--text-tertiary)',
                transform: regionOpen ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform 0.2s',
              }}
            />
          </button>

          {regionOpen && regions.length > 0 && (
            <div
              className="absolute right-0 top-full mt-1 w-64 rounded-lg border shadow-lg z-50 overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-primary)',
              }}
            >
              <div
                className="px-3 py-2 border-b text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-subtle)' }}
              >
                Workspace Region
              </div>
              {regions.map((region) => {
                const isActive = activeRegion?.slug === region.slug;
                return (
                  <button
                    key={region.slug}
                    onClick={() => {
                      setActiveRegion(region);
                      setRegionOpen(false);
                    }}
                    className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-[var(--bg-elevated)]"
                    style={{
                      color: isActive ? 'var(--brand-deep)' : 'var(--text-primary)',
                      backgroundColor: isActive ? 'rgba(10, 126, 140, 0.08)' : undefined,
                    }}
                  >
                    <MapPin
                      size={14}
                      style={{ color: isActive ? 'var(--brand-deep)' : 'var(--text-tertiary)' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{region.name}</p>
                      <p
                        className="text-[10px] mt-0.5"
                        style={{ color: 'var(--text-tertiary)' }}
                      >
                        {region.state} · {region.counties.join(', ')}
                      </p>
                    </div>
                    {isActive && (
                      <Check size={14} style={{ color: 'var(--brand-deep)' }} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
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
