import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function FormsPage() {
  const [forms, setForms] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [formsRes, submissionsRes] = await Promise.all([
        axios.get(`${API}/forms`),
        axios.get(`${API}/forms/submissions`)
      ]);
      setForms(formsRes.data);
      setSubmissions(submissionsRes.data);
    } catch (error) {
      console.error('Failed to fetch forms:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6" data-testid="forms-page">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Forms</h1>

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
                        <p className="font-medium">Submission</p>
                        <Badge variant={sub.status === 'completed' ? 'default' : 'secondary'}>
                          {sub.status}
                        </Badge>
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