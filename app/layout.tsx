import type { Metadata } from 'next';
import { ThemeProvider } from '@/components/shared/ThemeProvider';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { SidebarProvider } from '@/components/layout/SidebarContext';
import { MobileNav } from '@/components/layout/MobileNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'WholeSail — Wholesale Smarter. Close Faster.',
  description: 'Lead intelligence platform for real estate wholesalers',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="font-body antialiased"
        style={{ fontFamily: 'var(--font-body)' }}
      >
        <ThemeProvider>
            <SidebarProvider>
              <div className="flex h-screen overflow-hidden">
                {/* Desktop Sidebar */}
                <div className="hidden md:block">
                  <Sidebar />
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                  <TopBar />
                  <main
                    className="flex-1 overflow-y-auto p-4 md:p-6"
                    style={{ backgroundColor: 'var(--bg-primary)' }}
                  >
                    {children}
                  </main>
                </div>

                {/* Mobile Bottom Nav */}
                <div className="block md:hidden">
                  <MobileNav />
                </div>
              </div>
            </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
