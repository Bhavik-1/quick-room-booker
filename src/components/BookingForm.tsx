import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { getRooms, addBooking, Room } from "@/lib/dataApi";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const BookingForm = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State for form inputs
  const [formData, setFormData] = useState({
    roomId: "",
    date: "",
    startTime: "",
    duration: "1",
    purpose: "",
  });

  // --- Data Fetching Effect ---
  const fetchRooms = async () => {
    try {
      const fetchedRooms = await getRooms();
      setRooms(fetchedRooms);
      // Automatically select the first room if available
      if (fetchedRooms.length > 0) {
        setFormData((f) => ({ ...f, roomId: String(fetchedRooms[0].id) }));
      }
    } catch (error) {
      console.error("Error fetching rooms:", error);
      toast.error("Failed to load rooms list.");
      setRooms([]); // Set to empty array on error
    }
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  // --- Submission Handler ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || rooms === null || isSubmitting) return;

    setIsSubmitting(true);

    try {
      // 1. Calculate End Time
      const durationHours = parseInt(formData.duration);
      const endTime = new Date(`${formData.date}T${formData.startTime}`);
      endTime.setHours(endTime.getHours() + durationHours);
      // Format time back to HH:mm string for the backend
      const endTimeStr = endTime.toTimeString().slice(0, 5);

      // 2. Find Room Details
      const room = rooms.find((r) => r.id === formData.roomId);
      if (!room) {
        toast.error("Please select a valid room.");
        return;
      }

      // 3. Prepare Payload
      const payload = {
        userId: user.id, // For context/logging, though backend uses JWT ID
        userName: user.name, // For database storage/quick retrieval
        roomId: formData.roomId,
        roomName: room.name,
        date: formData.date,
        startTime: formData.startTime,
        endTime: endTimeStr,
        duration: durationHours,
        purpose: formData.purpose,
      };

      // 4. Submit Booking to API
      await addBooking(payload);

      toast.success(
        "Booking request submitted successfully! Awaiting admin approval."
      );
      setFormData((f) => ({
        ...f,
        date: "",
        startTime: "",
        duration: "1",
        purpose: "",
      })); // Reset form
    } catch (error: any) {
      console.error("Booking submission failed:", error);
      // Try to extract a specific error message from the backend response
      const message =
        error.response?.data?.message || "A network or server error occurred.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const roomsList = rooms || [];

  // --- Render Loading State or Empty State ---

  if (rooms === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-4" />
        <Skeleton className="h-10" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-10" />
          <Skeleton className="h-10" />
        </div>
        <Skeleton className="h-10" />
        <Skeleton className="h-20" />
        <Skeleton className="h-10" />
      </div>
    );
  }

  if (roomsList.length === 0) {
    return (
      <p className="text-center text-muted-foreground p-8 border rounded-lg">
        No rooms available for booking. Please contact an admin.
      </p>
    );
  }

  // --- Render Form ---
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="room">Room</Label>
        <Select
          value={formData.roomId}
          onValueChange={(value) => setFormData({ ...formData, roomId: value })}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a room" />
          </SelectTrigger>
          <SelectContent>
            {roomsList.map((room) => (
              <SelectItem key={room.id} value={room.id}>
                {room.name} (Capacity: {room.capacity})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            // Only allow booking for today or future dates
            min={new Date().toISOString().split("T")[0]}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="time">Start Time</Label>
          <Input
            id="time"
            type="time"
            value={formData.startTime}
            onChange={(e) =>
              setFormData({ ...formData, startTime: e.target.value })
            }
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="duration">Duration (hours)</Label>
        <Select
          value={formData.duration}
          onValueChange={(value) =>
            setFormData({ ...formData, duration: value })
          }
          required
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6].map((hour) => (
              <SelectItem key={hour} value={hour.toString()}>
                {hour} hour{hour > 1 ? "s" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="purpose">Purpose</Label>
        <Textarea
          id="purpose"
          value={formData.purpose}
          onChange={(e) =>
            setFormData({ ...formData, purpose: e.target.value })
          }
          placeholder="Describe the purpose of your booking..."
          required
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Submitting...
          </>
        ) : (
          "Submit Booking Request"
        )}
      </Button>
    </form>
  );
};
