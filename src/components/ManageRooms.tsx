import React from "react"; // <--- added for JSX/TSX safety
import { useState, useEffect } from "react";
import { getRooms, addRoom, updateRoom, deleteRoom, Room } from "@/lib/dataApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const ManageRooms = () => {
  // 1. Initialize rooms to null to signal a loading state initially
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [isLoading, setIsLoading] = useState(false); // New state for loading indicator

  const [formData, setFormData] = useState({
    name: "",
    capacity: "",
    type: "General",
  });

  // Function to fetch data from the API
  const fetchRooms = async () => {
    setIsLoading(true);
    try {
      // 2. Await the asynchronous getRooms() call
      const fetchedRooms = await getRooms();
      setRooms(fetchedRooms);
    } catch (error) {
      console.error("Error fetching rooms:", error);
      toast.error("Failed to load rooms. Please check API connection.");
      setRooms([]); // Set to empty array on error to prevent crash
    } finally {
      setIsLoading(false);
    }
  };

  // 3. Use useEffect to call fetchRooms once on component mount
  useEffect(() => {
    fetchRooms();
  }, []);

  // Update handleSubmit to be asynchronous
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check if capacity is a valid number
    const capacityNum = parseInt(formData.capacity);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      toast.error("Capacity must be a positive number.");
      return;
    }

    const roomData = {
      name: formData.name,
      capacity: capacityNum,
      type: formData.type,
    };

    try {
      if (editingRoom) {
        const updatePayload = {
          ...roomData,
          id: editingRoom.id,
        };
        // Update payload only includes schema-defined fields (name, capacity, type)
        await updateRoom(updatePayload.id, {
          name: updatePayload.name,
          capacity: updatePayload.capacity,
          type: updatePayload.type,
        });
        toast.success("Room updated successfully");
      } else {
        // Add payload only includes schema-defined fields
        await addRoom({
          name: roomData.name,
          capacity: roomData.capacity,
          type: roomData.type,
        });
        toast.success("Room added successfully");
      }

      // 4. Re-fetch the data after mutation
      await fetchRooms();

      setIsOpen(false);
      setEditingRoom(null);
      // Reset form data
      setFormData({ name: "", capacity: "", type: "General" });
    } catch (error) {
      console.error("Error submitting room form:", error);
      toast.error(
        `Operation failed: ${
          error instanceof Error ? error.message : "API error"
        }`
      );
    }
  };

  // Update handleEdit to reflect the structure of the API data
  const handleEdit = (room: Room) => {
    setEditingRoom(room);
    setFormData({
      name: room.name,
      capacity: room.capacity.toString(),
      type: room.type || "General",
    });
    setIsOpen(true);
  };

  // Update handleDelete to be asynchronous
  const handleDelete = async (id: string) => {
    // NOTE: For compliance, use AlertDialog component for confirmation.
    if (
      !window.confirm(
        "Are you sure you want to delete this room? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await deleteRoom(id);
      await fetchRooms(); // Re-fetch the list from the server
      toast.success("Room deleted successfully");
    } catch (error) {
      console.error("Error deleting room:", error);
      toast.error(
        `Deletion failed: ${
          error instanceof Error ? error.message : "API error"
        }`
      );
    }
  };

  // --- RENDER LOGIC: Handle Loading and Empty States ---

  if (isLoading || rooms === null) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Manage Rooms</h2>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const roomsList = rooms || []; // Ensure rooms is an array for map()

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Manage Rooms</h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingRoom(null);
                // Reset form data
                setFormData({ name: "", capacity: "", type: "General" });
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Room
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingRoom ? "Edit Room" : "Add New Room"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Room Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="capacity">Capacity</Label>
                <Input
                  id="capacity"
                  type="number"
                  value={formData.capacity}
                  onChange={(e) =>
                    setFormData({ ...formData, capacity: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Room Type</Label>
                <Input
                  id="type"
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value })
                  }
                  placeholder="Lecture Hall, Lab, Conference Room"
                  required
                />
              </div>
              <Button type="submit" className="w-full">
                {editingRoom ? "Update" : "Add"} Room
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {roomsList.length === 0 && !isLoading ? (
        <div className="p-10 text-center text-muted-foreground border rounded-lg">
          No rooms found. Add the first room to get started.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {roomsList.map((room) => (
            <Card key={room.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle>{room.name}</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(room)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(room.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  Capacity: {room.capacity} people
                </p>
                <p className="text-sm text-muted-foreground mb-2">
                  Type: {room.type}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManageRooms; // <--- added default export for compatibility
