import React from 'react';

export default function SetupBanner() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-xl border border-slate-700 p-6 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-indigo-500/10 text-indigo-400 rounded-xl mb-2">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">Firebase Setup Required</h2>
          <p className="text-slate-400 text-sm">
            Please configure your Firebase credentials to start using the Trip Expense Tracker app.
          </p>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-950 rounded-xl p-4 border border-slate-700 text-xs font-mono space-y-2 text-slate-300 overflow-x-auto">
            <p className="text-indigo-400"># Create a .env file in project root:</p>
            <p>VITE_FIREBASE_API_KEY=your_api_key</p>
            <p>VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain</p>
            <p>VITE_FIREBASE_PROJECT_ID=your_project_id</p>
            <p>VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket</p>
            <p>VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id</p>
            <p>VITE_FIREBASE_APP_ID=your_app_id</p>
          </div>

          <div className="text-sm text-slate-400 space-y-2 leading-relaxed">
            <p>1. Copy <code className="text-indigo-400 font-mono">.env.example</code> to <code className="text-indigo-400 font-mono">.env</code> in the project root.</p>
            <p>2. Fill in the credentials from your Firebase Project Console (Project Settings &gt; General &gt; Your apps).</p>
            <p>3. Restart the dev server (<code className="text-indigo-400 font-mono">npm run dev</code>).</p>
          </div>
        </div>

        <div className="pt-2 text-center text-xs text-slate-500">
          Trip Expense Tracker &bull; React & Tailwind CSS
        </div>
      </div>
    </div>
  );
}
