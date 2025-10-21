import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, X, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getRooms, bulkCreateBookings, Room } from "@/lib/dataApi";

interface BookingRow {
  id: string;
  roomId: string;
  date: string;
  startTime: string;
  endTime: string;
  purpose: string;
}

interface ManualEntryTableProps {
  onProcessComplete: (results: any) => void;
}

export const ManualEntryTable: React.FC<ManualEntryTableProps> = ({
  onProcessComplete,
}) => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [rows, setRows] = useState<BookingRow[]>([
    { id: "1", roomId: "", date: "", startTime: "", endTime: "", purpose: "" },
    { id: "2", roomId: "", date: "", startTime: "", endTime: "", purpose: "" },
    { id: "3", roomId: "", date: "", startTime: "", endTime: "", purpose: "" },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingRooms, setIsLoadingRooms] = useState(true);

  // Get today's date in YYYY-MM-DD format for min attribute
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    setIsLoadingRooms(true);
    try {
      const fetchedRooms = await getRooms();
      setRooms(fetchedRooms);
    } catch (error) {
      console.error("Error fetching rooms:", error);
      toast.error("Failed to load rooms");
    } finally {
      setIsLoadingRooms(false);
    }
  };

  const addRow = () => {
    const newRow: BookingRow = {
      id: Date.now().toString(),
      roomId: "",
      date: "",
      startTime: "",
      endTime: "",
      purpose: "",
    };
    setRows([...rows, newRow]);
  };

  const deleteRow = (id: string) => {
    // Keep at least 1 row
    if (rows.length === 1) {
      toast.error("At least one row must be present");
      return;
    }
    setRows(rows.filter((row) => row.id !== id));
  };

  const updateRow = (id: string, field: keyof BookingRow, value: string) => {
    setRows(
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  };

  const clearAll = () => {
    setRows([
      { id: "1", roomId: "", date: "", startTime: "", endTime: "", purpose: "" },
    ]);
  };

  const isRowValid = (row: BookingRow): boolean => {
    return (
      row.roomId !== "" &&
      row.date !== "" &&
      row.startTime !== "" &&
      row.endTime !== "" &&
      row.purpose.trim() !== ""
    );
  };

  const hasValidRows = rows.some(isRowValid);

  const handleProcessBookings = async () => {
    // Filter valid rows
    const validRows = rows.filter(isRowValid);

    if (validRows.length === 0) {
      toast.error("Please fill in at least one complete booking");
      return;
    }

    setIsProcessing(true);

    try {
      // Convert rows to API format
      const bookings = validRows.map((row) => {
        const room = rooms.find((r) => r.id === row.roomId);
        if (!room) {
          throw new Error(`Room not found for ID: ${row.roomId}`);
        }

        return {
          room_name: room.name,
          date: row.date,
          start_time: row.startTime,
          end_time: row.endTime,
          purpose: row.purpose,
        };
      });

      // Call API to process bookings
      const results = await bulkCreateBookings(bookings);

      toast.success(`Processed ${validRows.length} bookings`);
      onProcessComplete(results);

      // Reset to initial state
      clearAll();
    } catch (error: any) {
      console.error("Error processing bookings:", error);
      toast.error(error.message || "Failed to process bookings");
    } finally {
      setIsProcessing(false);
    }
  };

  if (isLoadingRooms) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Room</TableHead>
                  <TableHead className="w-[150px]">Date</TableHead>
                  <TableHead className="w-[120px]">Start Time</TableHead>
                  <TableHead className="w-[120px]">End Time</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead className="w-[80px] text-center">Delete</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Select
                        value={row.roomId}
                        onValueChange={(value) =>
                          updateRow(row.id, "roomId", value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select room" />
                        </SelectTrigger>
                        <SelectContent>
                          {rooms.map((room) => (
                            <SelectItem key={room.id} value={room.id}>
                              {room.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={row.date}
                        onChange={(e) =>
                          updateRow(row.id, "date", e.target.value)
                        }
                        min={today}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={row.startTime}
                        onChange={(e) =>
                          updateRow(row.id, "startTime", e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        value={row.endTime}
                        onChange={(e) =>
                          updateRow(row.id, "endTime", e.target.value)
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.purpose}
                        onChange={(e) =>
                          updateRow(row.id, "purpose", e.target.value)
                        }
                        placeholder="Meeting purpose"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteRow(row.id)}
                        disabled={rows.length === 1}
                      >
                        <X className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex gap-2 mt-4">
            <Button variant="outline" onClick={addRow} disabled={isProcessing}>
              <Plus className="h-4 w-4 mr-2" />
              Add Row
            </Button>
            <Button
              variant="outline"
              onClick={clearAll}
              disabled={isProcessing}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear All
            </Button>
          </div>
        </CardContent>
      </Card>

      <Button
        onClick={handleProcessBookings}
        disabled={!hasValidRows || isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          "Process Bookings"
        )}
      </Button>

      {!hasValidRows && (
        <p className="text-sm text-muted-foreground text-center">
          Fill in at least one complete row to process bookings
        </p>
      )}
    </div>
  );
};

export default ManualEntryTable;
