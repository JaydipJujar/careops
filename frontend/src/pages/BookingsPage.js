import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Calendar, Clock } from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      const response = await axios.get(`${API}/bookings`);
      setBookings(response.data);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (bookingId, status) => {
    try {
      await axios.put(`${API}/bookings/${bookingId}`, { status });
      toast.success('Booking updated!');
      fetchBookings();
    } catch (error) {
      toast.error('Failed to update booking');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'no-show': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" data-testid="bookings-page">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Bookings</h1>

        <div className="grid gap-4">
          {bookings.map((booking) => (
            <Card key={booking.booking_id} className="border-0 shadow-md" data-testid={`booking-${booking.booking_id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{booking.contact?.name}</h3>
                      <Badge className={getStatusColor(booking.status)} data-testid={`booking-status-${booking.booking_id}`}>
                        {booking.status}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(booking.scheduled_at).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>{new Date(booking.scheduled_at).toLocaleTimeString()}</span>
                      </div>
                      <p>Service: {booking.service?.name}</p>
                      <p>Email: {booking.contact?.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {booking.status === 'confirmed' && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(booking.booking_id, 'completed')}
                          data-testid={`mark-completed-${booking.booking_id}`}
                        >
                          Mark Completed
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(booking.booking_id, 'no-show')}
                          data-testid={`mark-no-show-${booking.booking_id}`}
                        >
                          No Show
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {bookings.length === 0 && (
            <Card className="border-0 shadow-md" data-testid="no-bookings">
              <CardContent className="p-12 text-center text-muted-foreground">
                No bookings yet
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}