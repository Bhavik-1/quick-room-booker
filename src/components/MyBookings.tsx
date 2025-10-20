import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getMyBookings,
  getAllBookings,
  Booking as ApiBooking,
} from "@/lib/DataApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

type Booking = ApiBooking & { createdAt?: string }; // normalize naming locally

export const MyBookings = () => {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  const fetchMyBookings = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Try endpoint specifically for user's bookings first
      let fetched = [];
      try {
        fetched = await getMyBookings();
      } catch (err) {
        // If /bookings/my isn't available or fails, fallback to fetching all
        console.warn(
          "getMyBookings failed, falling back to getAllBookings",
          err
        );
        fetched = [];
      }

      // If nothing returned, try getting all and filter client-side
      if (!fetched || (Array.isArray(fetched) && fetched.length === 0)) {
        try {
          fetched = await getAllBookings();
        } catch (err) {
          console.error("getAllBookings also failed:", err);
          fetched = [];
        }
      }

      const normalized = (fetched || []).map((b: any) => normalize(b));

      // Admins see everything; students see only their bookings
      const finalList =
        user && user.role !== "admin" && user.id
          ? normalized.filter(
              (b) =>
                String(b.userId) === String(user.id) ||
                String(b.userName).toLowerCase() ===
                  String(user.name).toLowerCase()
            )
          : normalized;

      setBookings(finalList);
    } catch (err) {
      console.error("Error fetching user bookings:", err);
      toast.error("Failed to load your booking history.");
      setBookings([]);
    } finally {
      setIsRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMyBookings();
  }, [fetchMyBookings]);

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

  if (bookings === null) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold">My Bookings</h2>
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

  const bookingsList = bookings || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">My Bookings</h2>
        <Button
          size="sm"
          onClick={() => fetchMyBookings()}
          disabled={isRefreshing}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {bookingsList.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No bookings yet. Create your first booking!
          </CardContent>
        </Card>
      ) : (
        bookingsList.map((booking) => (
          <Card
            key={
              booking.id ||
              `${booking.roomId}-${booking.date}-${booking.startTime}`
            }
          >
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg">{booking.roomName}</CardTitle>
                <Badge className={getStatusColor(booking.status)}>
                  {booking.status.toUpperCase()}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">
                    {booking.date
                      ? new Date(booking.date).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Time</p>
                  <p className="font-medium">
                    {booking.startTime || "—"} - {booking.endTime || "—"}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-muted-foreground">Purpose</p>
                  <p className="font-medium">{booking.purpose || "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
};
