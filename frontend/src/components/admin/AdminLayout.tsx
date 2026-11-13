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
    <div className="min-h-screen bg-[#161218] text-[#F3EEE8] flex flex-col md:flex-row antialiased selection:bg-[#743C49] selection:text-white">
      {/* Mobile Top Bar */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-[#1F1922] border-b border-[#392F3E] sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-[2px] bg-[#29202B] border border-[#743C49]/40 flex items-center justify-center font-serif font-bold text-white shadow-xs">
            TB
          </div>
          <div>
            <div className="text-sm font-serif font-bold tracking-wide text-white">TailorBird</div>
            <div className="text-[10px] tracking-wider uppercase text-[#D5A6A0] font-mono font-medium">Admin Atelier</div>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-[2px] bg-[#29202B] text-[#D5A6A0] hover:text-white focus:outline-none cursor-pointer"
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside
        className={`fixed md:sticky top-0 left-0 h-screen w-72 bg-[#1F1922] border-r border-[#392F3E] flex flex-col justify-between z-40 transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-5 flex flex-col gap-6">
          {/* Logo & Console Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[3px] bg-[#29202B] flex items-center justify-center font-serif font-bold text-white shadow-xs border border-[#743C49]/40">
              <Sparkles size={18} className="text-[#D5A6A0]" />
            </div>
            <div>
              <div className="text-base font-serif font-bold tracking-tight text-white flex items-center gap-1.5">
                TailorBird
                <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded-[2px] bg-[#743C49]/20 text-[#D5A6A0] border border-[#743C49]/30">
                  AI CORE
                </span>
              </div>
              <div className="text-xs text-[#777078] font-mono">Model Ops & Governance</div>
            </div>
          </div>

          {/* System Status Pill */}
          <div className="px-3 py-2 rounded-[2px] bg-[#241D27] border border-[#392F3E] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-xs font-mono text-[#F3EEE8]">Cluster: Active</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/60 px-1.5 py-0.5 rounded-[2px] border border-emerald-800/50">
              Dual AI Loaded
            </span>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col gap-1.5">
            <div className="text-[10px] font-mono font-semibold uppercase tracking-[0.16em] text-[#777078] px-3 py-1">
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
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-[2px] text-xs font-mono uppercase tracking-[0.12em] transition-all ${
                    isActive
                      ? 'bg-[#29202B] text-[#F3EEE8] border border-[#743C49]/60 shadow-xs'
                      : 'text-[#777078] hover:text-[#F3EEE8] hover:bg-[#241D27]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={16} className={isActive ? 'text-[#D5A6A0]' : 'text-[#777078]'} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[9px] font-mono px-1.5 py-0.2 rounded-[2px] ${
                        isActive
                          ? 'bg-[#743C49]/30 text-[#D5A6A0] border border-[#743C49]/40'
                          : 'bg-[#161218] text-[#777078]'
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
        <div className="p-4 border-t border-[#392F3E] bg-[#161218] flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[2px] bg-[#241D27] border border-[#392F3E] flex items-center justify-center font-mono text-xs font-bold text-[#D5A6A0]">
                <Shield size={14} className="text-[#D5A6A0]" />
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-[#F3EEE8]">Administrator</div>
                <div className="text-[10px] text-[#777078] font-mono">admin@tailorbird</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Sign out of Admin Console"
              className="p-2 rounded-[2px] bg-[#241D27] hover:bg-[#743C49]/30 hover:text-rose-300 text-[#777078] border border-[#392F3E] hover:border-[#743C49]/50 transition-colors cursor-pointer"
            >
              <LogOut size={16} />
            </button>
          </div>

          <div className="text-[10px] text-center text-[#777078] font-mono">
            TailorBird Production AI v1.0.0
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 bg-[#161218] overflow-y-auto">
        <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
