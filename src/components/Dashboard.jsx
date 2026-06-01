import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

const CATEGORY_COLORS = {
  Food: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Hotel: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  Fuel: 'bg-red-500/10 text-red-400 border-red-500/20',
  Travel: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Shopping: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Other: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
};

export default function Dashboard({ activeGroup }) {
  const [expenses, setExpenses] = useState([]);
  const [membersCount, setMembersCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeGroup?.id) return;

    setLoading(true);

    // 1. Listen for expenses in this group
    const expensesQuery = query(
      collection(db, 'expenses'),
      where('groupId', '==', activeGroup.id)
    );

    const unsubscribeExpenses = onSnapshot(expensesQuery, (snapshot) => {
      const fetchedExpenses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setExpenses(fetchedExpenses);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to expenses:", error);
    });

    // 2. Listen for members in this group
    const membersQuery = query(
      collection(db, 'members'),
      where('groupId', '==', activeGroup.id)
    );

    const unsubscribeMembers = onSnapshot(membersQuery, (snapshot) => {
      setMembersCount(snapshot.size);
    }, (error) => {
      console.error("Error listening to members:", error);
    });

    return () => {
      unsubscribeExpenses();
      unsubscribeMembers();
    };
  }, [activeGroup?.id]);

  if (!activeGroup) {
    return (
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 text-center text-slate-400">
        Please select or create a group to view the dashboard.
      </div>
    );
  }

  // Calculate metrics
  const totalBudget = activeGroup.budget || 0;
  const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  const remainingBudget = totalBudget - totalExpenses;
  const budgetUsagePercent = Math.min((totalExpenses / totalBudget) * 100, 100);

  // Get recent 5 expenses (sorted by date or createdAt descending)
  const recentExpenses = [...expenses]
    .sort((a, b) => {
      const aTime = a.createdAt?.seconds || new Date(a.date).getTime() / 1000 || 0;
      const bTime = b.createdAt?.seconds || new Date(b.date).getTime() / 1000 || 0;
      return bTime - aTime;
    })
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900/50 to-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg">
        <h2 className="text-2xl font-bold text-white mb-1">{activeGroup.name}</h2>
        <p className="text-slate-400 text-sm">
          Active Trip Dashboard &bull; Managed by {activeGroup.leaderEmail}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      ) : (
        <>
          {/* Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Budget Card */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-md flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Budget</span>
                <h3 className="text-2xl font-bold text-white mt-1">
                  ₹{totalBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            {/* Total Expenses Card */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-md flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Expenses</span>
                <h3 className="text-2xl font-bold text-white mt-1">
                  ${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z" />
                </svg>
              </div>
            </div>

            {/* Remaining Budget Card */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-md flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Remaining</span>
                <h3 className={`text-2xl font-bold mt-1 ${remainingBudget < 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  ${remainingBudget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
              </div>
              <div className={`p-3 rounded-xl ${remainingBudget < 0 ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>

            {/* Total Members Card */}
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-md flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Members</span>
                <h3 className="text-2xl font-bold text-white mt-1">{membersCount}</h3>
              </div>
              <div className="p-3 bg-teal-500/10 text-teal-400 rounded-xl">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Budget Health Bar */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5 shadow-md">
            <div className="flex justify-between items-center text-xs font-semibold uppercase text-slate-400 mb-2">
              <span>Budget Usage</span>
              <span>{budgetUsagePercent.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-750">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  budgetUsagePercent > 90
                    ? 'bg-rose-500'
                    : budgetUsagePercent > 70
                    ? 'bg-amber-500'
                    : 'bg-indigo-600'
                }`}
                style={{ width: `${budgetUsagePercent}%` }}
              ></div>
            </div>
            {remainingBudget < 0 && (
              <p className="text-rose-400 text-xs mt-2 font-medium">
                Warning: You have exceeded the allocated group budget!
              </p>
            )}
          </div>

          {/* Recent Expenses List */}
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-md">
            <h3 className="text-lg font-bold text-white mb-4">Recent Expenses</h3>
            {recentExpenses.length === 0 ? (
              <div className="text-center py-6 text-slate-400 text-sm">
                No expenses logged yet. Go to the "Expenses" tab to log your first expense.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="pb-3">Title</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Category</th>
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Logged By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/50 text-sm text-slate-300">
                    {recentExpenses.map((exp) => (
                      <tr key={exp.id} className="hover:bg-slate-750/30">
                        <td className="py-3.5 font-medium text-white">{exp.title}</td>
                        <td className="py-3.5 font-bold text-white">
                          ${Number(exp.amount || 0).toFixed(2)}
                        </td>
                        <td className="py-3.5">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium border ${CATEGORY_COLORS[exp.category] || CATEGORY_COLORS.Other}`}>
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-3.5 text-slate-400">
                          {exp.date ? new Date(exp.date).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="py-3.5 text-xs text-slate-400 truncate max-w-[150px]" title={exp.createdByName}>
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
