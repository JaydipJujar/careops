import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { CheckCircle2, FileText, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function PublicFormFillPage() {
  const { submissionId } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(null);
  const [submission, setSubmission] = useState(null);
  const [values, setValues] = useState({});

  useEffect(() => {
    fetchForm();
  }, [submissionId]);

  const fetchForm = async () => {
    try {
      const response = await axios.get(`${API}/forms/public/${submissionId}`);
      setForm(response.data.form);
      setSubmission(response.data.submission);
      setValues(response.data.submission.data || {});
    } catch (err) {
      setError(
        err.response?.status === 404
          ? "This form link doesn't exist or has expired."
          : 'Something went wrong loading this form.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (fieldName, value) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post(`${API}/forms/public/${submissionId}/submit`, { data: values });
      setSubmission((prev) => ({ ...prev, status: 'completed' }));
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field) => {
    const key = field.name || field.label;
    const commonProps = {
      id: key,
      value: values[key] || '',
      onChange: (e) => handleChange(key, e.target.value),
      required: field.required !== false,
    };

    if (field.type === 'textarea') {
      return <Textarea rows={4} {...commonProps} />;
    }
    return <Input type={field.type === 'email' ? 'email' : field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'} {...commonProps} />;
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 to-white">
        <Card className="w-full max-w-md text-center shadow-xl border-0">
          <CardContent className="pt-12 pb-8">
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submission?.status === 'completed') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-green-50 to-white">
        <Card className="w-full max-w-md text-center shadow-xl border-0" data-testid="form-submitted">
          <CardContent className="pt-12 pb-8">
            <div className="flex justify-center mb-4">
              <CheckCircle2 className="h-16 w-16 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>
              Thanks, all done!
            </h2>
            <p className="text-muted-foreground">Your form has been received.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-indigo-50 to-white">
      <Card className="w-full max-w-lg shadow-xl border-0" data-testid="public-form-card">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <FileText className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>{form.name}</CardTitle>
          {form.description && <CardDescription>{form.description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4" data-testid="public-form">
            {form.fields.map((field, idx) => (
              <div key={field.name || idx}>
                <Label htmlFor={field.name || field.label}>
                  {field.label || field.name} {field.required !== false && '*'}
                </Label>
                {renderField(field)}
              </div>
            ))}
            <Button
              type="submit"
              className="w-full"
              disabled={submitting}
              data-testid="public-form-submit"
              style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
