import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Calendar, Users, FileText, Package, AlertCircle, Inbox, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Alert, AlertDescription } from '../components/ui/alert';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, alertsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`),
        axios.get(`${API}/alerts`)
      ]);
      setStats(statsRes.data);
      setAlerts(alertsRes.data.filter(a => !a.is_read).slice(0, 5));
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const statCards = [
    { title: 'Today\'s Bookings', value: stats?.bookings?.today || 0, icon: Calendar, color: 'bg-blue-500', link: '/bookings' },
    { title: 'Total Contacts', value: stats?.contacts?.total || 0, icon: Users, color: 'bg-green-500', link: '/contacts' },
    { title: 'Pending Forms', value: stats?.forms?.pending || 0, icon: FileText, color: 'bg-yellow-500', link: '/forms' },
    { title: 'Low Stock Items', value: stats?.inventory?.low_stock_count || 0, icon: Package, color: 'bg-red-500', link: '/inventory' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white" data-testid="dashboard-page">
      <header className="bg-white border-b sticky top-0 z-10 shadow-sm">
        <div className="px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }} data-testid="dashboard-title">CareOps Dashboard</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user?.email}</span>
            <Button variant="outline" size="sm" onClick={logout} data-testid="logout-button">
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <nav className="bg-white border-b">
        <div className="px-6 py-3 flex gap-4 overflow-x-auto">
          <Button variant="ghost" onClick={() => navigate('/dashboard')} data-testid="nav-dashboard">Dashboard</Button>
          <Button variant="ghost" onClick={() => navigate('/inbox')} data-testid="nav-inbox">Inbox</Button>
          <Button variant="ghost" onClick={() => navigate('/bookings')} data-testid="nav-bookings">Bookings</Button>
          <Button variant="ghost" onClick={() => navigate('/contacts')} data-testid="nav-contacts">Contacts</Button>
          <Button variant="ghost" onClick={() => navigate('/forms')} data-testid="nav-forms">Forms</Button>
          <Button variant="ghost" onClick={() => navigate('/inventory')} data-testid="nav-inventory">Inventory</Button>
          <Button variant="ghost" onClick={() => navigate('/settings')} data-testid="nav-settings">Settings</Button>
        </div>
      </nav>

      <main className="p-6 lg:p-12" data-testid="dashboard-content">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((card, index) => (
            <Card 
              key={index} 
              className="cursor-pointer hover:shadow-lg transition-all duration-200 border-0 overflow-hidden"
              onClick={() => navigate(card.link)}
              data-testid={`stat-card-${index}`}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{card.title}</p>
                    <h3 className="text-3xl font-bold mt-2">{card.value}</h3>
                  </div>
                  <div className={`${card.color} p-3 rounded-xl`}>
                    <card.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {alerts.length > 0 && (
          <Card className="mb-8 border-0 shadow-md" data-testid="alerts-section">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                Active Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {alerts.map((alert, index) => (
                <Alert key={alert.alert_id} variant="default" className="border-l-4 border-l-orange-500" data-testid={`alert-${index}`}>
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{alert.title}</p>
                        <p className="text-sm text-muted-foreground">{alert.message}</p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={async () => {
                          await axios.put(`${API}/alerts/${alert.alert_id}/read`);
                          fetchData();
                        }}
                        data-testid={`dismiss-alert-${index}`}
                      >
                        Dismiss
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-md" data-testid="quick-actions-card">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/inbox')} data-testid="quick-action-inbox">
                <Inbox className="h-4 w-4 mr-2" />
                Check Inbox
              </Button>
              <Button variant="outline" className="w-full justify-start" onClick={() => navigate('/bookings')} data-testid="quick-action-bookings">
                <Calendar className="h-4 w-4 mr-2" />
                View Bookings
              </Button>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md" data-testid="public-links-card">
            <CardHeader>
              <CardTitle>Public Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm font-medium mb-1">Contact Form</p>
                <code className="text-xs bg-gray-100 p-2 rounded block break-all" data-testid="contact-form-link">
                  {window.location.origin}/public/contact/{user?.workspace_id}
                </code>
              </div>
              <div>
                <p className="text-sm font-medium mb-1">Booking Page</p>
                <code className="text-xs bg-gray-100 p-2 rounded block break-all" data-testid="booking-page-link">
                  {window.location.origin}/public/booking/{user?.workspace_id}
                </code>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
