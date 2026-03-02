'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Users,
  Send,
  Settings,
  ChevronLeft,
  ChevronRight,
  Handshake,
} from 'lucide-react';
import { useSidebar } from './SidebarContext';
import { clsx } from 'clsx';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/handoff', label: 'Hand-Off', icon: Handshake },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const { isExpanded, toggleSidebar } = useSidebar();
  const pathname = usePathname();

  return (
    <aside
      className={clsx(
        'h-screen flex flex-col border-r sidebar-transition relative',
        isExpanded ? 'w-[260px]' : 'w-[72px]'
      )}
      style={{
        backgroundColor: 'var(--bg-sidebar)',
        borderColor: 'var(--border-primary)',
      }}
    >
      {/* Logo Area */}
      <div
        className={clsx(
          'h-16 flex items-center border-b shrink-0',
          isExpanded ? 'px-5' : 'px-0 justify-center'
        )}
        style={{ borderColor: 'var(--border-primary)' }}
      >
        {isExpanded ? (
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm"
              style={{ background: 'linear-gradient(135deg, var(--brand-deep), var(--brand-cyan))' }}
            >
              W
            </div>
            <span
              className="font-display font-bold text-lg tracking-tight sidebar-text-transition"
              style={{ color: 'var(--text-primary)' }}
            >
              WholeSail
            </span>
          </div>
        ) : (
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-bold text-sm"
            style={{ background: 'linear-gradient(135deg, var(--brand-deep), var(--brand-cyan))' }}
          >
            W
          </div>
        )}
      </div>

      {/* Main Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        <div className={clsx('mb-3', isExpanded ? 'px-2' : 'px-0')}>
          {isExpanded && (
            <span
              className="text-[10px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--text-tertiary)' }}
            >
              Main
            </span>
          )}
        </div>

        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 rounded-lg transition-all duration-200 group',
                isExpanded ? 'px-3 py-2.5' : 'px-0 py-2.5 justify-center',
                isActive
                  ? 'text-white'
                  : 'hover:bg-[var(--bg-elevated)]'
              )}
              style={
                isActive
                  ? { backgroundColor: 'var(--brand-deep)' }
                  : { color: 'var(--text-secondary)' }
              }
              title={!isExpanded ? item.label : undefined}
            >
              <Icon size={20} className="shrink-0" />
              {isExpanded && (
                <span className="text-sm font-medium sidebar-text-transition">
                  {item.label}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse Toggle Button */}
      <div
        className="shrink-0 border-t p-3"
        style={{ borderColor: 'var(--border-primary)' }}
      >
        <button
          onClick={toggleSidebar}
          className={clsx(
            'flex items-center gap-2 rounded-lg py-2 transition-all duration-200 hover:bg-[var(--bg-elevated)] w-full',
            isExpanded ? 'px-3' : 'px-0 justify-center'
          )}
          style={{ color: 'var(--text-secondary)' }}
          title={isExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
        >
          {isExpanded ? (
            <>
              <ChevronLeft size={18} />
              <span className="text-sm sidebar-text-transition">Collapse</span>
            </>
          ) : (
            <ChevronRight size={18} />
          )}
        </button>
      </div>
    </aside>
  );
}
