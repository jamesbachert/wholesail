'use client';

import { useState } from 'react';
import {
  TrendingUp,
  Phone,
  MessageSquare,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  Users,
  Target,
  Flame,
  Calendar,
  CheckCircle2,
  Loader2,
  Info,
} from 'lucide-react';
import Link from 'next/link';
import { useApi } from '@/lib/hooks';
import {
  getScoreColorHex,
  getStatusLabel,
  getSignalTagColor,
  shortenSignalLabel,
  formatCurrency,
} from '@/lib/mockData';
import { StreetViewButton } from '@/components/leads/StreetViewModal';

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<'priority' | 'review'>('priority');

  const { data: liveLeadsData, loading: leadsLoading } = useApi<any>(
    '/api/leads?sortBy=totalScore&sortDir=desc&limit=5&prioritizeTimeSensitive=true'
  );
  const { data: reviewLeadsData, loading: reviewLoading } = useApi<any>(
    '/api/leads?needsReview=true&sortBy=totalScore&sortDir=desc&limit=5'
  );
  const { data: liveStats, loading: statsLoading } = useApi<any>('/api/dashboard');

  const stats = liveStats || {};
  const priorityLeads = (liveLeadsData as any)?.leads?.slice(0, 5) || [];
  const reviewLeads = (reviewLeadsData as any)?.leads?.slice(0, 5) || [];

  const followUpsDue = priorityLeads.filter((l: any) => l.nextFollowUp);

  const isLoading = leadsLoading || statsLoading || (activeTab === 'review' && reviewLoading);

  // Helper to normalize lead data shape
  const normalizeLead = (lead: any) => {
    if (lead.property) return lead;
    return { ...lead, property: lead };
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20 md:pb-6">
      {/* Page Header */}
      <div>
        <h1
          className="text-2xl font-bold font-display"
          style={{ color: 'var(--text-primary)' }}
        >
          Good morning 👋
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Here&apos;s your WholeSail overview for today
        </p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <Loader2 size={16} className="animate-spin" />
          Loading data...
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Total Leads"
          value={(stats.totalLeads || 0).toLocaleString()}
          subtext={`${stats.newCount || 0} new`}
          icon={Users}
          trend="up"
        />
        <StatCard
          label="Hot Leads"
          value={(stats.hot || 0).toString()}
          subtext={`${stats.warm || 0} warm`}
          icon={Flame}
          iconColor="var(--danger)"
        />
        <StatCard
          label="Under Contract"
          value={(stats.underContract || 0).toString()}
          subtext={`${stats.closed || 0} closed total`}
          icon={Target}
          iconColor="var(--success)"
        />
        <StatCard
          label="Handed Off"
          value={(stats.handedOff || 0).toString()}
          subtext="to partners"
          icon={ArrowUpRight}
          iconColor="var(--brand-ocean)"
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Priority / Review Leads - takes 2 cols */}
        <div className="lg:col-span-2">
          <div className="ws-card">
            {/* Tab Header */}
            <div
              className="flex items-center justify-between px-5 py-3 border-b"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setActiveTab('priority')}
                  className="flex items-center gap-1.5 px-3 h-[30px] rounded-lg text-sm font-medium transition-colors duration-200"
                  style={{
                    backgroundColor: activeTab === 'priority' ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                    color: activeTab === 'priority' ? '#F59E0B' : 'var(--text-tertiary)',
                    border: activeTab === 'priority' ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid var(--border-primary)',
                  }}
                >
                  <Flame size={14} />
                  Priority Leads
                </button>
                <button
                  onClick={() => setActiveTab('review')}
                  className="flex items-center gap-1.5 px-3 h-[30px] rounded-lg text-sm font-medium transition-colors duration-200"
                  style={{
                    backgroundColor: activeTab === 'review' ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                    color: activeTab === 'review' ? '#F59E0B' : 'var(--text-tertiary)',
                    border: activeTab === 'review' ? '1px solid rgba(245, 158, 11, 0.25)' : '1px solid var(--border-primary)',
                  }}
                >
                  <Info size={14} />
                  Needs Review
                  {reviewLeads.length > 0 && (
                    <span
                      className="ml-0.5 text-[10px] font-bold leading-none px-1.5 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--warning)', color: 'white' }}
                    >
                      {reviewLeads.length}
                    </span>
                  )}
                </button>
              </div>
              <Link
                href={activeTab === 'priority' ? '/leads' : '/leads?needsReview=true'}
                className="text-xs font-medium transition-colors duration-200 hover:underline"
                style={{ color: 'var(--brand-ocean)' }}
              >
                View all leads →
              </Link>
            </div>

            {/* Lead List */}
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {activeTab === 'priority' ? (
                // Priority Leads tab
                priorityLeads.length > 0 ? (
                  priorityLeads.map((lead: any) => {
                    const l = normalizeLead(lead);
                    const signals = l.signals || [];
                    return (
                      <div key={l.id} className="flex items-center gap-4 px-5 py-3.5 ws-table-row">
                        <Link
                          href={`/leads/${l.id}`}
                          className="flex items-center gap-4 flex-1 min-w-0"
                        >
                          <div
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                            style={{ backgroundColor: getScoreColorHex(l.totalScore) }}
                          >
                            {l.totalScore}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                {l.property.address}
                              </p>
                              {l.isTimeSensitive && !l.timeSensitiveDismissedAt && (
                                <span className="ws-tag ws-tag-danger text-[10px]">
                                  <AlertTriangle size={10} /> Time Sensitive
                                </span>
                              )}
                            </div>
                            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                              {l.property.city} · {l.property.ownerName || '—'} · {formatCurrency(l.property.estimatedValue)}
                            </p>
                          </div>
                          <div className="hidden md:flex items-center gap-1.5 shrink-0">
                            {signals.slice(0, 2).map((s: any, i: number) => (
                              <span
                                key={i}
                                className={`ws-tag ws-tag-${getSignalTagColor(s.signalType)} text-[10px]`}
                              >
                                {shortenSignalLabel(s.label)}
                              </span>
                            ))}
                            {signals.length > 2 && (
                              <span className="ws-tag ws-tag-neutral text-[10px]">
                                +{signals.length - 2}
                              </span>
                            )}
                          </div>
                          <div className="hidden sm:block shrink-0">
                            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                              {getStatusLabel(l.status)}
                            </span>
                          </div>
                        </Link>
                        <StreetViewButton
                          address={l.property.address}
                          city={l.property.city}
                          state={l.property.state}
                          zipCode={l.property.zipCode}
                          latitude={l.property.latitude}
                          longitude={l.property.longitude}
                          size={14}
                        />
                      </div>
                    );
                  })
                ) : (
                  <div className="px-5 py-8 text-center">
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {isLoading ? '' : 'No leads in database yet. Import your first leads to get started.'}
                    </p>
                  </div>
                )
              ) : (
                // Needs Review tab
                reviewLeads.length > 0 ? (
                  reviewLeads.map((lead: any) => {
                    const l = normalizeLead(lead);
                    let reviewSummary = '';
                    try {
                      const parsed = JSON.parse(l.needsReviewReason || '{}');
                      reviewSummary = parsed.summary || l.needsReviewReason || '';
                    } catch {
                      reviewSummary = l.needsReviewReason || '';
                    }

                    return (
                      <Link
                        key={l.id}
                        href={`/leads/${l.id}`}
                        className="flex items-center gap-4 px-5 py-3.5 ws-table-row"
                      >
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)' }}
                        >
                          <Info size={18} style={{ color: 'var(--warning)' }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {l.property.address}
                          </p>
                          <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                            {reviewSummary}
                          </p>
                        </div>
                        <div className="hidden sm:block shrink-0">
                          <span className="ws-tag ws-tag-warning text-[10px]">Review</span>
                        </div>
                      </Link>
                    );
                  })
                ) : (
                  <div className="px-5 py-8 text-center">
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {reviewLoading ? '' : 'No leads need review right now.'}
                    </p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="space-y-4 md:space-y-6">
          {/* Today's Activity */}
          <div className="ws-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Today&apos;s Activity
            </h3>
            <div className="space-y-3">
              <ActivityRow
                icon={Phone}
                label="Calls Made"
                value={stats.callsMadeToday || 0}
                color="var(--brand-deep)"
              />
              <ActivityRow
                icon={MessageSquare}
                label="Texts Sent"
                value={stats.textsSentToday || 0}
                color="var(--brand-ocean)"
              />
              <ActivityRow
                icon={ArrowUpRight}
                label="Responses"
                value={stats.responsesReceived || 0}
                color="var(--success)"
              />
              <ActivityRow
                icon={Clock}
                label="Follow-Ups Due"
                value={stats.followUpsDueToday || 0}
                color="var(--warning)"
              />
            </div>
          </div>

          {/* Follow-ups Due */}
          <div className="ws-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={16} style={{ color: 'var(--brand-deep)' }} />
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Follow-Ups Due
              </h3>
            </div>
            <div className="space-y-2">
              {followUpsDue.length > 0 ? (
                followUpsDue.map((lead: any) => {
                  const l = normalizeLead(lead);
                  return (
                    <Link
                      key={l.id}
                      href={`/leads/${l.id}`}
                      className="flex items-center gap-3 p-2 rounded-lg transition-colors duration-200 hover:bg-[var(--bg-elevated)]"
                    >
                      <CheckCircle2 size={14} style={{ color: 'var(--text-tertiary)' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {l.property.address}
                        </p>
                        <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                          {l.property.ownerName || '—'}
                        </p>
                      </div>
                      <span className="text-[10px] shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                        {l.nextFollowUp ? new Date(l.nextFollowUp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                      </span>
                    </Link>
                  );
                })
              ) : (
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  No follow-ups due today
                </p>
              )}
            </div>
          </div>

          {/* Pipeline Quick Stats */}
          <div className="ws-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Pipeline
            </h3>
            <div className="space-y-2.5">
              <PipelineRow label="Cold" count={stats.cold || 0} total={Math.max(stats.totalLeads || 1, 1)} color="var(--brand-cyan)" />
              <PipelineRow label="Contacted" count={stats.contacted || 0} total={Math.max(stats.totalLeads || 1, 1)} color="var(--brand-ocean)" />
              <PipelineRow label="Warm" count={stats.warm || 0} total={Math.max(stats.totalLeads || 1, 1)} color="var(--warning)" />
              <PipelineRow label="Hot" count={stats.hot || 0} total={Math.max(stats.totalLeads || 1, 1)} color="var(--danger)" />
              <PipelineRow label="Under Contract" count={stats.underContract || 0} total={Math.max(stats.totalLeads || 1, 1)} color="var(--success)" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================

function StatCard({
  label, value, subtext, icon: Icon, trend, iconColor,
}: {
  label: string; value: string; subtext: string; icon: any; trend?: string; iconColor?: string;
}) {
  return (
    <div className="ws-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <Icon size={16} style={{ color: iconColor || 'var(--brand-deep)' }} />
      </div>
      <p className="text-2xl font-bold font-display" style={{ color: 'var(--text-primary)' }}>{value}</p>
      <p className="text-xs mt-1" style={{ color: trend === 'up' ? 'var(--success)' : 'var(--text-tertiary)' }}>
        {trend === 'up' && <TrendingUp size={12} className="inline mr-1" />}
        {subtext}
      </p>
    </div>
  );
}

function ActivityRow({ icon: Icon, label, value, color }: { icon: any; label: string; value: number | string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <Icon size={14} style={{ color }} />
        </div>
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function PipelineRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = Math.max((count / total) * 100, 1);
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{count}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}
