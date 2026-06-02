import React, { useState, useEffect } from 'react';
import { isConfigured, auth } from './firebase';
import { signOut } from 'firebase/auth';
import SetupBanner from './components/SetupBanner';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import GroupManager from './components/GroupManager';
import MembersList from './components/MembersList';
import MyBalance from './components/MyBalance';
import ExpenseList from './components/ExpenseList';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState(null);
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // If Firebase is not configured, show instructions
  if (!isConfigured) {
    return <SetupBanner />;
  }

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      // Reset active group if user logs out
      if (!currentUser) {
        setActiveGroup(null);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center">
        <div className="text-center space-y-4">
          <svg className="animate-spin h-10 w-10 text-indigo-500 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-slate-400 text-sm">Loading Trip Tracker...</p>
        </div>
      </div>
    );
  }

  // Not logged in -> Show Login/Register Page
  if (!user) {
    return <Login />;
  }

  // Helper to check if a tab is active
  const isActive = (tab) => currentTab === tab;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Navbar Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">

            {/* Logo / Brand */}
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentTab('dashboard')}>
              <div className="bg-indigo-650 p-2 rounded-xl text-white shadow-md">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <span className="font-extrabold text-lg text-white tracking-tight">TripExpense</span>
            </div>

            {/* Middle Active Group Indicator */}
            {activeGroup && (
              <div className="hidden sm:flex items-center space-x-2 bg-slate-850 px-4 py-1.5 rounded-full border border-slate-750 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-slate-400">Current Trip:</span>
                <span className="font-bold text-white max-w-[120px] truncate">{activeGroup.name}</span>
                <button
                  onClick={() => setCurrentTab('groups')}
                  className="text-indigo-400 hover:text-indigo-350 ml-1.5 font-semibold"
                >
                  Change
                </button>
              </div>
            )}

            {/* Desktop Account Menu */}
            <div className="hidden md:flex items-center space-x-4">
              <div className="text-right">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Logged In As</p>
                <p className="text-xs font-medium text-slate-300 max-w-[180px] truncate" title={user.email}>
                  {user.email}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-700 transition-all"
              >
                Sign Out
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="flex md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 focus:outline-none transition-colors"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>

          </div>
        </div>

        {/* Mobile menu panel */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-900 px-4 pt-2 pb-4 space-y-3">
            {activeGroup && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 truncate">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                  <span className="text-slate-400 truncate">Trip: {activeGroup.name}</span>
                </div>
                <button
                  onClick={() => {
                    setCurrentTab('groups');
                    setMobileMenuOpen(false);
                  }}
                  className="text-indigo-400 hover:text-indigo-350 font-bold shrink-0"
                >
                  Change
                </button>
              </div>
            )}
            <div className="text-xs text-slate-400 px-1 truncate">
              User: <span className="font-semibold text-slate-350">{user.email}</span>
            </div>
            <button
              onClick={() => {
                handleSignOut();
                setMobileMenuOpen(false);
              }}
              className="w-full bg-slate-950 hover:bg-slate-900 text-slate-350 hover:text-white border border-slate-850 py-2 rounded-xl text-xs font-semibold transition-all"
            >
              Sign Out
            </button>
          </div>
        )}
      </header>

      {/* Main Container */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col gap-6">

        {/* Navigation Tabs - Only shown when user has selected an active group */}
        {activeGroup ? (
          <nav className="flex space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800 self-start w-full sm:w-auto">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`flex-1 sm:flex-initial px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${isActive('dashboard')
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-650/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setCurrentTab('expenses')}
              className={`flex-1 sm:flex-initial px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${isActive('expenses')
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-650/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
            >
              Expenses
            </button>
            <button
              onClick={() => setCurrentTab('members')}
              className={`flex-1 sm:flex-initial px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${isActive('members')
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-650/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
            >
              Members
            </button>

            <button
              onClick={() => setCurrentTab('balance')}
              className={`flex-1 sm:flex-initial px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${isActive('balance')
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-650/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
            >
              My Balance
            </button>


            <button
              onClick={() => setCurrentTab('groups')}
              className={`flex-1 sm:flex-initial px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all ${isActive('groups')
                ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-650/20'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
            >
              Groups
            </button>
          </nav>
        ) : (
          /* Warning Banner when no group selected */
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl p-4 text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
            <div className="flex items-start space-x-2">
              <svg className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="font-bold">No Active Group Selected</p>
                <p className="text-xs text-amber-400/80">Please select an existing group or create a new one below to start logging trip expenses.</p>
              </div>
            </div>
            <button
              onClick={() => setCurrentTab('groups')}
              className="bg-amber-500 hover:bg-amber-450 text-slate-950 font-bold px-4 py-1.5 rounded-lg text-xs transition-all shrink-0 shadow-sm"
            >
              Go to Groups
            </button>
          </div>
        )}

        {/* Routed Content Views */}
        <div className="flex-grow">
          {activeGroup && isActive('dashboard') && (
            <Dashboard activeGroup={activeGroup} />
          )}
          {activeGroup && isActive('expenses') && (
            <ExpenseList activeGroup={activeGroup} />
          )}
          {activeGroup && isActive('members') && (
            <MembersList activeGroup={activeGroup} />
          )}
          {activeGroup && isActive('balance') && (
            <MyBalance activeGroup={activeGroup} />
          )}
          {(!activeGroup || isActive('groups')) && (
            <GroupManager
              selectedGroupId={activeGroup?.id}
              onSelectGroup={(group) => {
                setActiveGroup(group);
                setCurrentTab('dashboard');
              }}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 border-t border-slate-850 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 gap-2">
          <p>&copy; 2026 Trip Expense Tracker. All rights reserved.</p>
          <div className="flex space-x-4">
            <span>Powered by React, Tailwind & Firebase</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
