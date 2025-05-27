
"use client";

import { useEffect, useState, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGrid } from '@/components/content-grid';
import { type ContentItemForCard, type MovieItem } from '@/lib/constants';
import { getAllPlaylistsMetadata, getPlaylistItemsByGroup } from '@/lib/db';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const ITEMS_PER_PAGE = 28;

const transformPlaylistItemToCardItem = (item: MovieItem): ContentItemForCard => ({
  id: item.id!.toString(),
  title: item.title,
  imageUrl: item.logoUrl,
  type: 'movie',
  genre: item.genre || item.groupTitle,
  dataAiHint: `movie ${item.genre || item.groupTitle || item.title || ''}`.substring(0, 50).trim().toLowerCase(),
  streamUrl: item.streamUrl,
  year: item.year, // Ensure year is passed
});

export default function MovieGenrePage() {
  const params = useParams<{ genreName: string }>();
  const genreNameDecoded = useMemo(() => params.genreName ? decodeURIComponent(params.genreName) : "Unknown Genre", [params.genreName]);

  const [allFetchedItemsForGenre, setAllFetchedItemsForGenre] = useState<ContentItemForCard[]>([]);
  const [displayedItems, setDisplayedItems] = useState<ContentItemForCard[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isPaginating, setIsPaginating] = useState(false);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState<boolean|null>(null);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>("all");
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  const fetchAllMoviesForGenre = useCallback(async (playlistId: string, genre: string) => {
    if (!playlistId || !genre || genre === "Unknown Genre") {
      setAllFetchedItemsForGenre([]);
      setAvailableYears([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const itemsFromDB = await getPlaylistItemsByGroup(playlistId, genre, 'movie');
      const cardItems = itemsFromDB.map(transformPlaylistItemToCardItem);
      setAllFetchedItemsForGenre(cardItems);

      const years = Array.from(new Set(cardItems.map(item => item.year).filter(year => year !== undefined))) as number[];
      setAvailableYears(years.sort((a, b) => b - a)); // Sort descending

      setCurrentPage(1); 
    } catch (error) {
      console.error(`Failed to fetch all movies for genre "${genre}":`, error);
      setAllFetchedItemsForGenre([]);
      setAvailableYears([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    async function initialize() {
      setHasPlaylistsConfigured(null);
      setIsLoading(true);
      setAllFetchedItemsForGenre([]);
      setDisplayedItems([]);
      setAvailableYears([]);
      setCurrentPage(1);
      setHasMore(true);
      setSearchTerm('');
      setSelectedYear("all");

      try {
        const playlists = await getAllPlaylistsMetadata();
        if (playlists.length > 0 && playlists[0]?.id) {
          setHasPlaylistsConfigured(true);
          const firstPlaylistId = playlists[0].id;
          setActivePlaylistId(firstPlaylistId);
          await fetchAllMoviesForGenre(firstPlaylistId, genreNameDecoded);
        } else {
          setHasPlaylistsConfigured(false);
          setAllFetchedItemsForGenre([]);
          setAvailableYears([]);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to initialize movie genre page:", error);
        setHasPlaylistsConfigured(false);
        setAllFetchedItemsForGenre([]);
        setAvailableYears([]);
        setIsLoading(false);
      }
    }
    if (genreNameDecoded !== "Unknown Genre") {
        initialize();
    } else {
        setIsLoading(false);
        setDisplayedItems([]);
        setAvailableYears([]);
        setHasPlaylistsConfigured(false);
        setAllFetchedItemsForGenre([]);
    }
  }, [genreNameDecoded, fetchAllMoviesForGenre]);

  useEffect(() => {
    if (isLoading && displayedItems.length === 0 && allFetchedItemsForGenre.length === 0) return; 

    setIsPaginating(true);
    let filtered = allFetchedItemsForGenre;

    if (selectedYear !== "all") {
      const yearNum = parseInt(selectedYear, 10);
      filtered = filtered.filter(item => item.year === yearNum);
    }

    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.title.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

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

  }, [allFetchedItemsForGenre, searchTerm, selectedYear, currentPage, isLoading, displayedItems.length]);


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

  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    setCurrentPage(1);
    setDisplayedItems([]);
  };
  
  if (hasPlaylistsConfigured === null || (isLoading && allFetchedItemsForGenre.length === 0 && genreNameDecoded !== "Unknown Genre")) {
    return (
         <div className="container mx-auto px-0">
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <Skeleton className="h-10 w-48 rounded-md" />
                 <div className="flex gap-2">
                    <Skeleton className="h-10 w-24 rounded-md" />
                    <Skeleton className="h-10 w-full sm:w-auto sm:max-w-xs rounded-md" />
                </div>
            </div>
            <PageHeader title={genreNameDecoded} description={`Descobrindo os melhores filmes de ${genreNameDecoded}...`} />
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
  
  if (!isLoading && !isPaginating && hasPlaylistsConfigured && genreNameDecoded !== "Unknown Genre" && allFetchedItemsForGenre.length === 0 && !searchTerm && selectedYear === "all") {
     return (
      <div className="container mx-auto px-0 py-8 text-center">
        <PageHeader title="Gênero Não Encontrado" description={`O gênero de filme "${genreNameDecoded}" não parece existir ou nenhum conteúdo está disponível nas suas playlists.`} />
        <Button variant="outline" asChild className="mt-4">
          <Link href="/app/movies">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Filmes
          </Link>
        </Button>
      </div>
    );
  }


  return (
    <div className="container mx-auto px-0">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Button variant="outline" asChild>
          <Link href="/app/movies">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar para Filmes
          </Link>
        </Button>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {availableYears.length > 0 && (
            <div className="w-full sm:w-auto">
              <Label htmlFor="year-select" className="sr-only">Filtrar por Ano</Label>
              <Select value={selectedYear} onValueChange={handleYearChange}>
                <SelectTrigger id="year-select" className="w-full sm:w-[150px]">
                  <SelectValue placeholder="Filtrar por ano" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os Anos</SelectItem>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Input 
            type="search" 
            placeholder={`Buscar em ${genreNameDecoded}...`} 
            className="w-full sm:w-auto sm:max-w-xs"
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>
      </div>
      <PageHeader title={genreNameDecoded} description={`Descubra os melhores filmes de ${genreNameDecoded}${selectedYear !== "all" ? ` do ano ${selectedYear}` : ''}.`} />
      {hasPlaylistsConfigured ? (
        (displayedItems.length > 0 || isLoading || isPaginating) ? (
            <ContentGrid 
            items={displayedItems} 
            type="movie" 
            isLoading={isLoading && displayedItems.length === 0 && allFetchedItemsForGenre.length === 0} 
            loadMoreItems={loadMoreItems}
            hasMore={hasMore}
            />
        ) : (
             !isLoading && !isPaginating && (searchTerm || selectedYear !== "all") && <p className="text-muted-foreground text-center py-8">Nenhum filme encontrado para os filtros aplicados em "{genreNameDecoded}".</p>
        ) || (
             !isLoading && !isPaginating && allFetchedItemsForGenre.length === 0 && <p className="text-muted-foreground text-center py-8">Nenhum filme encontrado para o gênero "{genreNameDecoded}" nas suas playlists.</p>
        )
      ) : (
         <PlaceholderContent type="filmes" message={`Nenhuma playlist configurada ou nenhum filme de ${genreNameDecoded} encontrado.`}/>
      )}
       {(isPaginating && displayedItems.length > 0) && (
        <p className="text-muted-foreground text-center py-8">Carregando mais filmes...</p>
      )}
    </div>
  );
}

    