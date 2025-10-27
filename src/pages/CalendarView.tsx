import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { getAllBookings, getVisibleBookings } from "@/lib/dataApi";
import { Calendar, LogOut, ArrowLeft } from "lucide-react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

type Booking = {
  id: string;
  title?: string;
  room?: string;
  roomName?: string;
  user?: { id: string; name: string; email?: string };
  userName?: string;
  userId?: string;
  start?: string;
  end?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  purpose?: string;
  notes?: string;
  duration?: number;
  // ...other fields...
};

const CalendarView = ({
  showAll = false,
  detailed = false,
}: {
  showAll?: boolean;
  detailed?: boolean;
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const calendarRef = useRef<any>(null);

  const normalize = (b: any) => ({
    id: String(b.id ?? b._id ?? ""),
    roomName: b.roomName ?? b.room?.name ?? b.room_name ?? "Room",
    userName:
      b.userName ?? b.user?.name ?? b.user_name ?? b.created_by_name ?? "User",
    userId: b.userId ?? b.user?._id ?? b.user_id ?? "",
    date: b.date ?? b.booking_date ?? b.when ?? b.start_date ?? "",
    startTime:
      b.startTime ??
      b.start_time ??
      b.time?.start ??
      b.start ??
      b.startTimeIso ??
      "",
    endTime:
      b.endTime ?? b.end_time ?? b.time?.end ?? b.end ?? b.endTimeIso ?? "",
    status: (b.status ?? b.booking_status ?? "pending").toString(),
    purpose: b.purpose ?? b.title ?? b.reason ?? "",
    duration: Number(b.duration ?? b.hours ?? 0),
    // ...other fields...
  });

  // Build a local "YYYY-MM-DDTHH:mm:ss" (no timezone) string so FullCalendar treats it as local
  const toLocalIsoNoTZ = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  // returns local ISO string (no timezone) or null
  const parseDateTime = (dateStr?: string, timeStr?: string): string | null => {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      // If dateStr is a full ISO datetime and timeStr is provided, extract date part
      if (!isNaN(d.getTime()) && dateStr.includes("T") && timeStr) {
        const dateOnly = dateStr.split("T")[0]; // YYYY-MM-DD
        const dateMatch = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const timeMatch = String(timeStr)
          .trim()
          .match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
        if (dateMatch && timeMatch) {
          let year = Number(dateMatch[1]);
          let month = Number(dateMatch[2]) - 1;
          let day = Number(dateMatch[3]);
          let hour = Number(timeMatch[1]);
          const minute = Number(timeMatch[2]);
          const second = Number(timeMatch[3] ?? 0);
          const ampm = String(timeStr).match(/\b(am|pm)\b/i);
          if (ampm) {
            const ap = ampm[1].toLowerCase();
            if (ap === "pm" && hour < 12) hour += 12;
            if (ap === "am" && hour === 12) hour = 0;
          }
          // The issue might be in date construction, using UTC methods then forcing local
          // Simplified conversion by using Date(year, month, day, ...)
          const local = new Date(year, month, day, hour, minute, second);
          return toLocalIsoNoTZ(local);
        }
      }

      // If dateStr is YYYY-MM-DD and timeStr present -> construct local Date
      const dateMatch2 = String(dateStr).match(/^(\d{4})-(\d{2})-(\d{2})/);
      const timeMatch2 = timeStr?.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/i);
      if (dateMatch2 && timeMatch2) {
        let year = Number(dateMatch2[1]);
        let month = Number(dateMatch2[2]) - 1;
        let day = Number(dateMatch2[3]);
        let hour = Number(timeMatch2[1]);
        const minute = Number(timeMatch2[2]);
        const second = Number(timeMatch2[3] ?? 0);
        const ampm = String(timeStr).match(/\b(am|pm)\b/i);
        if (ampm) {
          const ap = ampm[1].toLowerCase();
          if (ap === "pm" && hour < 12) hour += 12;
          if (ap === "am" && hour === 12) hour = 0;
        }
        const local = new Date(year, month, day, hour, minute, second);
        return toLocalIsoNoTZ(local);
      }

      // If dateStr is a full ISO datetime and no separate time -> use local equivalent
      if (!isNaN(d.getTime()) && dateStr.includes("T") && !timeStr) {
        // convert to local components to avoid UTC shift issues
        const local = new Date(d.getTime());
        return toLocalIsoNoTZ(local);
      }

      // fallback combine and parse
      const combined = new Date(`${dateStr} ${timeStr ?? ""}`.trim());
      if (!isNaN(combined.getTime())) return toLocalIsoNoTZ(combined);
    } catch (err) {
      // ignore
    }
    return null;
  };

  // parse local "YYYY-MM-DDTHH:mm:ss" (no TZ) into local Date object
  const parseLocalIsoNoTZToDate = (isoNoTZ?: string): Date | null => {
    if (!isoNoTZ) return null;
    const [datePart, timePart = "00:00:00"] = isoNoTZ.split("T");
    const dateMatch = datePart?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) return null;
    const [year, month, day] = [
      Number(dateMatch[1]),
      Number(dateMatch[2]),
      Number(dateMatch[3]),
    ];
    const [hh = "00", mm = "00", ss = "00"] = timePart.split(":");
    // Note: month is 1-indexed from regex, but Date expects 0-indexed
    return new Date(
      year,
      month - 1,
      day ,
      Number(hh),
      Number(mm),
      Number(ss)
    );
  };

  const pad2 = (n: number) => String(n).padStart(2, "0");

  const handleDatesSet = useCallback(
    (arg: any) => {
      try {
        const api = calendarRef.current?.getApi?.();
        if (!api) return;

        // view window
        const viewStart: Date = arg.start;
        const viewEnd: Date = arg.end;

        // build candidate start Date objects from bookings (bookings use start as local-ISO no tz)
        const candidates = bookings
          .map((b) => {
            const d = parseLocalIsoNoTZToDate(b.start);
            return { b, d };
          })
          .filter((x) => x.d && x.d >= viewStart && x.d < viewEnd)
          .map((x) => x.d as Date);

        let scrollHour = "06:00:00"; // default

        if (candidates.length > 0) {
          // earliest event start
          const earliest = candidates.reduce(
            (a, c) => (a < c ? a : c),
            candidates[0]
          );
          scrollHour = `${pad2(earliest.getHours())}:${pad2(
            earliest.getMinutes()
          )}:00`;
        }

        // set FullCalendar scrollTime option to scroll to the desired time
        // setOption is available on the API; update in a rAF to allow the view DOM to settle
        requestAnimationFrame(() => {
          try {
            api.setOption && api.setOption("scrollTime", scrollHour);
            // force a size update so the scroller applies the new scrollTime
            api.updateSize && api.updateSize();
          } catch (err) {
            // fallback: nothing
            // console.warn("Failed to set scrollTime", err);
          }
        });
      } catch (err) {
        // ignore
      }
    },
    [bookings]
  );

  useEffect(() => {
    const fetchBookings = async () => {
      setIsLoading(true);
      try {
        let fetched: any[] = [];
        if (user?.role === "admin") {
          // admin gets all bookings with full details
          fetched = await getAllBookings();
        } else {
          // non-admins get visible (own full + anonymized approved)
          fetched = await getVisibleBookings();
        }

        // normalize all bookings
        const normalized = (fetched || []).map((b) => normalize(b));

        // filter out rejected and pending bookings for display on calendar
        const mapped = normalized
          .map((b) => {
            const startIso = parseDateTime(b.date, b.startTime);
            const endIso = parseDateTime(b.date, b.endTime);
            if (!startIso || !endIso) {
              console.warn(
                "Dropping booking (invalid date/time) for calendar:",
                b
              );
              return null;
            }
            return {
              ...b,
              start: startIso,
              end: endIso,
            };
          })
          .filter(Boolean)
          .filter(
            (b) => b!.status === "approved" || b!.status === "booked"
          ) as any[];

        setBookings(mapped);
      } catch (err) {
        console.error(err);
        toast.error("Failed to load calendar events");
      } finally {
        setIsLoading(false);
      }
    };

    fetchBookings();
  }, [user]);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const events = bookings.map((b) => ({
    id: b.id,
    title: `${b.roomName} - ${b.userName}`,
    start: b.start,
    end: b.end,
    backgroundColor:
      b.status === "approved" || b.status === "booked"
        ? "#22c55e"
        : b.status === "rejected"
        ? "#ef4444"
        : "#eab308",
    borderColor:
      b.status === "approved" || b.status === "booked"
        ? "#16a34a"
        : b.status === "rejected"
        ? "#dc2626"
        : "#ca8a04",
    extendedProps: b,
  }));

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

  const formatTimeAMPM = (timeStr: string) => {
    if (!timeStr) return "";
    const [hourStr, minuteStr] = timeStr.split(":");
    let hour = Number(hourStr);
    const minute = Number(minuteStr);
    const ampm = hour >= 12 ? "PM" : "AM";
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${hour}:${minute.toString().padStart(2, "0")} ${ampm}`;
  };

  const formatDateDMY = (dateStr: string) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const renderCalendar = () => (
    <div className="bg-card p-6 rounded-xl border border-slate-200 shadow-md">
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        events={events}
        eventClick={(info) => setSelectedEvent(info.event.extendedProps)}
        datesSet={handleDatesSet}
        height="auto"
        timeZone="local"
        // Show events stacked (no horizontal overlap) so they are readable
        slotEventOverlap={false}
        // Start day/time grid at 06:00 and use 15m slots for better vertical resolution
        slotMinTime={"06:00:00"}
        slotDuration={"00:15:00"}
        // Put current user's events first, then approved/booked, then pending/rejected, then by start time
        eventOrder={(a: any, b: any) => {
          const myId = String(user?.id ?? (user as any)?._id ?? "");
          const aUser = String(
            a.extendedProps?.userId ?? a.extendedProps?.user_id ?? ""
          );
          const bUser = String(
            b.extendedProps?.userId ?? b.extendedProps?.user_id ?? ""
          );
          const aIsMine = aUser && aUser === myId;
          const bIsMine = bUser && bUser === myId;
          if (aIsMine && !bIsMine) return -1;
          if (!aIsMine && bIsMine) return 1;
          const order = { approved: 0, booked: 0, pending: 1, rejected: 2 };
          const sa =
            order[(a.extendedProps?.status as string) ?? "pending"] ?? 3;
          const sb =
            order[(b.extendedProps?.status as string) ?? "pending"] ?? 3;
          if (sa !== sb) return sa - sb;
          const ta = new Date(a.start).getTime();
          const tb = new Date(b.start).getTime();
          return ta - tb;
        }}
        // Keep month cells tidy
        dayMaxEventRows={3}
        // Render event blocks allowing wrapping so text doesn't truncate
        eventContent={(arg) => {
          const { roomName, userName, startTime, endTime, status } =
            arg.event.extendedProps;
          const bgColor =
            status === "approved" || status === "booked"
              ? "#22c55e"
              : status === "rejected"
              ? "#ef4444"
              : "#eab308";
          const textColor =
            status === "approved" ||
            status === "booked" ||
            status === "rejected"
              ? "#ffffff"
              : "#000000";

          return (
            <div
              style={{
                padding: "0.25rem",
                borderRadius: 6,
                backgroundColor: bgColor,
                color: textColor,
                fontSize: "0.75rem",
                lineHeight: 1.1,
                whiteSpace: "normal",
                wordBreak: "break-word",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <strong style={{ fontSize: "0.82rem", marginBottom: 2 }}>
                {roomName}
              </strong>
              <span style={{ fontSize: "0.72rem", opacity: 0.95 }}>
                {userName}
              </span>
              <small style={{ fontSize: "0.68rem", opacity: 0.9 }}>
                {formatTimeAMPM(startTime)} - {formatTimeAMPM(endTime)}
              </small>
            </div>
          );
        }}
      />
    </div>
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-8">
        <Skeleton className="h-10 w-full mb-8" />
        <Skeleton className="h-[600px] w-full rounded-lg" />
      </div>
    );
  }

  // --- Conditional Rendering based on `detailed` prop ---
  if (detailed) {
    // Rendered when embedded in AdminDashboard, only render the calendar and dialog
    return (
      <>
        {renderCalendar()}
        <Dialog
          open={!!selectedEvent}
          onOpenChange={() => setSelectedEvent(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Booking Details</DialogTitle>
            </DialogHeader>
            {selectedEvent && (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-lg text-slate-900">
                    {selectedEvent.roomName}
                  </h3>
                  <Badge className={getStatusColor(selectedEvent.status)}>
                    {selectedEvent.status?.toUpperCase()}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Booked by
                    </p>
                    <p className="font-medium text-slate-900">
                      {selectedEvent.userName}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Date
                    </p>
                    <p className="font-medium text-slate-900">
                      {formatDateDMY(selectedEvent.date)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Time
                    </p>
                    <p className="font-medium text-slate-900">
                      {formatTimeAMPM(selectedEvent.startTime)} -{" "}
                      {formatTimeAMPM(selectedEvent.endTime)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase tracking-wide">
                      Purpose
                    </p>
                    <p className="font-medium text-slate-900">
                      {selectedEvent.purpose}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Standalone page rendering (original structure with full header and page wrapper)
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-card border-b border-border shadow-md">
        <div className="container mx-auto px-4 py-5 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                navigate(user?.role === "admin" ? "/admin" : "/dashboard")
              }
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-primary">Calendar View</h1>
            </div>
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

      <div className="container mx-auto px-4 py-8">{renderCalendar()}</div>

      <Dialog
        open={!!selectedEvent}
        onOpenChange={() => setSelectedEvent(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-lg text-slate-900">
                  {selectedEvent.roomName}
                </h3>
                <Badge className={getStatusColor(selectedEvent.status)}>
                  {selectedEvent.status?.toUpperCase()}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">
                    Booked by
                  </p>
                  <p className="font-medium text-slate-900">
                    {selectedEvent.userName}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">
                    Date
                  </p>
                  <p className="font-medium text-slate-900">
                    {formatDateDMY(selectedEvent.date)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">
                    Time
                  </p>
                  <p className="font-medium text-slate-900">
                    {formatTimeAMPM(selectedEvent.startTime)} -{" "}
                    {formatTimeAMPM(selectedEvent.endTime)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs uppercase tracking-wide">
                    Purpose
                  </p>
                  <p className="font-medium text-slate-900">
                    {selectedEvent.purpose}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarView;
