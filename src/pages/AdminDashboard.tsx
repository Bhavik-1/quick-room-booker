import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
// removed ApproveBookings import (we render pending inline)
import { ManageRooms } from "@/components/ManageRooms";
import { BulkBooking } from "@/components/BulkBooking";
import { getAllBookings, updateBookingStatus } from "@/lib/dataApi";
import { Calendar, LogOut, CheckSquare, Building, List, Upload } from "lucide-react";
import { toast } from "sonner";

const AdminDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"approve" | "rooms" | "all" | "bulk">(
    "approve"
  );

  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [loadingAll, setLoadingAll] = useState(false);

  const [pendingBookings, setPendingBookings] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/login");
    }
  }, [user, navigate]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const fetchAllBookings = useCallback(async () => {
    setLoadingAll(true);
    try {
      const data = await getAllBookings();
      setAllBookings(Array.isArray(data) ? data : []);
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

  useEffect(() => {
    if (activeTab === "all") fetchAllBookings();
    if (activeTab === "approve") fetchPendingBookings();
  }, [activeTab, fetchAllBookings, fetchPendingBookings]);

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
    <div className="min-h-screen bg-secondary/20">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-primary">QuickRoom Admin</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {user?.name}
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-4 gap-6">
          <aside className="space-y-2">
            <Button
              variant={activeTab === "approve" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("approve")}
            >
              <CheckSquare className="h-4 w-4 mr-2" />
              Pending Approvals
            </Button>
            <Button
              variant={activeTab === "all" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("all")}
            >
              <List className="h-4 w-4 mr-2" />
              All Bookings
            </Button>
            <Button
              variant={activeTab === "rooms" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("rooms")}
            >
              <Building className="h-4 w-4 mr-2" />
              Manage Rooms
            </Button>
            <Button
              variant={activeTab === "bulk" ? "default" : "ghost"}
              className="w-full justify-start"
              onClick={() => setActiveTab("bulk")}
            >
              <Upload className="h-4 w-4 mr-2" />
              Bulk Booking
            </Button>
          </aside>

          <div className="md:col-span-3">
            {activeTab === "approve" && (
              <div>
                <div className="flex items-center justify-between mb-4">
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

                <div className="overflow-x-auto bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                  {loadingPending ? (
                    <div>Loading pending bookings...</div>
                  ) : pendingBookings.length === 0 ? (
                    <div className="text-muted-foreground">
                      No pending bookings.
                    </div>
                  ) : (
                    <table className="w-full table-auto text-sm">
                      <thead>
                        <tr className="text-left text-slate-600">
                          <th className="px-3 py-2">Room</th>
                          <th className="px-3 py-2">User</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Start</th>
                          <th className="px-3 py-2">End</th>
                          <th className="px-3 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
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
                            <tr key={b.id} className="hover:bg-slate-50">
                              <td className="px-3 py-3 align-top font-medium">
                                {b.room_name ?? b.roomName}
                              </td>
                              <td className="px-3 py-3 align-top text-sm text-slate-700">
                                {b.user_name ?? b.userName}
                              </td>
                              <td className="px-3 py-3 align-top">
                                {formatDateDMY(start)}
                              </td>
                              <td className="px-3 py-3 align-top">
                                {start
                                  ? start.toLocaleTimeString([], {
                                      hour: "numeric",
                                      minute: "2-digit",
                                      hour12: true,
                                    })
                                  : "-"}
                              </td>
                              <td className="px-3 py-3 align-top">
                                {end
                                  ? end.toLocaleTimeString([], {
                                      hour: "numeric",
                                      minute: "2-digit",
                                      hour12: true,
                                    })
                                  : "-"}
                              </td>
                              <td className="px-3 py-3 align-top">
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => handleApprove(b)}
                                  >
                                    Approve
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
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
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">All Bookings</h2>
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-slate-500">
                      Total:{" "}
                      <span className="font-medium text-slate-700">
                        {allBookings.length}
                      </span>
                    </div>
                    <Button
                      onClick={fetchAllBookings}
                      variant="outline"
                      size="sm"
                    >
                      Refresh
                    </Button>
                  </div>
                </div>

                <div className="overflow-auto bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                  {loadingAll ? (
                    <div>Loading...</div>
                  ) : (
                    <table className="w-full table-auto text-sm">
                      <thead>
                        <tr className="text-left text-slate-600">
                          <th className="px-3 py-2">Room</th>
                          <th className="px-3 py-2">User</th>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Start</th>
                          <th className="px-3 py-2">End</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {allBookings.map((b) => {
                          const start = parseLocal(
                            b.date ?? b.booking_date,
                            b.start_time ?? b.startTime ?? b.start
                          );
                          const end = parseLocal(
                            b.date ?? b.booking_date,
                            b.end_time ?? b.endTime ?? b.end
                          );
                          return (
                            <tr key={b.id} className="hover:bg-slate-50">
                              <td className="px-3 py-3 align-top font-medium">
                                {b.room_name ?? b.roomName}
                              </td>
                              <td className="px-3 py-3 align-top text-sm text-slate-700">
                                {b.user_name ?? b.userName}
                              </td>
                              <td className="px-3 py-3 align-top">
                                {formatDateDMY(start)}
                              </td>
                              <td className="px-3 py-3 align-top">
                                {start
                                  ? start.toLocaleTimeString([], {
                                      hour: "numeric",
                                      minute: "2-digit",
                                      hour12: true,
                                    })
                                  : "-"}
                              </td>
                              <td className="px-3 py-3 align-top">
                                {end
                                  ? end.toLocaleTimeString([], {
                                      hour: "numeric",
                                      minute: "2-digit",
                                      hour12: true,
                                    })
                                  : "-"}
                              </td>
                              <td className="px-3 py-3 align-top">
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
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
