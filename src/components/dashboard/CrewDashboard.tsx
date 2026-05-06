import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  serverTimestamp,
  addDoc,
  orderBy
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Shield, 
  Stethoscope, 
  Map as MapIcon, 
  AlertTriangle, 
  Bell, 
  Settings,
  LogOut, 
  CheckCircle2,
  Navigation,
  MessageSquare,
  Clock,
  Users,
  X,
  Menu,
  Lock,
  Calendar,
  MapPin,
  Send,
  LayoutDashboard,
  Activity,
  Search,
  ChevronRight,
  History,
  Camera,
  SlidersHorizontal,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { CrowdMap } from '@/components/common/CrowdMap';
import { getZoneCapacity } from '@/lib/zoneUtils';
import { FloatingChat } from '@/components/chat/FloatingChat';

interface ZoneData {
  id: string;
  name: string;
  peopleCount: number;
  capacity?: number;
  areaM2: number;
  isSeated: boolean;
  recommendedExitDoor?: string;
}

function SidebarLink({ icon: Icon, label, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-all duration-300 group ${
        active 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
          : 'text-slate-400 hover:text-white hover:bg-slate-800'
      }`}
    >
      <Icon className={`h-5 w-5 transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`} />
      <span className="font-bold text-sm">{label}</span>
      {active && (
        <motion.div 
          layoutId="sidebar-active-crew"
          className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]"
        />
      )}
    </button>
  );
}

// --- Standalone Sidebar Component ---

interface SidebarProps {
  isVisible: boolean;
  onHide: () => void;
  activeEvent: any;
  setActiveEvent: (event: any) => void;
  position: string | null;
  setPosition: (pos: string | null) => void;
  onOpenSettings?: () => void;
  onBack?: () => void;
  t: (key: string) => string;
}

function CrewSidebar({ isVisible, onHide, activeEvent, setActiveEvent, position, setPosition, onOpenSettings, onBack, t }: SidebarProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.aside 
          initial={{ x: -280, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -280, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="w-72 bg-slate-900 text-white p-6 sm:p-8 flex flex-col fixed lg:sticky shadow-2xl lg:shadow-none top-0 h-[100dvh] shrink-0 z-40"
        >
          <div className="flex items-center justify-between mb-12">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Shield className="h-6 w-6" />
              </div>
              <h1 className="text-2xl font-black tracking-tighter">CrowdGuard</h1>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-slate-400 hover:text-white"
              onClick={onHide}
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>
          
          <nav className="space-y-2 flex-1">
            <SidebarLink icon={LayoutDashboard} label={t('overview')} active={!activeEvent && !position} onClick={() => { setActiveEvent(null); setPosition(null); }} />
            <SidebarLink icon={Settings} label={t('settings')} onClick={onOpenSettings} />
            {onBack && (
              <button 
                onClick={onBack}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl transition-all duration-300 text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <Navigation className="h-5 w-5 rotate-180" />
                <span className="font-bold text-sm">{t('change_role')}</span>
              </button>
            )}
          </nav>

          <div className="pt-8 border-t border-slate-800">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-red-400 hover:text-white hover:bg-red-600 rounded-xl transition-all" 
              onClick={() => auth.signOut()}
            >
              <LogOut className="mr-2 h-4 w-4" /> {t('sign_out')}
            </Button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export function CrewDashboard({ onBack, userData, onOpenSettings }: { onBack?: () => void, userData?: any, onOpenSettings?: () => void }) {
  const { t } = useTranslation();
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [position, setPosition] = useState<'staff' | 'medical' | null>(null);
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [currentUserLocation, setCurrentUserLocation] = useState<any>(null);
  const [allCrewLocations, setAllCrewLocations] = useState<any[]>([]);
  const [sosRequests, setSosRequests] = useState<any[]>([]);
  const [intelligenceReports, setIntelligenceReports] = useState<any[]>([]);
  const [newReport, setNewReport] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'ongoing' | 'history'>('all');
  const [zones, setZones] = useState<ZoneData[]>([]);
  const [gates, setGates] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<ZoneData | null>(null);
  const [selectedGate, setSelectedGate] = useState<any | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [verifyingEvent, setVerifyingEvent] = useState<any>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [selectedChatUserId, setSelectedChatUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('crowdguard_crew_search_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [filters, setFilters] = useState({
    date: '',
    state: '',
    venue: '',
    type: 'all',
    sortBy: 'latest'
  });
  const [showFilters, setShowFilters] = useState(false);

  const filterStates = Array.from(new Set(events.map(e => e.state).filter(Boolean)));
  const filterVenues = Array.from(new Set(events.map(e => e.venue).filter(Boolean)));

  const addToHistory = (query: string) => {
    if (!query.trim()) return;
    const newHistory = [query, ...searchHistory.filter(h => h !== query)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('crowdguard_crew_search_history', JSON.stringify(newHistory));
  };

  // Distance calculation helper
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<{id: string, text: string, time: string}[]>([]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const SOSCard = ({ 
  sos, 
  activeEvent, 
  onMarkArrived, 
  onAssign,
  onResolve,
  onOpenChat,
  position
}: { 
  sos: any, 
  activeEvent: any, 
  onMarkArrived: (id: string) => Promise<void>,
  onAssign: (id: string) => Promise<void>,
  onResolve: (id: string) => Promise<void>,
  onOpenChat: (userId: string) => void,
  position: string | null,
  key?: string
}) => {
  const { t } = useTranslation();

  return (
    <Card className={`border-none shadow-md overflow-hidden ${
      sos.assignedCrewId === auth.currentUser?.uid ? 'ring-2 ring-blue-500 bg-blue-50/50' : 
      sos.severity === 'emergency' ? 'bg-red-50' : 'bg-white'
    }`}>
      <CardContent className="p-5">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
              sos.assignedCrewId === auth.currentUser?.uid ? (sos.status === 'arrived' ? 'bg-green-600' : 'bg-blue-600') + ' text-white' :
              sos.severity === 'emergency' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}>
              {sos.category === 'medical' ? <Stethoscope className="h-6 w-6" /> : <Shield className="h-6 w-6" />}
            </div>
            <div>
              <p className="font-black text-slate-900 capitalize tracking-tight leading-tight">{t(sos.category)} {t('help')}</p>
              <p className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" /> {sos.zoneName}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1">
              {(sos.status === 'assigned' || sos.status === 'arrived') && sos.assignedCrewId === auth.currentUser?.uid && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200"
                  onClick={() => onOpenChat(sos.userId)}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </Button>
              )}
              <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                sos.status === 'arrived' ? 'bg-green-600 text-white' :
                sos.status === 'assigned' ? 'bg-blue-600 text-white' : 
                sos.severity === 'emergency' ? 'bg-red-600 text-white' : 'bg-orange-100 text-orange-600'
              }`}>
                {sos.status === 'arrived' ? t('arrived') : sos.status === 'assigned' ? t('responding') : t(sos.severity)}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">{sos.timestamp?.seconds ? new Date(sos.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</p>
          </div>
        </div>

        {/* Detailed Location Info - Visible once accepted */}
        {(sos.status === 'assigned' || sos.status === 'arrived') && (
           <div className="mb-4 p-3 bg-white rounded-xl border border-slate-100 flex items-center justify-between">
              <div className="flex gap-4">
                 <div className="flex flex-col">
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t('row')}</span>
                   <span className="text-xs font-bold text-slate-900">{sos.rowNumber || 'N/A'}</span>
                 </div>
                 <div className="flex flex-col">
                   <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{t('seat')}</span>
                   <span className="text-xs font-bold text-slate-900">{sos.seatNumber || 'N/A'}</span>
                 </div>
              </div>
              {sos.status === 'assigned' && (
                <div className="text-right flex flex-col items-end">
                  <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">{t('target_arrival')}</span>
                  <span className="text-xs font-black text-blue-600 tabular-nums">
                     {sos.targetArrivalTime ? <SOSCountdown targetAt={sos.targetArrivalTime} /> : '--:--'}
                  </span>
                </div>
              )}
           </div>
        )}

        <div className="flex gap-2">
          {sos.status === 'pending' ? (
            <Button className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 font-bold" onClick={() => onAssign(sos.id)}>
               {t('accept_case')}
            </Button>
          ) : (
            sos.assignedCrewId === auth.currentUser?.uid && (
              <>
                {sos.status === 'assigned' && (
                  <Button 
                    className="flex-1 rounded-xl bg-green-600 hover:bg-green-700 font-bold shadow-lg shadow-green-600/20" 
                    onClick={() => onMarkArrived(sos.id)}
                  >
                    {t('mark_arrived')}
                  </Button>
                )}
                {sos.status === 'arrived' && (
                  <Button 
                    className="flex-1 rounded-xl bg-slate-900 hover:bg-slate-800 font-bold" 
                    onClick={() => onResolve(sos.id)}
                    disabled={(position === 'staff' && sos.category === 'medical') || (position === 'medical' && sos.category !== 'medical')}
                  >
                    {t('mark_resolved')}
                  </Button>
                )}
              </>
            )
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Countdown Helper Component
const SOSCountdown = ({ targetAt }: { targetAt: number }) => {
  const [timeLeft, setTimeLeft] = useState(Math.max(0, Math.floor((targetAt - Date.now()) / 1000)));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(Math.max(0, Math.floor((targetAt - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [targetAt]);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;

  return (
    <span className="tabular-nums">
      {mins}:{secs.toString().padStart(2, '0')}
    </span>
  );
};

  // 0. Update Staff Location
  useEffect(() => {
    if (!activeEvent || !position) return;
    const trackLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setCurrentUserLocation(loc);
          if (auth.currentUser) {
            setDoc(
              doc(db, 'events', activeEvent.id, 'crewLocations', auth.currentUser.uid),
              {
                uid: auth.currentUser.uid,
                lat: loc.lat,
                lng: loc.lng,
                role: position,
                timestamp: serverTimestamp(),
              },
              { merge: true }
            );
          }
          setLocationDenied(false);
        },
        (error) => {
          console.info("Geographic location access has been disabled (Error):", error.message);
          if (!locationDenied) {
            toast.error(t('location_access_disallowed'), {
              icon: <MapPin className="h-4 w-4" />,
              duration: 5000
            });
          }
          setLocationDenied(true);
          // Fallback to a mock location for demo (near Unifi Arena coords roughly)
          const loc = { lat: 3.053, lng: 101.696 };
          setCurrentUserLocation(loc);
        }
      );
    };
    trackLocation();
    const interval = setInterval(trackLocation, 10000);
    return () => clearInterval(interval);
  }, [activeEvent, position]);

  // 0.1 Fetch Events for Selection
  useEffect(() => {
    const q = query(collection(db, 'events'), where('status', '==', 'successful'));
    return onSnapshot(q, (snapshot) => {
      const allEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`[CrewDashboard] Fetched ${allEvents.length} successful events.`, allEvents.map((e: any) => e.name));
      setEvents(allEvents);
    }, (error) => {
      console.error("[CrewDashboard] Events fetch error:", error);
      handleFirestoreError(error, OperationType.GET, 'events-list');
    });
  }, [t]);

  // 0.2 Fetch All Crew Locations for proximity detection
  useEffect(() => {
    if (!activeEvent) return;
    const q = collection(db, 'events', activeEvent.id, 'crewLocations');
    return onSnapshot(q, (snapshot) => {
      setAllCrewLocations(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      );
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `events/${activeEvent.id}/crewLocations`);
    });
  }, [activeEvent]);

  // 1. Join Event with Code
  const handleJoinEvent = async (codeOverride: string) => {
    if (!codeOverride) return;
    
    setLoading(true);
    try {
      const q = query(collection(db, 'events'), where('eventCode', '==', codeOverride.toUpperCase()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        toast.error(t('invalid_event_code'));
        return;
      }
      
      const eventDoc = querySnapshot.docs[0];
      const eventData = { id: eventDoc.id, ...eventDoc.data() } as any;
      
      setActiveEvent(eventData);
      toast.success(t('joined_event', { event: eventData.name }));
    } catch (e: any) {
      console.error(e);
      toast.error("Error joining event: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyRequest = (event: any) => {
    setVerifyingEvent(event);
    setVerificationCode('');
  };

  const confirmVerification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyingEvent) return;
    
    if (verificationCode.toUpperCase() === verifyingEvent.eventCode?.toUpperCase()) {
      handleJoinEvent(verificationCode);
      setVerifyingEvent(null);
      setVerificationCode('');
    } else {
      toast.error(t('invalid_crew_code'));
    }
  };

  // 2. Fetch SOS Requests with Proximity Logic for Staff
  useEffect(() => {
    if (!activeEvent || !position) return;
    // Show both pending SOS and those assigned to current user
    const q = query(collection(db, 'events', activeEvent.id, 'sos'), where('status', 'in', ['pending', 'assigned', 'arrived']));
    return onSnapshot(q, (snapshot) => {
       const allSos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
       
       const myAssigned = allSos.filter(s => (s as any).assignedCrewId === auth.currentUser?.uid);

       if (position === 'medical') {
         const medicalSos = allSos.filter(s => 
           (s as any).status === 'pending' && (s as any).category === 'medical'
         );
         if (medicalSos.length > 0 && navigator.vibrate) {
            navigator.vibrate([300, 100, 300, 100, 300]);
         }
         setSosRequests([...myAssigned, ...medicalSos]);
         return;
       }

       // Staff logic: Nearest 5-6 (only for security, lost, crowd)
       if (position === 'staff' && currentUserLocation) {
         const pendingSos = allSos.filter(s => 
            (s as any).status === 'pending' && 
            ['security', 'lost', 'loss', 'crowd'].includes((s as any).category)
         );
         const filteredForProximity = pendingSos.filter(sos => {
            const staffInRole = allCrewLocations.filter(c => c.role === 'staff');
            const distances = staffInRole.map(c => ({
              uid: c.uid,
              dist: calculateDistance(c.lat, c.lng, (sos as any).lat, (sos as any).lng)
            })).sort((a,b) => a.dist - b.dist);

            const top6 = distances.slice(0, 6).map(d => d.uid);
            const isTarget = top6.includes(auth.currentUser?.uid);

            if (isTarget) {
               if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
               return true;
            }
            return false;
         });
         setSosRequests([...myAssigned, ...filteredForProximity]);
       }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `events/${activeEvent.id}/sos`);
    });
  }, [activeEvent, position, currentUserLocation, allCrewLocations]);

  // 3. Fetch Zones, Gates & Intelligence
  useEffect(() => {
    if (!activeEvent) return;
    
    // Polling every 5 seconds to sync exactly with Manager
    const fetchLiveStats = async () => {
      try {
        const zonesSnap = await getDocs(collection(db, 'events', activeEvent.id, 'zones'));
        const z = zonesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as ZoneData));
        setZones(z);
        
        z.forEach(zone => {
          const density = zone.peopleCount / getZoneCapacity(zone);
          const isSeated = zone.isSeated !== false;
          if (density >= 0.98 && !isSeated) {
            toast.error(`ALERT: ${zone.name.replace(/\s*\(.*?\)/g, '').replace(/north|south|east|west/gi, '').trim()} is in CRITICAL state! Immediate action required.`, {
              icon: <AlertTriangle className="h-5 w-5" />,
              duration: 10000
            });
          }
        });

        const gatesSnap = await getDocs(collection(db, 'events', activeEvent.id, 'gates'));
        setGates(gatesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        const iqSnap = await getDocs(collection(db, 'events', activeEvent.id, 'intelligence'));
        setIntelligenceReports(iqSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => (b as any).timestamp - (a as any).timestamp));
      } catch (error) {
        console.error("Failed to fetch live stats", error);
      }
    };
    
    fetchLiveStats();
    const intervalId = setInterval(fetchLiveStats, 5000);
    return () => clearInterval(intervalId);
  }, [activeEvent, position]);

  const handleMarkArrived = async (sosId: string) => {
    if (!activeEvent) return;
    const path = `events/${activeEvent.id}/sos/${sosId}`;
    try {
      await updateDoc(doc(db, 'events', activeEvent.id, 'sos', sosId), { status: 'arrived' });
      toast.success(t('arrival_confirmed'));
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  };

  const handleAssignSOS = async (sosId: string) => {
    if (!activeEvent || !auth.currentUser || !position) return;
    const path = `events/${activeEvent.id}/sos/${sosId}`;
    try {
      // Find the SOS request to check category
      const sosSnap = await getDoc(doc(db, 'events', activeEvent.id, 'sos', sosId));
      if (!sosSnap.exists()) return;
      const sosData = sosSnap.data();

      // Final check: prevent cross-role assignment
      if (position === 'medical' && sosData.category !== 'medical') {
        toast.error("Medical Team can only accept medical cases.");
        return;
      }
      if (position === 'staff' && sosData.category === 'medical') {
        toast.error("Staff cannot accept medical cases.");
        return;
      }

      const targetArrival = Date.now() + 5 * 60 * 1000;
      await updateDoc(doc(db, 'events', activeEvent.id, 'sos', sosId), {
        status: 'assigned',
        assignedCrewId: auth.currentUser.uid,
        etaMinutes: 5,
        targetArrivalTime: targetArrival
      });
      toast.success(t('case_assigned'));
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  };

  const handleResolveSOS = async (sosId: string) => {
    if (!activeEvent || !position) return;
    const path = `events/${activeEvent.id}/sos/${sosId}`;
    try {
      const sosSnap = await getDoc(doc(db, 'events', activeEvent.id, 'sos', sosId));
      if (!sosSnap.exists()) return;
      const sosData = sosSnap.data();

      // Ensure the correct role is resolving the case
      if (position === 'medical' && sosData.category !== 'medical') {
        toast.error("Medical Team cannot resolve non-medical cases.");
        return;
      }
      if (position === 'staff' && sosData.category === 'medical') {
        toast.error("Staff cannot resolve medical cases.");
        return;
      }

      await updateDoc(doc(db, 'events', activeEvent.id, 'sos', sosId), { status: 'resolved' });
      toast.success(t('case_resolved'));
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  };

  const handleSubmitReport = async () => {
    if (!newReport.trim() || !activeEvent) return;
    setSubmittingReport(true);
    try {
      const timestamp = Date.now();
      const senderName = userData?.username || 'Field Crew';
      const senderPosition = position === 'staff' ? 'Service Crew' : 'Medical Crew';
      
      // 1. Create intelligence report (event-specific)
      await addDoc(collection(db, 'events', activeEvent.id, 'intelligence'), {
        message: newReport,
        timestamp,
        type: 'manual',
        source: senderName,
        severity: 'info',
        position: senderPosition
      });

      // 2. Create global notification for Manager
      if (activeEvent.managerId) {
        await addDoc(collection(db, 'notifications'), {
          managerId: activeEvent.managerId,
          eventId: activeEvent.id,
          eventName: activeEvent.name,
          senderName,
          senderPosition,
          text: newReport,
          timestamp: serverTimestamp(),
          read: false,
          type: 'crew_message'
        });
      }

      setNewReport('');
      toast.success(t('intelligence_report_sync', { defaultValue: 'Intelligence report synchronized' }));
    } catch (e: any) {
      handleFirestoreError(e, OperationType.CREATE, `events/${activeEvent.id}/intelligence`);
    } finally {
      setSubmittingReport(false);
    }
  };

  if (!activeEvent) {
    return (
      <div className="min-h-screen bg-slate-50 flex relative w-full overflow-x-hidden">
        <CrewSidebar 
          isVisible={isSidebarVisible}
          onHide={() => setIsSidebarVisible(false)}
          activeEvent={activeEvent}
          setActiveEvent={setActiveEvent}
          position={position}
          setPosition={setPosition}
          onOpenSettings={onOpenSettings}
          onBack={onBack}
          t={t}
        />
        {!isSidebarVisible && (
          <Button 
            variant="ghost" 
            size="icon" 
            className="fixed bottom-6 left-6 z-50 bg-slate-900 border border-white/10 text-white rounded-full shadow-2xl flex hover:bg-slate-800 transition-all active:scale-95"
            onClick={() => setIsSidebarVisible(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}
        <main className="flex-1 overflow-auto w-full max-w-full">
          <header className="bg-white/80 backdrop-blur-md border-b px-4 sm:px-8 py-4 sm:py-6 flex justify-between items-center sticky top-0 z-30">
            <div className="flex items-center gap-4">
              {onBack && (
                <Button variant="ghost" size="sm" onClick={onBack} className="lg:hidden text-slate-500">
                  ← {t('back')}
                </Button>
              )}
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">{t('crew_center')}</h1>
            </div>
            <div className="flex gap-4 items-center">
              <Button variant="ghost" size="icon" className="text-slate-500" onClick={onOpenSettings}><Settings className="h-5 w-5" /></Button>
              <Button className="h-12 px-6 rounded-xl bg-slate-900 hover:bg-black text-white shadow-lg shadow-slate-900/20" onClick={() => auth.signOut()}>
                <LogOut className="mr-2 h-4 w-4" /> {t('sign_out')}
              </Button>
            </div>
          </header>

          <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6 sm:space-y-8 w-full overflow-x-hidden">
            <header className="mb-6 space-y-6">
              <div className="flex flex-col gap-1">
                <h2 className="text-3xl font-bold text-slate-900">{t('events')}</h2>
                <p className="text-slate-500 text-sm">{t('search_crew_events_desc', { defaultValue: 'Explore ongoing and upcoming events for your duty.' })}</p>
              </div>

              {/* Picture Perfect Search Bar */}
              <div className={`relative group ${isSearchFocused ? 'z-50' : 'z-0'}`}>
                <div className={`flex items-center gap-3 bg-white h-14 rounded-2xl px-4 border shadow-sm transition-all ${isSearchFocused ? 'border-orange-500 ring-4 ring-orange-500/10' : 'hover:border-slate-300'}`}>
                  {isSearchFocused ? (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setIsSearchFocused(false)}
                      className="rounded-full text-slate-400 hover:text-slate-600"
                    >
                      <ChevronRight className="h-5 w-5 rotate-180" />
                    </Button>
                  ) : (
                    <Search className="h-5 w-5 text-slate-400" />
                  )}
                  
                  <Input
                    placeholder="Search events..."
                    className="flex-1 border-none bg-transparent focus-visible:ring-0 text-slate-900 font-medium px-0 h-full"
                    value={searchQuery}
                    onFocus={() => setIsSearchFocused(true)}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addToHistory(searchQuery)}
                  />

                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="text-slate-400">
                      <Camera className="h-5 w-5" />
                    </Button>
                    <div className="w-[1px] h-6 bg-slate-100" />
                    <Button 
                      className="bg-orange-600 hover:bg-orange-700 rounded-xl w-10 h-10 p-0 flex items-center justify-center shrink-0"
                      onClick={() => addToHistory(searchQuery)}
                    >
                      <Search className="h-4 w-4 text-white" />
                    </Button>
                  </div>
                </div>

                <AnimatePresence>
                  {isSearchFocused && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="py-2">
                        {searchQuery ? (
                          events.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase())).length > 0 ? (
                            events
                              .filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase()))
                              .slice(0, 8)
                              .map(event => (
                                <button
                                  key={event.id}
                                  className="w-full flex items-center gap-3 px-6 py-4 hover:bg-slate-50 transition-colors text-left group"
                                  onClick={() => {
                                    setSearchQuery(event.name);
                                    setIsSearchFocused(false);
                                    addToHistory(event.name);
                                  }}
                                >
                                  <Search className="h-4 w-4 text-slate-300 group-hover:text-orange-500" />
                                  <span className="text-sm font-bold text-slate-700">{event.name.toLowerCase()}</span>
                                </button>
                              ))
                          ) : (
                            <div className="px-6 py-8 text-center">
                              <p className="text-sm text-slate-400 font-medium italic">No matches found for "{searchQuery}"</p>
                            </div>
                          )
                        ) : (
                          <>
                            {searchHistory.length > 0 && (
                              <>
                                <div className="px-6 py-3 flex items-center justify-between">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">History</span>
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-auto p-0 text-[10px] font-bold text-orange-500 hover:bg-transparent"
                                    onClick={() => {
                                      setSearchHistory([]);
                                      localStorage.removeItem('crowdguard_crew_search_history');
                                    }}
                                  >
                                    Clear All
                                  </Button>
                                </div>
                                {searchHistory.map(h => (
                                  <button
                                    key={h}
                                    className="w-full flex items-center gap-3 px-6 py-3 hover:bg-slate-50 transition-colors group"
                                    onClick={() => setSearchQuery(h)}
                                  >
                                    <History className="h-4 w-4 text-slate-300 group-hover:text-orange-500" />
                                    <span className="text-sm font-medium text-slate-600">{h}</span>
                                  </button>
                                ))}
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Filtering & Sorting Bar */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setShowFilters(!showFilters)}
                      className={`rounded-xl border-slate-200 text-slate-600 font-bold ${showFilters ? 'bg-orange-50 border-orange-200 text-orange-600' : ''}`}
                    >
                      <SlidersHorizontal className="h-4 w-4 mr-2" />
                      {t('filter')}
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t('sort_by')}</span>
                    <select 
                      className="bg-transparent border-none text-xs font-bold text-slate-700 focus:ring-0 cursor-pointer"
                      value={filters.sortBy}
                      onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                    >
                      <option value="latest">{t('latest')}</option>
                      <option value="popular">{t('popular')}</option>
                    </select>
                  </div>
                </div>

                <AnimatePresence>
                  {showFilters && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-white p-4 rounded-2xl border shadow-sm overflow-hidden"
                    >
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 pl-1">{t('date')}</label>
                        <Input 
                          type="date" 
                          className="h-10 rounded-xl border-slate-200" 
                          value={filters.date}
                          onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 pl-1">{t('state')}</label>
                        <select 
                          className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                          value={filters.state}
                          onChange={(e) => setFilters({ ...filters, state: e.target.value })}
                        >
                          <option value="">{t('all_states')}</option>
                          {filterStates.map(s => <option key={s as string} value={s as string}>{s as string}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 pl-1">{t('venue')}</label>
                        <select 
                          className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                          value={filters.venue}
                          onChange={(e) => setFilters({ ...filters, venue: e.target.value })}
                        >
                          <option value="">{t('all_venues')}</option>
                          {filterVenues.map(v => <option key={v as string} value={v as string}>{v as string}</option>)}
                        </select>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </header>

            <Tabs defaultValue="ongoing" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-8 bg-white border p-1 rounded-xl">
                <TabsTrigger value="ongoing" className="rounded-lg font-bold">{t('ongoing')}</TabsTrigger>
                <TabsTrigger value="upcoming" className="rounded-lg font-bold">{t('upcoming')}</TabsTrigger>
              </TabsList>

              <TabsContent value="ongoing" className="space-y-4">
                {events
                  .filter(e => e.isOngoing)
                  .filter(e => searchQuery ? e.name.toLowerCase().includes(searchQuery.toLowerCase()) : true)
                  .filter(e => {
                    if (filters.date && e.date !== filters.date) return false;
                    if (filters.state && e.state !== filters.state) return false;
                    if (filters.venue && e.venue !== filters.venue) return false;
                    return true;
                  })
                  .sort((a,b) => {
                    if (filters.sortBy === 'popular') return (b.peopleCount || 0) - (a.peopleCount || 0);
                    return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
                  })
                  .length > 0 ? (
                  events
                    .filter(e => e.isOngoing)
                    .filter(e => searchQuery ? e.name.toLowerCase().includes(searchQuery.toLowerCase()) : true)
                    .filter(e => {
                      if (filters.date && e.date !== filters.date) return false;
                      if (filters.state && e.state !== filters.state) return false;
                      if (filters.venue && e.venue !== filters.venue) return false;
                      return true;
                    })
                    .sort((a,b) => {
                      if (filters.sortBy === 'popular') return (b.peopleCount || 0) - (a.peopleCount || 0);
                      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
                    })
                    .map(event => (
                      <EventBanner key={event.id} event={event} type="ongoing" onAction={() => handleVerifyRequest(event)} />
                    ))
                ) : (
                  <div className="p-12 text-center bg-white rounded-[32px] border-2 border-dashed border-slate-200">
                    <Calendar className="h-12 w-12 mx-auto mb-4 text-slate-200" />
                    <p className="text-slate-400">{t('no_active_events')}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="upcoming" className="space-y-4">
                {events
                  .filter(e => !e.isOngoing && !e.isEnded && new Date(e.startDate || e.date.split(' to ')[0] || e.date) >= new Date(new Date().setHours(0,0,0,0)))
                  .filter(e => searchQuery ? e.name.toLowerCase().includes(searchQuery.toLowerCase()) : true)
                  .filter(e => {
                    if (filters.date && e.date !== filters.date) return false;
                    if (filters.state && e.state !== filters.state) return false;
                    if (filters.venue && e.venue !== filters.venue) return false;
                    return true;
                  })
                  .sort((a,b) => {
                    return new Date(a.startDate || a.date.split(' to ')[0] || a.date).getTime() - new Date(b.startDate || b.date.split(' to ')[0] || b.date).getTime();
                  })
                  .length > 0 ? (
                  events
                    .filter(e => !e.isOngoing && !e.isEnded && new Date(e.startDate || e.date.split(' to ')[0] || e.date) >= new Date(new Date().setHours(0,0,0,0)))
                    .filter(e => searchQuery ? e.name.toLowerCase().includes(searchQuery.toLowerCase()) : true)
                    .filter(e => {
                      if (filters.date && e.date !== filters.date) return false;
                      if (filters.state && e.state !== filters.state) return false;
                      if (filters.venue && e.venue !== filters.venue) return false;
                      return true;
                    })
                    .sort((a,b) => {
                      return new Date(a.startDate || a.date.split(' to ')[0] || a.date).getTime() - new Date(b.startDate || b.date.split(' to ')[0] || b.date).getTime();
                    })
                    .map(event => (
                      <EventBanner key={event.id} event={event} type="upcoming" onAction={() => {}} />
                    ))
                ) : (
                  <div className="p-12 text-center bg-white rounded-[32px] border-2 border-dashed border-slate-200">
                    <Calendar className="h-12 w-12 mx-auto mb-4 text-slate-200" />
                    <p className="text-slate-400">{t('no_upcoming_events')}</p>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <AnimatePresence>
            {verifyingEvent && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-6"
              >
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl"
                >
                  <div className="p-8 space-y-6">
                    <div className="flex justify-between items-start">
                      <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center">
                        <Lock className="h-6 w-6" />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setVerifyingEvent(null)} className="rounded-full">
                        <X className="h-5 w-5" />
                      </Button>
                    </div>
                    
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">{t('crew_verification')}</h3>
                      <p className="text-sm text-slate-500 mt-1">{t('enter_access_code_for', { event: verifyingEvent.name })}</p>
                    </div>

                    <form 
                      onSubmit={confirmVerification} 
                      className="space-y-4"
                    >
                      <Input 
                        placeholder={t('enter_access_code')} 
                        value={verificationCode}
                        onChange={e => setVerificationCode(e.target.value.toUpperCase())}
                        className="h-16 text-center text-2xl font-black tracking-widest uppercase rounded-2xl border-slate-200"
                        autoFocus
                      />
                      <Button 
                        type="submit"
                        disabled={loading || !verificationCode}
                        className="w-full h-16 bg-orange-600 hover:bg-orange-700 text-white text-lg font-bold rounded-2xl shadow-lg shadow-orange-600/20"
                      >
                        {loading ? (
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            {t('verifying')}...
                          </div>
                        ) : t('verify_join')}
                      </Button>
                    </form>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    );
  }

  if (!position) {
    return (
      <div className="min-h-screen bg-slate-50 flex">
        <CrewSidebar 
          isVisible={isSidebarVisible}
          onHide={() => setIsSidebarVisible(false)}
          activeEvent={activeEvent}
          setActiveEvent={setActiveEvent}
          position={position}
          setPosition={setPosition}
          onOpenSettings={onOpenSettings}
          onBack={onBack}
          t={t}
        />
        <main className="flex-1 flex flex-col items-center justify-center p-6 relative bg-slate-50">
          <div className="absolute top-6 left-6 flex items-center gap-3">
            {!isSidebarVisible && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsSidebarVisible(true)}
                className="hidden lg:flex text-slate-600 hover:bg-slate-200 rounded-xl"
              >
                <Menu className="h-6 w-6" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              onClick={() => setActiveEvent(null)} 
              className="text-slate-500 hover:bg-slate-200"
            >
              ← {t('back')}
            </Button>
          </div>
          <div className="w-full max-w-md space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-black text-slate-900">{t('welcome')}, {userData?.username || auth.currentUser?.email?.split('@')[0]}</h2>
              <p className="text-slate-500">{t('select_role_for', { event: activeEvent?.name })}</p>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <RoleCard 
                icon={Users} 
                title={t('staff')} 
                desc={t('staff_desc')} 
                color="bg-blue-600"
                onClick={() => setPosition('staff')}
              />
              <RoleCard 
                icon={Stethoscope} 
                title={t('medical_team')} 
                desc={t('medical_desc')} 
                color="bg-red-600"
                onClick={() => setPosition('medical')}
              />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex relative">
      <CrewSidebar 
        isVisible={isSidebarVisible}
        onHide={() => setIsSidebarVisible(false)}
        activeEvent={activeEvent}
        setActiveEvent={setActiveEvent}
        position={position}
        setPosition={setPosition}
        onOpenSettings={onOpenSettings}
        onBack={onBack}
        t={t}
      />
      {!isSidebarVisible && (
        <div className="lg:block hidden">
          {/* Handled in nav headers */}
        </div>
      )}
      <main className="flex-1 overflow-auto pb-24 relative">
        <nav className={`px-8 py-6 flex justify-between items-center sticky top-0 z-20 text-white bg-slate-900/95 backdrop-blur-md border-b border-white/5`}>
          <div className="flex items-center gap-3">
            {!isSidebarVisible && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsSidebarVisible(true)}
                className="flex mr-2 text-white hover:bg-white/10 rounded-xl"
              >
                <Menu className="h-6 w-6" />
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setPosition(null)} 
              className="text-white/50 hover:bg-white/10"
            >
              ← {t('back')}
            </Button>
            {position === 'staff' ? <Users className="h-6 w-6 text-blue-400" /> : <Stethoscope className="h-6 w-6 text-red-500" />}
            <h1 className="text-xl font-bold">{position === 'staff' ? t('staff') : t('medical_team')}</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-white/50 hover:bg-white/10" onClick={onOpenSettings}><Settings className="h-5 w-5" /></Button>
            <div className="relative">
              <Button variant="ghost" size="icon" className="text-white/50 hover:bg-white/10" onClick={() => setShowNotifications(!showNotifications)}>
                <Bell className="h-5 w-5" />
              </Button>
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden text-slate-900"
                  >
                    <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                      <h3 className="font-bold">{t('notifications')}</h3>
                      <button onClick={() => setShowNotifications(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                          <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                          <p className="text-sm font-medium">{t('no_notifications')}</p>
                        </div>
                      ) : (
                        notifications.map(notif => (
                          <div key={notif.id} className="p-4 border-b hover:bg-slate-50 transition-colors">
                            <p className="text-sm text-slate-800">{notif.text}</p>
                            <p className="text-[10px] text-slate-400 mt-1">{notif.time}</p>
                          </div>
                         ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <Button className="h-12 px-6 rounded-xl bg-red-600 hover:bg-red-700 text-white shadow-lg shadow-red-600/30 border-none" onClick={() => auth.signOut()}>
              <LogOut className="mr-2 h-4 w-4" /> {t('sign_out')}
            </Button>
          </div>
        </nav>

      <div className="p-4 space-y-6">
        {/* Alerts Section */}
        {(position === 'staff' || position === 'medical') && zones.some(z => {
          const density = z.peopleCount / getZoneCapacity(z);
          return density >= 0.98 && z.isSeated === false;
        }) && (
          <Card className="bg-red-600 text-white border-none shadow-lg shadow-red-500/20">
            <CardContent className="p-4 flex items-center gap-4">
              <AlertTriangle className="h-8 w-8 animate-bounce" />
              <div>
                <p className="font-bold">{t('critical_crowd_density')}</p>
                <p className="text-xs opacity-80">{t('management_intervention_required')}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Global Critical SOS Alert Overlay */}
        <AnimatePresence>
          {sosRequests.some(r => r.status === 'pending') && (
            <motion.div 
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              className="fixed top-20 left-4 right-4 z-50 bg-red-600 text-white p-4 rounded-2xl shadow-2xl flex items-center gap-4 border border-red-500 shadow-red-600/40"
            >
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                <AlertTriangle className="h-7 w-7 text-white animate-pulse" />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-80">{t('critical_emergency')}</p>
                <p className="font-bold text-sm tracking-tight leading-none mt-1">{t('new_help_requests')}</p>
              </div>
              <Button 
                size="sm" 
                variant="ghost" 
                className="text-white hover:bg-white/10 font-bold" 
                onClick={() => {
                  const element = document.getElementById('sos-feed');
                  element?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {t('view')}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 1. SOS FEED - NOW AT TOP */}
        <div className="space-y-4" id="sos-feed">
          <header className="flex justify-between items-end px-2">
            <h3 className="text-sm font-black uppercase text-slate-400 tracking-widest">{t('active_sos_feed')}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${sosRequests.length > 0 ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
              {sosRequests.length} {t('cases')}
            </span>
          </header>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sosRequests.length > 0 ? (
              sosRequests.sort((a,b) => {
                if (a.assignedCrewId === auth.currentUser?.uid) return -1;
                if (b.assignedCrewId === auth.currentUser?.uid) return 1;
                return 0;
              }).map(sos => (
                <SOSCard 
                  key={sos.id} 
                  sos={sos} 
                  activeEvent={activeEvent}
                  onMarkArrived={handleMarkArrived}
                  onAssign={handleAssignSOS}
                  onResolve={handleResolveSOS}
                  onOpenChat={(uid) => setSelectedChatUserId(uid)}
                  position={position}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-100">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-slate-100" />
                <p className="text-slate-300 font-black uppercase text-xs tracking-[0.2em]">All Systems Clear</p>
              </div>
            )}
          </div>
        </div>

        {/* 2. VENUE INTELLIGENCE - FULL WIDTH SECTION */}
        <div className="space-y-4 pt-4">
          <header className="flex justify-between items-end px-2">
            <div className="flex flex-col gap-1">
              <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">{t('venue_intelligence')}</h3>
              <p className="text-[10px] text-slate-400 font-medium">REAL-TIME TELEMETRY & FIELD FEED</p>
            </div>
            <span className="text-[9px] font-black text-green-600 flex items-center gap-1 uppercase">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" /> {t('synchronized')}
            </span>
          </header>

          <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-8 items-stretch">
            {/* Floor Map - Left (Bigger) */}
            <Card className="min-h-[600px] xl:h-[750px] bg-[#020617] relative overflow-hidden rounded-[48px] border-none shadow-2xl flex flex-col lg:flex-row">
                {/* Information Layer (Map) */}
                <div className="flex-1 relative overflow-hidden min-h-[400px] lg:min-h-0">
                  {/* Location Disabled Banner */}
                  {locationDenied && (
                    <div className="absolute top-0 left-0 right-0 z-30 bg-orange-500/90 backdrop-blur-md px-6 py-2 flex items-center justify-between">
                       <div className="flex items-center gap-2 text-left">
                          <MapPin className="h-4 w-4 text-white" />
                          <span className="text-[10px] font-bold text-white uppercase tracking-wider">{t('location_access_disallowed')}</span>
                       </div>
                       <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-white hover:bg-white/10 rounded-full" onClick={() => setLocationDenied(false)}>
                          <X className="h-3 w-3" />
                       </Button>
                    </div>
                  )}
                  <CrowdMap 
                    zones={zones}
                    gatesData={gates}
                    theme="dark"
                    userZoneId={selectedZone?.id || null} 
                    onZoneClick={(zone) => {
                      setSelectedZone(zone);
                      setSelectedGate(null);
                    }}
                    userGateId={selectedGate?.id || null}
                    onGateClick={(gate) => {
                      setSelectedGate(gate);
                      setSelectedZone(null);
                    }}
                  />
                  
                  {/* Interactive Toggle for Intelligence if needed (though it's auto-shown) */}
                  {!selectedZone && !selectedGate && (
                    <div className="absolute bottom-10 left-10 right-10 flex justify-center">
                       <div className="bg-white/5 backdrop-blur-md px-6 py-3 rounded-full border border-white/10 flex items-center gap-6">
                          <div className="flex items-center gap-2">
                             <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                             <span className="text-[10px] font-black text-white/40 uppercase tracking-widest">Live Flow Active</span>
                          </div>
                          <div className="w-px h-4 bg-white/10" />
                          <p className="text-[10px] font-bold text-white/60">{zones.reduce((acc, z) => acc + (z.peopleCount || 0), 0).toLocaleString()} Total Attendees</p>
                       </div>
                    </div>
                  )}
                </div>

                {/* Intelligence Panel - Slide-in Detail Panel */}
                <AnimatePresence mode="wait">
                   {(selectedZone || selectedGate) && (
                      <motion.div 
                         initial={{ opacity: 0, x: 100 }}
                         animate={{ opacity: 1, x: 0 }}
                         exit={{ opacity: 0, x: 100 }}
                         transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                         className="bg-[#0f172a] border-t lg:border-t-0 lg:border-l border-white/5 flex flex-col overflow-hidden relative w-full lg:w-[450px] h-[50vh] lg:h-full shrink-0"
                      >
                         <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-purple-500 to-pink-500" />
                         
                         <div className="p-8 lg:p-10 pb-4">
                             <div className="flex justify-between items-start mb-6">
                                <div className="space-y-1">
                                   <div className="flex items-center gap-2">
                                      {selectedGate ? <Navigation className="h-5 w-5 text-blue-500" /> : <Activity className="h-5 w-5 text-blue-500" />}
                                      <h2 className="text-lg font-black text-white tracking-widest uppercase italic">
                                         {selectedGate ? 'Access Intelligence' : 'Sector Intelligence'}
                                      </h2>
                                   </div>
                                   <p className="text-[11px] text-white/30 font-black uppercase tracking-[0.2em] mt-1">
                                      {selectedGate ? 'Entry/Exit Point Status' : `Sector: ${selectedZone?.name.toUpperCase()}`}
                                   </p>
                                </div>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  onClick={() => {
                                    setSelectedZone(null);
                                    setSelectedGate(null);
                                  }} 
                                  className="text-white/20 hover:text-white h-10 w-10 hover:bg-white/5 rounded-2xl transition-all"
                                >
                                   <X className="h-6 w-6" />
                                </Button>
                             </div>
                          </div>

                          <div className="flex-1 px-8 pb-8 space-y-8 overflow-y-auto custom-scrollbar">
                            {(() => {
                               if (selectedGate) {
                                 const gd = gates.find(g => g.id === selectedGate.id) || selectedGate;
                                 const capacityUsage = Math.min(Math.round((gd.currentLoad / 300) * 100), 100);
                                 const isCritical = capacityUsage > 80;
                                 const isVigilant = capacityUsage > 50;

                                 return (
                                    <div className="space-y-8">
                                       <div className="grid grid-cols-2 gap-4">
                                          <div className="bg-white/[0.03] rounded-[2rem] p-6 border border-white/[0.05]">
                                             <div className="flex items-center justify-between mb-4">
                                                <Navigation className="h-4 w-4 text-blue-500/50" />
                                                <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Rate</span>
                                             </div>
                                             <div className="flex items-baseline gap-1">
                                                 <p className="text-4xl font-black text-white">{gd.flowRate || 0}</p>
                                                 <span className="text-white/20 text-[10px] font-bold uppercase">ppm</span>
                                             </div>
                                          </div>
                                          <div className="bg-white/[0.03] rounded-[2rem] p-6 border border-white/[0.05]">
                                             <div className="flex items-center justify-between mb-4">
                                                <Users className="h-4 w-4 text-purple-500/50" />
                                                <span className="text-[8px] font-black text-purple-500 uppercase tracking-widest">Load</span>
                                             </div>
                                             <div className="flex items-baseline gap-1">
                                                 <p className="text-4xl font-black text-white">{gd.currentLoad || 0}</p>
                                                 <span className="text-white/20 text-[10px] font-bold uppercase">pax</span>
                                             </div>
                                          </div>
                                       </div>

                                       <div className="space-y-6 bg-white/[0.03] rounded-[2.5rem] p-8 border border-white/[0.05]">
                                          <div className="flex justify-between items-end">
                                             <div className="space-y-1">
                                                <h4 className="text-[11px] font-black text-white italic tracking-widest uppercase">Pressure Metric</h4>
                                                <p className="text-[10px] text-white/30 font-medium">REAL-TIME FLOW CONGESTION</p>
                                             </div>
                                             <div className={`text-4xl font-black tabular-nums ${
                                                isCritical ? 'text-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 
                                                isVigilant ? 'text-orange-400' : 'text-blue-500'
                                             }`}>{capacityUsage}%</div>
                                          </div>
                                          <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                             <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${capacityUsage}%` }}
                                                className={`h-full rounded-full ${
                                                   isCritical ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 
                                                   isVigilant ? 'bg-orange-400' : 'bg-blue-500'
                                                }`}
                                             />
                                          </div>
                                       </div>

                                       <div className="pt-4 border-t border-white/5 space-y-4">
                                          <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Gate Control</p>
                                          <div className="grid grid-cols-2 gap-2">
                                             {['OPEN', 'CLOSED', 'CROWDED', 'RESTRICTED'].map(status => (
                                                <Button 
                                                  key={status}
                                                  variant="ghost" 
                                                  size="sm"
                                                  className={`h-12 rounded-xl text-[10px] font-black uppercase tracking-tight border transition-all ${
                                                    gd.status === status 
                                                      ? 'bg-blue-600 text-white border-blue-500' 
                                                      : 'bg-white/5 text-white/40 border-white/5'
                                                  }`}
                                                  onClick={async () => {
                                                    try {
                                                      await updateDoc(doc(db, 'events', activeEvent.id, 'gates', gd.id), { status });
                                                      toast.success(`Gate ${gd.label} status set to ${status}`);
                                                    } catch (e: any) {
                                                      handleFirestoreError(e, OperationType.UPDATE, `events/${activeEvent.id}/gates/${gd.id}`);
                                                    }
                                                  }}
                                                >
                                                  {status}
                                                </Button>
                                             ))}
                                          </div>
                                       </div>
                                    </div>
                                 );
                               }

                               if (selectedZone) {
                                 const zd = zones.find(z => z.id === selectedZone.id) || selectedZone;
                                 const density = Math.min(Math.round((zd.peopleCount / getZoneCapacity(zd)) * 100), 100);
                                 
                                 return (
                                    <div className="space-y-10">
                                       <div className="grid grid-cols-2 gap-4">
                                          <div className="bg-white/[0.03] rounded-[2rem] p-6 border border-white/[0.05]">
                                             <p className="text-[9px] text-white/20 font-black uppercase tracking-widest mb-3">Live Pop.</p>
                                              <p className="text-4xl font-black text-white leading-none tracking-tighter">{zd.peopleCount.toLocaleString()}</p>
                                          </div>
                                          <div className="bg-white/[0.03] rounded-[2rem] p-6 border border-white/[0.05]">
                                             <p className="text-[9px] text-white/20 font-black uppercase tracking-widest mb-3">Max Cap.</p>
                                             <p className="text-4xl font-black text-white/20 leading-none tracking-tighter">{getZoneCapacity(zd).toLocaleString()}</p>
                                          </div>
                                       </div>

                                       <div className="space-y-6 bg-white/[0.03] rounded-[2.5rem] p-8 border border-white/[0.05]">
                                          <div className="flex justify-between items-end mb-2">
                                             <div className="space-y-1">
                                                <h4 className="text-[11px] font-black text-white italic tracking-widest uppercase">Density Index</h4>
                                                <p className="text-[10px] text-white/30 font-medium">AREA OCCUPANCY LOAD</p>
                                             </div>
                                             <div className="text-4xl font-black text-blue-500 tabular-nums">{density}%</div>
                                          </div>
                                          <div className="relative h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                             <motion.div 
                                                initial={{ width: 0 }}
                                                animate={{ width: `${density}%` }}
                                                className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)] rounded-full"
                                             />
                                          </div>
                                       </div>

                                       {position === 'staff' && (
                                         <div className="pt-6 border-t border-white/5 space-y-4">
                                            <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest">Crew Sector Report</p>
                                            <div className="grid grid-cols-3 gap-2">
                                               {['NORMAL', 'BUSY', 'CRITICAL'].map(status => (
                                                  <Button 
                                                    key={status}
                                                    variant="ghost" 
                                                    size="sm"
                                                    className={`h-12 rounded-xl text-[10px] font-black uppercase tracking-tight border transition-all ${
                                                      (zd as any).status === status 
                                                        ? 'bg-blue-600 text-white border-blue-500' 
                                                        : 'bg-white/5 text-white/40 border-white/5'
                                                    }`}
                                                    onClick={async () => {
                                                      try {
                                                        await updateDoc(doc(db, 'events', activeEvent.id, 'zones', zd.id), { status });
                                                        toast.success(`Sector ${zd.name} marked as ${status}`);
                                                      } catch (e: any) {
                                                        handleFirestoreError(e, OperationType.UPDATE, `events/${activeEvent.id}/zones/${zd.id}`);
                                                      }
                                                    }}
                                                  >
                                                    {status}
                                                  </Button>
                                               ))}
                                            </div>
                                         </div>
                                       )}
                                    </div>
                                 );
                               }
                               return null;
                            })()}
                         </div>
                      </motion.div>
                   )}
                </AnimatePresence>
            </Card>

            {/* Broadcast Feed - Right (Smaller) */}
            <div className="flex flex-col gap-4 h-full">
              <header className="flex justify-between items-center px-1">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest">Live Broadcast</h3>
                <span className="text-[9px] font-bold text-blue-500 flex items-center gap-1 uppercase">
                  <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" /> {intelligenceReports.length} {t('broadcasts')}
                </span>
              </header>
              <Card className="flex-1 bg-white border-none shadow-sm rounded-[48px] overflow-hidden flex flex-col min-h-[500px]">
                <div className="p-8 flex-1 flex flex-col space-y-6">
                  {/* Reporting Input */}
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Report field intel..." 
                      className="rounded-2xl border-slate-100 bg-slate-50 text-xs h-14"
                      value={newReport}
                      onChange={(e) => setNewReport(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSubmitReport()}
                    />
                    <Button 
                      className="rounded-2xl bg-blue-600 hover:bg-blue-700 h-14 w-14 p-0 flex items-center justify-center shrink-0 shadow-lg shadow-blue-600/20"
                      onClick={handleSubmitReport}
                      disabled={submittingReport}
                    >
                      {submittingReport ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="h-5 w-5" />}
                    </Button>
                  </div>

                  {/* Intelligence List */}
                  <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hide">
                    {intelligenceReports.length > 0 ? (
                      intelligenceReports.map((report) => (
                        <div key={report.id} className="p-5 rounded-[2rem] bg-slate-50 border border-slate-100 relative group">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] font-black uppercase text-blue-600 tracking-tighter">{report.source} • {report.position}</span>
                            <span className="text-[9px] font-bold text-slate-400">{new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <p className="text-sm text-slate-700 font-medium leading-relaxed">{report.message}</p>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-300 py-12">
                        <Activity className="h-10 w-10 mb-2 opacity-20" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em]">{t('no_intelligence_reports')}</p>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>

        {activeEvent && sosRequests.length > 0 && (
        <FloatingChat 
          eventId={activeEvent.id} 
          userRole="crew" 
          selectedUserId={selectedChatUserId} 
        />
      )}
      </div>
      </main>
    </div>
  );
}

function RoleCard({ icon: Icon, title, desc, color, onClick }: any) {
  return (
    <Card className="overflow-hidden border-none shadow-lg hover:shadow-xl transition-all cursor-pointer group" onClick={onClick}>
      <CardContent className="p-8 flex items-center gap-6">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg transition-transform group-hover:scale-110 ${color}`}>
          <Icon className="h-8 w-8" />
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500 mt-1">{desc}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EventBanner({ event, type, onAction }: any) {
  const { t } = useTranslation();
  return (
    <Card className="overflow-hidden border-none shadow shadow-slate-200/50 hover:shadow-md transition-all group rounded-3xl bg-white border border-slate-100">
      <div className="flex flex-col sm:flex-row">
        <div className="sm:w-32 h-24 sm:h-auto bg-slate-200 relative shrink-0">
          <img 
            src={event.image || `https://picsum.photos/seed/${event.id}/400/300`} 
            alt={event.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            referrerPolicy="no-referrer"
          />
          <div className="absolute top-2 right-2">
            <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest ${type === 'ongoing' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'}`}>
              {t(type)}
            </span>
          </div>
        </div>
        <CardContent className="p-5 flex-1 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-center sm:text-left">
            <h3 className="font-bold text-slate-900 line-clamp-1">{event.name}</h3>
            <div className="flex items-center justify-center sm:justify-start gap-4 mt-1 text-[10px] font-medium text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {event.date} {event.startTime && `• ${event.startTime}`}</span>
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {event.venue || 'Unifi Arena'}</span>
            </div>
          </div>
          <Button 
            onClick={onAction}
            size="sm"
            disabled={type === 'upcoming'}
            className={`rounded-xl px-6 font-bold ${type === 'ongoing' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-slate-100 text-slate-400 hover:bg-slate-100 cursor-not-allowed'}`}
          >
            {type === 'ongoing' ? t('join_duty') : t('standby')}
          </Button>
        </CardContent>
      </div>
    </Card>
  );
}
