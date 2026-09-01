import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from '../components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, Link as LinkIcon, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const emptyField = () => ({ name: '', label: '', type: 'text', required: true });

export default function FormsPage() {
  const [forms, setForms] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [fields, setFields] = useState([emptyField()]);
  const [linkedServiceIds, setLinkedServiceIds] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [formsRes, submissionsRes, servicesRes] = await Promise.all([
        axios.get(`${API}/forms`),
        axios.get(`${API}/forms/submissions`),
        axios.get(`${API}/services`),
      ]);
      setForms(formsRes.data);
      setSubmissions(submissionsRes.data);
      setServices(servicesRes.data);
    } catch (error) {
      console.error('Failed to fetch forms:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (idx, key, value) => {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, [key]: value } : f)));
  };

  const addField = () => setFields((prev) => [...prev, emptyField()]);
  const removeField = (idx) => setFields((prev) => prev.filter((_, i) => i !== idx));

  const toggleService = (serviceId) => {
    setLinkedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  const resetCreateForm = () => {
    setFormName('');
    setFormDescription('');
    setFields([emptyField()]);
    setLinkedServiceIds([]);
  };

  const submitCreateForm = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await axios.post(`${API}/forms`, {
        name: formName,
        description: formDescription,
        fields: fields.map((f) => ({ ...f, name: f.name || f.label.toLowerCase().replace(/\s+/g, '_') })),
        linked_service_ids: linkedServiceIds,
      });
      toast.success('Form template created');
      setCreateOpen(false);
      resetCreateForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create form');
    } finally {
      setCreating(false);
    }
  };

  const copySubmissionLink = (submissionId) => {
    const link = `${window.location.origin}/public/forms/${submissionId}`;
    navigator.clipboard.writeText(link);
    toast.success('Link copied to clipboard');
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" data-testid="forms-page">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Forms</h1>
          <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) resetCreateForm(); }}>
            <DialogTrigger asChild>
              <Button data-testid="create-form-button"><Plus className="h-4 w-4 mr-2" /> New Form</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create a form template</DialogTitle>
              </DialogHeader>
              <form onSubmit={submitCreateForm} className="space-y-4" data-testid="create-form-form">
                <div>
                  <Label>Form Name *</Label>
                  <Input value={formName} onChange={(e) => setFormName(e.target.value)} required placeholder="e.g., Intake Form" />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={formDescription} onChange={(e) => setFormDescription(e.target.value)} placeholder="Optional" />
                </div>

                <div>
                  <Label>Fields</Label>
                  <div className="space-y-2 mt-2">
                    {fields.map((field, idx) => (
                      <div key={idx} className="flex gap-2 items-start p-2 bg-gray-50 rounded">
                        <Input
                          placeholder="Field label"
                          value={field.label}
                          onChange={(e) => updateField(idx, 'label', e.target.value)}
                          required
                          className="flex-1"
                        />
                        <select
                          className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                          value={field.type}
                          onChange={(e) => updateField(idx, 'type', e.target.value)}
                        >
                          <option value="text">Text</option>
                          <option value="email">Email</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                          <option value="textarea">Long text</option>
                        </select>
                        <Button type="button" variant="ghost" size="icon" onClick={() => removeField(idx)} disabled={fields.length === 1}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                  <Button type="button" variant="outline" size="sm" className="mt-2" onClick={addField}>
                    <Plus className="h-4 w-4 mr-1" /> Add field
                  </Button>
                </div>

                {services.length > 0 && (
                  <div>
                    <Label>Send automatically when booking these services</Label>
                    <div className="flex flex-wrap gap-3 mt-2">
                      {services.map((service) => (
                        <label key={service.service_id} className="flex items-center gap-1.5 text-sm">
                          <input
                            type="checkbox"
                            checked={linkedServiceIds.includes(service.service_id)}
                            onChange={() => toggleService(service.service_id)}
                          />
                          {service.name}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <DialogFooter>
                  <Button type="submit" disabled={creating}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create Form'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-0 shadow-md" data-testid="forms-list">
            <CardHeader>
              <CardTitle>Form Templates</CardTitle>
            </CardHeader>
            <CardContent>
              {forms.length > 0 ? (
                <div className="space-y-3">
                  {forms.map((form) => (
                    <div key={form.form_id} className="p-3 bg-gray-50 rounded-lg" data-testid={`form-${form.form_id}`}>
                      <h3 className="font-medium">{form.name}</h3>
                      <p className="text-sm text-muted-foreground">{form.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">{form.fields.length} field{form.fields.length !== 1 ? 's' : ''}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8" data-testid="no-forms">No forms created yet</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md" data-testid="submissions-list">
            <CardHeader>
              <CardTitle>Recent Submissions</CardTitle>
            </CardHeader>
            <CardContent>
              {submissions.length > 0 ? (
                <div className="space-y-3">
                  {submissions.map((sub) => (
                    <div key={sub.submission_id} className="p-3 bg-gray-50 rounded-lg" data-testid={`submission-${sub.submission_id}`}>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{sub.form?.name || 'Form'}</p>
                          <p className="text-xs text-muted-foreground">{sub.contact?.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={sub.status === 'completed' ? 'default' : 'secondary'}>
                            {sub.status}
                          </Badge>
                          {sub.status === 'pending' && (
                            <Button variant="ghost" size="icon" onClick={() => copySubmissionLink(sub.submission_id)} data-testid={`copy-link-${sub.submission_id}`}>
                              <LinkIcon className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8" data-testid="no-submissions">No submissions yet</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
