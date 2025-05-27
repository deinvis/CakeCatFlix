
"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
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
import { Input } from '@/components/ui/input';

const ITEMS_PER_PAGE = 28;

// Helper to transform raw PlaylistItem (episode) to an aggregated Series Card
const transformEpisodeDataToSeriesCard = (episodes: PlaylistItem[]): Map<string, ContentItemForCard> => {
    const seriesMap = new Map<string, ContentItemForCard>();
    episodes.forEach(episode => {
        const seriesKey = episode.seriesTitle || episode.title; // seriesTitle should be preferred
        if (!seriesKey) return;

        if (!seriesMap.has(seriesKey)) {
            seriesMap.set(seriesKey, {
                id: episode.tvgId || episode.seriesTitle || episode.id!.toString(), // A unique ID for the series, tvgId or title
                seriesId: episode.tvgId || episode.seriesTitle || episode.id!.toString(), // ID used for navigation to series player
                title: episode.seriesTitle || episode.title,
                imageUrl: episode.logoUrl,
                type: 'series',
                genre: episode.genre || episode.groupTitle,
                dataAiHint: `series ${episode.seriesTitle || episode.genre || ''}`.substring(0, 50).trim().toLowerCase(),
                sourceCount: 0, // Will count episodes
            });
        }
        const seriesCard = seriesMap.get(seriesKey)!;
        seriesCard.sourceCount = (seriesCard.sourceCount || 0) + 1; // Increment episode count
        // Logic to pick a "better" imageUrl, e.g., from S01E01 or if current one is missing
        if (episode.logoUrl && (!seriesCard.imageUrl || (episode.seasonNumber === 1 && episode.episodeNumber === 1))) {
            seriesCard.imageUrl = episode.logoUrl;
        }
    });
    return seriesMap;
};


export default function SeriesGenrePage() {
  const params = useParams<{ genreName: string }>();
  const genreNameDecoded = params.genreName ? decodeURIComponent(params.genreName) : "Unknown Genre";

  const [allFetchedSeriesForGenre, setAllFetchedSeriesForGenre] = useState<ContentItemForCard[]>([]);
  const [displayedItems, setDisplayedItems] = useState<ContentItemForCard[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isPaginating, setIsPaginating] = useState(false);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState<boolean | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [genreExistsInMock, setGenreExistsInMock] = useState<boolean | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const foundGenre = MOCK_SERIES_GENRES.find(g => g.toLowerCase() === genreNameDecoded.toLowerCase());
    setGenreExistsInMock(!!foundGenre);
  }, [genreNameDecoded]);

  const fetchAllSeriesForGenre = useCallback(async (playlistId: string, genre: string) => {
    if (!playlistId || !genre) return;
    setIsLoading(true);
    try {
      // Fetch ALL episode items for this genre to aggregate into series cards
      const episodeItemsFromDB = await getPlaylistItemsByGroup(playlistId, genre, undefined, undefined, 'series_episode');
      
      const seriesMap = transformEpisodeDataToSeriesCard(episodeItemsFromDB as PlaylistItem[]);
      const allUniqueSeries = Array.from(seriesMap.values()).sort((a, b) => a.title.localeCompare(b.title));
      
      setAllFetchedSeriesForGenre(allUniqueSeries);
      setCurrentPage(1);
    } catch (error) {
      console.error(`Failed to fetch all series for genre "${genre}":`, error);
      setAllFetchedSeriesForGenre([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initialize() {
      setHasPlaylistsConfigured(null);
      setIsLoading(true);
      setAllFetchedSeriesForGenre([]);
      setDisplayedItems([]);
      setCurrentPage(1);
      setHasMore(true);
      setSearchTerm('');
      try {
        const playlists = await getAllPlaylistsMetadata();
        if (playlists.length > 0 && playlists[0]?.id) {
          setHasPlaylistsConfigured(true);
          const firstPlaylistId = playlists[0].id;
          setActivePlaylistId(firstPlaylistId);
          if (genreNameDecoded !== "Unknown Genre") {
            await fetchAllSeriesForGenre(firstPlaylistId, genreNameDecoded);
          } else {
             setAllFetchedSeriesForGenre([]);
          }
        } else {
          setHasPlaylistsConfigured(false);
        }
      } catch (error) {
        console.error("Failed to initialize series genre page:", error);
        setHasPlaylistsConfigured(false);
      }
    }
     if (genreNameDecoded !== "Unknown Genre") {
        initialize();
    } else {
        setIsLoading(false);
        setDisplayedItems([]);
        setHasPlaylistsConfigured(false);
    }
  }, [genreNameDecoded, fetchAllSeriesForGenre]);

  // Effect for filtering and pagination
  useEffect(() => {
    if (isLoading) return; 

    setIsPaginating(true);
    const filtered = allFetchedSeriesForGenre.filter(item =>
      item.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const offset = (currentPage - 1) * ITEMS_PER_PAGE;
    const newPageItems = filtered.slice(offset, offset + ITEMS_PER_PAGE);

    if (currentPage === 1) {
      setDisplayedItems(newPageItems);
    } else {
      // Prevent adding duplicates if effect runs multiple times with same newPageItems
      setDisplayedItems(prevItems => {
        const existingIds = new Set(prevItems.map(item => item.id));
        const trulyNewItems = newPageItems.filter(item => !existingIds.has(item.id));
        return trulyNewItems.length > 0 ? [...prevItems, ...trulyNewItems] : prevItems;
      });
    }
    setHasMore(filtered.length > offset + ITEMS_PER_PAGE);
    setIsPaginating(false);

  }, [allFetchedSeriesForGenre, searchTerm, currentPage, isLoading]);

  const loadMoreItems = () => {
    if (hasMore && !isPaginating && !isLoading) {
      setCurrentPage(prevPage => prevPage + 1);
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
    setCurrentPage(1); 
    setDisplayedItems([]); 
  };
  
  if (hasPlaylistsConfigured === null || (isLoading && allFetchedSeriesForGenre.length === 0 && genreNameDecoded !== "Unknown Genre")) {
     return (
         <div className="container mx-auto px-0">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <Skeleton className="h-10 w-48 rounded-md" />
                <Skeleton className="h-10 w-full sm:w-auto sm:max-w-xs rounded-md" />
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
  
  if (genreExistsInMock === false && !isLoading && allFetchedSeriesForGenre.length === 0 && hasPlaylistsConfigured === true) {
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
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Button variant="outline" asChild>
          <Link href="/app/series">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Gêneros de Séries
          </Link>
        </Button>
        <Input 
          type="search" 
          placeholder={`Buscar em ${genreNameDecoded}...`} 
          className="w-full sm:w-auto sm:max-w-xs"
          value={searchTerm}
          onChange={handleSearchChange}
        />
      </div>
      <PageHeader title={genreNameDecoded} description={`Explore as melhores séries de TV de ${genreNameDecoded}.`} />
      {hasPlaylistsConfigured ? (
         (displayedItems.length > 0 || isLoading || isPaginating) ? (
            <ContentGrid 
            items={displayedItems} 
            type="series" 
            isLoading={isLoading && displayedItems.length === 0}
            loadMoreItems={loadMoreItems}
            hasMore={hasMore}
            />
        ) : (
             !isLoading && !isPaginating && searchTerm && <p className="text-muted-foreground text-center py-8">Nenhuma série encontrada para "{searchTerm}" em "{genreNameDecoded}".</p>
        ) || (
             !isLoading && !isPaginating && <p className="text-muted-foreground text-center py-8">Nenhuma série encontrada para o gênero "{genreNameDecoded}" nas suas playlists.</p>
        )
      ) : (
         <PlaceholderContent type="séries" message={`Nenhuma playlist configurada ou nenhuma série de ${genreNameDecoded} encontrada.`} />
      )}
       {(isPaginating && displayedItems.length > 0) && (
        <p className="text-muted-foreground text-center py-8">Carregando mais séries...</p>
      )}
    </div>
  );
}
