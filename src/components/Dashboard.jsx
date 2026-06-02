import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS = {
  Food:     'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Hotel:    'bg-sky-500/10 text-sky-400 border-sky-500/20',
  Fuel:     'bg-red-500/10 text-red-400 border-red-500/20',
  Travel:   'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Shopping: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Other:    'bg-slate-500/10 text-slate-400 border-slate-500/20',
};

const formatCurrency = (value) =>
  `₹${Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ label, value, icon, iconBg, valueColor = 'text-white' }) {
  return (
    <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-lg flex items-center justify-between min-h-[130px] hover:border-slate-600/60 transition-colors duration-200">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
          {label}
        </p>
        <p className={`text-2xl font-bold ${valueColor} leading-tight`}>{value}</p>
      </div>
      <div className={`p-3 rounded-xl ${iconBg} flex-shrink-0`}>{icon}</div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center items-center py-16">
      <svg
        className="animate-spin h-9 w-9 text-indigo-500"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  );
}

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-slate-500 gap-2">
      <svg className="w-8 h-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2a4 4 0 014-4h0a4 4 0 014 4v2M9 7a3 3 0 11-6 0 3 3 0 016 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Dashboard({ activeGroup }) {
  const [expenses, setExpenses] = useState([]);
  const [membersCount, setMembersCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeGroup?.id) return;

    setLoading(true);

    const expensesQuery = query(
      collection(db, 'expenses'),
      where('groupId', '==', activeGroup.id)
    );

    const unsubscribeExpenses = onSnapshot(
      expensesQuery,
      (snapshot) => {
        const fetched = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setExpenses(fetched);
        setLoading(false);
      },
      (error) => console.error('Error listening to expenses:', error)
    );

    const membersQuery = query(
      collection(db, 'members'),
      where('groupId', '==', activeGroup.id)
    );

    const unsubscribeMembers = onSnapshot(
      membersQuery,
      (snapshot) => setMembersCount(snapshot.size),
      (error) => console.error('Error listening to members:', error)
    );

    return () => {
      unsubscribeExpenses();
      unsubscribeMembers();
    };
  }, [activeGroup?.id]);

  // ── Derived metrics ──────────────────────────────────────────────────────────

  const totalBudget = activeGroup?.budget || 0;

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0),
    [expenses]
  );

  const remainingBudget = totalBudget - totalExpenses;

  const budgetUsagePercent = useMemo(
    () => (totalBudget > 0 ? Math.min((totalExpenses / totalBudget) * 100, 100) : 0),
    [totalBudget, totalExpenses]
  );

  const myExpenses = useMemo(
    () =>
      expenses
        .filter((exp) => exp.createdBy === auth.currentUser?.uid)
        .reduce((sum, exp) => sum + Number(exp.amount || 0), 0),
    [expenses]
  );

  const recentExpenses = useMemo(
    () =>
      [...expenses]
        .sort((a, b) => {
          const aTime = a.createdAt?.seconds || new Date(a.date).getTime() / 1000 || 0;
          const bTime = b.createdAt?.seconds || new Date(b.date).getTime() / 1000 || 0;
          return bTime - aTime;
        })
        .slice(0, 5),
    [expenses]
  );

  const topContributors = useMemo(
    () =>
      Object.values(
        expenses.reduce((acc, expense) => {
          const name = expense.createdByName || expense.createdBy || 'Unknown';
          if (!acc[name]) acc[name] = { name, amount: 0 };
          acc[name].amount += Number(expense.amount || 0);
          return acc;
        }, {})
      )
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5),
    [expenses]
  );

  // ── Trip Status ──────────────────────────────────────────────────────────────

  const tripStatus = useMemo(() => {
    if (budgetUsagePercent >= 90) {
      return {
        label: 'Budget Risk',
        description: 'Critical — spending has nearly exhausted the budget.',
        color: 'text-rose-400',
        dotColor: 'bg-rose-400',
        bg: 'bg-rose-500/10',
        border: 'border-rose-500/25',
        glow: 'shadow-rose-500/10',
      };
    }
    if (budgetUsagePercent >= 70) {
      return {
        label: 'Watch Spending',
        description: 'Caution — approaching budget limits, review expenses.',
        color: 'text-amber-400',
        dotColor: 'bg-amber-400',
        bg: 'bg-amber-500/10',
        border: 'border-amber-500/25',
        glow: 'shadow-amber-500/10',
      };
    }
    return {
      label: 'On Track',
      description: 'Healthy — spending is within safe budget range.',
      color: 'text-emerald-400',
      dotColor: 'bg-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/25',
      glow: 'shadow-emerald-500/10',
    };
  }, [budgetUsagePercent]);

  // ── No group selected ────────────────────────────────────────────────────────

  if (!activeGroup) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] bg-slate-800/60 border border-slate-700 rounded-2xl p-10 text-center gap-3">
        <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5V4H2v16h5m10 0v-4a3 3 0 00-6 0v4m6 0H7" />
        </svg>
        <p className="text-slate-400 text-sm font-medium">
          Please select or create a group to view the dashboard.
        </p>
      </div>
    );
  }

  // ── Icons ────────────────────────────────────────────────────────────────────

  const BudgetIcon = (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );

  const ExpensesIcon = (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z" />
    </svg>
  );

  const RemainingIcon = (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  );

  const MembersIcon = (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );

  const MyExpensesIcon = (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Header Banner ────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-800 rounded-2xl border border-slate-700/70 p-6 shadow-xl">
        {/* decorative glow */}
        <div className="absolute -top-6 -left-6 w-32 h-32 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-bold text-white leading-tight">
                {activeGroup.name}
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                Active Trip Dashboard &bull; Managed by{' '}
                <span className="text-indigo-400 font-medium">{activeGroup.leaderEmail}</span>
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              Live
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* ── Metrics Grid ───────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <MetricCard
              label="Total Budget"
              value={formatCurrency(totalBudget)}
              iconBg="bg-indigo-500/10 text-indigo-400"
              icon={BudgetIcon}
            />
            <MetricCard
              label="Total Expenses"
              value={formatCurrency(totalExpenses)}
              iconBg="bg-rose-500/10 text-rose-400"
              icon={ExpensesIcon}
            />
            <MetricCard
              label="Remaining"
              value={formatCurrency(remainingBudget)}
              valueColor={remainingBudget < 0 ? 'text-rose-400' : 'text-emerald-400'}
              iconBg={remainingBudget < 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}
              icon={RemainingIcon}
            />
            <MetricCard
              label="Total Members"
              value={membersCount}
              iconBg="bg-teal-500/10 text-teal-400"
              icon={MembersIcon}
            />
            <MetricCard
              label="My Expenses"
              value={formatCurrency(myExpenses)}
              iconBg="bg-violet-500/10 text-violet-400"
              icon={MyExpensesIcon}
            />
          </div>

          {/* ── Budget Usage ───────────────────────────────────────────────── */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-lg">
            <div className="flex justify-between items-center mb-3">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
                Budget Usage
              </p>
              <span
                className={`text-sm font-bold ${
                  budgetUsagePercent >= 90
                    ? 'text-rose-400'
                    : budgetUsagePercent >= 70
                    ? 'text-amber-400'
                    : 'text-indigo-400'
                }`}
              >
                {budgetUsagePercent.toFixed(1)}%
              </span>
            </div>

            <div className="w-full bg-slate-900 rounded-full h-2.5 overflow-hidden border border-slate-700/50">
              <div
                className={`h-full rounded-full transition-all duration-700 ease-out ${
                  budgetUsagePercent >= 90
                    ? 'bg-gradient-to-r from-rose-600 to-rose-400'
                    : budgetUsagePercent >= 70
                    ? 'bg-gradient-to-r from-amber-600 to-amber-400'
                    : 'bg-gradient-to-r from-indigo-700 to-indigo-400'
                }`}
                style={{ width: `${budgetUsagePercent}%` }}
              />
            </div>

            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-slate-500">
                {formatCurrency(totalExpenses)} spent
              </span>
              <span className="text-xs text-slate-500">
                of {formatCurrency(totalBudget)}
              </span>
            </div>

            {remainingBudget < 0 && (
              <p className="text-rose-400 text-xs mt-2 font-medium flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Warning: You have exceeded the allocated group budget!
              </p>
            )}
          </div>

          {/* ── Trip Status ────────────────────────────────────────────────── */}
          <div
            className={`border rounded-2xl p-5 shadow-lg ${tripStatus.bg} ${tripStatus.border}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
                  Trip Status
                </p>
                <h3 className={`text-xl font-bold ${tripStatus.color}`}>
                  {tripStatus.label}
                </h3>
                <p className="text-slate-400 text-xs mt-1">{tripStatus.description}</p>
              </div>
              <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                <span className={`h-3 w-3 rounded-full ${tripStatus.dotColor} shadow-lg`} />
                <span className={`text-[10px] font-semibold uppercase tracking-wider ${tripStatus.color}`}>
                  {budgetUsagePercent.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          {/* ── Top Contributors ───────────────────────────────────────────── */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-white">Top Contributors</h3>
                <p className="text-xs text-slate-500 mt-0.5">Highest spenders this trip</p>
              </div>
              <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                Top 5
              </span>
            </div>

            {topContributors.length === 0 ? (
              <EmptyState message="No contributor data available yet." />
            ) : (
              <div className="space-y-3">
                {topContributors.map((person, index) => {
                  const rankColors = [
                    'bg-amber-500/15 text-amber-300 border-amber-500/25',
                    'bg-slate-400/10 text-slate-300 border-slate-500/20',
                    'bg-orange-500/10 text-orange-400 border-orange-500/20',
                    'bg-slate-700/50 text-slate-400 border-slate-600/30',
                    'bg-slate-700/50 text-slate-400 border-slate-600/30',
                  ];
                  const pct =
                    totalExpenses > 0
                      ? ((person.amount / totalExpenses) * 100).toFixed(0)
                      : 0;

                  return (
                    <div
                      key={person.name}
                      className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/40 border border-slate-700/30 hover:border-slate-600/40 transition-colors duration-150"
                    >
                      <div
                        className={`h-8 w-8 rounded-lg border text-xs font-bold flex items-center justify-center flex-shrink-0 ${rankColors[index] || rankColors[4]}`}
                      >
                        #{index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-200 truncate">
                          {person.name}
                        </p>
                        <p className="text-[11px] text-slate-500">{pct}% of total</p>
                      </div>
                      <span className="text-sm font-bold text-white flex-shrink-0">
                        {formatCurrency(person.amount)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Recent Expenses ────────────────────────────────────────────── */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-white">Recent Expenses</h3>
                <p className="text-xs text-slate-500 mt-0.5">Last 5 transactions</p>
              </div>
            </div>

            {recentExpenses.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-sm">
                No expenses logged yet. Go to the{' '}
                <span className="text-indigo-400 font-medium">"Expenses"</span> tab to log
                your first expense.
              </div>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-left border-collapse min-w-[520px]">
                  <thead>
                    <tr className="border-b border-slate-700/60">
                      {['Title', 'Amount', 'Category', 'Date', 'Logged By'].map((h) => (
                        <th
                          key={h}
                          className="pb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-500 px-1"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/30 text-sm text-slate-300">
                    {recentExpenses.map((exp) => (
                      <tr
                        key={exp.id}
                        className="hover:bg-slate-700/20 transition-colors duration-100"
                      >
                        <td className="py-3.5 px-1 font-semibold text-white">
                          {exp.title}
                        </td>
                        <td className="py-3.5 px-1 font-bold text-white tabular-nums">
                          {formatCurrency(exp.amount)}
                        </td>
                        <td className="py-3.5 px-1">
                          <span
                            className={`inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                              CATEGORY_COLORS[exp.category] || CATEGORY_COLORS.Other
                            }`}
                          >
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-3.5 px-1 text-slate-400 text-xs">
                          {exp.date ? new Date(exp.date).toLocaleDateString('en-IN') : 'N/A'}
                        </td>
                        <td
                          className="py-3.5 px-1 text-xs text-slate-400 truncate max-w-[140px]"
                          title={exp.createdByName}
                        >
                          {exp.createdByName || exp.createdBy || 'Unknown'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}