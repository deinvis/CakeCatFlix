import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger, // For mobile
} from '@/components/ui/sidebar';
import { AppLogo } from '@/components/app-logo';
import { NAV_LINKS, SETTINGS_NAV_LINK } from '@/lib/constants';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Toaster } from "@/components/ui/toaster";

export default function AppLayout({ children }: { children: ReactNode }) {
  // Active state (e.g., using usePathname) would require this to be a Client Component
  // or pass pathname down. For simplicity in this server component, active state is visual via hover/focus.
  // Tooltips will assist when collapsed.

  return (
    <SidebarProvider defaultOpen={true}> {/* Default to open sidebar on desktop */}
      <Sidebar collapsible="icon" variant="sidebar" className="border-sidebar-border">
        <SidebarHeader className="p-3 md:p-4">
          <div className="flex items-center justify-between">
            {/* Logo will be hidden when collapsed if it contains text that would overflow */}
            <div className="overflow-hidden">
              <AppLogo />
            </div>
            <SidebarTrigger className="md:hidden" /> {/* Only show on mobile for drawer toggle */}
          </div>
        </SidebarHeader>
        
        <SidebarContent className="p-0"> {/* Remove padding from SidebarContent if SidebarMenu handles it */}
          <ScrollArea className="h-full"> {/* Ensure ScrollArea takes available height */}
            <SidebarMenu className="p-2 md:p-3"> {/* Add padding to SidebarMenu */}
              {NAV_LINKS.map((link) => (
                <SidebarMenuItem key={link.href}>
                  <Link href={link.href} className="block">
                    <SidebarMenuButton 
                      className="w-full"
                      tooltip={{ children: link.label, className: "bg-primary text-primary-foreground" }}
                    >
                      <link.icon />
                      <span>{link.label}</span>
                    </SidebarMenuButton>
                  </Link>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </ScrollArea>
        </SidebarContent>

        <SidebarFooter className="p-2 md:p-3 border-t border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <Link href={SETTINGS_NAV_LINK.href} className="block">
                <SidebarMenuButton 
                  className="w-full"
                  tooltip={{ children: SETTINGS_NAV_LINK.label, className: "bg-primary text-primary-foreground" }}
                >
                  <SETTINGS_NAV_LINK.icon />
                  <span>{SETTINGS_NAV_LINK.label}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <ScrollArea className="h-screen"> {/* Make content area scrollable independently */}
          <div className="p-4 py-6 md:p-6 md:py-8">
            {children}
          </div>
        </ScrollArea>
      </SidebarInset>
      <Toaster />
    </SidebarProvider>
  );
}
