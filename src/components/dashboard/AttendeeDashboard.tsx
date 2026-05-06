import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  setDoc, 
  getDocs,
  serverTimestamp,
  addDoc,
  orderBy
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calendar, 
  MapPin, 
  AlertTriangle, 
  Navigation, 
  Shield, 
  LogOut, 
  Bell,
  Settings,
  X,
  Lock,
  Info,
  Menu,
  XCircle,
  Activity,
  ChevronRight,
  Users,
  Search,
  History,
  Camera,
  SlidersHorizontal,
  LayoutDashboard,
} from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { CrowdMap } from '@/components/common/CrowdMap';
import { getZoneCapacity } from '@/lib/zoneUtils';
import { FloatingChat } from '@/components/chat/FloatingChat';

// --- Components ---

const SOSButton = ({ onConfirm, zones }: { onConfirm: (details: { category: string, zoneId: string, row: string, seat: string }) => void, zones: any[] }) => {
  const { t } = useTranslation();
  const [isSliding, setIsSliding] = useState(false);
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [showOptions, setShowOptions] = useState(false);
  const [step, setStep] = useState<'category' | 'location'>('category');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [locationDetails, setLocationDetails] = useState({
    zoneId: '',
    row: '',
    seat: ''
  });
  const sliderRef = useRef<HTMLDivElement>(null);

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsSliding(true);
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    setStartX(x);
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isSliding || !sliderRef.current) return;
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const sliderWidth = sliderRef.current.clientWidth;
    const handleWidth = 56; // w-14
    const maxDelta = sliderWidth - handleWidth - 8; // padding
    const delta = Math.max(0, Math.min(x - startX, maxDelta));
    setCurrentX(delta);
    
    if (delta >= maxDelta * 0.9) {
      setIsSliding(false);
      setCurrentX(0);
      setShowOptions(true);
      setStep('category');
      if (navigator.vibrate) navigator.vibrate(200);
    }
  };

  const handleEnd = () => {
    setIsSliding(false);
    if (!sliderRef.current) return;
    const sliderWidth = sliderRef.current.clientWidth;
    if (currentX < (sliderWidth - 64) * 0.9) {
       setCurrentX(0);
    }
  };

  const handleCategorySelect = (cat: string) => {
    setSelectedCategory(cat);
    setStep('location');
  };

  const handleDispatch = () => {
    const isStanding = zones.find(z => z.id === locationDetails.zoneId)?.name.toLowerCase().includes('standing') || 
                       zones.find(z => z.id === locationDetails.zoneId)?.name.toLowerCase().includes('field');

    if (!locationDetails.zoneId) {
      toast.error(t('select_zone_error'));
      return;
    }
    
    if (!isStanding && (!locationDetails.row || !locationDetails.seat)) {
      toast.error(t('specify_row_seat_error'));
      return;
    }

    onConfirm({
      category: selectedCategory,
      ...locationDetails
    });
    // Reset
    setShowOptions(false);
    setStep('category');
    setLocationDetails({ zoneId: '', row: '', seat: '' });
  };

  const selectedZone = zones.find(z => z.id === locationDetails.zoneId);
  const isStandingZone = selectedZone?.name.toLowerCase().includes('standing') || 
                         selectedZone?.name.toLowerCase().includes('field');

  const getStandardizedName = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('field') || lower.includes('standing')) return "Standing Zone";
    const catMatch = name.match(/CAT\s*(\d+)/i);
    return catMatch ? `CAT ${catMatch[1]}` : name;
  };

  return (
    <div className="relative">
      {!showOptions ? (
        <div 
          ref={sliderRef}
          className="h-16 bg-slate-950/50 rounded-[1.25rem] relative overflow-hidden flex items-center px-1.5 border border-white/5 shadow-inner group"
          onMouseMove={handleMove}
          onMouseUp={handleEnd}
          onMouseLeave={handleEnd}
          onTouchMove={handleMove}
          onTouchEnd={handleEnd}
        >
          {/* Subtle instructions in background */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
             <div className="flex items-center gap-3 opacity-20 group-hover:opacity-40 transition-opacity">
                <ChevronRight className="h-3 w-3 animate-[pulse_1s_infinite]" />
                <span className="text-[10px] font-black uppercase tracking-[0.3em]">{t('slide_trigger_sos')}</span>
                <ChevronRight className="h-3 w-3 animate-[pulse_1s_infinite_200ms]" />
             </div>
          </div>

          <motion.div
            className="w-14 h-13 bg-red-600 rounded-[1rem] flex items-center justify-center cursor-grab active:cursor-grabbing z-10 shadow-[0_0_20px_rgba(220,38,38,0.4)] border border-red-500/50"
            style={{ x: currentX }}
            onMouseDown={handleStart}
            onTouchStart={handleStart}
            onClick={() => {
              if (currentX < 20) {
                 toast.error(t('security_lock'), {
                    description: t('accidental_trigger_prevention')
                 });
              }
            }}
          >
            <Shield className="text-white h-6 w-6" />
          </motion.div>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          {step === 'category' ? (
            <div className="grid grid-cols-2 gap-3">
              {['Security', 'Medical', 'Lost', 'Crowd'].map((cat) => (
                <Button 
                  key={cat} 
                  variant="destructive" 
                  className="h-16 flex flex-col gap-1 text-[10px] font-black uppercase rounded-2xl shadow-lg shadow-red-900/20 border border-red-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                  onClick={() => handleCategorySelect(cat.toLowerCase())}
                >
                  <AlertTriangle className="h-4 w-4 opacity-50" />
                  {t(cat.toLowerCase())}
                </Button>
              ))}
            </div>
          ) : (
            <div className="space-y-4 bg-slate-900/50 p-4 rounded-3xl border border-white/5">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-white/40">{t('location_details')}</h3>
                <span className="text-[8px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full uppercase">{selectedCategory}</span>
              </div>
              
              <div className="space-y-3">
                <select 
                  className="w-full h-12 bg-slate-950 border border-white/10 rounded-xl px-4 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-red-600 appearance-none transition-all"
                  value={locationDetails.zoneId}
                  onChange={(e) => setLocationDetails(prev => ({ ...prev, zoneId: e.target.value }))}
                >
                  <option value="">{t('select_zone')}</option>
                  {zones.reduce((acc: any[], curr) => {
                    const stdName = getStandardizedName(curr.name);
                    if (!acc.find(z => getStandardizedName(z.name) === stdName)) {
                      acc.push(curr);
                    }
                    return acc;
                  }, []).map(z => (
                    <option key={z.id} value={z.id}>{getStandardizedName(z.name)}</option>
                  ))}
                </select>

                <AnimatePresence mode="wait">
                  {!isStandingZone && locationDetails.zoneId && (
                    <motion.div 
                      key="seating-details"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="grid grid-cols-2 gap-3 overflow-hidden"
                    >
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black uppercase tracking-widest text-white/20 pl-2">{t('row')}</label>
                        <select 
                          className="w-full h-12 bg-slate-950 border border-white/10 rounded-xl px-4 text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-red-600 appearance-none"
                          value={locationDetails.row}
                          onChange={(e) => setLocationDetails(prev => ({ ...prev, row: e.target.value }))}
                        >
                          <option value="">{t('row')}...</option>
                          {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(row => (
                            <option key={row} value={row}>{row}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black uppercase tracking-widest text-white/20 pl-2">{t('seat_number')}</label>
                        <Input 
                          placeholder="e.g. 45"
                          className="h-12 bg-slate-950 border-white/10 rounded-xl text-center font-bold"
                          value={locationDetails.seat}
                          onChange={(e) => setLocationDetails(prev => ({ ...prev, seat: e.target.value }))}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {isStandingZone && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-3 bg-red-500/5 rounded-xl border border-red-500/10 text-center"
                  >
                    <p className="text-[10px] text-white/40 font-bold uppercase tracking-tighter">
                      {t('standing_no_details')}
                    </p>
                  </motion.div>
                )}
              </div>

              <Button 
                variant="destructive" 
                className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-red-600/20"
                onClick={handleDispatch}
              >
                {t('send_sos')}
              </Button>
            </div>
          )}

          <Button 
            variant="ghost" 
            className="text-[10px] font-black uppercase tracking-widest h-10 rounded-xl bg-white/5 hover:bg-white/10 w-full" 
            onClick={() => {
              if (step === 'location') {
                setStep('category');
              } else {
                setShowOptions(false);
              }
            }}
          >
             {step === 'location' ? t('back') : t('cancel')}
          </Button>
        </motion.div>
      )}
    </div>
  );
};


// --- Main Dashboard ---

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
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
          layoutId="sidebar-active"
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
  onOpenSettings?: () => void;
  onBack?: () => void;
  t: (key: string) => string;
}

function AttendeeSidebar({ isVisible, onHide, activeEvent, setActiveEvent, onOpenSettings, onBack, t }: SidebarProps) {
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
            <SidebarLink icon={LayoutDashboard} label={t('overview')} active={!activeEvent} onClick={() => setActiveEvent(null)} />
            <SidebarLink icon={Calendar} label={t('events')} active={!!activeEvent} onClick={() => setActiveEvent(null)} />
            <SidebarLink icon={Settings} label={t('settings')} onClick={() => { setActiveEvent(null); onOpenSettings?.(); }} />
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
            <Button variant="ghost" className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800" onClick={() => auth.signOut()}>
              <LogOut className="mr-2 h-4 w-4" /> {t('sign_out')}
            </Button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

export function AttendeeDashboard({ onBack, userData, onOpenSettings }: { onBack?: () => void, userData?: any, onOpenSettings?: () => void }) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<any[]>([]);
  const [activeEvent, setActiveEvent] = useState<any>(null);
  const [zones, setZones] = useState<any[]>([]);
  const [gates, setGates] = useState<any[]>([]);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [currentZone, setCurrentZone] = useState<any>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [clickedZoneId, setClickedZoneId] = useState<string | null>(null);
  const [selectedGateId, setSelectedGateId] = useState<string | null>(null);
  const [sosRequest, setSosRequest] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    const saved = localStorage.getItem('crowdguard_search_history');
    return saved ? JSON.parse(saved) : [];
  });
  const [filters, setFilters] = useState({
    date: '',
    state: '',
    venue: '',
    type: 'all', // all, free, ticketed
    sortBy: 'latest' // latest, popular
  });
  const [showFilters, setShowFilters] = useState(false);

  const filterStates = Array.from(new Set(events.map(e => e.state).filter(Boolean)));
  const filterVenues = Array.from(new Set(events.map(e => e.venue).filter(Boolean)));

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<{id: string, text: string, time: string}[]>([]);

  const [isSidebarVisible, setIsSidebarVisible] = useState(true);

  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const addToHistory = (query: string) => {
    if (!query.trim()) return;
    const newHistory = [query, ...searchHistory.filter(h => h !== query)].slice(0, 10);
    setSearchHistory(newHistory);
    localStorage.setItem('crowdguard_search_history', JSON.stringify(newHistory));
  };

  // SOS status listener
  useEffect(() => {
    if (!activeEvent || !sosRequest?.id) return;
    const unsubStatus = onSnapshot(doc(db, 'events', activeEvent.id, 'sos', sosRequest.id), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setSosRequest({ id: doc.id, ...data });
      }
    });

    return () => {
      unsubStatus();
    };
  }, [activeEvent, sosRequest?.id]);

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
  const [notifiedEventIds, setNotifiedEventIds] = useState<string[]>([]);
  const [showSafeRoute, setShowSafeRoute] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [simulatedTime, setSimulatedTime] = useState(new Date());
  const [timeframe, setTimeframe] = useState<'before' | 'during' | 'after'>('during');

  // 0. Update Clock
  useEffect(() => {
    const timer = setInterval(() => {
      setSimulatedTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 1. Fetch Events
  useEffect(() => {
    const q = query(collection(db, 'events'), where('status', '==', 'successful'));
    return onSnapshot(q, (snapshot) => {
      const allEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvents(allEvents);
    });
  }, []);

  // 2. Global Location Tracking
  useEffect(() => {
    const trackLocation = () => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserLocation(loc);
          
          if (auth.currentUser && activeEvent) {
            setDoc(doc(db, 'locations', auth.currentUser.uid), {
              uid: auth.currentUser.uid,
              eventId: activeEvent.id,
              lat: loc.lat,
              lng: loc.lng,
              timestamp: serverTimestamp(),
              isAnonymous: true
            }, { merge: true });
          }

          if (activeEvent && zones.length > 0) {
            // Remove auto-selection based on user instructions
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
          const loc = { lat: 3.053, lng: 101.696 }; // Unifi Arena Fallback
          setUserLocation(loc);
        }
      );
    };

    trackLocation();
    const interval = setInterval(trackLocation, 10000);
    return () => clearInterval(interval);
  }, [activeEvent, zones.length]);

  // 3. Fetch Zones and Gates for Active Event
  useEffect(() => {
    if (!activeEvent) return;
    
    // Use polling every 5 seconds to sync specifically with manager page cadence
    const fetchLiveStats = async () => {
      try {
        const zonesSnap = await getDocs(collection(db, 'events', activeEvent.id, 'zones'));
        setZones(zonesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        
        const gatesSnap = await getDocs(collection(db, 'events', activeEvent.id, 'gates'));
        setGates(gatesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (error) {
        console.error("Failed to fetch live stats", error);
      }
    };
    
    fetchLiveStats();
    const intervalId = setInterval(fetchLiveStats, 5000);
    return () => clearInterval(intervalId);
  }, [activeEvent]);

  // 4. SOS Subscription
  useEffect(() => {
    if (!activeEvent || !auth.currentUser) return;
    const q = query(
      collection(db, 'events', activeEvent.id, 'sos'), 
      where('userId', '==', auth.currentUser.uid),
      where('status', '!=', 'resolved')
    );
    return onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const data = snapshot.docs[0].data();
        setSosRequest({ id: snapshot.docs[0].id, ...data });
      } else {
        setSosRequest(null);
      }
    });
  }, [activeEvent]);

  // Coordinate Mapping for GPS to SVG
  const gpsToSvg = (lat: number, lng: number) => {
    // Venue boundaries (simulated)
    const latMin = 3.050, latMax = 3.056;
    const lngMin = 101.693, lngMax = 101.699;
    
    // Scale to SVG 300x200
    const x = ((lng - lngMin) / (lngMax - lngMin)) * 300;
    const y = 200 - (((lat - latMin) / (latMax - latMin)) * 200); // SVG Y is top-down
    
    return { 
      x: Math.max(10, Math.min(290, x)), 
      y: Math.max(10, Math.min(190, y)) 
    };
  };

  

  const handleSOSConfirm = async (details: { category: string, zoneId: string, row: string, seat: string }) => {
    if (!activeEvent || !auth.currentUser) return;
    
    const loc = userLocation || { lat: 3.053, lng: 101.696 };
    const zone = zones.find(z => z.id === details.zoneId);
    
    const path = `events/${activeEvent.id}/sos`;
    try {
      await addDoc(collection(db, 'events', activeEvent.id, 'sos'), {
        userId: auth.currentUser.uid,
        attendeeName: userData?.username || auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || 'Attendee',
        eventId: activeEvent.id,
        category: details.category,
        lat: loc.lat,
        lng: loc.lng,
        zoneId: details.zoneId,
        zoneName: zone?.name || 'Unknown Zone',
        rowNumber: details.row,
        seatNumber: details.seat,
        timestamp: serverTimestamp(),
        status: 'pending',
        severity: details.category === 'medical' ? 'emergency' : 'minor'
      });
      toast.success(t('sos_sent_success'));
    } catch (e: any) {
      handleFirestoreError(e, OperationType.WRITE, path);
    }
  };

  const handleNotifyMe = (eventId: string) => {
    setNotifiedEventIds(prev => [...prev, eventId]);
    toast.success("You will be notified when this event starts!");
  };

  const handleJoinEvent = (event: any) => {
    setActiveEvent(event);
    setSelectedZoneId(null);
    setClickedZoneId(null);
    setCurrentZone(null);
  };

  const handleZoneClick = (zone: any) => {
    setClickedZoneId(zone.id);
    
    // Show safety alert only when clicking a critical zone
    const density = zone.peopleCount / getZoneCapacity(zone);
    if (density >= 0.98) {
      toast.error(zone.isSeated 
        ? "Stay in your seat and wait for staff guidance." 
        : "Please exit via the least crowded routes", {
        duration: 4000,
        icon: <AlertTriangle className="h-5 w-5" />
      });
    }
  };

  if (activeEvent) {
    const clickedZone = zones.find(z => z.id === clickedZoneId);
    const clickedGate = gates.find(g => g.id === selectedGateId);

    const handleSafeRoute = () => {
      setShowSafeRoute(true);
      if (navigator.vibrate) navigator.vibrate(50);
      toast.info(t('navigation_initiated'), {
        description: t('follow_highlighted'),
        icon: <Navigation className="h-4 w-4" />
      });
    };

    const handleResolveSOS = async () => {
      if (!sosRequest || !activeEvent) return;
      const sosRef = doc(db, 'events', activeEvent.id, 'sos', sosRequest.id);
      await setDoc(sosRef, { status: 'resolved' }, { merge: true });
      toast.success(t('glad_safe'));
    };

    const getSimulatedRoute = () => {
      // Use actual user location if available, otherwise fallback to zone center
      let startPoint = { x: 150, y: 100 };
      
      if (userLocation) {
        startPoint = gpsToSvg(userLocation.lat, userLocation.lng);
      } else if (selectedZoneId) {
        const zid = selectedZoneId.toLowerCase();
        if (zid.includes('standing')) { startPoint = { x: 150, y: 80 }; }
        else if (zid.includes('cat1')) { startPoint = { x: 222, y: 80 }; }
        else if (zid.includes('cat2')) { startPoint = { x: 150, y: 132 }; }
        else if (zid.includes('cat3')) { startPoint = { x: 55, y: 95 }; }
        else if (zid.includes('cat4')) { startPoint = { x: 245, y: 150 }; }
        else if (zid.includes('cat5')) { startPoint = { x: 150, y: 167 }; }
        else if (zid.includes('cat6')) { startPoint = { x: 40, y: 30 }; }
      }

      return {
        points: [
          startPoint,
          { x: (startPoint.x + 270) / 2, y: (startPoint.y + 100) / 2 + 20 },
          { x: 270, y: 100 }
        ],
        label: "EXIT B"
      };
    };

    return (
    <div className="min-h-screen bg-slate-950 flex relative">
        <AttendeeSidebar 
          isVisible={isSidebarVisible} 
          onHide={() => setIsSidebarVisible(false)}
          activeEvent={activeEvent}
          setActiveEvent={setActiveEvent}
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
        <div className="flex-1 flex flex-col text-white overflow-hidden h-[100dvh] w-full max-w-full">
          <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-6 sm:space-y-8 pb-32 no-scrollbar">

           {/* SECTION: LIVE MAP AND INTELLIGENCE (GRID LAYOUT) */}
           <div className="space-y-6">
              <div className="flex items-center justify-between px-2">
                 <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => setActiveEvent(null)} className="h-6 px-2 text-white/40 hover:text-white hover:bg-white/10 rounded-md">
                      <LogOut className="h-3 w-3 mr-1" /> Back
                    </Button>
                    <Activity className="h-3.5 w-3.5 text-blue-500 ml-2" />
                    <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40">Venue Intelligence</h2>
                 </div>
                 <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-500/10 rounded-full border border-blue-500/20">
                    <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                    <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest">Live Link</span>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6 items-stretch">
                 {/* Left Column: Map Card */}
                 <div className="flex flex-col h-full min-h-[400px]">
                  <Card className="flex-1 bg-slate-900 border-white/5 rounded-[2.5rem] overflow-hidden relative shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)] group flex flex-col">
                     {/* Location Disabled Banner */}
                     {locationDenied && (
                        <div className="absolute top-0 left-0 right-0 z-30 bg-orange-500/90 backdrop-blur-md px-6 py-2 flex items-center justify-between">
                           <div className="flex items-center gap-2">
                              <Info className="h-4 w-4 text-white" />
                              <span className="text-[10px] font-bold text-white uppercase tracking-wider">{t('location_access_disallowed')}</span>
                           </div>
                           <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-white hover:bg-white/10 rounded-full" onClick={() => setLocationDenied(false)}>
                              <X className="h-3 w-3" />
                           </Button>
                        </div>
                     )}
                     
                     {/* Navigation HUD Overlay */}
                     <AnimatePresence>
                        {showSafeRoute && (
                           <motion.div 
                              initial={{ y: -60, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              exit={{ y: -60, opacity: 0 }}
                              className="absolute top-4 left-4 right-4 z-20 bg-blue-600/90 backdrop-blur-xl rounded-2xl p-4 flex items-center gap-4 shadow-2xl border border-white/20"
                           >
                              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shrink-0">
                                 <Navigation className="h-6 w-6 text-blue-600 -rotate-45" />
                              </div>
                              <div className="flex-1">
                                 <p className="text-[8px] text-white/60 font-black uppercase tracking-widest leading-none mb-1">Navigation Active</p>
                                 <p className="text-sm font-black text-white uppercase tracking-tighter leading-none">Head North toward Gate B</p>
                              </div>
                              <div className="text-right">
                                 <p className="text-sm font-black text-white">120m</p>
                                 <p className="text-[8px] text-white/60 uppercase">2 min</p>
                              </div>
                           </motion.div>
                        )}
                     </AnimatePresence>

                     <div className="flex-1 w-full relative flex flex-col items-center justify-center p-6 sm:p-10 transition-transform duration-500 group-hover:scale-[1.02] min-h-[350px]">
                    {/* Background Grid Pattern */}
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_30%,transparent_100%)] pointer-events-none" />
                    
                    <CrowdMap 
                      zones={zones} 
                      gatesData={gates}
                      userZoneId={selectedZoneId} 
                      onZoneClick={(zone) => {
                        setClickedZoneId(zone.id);
                        setSelectedGateId(null);
                        
                      }} 
                      onGateClick={(gateId) => {
                         const gate = gates.find(g => g.id === gateId);
                         if (gate) {
                           setSelectedGateId(gate.id);
                           
                           setClickedZoneId(null);
                         }
                      }}
                      safeRoute={showSafeRoute ? [
                         { x: 350, y: 560 },
                         { x: 450, y: 560 },
                         { x: 450, y: 250 },
                         { x: 300, y: 250 }
                      ] : undefined}
                    />

                    {/* Navigation Demo Trigger (Invisible overlay) */}
                    {locationDenied && (
                       <div 
                         className="absolute inset-x-0 bottom-0 h-32 z-20 cursor-pointer" 
                         onClick={() => setShowSafeRoute(true)}
                       />
                    )}
                 </div>

                 {/* Quick Context Bar */}
                 <div className="absolute bottom-4 left-4 right-4 bg-slate-950/80 backdrop-blur-xl rounded-2xl p-3 sm:p-4 border border-white/5 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                          <Activity className="h-4 w-4 text-blue-500" />
                       </div>
                       <div className="flex flex-col gap-1">
                          <span className="text-[7px] text-white/20 font-black uppercase tracking-[0.15em]">System Status</span>
                          <div className="flex items-center gap-1.5">
                             <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                             <span className="text-[10px] font-bold text-green-500 uppercase tracking-tighter">Secure Feed</span>
                          </div>
                       </div>
                    </div>
                    <div className="flex items-center gap-2">
                       {showSafeRoute && (
                         <Button 
                           variant="destructive" 
                           size="sm" 
                           className="h-8 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20 text-[9px] font-bold uppercase tracking-wider hover:bg-red-500/20" 
                           onClick={() => setShowSafeRoute(false)}
                         >
                            Clear Path
                         </Button>
                       )}
                       {(clickedZoneId || selectedGateId) && (
                         <Button 
                           variant="ghost" 
                           size="sm" 
                           className="h-8 rounded-xl bg-white/5 text-[9px] font-bold uppercase tracking-wider hover:bg-white/10" 
                           onClick={() => { setClickedZoneId(null); setSelectedGateId(null); }}
                         >
                            Reset View
                         </Button>
                       )}
                    </div>
                 </div>
              </Card>
                 </div>
                 
                 {/* Right Column: Intelligence Stats block */}
                 <div className="flex flex-col h-full min-h-[400px]">
                    <AnimatePresence mode="wait">
                       {(clickedZoneId || selectedGateId) ? (
                          <motion.div
                             key="intel-selected"
                             initial={{ opacity: 0, x: 20 }}
                             animate={{ opacity: 1, x: 0 }}
                             exit={{ opacity: 0, x: 20 }}
                             className="h-full"
                          >
                             <Card className="bg-slate-900/90 border-white/5 rounded-3xl sm:rounded-[2.5rem] overflow-hidden backdrop-blur-xl h-full flex flex-col shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)]">
                                <div className="p-6 sm:p-8 flex flex-col flex-1 gap-6 sm:gap-8 overflow-y-auto no-scrollbar">
                                   <div className="flex justify-between items-start">
                                      <div className="space-y-2">
                                         <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10">
                                            <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                                            <span className="text-[8px] text-white/50 font-black uppercase tracking-widest">{selectedGateId ? t('access_point_delta') : t('area_flow_analysis')}</span>
                                         </div>
                                         <h3 className="text-3xl font-black text-white uppercase tracking-tighter leading-none">
                                            {selectedGateId ? clickedGate?.label : clickedZone?.name.replace(/cat\s\d\s+/gi, '').trim()}
                                         </h3>
                                      </div>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => { setClickedZoneId(null); setSelectedGateId(null); }} 
                                        className="text-white/20 hover:text-white h-10 w-10 bg-white/5 rounded-2xl shrink-0"
                                      >
                                         <XCircle className="h-6 w-6" />
                                      </Button>
                                   </div>

                                   {selectedGateId ? (
                                     <div className="flex flex-col gap-6 flex-1">
                                        <div className="bg-white/5 p-6 rounded-3xl border border-white/5 flex-1 flex flex-col justify-center">
                                           <p className="text-[8px] text-white/30 font-black uppercase tracking-widest mb-2 text-left">{t('realtime_load')}</p>
                                           <p className="text-5xl font-black text-white text-left">{clickedGate?.currentLoad}</p>
                                           <p className="text-[8px] text-white/20 font-bold uppercase mt-4 text-left">{t('traffic_delta_min')}</p>
                                        </div>
                                        <div className="bg-white/5 p-6 rounded-3xl border border-white/5 flex-1 flex flex-col justify-center">
                                           <p className="text-[8px] text-white/30 font-black uppercase tracking-widest mb-2 text-left">{t('gate_policy')}</p>
                                           <p className={`text-4xl font-black uppercase tracking-tighter text-left ${clickedGate?.status === 'CROWDED' ? 'text-red-500' : 'text-green-500'}`}>{clickedGate?.status}</p>
                                           <p className="text-[8px] text-white/20 font-bold uppercase mt-4 text-left">{t('system_verified')}</p>
                                        </div>
                                     </div>
                                   ) : (
                                     <div className="flex flex-col gap-6 flex-1">
                                        <div className="bg-white/5 p-6 sm:p-8 rounded-[2.5rem] border border-white/5 group transition-colors hover:bg-white/10 flex flex-col justify-center">
                                           <div className="flex justify-between items-end">
                                              <div className="text-left">
                                                 <p className="text-[10px] text-white/30 font-black uppercase tracking-[0.2em] mb-2">{t('utilized_density')}</p>
                                                 <p className={`text-5xl sm:text-6xl font-black tracking-tighter ${
                                                   (clickedZone?.peopleCount / getZoneCapacity(clickedZone)) > 0.85 ? 'text-red-500' : 'text-blue-500'
                                                 }`}>
                                                   {Math.round((clickedZone?.peopleCount / getZoneCapacity(clickedZone)) * 100)}%
                                                 </p>
                                              </div>
                                              <div className="text-right">
                                                 <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-4 ml-auto">
                                                    <Users className="h-5 w-5 sm:h-6 sm:w-6 text-white/40" />
                                                 </div>
                                                 <p className="text-[9px] sm:text-[10px] text-white/30 font-black uppercase tracking-widest mb-1">{t('sensor_count')}</p>
                                                 <p className="text-lg sm:text-xl font-bold text-white/60 tabular-nums">{Math.floor(clickedZone?.peopleCount || 0)}</p>
                                              </div>
                                           </div>
                                        </div>
                                        
                                        <div className="bg-slate-950 p-6 sm:p-8 rounded-3xl border border-white/5 flex flex-col gap-5 relative overflow-hidden flex-1 justify-center">
                                           <div className="absolute top-0 right-0 p-4 opacity-5">
                                              <Shield className="h-24 w-24 text-white" />
                                           </div>
                                           <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${
                                             (clickedZone?.peopleCount / getZoneCapacity(clickedZone)) > 0.85 ? 'bg-red-600/20 text-red-500' : 'bg-green-600/20 text-green-500'
                                           }`}>
                                              <Shield className="h-6 w-6" />
                                           </div>
                                           <div className="space-y-2 text-left relative z-10">
                                              <p className="text-sm font-black text-white uppercase tracking-tight">{t('exit_strategies')}</p>
                                              <p className="text-[11px] text-white/40 leading-relaxed font-medium pb-2">
                                                 {(clickedZone?.peopleCount / getZoneCapacity(clickedZone)) > 0.85 
                                                    ? "DENSITY RISK Detected: High sensor saturation. System recommends immediate relocation to adjacent green sectors." 
                                                    : "SYSTEM CLEAR: Flow metrics within optimal safety parameters. Static density confirmed below critical thresholds."}
                                              </p>
                                              <Button 
                                                onClick={() => {
                                                  if (clickedZone) {
                                                     setSelectedZoneId(clickedZone.id);
                                                     setCurrentZone(clickedZone);
                                                     toast.success(`${t('joined')} ${clickedZone.name}`);
                                                  }
                                                }}
                                                disabled={selectedZoneId === clickedZone?.id}
                                                className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest h-12 shadow-lg shadow-blue-600/20 mt-auto"
                                              >
                                                {selectedZoneId === clickedZone?.id ? 'CONTINUE AS VISITOR' : t('join_now')}
                                              </Button>
                                           </div>
                                        </div>
                                     </div>
                                   )}
                                </div>
                             </Card>
                          </motion.div>
                       ) : (
                          <motion.div
                             key="intel-empty"
                             initial={{ opacity: 0 }}
                             animate={{ opacity: 1 }}
                             exit={{ opacity: 0 }}
                             className="h-full bg-slate-900/50 border border-white/5 rounded-[2.5rem] p-8 flex flex-col items-center justify-center text-center space-y-4 min-h-[400px]"
                          >
                             <Shield className="h-12 w-12 text-white/5" />
                             <p className="text-white/20 text-[10px] font-black uppercase tracking-widest leading-relaxed">
                                Select a zone or gate<br/>to analyze telemetry
                             </p>
                          </motion.div>
                       )}
                    </AnimatePresence>
                 </div>
              </div>
           </div>

           {/* ACTIVE ALERT: CRITICAL RESPONSE (Only shown when SOS is active) */}
           <AnimatePresence>
             {sosRequest && (
               <motion.div 
                 initial={{ height: 0, opacity: 0 }}
                 animate={{ height: 'auto', opacity: 1 }}
                 exit={{ height: 0, opacity: 0 }}
                 className="space-y-4 overflow-hidden"
               >
                  <div className="flex items-center gap-2 px-2">
                     <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                     <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-red-500">{t('critical_response')}</h2>
                  </div>

                  <motion.div 
                     initial={{ y: 20, opacity: 0 }}
                     animate={{ y: 0, opacity: 1 }}
                     className={`${sosRequest.status === 'arrived' ? 'bg-green-600/90' : 'bg-red-600/90'} backdrop-blur-3xl p-6 rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] border border-white/20`}
                  >
                     <div className="flex items-center gap-5">
                        <div className="w-14 h-14 bg-white rounded-3xl flex items-center justify-center shrink-0 shadow-xl">
                           <Shield className={`h-7 w-7 ${sosRequest.status === 'arrived' ? 'text-green-600' : 'text-red-600'} animate-pulse`} />
                        </div>
                        <div className="flex-1 text-left">
                           <p className="text-lg font-black text-white uppercase tracking-tighter leading-none mb-1">
                              {sosRequest.status === 'arrived' ? t('crew_arrived_msg') : t('help_request_logged')}
                           </p>
                           <p className="text-[10px] text-white/70 font-black uppercase tracking-[0.2em]">
                              {sosRequest.status === 'arrived' 
                                ? 'Personnel are at your location' 
                                : sosRequest.status === 'assigned' 
                                  ? (
                                      <span className="flex items-center gap-1">
                                        Personnel Deployed :: Arrival in <SOSCountdown targetAt={sosRequest.targetArrivalTime} />
                                      </span>
                                    )
                                  : 'Awaiting Crew Dispatch...'}
                           </p>
                        </div>
                        {sosRequest.status === 'arrived' && (
                           <Button 
                              variant="ghost" 
                              onClick={handleResolveSOS}
                              className="bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest px-4 hover:bg-white/20"
                           >
                              Clear
                           </Button>
                        )}
                     </div>


                  </motion.div>
               </motion.div>
             )}
           </AnimatePresence>

           {/* SECTION: EMERGENCY OPERATIONS (SOS SLIDER) */}
           <div className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                 <Shield className="h-3.5 w-3.5 text-white/40" />
                 <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-white/40">{t('safety_protocol')}</h2>
              </div>

              <div className="bg-slate-900 overflow-hidden border border-white/5 p-6 rounded-[2.5rem] space-y-6">
                 <p className="text-[11px] text-white/40 font-medium px-2 leading-relaxed text-left">
                    {sosRequest 
                      ? t('safety_protocol_active')
                      : t('safety_protocol_desc')
                    }
                 </p>
                 <div className="px-2">
                    <SOSButton onConfirm={handleSOSConfirm} zones={zones} />
                 </div>
              </div>
           </div>

           {/* SECTION: NAVIGATION & LOGISTICS */}
           <div className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                 <Navigation className="h-3.5 w-3.5 text-blue-500" />
                 <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-blue-500/40">{t('exit_navigation')}</h2>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSafeRoute}
                    className="bg-blue-600 rounded-[2rem] p-6 text-left flex flex-col justify-between min-h-[160px] shadow-xl shadow-blue-600/20 group border border-white/10"
                 >
                    <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center group-hover:bg-white/30 transition-colors shadow-inner">
                       <Navigation className="h-5 w-5 text-white" />
                    </div>
                    <div className="space-y-1">
                       <p className="text-[10px] text-white/50 font-black tracking-widest uppercase mb-1">{t('recommended_exit')}</p>
                       <p className="text-xl font-black text-white tracking-tighter leading-none uppercase">{t('safe_passage')}</p>
                    </div>
                 </motion.button>

                 <div className="bg-slate-900 rounded-[2rem] p-6 border border-white/5 flex flex-col justify-between min-h-[160px] shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                       <MapPin className="h-12 w-12 text-white" />
                    </div>
                    <div className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center">
                       <MapPin className="h-5 w-5 text-white/40" />
                    </div>
                    <div className="space-y-1">
                       <p className="text-[10px] text-white/30 font-black tracking-widest uppercase mb-1">{t('assigned_exit')}</p>
                       <p className="text-xl font-black text-white tracking-tighter leading-none uppercase">Gate B</p>
                    </div>
                 </div>
              </div>
           </div>

           {/* System Branding & Telemetry Data */}
           <div className="flex flex-col items-center gap-4 pt-12 border-t border-white/5 opacity-20">
              <p className="text-[8px] text-white font-black uppercase tracking-[0.5em] text-center">{t('crowdguard_intelligence_engine')}</p>
              <div className="flex items-center gap-6">
                 <div className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-blue-500" />
                    <span className="text-[7px] font-bold text-white/60 tracking-widest uppercase">{t('encrypted')}</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full bg-blue-500" />
                    <span className="text-[7px] font-bold text-white/60 tracking-widest uppercase">{t('verified_feed')}</span>
                 </div>
              </div>
           </div>

        {/* Global Nav Indicator */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
           <div className="px-5 py-2.5 bg-slate-950/80 border border-white/10 rounded-full shadow-2xl backdrop-blur-xl flex items-center gap-3 ring-1 ring-white/5">
              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[8px] font-black text-white tracking-[0.3em] uppercase">{t('guardian_sync_active')}</span>
           </div>
        </div>

        {/* Chat Component - Outside pointer-events-none wrapper */}
        {activeEvent && sosRequest && (['pending', 'assigned', 'arrived'].includes(sosRequest.status)) && (
          <FloatingChat eventId={activeEvent.id} userRole="attendee" />
        )}

        {/* GUIDANCE OVERLAY (SAFE ROUTE) */}
        <AnimatePresence>
          {showSafeRoute && (
            <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 bg-slate-950/95 z-[100] backdrop-blur-xl flex items-center justify-center p-6"
            >
               <motion.div 
                 initial={{ scale: 0.9, y: 20 }}
                 animate={{ scale: 1, y: 0 }}
                 className="w-full max-w-4xl bg-slate-900 rounded-[3rem] border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,1)] overflow-hidden"
               >
                  <div className="h-2 w-full bg-blue-600" />
                  <div className="p-10 flex flex-col md:flex-row gap-10 text-left">
                     <div className="flex-1 space-y-8 text-left">
                        <div>
                           <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-600/10 rounded-full border border-blue-500/20 mb-3">
                              <Navigation className="h-3 w-3 text-blue-500" />
                              <span className="text-[8px] text-blue-500 font-black uppercase tracking-widest">{t('optimized_guidance')}</span>
                           </div>
                           <h2 className="text-4xl font-black text-white tracking-tighter leading-none mb-3 uppercase">{t('safe_passage_protocol')}</h2>
                           <p className="text-white/40 text-sm font-medium tracking-tight">{t('safe_passage_desc')}</p>
                        </div>

                        <div className="space-y-4">
                           <div className="flex items-center gap-6 p-6 bg-white/5 rounded-3xl border border-white/5 relative overflow-hidden">
                              <div className="absolute left-0 top-0 bottom-0 w-1 bg-green-500" />
                              <div className="w-12 h-12 bg-green-600 rounded-2xl flex items-center justify-center shrink-0 shadow-lg">
                                 <LogOut className="h-6 w-6 text-white" />
                              </div>
                              <div className="text-left">
                                 <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mb-1">{t('primary_exit')}</p>
                                 <p className="text-xl font-black text-white tracking-tighter uppercase">{currentZone?.recommendedExitDoor || 'GATE B (North)'}</p>
                              </div>
                              <div className="ml-auto text-right">
                                 <p className="text-[10px] text-green-500 font-black uppercase tracking-widest mb-1">Clear Path</p>
                                 <div className="flex gap-1 justify-end">
                                    {[1,2,3].map(i => <div key={i} className="w-3 h-1 bg-green-500/50 rounded-full" />)}
                                 </div>
                              </div>
                           </div>

                           <div className="flex items-center gap-6 p-6 bg-white/5 rounded-3xl border border-white/5 opacity-50 text-left">
                              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center shrink-0">
                                 <MapPin className="h-6 w-6 text-white/40" />
                              </div>
                              <div className="text-left">
                                 <p className="text-[10px] text-white/30 font-black uppercase tracking-widest mb-1">{t('alternative_exit')}</p>
                                 <p className="text-lg font-bold text-white/40 tracking-tight uppercase">GATE E (South East)</p>
                              </div>
                           </div>
                        </div>

                        <Button 
                           onClick={() => setShowSafeRoute(false)}
                           className="w-full h-16 bg-white text-slate-950 hover:bg-slate-200 rounded-2xl font-black text-lg uppercase tracking-tight shadow-xl shadow-white/5 scale-100 transition-transform active:scale-95"
                        >
                           {t('dismiss_guidance')}
                        </Button>
                     </div>
                     <div className="flex-1 bg-slate-950 rounded-[2.5rem] border border-white/5 p-6 flex items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.1)_0%,transparent_70%)]" />
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:32px_32px]" />
                        <div className="text-center space-y-4 relative z-10">
                           <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-blue-500/30">
                              <Activity className="h-10 w-10 text-white animate-pulse" />
                           </div>
                           <p className="text-xs font-black uppercase text-blue-500 tracking-[0.3em] leading-none">{t('calculating_routes')}</p>
                           <p className="text-[8px] text-white/20 font-mono italic uppercase tracking-widest">{t('live_flow_active')}</p>
                        </div>
                     </div>
                  </div>
               </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* EXIT GUIDANCE FOR CONCLUDED EVENTS */}
        {activeEvent.exitGuidanceActive && (
          <div className="fixed inset-0 bg-slate-950/95 z-[95] flex items-center justify-center p-6 backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-slate-900 rounded-[3rem] p-10 w-full max-w-md text-center space-y-8 shadow-[0_50px_100px_rgba(0,0,0,1)] border border-white/10"
            >
              <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center mx-auto shadow-xl shadow-blue-500/20">
                <LogOut className="h-10 w-10 text-white" />
              </div>
              <div className="space-y-3">
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">{t('event_concluded')}</h2>
                <p className="text-white/40 text-sm font-medium leading-relaxed">{t('event_concluded_desc')}</p>
              </div>
              <div className="bg-slate-950 p-6 rounded-[2rem] border border-white/5 text-left relative overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-600" />
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-2 text-left">{t('assigned_portal')}</p>
                <p className="text-2xl font-black text-white tracking-tighter uppercase">{currentZone?.recommendedExitDoor || 'GATE B (NORTH)'}</p>
              </div>
              <Button className="w-full h-16 text-lg rounded-2xl bg-white text-slate-950 hover:bg-slate-200 font-bold uppercase tracking-tight scale-100 transition-transform active:scale-95" onClick={() => setActiveEvent(null)}>
                {t('dismiss_session')}
              </Button>
            </motion.div>
          </div>
        )}
      </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex relative">
      <AttendeeSidebar 
        isVisible={isSidebarVisible} 
        onHide={() => setIsSidebarVisible(false)}
        activeEvent={activeEvent}
        setActiveEvent={setActiveEvent}
        onOpenSettings={onOpenSettings}
        onBack={onBack}
        t={t}
      />
      {!isSidebarVisible && (
        <div className="lg:block hidden">
          {/* This empty div is just a placeholder, the button is now in the header */}
        </div>
      )}
      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <nav className="bg-white/80 backdrop-blur-md border-b px-4 sm:px-8 py-4 sm:py-6 flex justify-between items-center sticky top-0 z-30">
          <div className="flex items-center gap-4">
            {!isSidebarVisible && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsSidebarVisible(true)}
                className="flex mr-4 text-slate-600 hover:bg-slate-100 rounded-xl"
              >
                <Menu className="h-6 w-6" />
              </Button>
            )}
            {onBack && (
              <Button variant="ghost" size="sm" onClick={onBack} className="lg:hidden text-slate-500">
                ← {t('back')}
              </Button>
            )}
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{t('attendee_portal')}</h2>
              <p className="text-slate-500 text-sm">{t('welcome')}, {userData?.username || auth.currentUser?.email?.split('@')[0]}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" className="text-slate-500" onClick={onOpenSettings}><Settings className="h-5 w-5" /></Button>
            <div className="relative">
              <Button variant="ghost" size="icon" className="text-slate-500" onClick={() => setShowNotifications(!showNotifications)}>
                <Bell className="h-5 w-5" />
              </Button>
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden"
                  >
                    <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
                      <h3 className="font-bold text-slate-900">{t('notifications')}</h3>
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
            <Button variant="outline" className="h-12 px-6 rounded-xl border-slate-200" onClick={() => auth.signOut()}>
              <LogOut className="mr-2 h-4 w-4" /> {t('sign_out')}
            </Button>
          </div>
        </nav>
        
        <div className="p-4 sm:p-8 space-y-6 sm:space-y-8 max-w-7xl mx-auto w-full overflow-x-hidden">
          <header className="mb-6 space-y-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-3xl font-bold text-slate-900">{t('events')}</h2>
              <p className="text-slate-500 text-sm">{t('search_upcoming_events')}</p>
            </div>

          {/* Picture Perfect Search Bar */}
          <div className={`relative group ${isSearchFocused ? 'z-50' : 'z-0'}`}>
            <div className={`flex items-center gap-3 bg-white h-14 rounded-2xl px-4 border shadow-sm transition-all ${isSearchFocused ? 'border-blue-500 ring-4 ring-blue-500/10' : 'hover:border-slate-300'}`}>
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
                  className="bg-red-500 hover:bg-red-600 rounded-xl w-10 h-10 p-0 flex items-center justify-center shrink-0"
                  onClick={() => addToHistory(searchQuery)}
                >
                  <Search className="h-4 w-4 text-white" />
                </Button>
              </div>
            </div>

            {/* Suggestions & History Overlay */}
            <AnimatePresence>
              {isSearchFocused && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border shadow-2xl z-50 overflow-hidden"
                >
                  {searchQuery ? (
                    <div className="py-2">
                      {events
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
                            <Search className="h-4 w-4 text-slate-300 group-hover:text-blue-500" />
                            <span className="text-sm font-bold text-slate-700">{event.name.toLowerCase()}</span>
                          </button>
                        ))}
                      {events.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase())).length === 0 && (
                        <div className="px-6 py-8 text-center">
                          <p className="text-sm text-slate-400 font-medium italic">No matches found for "{searchQuery}"</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-2">
                      {searchHistory.length > 0 && (
                        <>
                          <div className="px-6 py-3 flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">History</span>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-auto p-0 text-[10px] font-bold text-blue-500 hover:bg-transparent"
                              onClick={() => {
                                setSearchHistory([]);
                                localStorage.removeItem('crowdguard_search_history');
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
                              <History className="h-4 w-4 text-slate-300 group-hover:text-blue-500" />
                              <span className="text-sm font-medium text-slate-600">{h}</span>
                            </button>
                          ))}
                        </>
                      )}
                      <div className="px-6 py-3">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Trending Now</span>
                      </div>
                      {['Keshi', 'Unifi Arena', 'Festival', 'Sports'].map(h => (
                        <button
                          key={h}
                          className="w-full flex items-center gap-3 px-6 py-3 hover:bg-slate-50 transition-colors group"
                          onClick={() => setSearchQuery(h)}
                        >
                          <Activity className="h-4 w-4 text-slate-300 group-hover:text-blue-500" />
                          <span className="text-sm font-medium text-slate-600">{h}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Filtering & Sorting Bar */}
          <div className="flex flex-col gap-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setShowFilters(!showFilters)}
                  className={`rounded-xl border-slate-200 text-slate-600 font-bold ${showFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : ''}`}
                >
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  {t('filter')}
                </Button>
                {(filters.date || filters.state || filters.venue || filters.type !== 'all') && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setFilters({ ...filters, date: '', state: '', venue: '', type: 'all' })}
                    className="text-[10px] font-black uppercase text-slate-400 hover:text-red-500"
                  >
                    {t('clear_filters')}
                  </Button>
                )}
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
                      className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={filters.state}
                      onChange={(e) => setFilters({ ...filters, state: e.target.value })}
                    >
                      <option value="">{t('all_states')}</option>
                      {filterStates.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 pl-1">{t('venue')}</label>
                    <select 
                      className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={filters.venue}
                      onChange={(e) => setFilters({ ...filters, venue: e.target.value })}
                    >
                      <option value="">{t('all_venues')}</option>
                      {filterVenues.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-slate-400 pl-1">{t('type')}</label>
                    <select 
                      className="w-full h-10 bg-white border border-slate-200 rounded-xl px-3 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={filters.type}
                      onChange={(e) => setFilters({ ...filters, type: e.target.value })}
                    >
                      <option value="all">{t('all_types')}</option>
                      <option value="free">{t('free_entry')}</option>
                      <option value="ticketed">{t('ticketed')}</option>
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </header>

        {isSearchFocused && (
          <div className="fixed inset-0 bg-slate-900/10 backdrop-blur-sm z-40" onClick={() => setIsSearchFocused(false)} />
        )}

        <Tabs defaultValue="ongoing" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 sm:mb-8 bg-white border p-1 rounded-xl">
            <TabsTrigger value="ongoing" className="rounded-lg">{t('ongoing')}</TabsTrigger>
            <TabsTrigger value="upcoming" className="rounded-lg">{t('upcoming')}</TabsTrigger>
          </TabsList>
          
          <TabsContent value="ongoing" className="space-y-4">
            {events
              .filter(e => e.isOngoing)
              .filter(e => searchQuery ? e.name.toLowerCase().includes(searchQuery.toLowerCase()) : true)
              .filter(e => {
                if (filters.date && e.date !== filters.date) return false;
                if (filters.state && e.state !== filters.state) return false;
                if (filters.venue && e.venue !== filters.venue) return false;
                if (filters.type === 'free' && !e.isFree) return false;
                if (filters.type === 'ticketed' && e.isFree) return false;
                return true;
              })
              .sort((a, b) => {
                if (filters.sortBy === 'popular') {
                  const popA = a.ticketAmount ? parseInt(a.ticketAmount) : 0;
                  const popB = b.ticketAmount ? parseInt(b.ticketAmount) : 0;
                  return popB - popA;
                }
                const dateA = a.createdAt?.seconds || 0;
                const dateB = b.createdAt?.seconds || 0;
                return dateB - dateA;
              })
              .length > 0 ? (
              events
                .filter(e => e.isOngoing)
                .filter(e => searchQuery ? e.name.toLowerCase().includes(searchQuery.toLowerCase()) : true)
                .filter(e => {
                  if (filters.date && e.date !== filters.date) return false;
                  if (filters.state && e.state !== filters.state) return false;
                  if (filters.venue && e.venue !== filters.venue) return false;
                  if (filters.type === 'free' && !e.isFree) return false;
                  if (filters.type === 'ticketed' && e.isFree) return false;
                  return true;
                })
                .sort((a, b) => {
                  if (filters.sortBy === 'popular') {
                    const popA = a.ticketAmount ? parseInt(a.ticketAmount) : 0;
                    const popB = b.ticketAmount ? parseInt(b.ticketAmount) : 0;
                    return popB - popA;
                  }
                  const dateA = a.createdAt?.seconds || 0;
                  const dateB = b.createdAt?.seconds || 0;
                  return dateB - dateA;
                })
                .map(event => (
                  <EventBanner 
                    key={event.id} 
                    event={event} 
                    type="ongoing" 
                    onAction={() => handleJoinEvent(event)} 
                    distance={userLocation ? getDistance(userLocation.lat, userLocation.lng, event.venueLat || 3.053, event.venueLng || 101.696) : null}
                  />
                ))
            ) : (
              <EmptyState message={t('no_ongoing_events')} />
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
                if (filters.type === 'free' && !e.isFree) return false;
                if (filters.type === 'ticketed' && e.isFree) return false;
                return true;
              })
              .sort((a,b) => {
                if (filters.sortBy === 'popular') {
                  const popA = a.ticketAmount ? parseInt(a.ticketAmount) : 0;
                  const popB = b.ticketAmount ? parseInt(b.ticketAmount) : 0;
                  return popB - popA;
                }
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
                  if (filters.type === 'free' && !e.isFree) return false;
                  if (filters.type === 'ticketed' && e.isFree) return false;
                  return true;
                })
                .sort((a,b) => {
                  if (filters.sortBy === 'popular') {
                    const popA = a.ticketAmount ? parseInt(a.ticketAmount) : 0;
                    const popB = b.ticketAmount ? parseInt(b.ticketAmount) : 0;
                    return popB - popA;
                  }
                  return new Date(a.startDate || a.date.split(' to ')[0] || a.date).getTime() - new Date(b.startDate || b.date.split(' to ')[0] || b.date).getTime();
                })
                .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
                .map(event => (
                  <EventBanner 
                    key={event.id} 
                    event={event} 
                    type="upcoming" 
                    onAction={() => handleNotifyMe(event.id)} 
                    isNotified={notifiedEventIds.includes(event.id)}
                    distance={userLocation ? getDistance(userLocation.lat, userLocation.lng, event.venueLat || 3.053, event.venueLng || 101.696) : null}
                  />
                ))
            ) : (
              <EmptyState message={t('no_upcoming_events')} />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>

  </div>
);
}

function EventBanner({ event, type, onAction, isNotified, distance }: any) {
  const { t } = useTranslation();
  return (
    <Card className="overflow-hidden border-none shadow-md hover:shadow-lg transition-shadow group rounded-3xl">
      <div className="flex flex-col sm:flex-row">
        <div className="sm:w-48 h-32 sm:h-48 bg-slate-200 relative overflow-hidden shrink-0">
          <img 
            src={event.image || `https://picsum.photos/seed/${event.id}/800/400`} 
            alt={event.name}
            className="w-full h-full object-cover opacity-80 group-hover:scale-105 transition-transform duration-500"
            referrerPolicy="no-referrer"
          />
          <div className="absolute top-4 right-4 flex flex-col gap-2 items-end">
            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${type === 'ongoing' ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'}`}>
              {t(type)}
            </span>
            {distance !== null && (
              <span className="bg-slate-900/60 backdrop-blur-md px-2 py-1 rounded-lg text-[9px] font-bold text-white flex items-center gap-1">
                <Navigation className="h-2.5 w-2.5" />
                {distance.toFixed(1)} km
              </span>
            )}
          </div>
        </div>
        <CardContent className="p-6 flex-1 flex flex-col justify-between">
          <div className="flex justify-between items-start gap-4">
            <div className="space-y-3">
              <div>
                <h3 className="text-xl font-bold text-slate-900">{event.name}</h3>
                <div className="flex items-center gap-4 mt-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1 font-bold"><Calendar className="h-3 w-3" /> {event.date} {event.startTime && `• ${event.startTime}`}</span>
                  <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {event.venue}{event.state ? `, ${event.state}` : ''}</span>
                  {event.isFree && (
                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-black uppercase tracking-tighter">
                      {t('free_entry')}
                    </span>
                  )}
                </div>
              </div>
              {event.description && (
                <p className="text-xs text-slate-500 line-clamp-2 italic leading-relaxed">{event.description}</p>
              )}
            </div>
          </div>
          <div className="mt-4 flex justify-end shrink-0">
            <Button 
                onClick={onAction}
                disabled={isNotified}
                className={type === 'ongoing' ? 'bg-green-600 hover:bg-green-700 h-10 px-6 rounded-xl font-bold uppercase tracking-tight' : isNotified ? 'bg-slate-200 text-slate-400 h-10 px-6 rounded-xl font-bold uppercase tracking-tight' : 'bg-blue-600 hover:bg-blue-700 h-10 px-6 rounded-xl font-bold uppercase tracking-tight'}
            >
                {type === 'ongoing' ? t('join_now') : isNotified ? t('notified') : t('notify_me')}
            </Button>
          </div>
        </CardContent>
      </div>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-slate-200">
      <Calendar className="h-12 w-12 mx-auto mb-4 text-slate-200" />
      <p className="text-slate-400 font-medium">{message}</p>
    </div>
  );
}

function DashboardCard({ icon: Icon, title, value, color }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl border shadow-sm hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center mb-4 ${color}`}>
        <Icon className="h-6 w-6" />
      </div>
      <h4 className="text-slate-500 text-sm font-medium">{title}</h4>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    </div>
  );
}
