import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { BulkBooking } from "@/components/BulkBooking";
import { getAllBookings, updateBookingStatus, getRooms } from "@/lib/dataApi";
import {
  Calendar,
  LogOut,
  CheckSquare,
  Building,
  List,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import CalendarView from "./CalendarView";

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<
    "approve" | "rooms" | "all" | "bulk" | "calendar"
  >("approve");

  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  // Filter state for All Bookings tab
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedRoomFilter, setSelectedRoomFilter] = useState("all");
  const [filteredBookings, setFilteredBookings] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/login");
    }
  }, [user, navigate]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const fetchAllBookings = useCallback(async () => {
    setLoadingAll(true);
    try {
      const data = await getAllBookings();
      const bookings = Array.isArray(data) ? data : [];
      setAllBookings(bookings);
      setFilteredBookings(bookings);
    } catch (err) {
      console.error("Failed to fetch all bookings", err);
      toast.error("Failed to load bookings");
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
    if (activeTab === "all") {
      fetchAllBookings();
      fetchRooms();
      // Reset filters when tab becomes active
      setFromDate("");
      setToDate("");
      setSelectedRoomFilter("all");
    }
    if (activeTab === "approve") fetchPendingBookings();
  }, [activeTab, fetchAllBookings, fetchPendingBookings, fetchRooms]);

  const handleApplyFilters = () => {
    let filtered = [...allBookings];

    // Apply date filters
    if (fromDate || toDate) {
      filtered = filtered.filter((b) => {
        const bookingDateStr = b.date ?? b.booking_date;
        if (!bookingDateStr) return false;

        // Extract date portion (YYYY-MM-DD)
        let dateOnly = bookingDateStr;
        if (bookingDateStr.includes("T")) {
          dateOnly = bookingDateStr.split("T")[0];
        }

        const bookingDate = new Date(dateOnly);
        if (isNaN(bookingDate.getTime())) return false;

        // Compare dates
        if (fromDate) {
          const from = new Date(fromDate);
          if (bookingDate < from) return false;
        }
        if (toDate) {
          const to = new Date(toDate);
          if (bookingDate > to) return false;
        }

        return true;
      });
    }

    // Apply room filter
    if (selectedRoomFilter !== "all") {
      filtered = filtered.filter(
        (b) =>
          String(b.room_id ?? b.roomId) === String(selectedRoomFilter)
      );
    }

    setFilteredBookings(filtered);
    toast.success("Filters applied");
  };

  const handleResetFilters = () => {
    setFromDate("");
    setToDate("");
    setSelectedRoomFilter("all");
    setFilteredBookings(allBookings);
    toast.success("Filters cleared");
  };

  // Helper: parse backend date + time into a local Date (handles ISO datetime or date + time)
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
      await updateBookingStatus(String(booking.id), "approved", approvedAt);
      toast.success("Booking approved");
      // refresh list
      await fetchPendingBookings();
      await fetchAllBookings();
    } catch (err) {
      console.error("Approve failed", err);
      toast.error("Failed to approve booking");
    }
  };

  const handleReject = async (booking: any) => {
    try {
      const rejectedAt = new Date().toISOString();
      await updateBookingStatus(String(booking.id), "rejected", rejectedAt);
      toast.success("Booking rejected");
      await fetchPendingBookings();
      await fetchAllBookings();
    } catch (err) {
      console.error("Reject failed", err);
      toast.error("Failed to reject booking");
    }
  };

  // format date as dd/mm/yyyy
  const formatDateDMY = (d?: Date | null) => {
    if (!d) return "-";
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
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
            <Button variant="outline" size="sm" onClick={handleLogout} className="hover:bg-slate-100 transition">
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
              variant={activeTab === "bulk" ? "default" : "ghost"}
              className={`w-full justify-start ${
                activeTab === "bulk"
                  ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => setActiveTab("bulk")}
            >
              <Upload className="h-4 w-4 mr-2" />
              Bulk Booking
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
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Room</th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">User</th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Date</th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Start</th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">End</th>
                          <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Actions</th>
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
                            <tr key={b.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors">
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
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white rounded-md"
                                    onClick={() => handleApprove(b)}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="rounded-md"
                                    onClick={() => handleReject(b)}
                                  >
                                    Reject
                                  </Button>
                                </div>
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

            {activeTab === "bulk" && <BulkBooking />}

            {activeTab === "all" && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">All Bookings</h2>
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

                <div className="flex gap-6">
                  {/* Filter Sidebar */}
                  <aside className="w-60 flex-shrink-0">
                    <div className="bg-white border border-slate-200 rounded-xl shadow-md p-5">
                      <h3 className="text-base font-semibold text-slate-900 mb-4">
                        Filters
                      </h3>

                      {/* Date Range Section */}
                      <div className="mb-4">
                        <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
                          Date Range
                        </Label>
                        <div className="space-y-2">
                          <Input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="text-sm"
                            placeholder="From date"
                          />
                          <Input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="text-sm"
                            placeholder="To date"
                          />
                        </div>
                      </div>

                      {/* Room Filter Section */}
                      <div className="mb-5">
                        <Label className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2 block">
                          Room
                        </Label>
                        <Select
                          value={selectedRoomFilter}
                          onValueChange={setSelectedRoomFilter}
                        >
                          <SelectTrigger className="text-sm">
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

                      {/* Action Buttons */}
                      <div className="space-y-2">
                        <Button
                          onClick={handleApplyFilters}
                          className="w-full bg-blue-600 hover:bg-blue-700"
                          size="sm"
                        >
                          Apply Filters
                        </Button>
                        <Button
                          onClick={handleResetFilters}
                          variant="outline"
                          className="w-full"
                          size="sm"
                        >
                          Reset
                        </Button>
                      </div>
                    </div>
                  </aside>

                  {/* Table Section */}
                  <div className="flex-1">
                    <div className="text-sm text-slate-500 mb-3">
                      Showing{" "}
                      <span className="font-semibold text-slate-900">
                        {filteredBookings.length}
                      </span>{" "}
                      results
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
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Room</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">User</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Date</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Start</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">End</th>
                              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider">Status</th>
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
                                <tr key={b.id} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50 transition-colors">
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
