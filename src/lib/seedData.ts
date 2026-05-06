import { db, auth } from './firebase';
import { collection, doc, setDoc, serverTimestamp, addDoc } from 'firebase/firestore';

export const seedDemoData = async () => {
  if (!auth.currentUser) {
    throw new Error("You must be logged in to seed data.");
  }

  const eventId = "keshi-requiem-2026";
  const eventRef = doc(db, 'events', eventId);

  await setDoc(eventRef, {
    name: "KESHI REQUIEM WORLD TOUR",
    startDate: "2026-04-16",
    endDate: "2026-04-16",
    date: "2026-04-16",
    venue: "Unifi Arena",
    state: "Kuala Lumpur",
    isFree: false,
    duration: "4",
    image: "https://placehold.co/800x800/e8e6e1/3a3a3a?text=KESHI%0AREQUIEM%0AWORLD+TOUR%0A%0AWITH+SPECIAL+GUESTS%0ABOYLIFE&font=Playfair+Display",
    managerId: "demo_manager",
    isDemo: true,
    status: "successful",
    eventCode: "KESHI26",
    isOngoing: true,
    isEnded: false,
    exitGuidanceActive: false,
    depositPaid: true,
    registrationFeePaid: true,
    createdAt: serverTimestamp()
  });

  const zones = [
    { id: 'c4-standing', name: 'C4 (Standing)', capacity: 2500, peopleCount: 2200, isSeated: false, recommendedExitDoor: 'Main Floor Exit', confidence: 0.95 },
    { id: 'cat1-red', name: 'CAT 1', capacity: 1735, peopleCount: 1150, isSeated: true, recommendedExitDoor: 'Level 3 Exit A', confidence: 0.88 },
    { id: 'cat2-yellow', name: 'CAT 2', capacity: 2025, peopleCount: 1200, isSeated: true, recommendedExitDoor: 'Level 3 Exit B', confidence: 0.90 },
    { id: 'cat3-green', name: 'CAT 3', capacity: 2025, peopleCount: 1200, isSeated: true, recommendedExitDoor: 'Level 4 Exit A', confidence: 0.85 },
    { id: 'cat5-orange', name: 'CAT 5', capacity: 4090, peopleCount: 2500, isSeated: true, recommendedExitDoor: 'Level 4 Exit B', confidence: 0.82 },
    { id: 'cat6-purple', name: 'CAT 6', capacity: 1755, peopleCount: 1150, isSeated: true, recommendedExitDoor: 'Level 4 Exit C', confidence: 0.80 }
  ];

  for (const zone of zones) {
    await setDoc(doc(db, 'events', eventId, 'zones', zone.id), zone);
  }

  // Add mock attendee locations
  const locationsCount = 100;
  for (let i = 0; i < locationsCount; i++) {
    // Distribute dots reasonably across the arena layout
    // Standing zone: around middle
    // Other zones: left/right/bottom/top based on layout in CrowdMap
    let posX, posY;
    const rand = Math.random();
    
    if (rand < 0.4) { // Standing
      posX = 0.35 + Math.random() * 0.3;
      posY = 0.25 + Math.random() * 0.4;
    } else if (rand < 0.6) { // Side CATs
      posX = Math.random() < 0.5 ? 0.2 + Math.random() * 0.1 : 0.7 + Math.random() * 0.1;
      posY = 0.25 + Math.random() * 0.4;
    } else { // Bottom/Outer
      posX = 0.2 + Math.random() * 0.6;
      posY = 0.65 + Math.random() * 0.25;
    }

    await addDoc(collection(db, 'locations'), {
      eventId,
      userId: `user-${i}`,
      posX,
      posY,
      timestamp: serverTimestamp()
    });
  }

  // Add Comic Fiesta event
  await addDoc(collection(db, 'events'), {
    name: "Comic Fiesta",
    startDate: "2026-05-09",
    endDate: "2026-05-10",
    date: "2026-05-09 to 2026-05-10",
    venue: "Kuala Lumpur Convention Centre",
    state: "Kuala Lumpur",
    isFree: false,
    duration: "",
    managerId: "demo_manager",
    isDemo: true,
    status: "successful", // Registered/approved
    image: "https://images.unsplash.com/photo-1542751371-adc38448a05e",
    eventCode: "CF2026",
    isOngoing: false,
    isEnded: false,
    exitGuidanceActive: false,
    depositPaid: true,
    registrationFeePaid: true,
    floorPlanFileName: "KLCC_Ground_Floor_Plan.pdf",
    seatingPlanFileName: "KLCC_Ground_Floor_Plan.pdf",
    zoneConfig: {
      categories: 0,
      standing: 5 // Hall 1, 2, 3, 4, 5
    },
    createdAt: serverTimestamp()
  });

  // Add an upcoming event
  await addDoc(collection(db, 'events'), {
    name: "Future Fest 2026",
    startDate: "2026-05-20",
    endDate: "2026-05-22",
    date: "2026-05-20 to 2026-05-22",
    venue: "MITEC",
    state: "Kuala Lumpur",
    isFree: true,
    duration: "6",
    managerId: "demo_manager",
    isDemo: true,
    status: "successful",
    eventCode: "FF2026",
    isOngoing: false,
    isEnded: false,
    exitGuidanceActive: false,
    depositPaid: true,
    registrationFeePaid: true,
    createdAt: serverTimestamp()
  });
};
