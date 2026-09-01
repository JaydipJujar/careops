import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, UserPlus, Trash2, Mail, MessageSquare } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PERMISSION_MODULES = [
  { key: 'inbox', label: 'Inbox' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'forms', label: 'Forms' },
  { key: 'inventory', label: 'Inventory' },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const isOwner = user?.role === 'owner';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [workspace, setWorkspace] = useState(null);
  const [integrations, setIntegrations] = useState(null);
  const [staff, setStaff] = useState([]);

  const [form, setForm] = useState({ business_name: '', address: '', timezone: '', contact_email: '' });

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [invitePermissions, setInvitePermissions] = useState({ inbox: true, bookings: true, forms: true, inventory: true });
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const calls = [axios.get(`${API}/workspace`), axios.get(`${API}/integrations`)];
      if (isOwner) calls.push(axios.get(`${API}/staff`));
      const results = await Promise.all(calls);
      const ws = results[0].data;
      setWorkspace(ws);
      setForm({
        business_name: ws.business_name || '',
        address: ws.address || '',
        timezone: ws.timezone || '',
        contact_email: ws.contact_email || '',
      });
      setIntegrations(results[1].data);
      if (isOwner) setStaff(results[2].data);
    } catch (error) {
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const saveWorkspace = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await axios.put(`${API}/workspace`, form);
      setWorkspace(response.data);
      toast.success('Workspace updated');
    } catch (error) {
      toast.error('Failed to update workspace');
    } finally {
      setSaving(false);
    }
  };

  const submitInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    try {
      await axios.post(`${API}/staff/invite`, {
        email: inviteEmail,
        password: invitePassword,
        permissions: invitePermissions,
      });
      toast.success('Staff member invited');
      setInviteOpen(false);
      setInviteEmail('');
      setInvitePassword('');
      setInvitePermissions({ inbox: true, bookings: true, forms: true, inventory: true });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to invite staff member');
    } finally {
      setInviting(false);
    }
  };

  const togglePermission = async (staffMember, moduleKey) => {
    const updated = { ...staffMember.permissions, [moduleKey]: !staffMember.permissions[moduleKey] };
    try {
      await axios.put(`${API}/staff/${staffMember.user_id}/permissions`, { permissions: updated });
      setStaff((prev) => prev.map((s) => (s.user_id === staffMember.user_id ? { ...s, permissions: updated } : s)));
    } catch (error) {
      toast.error('Failed to update permissions');
    }
  };

  const removeStaff = async (staffMember) => {
    if (!window.confirm(`Remove ${staffMember.email}?`)) return;
    try {
      await axios.delete(`${API}/staff/${staffMember.user_id}`);
      setStaff((prev) => prev.filter((s) => s.user_id !== staffMember.user_id));
      toast.success('Staff member removed');
    } catch (error) {
      toast.error('Failed to remove staff member');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" data-testid="settings-page">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Settings</h1>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Workspace Settings</CardTitle>
            <CardDescription>Your business details, shown to customers on booking and contact pages</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveWorkspace} className="space-y-4" data-testid="workspace-settings-form">
              <div>
                <Label htmlFor="business_name">Business Name</Label>
                <Input
                  id="business_name"
                  value={form.business_name}
                  onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                  disabled={!isOwner}
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  disabled={!isOwner}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="timezone">Time Zone</Label>
                  <Input
                    id="timezone"
                    value={form.timezone}
                    onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                    disabled={!isOwner}
                  />
                </div>
                <div>
                  <Label htmlFor="contact_email">Contact Email</Label>
                  <Input
                    id="contact_email"
                    type="email"
                    value={form.contact_email}
                    onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                    disabled={!isOwner}
                  />
                </div>
              </div>
              {isOwner && (
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
                </Button>
              )}
            </form>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>Communication channels connected to this workspace</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-6">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              <span className="text-sm">Email</span>
              <Badge variant={integrations?.email_enabled ? 'default' : 'secondary'}>
                {integrations?.email_enabled ? 'Connected' : 'Not connected'}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm">SMS</span>
              <Badge variant={integrations?.sms_enabled ? 'default' : 'secondary'}>
                {integrations?.sms_enabled ? 'Connected' : 'Not connected'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {isOwner && (
          <Card className="border-0 shadow-md" data-testid="staff-management">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Staff</CardTitle>
                <CardDescription>Invite staff and control which modules they can access</CardDescription>
              </div>
              <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="invite-staff-button">
                    <UserPlus className="h-4 w-4 mr-2" /> Invite Staff
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Invite a staff member</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={submitInvite} className="space-y-4" data-testid="invite-staff-form">
                    <div>
                      <Label htmlFor="invite-email">Email</Label>
                      <Input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
                    </div>
                    <div>
                      <Label htmlFor="invite-password">Temporary Password</Label>
                      <Input id="invite-password" type="text" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} required minLength={8} />
                    </div>
                    <div>
                      <Label>Permissions</Label>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {PERMISSION_MODULES.map((mod) => (
                          <label key={mod.key} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={invitePermissions[mod.key]}
                              onChange={(e) => setInvitePermissions({ ...invitePermissions, [mod.key]: e.target.checked })}
                            />
                            {mod.label}
                          </label>
                        ))}
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={inviting}>
                        {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send Invite'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {staff.length > 0 ? (
                <div className="space-y-3">
                  {staff.map((member) => (
                    <div key={member.user_id} className="p-3 bg-gray-50 rounded-lg" data-testid={`staff-${member.user_id}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{member.email}</span>
                        <Button variant="ghost" size="icon" onClick={() => removeStaff(member)} data-testid={`remove-staff-${member.user_id}`}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {PERMISSION_MODULES.map((mod) => (
                          <label key={mod.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <input
                              type="checkbox"
                              checked={!!member.permissions?.[mod.key]}
                              onChange={() => togglePermission(member, mod.key)}
                            />
                            {mod.label}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8" data-testid="no-staff">No staff members yet</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
