import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { BookingForm } from '@/components/BookingForm';
import { MyBookings } from '@/components/MyBookings';
import { Calendar, LogOut, BookOpen, List } from 'lucide-react';
import { initializeStorage } from '@/lib/mockData';

const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'book' | 'bookings'>('book');

  useEffect(() => {
    if (!user || user.role !== 'student') {
      navigate('/login');
    }
    initializeStorage();
  }, [user, navigate]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-secondary/20">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-primary">QuickRoom</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Welcome, {user.name}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-4 gap-6">
          <aside className="space-y-2">
            <Button
              variant={activeTab === 'book' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActiveTab('book')}
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Book Room
            </Button>
            <Button
              variant={activeTab === 'bookings' ? 'default' : 'ghost'}
              className="w-full justify-start"
              onClick={() => setActiveTab('bookings')}
            >
              <List className="h-4 w-4 mr-2" />
              My Bookings
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => navigate('/calendar')}
            >
              <Calendar className="h-4 w-4 mr-2" />
              Calendar
            </Button>
          </aside>

          <div className="md:col-span-3">
            {activeTab === 'book' && (
              <Card>
                <CardHeader>
                  <CardTitle>Book a Room</CardTitle>
                  <CardDescription>Fill in the details to request a room booking</CardDescription>
                </CardHeader>
                <CardContent>
                  <BookingForm />
                </CardContent>
              </Card>
            )}
            {activeTab === 'bookings' && <MyBookings />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentDashboard;
