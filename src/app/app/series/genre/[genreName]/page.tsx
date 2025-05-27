
"use client";

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGrid } from '@/components/content-grid';
import { type ContentItemForCard, type PlaylistItem, MOCK_SERIES_GENRES } from '@/lib/constants';
import { getAllPlaylistsMetadata, getPlaylistItemsByGroup } from '@/lib/db';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const ITEMS_PER_PAGE = 28;

// Transforms a PlaylistItem (episode) into a ContentItemForCard representing the series
const transformEpisodeToSeriesCard = (item: PlaylistItem): ContentItemForCard => ({
  id: item.seriesTitle || item.id!.toString(), // Use seriesTitle as ID for aggregation, or episode ID
  title: item.seriesTitle || item.title, // Display series title
  imageUrl: item.logoUrl, // Logo for the series (could be from any episode)
  type: 'series',
  genre: item.genre || item.groupTitle,
  dataAiHint: `series ${item.seriesTitle || item.genre || ''}`.substring(0, 50).trim().toLowerCase(),
  // streamUrl: item.streamUrl, // Not for series card, but for episode card if we were listing episodes
  seriesId: item.tvgId || item.seriesTitle,
  // sourceCount will be set during aggregation if we group episodes by series
});


export default function SeriesGenrePage() {
  const params = useParams<{ genreName: string }>();
  const genreNameDecoded = params.genreName ? decodeURIComponent(params.genreName) : "Unknown Genre";

  const [seriesCardItems, setSeriesCardItems] = useState<ContentItemForCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState<boolean | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [genreExistsInMock, setGenreExistsInMock] = useState<boolean | null>(null);

  useEffect(() => {
    const foundGenre = MOCK_SERIES_GENRES.find(g => g.toLowerCase() === genreNameDecoded.toLowerCase());
    setGenreExistsInMock(!!foundGenre);
  }, [genreNameDecoded]);

  const fetchSeriesByGenre = useCallback(async (playlistId: string, genre: string, page: number) => {
    if (!playlistId || !genre) return;
    setIsLoading(true);
    try {
      const offset = (page - 1) * ITEMS_PER_PAGE;
      // Fetch all episodes of this genre
      const episodeItemsFromDB = await getPlaylistItemsByGroup(playlistId, genre, undefined, undefined, 'series_episode');
      
      // Aggregate episodes into unique series cards
      const seriesMap = new Map<string, ContentItemForCard>();
      episodeItemsFromDB.forEach(episode => {
        const seriesKey = episode.seriesTitle || episode.title;
        if(!seriesKey) return;

        if (!seriesMap.has(seriesKey)) {
          seriesMap.set(seriesKey, {
            id: episode.seriesTitle || episode.id!.toString(),
            title: episode.seriesTitle || episode.title,
            imageUrl: episode.logoUrl,
            type: 'series',
            genre: episode.genre || episode.groupTitle,
            dataAiHint: `series ${episode.seriesTitle || episode.genre || ''}`.substring(0, 50).trim().toLowerCase(),
            seriesId: episode.tvgId || episode.seriesTitle,
            sourceCount: 0, // Count of episodes
          });
        }
        const seriesCard = seriesMap.get(seriesKey)!;
        seriesCard.sourceCount = (seriesCard.sourceCount || 0) + 1;
        if (episode.logoUrl && (!seriesCard.imageUrl || episode.seasonNumber === 1 && episode.episodeNumber === 1)){
            seriesCard.imageUrl = episode.logoUrl;
        }
      });
      
      const allUniqueSeriesForGenre = Array.from(seriesMap.values()).sort((a,b) => a.title.localeCompare(b.title));
      
      // Apply pagination to the aggregated series list
      const paginatedSeries = allUniqueSeriesForGenre.slice(offset, offset + ITEMS_PER_PAGE);
      
      setSeriesCardItems(prevItems => page === 1 ? paginatedSeries : [...prevItems, ...paginatedSeries]);
      setHasMore(allUniqueSeriesForGenre.length > (offset + ITEMS_PER_PAGE));

    } catch (error) {
      console.error(`Failed to fetch series for genre "${genre}":`, error);
      setSeriesCardItems(prev => page === 1 ? [] : prev);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initialize() {
      setHasPlaylistsConfigured(null);
      setIsLoading(true);
      try {
        const playlists = await getAllPlaylistsMetadata();
        if (playlists.length > 0 && playlists[0]?.id) {
          setHasPlaylistsConfigured(true);
          const firstPlaylistId = playlists[0].id;
          setActivePlaylistId(firstPlaylistId);
          setSeriesCardItems([]); // Reset items
          setCurrentPage(1);    // Reset page
          await fetchSeriesByGenre(firstPlaylistId, genreNameDecoded, 1);
        } else {
          setHasPlaylistsConfigured(false);
          setSeriesCardItems([]);
        }
      } catch (error) {
        console.error("Failed to initialize series genre page:", error);
        setHasPlaylistsConfigured(false);
      } finally {
        setIsLoading(false);
      }
    }
    if (genreNameDecoded !== "Unknown Genre") {
        initialize();
    } else {
        setIsLoading(false);
        setHasPlaylistsConfigured(false);
    }
  }, [genreNameDecoded, fetchSeriesByGenre]);

  const loadMoreItems = () => {
    if (activePlaylistId && hasMore && !isLoading) {
      const nextPage = currentPage + 1;
      fetchSeriesByGenre(activePlaylistId, genreNameDecoded, nextPage);
      setCurrentPage(nextPage);
    }
  };
  
  if (hasPlaylistsConfigured === null || (isLoading && seriesCardItems.length === 0 && genreNameDecoded !== "Unknown Genre")) {
     return (
         <div className="container mx-auto px-0">
            <div className="mb-4">
                <Skeleton className="h-10 w-48 rounded-md" />
            </div>
            <PageHeader title={genreNameDecoded} description={`Explorando as melhores séries de ${genreNameDecoded}...`} />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-6">
            {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] w-full">
                <Skeleton className="h-full w-full rounded-lg" />
                <Skeleton className="h-4 w-3/4 mt-2 rounded-md" />
                <Skeleton className="h-3 w-1/2 mt-1 rounded-md" />
                </div>
            ))}
            </div>
        </div>
    );
  }
  
  if (genreExistsInMock === false && !isLoading && seriesCardItems.length === 0 && hasPlaylistsConfigured === true) {
     return (
      <div className="container mx-auto px-0 py-8 text-center">
        <PageHeader title="Gênero Não Encontrado" description={`O gênero de série "${genreNameDecoded}" não parece existir ou nenhum conteúdo está disponível nas suas playlists.`} />
        <Button variant="outline" asChild className="mt-4">
          <Link href="/app/series">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Gêneros de Séries
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
            Voltar para Gêneros de Séries
          </Link>
        </Button>
      </div>
      <PageHeader title={genreNameDecoded} description={`Explore as melhores séries de TV de ${genreNameDecoded}.`} />
      {hasPlaylistsConfigured ? (
         seriesCardItems.length > 0 || isLoading ? (
            <ContentGrid 
            items={seriesCardItems} 
            type="series" 
            genre={genreNameDecoded} 
            isLoading={isLoading && seriesCardItems.length === 0}
            loadMoreItems={loadMoreItems}
            hasMore={hasMore}
            />
        ) : (
             !isLoading && <p className="text-muted-foreground text-center py-8">Nenhuma série encontrada para o gênero "{genreNameDecoded}" nas suas playlists.</p>
        )
      ) : (
         <PlaceholderContent type="séries" message={`Nenhuma playlist configurada ou nenhuma série de ${genreNameDecoded} encontrada.`} />
      )}
       {isLoading && seriesCardItems.length > 0 && (
        <p className="text-muted-foreground text-center py-8">Carregando mais séries...</p>
      )}
    </div>
  );
}
