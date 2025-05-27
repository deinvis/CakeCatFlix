
"use client";

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGrid } from '@/components/content-grid';
import { MOCK_SERIES_GENRES, type ContentItemForCard, type PlaylistItemCore } from '@/lib/constants';
import { getAllPlaylistsMetadata, getPlaylistItemsByGroup } from '@/lib/db';
import { useParams } from 'next/navigation'; // Use useParams for client component
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const ITEMS_PER_PAGE = 28;

// Helper function
const transformPlaylistItemToCardItem = (item: PlaylistItemCore): ContentItemForCard => ({
  id: item.id!.toString(),
  title: item.displayName || item.tvgName || 'Unknown Series',
  imageUrl: item.tvgLogo,
  type: 'series',
  genre: item.groupTitle,
  dataAiHint: `series ${item.groupTitle || item.displayName || ''}`.substring(0, 50).trim().toLowerCase(),
  streamUrl: item.url,
});


export default function SeriesGenrePage() {
  const params = useParams<{ genreName: string }>();
  const genreNameDecoded = decodeURIComponent(params.genreName);

  const [seriesItems, setSeriesItems] = useState<ContentItemForCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState(false);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [genreExistsInMock, setGenreExistsInMock] = useState<boolean | null>(null); // Renamed for clarity

  useEffect(() => {
    const foundGenre = MOCK_SERIES_GENRES.find(g => g.toLowerCase() === genreNameDecoded.toLowerCase());
    setGenreExistsInMock(!!foundGenre);
    if (!foundGenre) {
        console.warn(`Genre "${genreNameDecoded}" not found in MOCK_SERIES_GENRES. Content might still exist in DB.`);
    }
  }, [genreNameDecoded]);


  const fetchSeriesByGenre = useCallback(async (playlistId: string, genre: string, page: number) => {
    if (!playlistId || !genre) return;
    setIsLoading(true);
    try {
      const offset = (page - 1) * ITEMS_PER_PAGE;
      const itemsFromDB = await getPlaylistItemsByGroup(playlistId, genre, ITEMS_PER_PAGE, offset);
      
      const newCardItems = itemsFromDB.map(transformPlaylistItemToCardItem);
      
      setSeriesItems(prevItems => page === 1 ? newCardItems : [...prevItems, ...newCardItems]);
      setHasMore(newCardItems.length === ITEMS_PER_PAGE);

    } catch (error) {
      console.error(`Failed to fetch series for genre "${genre}":`, error);
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
          const firstPlaylistId = playlists[0].id;
          setActivePlaylistId(firstPlaylistId);
          setSeriesItems([]);
          setCurrentPage(1);
          await fetchSeriesByGenre(firstPlaylistId, genreNameDecoded, 1);
        } else {
          setHasPlaylistsConfigured(false);
          setSeriesItems([]);
        }
      } catch (error) {
        console.error("Failed to initialize series genre page:", error);
        setHasPlaylistsConfigured(false);
      } finally {
        setIsLoading(false);
      }
    }
    initialize();
  }, [genreNameDecoded, fetchSeriesByGenre]);

  const loadMoreItems = () => {
    if (activePlaylistId && hasMore && !isLoading) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchSeriesByGenre(activePlaylistId, genreNameDecoded, nextPage);
    }
  };
  
  // This "genre not found" UI is based on MOCK_SERIES_GENRES.
  // If content for a genre exists in DB but not in MOCK_SERIES_GENRES,
  // it will still be displayed by ContentGrid. This block might show if MOCK_SERIES_GENRES is strict.
  if (genreExistsInMock === false && !isLoading && seriesItems.length === 0 && !hasPlaylistsConfigured) {
     return (
      <div className="container mx-auto px-0 py-8 text-center">
        <PageHeader title="Genre Not Found" description={`The series genre "${genreNameDecoded}" does not seem to exist or no content is available.`} />
        <Button variant="outline" asChild className="mt-4">
          <Link href="/app/series">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Series Genres
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-0">
      <div className="mb-4">
        <Button variant="outline" asChild>
          <Link href="/app/series">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Series Genres
          </Link>
        </Button>
      </div>
      <PageHeader title={genreNameDecoded} description={`Explore the best ${genreNameDecoded} TV series.`} />
      {hasPlaylistsConfigured ? (
        <ContentGrid 
          items={seriesItems} 
          type="series" 
          genre={genreNameDecoded} 
          isLoading={isLoading}
          loadMoreItems={loadMoreItems}
          hasMore={hasMore}
        />
      ) : (
        isLoading ? <p className="text-muted-foreground text-center py-8">Verificando playlists e séries...</p> : <PlaceholderContent type="series" message={`No playlists configured or no ${genreNameDecoded} series found.`} />
      )}
    </div>
  );
}
