import React, { useState, useEffect } from 'react';
import { MapPin, ShieldAlert, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';

interface GeolocationGateProps {
  children: React.ReactNode;
}

export function GeolocationGate({ children }: GeolocationGateProps) {
  const [status, setStatus] = useState<'prompting' | 'granted' | 'denied' | 'error'>('prompting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { t } = useTranslation();

  const checkLocation = (isManual = false) => {
    setStatus('prompting');
    setErrorMessage(null);

    if (!navigator.geolocation) {
      setStatus('error');
      setErrorMessage('Geolocation is not supported by your browser');
      return;
    }

    const performCheck = () => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('Location granted:', position.coords.latitude, position.coords.longitude);
          setStatus('granted');
        },
        (error) => {
          console.error('Location error:', error);
          if (error.code === 1) { // PERMISSION_DENIED
            setStatus('denied');
          } else {
            setStatus('error');
            setErrorMessage(error.message || 'Unknown location error');
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    };

    if (isManual) {
      // Small delay to ensure the "Checking..." state is visible to the user
      setTimeout(performCheck, 300);
    } else {
      // Small delay on auto-start to avoid race conditions with mounting
      setTimeout(performCheck, 500);
    }
  };

  useEffect(() => {
    // Check initially
    checkLocation(false);

    // Also listen for permission changes if supported
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'geolocation' as PermissionName }).then((result) => {
        result.onchange = () => {
          if (result.state === 'granted') {
            checkLocation();
          } else if (result.state === 'denied') {
            setStatus('denied');
          } else {
            setStatus('prompting');
          }
        };
      });
    }
  }, []);

  if (status === 'granted') {
    return <>{children}</>;
  }

  return (
    <div className="relative min-h-screen">
      {/* Background content blurred */}
      <div className="fixed inset-0 opacity-20 pointer-events-none grayscale">
        {children}
      </div>

      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-6 bg-slate-900/40 backdrop-blur-md"
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
          >
            <div className="h-2 w-full bg-blue-600" />
            <div className="p-8 text-center space-y-6">
              <div className="mx-auto w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                {status === 'denied' || status === 'error' ? (
                  <ShieldAlert className="h-10 w-10 text-red-500" />
                ) : (
                  <MapPin className="h-10 w-10 animate-pulse" />
                )}
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900">
                  {status === 'denied' ? t('location_required_title', { defaultValue: 'Location Access Required' }) : t('checking_location', { defaultValue: 'Ensuring Secure Access' })}
                </h2>
                <p className="text-slate-500">
                  {status === 'denied' 
                    ? t('location_denied_desc', { defaultValue: 'This application requires geographical access to manage security, live tracking, and emergency services. Please enable location permissions in your browser settings.' }) 
                    : t('location_prompt_desc', { defaultValue: 'We need to verify your position to authorize access to the event management system.' })}
                </p>
                {errorMessage && status === 'error' && (
                  <p className="text-xs text-red-500 font-mono mt-4 bg-red-50 p-2 rounded-lg">{errorMessage}</p>
                )}
              </div>

              <div className="pt-4 space-y-3">
                <Button 
                  onClick={() => checkLocation(true)}
                  disabled={status === 'prompting'}
                  className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`h-4 w-4 ${status === 'prompting' ? 'animate-spin' : ''}`} />
                  {status === 'prompting' ? t('checking', { defaultValue: 'Checking...' }) : (status === 'denied' ? t('retry_permission', { defaultValue: 'Try Again' }) : t('enable_location', { defaultValue: 'Enable Location' }))}
                </Button>
                
                <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">
                  Secure Identity Protocol • Geofencing Active
                </p>
              </div>
            </div>
            
            <div className="bg-slate-50 px-8 py-4 border-t text-[10px] text-slate-500">
              <p>
                <strong>How to enable:</strong> Look for the lock or info icon near the address bar, find "Location" and set to "Allow". Reload the page if necessary.
              </p>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
