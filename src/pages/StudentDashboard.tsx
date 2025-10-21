import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { BookingForm } from "@/components/BookingForm";
import { MyBookings } from "@/components/MyBookings";
import { Calendar, LogOut, BookOpen, List } from "lucide-react";
// import { initializeStorage } from '@/lib/mockData'; <-- REMOVED

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"book" | "bookings">("book");

  useEffect(() => {
    if (!user || user.role !== "student") {
      navigate("/login");
    }
    // initializeStorage(); <-- REMOVED: Data is now in MySQL
  }, [user, navigate]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-card border-b border-border shadow-md">
        <div className="container mx-auto px-4 py-5 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-primary">QuickRoom</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, {user.name}
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout} className="hover:bg-slate-100 transition">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-4 gap-6">
          <aside className="space-y-1">
            <Button
              variant={activeTab === "book" ? "default" : "ghost"}
              className={`w-full justify-start ${
                activeTab === "book"
                  ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => setActiveTab("book")}
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Book Room
            </Button>
            <Button
              variant={activeTab === "bookings" ? "default" : "ghost"}
              className={`w-full justify-start ${
                activeTab === "bookings"
                  ? "bg-blue-50 text-blue-700 border-l-4 border-blue-600 font-medium"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
              onClick={() => setActiveTab("bookings")}
            >
              <List className="h-4 w-4 mr-2" />
              My Bookings
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-slate-600 hover:bg-slate-50"
              onClick={() => navigate("/calendar")}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Calendar
            </Button>
          </aside>

          <div className="md:col-span-3">
            {activeTab === "book" && (
              <Card className="border-slate-200 rounded-xl shadow-md">
                <CardHeader>
                  <CardTitle>Book a Room</CardTitle>
                  <CardDescription>
                    Fill in the details to request a room booking
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <BookingForm />
                </CardContent>
              </Card>
            )}
            {activeTab === "bookings" && <MyBookings />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
