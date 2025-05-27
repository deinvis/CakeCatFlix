
"use client";

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGrid } from '@/components/content-grid';
import { MOCK_CONTENT_ITEMS, type ContentItemForCard } from '@/lib/constants'; // MOCK_PLAYLISTS removed
import { getAllPlaylistsMetadata } from '@/lib/db';
import { Skeleton } from '@/components/ui/skeleton';

export default function FavoritosPage() {
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // Favorite items would be fetched from a specific "favorites" store in IndexedDB or similar
  const [favoriteItems, setFavoriteItems] = useState<ContentItemForCard[]>([]);

  useEffect(() => {
    async function initialize() {
      setIsLoading(true);
      try {
        const playlists = await getAllPlaylistsMetadata();
        const isConfigured = playlists.length > 0;
        setHasPlaylistsConfigured(isConfigured);

        if (isConfigured) {
          // TODO: Replace with actual logic to fetch favorite items from DB
          // For now, use mock data if playlists are configured.
          setFavoriteItems(MOCK_CONTENT_ITEMS(8, "favorite movie"));
        } else {
          setFavoriteItems([]);
        }
      } catch (error) {
        console.error("Failed to initialize favorites page:", error);
        setHasPlaylistsConfigured(false);
        setFavoriteItems([]);
      } finally {
        setIsLoading(false);
      }
    }
    initialize();
  }, []);

  if (isLoading) {
    return (
      <div className="container mx-auto px-0">
        <PageHeader title="Favoritos" description="Sua lista de filmes e séries favoritos."/>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
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
      <PageHeader title="Favoritos" description="Sua lista de filmes e séries favoritos."/>
      {hasPlaylistsConfigured ? (
        favoriteItems.length > 0 ? (
          <ContentGrid items={favoriteItems} type="movie" /> // Type might need to be dynamic based on favorited item
        ) : (
          <p className="text-muted-foreground text-center py-8">Você ainda não adicionou nenhum item aos favoritos.</p>
        )
      ) : (
        <PlaceholderContent type="favoritos" message="Nenhum item favoritado ou playlists não configuradas." />
      )}
    </div>
  );
}
