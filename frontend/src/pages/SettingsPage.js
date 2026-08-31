import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-6" data-testid="settings-page">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6" style={{ fontFamily: 'Plus Jakarta Sans, sans-serif' }}>Settings</h1>

        <Card className="border-0 shadow-md">
          <CardHeader>
            <CardTitle>Workspace Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Settings panel coming soon...</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}