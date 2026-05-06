/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useAuthState } from 'react-firebase-hooks/auth';
import { useDocumentData } from 'react-firebase-hooks/firestore';
import { auth, db } from '@/lib/firebase';
import { doc } from 'firebase/firestore';
import { AuthForm } from '@/components/auth/AuthForm';
import { RoleSelection } from '@/components/auth/RoleSelection';
import { GeolocationGate } from '@/components/common/GeolocationGate';
import { AttendeeDashboard } from '@/components/dashboard/AttendeeDashboard';
import { ManagerDashboard } from '@/components/dashboard/ManagerDashboard';
import { CrewDashboard } from '@/components/dashboard/CrewDashboard';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { Toaster } from '@/components/ui/sonner';
import { Button } from '@/components/ui/button';
import { Loader2, Settings } from 'lucide-react';
import React, { useState, useEffect, Component, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';


export default function App() {
  const [user, loading, error] = useAuthState(auth);
  const [userData, userLoading] = useDocumentData(
    user ? doc(db, 'users', user.uid) : null
  );
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const { i18n, t } = useTranslation();

  const [loadingTimeout, setLoadingTimeout] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (loading || userLoading) {
        setLoadingTimeout(true);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [loading, userLoading]);

  useEffect(() => {
    if (!user) {
      setSelectedRole(null);
    }
  }, [user]);

  // We remove the automatic sync to ensure users always land on RoleSelection page after sign-in.
  // The role is still saved in Firestore for historical/profile purposes, but the UI starts neutral.
  /*
  useEffect(() => {
    if (userData?.role) {
      setSelectedRole(userData.role);
    }
  }, [userData]);
  */

  if (loading || userLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
        <p className="text-slate-400 text-sm italic">Synchronizing with Secure Feed...</p>
        {(loadingTimeout || true) && (
          <div className="mt-8 p-4 bg-white rounded-xl border border-slate-200 shadow-sm max-w-xs text-center">
            <p className="text-xs text-slate-500 mb-4">Taking longer than usual? The authentication server might be busy.</p>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="w-full">
              Force Reload
            </Button>
            {user && (
              <Button variant="ghost" size="sm" onClick={() => auth.signOut()} className="w-full mt-2 text-red-500">
                Sign Out
              </Button>
            )}
          </div>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center p-8 bg-white rounded-2xl shadow-xl border">
          <h2 className="text-2xl font-bold text-red-600 mb-2">{t('auth_error')}</h2>
          <p className="text-slate-600">{error.message}</p>
        </div>
      </div>
    );
  }

  const handleBack = () => setSelectedRole(null);

  return (
    <GeolocationGate>
      <div className="fixed top-0 left-0 bg-blue-500 text-white z-[9999] px-2 py-1 text-[8px]">APP_SECURE_MODE :: {selectedRole || 'AUTH'}</div>
      {selectedRole === 'attendee' && <AttendeeDashboard onBack={handleBack} userData={userData} onOpenSettings={() => setIsSettingsOpen(true)} />}
      {selectedRole === 'manager' && <ManagerDashboard onBack={handleBack} userData={userData} onOpenSettings={() => setIsSettingsOpen(true)} />}
      {selectedRole === 'crew' && <CrewDashboard onBack={handleBack} userData={userData} onOpenSettings={() => setIsSettingsOpen(true)} />}
      
      {!user && (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <AuthForm />
        </div>
      )}

      {user && !selectedRole && (
        <>
          <RoleSelection onRoleSelected={setSelectedRole} userData={userData} />
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="fixed bottom-6 right-6 p-4 bg-white shadow-xl border rounded-2xl text-slate-600 hover:text-blue-600 transition-all z-40 hover:scale-110 active:scale-95"
          >
            <Settings className="h-6 w-6" />
          </button>
        </>
      )}

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        userData={userData} 
      />
      <Toaster position="top-center" />
    </GeolocationGate>
  );
}

