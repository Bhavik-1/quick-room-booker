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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { getRooms, getResources, addBooking, checkResourceAvailability, Room, Resource } from "@/lib/dataApi";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const BookingForm = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [resources, setResources] = useState<Resource[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedResources, setSelectedResources] = useState<Record<string, number>>({});
  const [availabilityWarning, setAvailabilityWarning] = useState<string | null>(null);
  const [showWarningDialog, setShowWarningDialog] = useState(false);

  // State for form inputs
  const [formData, setFormData] = useState({
    roomId: "",
    date: "",
    startTime: "",
    duration: "1",
    purpose: "",
  });

  // --- Data Fetching Effect ---
  const fetchData = async () => {
    try {
      const [fetchedRooms, fetchedResources] = await Promise.all([
        getRooms(),
        getResources()
      ]);
      setRooms(fetchedRooms);
      setResources(fetchedResources);
      // Automatically select the first room if available
      if (fetchedRooms.length > 0) {
        setFormData((f) => ({ ...f, roomId: String(fetchedRooms[0].id) }));
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data.");
      setRooms([]);
      setResources([]);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Resource Selection Handlers ---
  const handleResourceToggle = (resourceId: string, checked: boolean) => {
    if (checked) {
      setSelectedResources({ ...selectedResources, [resourceId]: 1 });
    } else {
      const updated = { ...selectedResources };
      delete updated[resourceId];
      setSelectedResources(updated);
    }
  };

  const handleQuantityChange = (resourceId: string, quantity: number) => {
    if (quantity > 0) {
      setSelectedResources({ ...selectedResources, [resourceId]: quantity });
    }
  };

  // --- Availability Check ---
  const checkAvailability = async () => {
    if (Object.keys(selectedResources).length === 0) {
      return true; // No resources selected, proceed
    }

    const durationHours = parseInt(formData.duration);
    const endTime = new Date(`${formData.date}T${formData.startTime}`);
    endTime.setHours(endTime.getHours() + durationHours);
    const endTimeStr = endTime.toTimeString().slice(0, 5);

    const resourceRequests = Object.entries(selectedResources).map(([resourceId, quantity]) => ({
      resourceId,
      quantity
    }));

    const availability = await checkResourceAvailability(
      resourceRequests,
      formData.date,
      formData.startTime,
      endTimeStr
    );

    if (!availability.available) {
      // Build warning message
      const unavailable = availability.resources
        .filter((r: any) => !r.sufficient)
        .map((r: any) => `${r.resourceName} (requested: ${r.requested}, available: ${r.available})`)
        .join(", ");

      setAvailabilityWarning(`These resources are not fully available: ${unavailable}`);
      setShowWarningDialog(true);
      return false;
    }

    return true;
  };

  // --- Submission Handler ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || rooms === null || isSubmitting) return;

    // Check resource availability
    const isAvailable = await checkAvailability();
    if (!isAvailable) {
      return; // Show warning dialog, wait for user decision
    }

    await submitBooking();
  };

  const submitBooking = async () => {
    setIsSubmitting(true);

    try {
      // 1. Calculate End Time
      const durationHours = parseInt(formData.duration);
      const endTime = new Date(`${formData.date}T${formData.startTime}`);
      endTime.setHours(endTime.getHours() + durationHours);
      const endTimeStr = endTime.toTimeString().slice(0, 5);

      // 2. Find Room Details
      const room = rooms!.find((r) => r.id === formData.roomId);
      if (!room) {
        toast.error("Please select a valid room.");
        return;
      }

      // 3. Prepare resource payload
      const resourcesPayload = Object.entries(selectedResources).map(([resourceId, quantity]) => ({
        resourceId,
        quantity
      }));

      // 4. Prepare Payload
      const payload = {
        userId: user!.id,
        userName: user!.name,
        roomId: formData.roomId,
        roomName: room.name,
        date: formData.date,
        startTime: formData.startTime,
        endTime: endTimeStr,
        duration: durationHours,
        purpose: formData.purpose,
        resources: resourcesPayload.length > 0 ? resourcesPayload : undefined,
      };

      // 5. Submit Booking to API
      await addBooking(payload);

      toast.success("Booking request submitted successfully!");

      // Reset form
      setFormData((f) => ({
        ...f,
        date: "",
        startTime: "",
        duration: "1",
        purpose: "",
      }));
      setSelectedResources({});
      setAvailabilityWarning(null);
    } catch (error: any) {
      console.error("Booking submission failed:", error);
      const message = error.response?.data?.message || "A network or server error occurred.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const roomsList = rooms || [];
  const resourcesList = resources || [];

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
    <>
      {showWarningDialog && (
        <Dialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resource Availability Warning</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {availabilityWarning}
              </p>
              <p className="text-sm">
                Would you like to proceed with this booking anyway, or go back and adjust your resource selection?
              </p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowWarningDialog(false)}>
                  Go Back
                </Button>
                <Button onClick={() => {
                  setShowWarningDialog(false);
                  submitBooking();
                }}>
                  Proceed Anyway
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

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

        {/* Resource Selection Section */}
        {resourcesList.length > 0 && (
          <div className="space-y-2">
            <Label>Optional Resources</Label>
            <div className="border rounded-lg p-4 space-y-3">
              {resourcesList.map((resource) => {
                const isSelected = selectedResources[resource.id] !== undefined;
                return (
                  <div key={resource.id} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id={`resource-${resource.id}`}
                      checked={isSelected}
                      onChange={(e) => handleResourceToggle(resource.id, e.target.checked)}
                      className="w-4 h-4"
                    />
                    <Label htmlFor={`resource-${resource.id}`} className="flex-1 cursor-pointer">
                      {resource.name} ({resource.type}) - Available: {resource.total_quantity}
                    </Label>
                    {isSelected && (
                      <Input
                        type="number"
                        min="1"
                        max={resource.total_quantity}
                        value={selectedResources[resource.id]}
                        onChange={(e) => handleQuantityChange(resource.id, parseInt(e.target.value))}
                        className="w-20"
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Resources are optional. Select only if needed for your booking.
            </p>
          </div>
        )}

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
    </>
  );
};
