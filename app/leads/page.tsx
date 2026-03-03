'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  Search,
  ArrowUpDown,
  AlertTriangle,
  Download,
  Send,
  Loader2,
  Plus,
} from 'lucide-react';
import { AddLeadModal } from '@/components/leads/AddLeadModal';
import { useApi } from '@/lib/hooks';
import {
  getScoreColorHex,
  getStatusLabel,
  getSignalTagColor,
  formatCurrency,
  timeAgo,
} from '@/lib/mockData';
import { AdvancedFilters, emptyFilters } from '@/components/leads/AdvancedFilters';
import type { Filters, FilterOptions } from '@/components/leads/AdvancedFilters';

type SortField = 'totalScore' | 'createdAt' | 'lastActivityAt' | 'lastContacted' | 'estimatedValue';
type SortDir = 'asc' | 'desc';

const statusFilters = ['ALL', 'NEW', 'CONTACTED', 'WARM', 'HOT', 'UNDER_CONTRACT', 'HANDED_OFF', 'CLOSED', 'DEAD'];

export default function LeadsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('totalScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [advancedFilters, setAdvancedFilters] = useState<Filters>(emptyFilters);
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({ cities: [], zipCodes: [] });
  const [showAddLead, setShowAddLead] = useState(false);

  // Build API URL with all filters
  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('sortBy', sortField);
    params.set('sortDir', sortDir);

    if (statusFilter !== 'ALL') params.set('status', statusFilter);
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
    if (advancedFilters.hasPhone) params.set('hasPhone', 'true');
    if (advancedFilters.priority) params.set('priority', advancedFilters.priority);
    if (advancedFilters.minCodeViolations) params.set('minCodeViolations', advancedFilters.minCodeViolations);

    return `/api/leads?${params.toString()}`;
  }, [sortField, sortDir, statusFilter, searchQuery, advancedFilters]);

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

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortField(field);
      setSortDir('desc');
    }
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
            {loading ? 'Loading...' : `${totalCount} leads`} · sorted by {sortLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedLeads.size > 0 && (
            <>
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{selectedLeads.size} selected</span>
              <button className="ws-btn-primary text-xs"><Send size={14} /> Hand Off</button>
              <button className="ws-btn-secondary text-xs"><Download size={14} /> Export</button>
            </>
          )}
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
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm outline-none flex-1"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {statusFilters.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200"
                style={
                  statusFilter === s
                    ? { backgroundColor: 'var(--brand-deep)', color: '#fff' }
                    : { color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }
                }
              >
                {s === 'ALL' ? 'All' : getStatusLabel(s)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
      <AdvancedFilters
        filters={advancedFilters}
        onChange={setAdvancedFilters}
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
            className="hidden md:grid grid-cols-[40px_48px_1fr_140px_120px_100px_100px] gap-3 px-5 py-3 text-xs font-semibold border-b"
            style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-elevated)' }}
          >
            <div className="flex items-center">
              <input type="checkbox" checked={selectedLeads.size === allLeads.length && allLeads.length > 0} onChange={toggleSelectAll} className="rounded" />
            </div>
            <button onClick={() => toggleSort('totalScore')} className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
              Score <ArrowUpDown size={12} />
            </button>
            <div>Property / Owner</div>
            <div>Signals</div>
            <button onClick={() => toggleSort('estimatedValue')} className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
              Value <ArrowUpDown size={12} />
            </button>
            <div>Status</div>
            <button onClick={() => toggleSort('createdAt')} className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
              Created <ArrowUpDown size={12} />
            </button>
          </div>

          {/* Table Rows */}
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {allLeads.map((lead: any) => {
              const prop = getProp(lead);
              const signals = lead.signals || [];
              const created = lead.createdAt || lead.firstDiscovered;

              return (
                <div key={lead.id} className="ws-table-row">
                  {/* Desktop Row */}
                  <div className="hidden md:grid grid-cols-[40px_48px_1fr_140px_120px_100px_100px] gap-3 px-5 py-3.5 items-center">
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
                        {lead.isTimeSensitive && <AlertTriangle size={14} style={{ color: 'var(--danger)' }} className="shrink-0" />}
                      </div>
                      <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                        {prop.city}, {prop.state} {prop.zipCode} · {prop.ownerName || '—'}
                      </p>
                    </Link>
                    <div className="flex flex-wrap gap-1">
                      {signals.slice(0, 2).map((s: any, i: number) => (
                        <span key={i} className={`ws-tag ws-tag-${getSignalTagColor(s.signalType)} text-[10px]`}>{s.label}</span>
                      ))}
                      {signals.length > 2 && <span className="ws-tag ws-tag-neutral text-[10px]">+{signals.length - 2}</span>}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(prop.estimatedValue || 0)}</p>
                      <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{formatCurrency(prop.estimatedEquity || 0)} equity</p>
                    </div>
                    <div>
                      <span className={`ws-status ws-status-${lead.status.toLowerCase()} text-xs`} style={{ color: 'var(--text-secondary)' }}>
                        {getStatusLabel(lead.status)}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{created ? timeAgo(created) : '—'}</p>
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
                        {lead.isTimeSensitive && <AlertTriangle size={12} style={{ color: 'var(--danger)' }} className="shrink-0" />}
                      </div>
                      <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                        {prop.city} · {prop.ownerName || '—'} · {formatCurrency(prop.estimatedValue || 0)}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {signals.slice(0, 3).map((s: any, i: number) => (
                          <span key={i} className={`ws-tag ws-tag-${getSignalTagColor(s.signalType)} text-[10px]`}>{s.label}</span>
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
        </div>
      )}
      {/* Add Lead Modal */}
      {showAddLead && (
        <AddLeadModal
          onClose={() => setShowAddLead(false)}
          onLeadCreated={() => refetch()}
        />
      )}
    </div>
  );
}
