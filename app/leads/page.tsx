'use client';

import { Suspense, useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  Search,
  ArrowUpDown,
  AlertTriangle,
  Download,
  Send,
  Loader2,
  Plus,
  Archive,
  ChevronLeft,
  ChevronRight,
  Info,
} from 'lucide-react';
import { AddLeadModal } from '@/components/leads/AddLeadModal';
import { BulkEnrichDialog } from '@/components/leads/BulkEnrichDialog';
import { StreetViewButton } from '@/components/leads/StreetViewModal';
import { useApi, apiPatch } from '@/lib/hooks';
import { useRegion } from '@/components/shared/RegionProvider';
import {
  getScoreColorHex,
  getStatusLabel,
  getSignalTagColor,
  shortenSignalLabel,
  formatCurrency,
  timeAgo,
} from '@/lib/mockData';
import { AdvancedFilters, emptyFilters } from '@/components/leads/AdvancedFilters';
import type { Filters, FilterOptions } from '@/components/leads/AdvancedFilters';

type SortField = 'totalScore' | 'createdAt' | 'lastActivityAt' | 'lastContacted' | 'estimatedValue';
type SortDir = 'asc' | 'desc';

const statusFilters = ['ALL', 'NEW_FILTER', 'COLD', 'CONTACTED', 'WARM', 'HOT', 'UNDER_CONTRACT', 'HANDED_OFF', 'CLOSED', 'ARCHIVE'];

const FILTERS_STORAGE_KEY = 'wholesail-leads-filters';

export default function LeadsPage() {
  return (
    <Suspense>
      <LeadsPageInner />
    </Suspense>
  );
}

function LeadsPageInner() {
  const { activeRegion } = useRegion();
  const regionSlug = activeRegion?.slug || '';
  const urlSearchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(urlSearchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('totalScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [advancedFilters, setAdvancedFilters] = useState<Filters>(emptyFilters);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ cities: [], zipCodes: [] });
  const [showAddLead, setShowAddLead] = useState(false);
  const [showBulkEnrich, setShowBulkEnrich] = useState(false);
  const [showBulkEnrichAll, setShowBulkEnrichAll] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [filtersRestored, setFiltersRestored] = useState(false);

  // Sync searchQuery from URL when navigating from global search
  const urlSearch = urlSearchParams.get('search') || '';
  useEffect(() => {
    if (urlSearch && urlSearch !== searchQuery) {
      setSearchQuery(urlSearch);
      setCurrentPage(1);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlSearch]);

  // Restore filters from localStorage after hydration
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FILTERS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.statusFilter) setStatusFilter(parsed.statusFilter);
        if (parsed.advancedFilters) setAdvancedFilters({ ...emptyFilters, ...parsed.advancedFilters });
      }
    } catch {}
    setFiltersRestored(true);
  }, []);

  // Persist filters to localStorage (only after initial restore)
  useEffect(() => {
    if (!filtersRestored) return;
    localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify({ statusFilter, advancedFilters }));
  }, [statusFilter, advancedFilters, filtersRestored]);

  // Build API URL with all filters (wait for localStorage restore to avoid race condition)
  const apiUrl = useMemo(() => {
    if (!filtersRestored) return null; // Don't fetch until filters are restored
    const params = new URLSearchParams();
    if (regionSlug) params.set('region', regionSlug);
    params.set('sortBy', sortField);
    params.set('sortDir', sortDir);

    if (statusFilter === 'NEW_FILTER') {
      params.set('isNew', 'true');
    } else if (statusFilter !== 'ALL') {
      params.set('status', statusFilter);
    }
    if (searchQuery) params.set('search', searchQuery);

    // Advanced filters
    if (advancedFilters.createdFrom) params.set('createdFrom', advancedFilters.createdFrom);
    if (advancedFilters.createdTo) params.set('createdTo', advancedFilters.createdTo);
    if (advancedFilters.activityFrom) params.set('activityFrom', advancedFilters.activityFrom);
    if (advancedFilters.activityTo) params.set('activityTo', advancedFilters.activityTo);
    if (advancedFilters.signals.length > 0) params.set('signals', advancedFilters.signals.join(','));
    if (advancedFilters.cities.length > 0) params.set('cities', advancedFilters.cities.join(','));
    if (advancedFilters.zipCodes.length > 0) params.set('zipCodes', advancedFilters.zipCodes.join(','));
    if (advancedFilters.minScore) params.set('minScore', advancedFilters.minScore);
    if (advancedFilters.maxScore) params.set('maxScore', advancedFilters.maxScore);
    if (advancedFilters.minArv) params.set('minArv', advancedFilters.minArv);
    if (advancedFilters.maxArv) params.set('maxArv', advancedFilters.maxArv);
    if (advancedFilters.timeSensitive) params.set('timeSensitive', 'true');
    if (advancedFilters.needsReview) params.set('needsReview', 'true');
    if (advancedFilters.hasPhone) params.set('hasPhone', 'true');
    if (advancedFilters.priority) params.set('priority', advancedFilters.priority);
    if (advancedFilters.minCodeViolations) params.set('minCodeViolations', advancedFilters.minCodeViolations);

    params.set('page', String(currentPage));
    params.set('limit', '50');

    return `/api/leads?${params.toString()}`;
  }, [regionSlug, sortField, sortDir, statusFilter, searchQuery, advancedFilters, currentPage]);

  const { data: liveData, loading, refetch } = useApi<any>(apiUrl);

  // Update filter options from API response
  useEffect(() => {
    if (liveData?.filterOptions) {
      setFilterOptions(liveData.filterOptions);
    }
  }, [liveData]);

  // Get leads from API
  const allLeads = useMemo(() => {
    if (!liveData) return [];
    return (liveData.leads || []).map((lead: any) => ({
      ...lead,
      signals: lead.signals || [],
      contactHistory: lead.contacts || [],
    }));
  }, [liveData]);

  const totalCount = liveData ? liveData.total : allLeads.length;
  const newLeadThresholdDays = liveData?.newLeadThresholdDays || 14;
  const newCutoffMs = Date.now() - newLeadThresholdDays * 86400000;
  const totalPages = liveData?.totalPages || 1;

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
    setCurrentPage(1);
    setSelectedLeads(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === allLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(allLeads.map((l: any) => l.id)));
    }
  };

  const handleBulkArchive = async () => {
    if (!confirm(`Archive ${selectedLeads.size} lead${selectedLeads.size > 1 ? 's' : ''}?`)) return;
    setArchiving(true);
    try {
      await Promise.all(
        Array.from(selectedLeads).map((leadId) =>
          apiPatch(`/api/leads/${leadId}`, { status: 'ARCHIVE' })
        )
      );
      setSelectedLeads(new Set());
      refetch();
    } catch (err) {
      console.error('Failed to archive leads:', err);
    } finally {
      setArchiving(false);
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedLeads(new Set());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getProp = (lead: any) => lead.property || lead;

  const sortLabel = sortField === 'totalScore' ? 'score' :
    sortField === 'createdAt' ? 'created date' :
    sortField === 'lastActivityAt' ? 'last activity' :
    sortField === 'lastContacted' ? 'last contacted' : 'value';

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--text-primary)' }}>
            Leads
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {loading ? 'Loading...' : `${totalCount} leads`}{totalPages > 1 ? ` · page ${currentPage} of ${totalPages}` : ''} · sorted by {sortLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedLeads.size > 0 && (
            <>
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{selectedLeads.size} selected</span>
              <button onClick={() => setShowBulkEnrich(true)} className="ws-btn-primary text-xs"><Search size={14} /> Enrich</button>
              <button className="ws-btn-secondary text-xs"><Send size={14} /> Hand Off</button>
              <button className="ws-btn-secondary text-xs"><Download size={14} /> Export</button>
              <button
                onClick={handleBulkArchive}
                disabled={archiving}
                className="ws-btn-secondary text-xs"
                style={{ color: 'var(--warning)' }}
              >
                {archiving ? <Loader2 size={14} className="animate-spin" /> : <Archive size={14} />}
                Archive
              </button>
            </>
          )}
          <button
            onClick={() => setShowBulkEnrichAll(true)}
            className="ws-btn-secondary text-xs flex items-center gap-1.5"
          >
            <Search size={14} />
            Enrich All
          </button>
          <button
            onClick={() => setShowAddLead(true)}
            className="ws-btn-primary text-xs flex items-center gap-1.5"
          >
            <Plus size={14} />
            Add Lead
          </button>
        </div>
      </div>

      {/* Search + Status Filters */}
      <div className="ws-card p-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div
            className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg border"
            style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-primary)' }}
          >
            <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              placeholder="Search address, owner, zip..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); setSelectedLeads(new Set()); }}
              className="bg-transparent text-sm outline-none flex-1"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {statusFilters.map((s) => {
              const isNewFilter = s === 'NEW_FILTER';
              const isActive = statusFilter === s;
              return (
                <button
                  key={s}
                  onClick={() => { setStatusFilter(s); setCurrentPage(1); setSelectedLeads(new Set()); }}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                  style={
                    isActive
                      ? isNewFilter
                        ? { backgroundColor: 'rgba(59, 130, 246, 0.15)', color: '#3B82F6', border: '1px solid rgba(59, 130, 246, 0.3)' }
                        : { backgroundColor: 'var(--brand-deep)', color: '#fff' }
                      : isNewFilter
                        ? { color: '#3B82F6', backgroundColor: 'var(--bg-elevated)', border: '1px solid transparent' }
                        : { color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }
                  }
                >
                  {s === 'ALL' ? 'All' : isNewFilter ? 'New' : getStatusLabel(s)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
      <AdvancedFilters
        filters={advancedFilters}
        onChange={(f: Filters) => { setAdvancedFilters(f); setCurrentPage(1); setSelectedLeads(new Set()); }}
        filterOptions={filterOptions}
      />

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'var(--text-secondary)' }}>
          <Loader2 size={16} className="animate-spin" /> Loading leads...
        </div>
      )}

      {/* Leads Table */}
      {!loading && (
        <div className="ws-card overflow-hidden">
          {/* Table Header */}
          <div
            className="hidden md:grid grid-cols-[40px_48px_1fr_28px_140px_120px_100px_100px] gap-3 px-5 py-3 text-xs font-semibold border-b"
            style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-elevated)' }}
          >
            <div className="flex items-center">
              <input type="checkbox" checked={selectedLeads.size === allLeads.length && allLeads.length > 0} onChange={toggleSelectAll} className="rounded" />
            </div>
            <button onClick={() => toggleSort('totalScore')} className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
              Score <ArrowUpDown size={12} />
            </button>
            <div>Property / Owner</div>
            <div></div>
            <div>Signals</div>
            <button onClick={() => toggleSort('estimatedValue')} className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
              Value <ArrowUpDown size={12} />
            </button>
            <button onClick={() => toggleSort('createdAt')} className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
              Created <ArrowUpDown size={12} />
            </button>
            <div>Stage</div>
          </div>

          {/* Table Rows */}
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {allLeads.map((lead: any) => {
              const prop = getProp(lead);
              const signals = lead.signals || [];
              const created = lead.createdAt || lead.firstDiscovered;

              const isNewLead = !lead.firstViewedAt || new Date(lead.createdAt).getTime() > newCutoffMs;

              return (
                <div key={lead.id} className="ws-table-row">
                  {/* Desktop Row */}
                  <div className="hidden md:grid grid-cols-[40px_48px_1fr_28px_140px_120px_100px_100px] gap-3 px-5 py-3.5 items-center">
                    <div>
                      <input type="checkbox" checked={selectedLeads.has(lead.id)} onChange={() => toggleSelect(lead.id)} className="rounded" />
                    </div>
                    <Link href={`/leads/${lead.id}`}>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: getScoreColorHex(lead.totalScore) }}>
                        {lead.totalScore}
                      </div>
                    </Link>
                    <Link href={`/leads/${lead.id}`} className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{prop.address}</p>
                        {isNewLead && <span className="ws-tag ws-tag-info text-[10px] shrink-0">New</span>}
                        {lead.isTimeSensitive && <AlertTriangle size={14} style={{ color: 'var(--danger)' }} className="shrink-0" />}
                        {lead.needsReview && !lead.needsReviewDismissedAt && <Info size={14} style={{ color: 'var(--warning)' }} className="shrink-0" />}
                      </div>
                      <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                        {prop.city}, {prop.state} {prop.zipCode} · {prop.ownerName || '—'}
                      </p>
                    </Link>
                    <div>
                      <StreetViewButton
                        address={prop.address}
                        city={prop.city}
                        state={prop.state}
                        zipCode={prop.zipCode}
                        latitude={prop.latitude}
                        longitude={prop.longitude}
                        size={14}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {signals.slice(0, 2).map((s: any, i: number) => (
                        <span key={i} className={`ws-tag ws-tag-${getSignalTagColor(s.signalType)} text-[10px]`}>{shortenSignalLabel(s.label)}</span>
                      ))}
                      {signals.length > 2 && <span className="ws-tag ws-tag-neutral text-[10px]">+{signals.length - 2}</span>}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(prop.estimatedValue || 0)}</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{formatCurrency(prop.estimatedEquity || 0)} equity</p>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{created ? timeAgo(created) : '—'}</p>
                    </div>
                    <div>
                      <span className={`ws-status ws-status-${lead.status.toLowerCase()} text-xs`} style={{ color: 'var(--text-secondary)' }}>
                        {getStatusLabel(lead.status)}
                      </span>
                    </div>
                  </div>

                  {/* Mobile Card */}
                  <Link href={`/leads/${lead.id}`} className="flex md:hidden items-start gap-3 px-4 py-3.5">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 mt-0.5" style={{ backgroundColor: getScoreColorHex(lead.totalScore) }}>
                      {lead.totalScore}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{prop.address}</p>
                        {isNewLead && <span className="ws-tag ws-tag-info text-[10px] shrink-0">New</span>}
                        {lead.isTimeSensitive && <AlertTriangle size={12} style={{ color: 'var(--danger)' }} className="shrink-0" />}
                        {lead.needsReview && !lead.needsReviewDismissedAt && <Info size={12} style={{ color: 'var(--warning)' }} className="shrink-0" />}
                      </div>
                      <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                        {prop.city} · {prop.ownerName || '—'} · {formatCurrency(prop.estimatedValue || 0)}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {signals.slice(0, 3).map((s: any, i: number) => (
                          <span key={i} className={`ws-tag ws-tag-${getSignalTagColor(s.signalType)} text-[10px]`}>{shortenSignalLabel(s.label)}</span>
                        ))}
                      </div>
                    </div>
                    <span className="text-[10px] shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                      {created ? timeAgo(created) : ''}
                    </span>
                  </Link>
                </div>
              );
            })}
          </div>

          {allLeads.length === 0 && !loading && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                No leads match your filters. Try adjusting your search or filters.
              </p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div
              className="flex items-center justify-between px-5 py-3 border-t"
              style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-elevated)' }}
            >
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {((currentPage - 1) * 50) + 1}–{Math.min(currentPage * 50, totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <ChevronLeft size={16} />
                </button>
                {(() => {
                  // Show up to 5 page buttons centered around current page
                  const pages: number[] = [];
                  let start = Math.max(1, currentPage - 2);
                  let end = Math.min(totalPages, start + 4);
                  start = Math.max(1, end - 4);
                  for (let i = start; i <= end; i++) pages.push(i);
                  return pages.map((p) => (
                    <button
                      key={p}
                      onClick={() => handlePageChange(p)}
                      className="w-8 h-8 rounded-lg text-xs font-medium transition-colors"
                      style={
                        p === currentPage
                          ? { backgroundColor: 'var(--brand-deep)', color: '#fff' }
                          : { color: 'var(--text-secondary)' }
                      }
                    >
                      {p}
                    </button>
                  ));
                })()}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 rounded-lg transition-colors disabled:opacity-30"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Add Lead Modal */}
      {showAddLead && (
        <AddLeadModal
          onClose={() => setShowAddLead(false)}
          onLeadCreated={() => refetch()}
        />
      )}
      {/* Bulk Enrich Dialog (selected leads) */}
      {showBulkEnrich && (
        <BulkEnrichDialog
          leads={allLeads.filter((l: any) => selectedLeads.has(l.id)).map((l: any) => ({
            id: l.id,
            property: {
              zipCode: l.property?.zipCode || '',
              address: l.property?.address || '',
              city: l.property?.city || '',
            },
          }))}
          onClose={() => setShowBulkEnrich(false)}
          onComplete={() => {
            setShowBulkEnrich(false);
            setSelectedLeads(new Set());
            refetch();
          }}
        />
      )}
      {/* Bulk Enrich All Dialog */}
      {showBulkEnrichAll && (
        <BulkEnrichDialog
          leads={[]}
          enrichAll
          totalLeadCount={totalCount}
          regionSlug={regionSlug}
          onClose={() => setShowBulkEnrichAll(false)}
          onComplete={() => {
            setShowBulkEnrichAll(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}
