import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const steps = [
  { id: 1, title: 'Create Workspace', description: 'Set up your business details' },
  { id: 2, title: 'Email & SMS', description: 'Connect communication channels' },
  { id: 3, title: 'Services', description: 'Define your service offerings' },
  { id: 4, title: 'Availability', description: 'Set your working hours' },
  { id: 5, title: 'Complete', description: 'Activate your workspace' }
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  const [businessName, setBusinessName] = useState('');
  const [address, setAddress] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [contactEmail, setContactEmail] = useState(user?.email || '');

  const [serviceName, setServiceName] = useState('');
  const [serviceDuration, setServiceDuration] = useState(30);

  const handleStep1 = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/workspace`, {
        business_name: businessName,
        address,
        timezone,
        contact_email: contactEmail
      });
      setWorkspace(response.data);
      toast.success('Workspace created!');
      setCurrentStep(2);
    } catch (error) {
      toast.error('Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  const handleStep2 = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/integrations`, {
        email_enabled: true,
        sms_enabled: false
      });
      toast.success('Integrations configured!');
      setCurrentStep(3);
    } catch (error) {
      toast.error('Failed to configure integrations');
    } finally {
      setLoading(false);
    }
  };

  const handleStep3 = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/services`, {
        name: serviceName,
        duration_minutes: serviceDuration,
        location: address
      });
      toast.success('Service created!');
      setCurrentStep(4);
    } catch (error) {
      toast.error('Failed to create service');
    } finally {
      setLoading(false);
    }
  };

  const handleStep4 = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/availability`, {
        day_of_week: 1,
        start_time: '09:00',
        end_time: '17:00'
      });
      toast.success('Availability set!');
      setCurrentStep(5);
    } catch (error) {
      toast.error('Failed to set availability');
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/workspace/activate`);
      toast.success('Workspace activated! Welcome to CareOps!');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Failed to activate workspace');
    } finally {
      setLoading(false);
    }
  };

  const progress = (currentStep / steps.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-white p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 text-center" data-testid="onboarding-header">
          <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Welcome to CareOps</h1>
          <p className="text-muted-foreground">Let's set up your workspace in a few simple steps</p>
        </div>

        <div className="mb-8">
          <Progress value={progress} className="h-2" data-testid="onboarding-progress" />
          <div className="flex justify-between mt-4">
            {steps.map((step) => (
              <div key={step.id} className="flex flex-col items-center" data-testid={`step-indicator-${step.id}`}>
                {currentStep > step.id ? (
                  <CheckCircle2 className="h-8 w-8 text-green-500" />
                ) : currentStep === step.id ? (
                  <Circle className="h-8 w-8 text-primary fill-primary" />
                ) : (
                  <Circle className="h-8 w-8 text-gray-300" />
                )}
                <span className="text-xs mt-1 text-center">{step.title}</span>
              </div>
            ))}
          </div>
        </div>

        <Card className="shadow-lg border-0" data-testid="onboarding-card">
          <CardHeader>
            <CardTitle>{steps[currentStep - 1]?.title}</CardTitle>
            <CardDescription>{steps[currentStep - 1]?.description}</CardDescription>
          </CardHeader>
          <CardContent>
            {currentStep === 1 && (
              <form onSubmit={handleStep1} className="space-y-4" data-testid="step-1-form">
                <div>
                  <Label>Business Name *</Label>
                  <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} required data-testid="business-name-input" />
                </div>
                <div>
                  <Label>Address</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} data-testid="address-input" />
                </div>
                <div>
                  <Label>Contact Email *</Label>
                  <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} required data-testid="contact-email-input" />
                </div>
                <Button type="submit" className="w-full" disabled={loading} data-testid="step-1-submit">
                  {loading ? <Loader2 className="animate-spin" /> : 'Continue'}
                </Button>
              </form>
            )}

            {currentStep === 2 && (
              <form onSubmit={handleStep2} className="space-y-4" data-testid="step-2-form">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm font-medium text-green-800">✓ Email integration configured</p>
                  <p className="text-xs text-green-600 mt-1">Your workspace can now send emails</p>
                </div>
                <Button type="submit" className="w-full" disabled={loading} data-testid="step-2-submit">
                  {loading ? <Loader2 className="animate-spin" /> : 'Continue'}
                </Button>
              </form>
            )}

            {currentStep === 3 && (
              <form onSubmit={handleStep3} className="space-y-4" data-testid="step-3-form">
                <div>
                  <Label>Service Name *</Label>
                  <Input value={serviceName} onChange={(e) => setServiceName(e.target.value)} required placeholder="e.g., Consultation" data-testid="service-name-input" />
                </div>
                <div>
                  <Label>Duration (minutes) *</Label>
                  <Input type="number" value={serviceDuration} onChange={(e) => setServiceDuration(e.target.value)} required data-testid="service-duration-input" />
                </div>
                <Button type="submit" className="w-full" disabled={loading} data-testid="step-3-submit">
                  {loading ? <Loader2 className="animate-spin" /> : 'Continue'}
                </Button>
              </form>
            )}

            {currentStep === 4 && (
              <form onSubmit={handleStep4} className="space-y-4" data-testid="step-4-form">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-medium text-blue-800">Default availability set</p>
                  <p className="text-xs text-blue-600 mt-1">Monday to Friday, 9:00 AM - 5:00 PM</p>
                  <p className="text-xs text-blue-600 mt-2">You can customize this later in Settings</p>
                </div>
                <Button type="submit" className="w-full" disabled={loading} data-testid="step-4-submit">
                  {loading ? <Loader2 className="animate-spin" /> : 'Continue'}
                </Button>
              </form>
            )}

            {currentStep === 5 && (
              <div className="space-y-4 text-center" data-testid="step-5-complete">
                <div className="flex justify-center">
                  <CheckCircle2 className="h-20 w-20 text-green-500" />
                </div>
                <h3 className="text-2xl font-bold">You're all set!</h3>
                <p className="text-muted-foreground">Your workspace is ready to go. Let's activate it and start managing your operations.</p>
                <Button onClick={handleActivate} className="w-full" disabled={loading} data-testid="activate-button">
                  {loading ? <Loader2 className="animate-spin" /> : 'Activate Workspace'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
