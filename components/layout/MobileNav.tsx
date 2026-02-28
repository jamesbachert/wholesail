'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Handshake, Settings } from 'lucide-react';
import { clsx } from 'clsx';

const mobileNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/leads', label: 'Leads', icon: Users },
  { href: '/handoff', label: 'Hand-Off', icon: Handshake },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 border-t z-50 safe-area-bottom"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-primary)',
      }}
    >
      <div className="flex items-center justify-around py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
        {mobileNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'flex flex-col items-center gap-1 px-3 py-1 rounded-lg transition-colors duration-200',
              )}
              style={{
                color: isActive ? 'var(--brand-deep)' : 'var(--text-tertiary)',
              }}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
