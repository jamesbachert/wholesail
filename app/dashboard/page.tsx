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
} from 'lucide-react';
import Link from 'next/link';
import {
  mockLeads,
  mockNotifications,
  mockDashboardStats as stats,
  getScoreColorHex,
  getStatusLabel,
  getSignalTagColor,
  formatCurrency,
  timeAgo,
} from '@/lib/mockData';

export default function DashboardPage() {
  const priorityLeads = [...mockLeads]
    .sort((a, b) => b.totalScore - a.totalScore)
    .slice(0, 5);

  const timeSensitiveLeads = mockLeads.filter((l) => l.isTimeSensitive);
  const followUpsDue = mockLeads.filter((l) => l.nextFollowUp);
  const unreadNotifications = mockNotifications.filter((n) => !n.isRead);

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
            {unreadNotifications.map((n) => (
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
          value={stats.totalLeads.toLocaleString()}
          subtext={`+${stats.newThisWeek} this week`}
          icon={Users}
          trend="up"
        />
        <StatCard
          label="Hot Leads"
          value={stats.hot.toString()}
          subtext={`${stats.warm} warm`}
          icon={Flame}
          iconColor="var(--danger)"
        />
        <StatCard
          label="Under Contract"
          value={stats.underContract.toString()}
          subtext={`${stats.closed} closed total`}
          icon={Target}
          iconColor="var(--success)"
        />
        <StatCard
          label="Handed Off"
          value={stats.handedOff.toString()}
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
              {priorityLeads.map((lead) => (
                <Link
                  key={lead.id}
                  href={`/leads/${lead.id}`}
                  className="flex items-center gap-4 px-5 py-3.5 ws-table-row"
                >
                  {/* Score */}
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ backgroundColor: getScoreColorHex(lead.totalScore) }}
                  >
                    {lead.totalScore}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {lead.property.address}
                      </p>
                      {lead.isTimeSensitive && (
                        <span className="ws-tag ws-tag-danger text-[10px]">
                          <AlertTriangle size={10} /> Urgent
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>
                      {lead.property.city} · {lead.property.ownerName} · {formatCurrency(lead.property.estimatedValue)}
                    </p>
                  </div>

                  {/* Top signals */}
                  <div className="hidden md:flex items-center gap-1.5 shrink-0">
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

                  {/* Status */}
                  <div className="hidden sm:block shrink-0">
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {getStatusLabel(lead.status)}
                    </span>
                  </div>
                </Link>
              ))}
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
                value={stats.callsMadeToday}
                color="var(--brand-deep)"
              />
              <ActivityRow
                icon={MessageSquare}
                label="Texts Sent"
                value={stats.textsSentToday}
                color="var(--brand-ocean)"
              />
              <ActivityRow
                icon={ArrowUpRight}
                label="Responses"
                value={stats.responsesReceived}
                color="var(--success)"
              />
              <ActivityRow
                icon={Clock}
                label="Avg. Time to Contact"
                value={`${stats.avgTimeToContact}h`}
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
                followUpsDue.map((lead) => (
                  <Link
                    key={lead.id}
                    href={`/leads/${lead.id}`}
                    className="flex items-center gap-3 p-2 rounded-lg transition-colors duration-200 hover:bg-[var(--bg-elevated)]"
                  >
                    <CheckCircle2 size={14} style={{ color: 'var(--text-tertiary)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {lead.property.address}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        {lead.property.ownerName}
                      </p>
                    </div>
                    <span className="text-[10px] shrink-0" style={{ color: 'var(--text-tertiary)' }}>
                      {lead.nextFollowUp ? new Date(lead.nextFollowUp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                    </span>
                  </Link>
                ))
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
              <PipelineRow label="New" count={stats.newThisWeek} total={stats.totalLeads} color="var(--brand-cyan)" />
              <PipelineRow label="Contacted" count={stats.contacted} total={stats.totalLeads} color="var(--brand-ocean)" />
              <PipelineRow label="Warm" count={stats.warm} total={stats.totalLeads} color="var(--warning)" />
              <PipelineRow label="Hot" count={stats.hot} total={stats.totalLeads} color="var(--danger)" />
              <PipelineRow label="Under Contract" count={stats.underContract} total={stats.totalLeads} color="var(--success)" />
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
  label,
  value,
  subtext,
  icon: Icon,
  trend,
  iconColor,
}: {
  label: string;
  value: string;
  subtext: string;
  icon: any;
  trend?: string;
  iconColor?: string;
}) {
  return (
    <div className="ws-card p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <Icon size={16} style={{ color: iconColor || 'var(--brand-deep)' }} />
      </div>
      <p className="text-2xl font-bold font-display" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>
      <p className="text-xs mt-1" style={{ color: trend === 'up' ? 'var(--success)' : 'var(--text-tertiary)' }}>
        {trend === 'up' && <TrendingUp size={12} className="inline mr-1" />}
        {subtext}
      </p>
    </div>
  );
}

function ActivityRow({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${color}15` }}
        >
          <Icon size={14} style={{ color }} />
        </div>
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
      </div>
      <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        {value}
      </span>
    </div>
  );
}

function PipelineRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = Math.max((count / total) * 100, 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
          {count}
        </span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--bg-elevated)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
