import React from "react";
import { useState, useEffect } from "react";
import { getResources, addResource, updateResource, deleteResource, Resource } from "@/lib/dataApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export const ManageResources = () => {
  const [resources, setResources] = useState<Resource[] | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    type: "Projector",
    total_quantity: "1",
    customTypeName: "",
  });

  const fetchResources = async () => {
    setIsLoading(true);
    try {
      const fetchedResources = await getResources();
      setResources(fetchedResources);
    } catch (error) {
      console.error("Error fetching resources:", error);
      toast.error("Failed to load resources. Please check API connection.");
      setResources([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const quantityNum = parseInt(formData.total_quantity);
    if (isNaN(quantityNum) || quantityNum < 1) {
      toast.error("Quantity must be at least 1.");
      return;
    }

    // Determine the final type value
    let finalType = formData.type;
    if (formData.type === "Custom") {
      if (!formData.customTypeName.trim()) {
        toast.error("Please enter a custom type name.");
        return;
      }
      finalType = `Custom: ${formData.customTypeName.trim()}`;
    }

    const resourceData = {
      name: formData.name,
      type: finalType,
      total_quantity: quantityNum,
    };

    try {
      if (editingResource) {
        await updateResource(editingResource.id, resourceData);
        toast.success("Resource updated successfully");
      } else {
        await addResource(resourceData);
        toast.success("Resource added successfully");
      }

      await fetchResources();

      setIsOpen(false);
      setEditingResource(null);
      setFormData({ name: "", type: "Projector", total_quantity: "1", customTypeName: "" });
    } catch (error) {
      console.error("Error submitting resource form:", error);
      toast.error(
        `Operation failed: ${
          error instanceof Error ? error.message : "API error"
        }`
      );
    }
  };

  const handleEdit = (resource: Resource) => {
    setEditingResource(resource);

    // Check if type starts with "Custom: "
    let displayType = resource.type;
    let customName = "";

    if (resource.type.startsWith("Custom: ")) {
      displayType = "Custom";
      customName = resource.type.substring(8); // Remove "Custom: " prefix
    }

    setFormData({
      name: resource.name,
      type: displayType,
      total_quantity: resource.total_quantity.toString(),
      customTypeName: customName,
    });
    setIsOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this resource? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await deleteResource(id);
      await fetchResources();
      toast.success("Resource deleted successfully");
    } catch (error) {
      console.error("Error deleting resource:", error);
      toast.error(
        `Deletion failed: ${
          error instanceof Error ? error.message : "API error"
        }`
      );
    }
  };

  if (isLoading || resources === null) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Manage Resources</h2>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const resourcesList = resources || [];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Manage Resources</h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingResource(null);
                setFormData({ name: "", type: "Projector", total_quantity: "1", customTypeName: "" });
              }}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Resource
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingResource ? "Edit Resource" : "Add New Resource"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Resource Name</Label>
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
                <Label htmlFor="type">Resource Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value })
                  }
                  required
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Smartboard">Smartboard</SelectItem>
                    <SelectItem value="Microphone">Microphone</SelectItem>
                    <SelectItem value="Projector">Projector</SelectItem>
                    <SelectItem value="Custom">Custom Type</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.type === "Custom" && (
                <div className="space-y-2">
                  <Label htmlFor="customType">Custom Type Name</Label>
                  <Input
                    id="customType"
                    value={formData.customTypeName}
                    onChange={(e) =>
                      setFormData({ ...formData, customTypeName: e.target.value })
                    }
                    placeholder="e.g., Conference Phone"
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="total_quantity">Total Quantity Available</Label>
                <Input
                  id="total_quantity"
                  type="number"
                  min="1"
                  value={formData.total_quantity}
                  onChange={(e) =>
                    setFormData({ ...formData, total_quantity: e.target.value })
                  }
                  required
                />
              </div>

              <Button type="submit" className="w-full">
                {editingResource ? "Update" : "Add"} Resource
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {resourcesList.length === 0 && !isLoading ? (
        <div className="p-10 text-center text-muted-foreground border rounded-lg">
          No resources found. Add the first resource to get started.
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {resourcesList.map((resource) => (
            <Card key={resource.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle>{resource.name}</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(resource)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(resource.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  Type: {resource.type}
                </p>
                <p className="text-sm text-muted-foreground">
                  Total Available: {resource.total_quantity}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ManageResources;
