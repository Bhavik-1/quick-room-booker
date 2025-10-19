import { useState } from 'react';
import { getBookings, updateBooking } from '@/lib/mockData';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Check, X } from 'lucide-react';

export const ApproveBookings = () => {
  const [bookings, setBookings] = useState(getBookings());

  const handleApprove = (id: string) => {
    updateBooking(id, { status: 'approved' });
    setBookings(getBookings());
    toast.success('Booking approved successfully');
  };

  const handleReject = (id: string) => {
    updateBooking(id, { status: 'rejected' });
    setBookings(getBookings());
    toast.success('Booking rejected');
  };

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

  const pendingBookings = bookings.filter(b => b.status === 'pending');
  const otherBookings = bookings.filter(b => b.status !== 'pending');

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Pending Approvals ({pendingBookings.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {pendingBookings.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">No pending bookings</p>
          ) : (
            pendingBookings.map((booking) => (
              <div key={booking.id} className="border border-border rounded-lg p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-lg">{booking.roomName}</h3>
                    <p className="text-sm text-muted-foreground">Requested by: {booking.userName}</p>
                  </div>
                  <Badge className={getStatusColor(booking.status)}>
                    {booking.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Date</p>
                    <p className="font-medium">{new Date(booking.date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Time</p>
                    <p className="font-medium">{booking.startTime} - {booking.endTime}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Duration</p>
                    <p className="font-medium">{booking.duration} hour{booking.duration > 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="mb-4">
                  <p className="text-muted-foreground text-sm">Purpose</p>
                  <p className="text-sm">{booking.purpose}</p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleApprove(booking.id)}
                    className="bg-success hover:bg-success/90"
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    onClick={() => handleReject(booking.id)}
                    variant="destructive"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {otherBookings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>All Bookings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {otherBookings.map((booking) => (
              <div key={booking.id} className="border border-border rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{booking.roomName}</h3>
                    <p className="text-sm text-muted-foreground">{booking.userName}</p>
                  </div>
                  <Badge className={getStatusColor(booking.status)}>
                    {booking.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Date & Time</p>
                    <p>{new Date(booking.date).toLocaleDateString()} • {booking.startTime} - {booking.endTime}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
