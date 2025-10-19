import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

const Landing = () => {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(user.role === 'admin' ? '/admin' : '/dashboard');
    }
  }, [isAuthenticated, user, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/20">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <Calendar className="h-16 w-16 text-primary" />
          </div>
          <h1 className="text-5xl font-bold text-primary mb-4">QuickRoom</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            College Room & Resource Booking System - Simple, Fast, Efficient
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-16 max-w-5xl mx-auto">
          <div className="bg-card p-6 rounded-lg shadow-lg border border-border text-center">
            <Calendar className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Easy Booking</h3>
            <p className="text-muted-foreground">Book rooms in seconds with our intuitive interface</p>
          </div>
          <div className="bg-card p-6 rounded-lg shadow-lg border border-border text-center">
            <Clock className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Real-time Availability</h3>
            <p className="text-muted-foreground">Check room availability instantly</p>
          </div>
          <div className="bg-card p-6 rounded-lg shadow-lg border border-border text-center">
            <Users className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Admin Control</h3>
            <p className="text-muted-foreground">Manage bookings and rooms efficiently</p>
          </div>
        </div>

        <div className="text-center">
          <Button size="lg" onClick={() => navigate('/login')} className="px-8">
            Get Started
          </Button>
          <p className="mt-4 text-sm text-muted-foreground">
            Demo credentials: student@college.edu / student123 or admin@college.edu / admin123
          </p>
        </div>
      </div>
    </div>
  );
};

export default Landing;
