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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import {
  getRooms,
  getResources,
  addBooking,
  createRecurringBooking,
  checkResourceAvailability,
  Room,
  Resource,
} from "@/lib/dataApi";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  addDays,
  addWeeks,
  addMonths,
  differenceInDays,
  parseISO,
  format,
} from "date-fns";

export const BookingForm = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [resources, setResources] = useState<Resource[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedResources, setSelectedResources] = useState<
    Record<string, number>
  >({});
  const [availabilityWarning, setAvailabilityWarning] = useState<string | null>(
    null
  );
  const [showWarningDialog, setShowWarningDialog] = useState(false);

  // State for form inputs
  const [formData, setFormData] = useState({
    roomId: "",
    date: "",
    startTime: "",
    duration: "1",
    purpose: "",
  });

  // Recurring booking state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrencePattern, setRecurrencePattern] = useState<
    "daily" | "weekly" | "monthly"
  >("weekly");
  const [endDate, setEndDate] = useState("");
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [recurringResult, setRecurringResult] = useState<any>(null);

  // --- Data Fetching Effect ---
  const fetchData = async () => {
    try {
      const [fetchedRooms, fetchedResources] = await Promise.all([
        getRooms(),
        getResources(),
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

  // --- Calculate Recurring Preview ---
  const calculateRecurringPreview = () => {
    if (!isRecurring || !formData.date || !endDate) {
      return null;
    }

    const start = parseISO(formData.date);
    const end = parseISO(endDate);

    // Validate dates
    if (end <= start) {
      return { count: 0, description: "End date must be after start date" };
    }

    const daysDiff = differenceInDays(end, start);
    if (daysDiff > 90) {
      return { count: 0, description: "Maximum 3 months allowed" };
    }

    // Count occurrences
    let count = 0;
    let currentDate = start;

    while (currentDate <= end) {
      count++;
      if (recurrencePattern === "daily") {
        currentDate = addDays(currentDate, 1);
      } else if (recurrencePattern === "weekly") {
        currentDate = addWeeks(currentDate, 1);
      } else if (recurrencePattern === "monthly") {
        currentDate = addMonths(currentDate, 1);
      }
    }

    // Generate description
    const patternText =
      recurrencePattern === "daily"
        ? "daily"
        : recurrencePattern === "weekly"
        ? `every ${format(start, "EEEE")}`
        : `every ${format(start, "do")} of the month`;

    const description = `${count} bookings: ${patternText} from ${format(
      start,
      "MMM d"
    )} to ${format(end, "MMM d, yyyy")}`;

    return { count, description };
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

    const resourceRequests = Object.entries(selectedResources).map(
      ([resourceId, quantity]) => ({
        resourceId,
        quantity,
      })
    );

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
        .map(
          (r: any) =>
            `${r.resourceName} (requested: ${r.requested}, available: ${r.available})`
        )
        .join(", ");

      setAvailabilityWarning(
        `These resources are not fully available: ${unavailable}`
      );
      setShowWarningDialog(true);
      return false;
    }

    return true;
  };

  // --- Submission Handler ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || rooms === null || isSubmitting) return;

    // Check resource availability for single bookings only
    if (!isRecurring) {
      const isAvailable = await checkAvailability();
      if (!isAvailable) {
        return; // Show warning dialog, wait for user decision
      }
    }

    await submitBooking();
  };

  const submitBooking = async () => {
    setIsSubmitting(true);

    try {
      // Calculate End Time
      const durationHours = parseInt(formData.duration);
      const endTime = new Date(`${formData.date}T${formData.startTime}`);
      endTime.setHours(endTime.getHours() + durationHours);
      const endTimeStr = endTime.toTimeString().slice(0, 5);

      // Find Room Details
      const room = rooms!.find((r) => r.id === formData.roomId);
      if (!room) {
        toast.error("Please select a valid room.");
        return;
      }

      // Prepare resource payload
      const resourcesPayload = Object.entries(selectedResources).map(
        ([resourceId, quantity]) => ({
          resourceId,
          quantity,
        })
      );

      // Handle Recurring vs Single Booking
      if (isRecurring && endDate) {
        // Recurring Booking
        const payload = {
          userId: user!.id,
          userName: user!.name,
          roomId: formData.roomId,
          roomName: room.name,
          startDate: formData.date,
          startTime: formData.startTime,
          endTime: endTimeStr,
          duration: durationHours,
          purpose: formData.purpose,
          recurrencePattern,
          endDate,
          resources: resourcesPayload.length > 0 ? resourcesPayload : undefined,
        };

        const result = await createRecurringBooking(payload);
        setRecurringResult(result);

        // Show results
        if (result.conflicts.length > 0) {
          // Has conflicts - show dialog
          setShowConflictDialog(true);
        } else {
          // All created successfully
          toast.success(
            `${result.created.length} recurring bookings created successfully!`
          );
          resetForm();
        }
      } else {
        // Single Booking (existing logic)
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
        };

        await addBooking(payload);
        toast.success("Booking request submitted successfully!");
        resetForm();
      }
    } catch (error: any) {
      console.error("Booking submission failed:", error);
      const message =
        error.response?.data?.message || "A network or server error occurred.";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData((f) => ({
      ...f,
      date: "",
      startTime: "",
      duration: "1",
      purpose: "",
    }));
    setSelectedResources({});
    setAvailabilityWarning(null);
    setIsRecurring(false);
    setEndDate("");
    setRecurrencePattern("weekly");
    setShowConflictDialog(false);
    setRecurringResult(null);
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
                Would you like to proceed with this booking anyway, or go back
                and adjust your resource selection?
              </p>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowWarningDialog(false)}
                >
                  Go Back
                </Button>
                <Button
                  onClick={() => {
                    setShowWarningDialog(false);
                    submitBooking();
                  }}
                >
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
            onValueChange={(value) =>
              setFormData({ ...formData, roomId: value })
            }
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
              onChange={(e) =>
                setFormData({ ...formData, date: e.target.value })
              }
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

        {/* Recurring Booking Checkbox */}
        <div className="flex items-center space-x-2 py-2">
          <input
            type="checkbox"
            id="recurring"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="w-4 h-4"
          />
          <Label htmlFor="recurring" className="cursor-pointer font-normal">
            Make this a recurring booking
          </Label>
        </div>

        {/* Recurring Options - Only show when checkbox is checked */}
        {isRecurring && (
          <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-sm">Recurring Pattern</h3>

            <div className="space-y-2">
              <Label htmlFor="pattern">Repeat</Label>
              <Select
                value={recurrencePattern}
                onValueChange={(value: "daily" | "weekly" | "monthly") =>
                  setRecurrencePattern(value)
                }
                required={isRecurring}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">Until (End Date)</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={formData.date || new Date().toISOString().split("T")[0]}
                max={
                  formData.date
                    ? format(
                        addMonths(parseISO(formData.date), 3),
                        "yyyy-MM-dd"
                      )
                    : undefined
                }
                required={isRecurring}
              />
              <p className="text-xs text-muted-foreground">
                Maximum: 3 months from start date
              </p>
            </div>

            {/* Preview */}
            {formData.date &&
              endDate &&
              (() => {
                const preview = calculateRecurringPreview();
                return preview ? (
                  <div className="text-sm bg-white border border-blue-200 rounded p-3">
                    <strong>Preview:</strong> {preview.description}
                  </div>
                ) : null;
              })()}
          </div>
        )}

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
                      onChange={(e) =>
                        handleResourceToggle(resource.id, e.target.checked)
                      }
                      className="w-4 h-4"
                    />
                    <Label
                      htmlFor={`resource-${resource.id}`}
                      className="flex-1 cursor-pointer"
                    >
                      {resource.name} ({resource.type}) - Available:{" "}
                      {resource.total_quantity}
                    </Label>
                    {isSelected && (
                      <Input
                        type="number"
                        min="1"
                        max={resource.total_quantity}
                        value={selectedResources[resource.id]}
                        onChange={(e) =>
                          handleQuantityChange(
                            resource.id,
                            parseInt(e.target.value)
                          )
                        }
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

      {/* Recurring Booking Conflict Dialog */}
      {showConflictDialog && recurringResult && (
        <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Recurring Booking Results</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {recurringResult.summary.created}
                    </div>
                    <div className="text-sm text-gray-600">Created</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">
                      {recurringResult.summary.conflicts}
                    </div>
                    <div className="text-sm text-gray-600">Conflicts</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-600">
                      {recurringResult.summary.total_dates}
                    </div>
                    <div className="text-sm text-gray-600">Total</div>
                  </div>
                </div>
              </div>

              {/* Success Message */}
              {recurringResult.created.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-green-800 font-medium">
                    ✓ {recurringResult.created.length} booking(s) created
                    successfully and pending approval
                  </p>
                </div>
              )}

              {/* Conflicts List */}
              {recurringResult.conflicts.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-red-600">
                    Conflicting Dates (skipped):
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {recurringResult.conflicts.map(
                      (conflict: any, idx: number) => (
                        <div
                          key={idx}
                          className="bg-red-50 border border-red-200 rounded p-3"
                        >
                          <div className="font-medium">
                            {format(
                              parseISO(conflict.date),
                              "EEE, MMM d, yyyy"
                            )}{" "}
                            - {conflict.start_time} to {conflict.end_time}
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            Conflicts with:
                            {conflict.existing_bookings.map(
                              (booking: any, bidx: number) => (
                                <div key={bidx} className="ml-4">
                                  • {booking.user_name}: {booking.start_time}-
                                  {booking.end_time} ({booking.purpose})
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end pt-4">
                <Button
                  onClick={() => {
                    setShowConflictDialog(false);
                    resetForm();
                  }}
                >
                  OK
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
