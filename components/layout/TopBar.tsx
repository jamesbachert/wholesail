'use client';

import { Sun, Moon, Bell, Search, MapPin, ChevronDown, Check, X } from 'lucide-react';
import { useTheme } from '@/components/shared/ThemeProvider';
import { useRegion } from '@/components/shared/RegionProvider';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { GlobalSearchResults, type SearchResults } from './GlobalSearchResults';

export function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const { activeRegion, regions, setActiveRegion, loading: regionLoading } = useRegion();
  const router = useRouter();

  const [searchFocused, setSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController>(undefined);

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

  // Outside-click dismiss for search dropdown
  useEffect(() => {
    if (!showResults) return;
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showResults]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Compute total navigable items for keyboard nav
  const getTotalItems = useCallback(() => {
    if (!searchResults) return 0;
    let count = searchResults.leads.length + searchResults.discovery.length;
    if (searchResults.counts.leads > searchResults.leads.length) count++; // "view all leads"
    if (searchResults.counts.discovery > searchResults.discovery.length) count++; // "view all discovery"
    return count;
  }, [searchResults]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setActiveIndex(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setSearchResults(null);
      setShowResults(false);
      setSearchLoading(false);
      return;
    }

    setShowResults(true);
    setSearchLoading(true);

    debounceRef.current = setTimeout(async () => {
      // Cancel any in-flight request
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();

      try {
        const params = new URLSearchParams();
        params.set('q', value.trim());
        if (activeRegion?.slug) params.set('region', activeRegion.slug);

        const res = await fetch(`/api/search?${params.toString()}`, {
          signal: abortRef.current!.signal,
        });

        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          console.error('Search error:', err);
        }
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setShowResults(false);
    setActiveIndex(-1);
  };

  const handleSelect = (type: 'lead' | 'discovery', id: string, address: string) => {
    clearSearch();
    if (type === 'lead') {
      router.push(`/leads/${id}`);
    } else {
      // Discovery has no detail page — navigate with search pre-filled
      router.push(`/discovery?search=${encodeURIComponent(address)}`);
    }
  };

  const handleViewAll = (type: 'leads' | 'discovery') => {
    const q = searchQuery;
    clearSearch();
    if (type === 'leads') {
      router.push(`/leads?search=${encodeURIComponent(q)}`);
    } else {
      router.push(`/discovery?search=${encodeURIComponent(q)}`);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setShowResults(false);
      return;
    }

    if (!showResults || !searchResults) return;

    const totalItems = getTotalItems();
    if (totalItems === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, totalItems - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();

      // Figure out what the active index maps to
      let idx = 0;
      // Leads
      for (let i = 0; i < searchResults.leads.length; i++) {
        if (activeIndex === idx) {
          handleSelect('lead', searchResults.leads[i].id, searchResults.leads[i].address);
          return;
        }
        idx++;
      }
      // View all leads
      if (searchResults.counts.leads > searchResults.leads.length) {
        if (activeIndex === idx) {
          handleViewAll('leads');
          return;
        }
        idx++;
      }
      // Discovery
      for (let i = 0; i < searchResults.discovery.length; i++) {
        if (activeIndex === idx) {
          handleSelect('discovery', searchResults.discovery[i].id, searchResults.discovery[i].address);
          return;
        }
        idx++;
      }
      // View all discovery
      if (searchResults.counts.discovery > searchResults.discovery.length) {
        if (activeIndex === idx) {
          handleViewAll('discovery');
          return;
        }
      }
    }
  };

  return (
    <header
      className="h-16 shrink-0 flex items-center justify-between px-4 md:px-6 border-b"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-primary)',
      }}
    >
      {/* Search */}
      <div className="flex items-center gap-3 flex-1 max-w-md relative" ref={searchRef}>
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
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => {
              setSearchFocused(true);
              // Re-show results if we have them
              if (searchQuery.length >= 2 && searchResults) {
                setShowResults(true);
              }
            }}
            onBlur={() => setSearchFocused(false)}
            onKeyDown={handleKeyDown}
          />
          {searchQuery && (
            <button
              onMouseDown={(e) => {
                e.preventDefault(); // prevent input blur
                clearSearch();
              }}
              className="p-0.5 rounded transition-colors duration-150 hover:bg-[var(--bg-primary)]"
              style={{ color: 'var(--text-tertiary)' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {showResults && (
          <GlobalSearchResults
            results={searchResults}
            loading={searchLoading}
            query={searchQuery}
            activeIndex={activeIndex}
            onSelect={handleSelect}
            onViewAll={handleViewAll}
          />
        )}
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
