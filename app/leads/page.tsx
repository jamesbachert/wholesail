'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Search,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  ChevronDown,
  Download,
  Send,
} from 'lucide-react';
import {
  mockLeads,
  getScoreColorHex,
  getStatusLabel,
  getSignalTagColor,
  formatCurrency,
  timeAgo,
} from '@/lib/mockData';

type SortField = 'totalScore' | 'firstDiscovered' | 'lastContacted' | 'estimatedValue';
type SortDir = 'asc' | 'desc';

const statusFilters = ['ALL', 'NEW', 'CONTACTED', 'WARM', 'HOT', 'UNDER_CONTRACT', 'HANDED_OFF', 'CLOSED', 'DEAD'];

export default function LeadsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortField, setSortField] = useState<SortField>('totalScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

  const filteredLeads = useMemo(() => {
    let leads = [...mockLeads];

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      leads = leads.filter(
        (l) =>
          l.property.address.toLowerCase().includes(q) ||
          l.property.city.toLowerCase().includes(q) ||
          l.property.ownerName.toLowerCase().includes(q) ||
          l.property.zipCode.includes(q)
      );
    }

    // Status filter
    if (statusFilter !== 'ALL') {
      leads = leads.filter((l) => l.status === statusFilter);
    }

    // Sort
    leads.sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortField) {
        case 'totalScore':
          aVal = a.totalScore;
          bVal = b.totalScore;
          break;
        case 'firstDiscovered':
          aVal = new Date(a.firstDiscovered).getTime();
          bVal = new Date(b.firstDiscovered).getTime();
          break;
        case 'lastContacted':
          aVal = a.lastContacted ? new Date(a.lastContacted).getTime() : 0;
          bVal = b.lastContacted ? new Date(b.lastContacted).getTime() : 0;
          break;
        case 'estimatedValue':
          aVal = a.property.estimatedValue;
          bVal = b.property.estimatedValue;
          break;
        default:
          aVal = a.totalScore;
          bVal = b.totalScore;
      }
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return leads;
  }, [searchQuery, statusFilter, sortField, sortDir]);

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
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map((l) => l.id)));
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-bold font-display"
            style={{ color: 'var(--text-primary)' }}
          >
            Leads
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {filteredLeads.length} leads · sorted by {sortField === 'totalScore' ? 'score' : sortField}
          </p>
        </div>

        {selectedLeads.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {selectedLeads.size} selected
            </span>
            <button className="ws-btn-primary text-xs">
              <Send size={14} /> Hand Off
            </button>
            <button className="ws-btn-secondary text-xs">
              <Download size={14} /> Export
            </button>
          </div>
        )}
      </div>

      {/* Filters Bar */}
      <div className="ws-card p-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div
            className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg border"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              borderColor: 'var(--border-primary)',
            }}
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

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {statusFilters.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                  statusFilter === s ? 'text-white' : ''
                }`}
                style={
                  statusFilter === s
                    ? { backgroundColor: 'var(--brand-deep)' }
                    : { color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }
                }
              >
                {s === 'ALL' ? 'All' : getStatusLabel(s)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Leads Table */}
      <div className="ws-card overflow-hidden">
        {/* Table Header */}
        <div
          className="hidden md:grid grid-cols-[40px_48px_1fr_140px_120px_100px_100px] gap-3 px-5 py-3 text-xs font-semibold border-b"
          style={{
            color: 'var(--text-tertiary)',
            borderColor: 'var(--border-primary)',
            backgroundColor: 'var(--bg-elevated)',
          }}
        >
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0}
              onChange={toggleSelectAll}
              className="rounded"
            />
          </div>
          <button
            onClick={() => toggleSort('totalScore')}
            className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors"
          >
            Score <ArrowUpDown size={12} />
          </button>
          <div>Property / Owner</div>
          <div>Signals</div>
          <button
            onClick={() => toggleSort('estimatedValue')}
            className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors"
          >
            Value <ArrowUpDown size={12} />
          </button>
          <div>Status</div>
          <button
            onClick={() => toggleSort('firstDiscovered')}
            className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors"
          >
            Discovered <ArrowUpDown size={12} />
          </button>
        </div>

        {/* Table Rows */}
        <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
          {filteredLeads.map((lead) => (
            <div key={lead.id} className="ws-table-row">
              {/* Desktop Row */}
              <div className="hidden md:grid grid-cols-[40px_48px_1fr_140px_120px_100px_100px] gap-3 px-5 py-3.5 items-center">
                <div>
                  <input
                    type="checkbox"
                    checked={selectedLeads.has(lead.id)}
                    onChange={() => toggleSelect(lead.id)}
                    className="rounded"
                  />
                </div>
                <Link href={`/leads/${lead.id}`}>
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                    style={{ backgroundColor: getScoreColorHex(lead.totalScore) }}
                  >
                    {lead.totalScore}
                  </div>
                </Link>
                <Link href={`/leads/${lead.id}`} className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {lead.property.address}
                    </p>
                    {lead.isTimeSensitive && (
                      <AlertTriangle size={14} style={{ color: 'var(--danger)' }} className="shrink-0" />
                    )}
                  </div>
                  <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                    {lead.property.city}, {lead.property.state} {lead.property.zipCode} · {lead.property.ownerName}
                  </p>
                </Link>
                <div className="flex flex-wrap gap-1">
                  {lead.signals.slice(0, 2).map((s, i) => (
                    <span
                      key={i}
                      className={`ws-tag ws-tag-${getSignalTagColor(s.signalType)} text-[10px]`}
                    >
                      {s.label}
                    </span>
                  ))}
                  {lead.signals.length > 2 && (
                    <span className="ws-tag ws-tag-neutral text-[10px]">
                      +{lead.signals.length - 2}
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {formatCurrency(lead.property.estimatedValue)}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    {formatCurrency(lead.property.estimatedEquity)} equity
                  </p>
                </div>
                <div>
                  <span
                    className={`ws-status ws-status-${lead.status.toLowerCase()} text-xs`}
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {getStatusLabel(lead.status)}
                  </span>
                </div>
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {timeAgo(lead.firstDiscovered)}
                  </p>
                </div>
              </div>

              {/* Mobile Card */}
              <Link
                href={`/leads/${lead.id}`}
                className="flex md:hidden items-start gap-3 px-4 py-3.5"
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 mt-0.5"
                  style={{ backgroundColor: getScoreColorHex(lead.totalScore) }}
                >
                  {lead.totalScore}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {lead.property.address}
                    </p>
                    {lead.isTimeSensitive && (
                      <AlertTriangle size={12} style={{ color: 'var(--danger)' }} className="shrink-0" />
                    )}
                  </div>
                  <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                    {lead.property.city} · {lead.property.ownerName} · {formatCurrency(lead.property.estimatedValue)}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {lead.signals.slice(0, 3).map((s, i) => (
                      <span
                        key={i}
                        className={`ws-tag ws-tag-${getSignalTagColor(s.signalType)} text-[10px]`}
                      >
                        {s.label}
                      </span>
                    ))}
                  </div>
                </div>
                <span className="text-[10px] shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                  {timeAgo(lead.firstDiscovered)}
                </span>
              </Link>
            </div>
          ))}
        </div>

        {filteredLeads.length === 0 && (
          <div className="px-5 py-12 text-center">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              No leads match your filters
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
