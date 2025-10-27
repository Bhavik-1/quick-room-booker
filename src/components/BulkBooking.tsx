import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUpload } from "./FileUpload";
import { ManualEntryTable } from "./ManualEntryTable";
import { ConflictReview } from "./ConflictReview";
import { ResultsSummary } from "./ResultsSummary";
import { resolveConflicts } from "@/lib/dataApi";
import { toast } from "sonner";
import { Upload, Edit } from "lucide-react";

export const BulkBooking: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"upload" | "manual">("upload");
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [showConflictReview, setShowConflictReview] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [showResultsSummary, setShowResultsSummary] = useState(false);
  const [overriddenBookings, setOverriddenBookings] = useState<any[]>([]);

  const handleProcessComplete = (apiResults: any) => {
    // apiResults contains: created, conflicts, errors, summary

    if (apiResults.conflicts && apiResults.conflicts.length > 0) {
      // There are conflicts - show conflict review dialog
      setConflicts(apiResults.conflicts);
      setShowConflictReview(true);

      // Store initial results (created and errors) for final summary
      setResults({
        created: apiResults.created || [],
        overridden: [],
        errors: apiResults.errors || [],
        summary: apiResults.summary,
      });
    } else {
      // No conflicts - show results summary directly
      setResults({
        created: apiResults.created || [],
        overridden: [],
        errors: apiResults.errors || [],
        summary: apiResults.summary,
      });
      setShowResultsSummary(true);
    }
  };

  const handleConflictResolve = async (resolutions: any[]) => {
    try {
      // Call API to resolve conflicts
      const resolveResults = await resolveConflicts(resolutions);

      // Combine initial results with resolution results
      const finalResults = {
        created: results.created,
        overridden: resolveResults.created || [],
        errors: results.errors,
        summary: {
          total: results.summary.total,
          created: results.created.length,
          conflicts: 0,
          errors: results.errors.length,
        },
      };

      setResults(finalResults);
      setShowConflictReview(false);
      setShowResultsSummary(true);

      toast.success(
        `Resolved ${resolutions.length} conflicts: ${resolveResults.created?.length || 0} overridden, ${resolveResults.cancelled?.length || 0} cancelled`
      );
    } catch (error: any) {
      console.error("Error resolving conflicts:", error);
      toast.error(error.message || "Failed to resolve conflicts");
    }
  };

  const handleConflictClose = () => {
    setShowConflictReview(false);
    // Show results summary with existing results (without overrides)
    setShowResultsSummary(true);
  };

  const handleResultsClose = () => {
    setShowResultsSummary(false);
    setResults(null);
    setConflicts([]);
    setOverriddenBookings([]);
    // Optionally refresh bookings list here
    // Could emit an event or call a callback to parent
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Upload Timetable</h2>
        <p className="text-muted-foreground mt-2">
          Upload CSV/Excel files or manually enter multiple bookings at once
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "upload" | "manual")}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="upload" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Upload File
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex items-center gap-2">
            <Edit className="h-4 w-4" />
            Manual Entry
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upload CSV or Excel File</CardTitle>
              <CardDescription>
                Upload a file containing multiple booking entries. The system will
                automatically validate and create bookings, detecting conflicts along the way.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FileUpload onProcessComplete={handleProcessComplete} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Manual Entry</CardTitle>
              <CardDescription>
                Enter multiple bookings directly in the table below. Fill in the details
                for each booking and click Process Bookings when ready.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ManualEntryTable onProcessComplete={handleProcessComplete} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Conflict Review Dialog */}
      {showConflictReview && conflicts.length > 0 && (
        <ConflictReview
          conflicts={conflicts}
          open={showConflictReview}
          onResolve={handleConflictResolve}
          onClose={handleConflictClose}
        />
      )}

      {/* Results Summary Dialog */}
      {showResultsSummary && results && (
        <ResultsSummary
          results={results}
          open={showResultsSummary}
          onClose={handleResultsClose}
        />
      )}
    </div>
  );
};

export default BulkBooking;
