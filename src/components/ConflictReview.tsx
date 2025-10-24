import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface ConflictReviewProps {
  conflicts: Array<{
    booking: {
      room_name: string;
      room_id: number;
      date: string;
      start_time: string;
      end_time: string;
      duration: number;
      purpose: string;
    };
    existing_bookings: Array<{
      id: number;
      user_name: string;
      start_time: string;
      end_time: string;
      purpose: string;
    }>;
  }>;
  open: boolean;
  onResolve: (resolutions: any[]) => void;
  onClose: () => void;
}

export const ConflictReview: React.FC<ConflictReviewProps> = ({
  conflicts,
  open,
  onResolve,
  onClose,
}) => {
  const [resolutions, setResolutions] = useState<
    Map<number, "override" | "cancel">
  >(new Map());

  // Reset resolutions when conflicts change
  useEffect(() => {
    setResolutions(new Map());
  }, [conflicts]);

  const handleAction = (index: number, action: "override" | "cancel") => {
    setResolutions((prev) => {
      const newMap = new Map(prev);
      newMap.set(index, action);
      return newMap;
    });
  };

  const handleOverrideAll = () => {
    const newMap = new Map<number, "override" | "cancel">();
    conflicts.forEach((_, index) => {
      newMap.set(index, "override");
    });
    setResolutions(newMap);
  };

  const handleCancelAll = () => {
    const newMap = new Map<number, "override" | "cancel">();
    conflicts.forEach((_, index) => {
      newMap.set(index, "cancel");
    });
    setResolutions(newMap);
  };

  const handleDone = () => {
    const resolutionArray = conflicts.map((conflict, index) => ({
      booking: conflict.booking,
      action: resolutions.get(index) || "cancel",
      existing_bookings: conflict.existing_bookings,
    }));
    onResolve(resolutionArray);
  };

  const allResolved = conflicts.every((_, index) => resolutions.has(index));

  const formatConflicts = (existingBookings: any[]) => {
    if (existingBookings.length === 0) return "No conflicts";
    if (existingBookings.length === 1) {
      const booking = existingBookings[0];
      return `${booking.start_time}-${booking.end_time} (${booking.user_name})`;
    }
    const first = existingBookings[0];
    return `${existingBookings.length} conflicts: ${first.start_time}-${first.end_time} (${first.user_name}), ...`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
            Review Conflicts ({conflicts.length} conflicts)
          </DialogTitle>
        </DialogHeader>

        <Card className="bg-yellow-50 border-yellow-200 mb-4">
          <CardContent className="pt-4">
            <p className="text-sm text-yellow-900">
              The following bookings have time conflicts with existing approved
              bookings. Please decide whether to override (force book) or cancel
              each booking.
            </p>
          </CardContent>
        </Card>

        {/* Conflicts Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Room</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Conflicting Bookings</TableHead>
                <TableHead className="text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {conflicts.map((conflict, index) => {
                const resolution = resolutions.get(index);
                return (
                  <TableRow
                    key={index}
                    className={
                      resolution === "override"
                        ? "bg-green-50"
                        : resolution === "cancel"
                        ? "bg-gray-50"
                        : "bg-red-50"
                    }
                  >
                    <TableCell className="font-medium">
                      {conflict.booking.room_name}
                    </TableCell>
                    <TableCell>{conflict.booking.date}</TableCell>
                    <TableCell>
                      {conflict.booking.start_time} -{" "}
                      {conflict.booking.end_time}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {conflict.booking.purpose}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatConflicts(conflict.existing_bookings)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2 justify-center">
                        <Button
                          size="sm"
                          variant={
                            resolution === "override" ? "default" : "outline"
                          }
                          onClick={() => handleAction(index, "override")}
                          className={
                            resolution === "override"
                              ? "bg-green-600 hover:bg-green-700"
                              : ""
                          }
                        >
                          {resolution === "override" ? (
                            <CheckCircle className="h-4 w-4 mr-1" />
                          ) : null}
                          Override
                        </Button>
                        <Button
                          size="sm"
                          variant={
                            resolution === "cancel" ? "default" : "outline"
                          }
                          onClick={() => handleAction(index, "cancel")}
                          className={
                            resolution === "cancel"
                              ? "bg-gray-600 hover:bg-gray-700"
                              : ""
                          }
                        >
                          {resolution === "cancel" ? (
                            <XCircle className="h-4 w-4 mr-1" />
                          ) : null}
                          Cancel
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Bulk Actions */}
        <div className="flex justify-between items-center mt-6">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleOverrideAll}
              className="border-green-600 text-green-600 hover:bg-green-50"
            >
              Override All
            </Button>
            <Button
              variant="outline"
              onClick={handleCancelAll}
              className="border-gray-600 text-gray-600 hover:bg-gray-50"
            >
              Cancel All
            </Button>
          </div>
          <Button
            onClick={handleDone}
            disabled={!allResolved}
            className="bg-blue-600 hover:bg-blue-700"
          >
            Done ({resolutions.size}/{conflicts.length} resolved)
          </Button>
        </div>

        {!allResolved && (
          <p className="text-sm text-muted-foreground text-center mt-2">
            Please make a decision for all conflicts before proceeding
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ConflictReview;
