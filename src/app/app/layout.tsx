
import type { ReactNode } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toaster } from "@/components/ui/toaster";
import { TopNavbar } from '@/components/layout/top-navbar'; // New import

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <TopNavbar />
      <main className="flex-1 overflow-hidden"> {/* Use flex-1 to take remaining height, overflow-hidden with ScrollArea inside */}
        <ScrollArea className="h-full"> {/* ScrollArea to fill the main content area */}
          <div className="container mx-auto max-w-screen-2xl p-4 py-6 md:p-6 md:py-8">
            {children}
          </div>
        </ScrollArea>
      </main>
      <Toaster />
    </div>
  );
}
