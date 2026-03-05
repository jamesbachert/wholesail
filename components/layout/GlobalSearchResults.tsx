'use client';

import { Loader2, ArrowRight, MapPin, User, Layers } from 'lucide-react';
import { getScoreColorHex, getStatusLabel } from '@/lib/mockData';

// ---------- Types ----------

interface LeadResult {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  ownerName: string | null;
  totalScore: number;
  status: string;
}

interface DiscoveryResult {
  id: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  discoveryScore: number;
  sourceCount: number;
  status: string;
}

export interface SearchResults {
  leads: LeadResult[];
  discovery: DiscoveryResult[];
  counts: { leads: number; discovery: number };
}

interface GlobalSearchResultsProps {
  results: SearchResults | null;
  loading: boolean;
  query: string;
  activeIndex: number;
  onSelect: (type: 'lead' | 'discovery', id: string, address: string) => void;
  onViewAll: (type: 'leads' | 'discovery') => void;
}

// ---------- Helpers ----------

function discoveryStatusLabel(status: string): string {
  const map: Record<string, string> = {
    new: 'New',
    viewed: 'Viewed',
    needs_review: 'Needs Review',
  };
  return map[status] || status;
}

// ---------- Component ----------

export function GlobalSearchResults({
  results,
  loading,
  query,
  activeIndex,
  onSelect,
  onViewAll,
}: GlobalSearchResultsProps) {
  const hasLeads = results && results.leads.length > 0;
  const hasDiscovery = results && results.discovery.length > 0;
  const isEmpty = results && !hasLeads && !hasDiscovery;

  // Build a flat index map for keyboard navigation
  let idx = 0;
  const leadIndices = results?.leads.map(() => idx++) || [];
  const viewAllLeadsIdx = hasLeads && results!.counts.leads > results!.leads.length ? idx++ : -1;
  const discoveryIndices = results?.discovery.map(() => idx++) || [];
  const viewAllDiscoveryIdx = hasDiscovery && results!.counts.discovery > results!.discovery.length ? idx++ : -1;

  return (
    <div
      className="absolute left-0 top-full mt-1 w-full rounded-lg border shadow-lg z-50 overflow-hidden"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-primary)',
        maxHeight: '420px',
        overflowY: 'auto',
      }}
    >
      {/* Loading */}
      {loading && !results && (
        <div className="flex items-center justify-center gap-2 py-8" style={{ color: 'var(--text-tertiary)' }}>
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Searching...</span>
        </div>
      )}

      {/* Empty */}
      {isEmpty && (
        <div className="py-8 text-center" style={{ color: 'var(--text-tertiary)' }}>
          <p className="text-sm">No results found for &ldquo;{query}&rdquo;</p>
        </div>
      )}

      {/* Pipeline Leads Section */}
      {hasLeads && (
        <div>
          <div
            className="flex items-center justify-between px-3 py-2 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Pipeline Leads
            </span>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: 'rgba(10, 126, 140, 0.1)',
                color: 'var(--brand-deep)',
              }}
            >
              {results!.counts.leads}
            </span>
          </div>

          {results!.leads.map((lead, i) => {
            const isActive = activeIndex === leadIndices[i];
            return (
              <button
                key={lead.id}
                onMouseDown={(e) => {
                  e.preventDefault(); // prevent input blur
                  onSelect('lead', lead.id, lead.address);
                }}
                className="flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors duration-100"
                style={{
                  backgroundColor: isActive ? 'var(--bg-elevated)' : undefined,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = '';
                }}
              >
                {/* Score circle */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: getScoreColorHex(lead.totalScore) }}
                >
                  {Math.round(lead.totalScore)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {lead.address}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {lead.ownerName && (
                      <span
                        className="flex items-center gap-1 text-xs truncate"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        <User size={10} />
                        {lead.ownerName}
                      </span>
                    )}
                    <span
                      className="text-xs truncate"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {[lead.city, lead.state, lead.zipCode].filter(Boolean).join(', ')}
                    </span>
                  </div>
                </div>

                {/* Status */}
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: 'var(--bg-elevated)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  {getStatusLabel(lead.status)}
                </span>
              </button>
            );
          })}

          {/* View all leads link */}
          {viewAllLeadsIdx >= 0 && (
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                onViewAll('leads');
              }}
              className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-medium transition-colors duration-100 border-t"
              style={{
                color: 'var(--brand-deep)',
                borderColor: 'var(--border-subtle)',
                backgroundColor: activeIndex === viewAllLeadsIdx ? 'var(--bg-elevated)' : undefined,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
              }}
              onMouseLeave={(e) => {
                if (activeIndex !== viewAllLeadsIdx) e.currentTarget.style.backgroundColor = '';
              }}
            >
              View all {results!.counts.leads} leads
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      )}

      {/* Discovery Section */}
      {hasDiscovery && (
        <div>
          <div
            className="flex items-center justify-between px-3 py-2 border-b"
            style={{
              borderColor: 'var(--border-subtle)',
              ...(hasLeads ? { borderTop: '1px solid var(--border-primary)' } : {}),
            }}
          >
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Discovery
            </span>
            <span
              className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                color: '#D97706',
              }}
            >
              {results!.counts.discovery}
            </span>
          </div>

          {results!.discovery.map((d, i) => {
            const isActive = activeIndex === discoveryIndices[i];
            return (
              <button
                key={d.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect('discovery', d.id, d.address);
                }}
                className="flex items-center gap-3 w-full px-3 py-2.5 text-left transition-colors duration-100"
                style={{
                  backgroundColor: isActive ? 'var(--bg-elevated)' : undefined,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = '';
                }}
              >
                {/* Score circle */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: getScoreColorHex(d.discoveryScore) }}
                >
                  {Math.round(d.discoveryScore)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {d.address}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span
                      className="flex items-center gap-1 text-xs"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <Layers size={10} />
                      {d.sourceCount} {d.sourceCount === 1 ? 'source' : 'sources'}
                    </span>
                    <span
                      className="text-xs truncate"
                      style={{ color: 'var(--text-tertiary)' }}
                    >
                      {[d.city, d.state, d.zipCode].filter(Boolean).join(', ')}
                    </span>
                  </div>
                </div>

                {/* Status */}
                <span
                  className="text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.08)',
                    color: '#D97706',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                  }}
                >
                  {discoveryStatusLabel(d.status)}
                </span>
              </button>
            );
          })}

          {/* View all discovery link */}
          {viewAllDiscoveryIdx >= 0 && (
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                onViewAll('discovery');
              }}
              className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-medium transition-colors duration-100 border-t"
              style={{
                color: '#D97706',
                borderColor: 'var(--border-subtle)',
                backgroundColor: activeIndex === viewAllDiscoveryIdx ? 'var(--bg-elevated)' : undefined,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--bg-elevated)';
              }}
              onMouseLeave={(e) => {
                if (activeIndex !== viewAllDiscoveryIdx) e.currentTarget.style.backgroundColor = '';
              }}
            >
              View all {results!.counts.discovery} discovery results
              <ArrowRight size={12} />
            </button>
          )}
        </div>
      )}

      {/* Loading overlay when refetching with existing results */}
      {loading && results && (
        <div
          className="flex items-center justify-center gap-2 py-2 border-t"
          style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-tertiary)' }}
        >
          <Loader2 size={12} className="animate-spin" />
          <span className="text-xs">Updating...</span>
        </div>
      )}
    </div>
  );
}
