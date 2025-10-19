import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { getBookings } from '@/lib/mockData';
import { Calendar, LogOut, ArrowLeft } from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';

const CalendarView = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const bookings = getBookings();
  
  const events = bookings.map((booking) => ({
    id: booking.id,
    title: `${booking.roomName} - ${booking.userName}`,
    start: `${booking.date}T${booking.startTime}`,
    end: `${booking.date}T${booking.endTime}`,
    backgroundColor: booking.status === 'approved' ? '#22c55e' : booking.status === 'rejected' ? '#ef4444' : '#eab308',
    borderColor: booking.status === 'approved' ? '#16a34a' : booking.status === 'rejected' ? '#dc2626' : '#ca8a04',
    extendedProps: {
      ...booking,
    },
  }));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-success text-white';
      case 'rejected':
        return 'bg-destructive text-white';
      default:
        return 'bg-pending text-white';
    }
  };

  return (
    <div className="min-h-screen bg-secondary/20">
      <header className="bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(user?.role === 'admin' ? '/admin' : '/dashboard')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              <h1 className="text-xl font-bold text-primary">Calendar View</h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">Welcome, {user?.name}</span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="bg-card p-6 rounded-lg border border-border">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="dayGridMonth"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: 'dayGridMonth,timeGridWeek,timeGridDay'
            }}
            events={events}
            eventClick={(info) => setSelectedEvent(info.event.extendedProps)}
            height="auto"
          />
        </div>
      </div>

      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Booking Details</DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <h3 className="font-semibold text-lg">{selectedEvent.roomName}</h3>
                <Badge className={getStatusColor(selectedEvent.status)}>
                  {selectedEvent.status.toUpperCase()}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Booked by</p>
                  <p className="font-medium">{selectedEvent.userName}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{new Date(selectedEvent.date).toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Time</p>
                  <p className="font-medium">{selectedEvent.startTime} - {selectedEvent.endTime}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Duration</p>
                  <p className="font-medium">{selectedEvent.duration} hour{selectedEvent.duration > 1 ? 's' : ''}</p>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Purpose</p>
                <p className="text-sm mt-1">{selectedEvent.purpose}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CalendarView;
