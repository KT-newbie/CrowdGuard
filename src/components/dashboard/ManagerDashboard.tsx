import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { auth, db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  or,
  orderBy,
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc,
  serverTimestamp,
  addDoc,
  writeBatch
} from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Plus, 
  LayoutDashboard, 
  Users, 
  Settings, 
  LogOut, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Menu,
  XCircle,
  Upload,
  CreditCard,
  Map as MapIcon,
  AlertCircle,
  Shield,
  Navigation,
  Database,
  Bell,
  ChevronDown,
  Info,
  Trash2,
  Activity,
  ChevronRight,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { seedDemoData } from '@/lib/seedData';
import * as d3 from 'd3';

// Helper to format 24h time to 12h display
const formatDisplayTime = (timeStr: string) => {
  if (!timeStr) return '';
  if (timeStr.includes('AM') || timeStr.includes('PM')) return timeStr; // Already formatted
  const [hours, minutes] = timeStr.split(':');
  let h = parseInt(hours, 10);
  const m = minutes;
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12; // the hour '0' should be '12'
  return `${h}:${m} ${ampm}`;
};
import { useTranslation } from 'react-i18next';
import { CrowdMap } from '@/components/common/CrowdMap';
import { getZoneCapacity } from '@/lib/zoneUtils';

// --- Components ---

const VENUES = [
  "Unifi Arena",
  "Kuala Lumpur Convention Centre",
  "Mid Valley Exhibition Centre (MVEC)",
  "Stadium Nasional Bukit Jalil",
  "Malaysia International Trade and Exhibition Centre (MITEC)",
  "Mines International Exhibition & Convention Centre (MIECC)"
];

const STATES = [
  "Kuala Lumpur",
  "Selangor",
  "Johor",
  "Penang",
  "Perak",
  "Kedah",
  "Negeri Sembilan",
  "Melaka",
  "Pahang",
  "Terengganu",
  "Kelantan",
  "Perlis",
  "Sabah",
  "Sarawak",
  "Putrajaya",
  "Labuan"
];

const CreateEventModal = ({ isOpen, onClose, venueLayouts }: { isOpen: boolean, onClose: () => void, venueLayouts: any[] }) => {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    venue: VENUES[0],
    state: STATES[0],
    isFree: false,
    startDate: '',
    endDate: '',
    duration: '',
    ticketAmount: '',
    description: '',
    permits: [] as File[],
    contracts: [] as File[],
    floorPlanUrl: '',
    floorPlanPdf: null as File | null,
    seatingPlanPdf: null as File | null,
    catCount: '1',
    standingCount: '1',
    coverPhotoUrl: '',
    startTime: '09:00'
  });
  const [loading, setLoading] = useState(false);
  const fileInputRef1 = React.useRef<HTMLInputElement>(null);
  const fileInputRef2 = React.useRef<HTMLInputElement>(null);
  const floorPlanPdfRef = React.useRef<HTMLInputElement>(null);
  const seatingPlanPdfRef = React.useRef<HTMLInputElement>(null);
  const coverPhotoInputRef = React.useRef<HTMLInputElement>(null);

  const handleCoverPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, coverPhotoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const selectedLayout = venueLayouts.find(l => l.venueName === formData.venue);

  useEffect(() => {
    if (selectedLayout && !formData.floorPlanUrl) {
      setFormData(prev => ({ ...prev, floorPlanUrl: selectedLayout.imageUrl }));
    }
  }, [formData.venue, selectedLayout]);
  
  const handlePermitsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFormData(prev => ({ ...prev, permits: [...prev.permits, ...newFiles] }));
      toast.success(`${newFiles.length} permit file(s) selected`);
    }
  };

  const handleContractsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setFormData(prev => ({ ...prev, contracts: [...prev.contracts, ...newFiles] }));
      toast.success(`${newFiles.length} contract file(s) selected`);
    }
  };

  const validateStep1 = () => {
    if (!formData.name.trim()) return t('please_enter_event_name');
    if (!formData.startDate) return t('please_select_start_date');
    if (!formData.startTime) return t('please_select_start_time');
    if (!formData.endDate) return t('please_select_end_date');
    if (new Date(formData.startDate) > new Date(formData.endDate)) return t('end_date_after_start');
    if (!formData.venue) return t('please_select_venue');
    if (!formData.state) return t('please_select_state');
    if (!formData.duration || parseInt(formData.duration) <= 0) return t('please_enter_duration');
    if (!formData.ticketAmount || parseInt(formData.ticketAmount) <= 0) return t('please_enter_tickets');
    if (!formData.description.trim()) return t('please_enter_description');
    return null;
  };

  const handleNext = () => {
    const error = validateStep1();
    if (error) {
      toast.error(error);
      return;
    }
    setStep(prev => prev + 1);
  };

  const handlePdfChange = (field: 'floorPlanPdf' | 'seatingPlanPdf', e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      setFormData(prev => ({ ...prev, [field]: e.target.files![0] }));
      toast.success(t('pdf_uploaded'));
    }
  };

  const handleCreate = async () => {
    if (!auth.currentUser) return;
    
    // Final validation
    if (formData.permits.length === 0) {
      toast.error(t('please_upload_permits'));
      return;
    }
    if (formData.contracts.length === 0) {
      toast.error(t('please_upload_contracts'));
      return;
    }

    setLoading(true);
    try {
      const eventCode = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const eventRecord = await addDoc(collection(db, 'events'), {
        name: formData.name,
        venue: formData.venue,
        state: formData.state,
        isFree: formData.isFree,
        startDate: formData.startDate,
        startTime: formatDisplayTime(formData.startTime),
        endDate: formData.endDate,
        date: formData.startDate === formData.endDate ? formData.startDate : `${formData.startDate} to ${formData.endDate}`,
        duration: formData.duration,
        ticketAmount: formData.ticketAmount,
        description: formData.description,
        image: formData.coverPhotoUrl || null,
        permits: formData.permits.map(f => f.name),
        contracts: formData.contracts.map(f => f.name),
        managerId: auth.currentUser.uid,
        status: 'pending',
        eventCode,
        isOngoing: false,
        isEnded: false,
        exitGuidanceActive: false,
        depositPaid: true,
        registrationFeePaid: false,
        backgroundUrl: formData.floorPlanUrl || null,
        floorPlanFileName: formData.floorPlanPdf?.name || null,
        seatingPlanFileName: formData.seatingPlanPdf?.name || null,
        zoneConfig: {
          categories: parseInt(formData.catCount),
          standing: parseInt(formData.standingCount)
        },
        createdAt: serverTimestamp()
      });

      // If there's a layout, copy zones to the event's zones collection
      if (selectedLayout?.zones) {
        for (const zone of selectedLayout.zones) {
          await addDoc(collection(db, 'events', eventRecord.id, 'zones'), {
            ...zone,
            peopleCount: 0,
            confidence: 0.95
          });
        }
      }

      toast.success(t('event_submitted_success'));
      onClose();
    } catch (e: any) {
      handleFirestoreError(e, OperationType.CREATE, 'events');
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl w-full max-w-2xl flex flex-col max-h-[90vh] shadow-2xl"
      >
        <div className="bg-slate-900 p-8 text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-bold">{t('create_event')}</h2>
            <p className="text-slate-400 text-sm">{t('status')} - {t('step')} {step} {t('of')} 3</p>
          </div>
          <Button variant="ghost" className="text-white hover:bg-white/10 h-10 w-10 p-0 rounded-full" onClick={onClose}>
            <X className="h-6 w-6" />
          </Button>
        </div>

        <div className="p-8 overflow-y-auto">
          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label>{t('event_name')}</Label>
                <Input placeholder="e.g. Summer Music Fest" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('start_date')}</Label>
                  <Input type="date" min={new Date().toISOString().split('T')[0]} value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>{t('start_time')}</Label>
                  <Input 
                    type="time" 
                    value={formData.startTime} 
                    onChange={e => setFormData({...formData, startTime: e.target.value})}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('end_date')}</Label>
                  <Input type="date" min={formData.startDate || new Date().toISOString().split('T')[0]} value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>{t('avg_daily_duration')} ({t('hours')})</Label>
                  <Input type="number" placeholder="4" value={formData.duration} onChange={e => setFormData({...formData, duration: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('venue')}</Label>
                  <div className="relative">
                    <select 
                      className="flex h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all appearance-none pr-10"
                      value={formData.venue}
                      onChange={e => setFormData({...formData, venue: e.target.value})}
                    >
                      {VENUES.map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{t('state')}</Label>
                  <div className="relative">
                    <select 
                      className="flex h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all appearance-none pr-10"
                      value={formData.state}
                      onChange={e => setFormData({...formData, state: e.target.value})}
                    >
                      {STATES.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-400">
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 items-end">
                <div className="flex items-center gap-2 bg-slate-50 p-4 rounded-2xl border border-slate-100 h-12">
                  <input 
                    type="checkbox" 
                    id="isFree" 
                    checked={formData.isFree} 
                    onChange={e => setFormData({...formData, isFree: e.target.checked})}
                    className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <Label htmlFor="isFree" className="cursor-pointer font-bold text-slate-700">{t('free_entry')}</Label>
                </div>
                <div className="space-y-2">
                  <Label>{t('ticket_amount')}</Label>
                  <Input type="number" placeholder="20000" value={formData.ticketAmount} onChange={e => setFormData({...formData, ticketAmount: e.target.value})} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('description')}</Label>
                <textarea 
                  className="flex min-h-[80px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Tell us about your event..."
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label>Event Cover Photo</Label>
                <div 
                  className={`h-32 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-all ${formData.coverPhotoUrl ? 'border-green-500 bg-cover bg-center' : 'border-slate-200 bg-slate-50'}`}
                  style={formData.coverPhotoUrl ? { backgroundImage: `url(${formData.coverPhotoUrl})` } : {}}
                  onClick={() => coverPhotoInputRef.current?.click()}
                >
                  <input 
                    type="file" 
                    accept="image/*"
                    ref={coverPhotoInputRef} 
                    className="hidden" 
                    onChange={handleCoverPhotoChange}
                  />
                  {!formData.coverPhotoUrl && (
                    <>
                      <Upload className="h-8 w-8 mb-2 text-slate-300" />
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-center px-4">
                        Click to upload cover photo
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3">
                <CreditCard className="text-blue-600 h-5 w-5 shrink-0" />
                <p className="text-xs text-blue-700">{t('deposit_requirement_desc')}</p>
              </div>
              <div className="flex gap-4">
                <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={onClose}>{t('cancel')}</Button>
                <Button className="flex-1 h-12 bg-slate-900 rounded-xl" onClick={handleNext}>{t('next')}: {t('documentation')}</Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4">
                <input 
                  type="file" 
                  ref={fileInputRef1} 
                  className="hidden" 
                  multiple 
                  accept=".pdf,.jpg,.png" 
                  onChange={handlePermitsChange} 
                />
                <div 
                  className={`p-8 border-2 border-dashed rounded-2xl text-center space-y-2 hover:bg-slate-50 transition-colors cursor-pointer ${formData.permits.length > 0 ? 'border-green-500 bg-green-50' : 'border-slate-200'}`}
                  onClick={() => fileInputRef1.current?.click()}
                >
                  <Upload className={`h-8 w-8 mx-auto ${formData.permits.length > 0 ? 'text-green-500' : 'text-slate-400'}`} />
                  <p className="font-medium">{t('upload_permits')}</p>
                  <p className="text-xs text-slate-400">PDF, JPG, PNG (Max 10MB)</p>
                  {formData.permits.length > 0 && (
                    <p className="text-xs text-green-600 font-bold">{formData.permits.length} {t('files_selected')}</p>
                  )}
                </div>

                <input 
                  type="file" 
                  ref={fileInputRef2} 
                  className="hidden" 
                  multiple 
                  onChange={handleContractsChange} 
                />
                <div 
                  className={`p-8 border-2 border-dashed rounded-2xl text-center space-y-2 hover:bg-slate-50 transition-colors cursor-pointer ${formData.contracts.length > 0 ? 'border-green-500 bg-green-50' : 'border-slate-200'}`}
                  onClick={() => fileInputRef2.current?.click()}
                >
                  <FileText className={`h-8 w-8 mx-auto ${formData.contracts.length > 0 ? 'text-green-500' : 'text-slate-400'}`} />
                  <p className="font-medium">{t('contracts_agreements')}</p>
                  <p className="text-xs text-slate-400">{t('digital_handwritten_scans')}</p>
                  {formData.contracts.length > 0 && (
                    <p className="text-xs text-green-600 font-bold">{formData.contracts.length} {t('files_selected')}</p>
                  )}
                </div>
              </div>
              <div className="flex gap-4">
                <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setStep(1)}>{t('back')}</Button>
                <Button className="flex-[2] h-12 bg-slate-900 rounded-xl" onClick={handleNext}>
                  {t('next')}: {t('venue_layout')}
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* PDF Uploads */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('upload_floor_plan_pdf')}</Label>
                    <div 
                      onClick={() => floorPlanPdfRef.current?.click()}
                      className={`h-32 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-all ${formData.floorPlanPdf ? 'border-green-500 bg-green-50' : 'border-slate-100 bg-slate-50'}`}
                    >
                      <input 
                        type="file" 
                        ref={floorPlanPdfRef} 
                        className="hidden" 
                        accept=".pdf"
                        onChange={(e) => handlePdfChange('floorPlanPdf', e)}
                      />
                      <FileText className={`h-8 w-8 mb-2 ${formData.floorPlanPdf ? 'text-green-500' : 'text-slate-300'}`} />
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-center px-4">
                        {formData.floorPlanPdf ? formData.floorPlanPdf.name : t('click_to_upload')}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('upload_seating_plan_pdf')}</Label>
                    <div 
                      onClick={() => seatingPlanPdfRef.current?.click()}
                      className={`h-32 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-all ${formData.seatingPlanPdf ? 'border-green-500 bg-green-50' : 'border-slate-100 bg-slate-50'}`}
                    >
                      <input 
                        type="file" 
                        ref={seatingPlanPdfRef} 
                        className="hidden" 
                        accept=".pdf"
                        onChange={(e) => handlePdfChange('seatingPlanPdf', e)}
                      />
                      <FileText className={`h-8 w-8 mb-2 ${formData.seatingPlanPdf ? 'text-green-500' : 'text-slate-300'}`} />
                      <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider text-center px-4">
                        {formData.seatingPlanPdf ? formData.seatingPlanPdf.name : t('click_to_upload')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Zone Counts */}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('number_of_cats')}</Label>
                    <Input 
                      type="number" 
                      min="0"
                      className="h-12 rounded-xl border-2 border-slate-100 font-bold" 
                      value={formData.catCount}
                      onChange={e => setFormData({...formData, catCount: e.target.value})}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{t('number_of_standing')}</Label>
                    <Input 
                      type="number" 
                      min="0"
                      className="h-12 rounded-xl border-2 border-slate-100 font-bold" 
                      value={formData.standingCount}
                      onChange={e => setFormData({...formData, standingCount: e.target.value})}
                    />
                  </div>

                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3">
                    <Info className="text-blue-600 h-5 w-5 shrink-0" />
                    <p className="text-[10px] text-blue-700 font-medium leading-relaxed">
                      {t('preview_placeholder')}. {t('new_venue_layout_note')}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-4">
                <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={() => setStep(2)}>{t('back')}</Button>
                <Button className="flex-[2] h-12 bg-green-600 hover:bg-green-700 rounded-xl shadow-lg shadow-green-500/20" onClick={handleCreate} disabled={loading}>
                  {loading ? t('submitting') + '...' : t('pay_deposit_submit')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, eventName, loading }: { 
  isOpen: boolean, 
  onClose: () => void, 
  onConfirm: () => void,
  eventName: string,
  loading: boolean
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl p-8 text-center"
      >
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
          <Trash2 className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">{t('confirm_delete_event')}</h3>
        <p className="text-slate-500 mb-8 font-medium">"{eventName}"</p>
        
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 h-12 rounded-xl" onClick={onClose} disabled={loading}>
            {t('cancel')}
          </Button>
          <Button variant="destructive" className="flex-1 h-12 rounded-xl bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/20" onClick={onConfirm} disabled={loading}>
            {loading ? '...' : t('delete')}
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

const SeedDemoModal = ({ isOpen, onClose, onConfirm, loading }: {
  isOpen: boolean,
  onClose: () => void,
  onConfirm: () => void,
  loading: boolean
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const demoEvents = [
    { name: "Live Concert 2024", venue: "Unifi Arena", date: "2024-06-15" },
    { name: "Global Tech Expo", venue: "MITEC", date: "2024-08-20" },
    { name: "International Food Fest", venue: "MVEC", date: "2024-09-05" }
  ];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl"
      >
        <div className="bg-slate-900 p-8 text-white">
          <h2 className="text-2xl font-bold mb-2">{t('confirm_seed_title')}</h2>
          <p className="text-slate-400 text-sm">{t('confirm_seed_desc')}</p>
        </div>

        <div className="p-8">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">{t('demo_events_preview')}</h3>
          <div className="space-y-3 mb-8">
            {demoEvents.map((event, idx) => (
              <div key={idx} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-purple-600">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{event.name}</p>
                  <p className="text-[10px] text-slate-500">{event.venue} • {event.date}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-4">
            <Button 
              variant="outline" 
              className="flex-1 h-12 rounded-xl" 
              onClick={onClose}
              disabled={loading}
            >
              {t('cancel')}
            </Button>
            <Button 
              className="flex-1 h-12 bg-purple-600 hover:bg-purple-700 rounded-xl shadow-lg shadow-purple-500/20" 
              onClick={onConfirm}
              disabled={loading}
            >
              {loading ? t('seeding') + '...' : t('seed_now')}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const LiveUpdatesView = ({ event, zones: initialZones, gates: initialGatesFetched, attendeeLocations, onBack, onEndEvent, isSidebarVisible, onToggleSidebar }: { 
  event: any, 
  zones: any[], 
  gates: any[],
  attendeeLocations: any[], 
  onBack: () => void,
  onEndEvent: (id: string) => Promise<void>,
  isSidebarVisible: boolean,
  onToggleSidebar: () => void,
  key?: string
}) => {
  const { t } = useTranslation();
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [selectedGate, setSelectedGate] = useState<any>(null);
  const [timeframe, setTimeframe] = useState<'before' | 'during' | 'after'>('during');
  const [displayZones, setDisplayZones] = useState(initialZones);
  
  const defaultGates = [
    { id: 'gate-a', label: 'GATE A', type: 'ENTRY', flowRate: 45, currentLoad: 120, status: 'OPEN' },
    { id: 'gate-b', label: 'GATE B', type: 'ENTRY', flowRate: 38, currentLoad: 95, status: 'OPEN' },
    { id: 'gate-c', label: 'GATE C', type: 'EXIT', flowRate: 0, currentLoad: 0, status: 'STANDBY' },
    { id: 'gate-d', label: 'GATE D', type: 'EXIT', flowRate: 0, currentLoad: 0, status: 'STANDBY' },
    { id: 'gate-e', label: 'GATE E', type: 'EXIT', flowRate: 0, currentLoad: 0, status: 'STANDBY' },
    { id: 'gate-n', label: 'N-SEC', type: 'EXIT', flowRate: 0, currentLoad: 0, status: 'CLOSED' },
    { id: 'gate-s', label: 'S-SEC', type: 'EXIT', flowRate: 0, currentLoad: 0, status: 'CLOSED' }
  ];
  
  const [displayGates, setDisplayGates] = useState(initialGatesFetched.length > 0 ? initialGatesFetched : defaultGates);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [sosRequests, setSosRequests] = useState<any[]>([]);
  const [intelligenceReports, setIntelligenceReports] = useState<any[]>([]);
  const [showIntel, setShowIntel] = useState(false);

  // SOS Monitoring
  useEffect(() => {
    if (!event) return;
    const q = collection(db, 'events', event.id, 'sos');
    return onSnapshot(q, (snapshot) => {
      setSosRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, [event]);

  // Intelligence Monitoring
  useEffect(() => {
    if (!event) return;
    const q = collection(db, 'events', event.id, 'intelligence');
    return onSnapshot(q, (snapshot) => {
      setIntelligenceReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).sort((a,b) => (b as any).timestamp - (a as any).timestamp));
    });
  }, [event]);

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

  // Simulation logic for 5-second telemetric flow updates
  useEffect(() => {
    if (!event?.id) return;

    const updateSimulation = async () => {
      setLastUpdate(new Date());
      
      // Use setDisplayZones with functional update to get current state and compute next
      let freshZones: any[] = [];
      let freshGates: any[] = [];

      setDisplayZones(prevZones => {
        // Fallback: If no zones yet, try to use some defaults from venue layout if available or empty
        const zonesToProcess = prevZones.length > 0 ? prevZones : initialZones;
        
        const nextZones = zonesToProcess.map(iz => {
          let simulatedCount = iz.peopleCount || 500;
          const capacity = getZoneCapacity(iz);
          
          let currentCount = iz.recordedCount !== undefined ? iz.recordedCount : simulatedCount;

          if (timeframe === 'before') {
            const influx = Math.floor(Math.random() * 80) + 20;
            currentCount = Math.min(capacity * 1.05, currentCount + influx);
          } else if (timeframe === 'during') {
            const isStanding = iz.isSeated === false || iz.id?.toLowerCase().includes('standing') || iz.id?.toLowerCase().includes('field');
            if (isStanding) {
               const shift = (Math.random() - 0.5) * capacity * 0.04;
               currentCount = Math.min(capacity * 1.05, Math.max(0, currentCount + shift));
            } else {
               const shift = (Math.random() - 0.5) * capacity * 0.005;
               currentCount = Math.min(capacity, Math.max(0, currentCount + shift));
            }
          } else if (timeframe === 'after') {
            const efflux = Math.floor(Math.random() * 100) + 50;
            currentCount = Math.max(0, currentCount - efflux);
          }

          return {
            ...iz,
            capacity,
            recordedCount: currentCount,
            peopleCount: Math.floor(currentCount),
            confidence: Math.min(0.99, Math.max(0.85, (iz.confidence || 0.9) + (Math.random() * 0.04 - 0.02)))
          };
        });
        freshZones = nextZones;
        return nextZones;
      });

      setDisplayGates(prevGates => {
        const nextGates = prevGates.map(ig => {
          let flowMultiplier = 0.2;
          let status = ig.status;
          
          if (timeframe === 'before') {
            if (ig.type === 'ENTRY') {
              flowMultiplier = 3.5;
              status = 'CROWDED';
            } else {
              flowMultiplier = 0.1;
              status = 'STANDBY';
            }
          } else if (timeframe === 'during') {
            flowMultiplier = 0.4;
            status = 'OPEN';
          } else if (timeframe === 'after') {
            if (ig.type === 'EXIT') {
              flowMultiplier = 6.0;
              status = 'CROWDED';
            } else {
              flowMultiplier = 0.05;
              status = 'RESTRICTED';
            }
          }

          const baseFlow = ig.type === 'ENTRY' ? 25 : 35;
          const randomFlux = 0.85 + Math.random() * 0.3;
          const currentFlow = Math.floor(baseFlow * flowMultiplier * randomFlux);
          
          let simulatedLoad = Math.floor(currentFlow * 1.5);
          if (timeframe === 'before' && ig.type === 'ENTRY') simulatedLoad += 350;
          if (timeframe === 'after' && ig.type === 'EXIT') simulatedLoad += 450;
          if (timeframe === 'during') simulatedLoad = 40 + Math.floor(Math.random() * 40);

          return {
            ...ig,
            flowRate: currentFlow,
            currentLoad: simulatedLoad,
            status
          };
        });
        freshGates = nextGates;
        return nextGates;
      });

      // Synchronize with Firestore
      if (freshZones.length > 0 || freshGates.length > 0) {
         try {
            const batch = writeBatch(db);
            freshZones.forEach(z => {
               const zRef = doc(db, 'events', event.id, 'zones', z.id);
               batch.set(zRef, z, { merge: true });
            });
            freshGates.forEach(g => {
               const gRef = doc(db, 'events', event.id, 'gates', g.id);
               batch.set(gRef, g, { merge: true });
            });
            await batch.commit();
         } catch (e) {
            handleFirestoreError(e, OperationType.WRITE, `events/${event.id}/simulation-sync`);
         }
      }
    };

    const interval = setInterval(updateSimulation, 5000);
    updateSimulation(); // Run once immediately
    
    return () => clearInterval(interval);
  }, [timeframe, event.id, initialZones]);

  // Sync with prop changes: only if not already simulating or mismatch
  useEffect(() => {
     if (initialZones.length > 0) setDisplayZones(initialZones);
  }, [initialZones]);

  useEffect(() => {
     if (initialGatesFetched.length > 0) setDisplayGates(initialGatesFetched);
  }, [initialGatesFetched]);
  
  // Calculate aggregate metrics
  const totalAttendees = displayZones.reduce((acc, z) => acc + (z.peopleCount || 0), 0);
  const totalCrews = Math.floor(totalAttendees * 0.05) + 12; 
  const avgConfidence = displayZones.reduce((acc, z) => acc + (z.confidence * 100 || 0), 0) / (displayZones.length || 1);
  
  const totalCapacity = displayZones.reduce((acc, z) => acc + getZoneCapacity(z), 0);
  const estimatedDensity = event.ticketAmount 
    ? (totalAttendees / parseInt(event.ticketAmount)) * 100 
    : (totalCapacity ? (totalAttendees / totalCapacity) * 100 : 0);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex flex-col bg-slate-900 overflow-hidden font-sans"
    >
       {/* Dark Header */}
       <header className="bg-slate-900/50 backdrop-blur-xl border-b border-white/5 px-8 py-4 flex justify-between items-center z-40 shrink-0">
         <div className="flex items-center gap-6">
						{!isSidebarVisible && (
							<Button 
								variant="ghost" 
								size="icon" 
								onClick={onToggleSidebar}
								className="hidden lg:flex text-white hover:bg-white/10 rounded-xl"
							>
								<Menu className="h-6 w-6" />
							</Button>
						)}
           <Button 
             variant="ghost" 
             size="sm" 
             onClick={onBack} 
             className="text-white/40 hover:text-white hover:bg-white/5 rounded-2xl h-11 w-11 p-0 flex items-center justify-center border border-white/5"
           >
             <ChevronDown className="h-6 w-6 rotate-90" />
           </Button>
           <div className="h-10 w-px bg-white/5" />
           <div>
             <h2 className="text-2xl font-black text-white tracking-tighter leading-none">{event.name}</h2>
             <p className="text-[10px] text-white/30 flex items-center gap-1 font-bold uppercase tracking-widest mt-1.5">
               <MapIcon className="h-3 w-3" /> {event.venue} • {t('live_intelligence')}
             </p>
           </div>
         </div>
         
          <div className="hidden lg:flex items-center gap-16 border-x border-white/5 px-16">
            <div className="flex flex-col items-center">
               <p className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em] mb-2">{t('crowd_density')}</p>
               <div className="flex items-center gap-2">
                 <p className="text-2xl font-black text-white tabular-nums">{estimatedDensity.toFixed(1)}%</p>
                 <Activity className={`h-4 w-4 ${estimatedDensity > 90 ? 'text-red-500' : 'text-green-500'}`} />
               </div>
            </div>
            <div className="flex flex-col items-center">
               <p className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em] mb-2">{t('crew_code')}</p>
               <p className="text-2xl font-black text-blue-400 font-mono tracking-wider">{event.eventCode}</p>
            </div>
            <div className="flex flex-col items-center">
               <p className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em] mb-2">{t('total_crowd')}</p>
               <p className="text-2xl font-black text-white tabular-nums">{totalAttendees.toLocaleString()}</p>
            </div>
          </div>

         <div className="flex items-center gap-4">
            {/* Timeframe Demo Controller */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-1 flex gap-1 mr-4">
               {[
                 { id: 'before', label: t('pre_event') },
                 { id: 'during', label: t('during') },
                 { id: 'after', label: t('post_event') }
               ].map((tf) => (
                 <button
                   key={tf.id}
                   onClick={() => setTimeframe(tf.id as any)}
                   className={`px-4 py-2 rounded-xl text-[9px] font-black transition-all ${
                     timeframe === tf.id 
                       ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                       : 'text-white/40 hover:text-white/60'
                   }`}
                 >
                   {tf.label}
                 </button>
               ))}
            </div>

           {!event.isEnded && (
             <Button 
               variant="destructive" 
               size="sm" 
               className="h-11 px-8 rounded-2xl bg-red-600 hover:bg-red-700 shadow-xl shadow-red-500/20 font-black text-xs uppercase tracking-wider text-black" 
               onClick={() => onEndEvent(event.id)}
             >
               {t('terminate_session')}
             </Button>
           )}
           <Button variant="ghost" size="icon" onClick={onBack} className="text-white/20 hover:text-white h-11 w-11 hover:bg-white/5 rounded-2xl">
              <XCircle className="h-7 w-7" />
           </Button>
         </div>
       </header>

       {/* Map View Layout */}
       <div className="flex-1 flex overflow-hidden relative">
          {/* Main Visualizer Area */}
          <div className={`flex-1 flex flex-col transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1) ${(selectedZone || selectedGate) ? 'lg:pr-[450px]' : ''}`}>
             <div className="flex-1 flex items-center justify-center p-4 lg:p-24 overflow-hidden relative">
                {/* Background Grid Pattern */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_20%,transparent_100%)] pointer-events-none" />
                
                <div className="w-full h-full max-w-7xl relative flex items-center justify-center">
                   <motion.div 
                     layout
                     className="w-full h-full relative" 
                     animate={{ scale: (selectedZone || selectedGate) ? 1.1 : 1.3 }}
                     transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                   >
                      <CrowdMap 
                        zones={displayZones} 
                        gatesData={displayGates}
                        timeframe={timeframe}
                        attendeeLocations={attendeeLocations}
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
                        backgroundUrl={event.backgroundUrl}
                      />
                   </motion.div>
                </div>
             </div>
          </div>
             
             {/* Compact High Contrast Banner (Bottom Left) */}
             <div className="absolute bottom-6 left-6 pointer-events-none z-30">
                <motion.div 
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  className="bg-slate-950/95 backdrop-blur-3xl border border-white/10 p-3.5 rounded-2xl shadow-2xl flex items-center gap-4 border-l-4 border-l-blue-500"
                >
                   <div className="space-y-0.5">
                      <div className="text-[8px] text-blue-400 font-black uppercase tracking-[0.3em] flex items-center gap-1.5">
                        <div className="w-1 h-1 rounded-full bg-blue-500 animate-pulse" />
                        {t('active_area')}
                      </div>
                      <h4 className="text-sm font-black text-white uppercase tracking-tighter">{event.venue || 'Unifi Arena'}</h4>
                   </div>
                   <div className="h-6 w-px bg-white/10 mx-1" />
                   <div className="flex gap-4">
                      {['stable', 'vigilant', 'critical'].map((status) => (
                         <div key={status} className="flex flex-col items-center gap-1 opacity-20">
                            <div className={`w-1.5 h-1.5 rounded-full ${
                              status === 'stable' ? 'bg-green-500' : status === 'vigilant' ? 'bg-yellow-500' : 'bg-red-500'
                            }`} />
                            <span className="text-[6px] text-white font-black">{t(status).charAt(0)}</span>
                         </div>
                      ))}
                   </div>
                </motion.div>
             </div>

             {/* Bottom Right Info */}
              <div className="absolute bottom-12 right-12 text-right pointer-events-none flex flex-col items-end gap-4 text-white">
                 {/* Intelligence Toggle */}
                 <Button 
                   variant="ghost" 
                   className="pointer-events-auto h-auto p-4 rounded-3xl bg-slate-900/40 backdrop-blur-3xl border border-white/5 flex items-center gap-3 group hover:bg-slate-900/60 shadow-2xl"
                   onClick={() => setShowIntel(!showIntel)}
                 >
                   <div className="relative">
                      <FileText className="h-5 w-5 text-blue-400 group-hover:scale-110 transition-transform" />
                      {intelligenceReports.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-slate-950" />
                      )}
                   </div>
                   <div className="text-left">
                      <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">{t('intelligence_feed')}</p>
                      <p className="text-[10px] font-bold text-white uppercase">{intelligenceReports.length} {t('reports').toUpperCase()}</p>
                   </div>
                 </Button>

                 <div>
                    <p className="text-[9px] text-white/20 font-mono">ENCRYPTED DATA FEED :: v4.0.2</p>
                    <p className="text-[10px] text-white/40 font-bold mt-1 tracking-widest uppercase">{t('crowdguard_intelligence_engine')}</p>
                 </div>
              </div>

              {/* Intelligence Overlay (Manager Side) */}
              <AnimatePresence>
                {showIntel && (
                  <motion.div 
                    initial={{ scale: 0.9, opacity: 0, x: 20, y: 20 }}
                    animate={{ scale: 1, opacity: 1, x: 0, y: 0 }}
                    exit={{ scale: 0.9, opacity: 0, x: 20, y: 20 }}
                    className="absolute bottom-32 right-12 w-80 bg-slate-950/95 backdrop-blur-3xl border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden z-50 pointer-events-auto"
                  >
                    <div className="p-5 border-b border-white/5 flex justify-between items-center bg-blue-500/5">
                       <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-blue-500" />
                          <h4 className="text-xs font-black text-white uppercase tracking-widest">{t('venue_intelligence')}</h4>
                       </div>
                       <Button variant="ghost" size="icon" className="h-6 w-6 text-white/40 hover:text-white" onClick={() => setShowIntel(false)}>
                          <X className="h-4 w-4" />
                       </Button>
                    </div>
                    <div className="p-5 space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar">
                       {intelligenceReports.length > 0 ? (
                         intelligenceReports.map((report) => (
                           <div key={report.id} className="p-3.5 rounded-2xl bg-white/5 border border-white/5 hover:border-blue-500/30 transition-colors shadow-sm">
                              <div className="flex justify-between items-start mb-2 text-white/30">
                                 <span className="text-[8px] font-black uppercase tracking-tighter text-blue-500">{report.source}</span>
                                 <span className="text-[8px] font-medium">{new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              </div>
                              <p className="text-[11px] text-white/80 font-medium leading-relaxed">{report.message}</p>
                           </div>
                         ))
                       ) : (
                         <div className="text-center py-10 opacity-20">
                            <Activity className="h-8 w-8 mx-auto mb-2 text-white" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-white">No Active Intel</p>
                         </div>
                       )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

           {/* Right Floating Panel: Live Zone Intelligence */}
           <AnimatePresence>
              {(selectedZone || selectedGate) && (
                 <motion.div 
                    initial={{ x: 500, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 500, opacity: 0 }}
                    transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                    className="absolute inset-x-0 bottom-0 top-auto h-[80vh] lg:top-6 lg:bottom-6 lg:right-6 lg:left-auto lg:h-auto w-full lg:w-[380px] bg-slate-900/95 lg:bg-slate-800/80 backdrop-blur-3xl border-t lg:border-t-0 lg:border border-white/5 rounded-t-3xl lg:rounded-[2.5rem] shadow-[0_-40px_100px_rgba(0,0,0,0.8)] lg:shadow-[0_40px_100px_rgba(0,0,0,0.8)] z-50 flex flex-col overflow-hidden"
                 >
                    {/* Top Accent Bar */}
                    <div className="h-1.5 w-full bg-gradient-to-r from-purple-600 via-blue-500 to-green-500" />
                    
                    <div className="p-6 pb-4 border-b border-white/5">
                        <div className="flex justify-between items-center mb-1">
                           <div className="flex items-center gap-2">
                              {selectedGate ? <Navigation className="h-5 w-5 text-blue-500" /> : <Activity className="h-5 w-5 text-blue-500" />}
                              <h2 className="text-xl font-black text-white italic tracking-wider uppercase">
                                 {selectedGate ? 'GATE INTELLIGENCE' : 'ZONE INTELLIGENCE'}
                              </h2>
                           </div>
                           <Button 
                             variant="ghost" 
                             size="icon" 
                             onClick={() => {
                               setSelectedZone(null);
                               setSelectedGate(null);
                             }} 
                             className="text-white/40 hover:text-white h-7 w-7 hover:bg-white/5 rounded-full transition-all"
                           >
                              <X className="h-4 w-4" />
                           </Button>
                        </div>
                        <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest pl-7">
                           ANALYZING {selectedGate ? 'ACCESS POINT' : (selectedZone?.name ? selectedZone.name.replace(/\s*\(.*?\)/g, '').replace(/\s+(north|south|east|west)/gi, '').trim().toUpperCase() : 'SECTOR')}
                        </p>
                     </div>

                     <div className="flex-1 px-6 pb-6 space-y-6 flex flex-col overflow-y-auto mt-2">
                       {(() => {
                          if (selectedGate) {
                            const gd = displayGates.find(g => g.id === selectedGate.id) || selectedGate;
                            const capacityUsage = Math.min(Math.round((gd.currentLoad / 300) * 100), 100);
                            const isCritical = capacityUsage > 80;
                            const isVigilant = capacityUsage > 50;

                            return (
                              <>
                                {/* Gate Metric Grid */}
                                <div className="grid grid-cols-2 gap-3">
                                   <div className="bg-white/5 rounded-2xl p-4 border border-white/5 group hover:bg-white/10 transition-colors">
                                      <Navigation className="h-4 w-4 text-green-400 mb-2" />
                                      <p className="text-[8px] text-white/30 font-black uppercase tracking-widest mb-1">{t('flow_rate')}</p>
                                      <div className="flex items-baseline gap-1">
                                          <p className="text-2xl font-black text-white">{gd.flowRate}</p>
                                          <span className="text-white/20 text-[8px] font-bold leading-none">{t('people_per_min').toUpperCase()}</span>
                                      </div>
                                   </div>
                                   <div className="bg-white/5 rounded-2xl p-4 border border-white/5 group hover:bg-white/10 transition-colors">
                                      <Users className="h-4 w-4 text-blue-400 mb-2" />
                                      <p className="text-[8px] text-white/30 font-black uppercase tracking-widest mb-1">{t('entry_traffic')}</p>
                                      <div className="flex items-baseline gap-1">
                                          <p className="text-2xl font-black text-white">{gd.currentLoad}</p>
                                          <span className="text-white/20 text-[8px] font-bold leading-none">{t('total_capacity').toUpperCase()}</span>
                                      </div>
                                   </div>
                                </div>

                                {/* Flow Intensity Gauge */}
                                <div className="space-y-4 bg-white/5 rounded-[1.5rem] p-6 border border-white/5">
                                   <div className="flex justify-between items-end">
                                      <div>
                                         <p className="text-[8px] text-white/30 font-black uppercase tracking-widest mb-0.5">{t('gate_pressure')}</p>
                                         <h4 className="text-lg font-black text-white tracking-tight">{t('zone_occupancy')}</h4>
                                      </div>
                                      <div className="text-right">
                                         <div className={`text-3xl font-black tabular-nums transition-colors ${
                                           isCritical ? 'text-red-500' : isVigilant ? 'text-yellow-500' : 'text-green-500'
                                         }`}>{capacityUsage}%</div>
                                      </div>
                                   </div>
                                   <div className="relative h-2.5">
                                      <div className="absolute inset-0 bg-white/5 rounded-full overflow-hidden border border-white/10">
                                         <motion.div 
                                            initial={{ width: 0 }}
                                            animate={{ width: `${capacityUsage}%` }}
                                            transition={{ duration: 1, ease: "easeOut" }}
                                            className={`h-full rounded-full ${
                                               isCritical ? 'bg-red-500' : isVigilant ? 'bg-yellow-500' : 'bg-green-500'
                                            }`}
                                         />
                                      </div>
                                   </div>
                                   <div className="flex justify-between items-center text-[7px] font-black tracking-[0.2em] opacity-40">
                                      <span className={isCritical ? 'text-red-500 opacity-100' : ''}>CRITICAL</span>
                                      <span className={isVigilant && !isCritical ? 'text-yellow-500 opacity-100' : ''}>VIGILANT</span>
                                      <span className={!isVigilant ? 'text-green-500 opacity-100' : ''}>SAFE</span>
                                   </div>
                                </div>

                                {/* AI Predictions for Gate */}
                                <div className="space-y-4">
                                   <h4 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{t('gate_flow_trends')}</h4>
                                   <div className="space-y-2.5">
                                      {[
                                        { action: t('est_wait', { mins: Math.floor(gd.currentLoad / (gd.flowRate || 10)) }), icon: <Clock className="h-3 w-3" />, color: 'text-blue-400' },
                                        { action: timeframe === 'after' ? t('best_exit_route') : t('streamlined_entry'), icon: <Navigation className="h-3 w-3" />, color: 'text-purple-400' },
                                        { action: t('security_sync_active'), icon: <Shield className="h-3 w-3" />, color: 'text-green-400' }
                                      ].map((log, i) => (
                                        <motion.div 
                                           key={i}
                                           initial={{ opacity: 0, x: 20 }}
                                           animate={{ opacity: 1, x: 0 }}
                                           className="flex items-center gap-3 p-3.5 bg-white/5 rounded-2xl border border-white/5"
                                        >
                                           <div className={`p-1.5 rounded-lg bg-white/5 ${log.color}`}>{log.icon}</div>
                                           <span className="text-[11px] text-white/80 font-bold tracking-tight">{log.action}</span>
                                        </motion.div>
                                      ))}
                                   </div>
                                </div>
                              </>
                            );
                          }

                          const zd = displayZones.find(z => z.id === selectedZone.id) || selectedZone;
                           const density = Math.min(Math.round((zd.peopleCount / getZoneCapacity(zd)) * 100), 100);
                           
                           return (
                              <div className="space-y-8">
                                 <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-800/80 rounded-3xl p-6 border border-white/5">
                                       <p className="text-[10px] text-white/50 font-black uppercase tracking-widest mb-2">Live Population</p>
                                       <p className="text-4xl font-black text-white px-1">{zd.peopleCount.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-slate-800/80 rounded-3xl p-6 border border-white/5">
                                       <p className="text-[10px] text-white/50 font-black uppercase tracking-widest mb-2">Max Capacity</p>
                                       <p className="text-4xl font-black text-white/40 px-1">{getZoneCapacity(zd).toLocaleString()}</p>
                                    </div>
                                 </div>

                                 <div className="space-y-4">
                                    <div className="flex justify-between items-center px-1">
                                       <h4 className="text-[11px] font-black text-white italic tracking-widest uppercase pb-1">Density Index</h4>
                                       <span className="text-sm font-black text-blue-400">{density.toFixed(1)}%</span>
                                    </div>
                                    <div className="relative h-[6px] w-full mt-1">
                                       <div className="absolute inset-0 bg-slate-800 rounded-full border border-white/5 overflow-hidden">
                                          <div style={{ width: `${density}%`, transition: 'width 1s ease-out' }} className="h-full rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />
                                       </div>
                                    </div>
                                 </div>

                                 <div className="space-y-4 mt-2">
                                    <h4 className="text-[11px] font-black text-white italic tracking-widest uppercase px-1">Team Composition</h4>
                                    <div className="space-y-3">
                                       <div className="flex justify-between items-center bg-[#0a1631]/80 border border-blue-900/50 rounded-[2rem] px-5 py-4">
                                          <div className="flex items-center gap-3">
                                             <div className="rounded-full bg-blue-500 inline-block h-3 w-3" />
                                             <span className="text-[11px] font-black text-white uppercase tracking-widest">Attendees</span>
                                          </div>
                                          <span className="text-sm font-bold text-blue-400">{Math.floor(zd.peopleCount * 0.95).toLocaleString()} people</span>
                                       </div>
                                       
                                       <div className="flex justify-between items-center bg-[#251000]/80 border border-orange-900/50 rounded-[2rem] px-5 py-4">
                                          <div className="flex items-center gap-3">
                                             <div className="rounded-full bg-[#EA580C] inline-block h-3 w-3" />
                                             <span className="text-[11px] font-black text-white uppercase tracking-widest">Service Crew</span>
                                          </div>
                                          <span className="text-sm font-bold text-[#EA580C]">{Math.ceil(zd.peopleCount * 0.05).toLocaleString()} people</span>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           );
                        })()}
                    </div>


                 </motion.div>
              )}
           </AnimatePresence>
       </div>
    </motion.div>
  );
};

// --- Main Dashboard ---

// --- Standalone Sidebar Component ---

interface SidebarProps {
  isVisible: boolean;
  onHide: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenSettings?: () => void;
  onBack?: () => void;
  t: (key: string) => string;
}

function ManagerSidebar({ isVisible, onHide, activeTab, setActiveTab, onOpenSettings, onBack, t }: SidebarProps) {
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
              <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
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
            <SidebarLink 
              icon={LayoutDashboard} 
              label={t('overview')} 
              active={activeTab === 'dashboard'} 
              onClick={() => setActiveTab('dashboard')} 
            />
            <SidebarLink 
              icon={Settings} 
              label={t('settings')} 
              onClick={onOpenSettings} 
            />
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

export function ManagerDashboard({ onBack, userData, onOpenSettings }: { onBack?: () => void, userData?: any, onOpenSettings?: () => void }) {
  const { t } = useTranslation();
  const [events, setEvents] = useState<any[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const [attendeeLocations, setAttendeeLocations] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [gates, setGates] = useState<any[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<any>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<{id: string, text: string, time: string}[]>([]);
  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard'>('dashboard');
  const [isSidebarVisible, setIsSidebarVisible] = useState(true);
  const [venueLayouts, setVenueLayouts] = useState<any[]>([]);

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      await seedDemoData();
      toast.success(t('demo_seeded_success'));
      setIsSeedModalOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setIsSeeding(false);
    }
  };

  useEffect(() => {
    if (!auth.currentUser) return;
    
    // Listen to events
    const qEvents = query(
      collection(db, 'events'), 
      or(
        where('managerId', '==', auth.currentUser.uid),
        where('isDemo', '==', true)
      )
    );
    
    const unsubscribeEvents = onSnapshot(qEvents, (snapshot) => {
      setEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Events fetch error:", error);
    });

    // Listen to venue layouts
    const unsubscribeLayouts = onSnapshot(collection(db, 'venueLayouts'), (snapshot) => {
      setVenueLayouts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Venue layouts fetch error:", error);
    });

    // Listen to notifications
    const qNotifs = query(
      collection(db, 'notifications'),
      where('managerId', '==', auth.currentUser.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribeNotifs = onSnapshot(qNotifs, (snapshot) => {
      const newNotifs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setNotifications(newNotifs.map((n: any) => ({
        id: n.id,
        text: n.text,
        time: n.timestamp?.seconds ? new Date(n.timestamp.seconds * 1000).toLocaleTimeString() : 'Just now',
        senderName: n.senderName,
        senderPosition: n.senderPosition,
        eventName: n.eventName
      })));

      // Trigger toast for new notifications (only if NOT initial load and it's an 'added' type)
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" && !snapshot.metadata.fromCache) {
          const data = change.doc.data();
          // We can check if the timestamp is very recent to avoid toasting old history on first load
          const isRecent = data.timestamp?.seconds && (Date.now() / 1000 - data.timestamp.seconds < 30);
          
          if (isRecent) {
             toast(`New message from ${data.senderName}`, {
               description: `${data.senderPosition} in ${data.eventName}: ${data.text.substring(0, 50)}...`,
               icon: <Bell className="h-4 w-4" />
             });
          }
        }
      });
    }, (error) => {
      console.error("Notifications fetch error:", error);
    });

    return () => {
      unsubscribeEvents();
      unsubscribeLayouts();
      unsubscribeNotifs();
    };
  }, [auth.currentUser?.uid, t]);

  useEffect(() => {
    if (!selectedEvent) return;
    const q = query(collection(db, 'locations'), where('eventId', '==', selectedEvent.id));
    const unsubscribeLocations = onSnapshot(q, (snapshot) => {
      setAttendeeLocations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'locations');
    });

    const zonesQ = collection(db, 'events', selectedEvent.id, 'zones');
    const unsubscribeZones = onSnapshot(zonesQ, (snapshot) => {
      setZones(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `events/${selectedEvent.id}/zones`);
    });

    const gatesQ = collection(db, 'events', selectedEvent.id, 'gates');
    const unsubscribeGates = onSnapshot(gatesQ, (snapshot) => {
      setGates(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `events/${selectedEvent.id}/gates`);
    });

    return () => {
      unsubscribeLocations();
      unsubscribeZones();
      unsubscribeGates();
    };
  }, [selectedEvent]);

  const handleEndEvent = async (eventId: string) => {
    try {
      await updateDoc(doc(db, 'events', eventId), {
        isOngoing: false,
        isEnded: true,
        exitGuidanceActive: true
      });
      toast.success(t('event_ended_success'));
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, `events/${eventId}`);
      toast.error(e.message);
    }
  };

  const handleDeleteEvent = async () => {
    if (!eventToDelete) return;
    setDeleteLoading(true);
    try {
      await deleteDoc(doc(db, 'events', eventToDelete.id));
      toast.success(t('event_deleted_success'));
      setEventToDelete(null);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.DELETE, `events/${eventToDelete.id}`);
      toast.error(e.message);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex relative w-full overflow-x-hidden">
      <ManagerSidebar 
        isVisible={isSidebarVisible}
        onHide={() => setIsSidebarVisible(false)}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenSettings={onOpenSettings}
        onBack={onBack}
        t={t}
      />

      {!isSidebarVisible && (
        <div className="lg:block hidden">
          {/* Handled in headers */}
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-auto relative">
        <div className="bg-red-500 text-white text-xs p-1 absolute top-0 right-0 z-[9999]">MANAGER CONSOLE ACTIVE</div>
        {selectedEvent ? (
          <LiveUpdatesView 
            key="live-updates"
            event={selectedEvent} 
            zones={zones} 
            gates={gates}
            attendeeLocations={attendeeLocations}
            onBack={() => setSelectedEvent(null)}
            onEndEvent={handleEndEvent}
            isSidebarVisible={isSidebarVisible}
            onToggleSidebar={() => setIsSidebarVisible(true)}
          />
        ) : (
          <div key="overview">
            <header className="bg-white/80 backdrop-blur-md border-b px-8 py-6 flex justify-between items-center sticky top-0 z-30">
                <div className="flex items-center gap-4">
                  {!isSidebarVisible && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setIsSidebarVisible(true)}
                      className="flex mr-2 text-slate-600 hover:bg-slate-100 rounded-xl"
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
                    <h2 className="text-2xl font-bold text-slate-900">{t('manager_console')}</h2>
                    <p className="text-slate-500 text-sm">{t('welcome')}, {userData?.username || auth.currentUser?.email?.split('@')[0]}</p>
                  </div>
                </div>
                <div className="flex gap-3">
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
                              notifications.map((notif: any) => (
                                <div key={notif.id} className="p-4 border-b hover:bg-slate-50 transition-colors">
                                  <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[10px] font-black text-purple-600 uppercase tracking-wider">{notif.eventName}</span>
                                      <span className="text-[10px] text-slate-400">{notif.time}</span>
                                    </div>
                                    <p className="text-sm font-bold text-slate-900">{notif.senderName} <span className="text-[10px] font-medium text-slate-400 capitalize">({notif.senderPosition})</span></p>
                                    <p className="text-sm text-slate-600 line-clamp-2 mt-1 italic">"{notif.text}"</p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <Button 
                    variant="outline" 
                    className="h-12 px-6 rounded-xl border-slate-200"
                    onClick={() => setIsSeedModalOpen(true)}
                    disabled={isSeeding}
                  >
                    <Database className="mr-2 h-5 w-5 text-slate-500" />
                    {isSeeding ? t('seeding') + '...' : t('seed_demo_data')}
                  </Button>
                  <Button className="bg-purple-600 hover:bg-purple-700 h-12 px-6 rounded-xl shadow-lg shadow-purple-500/20" onClick={() => setIsCreateModalOpen(true)}>
                    <Plus className="mr-2 h-5 w-5" /> {t('create_event')}
                  </Button>
                </div>
              </header>

              <div className="p-8 space-y-8 max-w-7xl mx-auto">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <StatCard label={t('live_attendees')} value={attendeeLocations.length.toString()} change="+12%" icon={Users} color="text-blue-600" />
                  <StatCard label={t('active_events')} value={events.filter(e => e.isOngoing).length.toString()} icon={CheckCircle2} color="text-green-600" />
                  <StatCard label={t('pending_approval')} value={events.filter(e => e.status === 'pending').length.toString()} icon={Clock} color="text-orange-600" />
                  <StatCard label={t('total_revenue')} value="$12.4k" icon={CreditCard} color="text-purple-600" />
                </div>

                {/* Events List */}
                <section className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <FileText className="h-5 w-5 text-slate-400" />
                      {t('your_registered_events')}
                    </h3>
                  </div>
                  
                  {events.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-[2rem] border-2 border-dashed border-slate-200">
                      <Database className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                      <h4 className="text-xl font-bold text-slate-900 mb-2">{t('no_events_yet')}</h4>
                      <p className="text-slate-500 mb-8 max-w-sm mx-auto">{t('no_events_desc')}</p>
                      <div className="flex justify-center gap-4">
                        <Button 
                          className="bg-purple-600 hover:bg-purple-700 h-12 px-8 rounded-xl"
                          onClick={() => setIsCreateModalOpen(true)}
                        >
                          <Plus className="mr-2 h-5 w-5" /> {t('create_event')}
                        </Button>
                        <Button 
                          variant="outline"
                          className="h-12 px-8 rounded-xl border-slate-200"
                          onClick={() => setIsSeedModalOpen(true)}
                          disabled={isSeeding}
                        >
                          <Database className="mr-2 h-5 w-5" />
                          {isSeeding ? t('seeding') + '...' : t('seed_demo_data')}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {events.map(event => (
                        <Card 
                          key={event.id} 
                          className={`overflow-hidden border-none shadow-md hover:shadow-xl transition-all group ${event.status === 'successful' ? 'cursor-pointer hover:ring-2 hover:ring-purple-500/20' : ''}`}
                          onClick={() => event.status === 'successful' && setSelectedEvent(event)}
                        >
                          <CardHeader className="pb-4">
                            <div className="flex justify-between items-start">
                              <div className="flex gap-2">
                                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  event.status === 'successful' ? 'bg-green-100 text-green-700' : 
                                  event.status === 'pending' ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {event.status}
                                </div>
                                {event.isDemo && (
                                  <div className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-600 text-white shadow-lg shadow-blue-500/20">
                                    DEMO
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2 items-center">
                                {event.status === 'successful' && (
                                  <div className="text-[10px] font-mono bg-slate-100 px-2 py-1 rounded text-slate-500">
                                    CODE: {event.eventCode}
                                  </div>
                                )}
                                {(event.managerId === auth.currentUser?.uid || event.isDemo) && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEventToDelete(event);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                            <CardTitle className="text-xl mt-4 group-hover:text-purple-600 transition-colors">{event.name}</CardTitle>
                            <CardDescription>
                              <div className="flex flex-col gap-1 mt-1">
                                <div className="flex items-center gap-1.5 text-xs">
                                  <Clock className="h-3 w-3" />
                                  {event.date} {event.startTime && `• ${event.startTime}`} • {event.duration} {t('hours')}
                                </div>
                                <div className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                                  <MapIcon className="h-3 w-3" />
                                  {event.venue || 'No venue specified'}
                                </div>
                              </div>
                            </CardDescription>
                          </CardHeader>
                        <CardContent className="space-y-4">
                          {event.status === 'successful' && (
                            <div className="flex gap-2">
                              {!event.isEnded ? (
                                <Button 
                                  variant="destructive" 
                                  size="sm" 
                                  className="w-full rounded-xl shadow-lg shadow-red-500/10" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEndEvent(event.id);
                                  }}
                                >
                                  {t('end_event')}
                                </Button>
                              ) : (
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  className="w-full text-red-600 border-red-200 hover:bg-red-50 rounded-xl" 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEventToDelete(event);
                                  }}
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> {t('delete')}
                                </Button>
                              )}
                            </div>
                          )}
                          {event.status === 'pending' && (
                            <div className="space-y-3" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center gap-2 text-xs text-orange-600 bg-orange-50 p-3 rounded-xl border border-orange-100">
                                <AlertCircle className="h-4 w-4 shrink-0" />
                                {t('verification_in_progress_desc')}
                              </div>
                              <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full text-slate-500 hover:text-red-600 hover:bg-red-50" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEventToDelete(event);
                                }}
                              >
                                {t('cancel')} {t('registration')}
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        )}
      </main>

      <CreateEventModal 
        isOpen={isCreateModalOpen} 
        onClose={() => setIsCreateModalOpen(false)} 
        venueLayouts={venueLayouts}
      />
      
      <DeleteConfirmModal 
        isOpen={!!eventToDelete}
        onClose={() => setEventToDelete(null)}
        onConfirm={handleDeleteEvent}
        eventName={eventToDelete?.name || ''}
        loading={deleteLoading}
      />

      <SeedDemoModal 
        isOpen={isSeedModalOpen}
        onClose={() => setIsSeedModalOpen(false)}
        onConfirm={handleSeed}
        loading={isSeeding}
      />
    </div>
  );
}

function SidebarLink({ icon: Icon, label, active, onClick }: any) {
  return (
    <a 
      href="#" 
      onClick={(e) => {
        e.preventDefault();
        if (onClick) onClick();
      }}
      className={`flex items-center gap-3 px-4 py-4 rounded-2xl transition-all duration-300 ${active ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
    >
      <Icon className="h-5 w-5" />
      <span className="font-bold text-sm">{label}</span>
    </a>
  );
}

function StatCard({ label, value, change, icon: Icon, color }: any) {
  return (
    <Card className="border-none shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex justify-between items-start">
          <div className={`w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center ${color}`}>
            <Icon className="h-5 w-5" />
          </div>
          {change && <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">{change}</span>}
        </div>
        <div className="mt-4">
          <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{label}</p>
          <p className="text-3xl font-black text-slate-900 mt-1">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
