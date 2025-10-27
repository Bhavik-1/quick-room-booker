import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
// removed ApproveBookings import (we render pending inline)
import { ManageRooms } from "@/components/ManageRooms";
import { ManageResources } from "@/components/ManageResources";
import { BulkBooking } from "@/components/BulkBooking";
import {
  getAllBookings,
  updateBookingStatus,
  getRooms,
  Room,
} from "@/lib/dataApi";
import {
  Calendar,
  LogOut,
  CheckSquare,
  Building,
  List,
  Upload,
  Loader2,
  X,
  Filter,
  RefreshCw,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import CalendarView from "./CalendarView";

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    "approve" | "rooms" | "resources" | "all" | "bulk" | "calendar"
  >("approve");

  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // --- FILTER STATES ---
  const [rooms, setRooms] = useState<Room[]>([]);
  const [filter, setFilter] = useState({
    status: "all", // all, approved, rejected, pending
    roomId: "all",
    fromDate: "",
    toDate: "",
  });

  // REJECTION STATES
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [isProcessingUpdate, setIsProcessingUpdate] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/login");
    }
  }, [user, navigate]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // --- Filter Handlers ---
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

  const hasActiveFilters = useMemo(() => {
    return Object.values(filter).some((val) => val !== "all" && val !== "");
  }, [filter]);

  // --- Existing Fetch Logic ---
  const fetchAllBookings = useCallback(async () => {
    setLoadingAll(true);
    try {
      const data = await getAllBookings();
      const bookings = Array.isArray(data) ? data : [];
      setAllBookings(bookings);
    } catch (err) {
      console.error("Failed to fetch all bookings", err);
      toast.error("Failed to load bookings");
      setAllBookings([]);
    } finally {
      setLoadingAll(false);
    }
  }, []);

  const fetchPendingBookings = useCallback(async () => {
    setLoadingPending(true);
    try {
      const data = await getAllBookings();
      const arr = Array.isArray(data) ? data : [];
      const pending = arr.filter(
        (b: any) =>
          String(b.status ?? b.booking_status ?? "").toLowerCase() === "pending"
      );
      setPendingBookings(pending);
    } catch (err) {
      console.error("Failed to fetch pending bookings", err);
      toast.error("Failed to load pending bookings");
    } finally {
      setLoadingPending(false);
    }
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      const data = await getRooms();
      setRooms(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch rooms", err);
    }
  }, []);

  useEffect(() => {
    // Fetch rooms when the component mounts
    fetchRooms();
  }, [fetchRooms]);

  useEffect(() => {
    if (activeTab === "all") {
      fetchAllBookings();
      handleClearFilters(); // Reset filters when opening All Bookings tab
    }
    if (activeTab === "approve") {
      fetchPendingBookings();
      // Ensure rejection is cleared when switching tabs
      setRejectingId(null);
      setRejectionReason("");
    }
  }, [activeTab, fetchAllBookings, fetchPendingBookings]);

  // --- Memoized Filtering Logic ---
  const filteredBookings = useMemo(() => {
    if (allBookings.length === 0) return [];

    let filtered = [...allBookings];

    // ... (Status and Room Filters remain the same)
    if (filter.status !== "all") {
      filtered = filtered.filter(
        (b) =>
          String(b.status ?? b.booking_status).toLowerCase() === filter.status
      );
    }
    if (filter.roomId !== "all") {
      filtered = filtered.filter(
        (b) => String(b.room_id ?? b.roomId) === filter.roomId
      );
    }

    // 3. Date Range Filter (REVISED FIX)
    if (filter.fromDate || filter.toDate) {
      // Pre-calculate filter date timestamps (normalized to start of day in local time)
      const fromTimestamp = filter.fromDate
        ? new Date(filter.fromDate).setHours(0, 0, 0, 0)
        : null;

      const toTimestamp = filter.toDate
        ? new Date(filter.toDate).setHours(23, 59, 59, 999)
        : null;

      filtered = filtered.filter((b) => {
        const bookingDateSource = b.date ?? b.booking_date;
        if (!bookingDateSource) return false;

        // ⚠️ CRITICAL CHANGE: Create a consistent, comparable Date object for the booking.
        // If bookingDateSource is already a full ISO string, new Date(string) works.
        // If it's a date string like '10/23/2025', it's safer to use the original string.

        // To be absolutely safe, we will create a Date object based ONLY on the date part,
        // using the same manual parsing method from the last attempt but ensuring a valid Date.

        let bookingDate;
        try {
          // Use the string as-is first. This often works for ISO 8601 timestamps.
          bookingDate = new Date(bookingDateSource);

          if (isNaN(bookingDate.getTime())) {
            // If the first attempt fails (e.g., if it's 'DD/MM/YYYY'),
            // try to parse just the YYYY-MM-DD part if it's available.

            // Fallback: If your date is 'YYYY-MM-DD', this creates a local date.
            const datePart = String(bookingDateSource).split("T")[0];
            const parts = datePart.split("-");
            // Note: This assumes YYYY-MM-DD. If your source date is different,
            // we need to know its exact format!
            if (parts.length === 3) {
              bookingDate = new Date(
                Number(parts[0]),
                Number(parts[1]) - 1,
                Number(parts[2])
              );
            } else {
              // If all else fails, log it or skip it.
              return false;
            }
          }
        } catch {
          return false; // Skip malformed dates
        }

        const bookingTimestamp = bookingDate.getTime();

        // Check against the 'From' filter (must be >= start of 'from' day)
        if (fromTimestamp !== null && bookingTimestamp < fromTimestamp) {
          return false;
        }

        // Check against the 'To' filter (must be <= end of 'to' day)
        if (toTimestamp !== null && bookingTimestamp > toTimestamp) {
          return false;
        }

        return true;
      });
    }

    return filtered;
  }, [allBookings, filter]);

  // Helper: parse backend date + time into a local Date (remains the same)
  const parseLocal = (dateStr?: string, timeStr?: string): Date | null => {
    if (!dateStr && !timeStr) return null;
    // If dateStr contains T (ISO), extract date part if timeStr provided
    try {
      if (dateStr && dateStr.includes("T") && timeStr) {
        const dateOnly = dateStr.split("T")[0]; // YYYY-MM-DD
        const [y, m, d] = dateOnly.split("-").map(Number);
        const tm = String(timeStr)
          .trim()
          .match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (!tm) return new Date(dateStr);
        let hh = Number(tm[1]);
        const mm = Number(tm[2]);
        const ss = Number(tm[3] ?? 0);
        const ampm = String(timeStr).match(/\b(am|pm)\b/i);
        if (ampm) {
          const ap = ampm[1].toLowerCase();
          if (ap === "pm" && hh < 12) hh += 12;
          if (ap === "am" && hh === 12) hh = 0;
        }
        return new Date(y, m - 1, d, hh, mm, ss);
      }
      // If dateStr is simple YYYY-MM-DD and time present:
      if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) && timeStr) {
        const [y, m, d] = dateStr.split("-").map(Number);
        const tm = String(timeStr)
          .trim()
          .match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
        if (!tm) return null;
        let hh = Number(tm[1]);
        const mm = Number(tm[2]);
        const ss = Number(tm[3] ?? 0);
        const ampm = String(timeStr).match(/\b(am|pm)\b/i);
        if (ampm) {
          const ap = ampm[1].toLowerCase();
          if (ap === "pm" && hh < 12) hh += 12;
          if (ap === "am" && hh === 12) hh = 0;
        }
        return new Date(y, m - 1, d, hh, mm, ss);
      }
      // fallback: let Date parse it
      const d = new Date(dateStr ?? `${dateStr} ${timeStr}`);
      if (!isNaN(d.getTime())) return d;
    } catch (err) {
      // ignore
    }
    return null;
  };

  const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) => {
    return aStart < bEnd && bStart < aEnd;
  };

  // Approve with conflict detection (shared by both tabs)
  const handleApprove = async (booking: any) => {
    if (isProcessingUpdate) return;
    setIsProcessingUpdate(booking.id);

    try {
      // build start/end for current booking
      const start = parseLocal(
        booking.date,
        booking.start_time ?? booking.startTime ?? booking.start
      );
      const end = parseLocal(
        booking.date,
        booking.end_time ?? booking.endTime ?? booking.end
      );
      if (!start || !end) {
        toast.error("Invalid booking date/time");
        return;
      }

      // find approved bookings in same room (exclude current)
      const approvedSameRoom = (allBookings || []).filter(
        (b) =>
          String(b.room_id ?? b.roomId ?? b.room_id) ===
            String(booking.room_id ?? booking.roomId ?? booking.room_id) &&
          String(b.id) !== String(booking.id) &&
          String(b.status ?? b.booking_status ?? "").toLowerCase() ===
            "approved"
      );

      const conflicts = approvedSameRoom
        .map((b) => {
          const s = parseLocal(
            b.date ?? b.booking_date,
            b.start_time ?? b.startTime ?? b.start
          );
          const e = parseLocal(
            b.date ?? b.booking_date,
            b.end_time ?? b.endTime ?? b.end
          );
          if (!s || !e) return null;
          if (overlaps(start, end, s, e)) return { b, s, e };
          return null;
        })
        .filter(Boolean) as any[];

      if (conflicts.length > 0) {
        // show summary and ask to force or cancel
        const list = conflicts
          .map(
            (c: any) =>
              `• ${c.b.room_name ?? c.b.roomName} | ${
                c.b.user_name ?? c.b.userName
              } | ${new Date(c.s).toLocaleString()} - ${new Date(
                c.e
              ).toLocaleTimeString()}`
          )
          .join("\n");
        const msg = `This booking conflicts with ${conflicts.length} approved booking(s):\n\n${list}\n\nApprove anyway? (Press OK to force-approve or Cancel to abort)`;
        const ok = window.confirm(msg);
        if (!ok) {
          toast.error("Approval cancelled due to conflict");
          return;
        }
        // if ok -> continue to force-approve
      }

      const approvedAt = new Date().toISOString();
      await updateBookingStatus(
        String(booking.id),
        "approved",
        undefined,
        approvedAt
      );
      toast.success("Booking approved");

      // Clear rejection state if it was active
      setRejectingId(null);
      setRejectionReason("");

      // refresh list
      await fetchPendingBookings();
      await fetchAllBookings();
    } catch (err) {
      console.error("Approve failed", err);
      toast.error("Failed to approve booking");
    } finally {
      setIsProcessingUpdate(null);
    }
  };

  // Handlers for Rejection flow
  const handleRejectClick = (id: string) => {
    setRejectingId(id);
    setRejectionReason("");
  };

  const handleCancelReject = () => {
    setRejectingId(null);
    setRejectionReason("");
  };

  const handleConfirmReject = async (booking: any) => {
    if (isProcessingUpdate) return;
    setIsProcessingUpdate(booking.id);

    try {
      // Pass the reason as the third argument (rejectionReason).
      await updateBookingStatus(
        String(booking.id),
        "rejected",
        rejectionReason.trim() || undefined
      );

      toast.success("Booking rejected");
      // Clear rejection state
      setRejectingId(null);
      setRejectionReason("");
      // refresh list
      await fetchPendingBookings();
      await fetchAllBookings();
    } catch (err) {
      console.error("Reject failed", err);
      toast.error("Failed to reject booking");
    } finally {
      setIsProcessingUpdate(null);
    }
  };

  // format date as dd/mm/yyyy
  const formatDateDMY = (d?: Date | null) => {
    if (!d) return "-";

    // Create a new Date object based on the input date's time value
    // This prevents modifying the original 'd' object.
    const nextDay = new Date(d.getTime());

    // Add 1 to the current day.
    // setDate() automatically handles month and year rollovers.
    nextDay.setDate(nextDay.getDate());

    // Use the new date for formatting
    const dd = String(nextDay.getDate()).padStart(2, "0");
    const mm = String(nextDay.getMonth() + 1).padStart(2, "0");
    const yyyy = nextDay.getFullYear();

    return `${dd}/${mm}/${yyyy}`;
  };

  const statusBadge = (status?: string) => {
    const s = String(status ?? "").toLowerCase();
    const base =
      "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium";
    if (s === "approved" || s === "booked")
      return (
        <span className={`${base} bg-green-100 text-green-800`}>APPROVED</span>
      );
    if (s === "pending")
      return (
        <span className={`${base} bg-yellow-100 text-yellow-800`}>PENDING</span>
      );
    if (s === "rejected")
      return (
        <span className={`${base} bg-red-100 text-red-800`}>REJECTED</span>
      );
    return (
      <span className={`${base} bg-slate-100 text-slate-800`}>
        {(status ?? "UNKNOWN").toString().toUpperCase()}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-card border-b border-border shadow-md">
        <div className="container mx-auto px-4 py-5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <h1 className="text-lg font-bold text-primary">QuickRoom Admin</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {user?.name}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="hover:bg-slate-100 transition"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-4 gap-6">
          <aside className="space-y-1">
            <Button
              variant={activeTab === "approve" ? "default" : "ghost"}
              className={`w-full justify-start ${
                activeTab === "approve"
                  ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => setActiveTab("approve")}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Pending Approvals
            </Button>
            <Button
              variant={activeTab === "all" ? "default" : "ghost"}
              className={`w-full justify-start ${
                activeTab === "all"
                  ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => setActiveTab("all")}
            >
              <List className="h-4 w-4 mr-2" />
              All Bookings
            </Button>

            <Button
              variant={activeTab === "calendar" ? "default" : "ghost"}
              className={`w-full justify-start ${
                activeTab === "calendar"
                  ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => setActiveTab("calendar")}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Calendar
            </Button>

            <Button
              variant={activeTab === "rooms" ? "default" : "ghost"}
              className={`w-full justify-start ${
                activeTab === "rooms"
                  ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => setActiveTab("rooms")}
            >
              <Building className="h-4 w-4 mr-2" />
              Manage Rooms
            </Button>
            <Button
              variant={activeTab === "resources" ? "default" : "ghost"}
              className={`w-full justify-start ${
                activeTab === "resources"
                  ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => setActiveTab("resources")}
            >
              <Package className="h-4 w-4 mr-2" />
              Manage Resources
            </Button>
            <Button
              variant={activeTab === "bulk" ? "default" : "ghost"}
              className={`w-full justify-start ${
                activeTab === "bulk"
                  ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => setActiveTab("bulk")}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Timetable
            </Button>
          </aside>

          <div className="md:col-span-3">
            {activeTab === "approve" && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">Pending Approvals</h2>
                  <div>
                    <Button
                      onClick={fetchPendingBookings}
                      variant="outline"
                      size="sm"
                    >
                      Refresh
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto bg-white p-4 rounded-xl border border-slate-200 shadow-md">
                  {loadingPending ? (
                    <div>Loading pending bookings...</div>
                  ) : pendingBookings.length === 0 ? (
                    <div className="text-muted-foreground">
                      No pending bookings.
                    </div>
                  ) : (
                    <table className="w-full table-auto text-sm">
                      <thead className="bg-slate-50">
                        <tr className="text-left text-slate-600 border-b-2 border-slate-200">
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                            Room
                          </th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                            User
                          </th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                            Date
                          </th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                            Start
                          </th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                            End
                          </th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pendingBookings.map((b) => {
                          const start = parseLocal(
                            b.date ?? b.booking_date,
                            b.start_time ?? b.startTime ?? b.start
                          );
                          const end = parseLocal(
                            b.date ?? b.booking_date,
                            b.end_time ?? b.endTime ?? b.end
                          );
                          return (
                            <tr
                              key={b.id}
                              className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
                            >
                              <td className="px-4 py-4 align-top font-medium">
                                {b.room_name ?? b.roomName}
                              </td>
                              <td className="px-4 py-4 align-top text-sm text-slate-700">
                                {b.user_name ?? b.userName}
                              </td>
                              <td className="px-4 py-4 align-top">
                                {formatDateDMY(start)}
                              </td>
                              <td className="px-4 py-4 align-top">
                                {start
                                  ? start.toLocaleTimeString([], {
                                      hour: "numeric",
                                      minute: "2-digit",
                                      hour12: true,
                                    })
                                  : "-"}
                              </td>
                              <td className="px-4 py-4 align-top">
                                {end
                                  ? end.toLocaleTimeString([], {
                                      hour: "numeric",
                                      minute: "2-digit",
                                      hour12: true,
                                    })
                                  : "-"}
                              </td>
                              <td className="px-4 py-4 align-top">
                                {rejectingId === b.id ? (
                                  // REJECT CONFIRMATION VIEW
                                  <div className="space-y-2">
                                    <Textarea
                                      value={rejectionReason}
                                      onChange={(e) =>
                                        setRejectionReason(e.target.value)
                                      }
                                      placeholder="Enter rejection reason (optional)"
                                      rows={2}
                                      className="w-full text-sm resize-none"
                                    />
                                    <div className="flex gap-2">
                                      <Button
                                        onClick={handleCancelReject}
                                        variant="outline"
                                        size="sm"
                                        disabled={isProcessingUpdate === b.id}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        onClick={() => handleConfirmReject(b)}
                                        variant="destructive"
                                        size="sm"
                                        disabled={isProcessingUpdate === b.id}
                                      >
                                        {isProcessingUpdate === b.id ? (
                                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                                        ) : (
                                          <X className="h-4 w-4 mr-1" />
                                        )}
                                        Confirm
                                      </Button>
                                    </div>
                                  </div>
                                ) : (
                                  // INITIAL ACTION BUTTONS
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      className="bg-green-600 hover:bg-green-700 text-white rounded-md"
                                      onClick={() => handleApprove(b)}
                                      disabled={isProcessingUpdate === b.id}
                                    >
                                      {isProcessingUpdate === b.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        "Approve"
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      className="rounded-md"
                                      onClick={() => handleRejectClick(b.id)}
                                      disabled={isProcessingUpdate === b.id}
                                    >
                                      Reject
                                    </Button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {activeTab === "rooms" && <ManageRooms />}

            {activeTab === "resources" && <ManageResources />}

            {activeTab === "bulk" && <BulkBooking />}

            {activeTab === "all" && (
              <div className="md:col-span-3">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">All Bookings</h2>
                  <div>
                    <Button
                      onClick={fetchAllBookings}
                      variant="outline"
                      size="sm"
                      disabled={loadingAll}
                    >
                      <RefreshCw
                        className={
                          loadingAll
                            ? "h-4 w-4 animate-spin mr-2"
                            : "h-4 w-4 mr-2"
                        }
                      />
                      Refresh
                    </Button>
                  </div>
                </div>

                {/* --- FILTER CARD SECTION (MOVED ABOVE TABLE) --- */}
                <div className="bg-white border border-slate-200 rounded-xl shadow-md p-5 mb-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                      <Filter className="h-5 w-5" />
                      Filters
                    </h3>
                    {hasActiveFilters && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearFilters}
                        className="p-0 h-auto text-destructive hover:bg-transparent"
                      >
                        <X className="h-4 w-4 mr-1" />
                        Clear Filters
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    {/* Status Filter */}
                    <div className="space-y-1">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={filter.status}
                        onValueChange={(val) =>
                          handleFilterChange("status", val)
                        }
                      >
                        <SelectTrigger id="status">
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                          {/* NOTE: Statuses are normalized to lowercase by dataApi, but the list should match */}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Room Filter Section */}
                    <div className="space-y-1">
                      <Label htmlFor="room">Room</Label>
                      <Select
                        value={filter.roomId}
                        onValueChange={(val) =>
                          handleFilterChange("roomId", val)
                        }
                      >
                        <SelectTrigger id="room" className="text-sm">
                          <SelectValue placeholder="All Rooms" />
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
                        type="date"
                        value={filter.fromDate}
                        onChange={(e) =>
                          handleFilterChange("fromDate", e.target.value)
                        }
                        className="text-sm"
                      />
                    </div>

                    {/* To Date Filter */}
                    <div className="space-y-1">
                      <Label htmlFor="toDate">To Date</Label>
                      <Input
                        type="date"
                        value={filter.toDate}
                        onChange={(e) =>
                          handleFilterChange("toDate", e.target.value)
                        }
                        className="text-sm"
                      />
                    </div>
                  </div>
                </div>
                {/* --- END FILTER CARD SECTION --- */}

                {/* Table Section */}
                <div>
                  <div className="text-sm text-slate-500 mb-3">
                    Showing{" "}
                    <span className="font-semibold text-slate-900">
                      {filteredBookings.length}
                    </span>{" "}
                    results out of{" "}
                    <span className="font-semibold text-slate-900">
                      {allBookings.length}
                    </span>
                  </div>

                  <div className="overflow-auto bg-white p-4 rounded-xl border border-slate-200 shadow-md">
                    {loadingAll ? (
                      <div>Loading...</div>
                    ) : filteredBookings.length === 0 ? (
                      <div className="text-center py-8 text-slate-500">
                        No bookings match the selected filters
                      </div>
                    ) : (
                      <table className="w-full table-auto text-sm">
                        <thead className="bg-slate-50">
                          <tr className="text-left text-slate-600 border-b-2 border-slate-200">
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                              Room
                            </th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                              User
                            </th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                              Date
                            </th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                              Start
                            </th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                              End
                            </th>
                            <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredBookings.map((b) => {
                            const start = parseLocal(
                              b.date ?? b.booking_date,
                              b.start_time ?? b.startTime ?? b.start
                            );
                            const end = parseLocal(
                              b.date ?? b.booking_date,
                              b.end_time ?? b.endTime ?? b.end
                            );
                            return (
                              <tr
                                key={b.id}
                                className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors"
                              >
                                <td className="px-4 py-4 align-top font-medium">
                                  {b.room_name ?? b.roomName}
                                </td>
                                <td className="px-4 py-4 align-top text-sm text-slate-700">
                                  {b.user_name ?? b.userName}
                                </td>
                                <td className="px-4 py-4 align-top">
                                  {formatDateDMY(start)}
                                </td>
                                <td className="px-4 py-4 align-top">
                                  {start
                                    ? start.toLocaleTimeString([], {
                                        hour: "numeric",
                                        minute: "2-digit",
                                        hour12: true,
                                      })
                                    : "-"}
                                </td>
                                <td className="px-4 py-4 align-top">
                                  {end
                                    ? end.toLocaleTimeString([], {
                                        hour: "numeric",
                                        minute: "2-digit",
                                        hour12: true,
                                      })
                                    : "-"}
                                </td>
                                <td className="px-4 py-4 align-top">
                                  {statusBadge(b.status ?? b.booking_status)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "calendar" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Calendar</h2>
                  <div>
                    <Button
                      onClick={fetchAllBookings}
                      variant="outline"
                      size="sm"
                    >
                      Refresh
                    </Button>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-md">
                  <CalendarView showAll detailed />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      {/* Removed bottom CalendarView - calendar is now a sidebar tab */}
    </div>
  );
};

export default AdminDashboard;
