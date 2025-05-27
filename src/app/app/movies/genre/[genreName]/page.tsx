
"use client";

import { useEffect, useState, useCallback } from 'react';
import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGrid } from '@/components/content-grid';
import { MOCK_MOVIE_GENRES, type ContentItemForCard, type PlaylistItemCore } from '@/lib/constants';
import { getAllPlaylistsMetadata, getPlaylistItemsByGroup } from '@/lib/db';
import { useParams } from 'next/navigation'; // Use useParams for client component
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const ITEMS_PER_PAGE = 28;

// Helper function (can be moved to a shared utils if used elsewhere)
const transformPlaylistItemToCardItem = (item: PlaylistItemCore): ContentItemForCard => ({
  id: item.id!.toString(),
  title: item.displayName || item.tvgName || 'Unknown Movie',
  imageUrl: item.tvgLogo,
  type: 'movie',
  genre: item.groupTitle,
  dataAiHint: `movie ${item.groupTitle || item.displayName || ''}`.substring(0, 50).trim().toLowerCase(),
  streamUrl: item.url,
});

export default function MovieGenrePage() {
  const params = useParams<{ genreName: string }>(); // Use hook for params
  const genreNameDecoded = decodeURIComponent(params.genreName);

  const [movieItems, setMovieItems] = useState<ContentItemForCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPlaylistsConfigured, setHasPlaylistsConfigured] = useState(false);
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [genreExists, setGenreExists] = useState<boolean | null>(null);


  // Validate genre (client-side, consider implications if generateStaticParams is used)
  useEffect(() => {
    // MOCK_MOVIE_GENRES is used for an initial check.
    // If a genre is valid in the DB but not in MOCK_MOVIE_GENRES, it would still be fetched.
    // The "genre not found" UI below relies on this MOCK check.
    // A more robust check might involve querying the DB for available genres if MOCK_MOVIE_GENRES is not exhaustive.
    const foundGenre = MOCK_MOVIE_GENRES.find(g => g.toLowerCase() === genreNameDecoded.toLowerCase());
    setGenreExists(!!foundGenre);
    if (!foundGenre) {
        console.warn(`Genre "${genreNameDecoded}" not found in MOCK_MOVIE_GENRES. Content might still exist in DB if group titles differ.`);
    }
  }, [genreNameDecoded]);


  const fetchMoviesByGenre = useCallback(async (playlistId: string, genre: string, page: number) => {
    if (!playlistId || !genre) return;
    setIsLoading(true);
    try {
      const offset = (page - 1) * ITEMS_PER_PAGE;
      // Use the decoded genre name for fetching from DB, as it should match groupTitle
      const itemsFromDB = await getPlaylistItemsByGroup(playlistId, genre, ITEMS_PER_PAGE, offset);
      
      const newCardItems = itemsFromDB.map(transformPlaylistItemToCardItem);
      
      setMovieItems(prevItems => page === 1 ? newCardItems : [...prevItems, ...newCardItems]);
      setHasMore(newCardItems.length === ITEMS_PER_PAGE);

    } catch (error) {
      console.error(`Failed to fetch movies for genre "${genre}":`, error);
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
          const firstPlaylistId = playlists[0].id; // Use first playlist
          setActivePlaylistId(firstPlaylistId);
          setMovieItems([]);
          setCurrentPage(1);
          // Fetch movies using the decoded genre name
          await fetchMoviesByGenre(firstPlaylistId, genreNameDecoded, 1);
        } else {
          setHasPlaylistsConfigured(false);
          setMovieItems([]);
        }
      } catch (error) {
        console.error("Failed to initialize movie genre page:", error);
        setHasPlaylistsConfigured(false);
      } finally {
        setIsLoading(false);
      }
    }
    // Initialize regardless of MOCK_MOVIE_GENRES check, rely on DB fetch
    // The genreExists state is now more for UI display of "not found" if MOCK_MOVIE_GENRES is considered authoritative
    initialize();
    
  }, [genreNameDecoded, fetchMoviesByGenre]); // Removed genreExists from dependency array to always try fetching

  const loadMoreItems = () => {
    if (activePlaylistId && hasMore && !isLoading) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchMoviesByGenre(activePlaylistId, genreNameDecoded, nextPage);
    }
  };

  // This "genre not found" UI is based on MOCK_MOVIE_GENRES.
  // If content for a genre exists in DB but not in MOCK_MOVIE_GENRES,
  // it will still be displayed by ContentGrid. This block might show if MOCK_MOVIE_GENRES is strict.
  if (genreExists === false && !isLoading && movieItems.length === 0 && !hasPlaylistsConfigured) {
     return (
      <div className="container mx-auto px-0 py-8 text-center">
        <PageHeader title="Genre Not Found" description={`The movie genre "${genreNameDecoded}" does not seem to exist or no content is available.`} />
        <Button variant="outline" asChild className="mt-4">
          <Link href="/app/movies">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Movie Genres
          </Link>
        </Button>
      </div>
    );
  }


  return (
    <div className="container mx-auto px-0">
      <div className="mb-4">
        <Button variant="outline" asChild>
          <Link href="/app/movies">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Movie Genres
          </Link>
        </Button>
      </div>
      <PageHeader title={genreNameDecoded} description={`Discover the best ${genreNameDecoded} movies.`} />
      {hasPlaylistsConfigured ? (
        <ContentGrid 
          items={movieItems} 
          type="movie" 
          genre={genreNameDecoded} 
          isLoading={isLoading}
          loadMoreItems={loadMoreItems}
          hasMore={hasMore}
        />
      ) : (
         isLoading ? <p className="text-muted-foreground text-center py-8">Verificando playlists e filmes...</p> : <PlaceholderContent type="movies" message={`No playlists configured or no ${genreNameDecoded} movies found.`}/>
      )}
    </div>
  );
}
