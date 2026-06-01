import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db, auth } from '../firebase';

export default function GroupManager({ selectedGroupId, onSelectGroup }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [budget, setBudget] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    // 1. Listen for member entries for the current user's email
    const membersQuery = query(
      collection(db, 'members'),
      where('email', '==', auth.currentUser.email)
    );

    const unsubscribe = onSnapshot(membersQuery, async (snapshot) => {
      try {
        const groupIds = snapshot.docs.map(doc => doc.data().groupId);
        
        if (groupIds.length === 0) {
          setGroups([]);
          setLoading(false);
          return;
        }

        // 2. Fetch the actual group documents for these IDs
        // Firestore 'in' query is limited to 30 items, which is plenty for a simple tracker
        const groupsQuery = query(
          collection(db, 'groups'),
          where('__name__', 'in', groupIds.slice(0, 30))
        );

        const groupDocs = await getDocs(groupsQuery);
        const fetchedGroups = groupDocs.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Sort by createdAt desc
        fetchedGroups.sort((a, b) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });

        setGroups(fetchedGroups);
        
        // If no group is currently selected, select the first one automatically
        if (fetchedGroups.length > 0 && !selectedGroupId) {
          onSelectGroup(fetchedGroups[0]);
        }
      } catch (err) {
        console.error("Error loading groups:", err);
        setError("Failed to load groups. Please check firestore security rules.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [selectedGroupId, onSelectGroup]);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim()) {
      setError('Please enter a group name');
      return;
    }

    const budgetNum = Number(budget);
    if (isNaN(budgetNum) || budgetNum <= 0) {
      setError('Please enter a valid budget amount');
      return;
    }

    setSubmitting(true);
    try {
      // Generate a new group ID
      const groupRef = doc(collection(db, 'groups'));
      const groupId = groupRef.id;

      // 1. Create group doc
      const groupData = {
        name: name.trim(),
        budget: budgetNum,
        leaderId: auth.currentUser.uid,
        leaderEmail: auth.currentUser.email,
        createdAt: new Date() // fallback if serverTimestamp() delay is problematic for client
      };

      await setDoc(groupRef, groupData);

      // 2. Create leader member doc
      const memberRef = doc(db, 'members', `${groupId}_${auth.currentUser.email}`);
      await setDoc(memberRef, {
        groupId,
        userId: auth.currentUser.uid,
        email: auth.currentUser.email,
        role: 'leader',
        addedAt: new Date()
      });

      setName('');
      setBudget('');
      setSuccess(`Group "${groupData.name}" created successfully!`);
      
      // Auto select the new group
      onSelectGroup({ id: groupId, ...groupData });
    } catch (err) {
      console.error("Error creating group:", err);
      setError("Failed to create group: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Create Group Form */}
      <div className="md:col-span-1 bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg h-fit">
        <h3 className="text-xl font-bold text-white mb-4">Create New Group</h3>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 text-xs mb-4">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-3 text-xs mb-4">
            {success}
          </div>
        )}

        <form onSubmit={handleCreateGroup} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5" htmlFor="group-name">
              Group/Trip Name
            </label>
            <input
              id="group-name"
              type="text"
              required
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
              placeholder="e.g. Europe Trip 2026"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5" htmlFor="group-budget">
              Total Budget ($)
            </label>
            <input
              id="group-budget"
              type="number"
              required
              min="1"
              step="any"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
              placeholder="e.g. 5000"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-semibold py-2.5 px-4 rounded-xl transition-all shadow-md text-sm flex items-center justify-center space-x-2"
          >
            {submitting ? 'Creating...' : 'Create Group'}
          </button>
        </form>
      </div>

      {/* Select Group List */}
      <div className="md:col-span-2 bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg">
        <h3 className="text-xl font-bold text-white mb-4">My Groups</h3>
        
        {loading ? (
          <div className="flex justify-center items-center py-8">
            <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-8 text-slate-400 space-y-2">
            <svg className="w-12 h-12 mx-auto text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <p className="text-sm">You are not a member of any group yet.</p>
            <p className="text-xs text-slate-500">Create a new group on the left to get started, or ask a leader to add your email ({auth.currentUser?.email}).</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {groups.map((group) => {
              const isSelected = group.id === selectedGroupId;
              const isLeader = group.leaderEmail === auth.currentUser?.email;
              return (
                <div
                  key={group.id}
                  onClick={() => onSelectGroup(group)}
                  className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col justify-between h-36 ${
                    isSelected
                      ? 'bg-indigo-600/10 border-indigo-500 shadow-md shadow-indigo-500/5'
                      : 'bg-slate-900/50 border-slate-700 hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-semibold text-white text-base truncate max-w-[80%]">
                        {group.name}
                      </h4>
                      {isLeader ? (
                        <span className="text-[10px] uppercase font-bold tracking-wide bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full shrink-0">
                          Leader
                        </span>
                      ) : (
                        <span className="text-[10px] uppercase font-bold tracking-wide bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full shrink-0">
                          Member
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1 truncate">
                      Leader: {group.leaderEmail}
                    </p>
                  </div>

                  <div className="border-t border-slate-700/50 pt-2 flex justify-between items-center mt-2">
                    <span className="text-xs text-slate-400">Budget</span>
                    <span className="font-bold text-white text-sm">
                      ${group.budget?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
