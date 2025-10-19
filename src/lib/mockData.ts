export interface Room {
  id: string;
  name: string;
  capacity: number;
  facilities: string[];
}

export interface Booking {
  id: string;
  userId: string;
  userName: string;
  roomId: string;
  roomName: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  purpose: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
}

const ROOMS_KEY = 'quickroom_rooms';
const BOOKINGS_KEY = 'quickroom_bookings';

export const defaultRooms: Room[] = [
  { id: '1', name: 'Conference Room A', capacity: 20, facilities: ['Projector', 'Whiteboard', 'AC'] },
  { id: '2', name: 'Conference Room B', capacity: 15, facilities: ['TV', 'Whiteboard'] },
  { id: '3', name: 'Lab 101', capacity: 30, facilities: ['Computers', 'Projector', 'AC'] },
  { id: '4', name: 'Seminar Hall', capacity: 100, facilities: ['Audio System', 'Projector', 'AC'] },
];

export const initializeStorage = () => {
  if (!localStorage.getItem(ROOMS_KEY)) {
    localStorage.setItem(ROOMS_KEY, JSON.stringify(defaultRooms));
  }
  if (!localStorage.getItem(BOOKINGS_KEY)) {
    localStorage.setItem(BOOKINGS_KEY, JSON.stringify([]));
  }
};

export const getRooms = (): Room[] => {
  const rooms = localStorage.getItem(ROOMS_KEY);
  return rooms ? JSON.parse(rooms) : defaultRooms;
};

export const addRoom = (room: Omit<Room, 'id'>): Room => {
  const rooms = getRooms();
  const newRoom = { ...room, id: Date.now().toString() };
  rooms.push(newRoom);
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  return newRoom;
};

export const updateRoom = (id: string, updates: Partial<Room>): Room | null => {
  const rooms = getRooms();
  const index = rooms.findIndex(r => r.id === id);
  if (index === -1) return null;
  
  rooms[index] = { ...rooms[index], ...updates };
  localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
  return rooms[index];
};

export const deleteRoom = (id: string): boolean => {
  const rooms = getRooms();
  const filtered = rooms.filter(r => r.id !== id);
  localStorage.setItem(ROOMS_KEY, JSON.stringify(filtered));
  return filtered.length < rooms.length;
};

export const getBookings = (): Booking[] => {
  const bookings = localStorage.getItem(BOOKINGS_KEY);
  return bookings ? JSON.parse(bookings) : [];
};

export const addBooking = (booking: Omit<Booking, 'id' | 'createdAt'>): Booking => {
  const bookings = getBookings();
  const newBooking = {
    ...booking,
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
  };
  bookings.push(newBooking);
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
  return newBooking;
};

export const updateBooking = (id: string, updates: Partial<Booking>): Booking | null => {
  const bookings = getBookings();
  const index = bookings.findIndex(b => b.id === id);
  if (index === -1) return null;
  
  bookings[index] = { ...bookings[index], ...updates };
  localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
  return bookings[index];
};

export const checkAvailability = (roomId: string, date: string, startTime: string, endTime: string, excludeBookingId?: string): boolean => {
  const bookings = getBookings();
  const roomBookings = bookings.filter(b => 
    b.roomId === roomId && 
    b.date === date && 
    b.status === 'approved' &&
    b.id !== excludeBookingId
  );
  
  const start = new Date(`${date}T${startTime}`);
  const end = new Date(`${date}T${endTime}`);
  
  return !roomBookings.some(booking => {
    const bookingStart = new Date(`${booking.date}T${booking.startTime}`);
    const bookingEnd = new Date(`${booking.date}T${booking.endTime}`);
    
    return (start < bookingEnd && end > bookingStart);
  });
};
