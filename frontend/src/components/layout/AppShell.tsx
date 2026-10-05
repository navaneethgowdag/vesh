import React, { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileNavigation } from './MobileNavigation';
import { RightSidebar } from './RightSidebar';
import { ToastContainer } from '../ui/ToastContainer';

interface AppShellProps {
  children: ReactNode;
  showRightSidebar?: boolean;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  showRightSidebar = false,
}) => {
  return (
    <div className="min-h-screen bg-cream-100 flex flex-col antialiased">
      {/* Top bar on Mobile / Tablet */}
      <TopBar />

      <div className="flex-1 flex w-full max-w-[1600px] mx-auto">
        {/* Left Sidebar on Desktop */}
        <Sidebar />

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 pb-24 lg:pb-12 px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="max-w-4xl mx-auto">{children}</div>
        </main>

        {/* Right Sidebar on Desktop (if active for page) */}
        {showRightSidebar && <RightSidebar />}
      </div>

      {/* Bottom Navigation for Mobile */}
      <MobileNavigation />

      {/* Global Toast Alerts */}
      <ToastContainer />
    </div>
  );
};

