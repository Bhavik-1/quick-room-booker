import { useState, useEffect } from "react";
import { getAllBookings, updateBookingStatus, Booking } from "@/lib/dataApi"; // <-- UPDATED IMPORT
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Check, X, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton"; // Assuming Skeleton is available

export const ApproveBookings = () => {
  // Initialize as null to signal loading, or empty array once data is fetched
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null); // To track which booking is being processed
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>("");

  // --- Data Fetching Logic ---
  const fetchBookings = async () => {
    try {
      const fetchedBookings = await getAllBookings();
      setBookings(fetchedBookings);
    } catch (error) {
      console.error("Error fetching all bookings:", error);
      toast.error("Failed to load bookings for approval.");
      setBookings([]);
    }
  };

  // Fetch bookings once on component mount
  useEffect(() => {
    fetchBookings();
  }, []);

  // --- Action Handlers ---

  const handleUpdateStatus = async (
    id: string,
    status: "approved" | "rejected"
  ) => {
    // Prevent multiple clicks while processing
    if (isProcessing) return;

    setIsProcessing(id);

    try {
      // 1. Send status update to backend API
      await updateBookingStatus(id, status);

      // 2. Refresh the local state by fetching the latest data
      await fetchBookings();

      toast.success(`Booking successfully ${status}.`);
    } catch (error: any) {
      console.error(`Failed to update booking status for ${id}:`, error);
      const message =
        error.response?.data?.message || "Update failed due to a server error.";
      toast.error(message);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleApprove = (id: string) => handleUpdateStatus(id, "approved");

  const handleRejectClick = (id: string) => {
    setRejectingId(id);
    setRejectionReason("");
  };

  const handleCancelReject = () => {
    setRejectingId(null);
    setRejectionReason("");
  };

  const handleConfirmReject = async (id: string) => {
    if (isProcessing) return;

    setIsProcessing(id);

    try {
      await updateBookingStatus(
        id,
        "rejected",
        rejectionReason.trim() || undefined
      );
      await fetchBookings();
      toast.success("Booking rejected.");
      setRejectingId(null);
      setRejectionReason("");
    } catch (error: any) {
      console.error(`Failed to reject booking ${id}:`, error);
      const message =
        error.response?.data?.message ||
        "Rejection failed due to a server error.";
      toast.error(message);
    } finally {
      setIsProcessing(null);
    }
  };

  // --- Helper Functions ---
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

  // Handle loading state
  if (bookings === null) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Approve Bookings</h2>
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const pendingBookings = bookings.filter((b) => b.status === "pending");
  const otherBookings = bookings.filter((b) => b.status !== "pending");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pending Approvals ({pendingBookings.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingBookings.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No pending bookings
            </p>
          ) : (
            pendingBookings.map((booking) => (
              <div
                key={booking.id}
                className="border border-border rounded-lg p-4"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">
                      {booking.roomName}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Requested by: {booking.userName}
                    </p>
                  </div>
                  <Badge className={getStatusColor(booking.status)}>
                    {booking.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Date</p>
                    <p className="font-medium">
                      {new Date(booking.date).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Time</p>
                    <p className="font-medium">
                      {booking.startTime} - {booking.endTime}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Duration</p>
                    <p className="font-medium">
                      {booking.duration} hour{booking.duration > 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="mb-4">
                  <p className="text-muted-foreground text-sm">Purpose</p>
                  <p className="text-sm">{booking.purpose}</p>
                </div>
                {rejectingId === booking.id ? (
                  <div>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Enter rejection reason (optional)"
                      rows={3}
                      className="w-full border border-border rounded-md p-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={handleCancelReject}
                        variant="outline"
                        disabled={isProcessing === booking.id}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={() => handleConfirmReject(booking.id)}
                        variant="destructive"
                        disabled={isProcessing === booking.id}
                      >
                        {isProcessing === booking.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : null}
                        Confirm Rejection
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(booking.id)}
                      className="bg-success hover:bg-success/90"
                      disabled={isProcessing === booking.id}
                    >
                      {isProcessing === booking.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Check className="h-4 w-4 mr-2" />
                      )}
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleRejectClick(booking.id)}
                      variant="destructive"
                      disabled={isProcessing === booking.id}
                    >
                      <X className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {otherBookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All Bookings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {otherBookings.map((booking) => (
              <div
                key={booking.id}
                className="border border-border rounded-lg p-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{booking.roomName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {booking.userName}
                    </p>
                  </div>
                  <Badge className={getStatusColor(booking.status)}>
                    {booking.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Date & Time</p>
                    <p>
                      {new Date(booking.date).toLocaleDateString()} •{" "}
                      {booking.startTime} - {booking.endTime}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
