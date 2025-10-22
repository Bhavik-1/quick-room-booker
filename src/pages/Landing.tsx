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
    // Updated background to a light grayish color (bg-slate-50)
    <div className="min-h-screen w-full bg-slate-50">
      <div className="container mx-auto px-4 py-20">
        <div className="text-center mb-20">
          <div className="flex items-center justify-center mb-6">
            <Calendar className="h-16 w-16 text-primary drop-shadow-sm" />
          </div>
          <h1 className="text-6xl font-bold text-foreground mb-4 tracking-tight">
            QuickRoom
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            College Room & Resource Booking System - Simple, Fast, Efficient
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16 max-w-5xl mx-auto">
          {/* Feature Card 1 */}
          <div className="bg-card p-8 rounded-xl border border-border shadow-lg text-center hover:shadow-xl transition-all duration-200">
            <div className="h-16 w-16 mx-auto mb-4 bg-primary rounded-full flex items-center justify-center shadow-md">
              <Calendar className="h-8 w-8 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-foreground">
              Easy Booking
            </h3>
            <p className="text-muted-foreground">
              Book rooms in seconds with our intuitive interface
            </p>
          </div>

          {/* Feature Card 2 */}
          <div className="bg-card p-8 rounded-xl border border-border shadow-lg text-center hover:shadow-xl transition-all duration-200">
            <div className="h-16 w-16 mx-auto mb-4 bg-primary rounded-full flex items-center justify-center shadow-md">
              <Clock className="h-8 w-8 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-foreground">
              Real-time Availability
            </h3>
            <p className="text-muted-foreground">
              Check room availability instantly
            </p>
          </div>

          {/* Feature Card 3 */}
          <div className="bg-card p-8 rounded-xl border border-border shadow-lg text-center hover:shadow-xl transition-all duration-200">
            <div className="h-16 w-16 mx-auto mb-4 bg-primary rounded-full flex items-center justify-center shadow-md">
              <Users className="h-8 w-8 text-primary-foreground" />
            </div>
            <h3 className="text-xl font-bold mb-2 text-foreground">
              Admin Control
            </h3>
            <p className="text-muted-foreground">
              Manage bookings and rooms efficiently
            </p>
          </div>
        </div>

        <div className="text-center">
          <Button
            size="lg"
            onClick={() => navigate("/login")}
            className="px-12 py-6 shadow-md hover:shadow-lg transition-all duration-200 text-lg"
          >
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Landing;
