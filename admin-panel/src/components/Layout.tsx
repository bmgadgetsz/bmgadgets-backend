import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { 
  BarChart3, Package, ShoppingBag, LayoutTemplate,
  ShieldAlert, LogOut, Menu, X,
  ChevronRight, Zap
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const navigationItems = [
  {
    id: 'overview',
    name: 'Dashboard',
    icon: BarChart3,
    description: 'Analytics & KPIs',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    activeBg: 'bg-indigo-500',
  },
  {
    id: 'products',
    name: 'Products & Stock',
    icon: Package,
    description: 'Catalog & inventory',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    activeBg: 'bg-emerald-500',
  },
  {
    id: 'orders',
    name: 'Orders & Logistics',
    icon: ShoppingBag,
    description: 'Shipments & tracking',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    activeBg: 'bg-amber-500',
  },
  {
    id: 'cms',
    name: 'CMS & Curation',
    icon: LayoutTemplate,
    description: 'Content & banners',
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    activeBg: 'bg-sky-500',
  },
  {
    id: 'operations',
    name: 'Operations & Staff',
    icon: ShieldAlert,
    description: 'Roles & access control',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    activeBg: 'bg-rose-500',
  },
];

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  const { user, clearSession } = useAuthStore();

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  const activeItem = navigationItems.find(n => n.id === activeTab);

  const SidebarContent = () => (
    <div className="flex flex-col h-full" style={{ background: '#0c0e14', borderRight: '1px solid #1a1d2e' }}>
      
      {/* Brand Header */}
      <div className="px-5 py-5 border-b" style={{ borderColor: '#1a1d2e' }}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-sm text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              BM
            </div>
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#0c0e14]" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight text-white">BMGadgets</h1>
            <p className="text-[9px] text-slate-500 font-semibold tracking-widest uppercase mt-0.5">Admin Console</p>
          </div>
        </div>

        {/* Live Clock */}
        <div className="mt-4 px-3 py-2.5 rounded-xl flex items-center justify-between" style={{ background: '#13151f' }}>
          <div>
            <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">Live System Time</p>
            <p className="text-xs font-bold text-slate-300 mt-0.5 tabular-nums">
              {time.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
          <Zap className="w-3.5 h-3.5 text-amber-400" />
        </div>
      </div>

      {/* Nav section label */}
      <div className="px-5 pt-5 pb-2">
        <p className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">Navigation</p>
      </div>

      {/* Nav Links */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto pb-4">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className={`group relative flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 text-left ${
                isActive
                  ? 'text-white shadow-lg'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
              style={isActive ? {
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                boxShadow: '0 4px 16px rgba(99,102,241,0.35)'
              } : { background: 'transparent' }}
              onMouseEnter={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = '#13151f';
              }}
              onMouseLeave={e => {
                if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                isActive ? 'bg-white/20' : item.bg
              }`}>
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : item.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold leading-tight truncate">{item.name}</p>
                <p className={`text-[9px] font-medium leading-tight truncate ${isActive ? 'text-white/60' : 'text-slate-600'}`}>
                  {item.description}
                </p>
              </div>
              {isActive && <ChevronRight className="w-3.5 h-3.5 text-white/60 flex-shrink-0" />}
            </button>
          );
        })}
      </nav>

      {/* Profile & Logout */}
      <div className="p-3 border-t" style={{ borderColor: '#1a1d2e', background: '#0a0b10' }}>
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl mb-2" style={{ background: '#13151f' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
            <span className="text-xs font-black text-white">
              {user?.name?.slice(0, 1).toUpperCase() || 'A'}
            </span>
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <h4 className="text-xs font-bold truncate text-slate-200">{user?.name || 'Administrator'}</h4>
            <p className="text-[9px] text-slate-500 font-semibold truncate capitalize mt-0.5">
              {user?.role?.name || 'Super Admin'}
            </p>
          </div>
        </div>
        <button
          onClick={clearSession}
          className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-xl text-[11px] font-bold text-red-400 transition-all duration-200"
          style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.14)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.06)')}
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex" style={{ background: '#f0f2f7' }}>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-60 z-20">
        <SidebarContent />
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col lg:pl-60 min-h-screen">

        {/* Top Header Bar */}
        <header className="sticky top-0 z-30 flex items-center gap-4 px-5 py-3.5 border-b"
          style={{ background: 'rgba(240,242,247,0.85)', backdropFilter: 'blur(16px)', borderColor: '#e2e8f0' }}>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-2 flex-1">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:block">BMGadgets</span>
            <ChevronRight className="w-3 h-3 text-slate-300 hidden sm:block" />
            <div className="flex items-center gap-1.5">
              {activeItem && (
                <div className={`w-5 h-5 rounded-md flex items-center justify-center ${activeItem.bg}`}>
                  <activeItem.icon className={`w-2.5 h-2.5 ${activeItem.color}`} />
                </div>
              )}
              <span className="text-sm font-bold text-slate-800">{activeItem?.name || 'Dashboard'}</span>
            </div>
          </div>

          {/* Right side: live indicator + user pill */}
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-700">Live</span>
            </div>
            <div className="w-7 h-7 rounded-lg flex items-center justify-center font-black text-xs text-white"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              {user?.name?.slice(0, 1).toUpperCase() || 'A'}
            </div>
          </div>
        </header>

        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <div
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
            />
            <div className="relative flex flex-col w-[240px] h-full animate-slide-in shadow-2xl z-10">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="absolute top-3 right-3 p-1.5 rounded-lg z-20"
                style={{ background: '#1a1d2e', color: '#94a3b8' }}
              >
                <X className="w-4 h-4" />
              </button>
              <SidebarContent />
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 px-4 py-6 md:px-7 md:py-7 max-w-[1400px] w-full mx-auto animate-fade-up">
          {children}
        </main>
      </div>
    </div>
  );
};
