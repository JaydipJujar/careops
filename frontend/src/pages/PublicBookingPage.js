import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { Calendar, CheckCircle2, Clock } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function PublicBookingPage() {
  const { workspaceId } = useParams();
  const [services, setServices] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    service_id: '',
    scheduled_at: '',
    contact_name: '',
    contact_email: '',
    contact_phone: ''
  });

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const response = await axios.get(`${API}/services?workspace_id=${workspaceId}`);
      setServices(response.data);
    } catch (error) {
      console.error('Failed to fetch services:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API}/bookings/public?workspace_id=${workspaceId}`, formData);
      setSubmitted(true);
    } catch (error) {
      toast.error('Failed to book. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-green-50 to-white">
        <Card className="w-full max-w-md text-center shadow-xl border-0" data-testid="booking-success">
          <CardContent className="pt-12 pb-8">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Booking Confirmed!
            </h2>
            <p className="text-muted-foreground">
              You'll receive a confirmation email shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-green-50 to-white">
      <Card className="w-full max-w-md shadow-xl border-0" data-testid="booking-form-card">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Book an Appointment</CardTitle>
          <CardDescription>Schedule your service with us</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="booking-form">
            <div>
              <Label htmlFor="service">Service *</Label>
              <Select value={formData.service_id} onValueChange={(value) => setFormData({ ...formData, service_id: value })} required>
                <SelectTrigger data-testid="service-select">
                  <SelectValue placeholder="Select a service" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.service_id} value={service.service_id} data-testid={`service-option-${service.service_id}`}>
                      {service.name} ({service.duration_minutes} min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="datetime">Date & Time *</Label>
              <Input
                id="datetime"
                type="datetime-local"
                value={formData.scheduled_at}
                onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
                required
                data-testid="datetime-input"
              />
            </div>
            <div>
              <Label htmlFor="name">Your Name *</Label>
              <Input
                id="name"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                required
                data-testid="booking-name-input"
              />
            </div>
            <div>
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                required
                data-testid="booking-email-input"
              />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                data-testid="booking-phone-input"
              />
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={loading}
              data-testid="booking-submit-button"
              style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}
            >
              {loading ? 'Booking...' : (
                <>
                  <Calendar className="h-4 w-4 mr-2" />
                  Confirm Booking
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}