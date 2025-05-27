
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ContentCard } from './content-card';
import type { ContentItemForCard } from '@/lib/constants';
import { ChevronRight } from 'lucide-react';

interface ContentGroupRowProps {
  title: string;
  items: ContentItemForCard[];
  viewAllLink?: string; 
  itemType: 'movie' | 'series' | 'channel'; // Added 'channel' for completeness, though not used here yet
}

const PREVIEW_ITEM_COUNT = 6; // Adjusted to 6 as per user request

export function ContentGroupRow({ title, items, viewAllLink, itemType }: ContentGroupRowProps) {
  if (!items || items.length === 0) {
    return null; 
  }

  const previewItems = items.slice(0, PREVIEW_ITEM_COUNT);

  return (
    <section className="mb-8 md:mb-12">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl sm:text-2xl font-semibold text-foreground tracking-tight">{title}</h2>
        {viewAllLink && items.length > 0 && ( 
          <Button variant="link" asChild className="text-primary hover:text-primary/80">
            <Link href={viewAllLink}>
              Ver Todos <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </Button>
        )}
      </div>
      <div className="relative">
        <div className="flex overflow-x-auto space-x-4 pb-4 scrollbar-thin scrollbar-thumb-muted-foreground/50 scrollbar-track-transparent">
          {previewItems.map(item => (
            <div key={item.id} className="w-[150px] sm:w-[160px] md:w-[180px] flex-shrink-0">
              {/* Pass all item properties, including seriesId if present */}
              <ContentCard {...item} /> 
            </div>
          ))}
          {viewAllLink && items.length > previewItems.length && (
             <div className="w-[150px] sm:w-[160px] md:w-[180px] flex-shrink-0 flex items-center justify-center">
                <Button variant="outline" asChild className="h-full w-full">
                    <Link href={viewAllLink} className="flex flex-col items-center justify-center">
                        <ChevronRight className="h-8 w-8 mb-2"/>
                        Ver Todos
                    </Link>
                </Button>
             </div>
          )}
        </div>
      </div>
    </section>
  );
}

// Add this to globals.css or a Tailwind plugin if you want custom scrollbars more globally
// For now, a simple scrollbar-thin might require a plugin:
// 1. npm install -D tailwind-scrollbar
// 2. Add to tailwind.config.js plugins: require('tailwind-scrollbar'),
// If not using a plugin, the default browser scrollbar will appear.
// For this example, I'm using class names that assume you might add such a plugin.
// If not, remove scrollbar-thin scrollbar-thumb-muted-foreground/50 scrollbar-track-transparent
// or style scrollbars using standard CSS if needed.
