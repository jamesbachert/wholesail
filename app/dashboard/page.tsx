'use client';

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
  Zap,
  Calendar,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { useDataMode } from '@/components/shared/DataModeProvider';
import { useApi } from '@/lib/hooks';
import {
  mockLeads,
  mockNotifications,
  mockDashboardStats,
  getScoreColorHex,
  getStatusLabel,
  getSignalTagColor,
  formatCurrency,
  timeAgo,
} from '@/lib/mockData';

export default function DashboardPage() {
  const { isLive } = useDataMode();

  // Live data hooks (only fetch when in live mode)
  const { data: liveLeadsData, loading: leadsLoading } = useApi(
    isLive ? '/api/leads?sortBy=totalScore&sortDir=desc&limit=5' : null
  );
  const { data: liveStats, loading: statsLoading } = useApi<any>(
    isLive ? '/api/dashboard' : null
  );

  // Use mock or live data
  const stats = isLive && liveStats ? liveStats : mockDashboardStats;
  const priorityLeads = isLive && liveLeadsData
    ? (liveLeadsData as any).leads?.slice(0, 5) || []
    : [...mockLeads].sort((a, b) => b.totalScore - a.totalScore).slice(0, 5);
  const notifications = isLive ? [] : mockNotifications;

  const timeSensitiveLeads = isLive
    ? priorityLeads.filter((l: any) => l.isTimeSensitive)
    : mockLeads.filter((l) => l.isTimeSensitive);
  const followUpsDue = isLive
    ? priorityLeads.filter((l: any) => l.nextFollowUp)
    : mockLeads.filter((l) => l.nextFollowUp);
  const unreadNotifications = notifications.filter((n: any) => !n.isRead);

  const isLoading = isLive && (leadsLoading || statsLoading);

  // Helper to normalize lead data shape (DB vs mock have slightly different structures)
  const normalizeLead = (lead: any) => {
    if (lead.property) return lead; // already has property nested
    return { ...lead, property: lead }; // mock format
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
          Loading live data...
        </div>
      )}

      {/* Urgent Alerts */}
      {unreadNotifications.length > 0 && (
        <div
          className="ws-card p-4 border-l-4"
          style={{ borderLeftColor: 'var(--danger)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {unreadNotifications.length} new alert{unreadNotifications.length > 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2">
            {unreadNotifications.map((n: any) => (
              <Link
                key={n.id}
                href={n.leadId ? `/leads/${n.leadId}` : '#'}
                className="flex items-start gap-3 p-2 rounded-lg transition-colors duration-200 hover:bg-[var(--bg-elevated)]"
              >
                <Zap size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--brand-cyan)' }} />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {n.title}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {n.message}
                  </p>
                </div>
                <span className="text-xs shrink-0 ml-auto" style={{ color: 'var(--text-tertiary)' }}>
                  {timeAgo(n.createdAt)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <StatCard
          label="Total Leads"
          value={(stats.totalLeads || 0).toLocaleString()}
          subtext={`+${stats.newThisWeek || 0} this week`}
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
        {/* Priority Leads - takes 2 cols */}
        <div className="lg:col-span-2">
          <div className="ws-card">
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: 'var(--border-primary)' }}
            >
              <div className="flex items-center gap-2">
                <Flame size={18} style={{ color: 'var(--brand-deep)' }} />
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Today&apos;s Priority Leads
                </h2>
              </div>
              <Link
                href="/leads"
                className="text-xs font-medium transition-colors duration-200 hover:underline"
                style={{ color: 'var(--brand-ocean)' }}
              >
                View all →
              </Link>
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {priorityLeads.length > 0 ? (
                priorityLeads.map((lead: any) => {
                  const l = normalizeLead(lead);
                  const signals = l.signals || [];
                  return (
                    <Link
                      key={l.id}
                      href={`/leads/${l.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 ws-table-row"
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
                          {l.isTimeSensitive && (
                            <span className="ws-tag ws-tag-danger text-[10px]">
                              <AlertTriangle size={10} /> Urgent
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                          {l.property.city} · {l.property.ownerName} · {formatCurrency(l.property.estimatedValue)}
                        </p>
                      </div>
                      <div className="hidden md:flex items-center gap-1.5 shrink-0">
                        {signals.slice(0, 2).map((s: any, i: number) => (
                          <span
                            key={i}
                            className={`ws-tag ws-tag-${getSignalTagColor(s.signalType)} text-[10px]`}
                          >
                            {s.label}
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
                  );
                })
              ) : (
                <div className="px-5 py-8 text-center">
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {isLive ? 'No leads in database yet. Import your first leads to get started.' : 'No leads found.'}
                  </p>
                </div>
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
                          {l.property.ownerName}
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
              <PipelineRow label="New" count={stats.newThisWeek || 0} total={Math.max(stats.totalLeads || 1, 1)} color="var(--brand-cyan)" />
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
// SUB-COMPONENTS (same as before)
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
