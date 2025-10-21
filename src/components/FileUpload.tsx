import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { bulkCreateBookings } from "@/lib/dataApi";

interface FileUploadProps {
  onProcessComplete: (results: any) => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onProcessComplete }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (file.size > maxSize) {
      toast.error("File too large (max 5MB)");
      return;
    }

    // Check file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".csv") && !fileName.endsWith(".xlsx")) {
      toast.error("Please upload CSV or Excel (.xlsx) file");
      return;
    }

    setSelectedFile(file);
  };

  const normalizeHeaders = (headers: string[]): string[] => {
    return headers.map((header) => header.toLowerCase().trim());
  };

  const mapColumnName = (normalizedHeader: string): string | null => {
    // Map various column names to expected format
    if (normalizedHeader === "room_name" || normalizedHeader === "room") {
      return "room_name";
    }
    if (normalizedHeader === "date") {
      return "date";
    }
    if (normalizedHeader === "start_time" || normalizedHeader === "start") {
      return "start_time";
    }
    if (normalizedHeader === "end_time" || normalizedHeader === "end") {
      return "end_time";
    }
    if (normalizedHeader === "purpose") {
      return "purpose";
    }
    return null; // Ignore other columns
  };

  const parseCSV = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length === 0) {
            reject(new Error("File is empty or contains no data rows"));
            return;
          }

          // Normalize and map columns
          const bookings = results.data.map((row: any) => {
            const booking: any = {};
            Object.keys(row).forEach((key) => {
              const normalizedKey = key.toLowerCase().trim();
              const mappedKey = mapColumnName(normalizedKey);
              if (mappedKey) {
                booking[mappedKey] = row[key]?.toString().trim() || "";
              }
            });
            return booking;
          });

          // Check if required columns exist
          const firstBooking = bookings[0];
          const requiredFields = ["room_name", "date", "start_time", "end_time", "purpose"];
          const hasAllFields = requiredFields.every(
            (field) => firstBooking && firstBooking[field] !== undefined
          );

          if (!hasAllFields) {
            const missingFields = requiredFields.filter(
              (field) => !firstBooking || firstBooking[field] === undefined
            );
            reject(
              new Error(`Missing required columns: ${missingFields.join(", ")}`)
            );
            return;
          }

          resolve(bookings);
        },
        error: (error) => {
          reject(new Error(`CSV parsing error: ${error.message}`));
        },
      });
    });
  };

  const parseExcel = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });

          // Get first sheet
          const firstSheetName = workbook.SheetNames[0];
          if (!firstSheetName) {
            reject(new Error("Excel file contains no sheets"));
            return;
          }

          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (jsonData.length < 2) {
            reject(new Error("File is empty or contains no data rows"));
            return;
          }

          // First row is headers
          const headers = jsonData[0] as string[];
          const normalizedHeaders = normalizeHeaders(headers);

          // Map data rows
          const bookings = [];
          for (let i = 1; i < jsonData.length; i++) {
            const row = jsonData[i] as any[];
            if (!row || row.every((cell) => !cell)) continue; // Skip empty rows

            const booking: any = {};
            headers.forEach((header, index) => {
              const normalizedHeader = normalizedHeaders[index];
              const mappedKey = mapColumnName(normalizedHeader);
              if (mappedKey && row[index] !== undefined) {
                booking[mappedKey] = row[index]?.toString().trim() || "";
              }
            });

            // Only add if booking has at least one field
            if (Object.keys(booking).length > 0) {
              bookings.push(booking);
            }
          }

          if (bookings.length === 0) {
            reject(new Error("File contains no valid data rows"));
            return;
          }

          // Check if required columns exist
          const firstBooking = bookings[0];
          const requiredFields = ["room_name", "date", "start_time", "end_time", "purpose"];
          const hasAllFields = requiredFields.every(
            (field) => firstBooking && firstBooking[field] !== undefined
          );

          if (!hasAllFields) {
            const missingFields = requiredFields.filter(
              (field) => !firstBooking || firstBooking[field] === undefined
            );
            reject(
              new Error(`Missing required columns: ${missingFields.join(", ")}`)
            );
            return;
          }

          resolve(bookings);
        } catch (error: any) {
          reject(new Error(`Excel parsing error: ${error.message}`));
        }
      };

      reader.onerror = () => {
        reject(new Error("Failed to read file"));
      };

      reader.readAsBinaryString(file);
    });
  };

  const handleProcessFile = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);

    try {
      let bookings: any[];

      const fileName = selectedFile.name.toLowerCase();
      if (fileName.endsWith(".csv")) {
        bookings = await parseCSV(selectedFile);
      } else if (fileName.endsWith(".xlsx")) {
        bookings = await parseExcel(selectedFile);
      } else {
        throw new Error("Invalid file type");
      }

      // Call API to process bookings
      const results = await bulkCreateBookings(bookings);

      toast.success(`Processed ${bookings.length} bookings`);
      onProcessComplete(results);

      // Reset file selection
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error: any) {
      console.error("Error processing file:", error);
      toast.error(error.message || "Failed to process file");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-lg">
            <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Upload CSV or Excel File</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Accepted formats: .csv, .xlsx (max 5MB)
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileSelect}
              className="hidden"
            />

            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
            >
              <Upload className="h-4 w-4 mr-2" />
              Select File
            </Button>

            {selectedFile && (
              <div className="mt-4 text-sm text-muted-foreground">
                Selected: <span className="font-medium">{selectedFile.name}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedFile && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-6">
            <h4 className="font-semibold mb-2">Required Columns:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• <strong>room_name</strong> or <strong>room</strong> - Room name (e.g., "Room 101")</li>
              <li>• <strong>date</strong> - Format: YYYY-MM-DD (e.g., "2025-03-15")</li>
              <li>• <strong>start_time</strong> or <strong>start</strong> - Format: HH:MM (e.g., "09:00")</li>
              <li>• <strong>end_time</strong> or <strong>end</strong> - Format: HH:MM (e.g., "11:00")</li>
              <li>• <strong>purpose</strong> - Text description</li>
            </ul>
          </CardContent>
        </Card>
      )}

      <Button
        onClick={handleProcessFile}
        disabled={!selectedFile || isProcessing}
        className="w-full"
        size="lg"
      >
        {isProcessing ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Process File
          </>
        )}
      </Button>
    </div>
  );
};

export default FileUpload;
