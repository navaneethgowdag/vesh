import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Brain,
  Sliders,
  Clock,
  Settings,
  LogOut,
  Shield,
  Activity,
  Layers,
  ChevronRight,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';
import { api, adminTokenStorage } from '../../services/api';

export const AdminLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await api.admin.logout();
    } catch (e) {
      console.warn('Admin logout API returned error', e);
    } finally {
      adminTokenStorage.clear();
      setIsLoggingOut(false);
      navigate('/admin/login', { replace: true });
    }
  };

  const navItems = [
    {
      to: '/admin/overview',
      label: 'Overview',
      icon: LayoutDashboard,
      badge: 'Live',
    },
    {
      to: '/admin/clothing-model',
      label: 'Clothing Classifier',
      icon: Brain,
      badge: '9 Heads',
    },
    {
      to: '/admin/recommendation-model',
      label: 'Recommendation ML',
      icon: Sliders,
      badge: '42 Features',
    },
    {
      to: '/admin/training-history',
      label: 'Training History',
      icon: Clock,
      badge: null,
    },
    {
      to: '/admin/settings',
      label: 'Admin Settings',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <div className="min-h-screen bg-[#141715] text-[#F8F6F1] flex flex-col md:flex-row antialiased selection:bg-[#727D69] selection:text-white">
      {/* Mobile Top Bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#1C201D] border-b border-[#2D342F] sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#202321] border border-[#B5AA99]/40 flex items-center justify-center font-serif font-bold text-white shadow-xs">
            TB
          </div>
          <div>
            <div className="text-sm font-serif font-bold tracking-wide text-white">TailorBird</div>
            <div className="text-[10px] tracking-wider uppercase text-[#B5AA99] font-mono font-medium">Admin Console</div>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-lg bg-[#242A25] text-[#A3ABA0] hover:text-white focus:outline-none"
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-72 bg-[#1C201D] border-r border-[#2D342F] flex flex-col justify-between z-40 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-5 flex flex-col gap-6">
          {/* Logo & Console Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#202321] flex items-center justify-center font-serif font-bold text-white shadow-xs border border-[#B5AA99]/40">
              <Sparkles size={20} className="text-[#B5AA99]" />
            </div>
            <div>
              <div className="text-base font-serif font-bold tracking-tight text-white flex items-center gap-1.5">
                TailorBird
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-[#899783]/20 text-[#899783] border border-[#899783]/30">
                  AI CORE
                </span>
              </div>
              <div className="text-xs text-[#A3ABA0] font-medium font-sans">Model Ops & Governance</div>
            </div>
          </div>

          {/* System Status Pill */}
          <div className="px-3 py-2 rounded-xl bg-[#242A25] border border-[#2D342F] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-mono text-[#F8F6F1]">Cluster: Active</span>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/50">
              Dual AI Loaded
            </span>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col gap-1.5">
            <div className="text-[11px] font-mono font-semibold uppercase tracking-wider text-[#777C75] px-3 py-1">
              Model Management
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive =
                location.pathname === item.to ||
                (item.to === '/admin/overview' && location.pathname === '/admin');

              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#242A25] text-white border border-[#727D69]/60 shadow-xs'
                      : 'text-[#A3ABA0] hover:text-white hover:bg-[#242A25]/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={18} className={isActive ? 'text-[#899783]' : 'text-[#777C75]'} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-[#899783]/20 text-[#899783] border border-[#899783]/30'
                          : 'bg-[#242A25] text-[#A3ABA0]'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer: Admin Profile & Logout */}
        <div className="p-4 border-t border-[#2D342F] bg-[#141715]/90 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-[#242A25] border border-[#2D342F] flex items-center justify-center font-mono text-xs font-bold text-[#A3ABA0]">
                <Shield size={14} className="text-[#899783]" />
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-[#F8F6F1]">Administrator</div>
                <div className="text-[10px] text-[#777C75] font-mono">admin@tailorbird</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Sign out of Admin Console"
              className="p-2 rounded-lg bg-[#242A25] hover:bg-rose-950/40 hover:text-rose-400 text-[#A3ABA0] border border-[#2D342F] hover:border-rose-800/40 transition-colors cursor-pointer"
            >
              <LogOut size={16} />
            </button>
          </div>

          <div className="text-[11px] text-center text-[#777C75] font-mono">
            TailorBird Production AI v1.0.0
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 bg-[#141715] overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
