import React, { useState, useEffect, useCallback } from 'react';
import { isConfigured, auth } from './firebase';
import { signOut } from 'firebase/auth';
import SetupBanner from './components/SetupBanner';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import GroupManager from './components/GroupManager';
import MembersList from './components/MembersList';
import MyBalance from './components/MyBalance';
import ExpenseList from './components/ExpenseList';

// ─── Sidebar nav items ────────────────────────────────────────────────────────

const SIDEBAR_TABS = [
  {
    id: 'dashboard', label: 'Dashboard',
    icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  },
  {
    id: 'expenses', label: 'Expenses',
    icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  },
  {
    id: 'balance', label: 'My Balance',
    icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>,
  },
  {
    id: 'members', label: 'Members',
    icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  },
  {
    id: 'settlements', label: 'Settlements',
    icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>,
  },
  {
    id: 'reports', label: 'Reports',
    icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  },
  {
    id: 'groups', label: 'Group Settings',
    icon: <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  },
];

const MOBILE_TABS = [
  { id: 'dashboard',   label: 'Dashboard'  },
  { id: 'expenses',    label: 'Expenses'   },
  { id: 'balance',     label: 'My Balance' },
  { id: 'members',     label: 'Members'    },
];

// Kept for backward compat (GroupManager + other consumers may reference this)
const GROUP_TABS = SIDEBAR_TABS;

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const [user,        setUser]        = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState(null);
  const [currentTab,  setCurrentTab]  = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ── Auth listener ────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
      setAuthLoading(false);
      if (!u) setActiveGroup(null);
    });
    return unsub;
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleSignOut = useCallback(async () => {
    try { await signOut(auth); } catch (e) { console.error('Sign out:', e); }
  }, []);

  const handleSelectGroup = useCallback((group) => {
    setActiveGroup(group);
    setCurrentTab('dashboard');
  }, []);

  const handleTabChange = useCallback((tab) => {
    setCurrentTab(tab);
    setSidebarOpen(false);
  }, []);

  // ── Early returns ─────────────────────────────────────────────────────────────
  if (!isConfigured) return <SetupBanner />;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center space-y-4">
          <svg className="animate-spin h-10 w-10 text-emerald-500 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-gray-500 text-sm font-medium">Loading TravelFund…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Login />;

  const isActive    = (tab) => currentTab === tab;
  const userInitials = user.email ? user.email.slice(0, 2).toUpperCase() : 'U';
  const userName     = user.displayName || user.email?.split('@')[0] || 'User';

  // Tabs that fall back to GroupManager
  const isGroupManagerTab = (tab) => ['groups', 'settlements', 'reports'].includes(tab);

  return (
    <div className="min-h-screen bg-gray-50 flex" style={{ fontFamily: "'DM Sans', 'Nunito', sans-serif" }}>

      {/* ── Mobile sidebar backdrop ─────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Left Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-[240px] bg-white border-r border-gray-100 z-40
          flex flex-col transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:relative lg:translate-x-0 lg:flex shrink-0
        `}
      >
        {/* Logo */}
        <div className="px-5 py-[18px] border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-500 rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 text-[13px] leading-tight">TravelFund</p>
            <p className="text-gray-400 text-[10px] leading-tight truncate">Travel together, manage better</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto" aria-label="Sidebar navigation">
          {SIDEBAR_TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleTabChange(id)}
              className={`w-full flex items-center gap-3 px-3 py-[9px] rounded-xl text-[13px] font-medium transition-all duration-150 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                isActive(id)
                  ? 'bg-emerald-50 text-emerald-700 font-semibold'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
              }`}
            >
              <span className={`flex-shrink-0 ${isActive(id) ? 'text-emerald-600' : 'text-gray-400'}`}>
                {icon}
              </span>
              {label}
            </button>
          ))}
        </nav>

        {/* Current trip card */}
        {activeGroup && (
          <div className="mx-3 mb-3 p-3.5 bg-gray-50 rounded-2xl border border-gray-100">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[12px] font-bold text-gray-800 truncate">{activeGroup.name}</p>
                {activeGroup.startDate && activeGroup.endDate && (
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {activeGroup.startDate} – {activeGroup.endDate}
                  </p>
                )}
                {activeGroup.memberCount != null && (
                  <p className="text-[11px] text-gray-400 mt-0.5">{activeGroup.memberCount} Members</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleTabChange('groups')}
                className="text-gray-300 hover:text-gray-500 transition-colors mt-0.5 flex-shrink-0"
                aria-label="Close trip"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Profile section */}
        <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 text-xs font-bold flex-shrink-0">
              {userInitials}
            </div>
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-gray-800 truncate max-w-[100px]" title={user.email}>
                {userName}
              </p>
              <span className="inline-block text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-px rounded font-semibold leading-tight">
                Admin
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {/* Theme toggle (visual only) */}
            <button
              type="button"
              className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label="Toggle theme"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label="Sign out"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* ── Right content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Mobile top bar */}
        <header className="lg:hidden bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-0 z-20">
          <button
            type="button"
            aria-label="Open sidebar"
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-gray-800 text-sm">
              {activeGroup?.name ?? 'TravelFund'}
            </span>
            {activeGroup && (
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
          <button type="button" className="relative p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors" aria-label="Notifications">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-red-500 rounded-full" aria-hidden="true" />
          </button>
        </header>

        {/* Main */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 lg:pb-6">

          {/* No group warning */}
          {!activeGroup && !isGroupManagerTab(currentTab) && (
            <div
              role="alert"
              className="mb-5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-4 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
            >
              <div className="flex items-start gap-2">
                <svg className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <p className="font-semibold text-amber-800">No Active Group Selected</p>
                  <p className="text-xs text-amber-600 mt-0.5">Select or create a group below to start tracking expenses.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleTabChange('groups')}
                className="bg-amber-500 hover:bg-amber-400 text-white font-semibold px-4 py-1.5 rounded-lg text-xs transition-colors shrink-0"
              >
                Go to Groups
              </button>
            </div>
          )}

          {/* Routed views */}
          {activeGroup && isActive('dashboard')    && <Dashboard   activeGroup={activeGroup} onTabChange={handleTabChange} />}
          {activeGroup && isActive('expenses')     && <ExpenseList activeGroup={activeGroup} />}
          {activeGroup && isActive('members')      && <MembersList activeGroup={activeGroup} />}
          {activeGroup && isActive('balance')      && <MyBalance   activeGroup={activeGroup} />}
          {(!activeGroup || isGroupManagerTab(currentTab)) && (
            <GroupManager selectedGroupId={activeGroup?.id} onSelectGroup={handleSelectGroup} />
          )}
        </main>

        {/* Mobile bottom nav */}
        <nav
          aria-label="Mobile bottom navigation"
          className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex items-center z-20"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          {MOBILE_TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => handleTabChange(id)}
              className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 text-[10px] font-medium transition-colors ${
                isActive(id) ? 'text-emerald-600' : 'text-gray-400'
              }`}
            >
              {/* Reuse sidebar icon at smaller size */}
              <span className="w-5 h-5">
                {SIDEBAR_TABS.find((t) => t.id === id)?.icon}
              </span>
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleTabChange('groups')}
            className={`flex-1 flex flex-col items-center justify-center py-3 gap-1 text-[10px] font-medium transition-colors ${
              isActive('groups') ? 'text-emerald-600' : 'text-gray-400'
            }`}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
            </svg>
            More
          </button>
        </nav>
      </div>
    </div>
  );
}