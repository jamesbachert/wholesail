'use client';

import { buildPropertyStory, PropertyStoryEvent } from '@/lib/property-story';
import { BookOpen } from 'lucide-react';

interface PropertyStoryTimelineProps {
  property: {
    yearBuilt?: number | null;
    purchaseDate?: string | Date | null;
    purchasePrice?: number | null;
  };
  signals: Array<{
    signalType: string;
    label: string;
    category: string;
    value: string | null;
    eventDate: string | Date | null;
    isActive: boolean;
  }>;
}

export function PropertyStoryTimeline({ property, signals }: PropertyStoryTimelineProps) {
  const events = buildPropertyStory(property, signals);

  if (events.length < 2) {
    return (
      <div className="ws-card p-5">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen size={16} style={{ color: 'var(--text-tertiary)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Property Story
          </h3>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
          No property events yet — run enrichment to populate the timeline.
        </p>
      </div>
    );
  }

  return (
    <div className="ws-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BookOpen size={16} style={{ color: 'var(--text-tertiary)' }} />
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Property Story
          </h3>
        </div>
        <span className="text-[11px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
          {events.length} events
        </span>
      </div>
      <div className="relative pl-4">
        {/* Connecting line */}
        <div
          className="absolute left-[5px] top-[6px] w-px"
          style={{
            backgroundColor: 'var(--border-primary)',
            height: `calc(100% - 12px)`,
          }}
        />
        {/* Events */}
        <div className="space-y-2.5">
          {events.map((event, i) => (
            <TimelineEvent key={i} event={event} />
          ))}
        </div>
      </div>
    </div>
  );
}

function TimelineEvent({ event }: { event: PropertyStoryEvent }) {
  return (
    <div className="relative flex items-start gap-3">
      {/* Dot */}
      <div
        className="w-[11px] h-[11px] rounded-full shrink-0 mt-[3px] -ml-4 z-10"
        style={{
          backgroundColor: 'var(--text-tertiary)',
          border: '2px solid var(--bg-surface)',
        }}
      />
      {/* Content */}
      <div className="flex items-baseline gap-1.5 min-w-0">
        <span className="text-sm font-semibold shrink-0" style={{ color: 'var(--text-primary)' }}>
          {event.year}
        </span>
        <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>—</span>
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {event.label}
          {event.detail && (
            <span style={{ color: 'var(--text-tertiary)' }}> ({event.detail})</span>
          )}
        </span>
      </div>
    </div>
  );
}
