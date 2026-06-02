
import React, { useState, useEffect, useMemo } from 'react';
import {
  collection, query, where, onSnapshot,
  doc, updateDoc, addDoc, serverTimestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';

// ─── Formatters ───────────────────────────────────────────────────────────────

const fmt = (value) =>
  `₹${Math.abs(Number(value || 0)).toLocaleString('en-IN', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;

const fmtSigned = (value) => {
  const n = Number(value || 0);
  if (Math.abs(n) < 0.01) return '₹0.00';
  return `${n > 0 ? '+' : '−'}${fmt(n)}`;
};

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_STYLES = {
  pending:  { label: 'Pending',  bg: 'bg-amber-500/10',   text: 'text-amber-400',   border: 'border-amber-500/20'  },
  closed:   { label: 'Closed',   bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20'},
  rejected: { label: 'Rejected', bg: 'bg-rose-500/10',    text: 'text-rose-400',    border: 'border-rose-500/20'   },
};

// ─── Business logic ───────────────────────────────────────────────────────────

/**
 * Match an expense to a member.
 *
 * Firestore expense schema:
 *   { createdBy: "firebase_uid", createdByName: "email@gmail.com", ... }
 *
 * Firestore member schema:
 *   { email: "email@gmail.com", groupId: "...", contribution: N }
 *   NOTE: members do NOT have a uid field — only email.
 *
 * FIX: match on createdByName === m.email (createdByName stores the email)
 *      as primary match, with createdByEmail as a fallback for future-proofing.
 */
function expensesBelongingToMember(expenses, member) {
  return expenses.filter((e) =>
    // Primary: createdByName holds the email string (confirmed from schema)
    (e.createdByName && e.createdByName === member.email) ||
    // Fallback 1: explicit createdByEmail field if added in future
    (e.createdByEmail && e.createdByEmail === member.email) ||
    // Fallback 2: createdBy uid match — only works if member doc has uid field
    (member.uid && e.createdBy && e.createdBy === member.uid)
  );
}

/**
 * Compute effective balance per member.
 *
 * rawBalance        = expenses paid by member − fair share
 *                     positive → overpaid → others owe them
 *                     negative → underpaid → they owe others
 *
 * effectiveBalance  = rawBalance
 *                     − closed settlements received  (receivable shrinks)
 *                     + closed settlements paid      (debt shrinks)
 */
function computeEffectiveBalances(members, expenses, allSettlements) {
  const totalGroupExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const totalMembers = members.length;
  const fairShare = totalMembers > 0 ? totalGroupExpenses / totalMembers : 0;

  const closedSettlements = allSettlements.filter((s) => s.status === 'closed');

  return members.map((m) => {
    // ── FIX: use the corrected matcher ──────────────────────────────────────
    const memberExpenses = expensesBelongingToMember(expenses, m);
    const paid = memberExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);

    const rawBalance = paid - fairShare;

    const closedRcv = closedSettlements
      .filter((s) => s.toUserEmail === m.email)
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    const closedPaid = closedSettlements
      .filter((s) => s.fromUserEmail === m.email)
      .reduce((s, t) => s + Number(t.amount || 0), 0);

    const effectiveBalance = rawBalance - closedRcv + closedPaid;

    return {
      email:            m.email,
      name:             m.displayName || m.email,
      uid:              m.uid,         // may be undefined — only used as fallback
      rawBalance,
      effectiveBalance,
      paid,
      fairShare,
    };
  });
}

/**
 * Minimum-transactions settlement suggestion algorithm.
 * Operates on EFFECTIVE balances so already-closed debts don't re-appear.
 */
function computeSuggestions(effectiveBalances) {
  const creditors = effectiveBalances
    .filter((b) => b.effectiveBalance > 0.5)
    .sort((a, b) => b.effectiveBalance - a.effectiveBalance);
  const debtors = effectiveBalances
    .filter((b) => b.effectiveBalance < -0.5)
    .sort((a, b) => a.effectiveBalance - b.effectiveBalance);

  const cred = creditors.map((c) => ({ ...c, bal: c.effectiveBalance }));
  const debt = debtors.map((d) => ({ ...d, bal: d.effectiveBalance }));

  const result = [];
  let ci = 0, di = 0;

  while (ci < cred.length && di < debt.length) {
    const amount = Math.min(cred[ci].bal, Math.abs(debt[di].bal));
    if (amount > 0.5) {
      result.push({
        fromEmail: debt[di].email,
        fromName:  debt[di].name,
        toEmail:   cred[ci].email,
        toName:    cred[ci].name,
        amount,
        maxAmount: amount,
      });
    }
    cred[ci].bal -= amount;
    debt[di].bal += amount;
    if (cred[ci].bal < 0.5) ci++;
    if (Math.abs(debt[di].bal) < 0.5) di++;
  }

  return result;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center items-center py-16">
      <svg className="animate-spin h-9 w-9 text-indigo-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>
  );
}

function StatCard({ label, value, sub, valueColor = 'text-white', iconBg, icon }) {
  return (
    <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-lg flex flex-col justify-between min-h-[140px] hover:border-slate-600/60 transition-colors duration-200">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">{label}</p>
        {icon && <div className={`p-2.5 rounded-xl flex-shrink-0 ${iconBg}`}>{icon}</div>}
      </div>
      <div>
        <p className={`text-2xl font-bold leading-tight mt-2 ${valueColor}`}>{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${s.bg} ${s.text} ${s.border}`}>
      {s.label}
    </span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MyBalance({ activeGroup }) {
  const [expenses,       setExpenses]       = useState([]);
  const [members,        setMembers]        = useState([]);
  const [allSettlements, setAllSettlements] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [saving,         setSaving]         = useState(false);
  const [actioningId,    setActioningId]    = useState(null);
  const [editMode,       setEditMode]       = useState(false);
  const [inputValue,     setInputValue]     = useState('');
  const [saveError,      setSaveError]      = useState('');

  const currentUser = auth.currentUser;

  // ── Firestore listeners ────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeGroup?.id || !currentUser?.email) return;
    setLoading(true);

    const unsubExp = onSnapshot(
      query(collection(db, 'expenses'), where('groupId', '==', activeGroup.id)),
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // DEBUG — remove after confirming fix
        console.log('EXPENSES', data.map((e) => ({
          title: e.title, amount: e.amount,
          createdBy: e.createdBy, createdByName: e.createdByName, createdByEmail: e.createdByEmail,
        })));
        setExpenses(data);
        setLoading(false);
      },
      console.error
    );

    const unsubMem = onSnapshot(
      query(collection(db, 'members'), where('groupId', '==', activeGroup.id)),
      (snap) => {
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // DEBUG — remove after confirming fix
        console.log('MEMBERS', data.map((m) => ({
          email: m.email, uid: m.uid, contribution: m.contribution,
        })));
        setMembers(data);
      },
      console.error
    );

    const unsubSettle = onSnapshot(
      query(collection(db, 'settlements'), where('groupId', '==', activeGroup.id)),
      (snap) => setAllSettlements(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      console.error
    );

    return () => { unsubExp(); unsubMem(); unsubSettle(); };
  }, [activeGroup?.id, currentUser?.email]);

  // ── Core calculations ──────────────────────────────────────────────────────

  const totalGroupExpenses = useMemo(
    () => expenses.reduce((s, e) => s + Number(e.amount || 0), 0),
    [expenses]
  );

  const totalMembers = members.length;

  const effectiveBalances = useMemo(() => {
    const result = computeEffectiveBalances(members, expenses, allSettlements);
    // DEBUG — remove after confirming fix
    console.log('EFFECTIVE BALANCES', result.map((b) => ({
      email: b.email, paid: b.paid, fairShare: b.fairShare,
      rawBalance: b.rawBalance, effectiveBalance: b.effectiveBalance,
    })));
    return result;
  }, [members, expenses, allSettlements]);

  const myBalanceEntry = useMemo(
    () => effectiveBalances.find((b) => b.email === currentUser?.email),
    [effectiveBalances, currentUser]
  );

  const myMember = useMemo(
    () => members.find((m) => m.email === currentUser?.email),
    [members, currentUser]
  );

  const myContribution = Number(myMember?.contribution || 0);

  // ── FIX: use the same corrected matcher for "my expenses" display card ──
  const myExpensesTotal = useMemo(
    () => expensesBelongingToMember(expenses, myMember || { email: currentUser?.email })
      .reduce((s, e) => s + Number(e.amount || 0), 0),
    [expenses, myMember, currentUser]
  );

  const myFairShare = totalMembers > 0 ? totalGroupExpenses / totalMembers : 0;

  const settlementBalance = myBalanceEntry?.effectiveBalance ?? 0;

  const myClosedReceived = useMemo(
    () => allSettlements
      .filter((s) => s.status === 'closed' && s.toUserEmail === currentUser?.email)
      .reduce((s, t) => s + Number(t.amount || 0), 0),
    [allSettlements, currentUser]
  );

  const myClosedPaid = useMemo(
    () => allSettlements
      .filter((s) => s.status === 'closed' && s.fromUserEmail === currentUser?.email)
      .reduce((s, t) => s + Number(t.amount || 0), 0),
    [allSettlements, currentUser]
  );

  // Wallet = Contribution − My Expenses + Closed Received − Closed Paid
  const walletRemaining = myContribution - myExpensesTotal + myClosedReceived - myClosedPaid;

  const suggestions = useMemo(() => {
    const result = computeSuggestions(effectiveBalances);
    // DEBUG — remove after confirming fix
    console.log('SUGGESTIONS', result);
    return result;
  }, [effectiveBalances]);

  const mySettlements = useMemo(
    () => allSettlements
      .filter((s) => s.fromUserEmail === currentUser?.email || s.toUserEmail === currentUser?.email)
      .sort((a, b) => (b.requestedAt?.seconds || 0) - (a.requestedAt?.seconds || 0)),
    [allSettlements, currentUser]
  );

  const incomingPending = useMemo(
    () => mySettlements.filter((s) => s.toUserEmail === currentUser?.email && s.status === 'pending'),
    [mySettlements, currentUser]
  );

  const pendingFromMe = useMemo(
    () => allSettlements.filter((s) => s.fromUserEmail === currentUser?.email && s.status === 'pending'),
    [allSettlements, currentUser]
  );

  const totalContributions = useMemo(
    () => members.reduce((s, m) => s + Number(m.contribution || 0), 0),
    [members]
  );

  const contributionLeaderboard = useMemo(
    () => [...members]
      .map((m) => ({
        name: m.displayName || m.email,
        email: m.email,
        contribution: Number(m.contribution || 0),
        isMe: m.email === currentUser?.email,
      }))
      .sort((a, b) => b.contribution - a.contribution),
    [members, currentUser]
  );

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleSaveContribution = async () => {
    const val = parseFloat(inputValue);
    if (isNaN(val) || val < 0) { setSaveError('Please enter a valid positive amount.'); return; }
    if (!myMember?.id)          { setSaveError('Member record not found.'); return; }
    setSaveError(''); setSaving(true);
    try {
      await updateDoc(doc(db, 'members', myMember.id), { contribution: val });
      setEditMode(false);
    } catch (e) {
      console.error(e);
      setSaveError('Failed to save. Please try again.');
    } finally { setSaving(false); }
  };

  const handleRequestSettlement = async (suggestion) => {
    const duplicate = pendingFromMe.some((p) => p.toUserEmail === suggestion.toEmail);
    if (duplicate) return;

    const cappedAmount = Math.min(suggestion.amount, suggestion.maxAmount);
    if (cappedAmount < 0.5) return;

    setActioningId(`req-${suggestion.toEmail}`);
    try {
      await addDoc(collection(db, 'settlements'), {
        groupId:       activeGroup.id,
        fromUserEmail: suggestion.fromEmail,
        fromUserName:  suggestion.fromName,
        toUserEmail:   suggestion.toEmail,
        toUserName:    suggestion.toName,
        amount:        cappedAmount,
        status:        'pending',
        requestedAt:   serverTimestamp(),
        closedAt:      null,
      });
    } catch (e) { console.error(e); }
    finally { setActioningId(null); }
  };

  const handleAcceptPayment = async (settlementId) => {
    setActioningId(settlementId);
    try {
      await updateDoc(doc(db, 'settlements', settlementId), {
        status: 'closed', closedAt: serverTimestamp(),
      });
    } catch (e) { console.error(e); }
    finally { setActioningId(null); }
  };

  const handleRejectPayment = async (settlementId) => {
    setActioningId(settlementId);
    try {
      await updateDoc(doc(db, 'settlements', settlementId), { status: 'rejected' });
    } catch (e) { console.error(e); }
    finally { setActioningId(null); }
  };

  // ── No group guard ─────────────────────────────────────────────────────────

  if (!activeGroup) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] bg-slate-800/60 border border-slate-700 rounded-2xl p-10 text-center gap-3">
        <svg className="w-10 h-10 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
        <p className="text-slate-400 text-sm font-medium">Please select or create a group to view your balance.</p>
      </div>
    );
  }

  // ── Header status ──────────────────────────────────────────────────────────

  const headerStatus = (() => {
    if (Math.abs(settlementBalance) < 0.5) return {
      label: 'Fully Settled', color: 'text-emerald-400',
      bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', dot: 'bg-emerald-400',
    };
    if (settlementBalance > 0) return {
      label: 'You Are Owed Money', color: 'text-indigo-400',
      bg: 'bg-indigo-500/10', border: 'border-indigo-500/25', dot: 'bg-indigo-400',
    };
    return {
      label: 'You Owe Money', color: 'text-rose-400',
      bg: 'bg-rose-500/10', border: 'border-rose-500/25', dot: 'bg-rose-400',
    };
  })();

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-gradient-to-r from-indigo-950 via-slate-900 to-slate-800 rounded-2xl border border-slate-700/70 p-6 shadow-xl">
        <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-indigo-600/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold text-white leading-tight">My Balance</h2>
            <p className="text-slate-400 text-sm mt-1">
              {activeGroup.name} &bull;{' '}
              <span className="text-indigo-400 font-medium">{currentUser?.email}</span>
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${headerStatus.bg} ${headerStatus.border} ${headerStatus.color} whitespace-nowrap`}>
            <span className={`w-1.5 h-1.5 rounded-full ${headerStatus.dot}`} />
            {headerStatus.label}
          </span>
        </div>
      </div>

      {loading ? <Spinner /> : (
        <>
          {/* ── Contribution Input Panel ───────────────────────────────────── */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">My Contribution</p>
                <p className="text-xs text-slate-500 mt-0.5">Money you brought to this trip</p>
              </div>
              {!editMode && (
                <button
                  onClick={() => { setInputValue(myContribution > 0 ? String(myContribution) : ''); setSaveError(''); setEditMode(true); }}
                  className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 border border-indigo-500/30 hover:border-indigo-400/50 px-3 py-1.5 rounded-lg transition-colors duration-150"
                >
                  {myContribution > 0 ? 'Edit' : '+ Add'}
                </button>
              )}
            </div>
            {editMode ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-bold text-lg">₹</span>
                  <input
                    type="number" min="0" step="0.01" value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="0.00" autoFocus
                    className="flex-1 bg-slate-900 border border-slate-600 rounded-xl px-4 py-2.5 text-white text-lg font-bold focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition-colors"
                  />
                </div>
                {saveError && <p className="text-rose-400 text-xs font-medium">{saveError}</p>}
                <div className="flex gap-2">
                  <button onClick={handleSaveContribution} disabled={saving}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm rounded-xl py-2.5 transition-colors">
                    {saving ? 'Saving…' : 'Save Contribution'}
                  </button>
                  <button onClick={() => { setEditMode(false); setSaveError(''); }}
                    className="px-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-semibold text-sm rounded-xl py-2.5 transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className={`text-3xl font-bold mt-1 ${myContribution > 0 ? 'text-white' : 'text-slate-500'}`}>
                {myContribution > 0 ? fmt(myContribution) : '₹0.00'}
              </p>
            )}
          </div>

          {/* ── 5 Stat Cards ──────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">

            <StatCard label="My Contribution" value={fmt(myContribution)} sub="Money I brought"
              iconBg="bg-indigo-500/10 text-indigo-400"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
            />

            <StatCard label="My Expenses" value={fmt(myExpensesTotal)} sub="Logged by me"
              iconBg="bg-rose-500/10 text-rose-400"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z" /></svg>}
            />

            <StatCard
              label="Wallet Remaining"
              value={fmt(walletRemaining)}
              sub="Contribution − Expenses ± Settlements"
              valueColor={walletRemaining >= 0 ? 'text-emerald-400' : 'text-rose-400'}
              iconBg={walletRemaining >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>}
            />

            <StatCard label="My Fair Share" value={fmt(myFairShare)} sub={`Total ÷ ${totalMembers} members`}
              iconBg="bg-amber-500/10 text-amber-400"
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" /></svg>}
            />

            <StatCard
              label="Settlement Balance"
              value={fmtSigned(settlementBalance)}
              sub={Math.abs(settlementBalance) < 0.5 ? 'All settled' : settlementBalance > 0 ? 'Others owe you' : 'You owe others'}
              valueColor={Math.abs(settlementBalance) < 0.5 ? 'text-slate-300' : settlementBalance > 0 ? 'text-emerald-400' : 'text-rose-400'}
              iconBg={Math.abs(settlementBalance) < 0.5 ? 'bg-slate-500/10 text-slate-400' : settlementBalance > 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}
              icon={<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
            />
          </div>

          {/* ── Wallet Breakdown ───────────────────────────────────────────── */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-lg">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-4">Wallet Breakdown</p>
            <div className="space-y-0">
              {[
                { label: 'Contribution',       value: myContribution,   sign: '+', color: 'text-indigo-400'  },
                { label: 'My Expenses',         value: myExpensesTotal,  sign: '−', color: 'text-rose-400'    },
                { label: 'Settlement Received', value: myClosedReceived, sign: '+', color: 'text-emerald-400' },
                { label: 'Settlement Paid',     value: myClosedPaid,     sign: '−', color: 'text-amber-400'   },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-2.5 border-b border-slate-700/30">
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold w-4 text-center ${row.color}`}>{row.sign}</span>
                    <span className="text-sm text-slate-300">{row.label}</span>
                  </div>
                  <span className={`text-sm font-bold tabular-nums ${row.color}`}>{fmt(row.value)}</span>
                </div>
              ))}
              <div className="flex items-center justify-between pt-3.5 mt-1">
                <span className="text-sm font-bold text-white">Wallet Remaining</span>
                <span className={`text-xl font-bold tabular-nums ${walletRemaining >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {fmt(walletRemaining)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Incoming Pending Requests ──────────────────────────────────── */}
          {incomingPending.length > 0 && (
            <div className="bg-slate-800/80 border border-amber-500/25 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-5">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <h3 className="text-base font-bold text-white">Incoming Payment Requests</h3>
                <span className="ml-auto text-[11px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-semibold">
                  {incomingPending.length} pending
                </span>
              </div>
              <div className="space-y-3">
                {incomingPending.map((s) => (
                  <div key={s.id} className="rounded-xl p-4 bg-amber-500/5 border border-amber-500/20">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <p className="text-sm font-semibold text-slate-200">
                          <span className="text-amber-300">{s.fromUserName}</span> says they paid you
                        </p>
                        <p className="text-2xl font-bold text-white mt-1">{fmt(s.amount)}</p>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {s.requestedAt?.toDate ? s.requestedAt.toDate().toLocaleString('en-IN') : 'Just now'}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0 mt-1">
                        <button onClick={() => handleAcceptPayment(s.id)} disabled={actioningId === s.id}
                          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                          {actioningId === s.id ? '…' : 'Accept Payment'}
                        </button>
                        <button onClick={() => handleRejectPayment(s.id)} disabled={actioningId === s.id}
                          className="bg-rose-700/80 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors">
                          Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Settlement Suggestions ─────────────────────────────────────── */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-6 shadow-lg">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-bold text-white">Settlement Suggestions</h3>
                <p className="text-xs text-slate-500 mt-0.5">Reflects current outstanding balances after all closed settlements</p>
              </div>
              <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
              </span>
            </div>

            {suggestions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-slate-500 gap-2">
                <svg className="w-8 h-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm">Everyone is settled up!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {suggestions.map((s, i) => {
                  const isMyPayment = s.fromEmail === currentUser?.email;
                  const isMyReceipt = s.toEmail   === currentUser?.email;
                  const alreadyRequested = pendingFromMe.some((p) => p.toUserEmail === s.toEmail);

                  return (
                    <div key={i}
                      className={`rounded-xl p-4 border flex flex-wrap items-center gap-3 ${
                        isMyPayment ? 'bg-rose-500/8 border-rose-500/25'
                        : isMyReceipt ? 'bg-emerald-500/8 border-emerald-500/25'
                        : 'bg-slate-900/40 border-slate-700/30'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold truncate ${isMyPayment ? 'text-rose-300' : 'text-slate-300'}`}>
                          {s.fromName}{isMyPayment && <span className="ml-1 text-[10px] text-rose-400">(You)</span>}
                        </p>
                        <p className="text-[11px] text-slate-500">pays</p>
                      </div>

                      <div className="flex flex-col items-center flex-shrink-0">
                        <span className={`text-xs font-bold ${isMyPayment ? 'text-rose-400' : isMyReceipt ? 'text-emerald-400' : 'text-indigo-400'}`}>
                          {fmt(s.amount)}
                        </span>
                        <svg className={`w-5 h-5 mt-0.5 ${isMyPayment ? 'text-rose-500' : isMyReceipt ? 'text-emerald-500' : 'text-slate-500'}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </div>

                      <div className="flex-1 min-w-0 text-right">
                        <p className={`text-sm font-semibold truncate ${isMyReceipt ? 'text-emerald-300' : 'text-slate-300'}`}>
                          {s.toName}{isMyReceipt && <span className="ml-1 text-[10px] text-emerald-400">(You)</span>}
                        </p>
                        <p className="text-[11px] text-slate-500">receives</p>
                      </div>

                      {isMyPayment && (
                        <button
                          onClick={() => handleRequestSettlement(s)}
                          disabled={alreadyRequested || actioningId === `req-${s.toEmail}`}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors flex-shrink-0 ${
                            alreadyRequested
                              ? 'bg-slate-700/50 text-slate-500 border-slate-600/30 cursor-not-allowed'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white border-transparent'
                          }`}
                        >
                          {actioningId === `req-${s.toEmail}` ? 'Requesting…'
                            : alreadyRequested ? 'Requested' : 'Request Settlement'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Two-column: Leaderboard + Settlement History ───────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Contribution Leaderboard */}
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold text-white">Contribution Leaderboard</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Who funded this trip</p>
                </div>
                <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                  {fmt(totalContributions)} total
                </span>
              </div>

              {contributionLeaderboard.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-sm">No contributions recorded yet.</div>
              ) : (
                <div className="space-y-3">
                  {contributionLeaderboard.map((m, i) => {
                    const rankColors = [
                      'bg-amber-500/15 text-amber-300 border-amber-500/25',
                      'bg-slate-400/10 text-slate-300 border-slate-500/20',
                      'bg-orange-500/10 text-orange-400 border-orange-500/20',
                    ];
                    const rankStyle = rankColors[i] || 'bg-slate-700/50 text-slate-400 border-slate-600/30';
                    const barPct = totalContributions > 0 ? (m.contribution / totalContributions) * 100 : 0;
                    return (
                      <div key={m.email}
                        className={`rounded-xl p-3 border transition-colors duration-150 ${
                          m.isMe ? 'bg-indigo-500/10 border-indigo-500/30'
                          : 'bg-slate-900/40 border-slate-700/30 hover:border-slate-600/40'
                        }`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`h-7 w-7 rounded-lg border text-xs font-bold flex items-center justify-center flex-shrink-0 ${rankStyle}`}>
                            #{i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${m.isMe ? 'text-indigo-300' : 'text-slate-200'}`}>
                              {m.name}
                              {m.isMe && (
                                <span className="ml-1.5 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded-full">You</span>
                              )}
                            </p>
                          </div>
                          <span className="text-sm font-bold text-white flex-shrink-0">{fmt(m.contribution)}</span>
                        </div>
                        <div className="w-full bg-slate-700/50 rounded-full h-1 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${m.isMe ? 'bg-indigo-500' : 'bg-slate-500'}`}
                            style={{ width: `${barPct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Settlement History */}
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-6 shadow-lg">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-base font-bold text-white">Settlement History</h3>
                  <p className="text-xs text-slate-500 mt-0.5">All transactions involving you</p>
                </div>
                <span className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">
                  {mySettlements.length} total
                </span>
              </div>

              {mySettlements.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-500 gap-2">
                  <svg className="w-8 h-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p className="text-sm">No settlement history yet.</p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {mySettlements.map((s) => {
                    const iSent = s.fromUserEmail === currentUser?.email;
                    return (
                      <div key={s.id}
                        className="rounded-xl p-3.5 bg-slate-900/40 border border-slate-700/30 hover:border-slate-600/40 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-slate-300 leading-snug">
                              <span className={`font-semibold ${iSent ? 'text-rose-300' : 'text-emerald-300'}`}>
                                {iSent ? 'You' : s.fromUserName}
                              </span>
                              {' → '}
                              <span className={`font-semibold ${!iSent ? 'text-emerald-300' : 'text-slate-200'}`}>
                                {!iSent ? 'You' : s.toUserName}
                              </span>
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {s.requestedAt?.toDate
                                ? s.requestedAt.toDate().toLocaleDateString('en-IN')
                                : '—'}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0 space-y-1">
                            <p className="text-sm font-bold text-white tabular-nums">{fmt(s.amount)}</p>
                            <StatusBadge status={s.status} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Trip Overview ──────────────────────────────────────────────── */}
          <div className="bg-slate-800/80 border border-slate-700/60 rounded-2xl p-5 shadow-lg">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-4">Trip Overview</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Contributions', value: fmt(totalContributions), color: 'text-indigo-400' },
                { label: 'Total Expenses',       value: fmt(totalGroupExpenses), color: 'text-rose-400'   },
                { label: 'Fair Share / Member',  value: fmt(myFairShare),        color: 'text-amber-400'  },
                { label: 'Members',              value: totalMembers,            color: 'text-teal-400'   },
              ].map((item) => (
                <div key={item.label} className="text-center p-3 bg-slate-900/50 rounded-xl border border-slate-700/30">
                  <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-tight">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
