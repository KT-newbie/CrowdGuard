import React from 'react';
import { doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, ShieldCheck, Users, LogOut } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface RoleSelectionProps {
  onRoleSelected: (role: string) => void;
  userData?: any;
}

export function RoleSelection({ onRoleSelected, userData }: RoleSelectionProps) {
  const { t } = useTranslation();
  const selectRole = async (role: 'attendee' | 'manager' | 'crew') => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const userRef = doc(db, 'users', user.uid);
      if (userData?.role) {
        await updateDoc(userRef, { role: role });
      } else {
        await setDoc(userRef, {
          uid: user.uid,
          email: user.email,
          role: role,
          createdAt: serverTimestamp(),
          username: userData?.username || user.email?.split('@')[0],
          profilePictureUrl: userData?.profilePictureUrl || '',
          preferredLanguage: userData?.preferredLanguage || 'en'
        });
      }
      onRoleSelected(role);
    } catch (error: any) {
      toast.error(t('failed_save_role') + error.message);
    }
  };

  const roles = [
    {
      id: 'attendee',
      title: t('i_am_attendee'),
      description: t('attendee_desc'),
      icon: User,
      color: 'bg-blue-50 text-blue-600 border-blue-100',
    },
    {
      id: 'manager',
      title: t('i_am_manager'),
      description: t('manager_desc'),
      icon: ShieldCheck,
      color: 'bg-purple-50 text-purple-600 border-purple-100',
    },
    {
      id: 'crew',
      title: t('i_am_crew'),
      description: t('crew_desc'),
      icon: Users,
      color: 'bg-orange-50 text-orange-600 border-orange-100',
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-50 relative">
      <div className="absolute top-6 right-6">
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => auth.signOut()}
          className="text-slate-500 hover:text-red-600 transition-colors"
        >
          <LogOut className="mr-2 h-4 w-4" /> {t('logout')}
        </Button>
      </div>
      <div className="w-full max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 mb-4">
            {t('welcome')}, {userData?.username || auth.currentUser?.email?.split('@')[0]}
          </h1>
          <p className="text-slate-600 font-medium">
            {t('choose_role')}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {roles.map((role, index) => (
            <div key={role.id}>
              <Card 
                className={`h-full cursor-pointer hover:shadow-xl transition-all duration-300 border-2 hover:border-slate-300 group`}
                onClick={() => selectRole(role.id as any)}
              >
                <CardHeader>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${role.color} border group-hover:scale-110 transition-transform`}>
                    <role.icon className="w-6 h-6" />
                  </div>
                  <CardTitle className="text-xl">{role.title}</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    {role.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="ghost" className="w-full justify-between group-hover:bg-slate-100">
                    {t('get_started')}
                    <span>
                      →
                    </span>
                  </Button>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
