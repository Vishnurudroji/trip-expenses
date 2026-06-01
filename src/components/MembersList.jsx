import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';

export default function MembersList({ activeGroup }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isLeader = activeGroup?.leaderEmail === auth.currentUser?.email;

  useEffect(() => {
    if (!activeGroup?.id) return;

    setLoading(true);
    setError('');
    setSuccess('');

    const membersQuery = query(
      collection(db, 'members'),
      where('groupId', '==', activeGroup.id)
    );

    const unsubscribe = onSnapshot(membersQuery, (snapshot) => {
      const fetchedMembers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort members: leader first, then by email
      fetchedMembers.sort((a, b) => {
        if (a.role === 'leader') return -1;
        if (b.role === 'leader') return 1;
        return a.email.localeCompare(b.email);
      });

      setMembers(fetchedMembers);
      setLoading(false);
    }, (err) => {
      console.error("Error loading members:", err);
      setError("Failed to load members: " + err.message);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeGroup?.id]);

  const handleAddMember = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const memberEmail = email.trim().toLowerCase();
    if (!memberEmail) {
      setError('Please enter an email address');
      return;
    }

    // Validate simple email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(memberEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    // Check if already a member
    const alreadyMember = members.some(m => m.email.toLowerCase() === memberEmail);
    if (alreadyMember) {
      setError('This user is already a member of this group');
      return;
    }

    setSubmitting(true);
    try {
      // Document ID: groupId_email (enforces uniqueness per group + email)
      const docId = `${activeGroup.id}_${memberEmail}`;
      await setDoc(doc(db, 'members', docId), {
        groupId: activeGroup.id,
        email: memberEmail,
        role: 'member',
        addedAt: new Date()
      });

      setEmail('');
      setSuccess(`Successfully added ${memberEmail} to the group.`);
    } catch (err) {
      console.error("Error adding member:", err);
      setError("Failed to add member: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (member) => {
    if (member.role === 'leader') {
      setError('Cannot remove the group leader');
      return;
    }

    if (!window.confirm(`Are you sure you want to remove ${member.email} from the group?`)) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      const docId = `${activeGroup.id}_${member.email}`;
      await deleteDoc(doc(db, 'members', docId));
      setSuccess(`Successfully removed ${member.email} from the group.`);
    } catch (err) {
      console.error("Error removing member:", err);
      setError("Failed to remove member: " + err.message);
    }
  };

  if (!activeGroup) {
    return (
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 text-center text-slate-400">
        Please select or create a group to view members.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Add Member Form (Leader Only) */}
      <div className="md:col-span-1">
        {isLeader ? (
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg h-fit">
            <h3 className="text-xl font-bold text-white mb-4">Add Member</h3>
            
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

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5" htmlFor="member-email">
                  Member Email Address
                </label>
                <input
                  id="member-email"
                  type="email"
                  required
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm"
                  placeholder="e.g. member@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-600/50 text-white font-semibold py-2.5 px-4 rounded-xl transition-all shadow-md text-sm flex items-center justify-center space-x-2"
              >
                {submitting ? 'Adding...' : 'Add Member'}
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-slate-800/40 rounded-2xl border border-slate-700/50 p-6 text-center text-slate-400 text-sm">
            <svg className="w-10 h-10 mx-auto text-slate-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <p className="font-semibold text-slate-300">Leader Privilege Required</p>
            <p className="text-xs text-slate-500 mt-1">Only the group leader ({activeGroup.leaderEmail}) can add or remove members.</p>
          </div>
        )}
      </div>

      {/* Members List */}
      <div className="md:col-span-2 bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-white">Group Members</h3>
          <span className="text-xs bg-slate-700 text-slate-300 px-3 py-1 rounded-full font-semibold">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-8">
            <svg className="animate-spin h-8 w-8 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {members.map((member) => {
              const isCurrentUser = member.email.toLowerCase() === auth.currentUser?.email.toLowerCase();
              return (
                <div key={member.id} className="py-3 flex justify-between items-center gap-4">
                  <div className="flex items-center space-x-3 truncate">
                    <div className="w-9 h-9 rounded-full bg-slate-700 text-white font-bold flex items-center justify-center shrink-0">
                      {member.email.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-semibold text-white truncate">
                        {member.email} {isCurrentUser && <span className="text-xs text-indigo-400 font-normal">(you)</span>}
                      </p>
                      <p className="text-xs text-slate-400">
                        {member.role === 'leader' ? 'Group Leader' : 'Group Member'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {member.role === 'leader' ? (
                      <span className="text-[10px] uppercase font-bold tracking-wide bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full">
                        Leader
                      </span>
                    ) : isLeader ? (
                      <button
                        onClick={() => handleRemoveMember(member)}
                        className="text-xs text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/30 px-3 py-1 rounded-lg border border-rose-500/20 transition-all"
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="text-[10px] uppercase font-bold tracking-wide bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">
                        Member
                      </span>
                    )}
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
