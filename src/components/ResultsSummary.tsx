import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, AlertCircle, XCircle, ChevronDown, ChevronUp } from "lucide-react";

interface ResultsSummaryProps {
  results: {
    created: any[];
    overridden: any[];
    errors: any[];
    summary: {
      total: number;
      created: number;
      conflicts?: number;
      errors: number;
    };
  };
  open: boolean;
  onClose: () => void;
}

export const ResultsSummary: React.FC<ResultsSummaryProps> = ({
  results,
  open,
  onClose,
}) => {
  const [expandedSections, setExpandedSections] = useState({
    created: false,
    overridden: false,
    errors: false,
  });

  const toggleSection = (section: "created" | "overridden" | "errors") => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const renderBookingItem = (booking: any, index: number) => (
    <div key={index} className="text-sm py-2 border-b last:border-b-0">
      <div className="font-medium">{booking.room_name}</div>
      <div className="text-muted-foreground">
        {booking.date} | {booking.start_time} - {booking.end_time}
      </div>
      <div className="text-muted-foreground italic">{booking.purpose}</div>
    </div>
  );

  const renderErrorItem = (error: any, index: number) => (
    <div key={index} className="text-sm py-2 border-b last:border-b-0">
      <div className="font-medium text-destructive">Row {error.row_index + 1}</div>
      <div className="text-muted-foreground">{error.reason}</div>
      {error.booking && (
        <div className="text-xs text-muted-foreground mt-1">
          {error.booking.room_name} | {error.booking.date} | {error.booking.start_time} - {error.booking.end_time}
        </div>
      )}
    </div>
  );

  const renderList = (
    items: any[],
    renderItem: (item: any, index: number) => React.ReactNode,
    expanded: boolean,
    maxInitial: number = 5
  ) => {
    if (items.length === 0) {
      return <div className="text-sm text-muted-foreground py-2">None</div>;
    }

    const displayItems = expanded ? items : items.slice(0, maxInitial);
    const remaining = items.length - maxInitial;

    return (
      <div>
        {displayItems.map(renderItem)}
        {!expanded && remaining > 0 && (
          <div className="text-sm text-muted-foreground py-2 italic">
            ... and {remaining} more
          </div>
        )}
      </div>
    );
  };

  const overriddenCount = results.overridden?.length || 0;
  const skippedCount = results.errors?.length || 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Booking Results</DialogTitle>
        </DialogHeader>

        {/* Statistics Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {/* Successfully Booked */}
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-semibold text-green-900">Successfully Booked</span>
              </div>
              <div className="text-3xl font-bold text-green-600">
                {results.summary.created}
              </div>
            </CardContent>
          </Card>

          {/* Overridden */}
          <Card className="bg-yellow-50 border-yellow-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
                <span className="font-semibold text-yellow-900">Overridden</span>
              </div>
              <div className="text-3xl font-bold text-yellow-600">
                {overriddenCount}
              </div>
            </CardContent>
          </Card>

          {/* Skipped/Invalid */}
          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-5 w-5 text-red-600" />
                <span className="font-semibold text-red-900">Skipped/Invalid</span>
              </div>
              <div className="text-3xl font-bold text-red-600">
                {skippedCount}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Detailed Results */}
        <div className="space-y-4">
          {/* Successfully Booked Section */}
          {results.created.length > 0 && (
            <Collapsible
              open={expandedSections.created}
              onOpenChange={() => toggleSection("created")}
            >
              <Card>
                <CardContent className="pt-6">
                  <CollapsibleTrigger className="flex items-center justify-between w-full">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      Successfully Booked ({results.created.length})
                    </h3>
                    {expandedSections.created ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4">
                    {renderList(
                      results.created,
                      renderBookingItem,
                      expandedSections.created
                    )}
                  </CollapsibleContent>
                </CardContent>
              </Card>
            </Collapsible>
          )}

          {/* Overridden Section */}
          {overriddenCount > 0 && (
            <Collapsible
              open={expandedSections.overridden}
              onOpenChange={() => toggleSection("overridden")}
            >
              <Card>
                <CardContent className="pt-6">
                  <CollapsibleTrigger className="flex items-center justify-between w-full">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                      Overridden & Booked ({overriddenCount})
                    </h3>
                    {expandedSections.overridden ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4">
                    {renderList(
                      results.overridden,
                      renderBookingItem,
                      expandedSections.overridden
                    )}
                  </CollapsibleContent>
                </CardContent>
              </Card>
            </Collapsible>
          )}

          {/* Skipped Section */}
          {skippedCount > 0 && (
            <Collapsible
              open={expandedSections.errors}
              onOpenChange={() => toggleSection("errors")}
            >
              <Card>
                <CardContent className="pt-6">
                  <CollapsibleTrigger className="flex items-center justify-between w-full">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      Skipped/Invalid ({skippedCount})
                    </h3>
                    {expandedSections.errors ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4">
                    {renderList(
                      results.errors,
                      renderErrorItem,
                      expandedSections.errors
                    )}
                  </CollapsibleContent>
                </CardContent>
              </Card>
            </Collapsible>
          )}
        </div>

        {/* Close Button */}
        <div className="flex justify-end mt-6">
          <Button onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResultsSummary;
