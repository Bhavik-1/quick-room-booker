import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Landing = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    console.log("Landing - Auth status:", { isAuthenticated, user });
    if (isAuthenticated && user) {
      console.log(
        "Redirecting to:",
        user.role === "admin" ? "/admin" : "/dashboard"
      );
      navigate(user.role === "admin" ? "/admin" : "/dashboard");
    }
  }, [isAuthenticated, user, navigate]);

  console.log("Landing component rendering");

  return (
    <div className="min-h-screen w-full bg-gradient-to-r from-purple-600 via-purple-500 to-pink-500">
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-20">
          <div className="flex items-center justify-center mb-6">
            <Calendar className="h-16 w-16 text-white drop-shadow-lg" />
          </div>
          <h1 className="text-6xl font-bold text-white mb-4 drop-shadow-lg">QuickRoom</h1>
          <p className="text-2xl text-white/95 max-w-2xl mx-auto drop-shadow-md">
            College Room & Resource Booking System - Simple, Fast, Efficient
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16 max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-blue-100 to-purple-100 p-8 rounded-xl shadow-xl border border-white/30 text-center hover:scale-105 transition-transform duration-200">
            <div className="h-16 w-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg">
              <Calendar className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">Easy Booking</h3>
            <p className="text-muted-foreground">
              Book rooms in seconds with our intuitive interface
            </p>
          </div>
          <div className="bg-gradient-to-br from-purple-100 to-pink-100 p-8 rounded-xl shadow-xl border border-white/30 text-center hover:scale-105 transition-transform duration-200">
            <div className="h-16 w-16 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center shadow-lg">
              <Clock className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">
              Real-time Availability
            </h3>
            <p className="text-muted-foreground">
              Check room availability instantly
            </p>
          </div>
          <div className="bg-gradient-to-br from-pink-100 to-blue-100 p-8 rounded-xl shadow-xl border border-white/30 text-center hover:scale-105 transition-transform duration-200">
            <div className="h-16 w-16 mx-auto mb-4 bg-gradient-to-br from-pink-500 to-blue-500 rounded-full flex items-center justify-center shadow-lg">
              <Users className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-bold mb-2">Admin Control</h3>
            <p className="text-muted-foreground">
              Manage bookings and rooms efficiently
            </p>
          </div>
        </div>

        <div className="text-center">
          <Button 
            size="lg" 
            onClick={() => navigate("/login")} 
            className="px-12 py-6 shadow-2xl hover:scale-110 transition-all duration-200 text-lg"
          >
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Landing;
