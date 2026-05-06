import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, 
  query, 
  where,
  orderBy, 
  onSnapshot, 
  addDoc, 
  setDoc,
  doc,
  serverTimestamp,
  getDocs,
  limit
} from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  MessageCircle, 
  X, 
  Send, 
  ChevronLeft,
  User,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

import { useTranslation } from 'react-i18next';

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderType: 'attendee' | 'crew';
  timestamp: any;
}

interface FloatingChatProps {
  eventId: string;
  userRole: 'attendee' | 'crew' | 'manager';
  selectedUserId?: string | null; // Allow parent to force a user chat
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
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
  return new Error(JSON.stringify(errInfo));
}

export const FloatingChat: React.FC<FloatingChatProps> = ({ eventId, userRole, selectedUserId }) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeChatUserId, setActiveChatUserId] = useState<string | null>(
    userRole === 'attendee' ? auth.currentUser?.uid || null : null
  );
  
  const lastCheckedTime = useRef<number>(Date.now());
  const initialLoad = useRef(true);

  // Sync with selectedUserId from parent
  useEffect(() => {
    if (selectedUserId) {
      setActiveChatUserId(selectedUserId);
      setIsOpen(true);
      setUnreadCount(0);
    }
  }, [selectedUserId]);

  const [chatUsers, setChatUsers] = useState<any[]>([]); // List of attendees who messaged (for crew)
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
    }
  }, [messages, isOpen, activeChatUserId]);

  // Reset unread count when opening chat
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      lastCheckedTime.current = Date.now();
    }
  }, [isOpen]);

  // Background listener for notifications
  useEffect(() => {
    if (!eventId) return;

    let q;
    if (userRole === 'attendee') {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      q = query(
        collection(db, 'events', eventId, 'chats', uid, 'messages'),
        where('senderType', '==', 'crew'),
        orderBy('timestamp', 'desc'),
        limit(1)
      );
    } else {
      // For crew/manager, monitor the chats collection for ANY new messages from attendees
      // Since collection group query might be restricted, we monitor the SOS list which gets updated by lastMessage/lastTimestamp
      q = query(
        collection(db, 'events', eventId, 'sos'),
        where('status', 'in', ['pending', 'assigned', 'arrived']),
        orderBy('timestamp', 'desc'),
        limit(5)
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (initialLoad.current) {
        initialLoad.current = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' || change.type === 'modified') {
          const data = change.doc.data();
          const timestamp = data.timestamp?.toMillis() || Date.now();
          
          // If message is newer than last checked and chat is closed (or viewing another chat for crew)
          if (timestamp > lastCheckedTime.current) {
            if (userRole === 'attendee') {
              if (!isOpen) {
                setUnreadCount(prev => prev + 1);
                toast.info(t('new_message'), {
                  description: data.text?.substring(0, 40) + (data.text?.length > 40 ? '...' : ''),
                  action: {
                    label: t('view'),
                    onClick: () => setIsOpen(true)
                  }
                });
              }
            } else {
              // Crew logic: check if the last message was NOT from a crew member
              // This is a heuristic since 'sos' doc might not have 'senderType' directly in the summary
              // but we can assume if timestamp updated, someone messaged.
              // We check if we are NOT currently looking at this specific chat
              if (!isOpen || activeChatUserId !== data.userId) {
                setUnreadCount(prev => prev + 1);
                toast.info(`${t('new_message_from')} ${data.attendeeName || t('attendee')}`, {
                   description: data.lastMessage?.substring(0, 40) + (data.lastMessage?.length > 40 ? '...' : ''),
                   action: {
                     label: t('view'),
                     onClick: () => {
                       setActiveChatUserId(data.userId);
                       setIsOpen(true);
                     }
                   }
                });
              }
            }
          }
        }
      });
    });

    return () => unsubscribe();
  }, [eventId, userRole, isOpen, activeChatUserId, t]);

  // Listener for messages
  useEffect(() => {
    if (!eventId || !activeChatUserId || !isOpen) return;

    const path = `events/${eventId}/chats/${activeChatUserId}/messages`;
    try {
      const q = query(
        collection(db, 'events', eventId, 'chats', activeChatUserId, 'messages'),
        orderBy('timestamp', 'asc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      });

      return () => unsubscribe();
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }
  }, [eventId, activeChatUserId, isOpen]);

  // Listener for active chats (for crew)
  useEffect(() => {
    if (userRole === 'attendee' || !isOpen || !eventId) return;

    const path = `events/${eventId}/sos`;
    try {
      const q = query(
        collection(db, 'events', eventId, 'sos'),
        where('status', 'in', ['pending', 'assigned', 'arrived']),
        orderBy('timestamp', 'desc')
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const activeSos = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: data.userId, // Link to attendee's chat
            attendeeName: data.attendeeName || `${t('attendee')} ${data.userId?.slice(0, 5)}`,
            category: data.category,
            status: data.status,
            severity: data.severity,
            lastTimestamp: data.timestamp,
            lastMessage: data.category ? `${t(data.category)} ${t('help')}` : ""
          };
        });
        setChatUsers(activeSos);

        // If we are viewing a chat that is no longer in the active SOS list, go back to list (for crew)
        // Only if it wasn't explicitly selected by parent
        if (userRole === 'crew' && activeChatUserId && !selectedUserId && !activeSos.find(s => s.id === activeChatUserId)) {
          setActiveChatUserId(null);
        }
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      });

      return () => unsubscribe();
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }
  }, [eventId, userRole, isOpen, activeChatUserId, selectedUserId]);

  const sendMessage = async () => {
    const textToSend = inputText.trim();
    if (!textToSend || !activeChatUserId || !eventId || loading) return;

    setLoading(true);
    const messagePath = `events/${eventId}/chats/${activeChatUserId}/messages`;
    const chatPath = `events/${eventId}/chats/${activeChatUserId}`;
    
    try {
      const chatRef = doc(db, 'events', eventId, 'chats', activeChatUserId);
      const messageCol = collection(chatRef, 'messages');
      
      const messageData = {
        text: textToSend,
        senderId: auth.currentUser?.uid,
        senderType: userRole === 'crew' ? 'crew' : 'attendee',
        timestamp: serverTimestamp()
      };

      await addDoc(messageCol, messageData);
      
      // Update session info for crew listing
      const sessionUpdate: any = {
        lastMessage: textToSend,
        lastTimestamp: serverTimestamp(),
        userId: activeChatUserId,
      };
      
      if (userRole === 'attendee') {
        sessionUpdate.attendeeName = auth.currentUser?.displayName || auth.currentUser?.email?.split('@')[0] || 'Attendee';
      }

      await setDoc(chatRef, sessionUpdate, { merge: true });

      setInputText("");
    } catch (error: any) {
      const wrappedError = handleFirestoreError(error, OperationType.WRITE, messagePath);
      toast.error(`${t('failed_to_send_message')}: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-80 sm:w-96 h-[500px] bg-slate-900/95 backdrop-blur-xl rounded-[32px] border border-white/10 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-3">
                {userRole === 'crew' && activeChatUserId && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-white/50"
                    onClick={() => setActiveChatUserId(null)}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                )}
                <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight">{t('help')}</h3>
                  <p className="text-[10px] text-green-500 font-bold uppercase tracking-widest">{t('active')}</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setIsOpen(false)}
                className="text-white/30 hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-0 flex flex-col" ref={scrollRef}>
              {userRole === 'crew' && !activeChatUserId ? (
                <div className="divide-y divide-white/5">
                  <div className="p-4">
                    <p className="text-[10px] font-black text-white/30 uppercase tracking-widest text-center">{t('active_conversations')}</p>
                  </div>
                  {chatUsers.map((user) => (
                    <button 
                      key={user.id}
                      onClick={() => {
                        setActiveChatUserId(user.id);
                        setUnreadCount(0);
                      }}
                      className="w-full p-6 hover:bg-white/5 flex items-center gap-4 transition-colors text-left"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center shrink-0">
                        <User className="h-6 w-6 text-white/40" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline mb-1">
                          <h4 className="text-sm font-bold text-white truncate uppercase tracking-tight">
                            {user.attendeeName}
                          </h4>
                          {user.lastTimestamp && (
                            <span className="text-[9px] text-white/20 font-medium">
                              {new Date(user.lastTimestamp?.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-white/40 truncate font-black uppercase tracking-widest">
                          {user.lastMessage} • <span className={user.status === 'arrived' ? 'text-green-500' : 'text-blue-500'}>{t(user.status)}</span>
                        </p>
                      </div>
                    </button>
                  ))}
                  {chatUsers.length === 0 && (
                    <div className="py-20 flex flex-col items-center justify-center text-center px-6">
                      <MessageCircle className="h-10 w-10 text-white/10 mb-4" />
                      <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">{t('no_active_sessions')}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex-1 p-4 space-y-4">
                  {messages.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`flex ${msg.senderId === auth.currentUser?.uid ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-xs font-medium ${
                        msg.senderId === auth.currentUser?.uid 
                          ? 'bg-blue-600 text-white rounded-br-none' 
                          : 'bg-white/10 text-white border border-white/10 rounded-bl-none'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  ))}
                  {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center px-6 py-20">
                      <MessageCircle className="h-12 w-12 text-white/10 mb-6" />
                      <p className="text-[10px] font-black text-white/30 uppercase tracking-widest leading-loose">
                        {t('official_channel')}<br/>
                        {t('all_comms_logged')}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Input */}
            {(userRole === 'attendee' || activeChatUserId) && (
              <div className="p-4 bg-white/5 border-t border-white/10 flex gap-2">
                <Input 
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={t('type_message')}
                  className="bg-black/20 border-none text-white text-xs h-12 rounded-2xl placeholder:text-white/20"
                />
                <Button 
                  onClick={sendMessage}
                  className="h-12 w-12 rounded-2xl bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="w-16 h-16 rounded-3xl bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-600/20 flex items-center justify-center p-0 relative group active:scale-95 transition-transform"
      >
        <AnimatePresence>
          {unreadCount > 0 && !isOpen && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-slate-900 z-10 shadow-lg"
            >
              {unreadCount}
            </motion.div>
          )}
        </AnimatePresence>
        {isOpen ? <X className="h-7 w-7 text-white" /> : <MessageCircle className="h-7 w-7 text-white" />}
      </Button>
    </div>
  );
};
