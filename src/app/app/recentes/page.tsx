
"use client";

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGrid } from '@/components/content-grid';
import { MOCK_CONTENT_ITEMS, type ContentItemForCard } from '@/lib/constants'; // MOCK_PLAYLISTS removed
import { getAllPlaylistsMetadata } from '@/lib/db';
import { Skeleton } from '@/components/ui/skeleton';

export default function RecentesPage() {
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // Recent items would be fetched from a specific "recents" store/log in IndexedDB or similar
  const [recentItems, setRecentItems] = useState<ContentItemForCard[]>([]);


  useEffect(() => {
    async function initialize() {
      setIsLoading(true);
      try {
        const playlists = await getAllPlaylistsMetadata();
        const isConfigured = playlists.length > 0;
        setHasPlaylistsConfigured(isConfigured);

        if (isConfigured) {
          // TODO: Replace with actual logic to fetch recent items from DB
          // For now, use mock data if playlists are configured.
          setRecentItems(MOCK_CONTENT_ITEMS(10, "recently watched"));
        } else {
          setRecentItems([]);
        }
      } catch (error) {
        console.error("Failed to initialize recents page:", error);
        setHasPlaylistsConfigured(false);
        setRecentItems([]);
      } finally {
        setIsLoading(false);
      }
    }
    initialize();
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto px-0">
        <PageHeader title="Recentes" description="Continue de onde parou."/>
         <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] w-full">
              <Skeleton className="h-full w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4 mt-2 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-0">
      <PageHeader title="Recentes" description="Continue de onde parou."/>
      {hasPlaylistsConfigured ? (
        recentItems.length > 0 ? (
          <ContentGrid items={recentItems} type="movie" /> // Type might need to be dynamic based on recent item
        ) : (
           <p className="text-muted-foreground text-center py-8">Nenhum item visto recentemente.</p>
        )
      ) : (
        <PlaceholderContent type="recentes" message="Nenhum item visto recentemente ou playlists não configuradas." />
      )}
    </div>
  );
}
