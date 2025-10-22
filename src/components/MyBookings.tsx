import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getMyBookings,
  getAllBookings,
  Booking as ApiBooking,
  getRooms, // <--- ADDED
  Room, // <--- ADDED
} from "@/lib/dataApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw, Filter, X } from "lucide-react"; // Added Filter, X
import { Input } from "@/components/ui/input"; // <--- ADDED
import { Label } from "@/components/ui/label"; // <--- ADDED
import {
  Select, // <--- ADDED
  SelectContent, // <--- ADDED
  SelectItem, // <--- ADDED
  SelectTrigger, // <--- ADDED
  SelectValue, // <--- ADDED
} from "@/components/ui/select";

type Booking = ApiBooking & { createdAt?: string }; // normalize naming locally

export const MyBookings = () => {
  const { user } = useAuth();
  const [allBookings, setAllBookings] = useState<Booking[] | null>(null); // Stores the unfiltered list
  const [rooms, setRooms] = useState<Room[]>([]); // Stores the list of all rooms for filtering
  const [isRefreshing, setIsRefreshing] = useState(false);

  // --- FILTER STATES ---
  const [filter, setFilter] = useState({
    status: "all", // all, approved, rejected, pending
    roomId: "all",
    fromDate: "",
    toDate: "",
  });

  const handleFilterChange = (field: keyof typeof filter, value: string) => {
    setFilter((prev) => ({ ...prev, [field]: value }));
  };

  const handleClearFilters = () => {
    setFilter({
      status: "all",
      roomId: "all",
      fromDate: "",
      toDate: "",
    });
  };

  const normalize = (b: any): Booking => {
    const userId =
      String(
        b.userId ??
          b.user_id ??
          b.user?.id ??
          b.user?.user_id ??
          b.created_by ??
          ""
      ) || "";
    const roomId =
      String(b.roomId ?? b.room_id ?? b.room?.id ?? b.room?.room_id ?? "") ||
      "";
    const roomName =
      b.roomName ?? b.room_name ?? b.room?.name ?? b.room?.room_name ?? "Room";
    const status = (b.status ?? b.booking_status ?? "pending").toString();
    const startTime =
      b.startTime ?? b.start_time ?? b.time?.start ?? b.start ?? "";
    const endTime = b.endTime ?? b.end_time ?? b.time?.end ?? b.end ?? "";
    const date = b.date ?? b.booking_date ?? b.when ?? "";

    return {
      id: String(b.id ?? b._id ?? ""),
      userId,
      userName:
        b.userName ??
        b.user_name ??
        b.user?.name ??
        b.user?.username ??
        b.created_by_name ??
        "",
      roomId,
      roomName,
      date,
      startTime,
      endTime,
      duration: Number(b.duration ?? b.hours ?? 0),
      purpose: b.purpose ?? b.reason ?? b.title ?? "",
      status: status as "pending" | "approved" | "rejected",
      createdAt: b.createdAt ?? b.created_at ?? new Date().toISOString(),
    };
  };

  // --- Data Fetching Logic ---

  const fetchInitialData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // 1. Fetch Rooms (for filtering)
      const fetchedRooms = await getRooms();
      setRooms(fetchedRooms);

      // 2. Fetch Bookings
      let fetchedBookings = [];
      try {
        fetchedBookings = await getMyBookings();
      } catch (err) {
        console.warn(
          "getMyBookings failed, falling back to getAllBookings",
          err
        );
        fetchedBookings = await getAllBookings();
      }

      const normalized = (fetchedBookings || []).map((b: any) => normalize(b));

      // Filter client-side to ensure only *own* bookings are shown for non-admins
      const finalList =
        user && user.role !== "admin" && user.id
          ? normalized.filter((b) => String(b.userId) === String(user.id))
          : normalized;

      setAllBookings(finalList); // Store the complete list
    } catch (err) {
      console.error("Error fetching user bookings:", err);
      toast.error("Failed to load your booking history.");
      setAllBookings([]);
    } finally {
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // --- Filtering Logic (memoized) ---
  const filteredBookings = useMemo(() => {
    if (allBookings === null) return [];

    let filtered = [...allBookings];

    // 1. Status Filter
    if (filter.status !== "all") {
      filtered = filtered.filter((b) => b.status === filter.status);
    }

    // 2. Room Filter
    if (filter.roomId !== "all") {
      filtered = filtered.filter((b) => String(b.roomId) === filter.roomId);
    }

    // 3. Date Range Filter
    if (filter.fromDate || filter.toDate) {
      filtered = filtered.filter((b) => {
        // Use a date object that combines date and time for accurate comparison
        const bookingDateTime = new Date(`${b.date}T${b.startTime}`);
        if (isNaN(bookingDateTime.getTime())) return false;

        if (filter.fromDate) {
          // Compare with start of the 'from' day
          const from = new Date(filter.fromDate);
          from.setHours(0, 0, 0, 0);
          if (bookingDateTime < from) return false;
        }

        if (filter.toDate) {
          // Compare with end of the 'to' day
          const to = new Date(filter.toDate);
          to.setHours(23, 59, 59, 999);
          if (bookingDateTime > to) return false;
        }

        return true;
      });
    }

    // Sort chronologically (ascending date/time)
    filtered.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.startTime}`);
      const dateB = new Date(`${b.date}T${b.startTime}`);
      return dateA.getTime() - dateB.getTime();
    });

    return filtered;
  }, [allBookings, filter]);

  // --- UI Helpers ---

  const getStatusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-success text-white";
      case "rejected":
        return "bg-destructive text-white";
      default:
        return "bg-pending text-white";
    }
  };

  if (allBookings === null) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-900">My Bookings</h2>
          <Button size="sm" variant="ghost" disabled>
            <RefreshCw className="h-4 w-4 animate-spin" />
          </Button>
        </div>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  const bookingsToDisplay = filteredBookings;
  const hasActiveFilters = Object.values(filter).some(
    (val) => val !== "all" && val !== ""
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-slate-900">
          My Bookings ({bookingsToDisplay.length})
        </h2>
        <Button
          size="sm"
          variant="outline"
          onClick={() => fetchInitialData()}
          disabled={isRefreshing}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* --- FILTER SECTION --- */}
      <Card className="bg-slate-50 border-slate-200 shadow-md">
        <CardHeader className="p-4 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter Bookings
          </CardTitle>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilters}
              className="text-destructive hover:bg-destructive/10"
            >
              <X className="h-4 w-4 mr-1" />
              Clear Filters
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-0 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div className="space-y-1">
              <Label htmlFor="status">Status</Label>
              <Select
                value={filter.status}
                onValueChange={(val) => handleFilterChange("status", val)}
              >
                <SelectTrigger id="status">
                  <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Room Filter */}
            <div className="space-y-1">
              <Label htmlFor="room">Room</Label>
              <Select
                value={filter.roomId}
                onValueChange={(val) => handleFilterChange("roomId", val)}
              >
                <SelectTrigger id="room">
                  <SelectValue placeholder="Filter by Room" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Rooms</SelectItem>
                  {rooms.map((room) => (
                    <SelectItem key={room.id} value={String(room.id)}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* From Date Filter */}
            <div className="space-y-1">
              <Label htmlFor="fromDate">From Date</Label>
              <Input
                id="fromDate"
                type="date"
                value={filter.fromDate}
                onChange={(e) => handleFilterChange("fromDate", e.target.value)}
              />
            </div>

            {/* To Date Filter */}
            <div className="space-y-1">
              <Label htmlFor="toDate">To Date</Label>
              <Input
                id="toDate"
                type="date"
                value={filter.toDate}
                onChange={(e) => handleFilterChange("toDate", e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
      {/* --- END FILTER SECTION --- */}

      {bookingsToDisplay.length === 0 ? (
        <Card className="border-slate-200 rounded-xl shadow-md">
          <CardContent className="py-8 text-center text-muted-foreground">
            {hasActiveFilters
              ? "No bookings match your current filters."
              : "No bookings yet. Create your first booking!"}
          </CardContent>
        </Card>
      ) : (
        bookingsToDisplay.map((booking) => (
          <Card
            key={
              booking.id ||
              `${booking.roomId}-${booking.date}-${booking.startTime}`
            }
            className="border-slate-200 rounded-xl shadow-md hover:shadow-lg hover:border-slate-300 transition-all duration-200"
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg text-slate-900">
                  {booking.roomName}
                </CardTitle>
                <Badge
                  className={`${getStatusColor(
                    booking.status
                  )} px-3 py-1 rounded-full text-xs font-semibold`}
                >
                  {booking.status.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide font-semibold">
                    Date
                  </p>
                  <p className="font-medium text-slate-900">
                    {booking.date
                      ? new Date(booking.date).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide font-semibold">
                    Time
                  </p>
                  <p className="font-medium text-slate-900">
                    {booking.startTime || "—"} - {booking.endTime || "—"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground text-xs uppercase tracking-wide font-semibold">
                    Purpose
                  </p>
                  <p className="font-medium text-slate-900">
                    {booking.purpose || "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};
