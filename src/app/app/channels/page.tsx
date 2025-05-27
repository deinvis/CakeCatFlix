"use client";

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGrid } from '@/components/content-grid';
import { getAllPlaylistsMetadata, getPlaylistItems, type PlaylistItemCore } from '@/lib/db';
import type { ContentItemForCard } from '@/lib/constants';

const ITEMS_PER_PAGE = 28; // Example: 4 rows of 7 items

export default function ChannelsPage() {
  const [channelItems, setChannelItems] = useState<ContentItemForCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState(false);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const transformPlaylistItemToCardItem = (item: PlaylistItemCore): ContentItemForCard => ({
    id: item.id!.toString(), // Assuming DB item ID is number, card expects string
    title: item.displayName || item.tvgName || 'Canal Desconhecido',
    imageUrl: item.tvgLogo, // Placeholder if undefined will be handled by ContentCard or next/image
    type: 'channel', // Explicitly channel for this page
    genre: item.groupTitle,
    dataAiHint: `channel ${item.groupTitle || item.displayName || ''}`.substring(0, 50).trim().toLowerCase(), // Basic hint
    streamUrl: item.url,
  });

  const fetchChannels = useCallback(async (playlistId: string, page: number) => {
    if (!playlistId) return;
    setIsLoading(true);
    try {
      const offset = (page - 1) * ITEMS_PER_PAGE;
      const itemsFromDB = await getPlaylistItems(playlistId, 'channel', ITEMS_PER_PAGE, offset);
      
      const newCardItems = itemsFromDB.map(transformPlaylistItemToCardItem);
      
      setChannelItems(prevItems => page === 1 ? newCardItems : [...prevItems, ...newCardItems]);
      setHasMore(newCardItems.length === ITEMS_PER_PAGE);

    } catch (error) {
      console.error("Failed to fetch channel items:", error);
      // Handle error (e.g., show toast)
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initialize() {
      setIsLoading(true);
      try {
        const playlists = await getAllPlaylistsMetadata();
        if (playlists.length > 0) {
          setHasPlaylistsConfigured(true);
          // For simplicity, use the first playlist. A real app might have a playlist selector.
          const firstPlaylistId = playlists[0].id;
          setActivePlaylistId(firstPlaylistId);
          setChannelItems([]); // Reset items before fetching for new playlist/page
          setCurrentPage(1); // Reset page
          await fetchChannels(firstPlaylistId, 1);
        } else {
          setHasPlaylistsConfigured(false);
          setChannelItems([]);
        }
      } catch (error) {
        console.error("Failed to initialize channels page:", error);
        setHasPlaylistsConfigured(false);
      } finally {
        setIsLoading(false);
      }
    }
    initialize();
  }, [fetchChannels]); // fetchChannels dependency added

  const loadMoreItems = () => {
    if (activePlaylistId && hasMore && !isLoading) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchChannels(activePlaylistId, nextPage);
    }
  };
  
  return (
    <div className="container mx-auto px-0">
      <PageHeader title="Canais ao Vivo" description="Assista seus canais de TV favoritos."/>
      {hasPlaylistsConfigured ? (
        <ContentGrid 
          items={channelItems} 
          type="channel" 
          isLoading={isLoading}
          loadMoreItems={loadMoreItems}
          hasMore={hasMore}
        />
      ) : (
        // Show loading state first if playlists check is in progress
        isLoading ? <p className="text-muted-foreground text-center py-8">Verificando playlists...</p> : <PlaceholderContent type="canais" />
      )}
    </div>
  );
}
