"use client";

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { STARTUP_PAGES } from '@/lib/constants';
import { useToast } from "@/hooks/use-toast";
import { Settings2 } from 'lucide-react';

const LOCALSTORAGE_KEY = 'catcakestream_startup_page';

export function StartupPageConfig() {
  const [selectedPage, setSelectedPage] = useState<string>(STARTUP_PAGES[0].value);
  const [isMounted, setIsMounted] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const storedPage = localStorage.getItem(LOCALSTORAGE_KEY);
    if (storedPage && STARTUP_PAGES.some(p => p.value === storedPage)) {
      setSelectedPage(storedPage);
    }
    setIsMounted(true);
  }, []);

  const handleSaveSettings = () => {
    if (!isMounted) return;
    localStorage.setItem(LOCALSTORAGE_KEY, selectedPage);
    toast({
      title: "Settings Saved",
      description: `Default startup page set to "${STARTUP_PAGES.find(p => p.value === selectedPage)?.label}".`,
    });
  };
  
  if (!isMounted) {
     return (
      <Card className="shadow-lg border-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings2 className="h-6 w-6 text-primary" /> Startup Page Configuration</CardTitle>
          <CardDescription>Loading preferences...</CardDescription>
        </CardHeader>
        <CardContent className="h-20 animate-pulse bg-muted/50 rounded-md"></CardContent>
      </Card>
    );
  }


  return (
    <Card className="shadow-lg border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-6 w-6 text-primary" /> Startup Page Configuration
        </CardTitle>
        <CardDescription>Choose which page loads by default when you open the app. This is saved locally in your browser.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="startup-page-select" className="mb-2 block font-medium">Default Startup Page</Label>
          <Select value={selectedPage} onValueChange={setSelectedPage}>
            <SelectTrigger id="startup-page-select" className="w-full md:w-[280px] text-base py-2.5">
              <SelectValue placeholder="Select a page" />
            </SelectTrigger>
            <SelectContent>
              {STARTUP_PAGES.map((page) => (
                <SelectItem key={page.value} value={page.value} className="text-base py-2.5">
                  {page.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleSaveSettings} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            Save Preferences
        </Button>
      </CardContent>
    </Card>
  );
}
