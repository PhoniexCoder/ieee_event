'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';

export default function AdminDashboard() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (session) {
      fetchSpreadsheetId();
    }
  }, [session]);

  const fetchSpreadsheetId = async () => {
    try {
      const response = await fetch('/api/admin/spreadsheet');
      if (response.ok) {
        const data = await response.json();
        setSpreadsheetId(data.spreadsheetId || '');
      } else {
        toast({
          title: "Error",
          description: "Failed to fetch spreadsheet ID.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error fetching spreadsheet ID:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while fetching the spreadsheet ID.",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/admin/spreadsheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ spreadsheetId }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: "Spreadsheet ID updated successfully.",
        });
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.message || "Failed to update spreadsheet ID.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error updating spreadsheet ID:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred while updating the spreadsheet ID.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Admin Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="spreadsheetId">Google Spreadsheet ID</Label>
              <Input
                id="spreadsheetId"
                type="text"
                placeholder="Enter Spreadsheet ID"
                value={spreadsheetId}
                onChange={(e) => setSpreadsheetId(e.target.value)}
                required
              />
            </div>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Spreadsheet ID'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
