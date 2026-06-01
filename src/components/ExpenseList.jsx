import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

const CATEGORIES = ['Food', 'Hotel', 'Fuel', 'Travel', 'Shopping', 'Other'];

const CATEGORY_COLORS = {
  Food: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  Hotel: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  Fuel: 'bg-red-500/10 text-red-400 border-red-500/20',
  Travel: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  Shopping: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  Other: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
};

export default function ExpenseList({ activeGroup }) {
  const [expenses, setExpenses] = useState([]);
  const [filteredExpenses, setFilteredExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Search & Filter
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  
  // Form State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!activeGroup?.id) return;

    setLoading(true);
    setError('');

    const expensesQuery = query(
      collection(db, 'expenses'),
      where('groupId', '==', activeGroup.id)
    );

    const unsubscribe = onSnapshot(expensesQuery, (snapshot) => {
      const fetchedExpenses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Sort by date desc (and fallback to createdAt desc)
      fetchedExpenses.sort((a, b) => {
        const aTime = new Date(a.date).getTime();
        const bTime = new Date(b.date).getTime();
        if (bTime !== aTime) return bTime - aTime;
        
        const aCreated = a.createdAt?.seconds || 0;
        const bCreated = b.createdAt?.seconds || 0;
        return bCreated - aCreated;
      });

      setExpenses(fetchedExpenses);
      setLoading(false);
    }, (err) => {
      console.error("Error loading expenses:", err);
      setError("Failed to load expenses: " + err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeGroup?.id]);

  // Apply search and filter
  useEffect(() => {
    let result = [...expenses];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e => e.title.toLowerCase().includes(q));
    }

    if (categoryFilter !== 'All') {
      result = result.filter(e => e.category === categoryFilter);
    }

    setFilteredExpenses(result);
  }, [expenses, search, categoryFilter]);

  const openAddModal = () => {
    setEditingExpense(null);
    setTitle('');
    setAmount('');
    setCategory('Food');
    setDate(new Date().toISOString().split('T')[0]);
    setError('');
    setShowModal(true);
  };

  const openEditModal = (expense) => {
    setEditingExpense(expense);
    setTitle(expense.title);
    setAmount(expense.amount.toString());
    setCategory(expense.category);
    setDate(expense.date);
    setError('');
    setShowModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!date) {
      setError('Please select a date');
      return;
    }

    setSubmitting(true);
    try {
      if (editingExpense) {
        // Enforce user can edit only their own expenses (in client layer)
        if (editingExpense.createdBy !== auth.currentUser?.uid) {
          throw new Error("You can only edit your own expenses");
        }
        
        const docRef = doc(db, 'expenses', editingExpense.id);
        await updateDoc(docRef, {
          title: title.trim(),
          amount: amountNum,
          category,
          date,
          updatedAt: serverTimestamp()
        });
      } else {
        // Add new expense
        await addDoc(collection(db, 'expenses'), {
          groupId: activeGroup.id,
          title: title.trim(),
          amount: amountNum,
          category,
          date,
          createdBy: auth.currentUser.uid,
          createdByName: auth.currentUser.email,
          createdAt: serverTimestamp()
        });
      }
      setShowModal(false);
    } catch (err) {
      console.error("Error saving expense:", err);
      setError("Error saving expense: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (expense) => {
    if (expense.createdBy !== auth.currentUser?.uid) {
      alert("You can only delete your own expenses");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete "${expense.title}"?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'expenses', expense.id));
    } catch (err) {
      console.error("Error deleting expense:", err);
      alert("Error deleting expense: " + err.message);
    }
  };

  if (!activeGroup) {
    return (
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 text-center text-slate-400">
        Please select or create a group to view expenses.
      </div>
    );
  }

  const totalAmount = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  return (
    <div className="space-y-6">
      {/* Search, Filter & Action Row */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between bg-slate-800 border border-slate-700 rounded-2xl p-4 shadow-md">
        <div className="flex flex-1 flex-col sm:flex-row gap-3">
          {/* Search bar */}
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 pointer-events-none">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
              placeholder="Search expenses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Category filter */}
          <div className="sm:w-48">
            <select
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm appearance-none cursor-pointer"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="All">All Categories</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Add Expense Button */}
        <button
          onClick={openAddModal}
          className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 px-5 rounded-xl transition-all shadow-md text-sm shrink-0 flex items-center justify-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Expense</span>
        </button>
      </div>

      {/* Expenses list block */}
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-lg">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white">Expenses List</h3>
          <div className="text-right">
            <p className="text-xs text-slate-400 uppercase font-semibold">Filtered Total</p>
            <p className="text-xl font-black text-indigo-400">
              ${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-sm space-y-2">
            <svg className="w-12 h-12 mx-auto text-slate-650" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <p className="font-medium">No expenses found.</p>
            <p className="text-xs text-slate-550">Try modifying your search/filters or click "Add Expense" to log one.</p>
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
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50 text-sm text-slate-300">
                {filteredExpenses.map((exp) => {
                  const isOwner = exp.createdBy === auth.currentUser?.uid;
                  return (
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
                      <td className="py-3.5 text-xs text-slate-400 max-w-[150px] truncate" title={exp.createdByName}>
                        {exp.createdByName || exp.createdBy}
                      </td>
                      <td className="py-3.5 text-right space-x-2 shrink-0">
                        {isOwner ? (
                          <>
                            <button
                              onClick={() => openEditModal(exp)}
                              className="text-xs bg-slate-700/50 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 px-2.5 py-1 rounded-lg transition-all border border-slate-650"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteExpense(exp)}
                              className="text-xs bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white px-2.5 py-1 rounded-lg transition-all border border-rose-500/20"
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-slate-500 select-none">View Only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit/Add Overlay Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 max-w-md w-full shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex justify-between items-center pb-2 border-b border-slate-700">
              <h3 className="text-xl font-bold text-white">
                {editingExpense ? 'Edit Expense' : 'Add Expense'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white rounded-lg p-1 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 text-xs">
                {error}
              </div>
            )}

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5" htmlFor="exp-title">
                  Expense Title
                </label>
                <input
                  id="exp-title"
                  type="text"
                  required
                  placeholder="e.g. Dinner at Paris Bistro"
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5" htmlFor="exp-amount">
                    Amount ($)
                  </label>
                  <input
                    id="exp-amount"
                    type="number"
                    required
                    min="0.01"
                    step="any"
                    placeholder="0.00"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5" htmlFor="exp-category">
                    Category
                  </label>
                  <select
                    id="exp-category"
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm cursor-pointer"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5" htmlFor="exp-date">
                  Date
                </label>
                <input
                  id="exp-date"
                  type="date"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>

              <div className="pt-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold py-2 px-4 rounded-xl transition-all text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-semibold py-2 px-6 rounded-xl transition-all shadow-md text-sm"
                >
                  {submitting ? 'Saving...' : editingExpense ? 'Save Changes' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
