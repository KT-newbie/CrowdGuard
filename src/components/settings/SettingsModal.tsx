import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { auth, db } from '@/lib/firebase';
import { 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider,
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  updateDoc, 
  getDocs, 
  collection, 
  query, 
  where 
} from 'firebase/firestore';
import { 
  X, 
  User, 
  Lock, 
  Globe, 
  Camera, 
  Check, 
  Loader2,
  Shield,
  CircleAlert
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userData: any;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, userData }) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [loading, setLoading] = useState(false);

  // Profile State
  const [username, setUsername] = useState(userData?.username || '');
  const [profilePic, setProfilePic] = useState(userData?.profilePictureUrl || '');
  
  // Security State
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleUpdateProfile = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      // Check if username is taken
      if (username !== userData?.username) {
        const q = query(collection(db, 'users'), where('username', '==', username));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          toast.error(t('username_taken'));
          setLoading(false);
          return;
        }
      }

      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        username,
        profilePictureUrl: profilePic
      });

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName: username,
          photoURL: profilePic
        });
      }

      toast.success(t('save_success', { defaultValue: 'Profile updated!' }));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!auth.currentUser || !auth.currentUser.email) return;

    if (newPassword === currentPassword) {
      toast.error(t('pass_match_error'));
      return;
    }

    // Requirements: 12-16 chars, upper, lower, number, symbol
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).{12,16}$/;
    
    if (!passwordRegex.test(newPassword)) {
      toast.error(t('pass_req_error'));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('passwords_dont_match', { defaultValue: 'Passwords do not match' }));
      return;
    }

    setLoading(true);
    try {
      const credential = EmailAuthProvider.credential(auth.currentUser.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      
      toast.success(t('change_password_success', { defaultValue: 'Password changed successfully!' }));
      setShowPasswordForm(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfilePic(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl flex flex-col md:flex-row h-[500px]"
      >
        {/* Sidebar */}
        <div className="w-full md:w-48 bg-slate-50 border-r p-4 flex flex-col gap-2">
          <div className="mb-4 px-2">
            <h2 className="text-xl font-bold text-slate-900">{t('settings')}</h2>
          </div>
          <button 
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${activeTab === 'profile' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:bg-white/50'}`}
          >
            <User className="h-4 w-4" />
            <span className="text-sm font-medium">{t('profile')}</span>
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${activeTab === 'security' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:bg-white/50'}`}
          >
            <Shield className="h-4 w-4" />
            <span className="text-sm font-medium">{t('security')}</span>
          </button>
          
          <div className="mt-auto">
            <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 text-xs" onClick={() => auth.signOut()}>
              <X className="mr-2 h-3 w-3" /> {t('logout')}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="p-6 flex justify-between items-center border-b">
            <h3 className="font-bold text-slate-800 uppercase tracking-wider text-xs">{t(activeTab)}</h3>
            <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-full transition-colors">
              <X className="h-5 w-5 text-slate-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'profile' && (
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="relative group">
                    <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-slate-100 bg-slate-200">
                      {profilePic ? (
                        <img src={profilePic} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-400 font-bold text-2xl">
                          {username?.charAt(0).toUpperCase() || auth.currentUser?.email?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <label className="absolute bottom-0 right-0 p-2 bg-blue-600 rounded-full text-white cursor-pointer shadow-lg hover:scale-110 transition-transform">
                      <Camera className="h-4 w-4" />
                      <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                    </label>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-slate-900">{username || auth.currentUser?.email}</p>
                    <p className="text-xs text-slate-400">{auth.currentUser?.email}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="username">{t('username')}</Label>
                    <Input 
                      id="username" 
                      value={username} 
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={t('enter_username')}
                    />
                  </div>
                  <Button className="w-full bg-slate-900" onClick={handleUpdateProfile} disabled={loading}>
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('save')}
                  </Button>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="space-y-6">
                {auth.currentUser?.providerData?.some(p => p.providerId === 'password') ? (
                  !showPasswordForm ? (
                    <div className="p-6 border-2 border-dashed rounded-3xl text-center space-y-4">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
                        <Lock className="h-6 w-6" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{t('change_password')}</p>
                        <p className="text-xs text-slate-500 mt-1">{t('update_security_desc')}</p>
                      </div>
                      <Button variant="outline" className="w-full rounded-xl" onClick={() => setShowPasswordForm(true)}>
                        {t('change_password')}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="current-pass">{t('current_password')}</Label>
                        <Input id="current-pass" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-pass">{t('new_password')}</Label>
                        <Input id="new-pass" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirm-pass">{t('confirm_password')}</Label>
                        <Input id="confirm-pass" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <Button variant="ghost" className="flex-1" onClick={() => setShowPasswordForm(false)}>{t('cancel')}</Button>
                        <Button className="flex-1 bg-blue-600 hover:bg-blue-700" onClick={handleChangePassword} disabled={loading}>
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('change')}
                        </Button>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="p-6 bg-slate-50 rounded-3xl text-center space-y-4">
                    <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mx-auto">
                      <Shield className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">Secured by Google</p>
                      <p className="text-sm text-slate-500 mt-2">
                        You signed in using your Google account. You do not have an application-specific password.
                        Your account security is managed by Google.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};
