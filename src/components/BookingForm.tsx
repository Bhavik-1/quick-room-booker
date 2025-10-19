import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { getRooms, addBooking, checkAvailability } from '@/lib/mockData';
import { toast } from 'sonner';

export const BookingForm = () => {
  const { user } = useAuth();
  const rooms = getRooms();
  const [formData, setFormData] = useState({
    roomId: '',
    date: '',
    startTime: '',
    duration: '1',
    purpose: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) return;

    const endTime = new Date(`${formData.date}T${formData.startTime}`);
    endTime.setHours(endTime.getHours() + parseInt(formData.duration));
    const endTimeStr = endTime.toTimeString().slice(0, 5);

    const isAvailable = checkAvailability(formData.roomId, formData.date, formData.startTime, endTimeStr);
    
    if (!isAvailable) {
      toast.error('Room is not available for the selected time slot');
      return;
    }

    const room = rooms.find(r => r.id === formData.roomId);
    if (!room) return;

    addBooking({
      userId: user.id,
      userName: user.name,
      roomId: formData.roomId,
      roomName: room.name,
      date: formData.date,
      startTime: formData.startTime,
      endTime: endTimeStr,
      duration: parseInt(formData.duration),
      purpose: formData.purpose,
      status: 'pending',
    });

    toast.success('Booking request submitted successfully!');
    setFormData({ roomId: '', date: '', startTime: '', duration: '1', purpose: '' });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="room">Room</Label>
        <Select value={formData.roomId} onValueChange={(value) => setFormData({ ...formData, roomId: value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select a room" />
          </SelectTrigger>
          <SelectContent>
            {rooms.map((room) => (
              <SelectItem key={room.id} value={room.id}>
                {room.name} (Capacity: {room.capacity})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            min={new Date().toISOString().split('T')[0]}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="time">Start Time</Label>
          <Input
            id="time"
            type="time"
            value={formData.startTime}
            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="duration">Duration (hours)</Label>
        <Select value={formData.duration} onValueChange={(value) => setFormData({ ...formData, duration: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 4, 5, 6].map((hour) => (
              <SelectItem key={hour} value={hour.toString()}>
                {hour} hour{hour > 1 ? 's' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="purpose">Purpose</Label>
        <Textarea
          id="purpose"
          value={formData.purpose}
          onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
          placeholder="Describe the purpose of your booking..."
          required
        />
      </div>

      <Button type="submit" className="w-full">Submit Booking Request</Button>
    </form>
  );
};
