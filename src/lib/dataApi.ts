// src/lib/dataApi.ts (Final, Cleaned Version for Minimal Schema)

import { api } from "./api";

export interface Room {
  id: string;
  name: string;
  capacity: number;
  facilities: string[];
  type?: string;
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
  status?: string;
  resources?: BookingResource[];
}

export interface Resource {
  id: string;
  name: string;
  type: string;
  total_quantity: number;
}

export interface BookingResource {
  resourceId: string;
  resourceName: string;
  resourceType: string;
  quantityRequested: number;
}

// normalize facilities from many shapes into string[]
const normalizeFacilities = (fac: any): string[] => {
  try {
    if (fac == null) return [];
    if (Array.isArray(fac))
      return fac
        .flat()
        .map(String)
        .map((s) => s.trim())
        .filter(Boolean);
    if (fac instanceof Set) return Array.from(fac).map(String);
    if (fac instanceof Map) return Array.from(fac.values()).map(String);
    if (typeof fac === "object") {
      const vals = Object.values(fac).flat();
      if (vals.length)
        return vals
          .map(String)
          .map((s) => s.trim())
          .filter(Boolean);
    }
    if (typeof fac === "string") {
      const trimmed = fac.trim();
      if (trimmed === "") return [];
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed))
          return parsed
            .map(String)
            .map((s) => s.trim())
            .filter(Boolean);
        if (parsed && typeof parsed === "object") {
          const vals = Object.values(parsed).flat();
          if (vals.length)
            return vals
              .map(String)
              .map((s) => s.trim())
              .filter(Boolean);
        }
      } catch {
        /* not JSON */
      }
      return trimmed
        .split(/[;,|]/)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [String(fac)];
  } catch (err) {
    console.error("normalizeFacilities failed:", err, fac);
    return [];
  }
};

// --- ROOM API CALLS ---

export const getRooms = async (): Promise<Room[]> => {
  try {
    const response = await api.get<any[]>("/rooms");
    if (!Array.isArray(response.data)) return [];

    return response.data.map((room: any) => ({
      id: String(room.id ?? room._id ?? ""),
      name: room.name ?? room.room_name ?? `Room ${room.id ?? ""}`,
      capacity: Number(room.capacity ?? room.size ?? 0) || 0,
      facilities: normalizeFacilities(
        (room as any).facilities ??
          room.facility ??
          room.facilities_list ??
          room.features
      ),
      type: room.type ?? room.room_type ?? "General",
    }));
  } catch (error) {
    console.error("Failed to fetch rooms:", error);
    return [];
  }
};

export const addRoom = async (room: Omit<Room, "id">): Promise<any> => {
  return api.post("/rooms", room);
};

export const updateRoom = async (
  id: string,
  updates: Partial<Room>
): Promise<any> => {
  return api.put(`/rooms/${id}`, updates);
};

export const deleteRoom = async (id: string): Promise<any> => {
  return api.delete(`/rooms/${id}`);
};

// --- BOOKING API CALLS ---

export const addBooking = async (
  booking: Omit<Booking, "id" | "createdAt" | "status">
): Promise<any> => {
  return api.post("/bookings", booking);
};

export const getMyBookings = async (): Promise<Booking[]> => {
  const response = await api.get<Booking[]>("/bookings/my");
  return response.data.map((booking) => ({
    ...booking,
    id: String(booking.id),
  }));
};

export const getVisibleBookings = async (): Promise<Booking[]> => {
  try {
    const res = await api.get("/bookings/visible");
    const data = res.data;
    if (!Array.isArray(data)) {
      console.warn(
        "getVisibleBookings: unexpected payload (not an array).",
        data
      );
      return [];
    }
    return data.map((b: any) => ({
      id: String(b.id ?? b._id ?? ""),
      userId: String(b.user_id ?? b.userId ?? b.user?.id ?? ""),
      userName: b.user_name ?? b.userName ?? b.user?.name ?? "Booked",
      roomId: String(b.room_id ?? b.roomId ?? b.room?.id ?? ""),
      roomName: b.room_name ?? b.roomName ?? b.room?.name ?? "Room",
      date: b.date ?? b.booking_date ?? b.start_date ?? b.start_datetime ?? "",
      startTime:
        b.start_time ??
        b.startTime ??
        b.time?.start ??
        b.start ??
        b.startTimeIso ??
        "",
      endTime:
        b.end_time ?? b.endTime ?? b.time?.end ?? b.end ?? b.endTimeIso ?? "",
      duration: Number(b.duration ?? b.hours ?? 0),
      purpose: b.purpose ?? b.title ?? b.reason ?? "",
      status: (b.status ?? b.booking_status ?? "pending").toString(),
    }));
  } catch (err: any) {
    console.warn("getVisibleBookings failed:", err?.message ?? err);
    if (err?.response?.data)
      console.warn("getVisibleBookings response body:", err.response.data);
    return [];
  }
};

export const getAllBookings = async (): Promise<Booking[]> => {
  const response = await api.get<Booking[]>("/bookings/all");
  return response.data.map((booking) => ({
    ...booking,
    id: String(booking.id),
  }));
};

export const updateBookingStatus = async (
  id: string,
  status: "approved" | "rejected",
  rejectionReason?: string,
  approvedAt?: string
): Promise<any> => {
  // send rejection_reason and approved_at if provided
  const payload: any = { status };
  if (rejectionReason) payload.rejection_reason = rejectionReason;
  if (approvedAt) payload.approved_at = approvedAt;
  return api.put(`/bookings/${id}/status`, payload);
};

export const updateBooking = async (
  id: string,
  updates: Partial<Omit<Booking, "id" | "userId" | "userName" | "status">>
): Promise<any> => {
  return api.put(`/bookings/${id}`, updates);
};

export const deleteBooking = async (id: string): Promise<any> => {
  return api.delete(`/bookings/${id}`);
};

export const bulkCreateBookings = async (bookings: any[]): Promise<any> => {
  const response = await api.post("/bookings/bulk", { bookings });
  return response.data;
};

export const resolveConflicts = async (resolutions: any[]): Promise<any> => {
  const response = await api.post("/bookings/bulk/resolve", { resolutions });
  return response.data;
};

export const checkAvailability = () => {
  console.error("checkAvailability must be handled by the backend API.");
  return true;
};

export const initializeStorage = () => {
  console.warn("initializeStorage is redundant: Data is now in MySQL.");
};

// --- RESOURCE API CALLS ---

export const getResources = async (): Promise<Resource[]> => {
  try {
    const response = await api.get<any[]>("/resources");
    if (!Array.isArray(response.data)) return [];
    
    return response.data.map((resource: any) => ({
      id: String(resource.id),
      name: resource.name,
      type: resource.type,
      total_quantity: Number(resource.total_quantity) || 1,
    }));
  } catch (error) {
    console.error("Failed to fetch resources:", error);
    return [];
  }
};

export const addResource = async (resource: Omit<Resource, "id">): Promise<any> => {
  return api.post("/resources", resource);
};

export const updateResource = async (
  id: string,
  updates: Partial<Resource>
): Promise<any> => {
  return api.put(`/resources/${id}`, updates);
};

export const deleteResource = async (id: string): Promise<any> => {
  return api.delete(`/resources/${id}`);
};

export const checkResourceAvailability = async (
  resources: { resourceId: string; quantity: number }[],
  date: string,
  startTime: string,
  endTime: string
): Promise<any> => {
  const response = await api.post("/resources/check-availability", {
    resources,
    date,
    startTime,
    endTime,
  });
  return response.data;
};
