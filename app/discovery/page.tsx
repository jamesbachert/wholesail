'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Search,
  ArrowUpDown,
  Loader2,
  RefreshCw,
  Database,
  Clock,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Trash2,
  MapPin,
  Building2,
  Layers,
  Zap,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useApi } from '@/lib/hooks';
import { getScoreColorHex, getSignalTagColor, timeAgo } from '@/lib/mockData';

// -- PA Urban Redevelopment Law (Act 385) blight criteria descriptions --
const BLIGHT_CRITERIA: Record<string, string> = {
  '1': 'Physical condition endangers health/safety',
  '2': 'Dilapidation or disrepair (dangerous/unfit for habitation)',
  '3': 'Attractive nuisance to children',
  '4': 'Hazard to safety due to fire',
  '5': 'Unsanitary conditions',
  '6': 'Inadequate light, air, and space',
  '7': 'Overcrowding',
  '8': 'Inadequate planning (impedes adequate development)',
  '9': 'Obsolete design/arrangement',
  '10': 'Faulty street layout',
  '11': 'Economically/socially undesirable land use',
  '12': 'Fire damage or other catastrophe',
  '13': 'Property detrimental to public health or safety',
};

// -- Connector display names --
const CONNECTOR_LABELS: Record<string, string> = {
  'ara-blight': 'ARA Blight',
  'lehigh-sheriff-sales': 'Sheriff Sales (Lehigh)',
  'northampton-sheriff-sales': 'Sheriff Sales (Northampton)',
  'allentown-code-violations': 'Code Violations',
  'lehigh-tax-repository': 'Tax Repository',
  'allentown-rental-licenses': 'Rental Licenses',
};

function getConnectorLabel(slug: string): string {
  return CONNECTOR_LABELS[slug] || slug;
}

// -- Signal category → tag color mapping --
function getCategoryColor(category: string): string {
  switch (category) {
    case 'distress': return 'danger';
    case 'condition': return 'warning';
    case 'financial': return 'info';
    case 'ownership': return 'neutral';
    default: return 'neutral';
  }
}

type SortField = 'discoveryScore' | 'sourceCount' | 'address' | 'lastSeenAt';
type SortDir = 'asc' | 'desc';

const STATUS_FILTERS = ['all', 'new', 'reviewed', 'in_pipeline', 'dismissed'];

function getStatusDisplay(status: string) {
  switch (status) {
    case 'new': return { label: 'New', variant: 'info' };
    case 'reviewed': return { label: 'Reviewed', variant: 'neutral' };
    case 'in_pipeline': return { label: 'In Pipeline', variant: 'success' };
    case 'dismissed': return { label: 'Dismissed', variant: 'neutral' };
    default: return { label: status, variant: 'neutral' };
  }
}

export default function DiscoveryPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [minSourcesFilter, setMinSourcesFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('discoveryScore');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null); // slug of currently syncing connector
  const [syncResult, setSyncResult] = useState<any>(null);
  const [enriching, setEnriching] = useState<string | null>(null);
  const [enrichResult, setEnrichResult] = useState<any>(null);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [actionResult, setActionResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Build API URL for discovered leads
  const leadsUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('region', 'lehigh-valley');
    params.set('sortBy', sortField);
    params.set('sortDir', sortDir);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (searchQuery) params.set('search', searchQuery);
    if (sourceFilter !== 'all') params.set('source', sourceFilter);
    if (minSourcesFilter) params.set('minSources', minSourcesFilter);
    return `/api/discovery/leads?${params.toString()}`;
  }, [sortField, sortDir, statusFilter, searchQuery, sourceFilter, minSourcesFilter]);

  const { data: leadsData, loading: leadsLoading, refetch: refetchLeads } = useApi<any>(leadsUrl);
  const { data: sourcesData, refetch: refetchSources } = useApi<any>('/api/discovery/sources?region=lehigh-valley');

  const leads = leadsData?.leads || [];
  const total = leadsData?.total || 0;
  const sources = sourcesData?.sources || [];
  const enrichmentSources = sourcesData?.enrichmentSources || [];
  const allSources = [...sources, ...enrichmentSources];
  const availableSources = leadsData?.filterOptions?.sources || [];

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
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(leads.map((l: any) => l.id)));
    }
  };

  // Sync handler
  const handleSync = useCallback(async (slug: string) => {
    setSyncing(slug);
    setSyncResult(null);
    try {
      const res = await fetch('/api/discovery/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectorSlug: slug }),
      });
      const data = await res.json();
      setSyncResult(data);
      refetchLeads();
      refetchSources();
    } catch (err: any) {
      setSyncResult({ success: false, errorMessages: [err.message] });
    } finally {
      setSyncing(null);
    }
  }, [refetchLeads, refetchSources]);

  // Enrich handler
  const handleEnrich = useCallback(async (slug: string) => {
    setEnriching(slug);
    setEnrichResult(null);
    try {
      const res = await fetch('/api/discovery/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectorSlug: slug }),
      });
      const data = await res.json();
      setEnrichResult(data);
      refetchLeads();
      refetchSources();
    } catch (err: any) {
      setEnrichResult({ success: false, errorMessages: [err.message] });
    } finally {
      setEnriching(null);
    }
  }, [refetchLeads, refetchSources]);

  // Sync All handler
  const handleSyncAll = useCallback(async () => {
    setSyncing('__all__');
    setSyncResult(null);
    try {
      for (const source of sources) {
        await fetch('/api/discovery/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectorSlug: source.slug }),
        });
      }
      setSyncResult({ success: true, total: sources.length, message: `Synced ${sources.length} sources` });
      refetchLeads();
      refetchSources();
    } catch (err: any) {
      setSyncResult({ success: false, errorMessages: [err.message] });
    } finally {
      setSyncing(null);
    }
  }, [sources, refetchLeads, refetchSources]);

  // Promote handler
  const handlePromote = useCallback(async () => {
    if (selectedLeads.size === 0) return;
    setPromoting(true);
    setActionResult(null);
    try {
      const res = await fetch('/api/discovery/leads/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: Array.from(selectedLeads) }),
      });
      const data = await res.json();
      setActionResult({
        type: 'success',
        message: `${data.promoted} promoted to pipeline${data.skipped ? `, ${data.skipped} skipped` : ''}`,
      });
      setSelectedLeads(new Set());
      refetchLeads();
      refetchSources();
    } catch (err: any) {
      setActionResult({ type: 'error', message: err.message });
    } finally {
      setPromoting(false);
    }
  }, [selectedLeads, refetchLeads, refetchSources]);

  // Dismiss handler
  const handleDismiss = useCallback(async () => {
    if (selectedLeads.size === 0) return;
    setDismissing(true);
    setActionResult(null);
    try {
      const res = await fetch('/api/discovery/leads/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadIds: Array.from(selectedLeads) }),
      });
      const data = await res.json();
      setActionResult({
        type: 'success',
        message: `${data.dismissed} leads dismissed`,
      });
      setSelectedLeads(new Set());
      refetchLeads();
      refetchSources();
    } catch (err: any) {
      setActionResult({ type: 'error', message: err.message });
    } finally {
      setDismissing(false);
    }
  }, [selectedLeads, refetchLeads, refetchSources]);

  const sortLabel =
    sortField === 'discoveryScore' ? 'score' :
    sortField === 'sourceCount' ? 'sources' :
    sortField === 'lastSeenAt' ? 'last seen' : 'address';

  // Compute source status for compact bar
  const getSourceStatusColor = (source: any) => {
    if (!source.lastSync) return 'var(--text-tertiary)'; // never synced — gray
    if (source.lastSync.status === 'error') return 'var(--danger)'; // error — red
    const completedAt = source.lastSync.completedAt || source.lastSync.startedAt;
    if (!completedAt) return 'var(--text-tertiary)';
    const hoursSince = (Date.now() - new Date(completedAt).getTime()) / (1000 * 60 * 60);
    if (hoursSince < 24) return 'var(--success)'; // recent — green
    return 'var(--warning)'; // stale — yellow
  };

  const mostRecentSync = allSources.reduce((latest: string | null, s: any) => {
    const t = s.lastSync?.completedAt || s.lastSync?.startedAt;
    if (!t) return latest;
    if (!latest) return t;
    return new Date(t) > new Date(latest) ? t : latest;
  }, null);

  return (
    <div className="max-w-7xl mx-auto space-y-4 pb-20 md:pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--text-primary)' }}>
            Lead Discovery
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {leadsLoading ? 'Loading...' : `${total} discovered properties`} · sorted by {sortLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedLeads.size > 0 && (
            <>
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                {selectedLeads.size} selected
              </span>
              <button
                onClick={handlePromote}
                disabled={promoting}
                className="ws-btn-primary text-xs flex items-center gap-1.5"
              >
                {promoting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                Add to Pipeline
              </button>
              <button
                onClick={handleDismiss}
                disabled={dismissing}
                className="ws-btn-ghost text-xs flex items-center gap-1.5"
                style={{ color: 'var(--danger)' }}
              >
                {dismissing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Dismiss
              </button>
            </>
          )}
        </div>
      </div>

      {/* Action result toast */}
      {actionResult && (
        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium"
          style={{
            backgroundColor: actionResult.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            color: actionResult.type === 'success' ? 'var(--success)' : 'var(--danger)',
            border: `1px solid ${actionResult.type === 'success' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
          }}
        >
          {actionResult.type === 'success' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          {actionResult.message}
          <button onClick={() => setActionResult(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">Dismiss</button>
        </div>
      )}

      {/* Data Sources — Collapsible Panel */}
      <div className="ws-card">
        {/* Compact Status Bar (always visible) */}
        <div
          className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none"
          onClick={() => setSourcesExpanded((v) => !v)}
        >
          <Database size={16} style={{ color: 'var(--brand-deep)' }} />
          <div className="flex items-center gap-1.5">
            {allSources.map((s: any) => (
              <span
                key={s.slug}
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: getSourceStatusColor(s) }}
                title={`${s.name}: ${s.lastSync?.status || 'never synced'}`}
              />
            ))}
          </div>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {allSources.length} source{allSources.length !== 1 ? 's' : ''}
            {mostRecentSync && <> · Last synced {timeAgo(mostRecentSync)}</>}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); handleSyncAll(); }}
              disabled={syncing !== null}
              className="ws-btn-secondary text-[11px] flex items-center gap-1 py-1 px-2.5"
            >
              {syncing === '__all__' ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              Sync All
            </button>
            {sourcesExpanded
              ? <ChevronUp size={16} style={{ color: 'var(--text-tertiary)' }} />
              : <ChevronDown size={16} style={{ color: 'var(--text-tertiary)' }} />
            }
          </div>
        </div>

        {/* Expanded Panel */}
        {sourcesExpanded && (
          <div className="border-t px-4 pb-4" style={{ borderColor: 'var(--border-subtle)' }}>
            {/* Lead Discovery Section */}
            <div className="mt-3">
              <div className="flex items-center gap-1.5 mb-2">
                <Database size={13} style={{ color: 'var(--text-tertiary)' }} />
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                  Lead Discovery
                </span>
                <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                  — finds new properties
                </span>
              </div>
              <div className="space-y-1.5">
                {sources.map((source: any) => (
                  <div
                    key={source.slug}
                    className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-elevated)' }}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: getSourceStatusColor(source) }}
                      />
                      <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {source.name}
                      </span>
                      {source.lastSync?.status === 'success' && (
                        <span className="ws-tag ws-tag-success text-[10px] shrink-0">Active</span>
                      )}
                      {source.lastSync?.status === 'error' && (
                        <span className="ws-tag ws-tag-danger text-[10px] shrink-0">Error</span>
                      )}
                      {!source.lastSync && (
                        <span className="ws-tag ws-tag-neutral text-[10px] shrink-0">Never Synced</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {source.lastSync && (
                        <span className="text-[11px] hidden sm:inline" style={{ color: 'var(--text-tertiary)' }}>
                          {timeAgo(source.lastSync.completedAt || source.lastSync.startedAt)} · {source.signalCount} signals
                        </span>
                      )}
                      <button
                        onClick={() => handleSync(source.slug)}
                        disabled={syncing !== null}
                        className="ws-btn-secondary text-[11px] flex items-center gap-1 py-1 px-2.5"
                      >
                        {syncing === source.slug ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        {syncing === source.slug ? 'Syncing...' : 'Sync'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Data Enrichment Section */}
            {enrichmentSources.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center gap-1.5 mb-2">
                  <Sparkles size={13} style={{ color: 'var(--text-tertiary)' }} />
                  <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                    Data Enrichment
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    — adds signals to existing leads
                  </span>
                </div>
                <div className="space-y-1.5">
                  {enrichmentSources.map((source: any) => (
                    <div
                      key={source.slug}
                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg"
                      style={{ backgroundColor: 'var(--bg-elevated)' }}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: getSourceStatusColor(source) }}
                        />
                        <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {source.name}
                        </span>
                        {source.lastSync?.status === 'success' && (
                          <span className="ws-tag ws-tag-success text-[10px] shrink-0">
                            {source.signalCount} enriched
                          </span>
                        )}
                        {!source.lastSync && (
                          <span className="ws-tag ws-tag-neutral text-[10px] shrink-0">Not Run</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {source.lastSync && (
                          <span className="text-[11px] hidden sm:inline" style={{ color: 'var(--text-tertiary)' }}>
                            {timeAgo(source.lastSync.completedAt || source.lastSync.startedAt)}
                          </span>
                        )}
                        <button
                          onClick={() => handleEnrich(source.slug)}
                          disabled={enriching !== null || syncing !== null}
                          className="ws-btn-secondary text-[11px] flex items-center gap-1 py-1 px-2.5"
                        >
                          {enriching === source.slug ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                          {enriching === source.slug ? 'Enriching...' : 'Enrich All'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sync / Enrich result notifications */}
            {syncResult && (
              <div
                className="mt-3 p-2.5 rounded-lg text-xs"
                style={{
                  backgroundColor: syncResult.success ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                  border: `1px solid ${syncResult.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                }}
              >
                <div className="flex items-center gap-2 font-medium" style={{ color: syncResult.success ? 'var(--success)' : 'var(--danger)' }}>
                  {syncResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  {syncResult.success ? 'Sync completed' : 'Sync failed'}
                  {syncResult.success && syncResult.total != null && (
                    <span className="font-normal" style={{ color: 'var(--text-secondary)' }}>
                      — {syncResult.message || `${syncResult.total} records (${syncResult.newCount} new, ${syncResult.updatedCount} updated) in ${(syncResult.duration / 1000).toFixed(1)}s`}
                    </span>
                  )}
                  <button onClick={() => setSyncResult(null)} className="ml-auto opacity-60 hover:opacity-100">Dismiss</button>
                </div>
                {syncResult.errorMessages?.length > 0 && (
                  <div className="mt-1.5" style={{ color: 'var(--danger)' }}>
                    {syncResult.errorMessages.slice(0, 3).map((msg: string, i: number) => (
                      <p key={i}>{msg}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
            {enrichResult && (
              <div
                className="mt-3 p-2.5 rounded-lg text-xs"
                style={{
                  backgroundColor: enrichResult.success ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                  border: `1px solid ${enrichResult.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                }}
              >
                <div className="flex items-center gap-2 font-medium" style={{ color: enrichResult.success ? 'var(--success)' : 'var(--danger)' }}>
                  {enrichResult.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                  {enrichResult.success ? 'Enrichment completed' : 'Enrichment failed'}
                  {enrichResult.success && (
                    <span className="font-normal" style={{ color: 'var(--text-secondary)' }}>
                      — {enrichResult.enrichedCount} leads enriched
                      {enrichResult.skippedCount > 0 && `, ${enrichResult.skippedCount} already enriched`}
                      {` in ${(enrichResult.duration / 1000).toFixed(1)}s`}
                    </span>
                  )}
                  <button onClick={() => setEnrichResult(null)} className="ml-auto opacity-60 hover:opacity-100">Dismiss</button>
                </div>
                {enrichResult.errorMessages?.length > 0 && (
                  <div className="mt-1.5" style={{ color: 'var(--danger)' }}>
                    {enrichResult.errorMessages.slice(0, 3).map((msg: string, i: number) => (
                      <p key={i}>{msg}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {allSources.length === 0 && sourcesData && (
              <div className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)' }}>
                No data source connectors configured for this region.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search + Filters */}
      <div className="ws-card p-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div
            className="flex items-center gap-2 flex-1 px-3 py-2 rounded-lg border"
            style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-primary)' }}
          >
            <Search size={16} style={{ color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              placeholder="Search by address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm outline-none flex-1"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {STATUS_FILTERS.map((s) => (
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
                {s === 'all' ? 'All' : getStatusDisplay(s).label}
              </button>
            ))}
          </div>
        </div>
        {/* Source + Min Sources filter row */}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Source:</span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="text-xs px-2 py-1 rounded border bg-transparent"
              style={{ color: 'var(--text-secondary)', borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-elevated)' }}
            >
              <option value="all">All Sources</option>
              {availableSources.map((s: string) => (
                <option key={s} value={s}>{getConnectorLabel(s)}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Min Sources:</span>
            {['', '2', '3'].map((val) => (
              <button
                key={val}
                onClick={() => setMinSourcesFilter(val)}
                className="px-2.5 py-1 rounded text-[11px] font-medium transition-all duration-200"
                style={
                  minSourcesFilter === val
                    ? { backgroundColor: 'var(--brand-deep)', color: '#fff' }
                    : { color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)' }
                }
              >
                {val === '' ? 'Any' : `${val}+`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading */}
      {leadsLoading && (
        <div className="flex items-center justify-center py-8 gap-2" style={{ color: 'var(--text-secondary)' }}>
          <Loader2 size={16} className="animate-spin" /> Loading discovered leads...
        </div>
      )}

      {/* Discovered Leads Table */}
      {!leadsLoading && (
        <div className="ws-card overflow-hidden">
          {/* Table Header */}
          <div
            className="hidden md:grid grid-cols-[40px_48px_1fr_80px_180px_100px_90px] gap-3 px-5 py-3 text-xs font-semibold border-b"
            style={{ color: 'var(--text-tertiary)', borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-elevated)' }}
          >
            <div className="flex items-center">
              <input type="checkbox" checked={selectedLeads.size === leads.length && leads.length > 0} onChange={toggleSelectAll} className="rounded" />
            </div>
            <button onClick={() => toggleSort('discoveryScore')} className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
              Score <ArrowUpDown size={12} />
            </button>
            <button onClick={() => toggleSort('address')} className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors text-left">
              Address <ArrowUpDown size={12} />
            </button>
            <button onClick={() => toggleSort('sourceCount')} className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
              Sources <ArrowUpDown size={12} />
            </button>
            <div>Signals</div>
            <div>Status</div>
            <button onClick={() => toggleSort('lastSeenAt')} className="flex items-center gap-1 hover:text-[var(--text-primary)] transition-colors">
              Last Seen <ArrowUpDown size={12} />
            </button>
          </div>

          {/* Table Rows */}
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {leads.map((lead: any) => {
              const statusDisplay = getStatusDisplay(lead.status);
              const isExpanded = expandedRow === lead.id;
              const signals = lead.signals || [];

              return (
                <div key={lead.id} className="ws-table-row">
                  {/* Desktop Row */}
                  <div
                    className="hidden md:grid grid-cols-[40px_48px_1fr_80px_180px_100px_90px] gap-3 px-5 py-3.5 items-center cursor-pointer"
                    onClick={() => setExpandedRow(isExpanded ? null : lead.id)}
                  >
                    <div onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedLeads.has(lead.id)} onChange={() => toggleSelect(lead.id)} className="rounded" />
                    </div>
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white"
                      style={{ backgroundColor: getScoreColorHex(lead.discoveryScore) }}
                    >
                      {Math.round(lead.discoveryScore)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {lead.address}
                        </p>
                        {isExpanded ? <ChevronUp size={14} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />}
                      </div>
                      <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                        {lead.city}, {lead.state} {lead.zipCode}
                        {lead.propertyType ? ` · ${lead.propertyType}` : ''}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center gap-1">
                        <Layers size={12} style={{ color: lead.sourceCount >= 2 ? 'var(--brand-deep)' : 'var(--text-tertiary)' }} />
                        <span
                          className="text-xs font-medium"
                          style={{ color: lead.sourceCount >= 2 ? 'var(--brand-deep)' : 'var(--text-secondary)' }}
                        >
                          {lead.sourceCount}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {signals.slice(0, 3).map((s: any, i: number) => (
                        <span key={i} className={`ws-tag ws-tag-${getCategoryColor(s.category)} text-[10px]`}>
                          {s.label}
                        </span>
                      ))}
                      {signals.length > 3 && (
                        <span className="ws-tag ws-tag-neutral text-[10px]">+{signals.length - 3}</span>
                      )}
                    </div>
                    <div>
                      <span className={`ws-tag ws-tag-${statusDisplay.variant} text-[10px]`}>
                        {statusDisplay.label}
                      </span>
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {lead.lastSeenAt ? timeAgo(lead.lastSeenAt) : '—'}
                    </div>
                  </div>

                  {/* Mobile Card */}
                  <div
                    className="flex md:hidden items-start gap-3 px-4 py-3.5 cursor-pointer"
                    onClick={() => setExpandedRow(isExpanded ? null : lead.id)}
                  >
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 mt-0.5" style={{ backgroundColor: getScoreColorHex(lead.discoveryScore) }}>
                      {Math.round(lead.discoveryScore)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{lead.address}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                        {lead.city}, {lead.state} · {lead.sourceCount} source{lead.sourceCount !== 1 ? 's' : ''}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        {signals.slice(0, 2).map((s: any, i: number) => (
                          <span key={i} className={`ws-tag ws-tag-${getCategoryColor(s.category)} text-[10px]`}>
                            {s.label}
                          </span>
                        ))}
                        {signals.length > 2 && (
                          <span className="ws-tag ws-tag-neutral text-[10px]">+{signals.length - 2}</span>
                        )}
                        <span className={`ws-tag ws-tag-${statusDisplay.variant} text-[10px]`}>
                          {statusDisplay.label}
                        </span>
                      </div>
                    </div>
                    <div onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedLeads.has(lead.id)} onChange={() => toggleSelect(lead.id)} className="rounded" />
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div
                      className="px-5 py-4 border-t"
                      style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Column 1: Property Details */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                            Property Details
                          </h4>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                              <MapPin size={12} style={{ color: 'var(--brand-deep)' }} />
                              {lead.address}, {lead.city}, {lead.state} {lead.zipCode}
                            </div>
                            {lead.latitude && lead.longitude && (
                              <div className="flex items-center gap-2" style={{ color: 'var(--text-tertiary)' }}>
                                <span className="w-3" /> {lead.latitude.toFixed(4)}, {lead.longitude.toFixed(4)}
                              </div>
                            )}
                            {lead.propertyType && (
                              <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                                <Building2 size={12} style={{ color: 'var(--brand-deep)' }} />
                                Type: {lead.propertyType}
                                {lead.yearBuilt ? ` · Built: ${lead.yearBuilt}` : ''}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Column 2: Discovery Signals */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                            Discovery Signals ({signals.length})
                          </h4>
                          <div className="space-y-2">
                            {signals.map((s: any) => (
                              <div
                                key={s.id}
                                className="p-2 rounded-lg border"
                                style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-primary)' }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <Zap size={11} style={{ color: 'var(--brand-deep)' }} />
                                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                                      {s.label}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <span className={`ws-tag ws-tag-${getCategoryColor(s.category)} text-[9px]`}>
                                      {s.category}
                                    </span>
                                    <span className="text-[10px] font-bold" style={{ color: 'var(--brand-deep)' }}>
                                      +{s.points}
                                    </span>
                                  </div>
                                </div>
                                {s.value && (
                                  <p className="text-[11px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                                    {s.value}
                                  </p>
                                )}
                                {/* Blight criteria detail rendering */}
                                {s.signalType === 'blight_criteria' && s.details?.criteriaList && (
                                  <div className="mt-1.5 space-y-0.5">
                                    {(s.details.criteriaList as string[]).map((num: string) => (
                                      <p key={num} className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                        <span className="font-medium" style={{ color: 'var(--danger)' }}>#{num}</span>{' '}
                                        {BLIGHT_CRITERIA[num] || 'Unknown criteria'}
                                      </p>
                                    ))}
                                  </div>
                                )}
                                <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>
                                  via {getConnectorLabel(s.connectorSlug)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Column 3: Score & Metadata */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
                            Score & Metadata
                          </h4>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex items-start gap-2" style={{ color: 'var(--text-secondary)' }}>
                              <FileText size={12} className="shrink-0 mt-0.5" style={{ color: 'var(--brand-deep)' }} />
                              <div>
                                <span className="font-bold text-sm" style={{ color: getScoreColorHex(lead.discoveryScore) }}>
                                  {Math.round(lead.discoveryScore)}
                                </span>
                                <span> / 100</span>
                                {(() => {
                                  const baseScore = signals.reduce((sum: number, s: any) => sum + s.points, 0);
                                  const bonus = lead.sourceCount >= 3 ? 25 : lead.sourceCount >= 2 ? 10 : 0;
                                  if (bonus > 0) {
                                    return (
                                      <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                                        Base: {baseScore} + Cross-source: +{bonus}
                                      </p>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </div>
                            <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
                              <Layers size={12} style={{ color: 'var(--brand-deep)' }} />
                              Found in {lead.sourceCount} source{lead.sourceCount !== 1 ? 's' : ''}
                            </div>
                            {/* List contributing connectors */}
                            {(() => {
                              const slugs = Array.from(new Set<string>(signals.map((s: any) => s.connectorSlug)));
                              return slugs.map((slug) => (
                                <div key={slug} className="ml-5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                                  · {getConnectorLabel(slug)}
                                </div>
                              ));
                            })()}

                            <div className="pt-2 mt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                              <p style={{ color: 'var(--text-tertiary)' }}>
                                First seen: {new Date(lead.firstSeenAt).toLocaleDateString()}
                              </p>
                              <p style={{ color: 'var(--text-tertiary)' }}>
                                Last synced: {new Date(lead.syncedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Quick actions for this row */}
                      {lead.status !== 'in_pipeline' && (
                        <div className="flex items-center gap-2 mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              setPromoting(true);
                              try {
                                const res = await fetch('/api/discovery/leads/promote', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ leadIds: [lead.id] }),
                                });
                                const data = await res.json();
                                setActionResult({ type: 'success', message: `${lead.address} added to pipeline` });
                                refetchLeads();
                                refetchSources();
                              } catch (err: any) {
                                setActionResult({ type: 'error', message: err.message });
                              } finally {
                                setPromoting(false);
                              }
                            }}
                            disabled={promoting}
                            className="ws-btn-primary text-xs flex items-center gap-1.5"
                          >
                            <ArrowRight size={14} /> Add to Pipeline
                          </button>
                          {lead.status !== 'dismissed' && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await fetch('/api/discovery/leads/dismiss', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ leadIds: [lead.id] }),
                                  });
                                  refetchLeads();
                                  refetchSources();
                                } catch {}
                              }}
                              className="ws-btn-ghost text-xs flex items-center gap-1.5"
                              style={{ color: 'var(--text-tertiary)' }}
                            >
                              <Trash2 size={14} /> Dismiss
                            </button>
                          )}
                        </div>
                      )}
                      {lead.status === 'in_pipeline' && lead.promotedLeadId && (
                        <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                          <a
                            href={`/leads/${lead.promotedLeadId}`}
                            className="text-xs font-medium flex items-center gap-1.5 hover:underline"
                            style={{ color: 'var(--brand-deep)' }}
                          >
                            <ArrowRight size={14} /> View in Pipeline
                          </a>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Empty state */}
          {leads.length === 0 && !leadsLoading && (
            <div className="px-5 py-12 text-center">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {total === 0
                  ? "No discovered leads yet. Click 'Sync Now' above to pull data from connected sources."
                  : 'No leads match your filters. Try adjusting your search or filters.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
