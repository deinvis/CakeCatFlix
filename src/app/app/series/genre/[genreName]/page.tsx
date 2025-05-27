
"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGrid } from '@/components/content-grid';
import type { ContentItemForCard, SeriesItem } from '@/lib/constants';
import { getAllPlaylistsMetadata, getPlaylistItemsByGroup } from '@/lib/db';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';

const ITEMS_PER_PAGE = 28;

const transformSeriesItemToCardItem = (item: SeriesItem): ContentItemForCard => ({
  id: item.id!.toString(),
  seriesId: item.id!.toString(), // For navigation to series player
  title: item.title,
  imageUrl: item.logoUrl,
  type: 'series',
  genre: item.genre,
  dataAiHint: `series ${item.title || item.genre || ''}`.substring(0, 50).trim().toLowerCase(),
  // sourceCount: For this page, we are not fetching episode counts per series to simplify.
  // The main series page handles episode counts.
});


export default function SeriesGenrePage() {
  const params = useParams<{ genreName: string }>();
  const genreNameDecoded = useMemo(() => params.genreName ? decodeURIComponent(params.genreName) : "Unknown Genre", [params.genreName]);

  const [allFetchedSeriesForGenre, setAllFetchedSeriesForGenre] = useState<SeriesItem[]>([]);
  const [displayedItems, setDisplayedItems] = useState<ContentItemForCard[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isPaginating, setIsPaginating] = useState(false);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState<boolean | null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAllSeriesForGenre = useCallback(async (playlistId: string, genre: string) => {
    if (!playlistId || !genre || genre === "Unknown Genre") {
      setAllFetchedSeriesForGenre([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const seriesItemsFromDB = await getPlaylistItemsByGroup(playlistId, genre, 'series') as SeriesItem[];
      setAllFetchedSeriesForGenre(seriesItemsFromDB.sort((a,b) => a.title.localeCompare(b.title)));
      setCurrentPage(1);
    } catch (error) {
      console.error(`Failed to fetch series for genre "${genre}":`, error);
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
             setIsLoading(false); 
          }
        } else {
          setHasPlaylistsConfigured(false);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to initialize series genre page:", error);
        setHasPlaylistsConfigured(false);
        setIsLoading(false);
      }
    }
    initialize();
  }, [genreNameDecoded, fetchAllSeriesForGenre]);

  useEffect(() => {
    if (isLoading && allFetchedSeriesForGenre.length === 0) return; 

    setIsPaginating(true);
    
    const seriesCards = allFetchedSeriesForGenre.map(transformSeriesItemToCardItem);

    const filtered = seriesCards.filter(item =>
      item.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const offset = (currentPage - 1) * ITEMS_PER_PAGE;
    const newPageItems = filtered.slice(offset, offset + ITEMS_PER_PAGE);

    if (currentPage === 1) {
      setDisplayedItems(newPageItems);
    } else {
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
  
  if (!isLoading && !isPaginating && hasPlaylistsConfigured && genreNameDecoded !== "Unknown Genre" && allFetchedSeriesForGenre.length === 0 && !searchTerm) {
     return (
      <div className="container mx-auto px-0 py-8 text-center">
        <PageHeader title="Gênero Vazio ou Inválido" description={`O gênero de série "${genreNameDecoded}" não contém séries ou não foi encontrado nas suas playlists.`} />
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
         (displayedItems.length > 0 || isLoading || isPaginating ) ? ( // Show grid if items or loading
            <ContentGrid 
            items={displayedItems} 
            type="series" 
            isLoading={isLoading && displayedItems.length === 0 && allFetchedSeriesForGenre.length === 0} // Only show grid loading if truly initial load and no items
            loadMoreItems={loadMoreItems}
            hasMore={hasMore}
            />
        ) : ( // Conditions for empty/no results messages
             !isLoading && !isPaginating && searchTerm && <p className="text-muted-foreground text-center py-8">Nenhuma série encontrada para "{searchTerm}" em "{genreNameDecoded}".</p>
        ) || (
             !isLoading && !isPaginating && allFetchedSeriesForGenre.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhuma série encontrada para o gênero "{genreNameDecoded}" nas suas playlists.</p>
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


    