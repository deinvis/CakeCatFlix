import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { MOCK_PLAYLISTS, MOCK_MOVIE_GENRES } from '@/lib/constants';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronRight, Film } from 'lucide-react';

const hasPlaylistsConfigured = MOCK_PLAYLISTS.length > 0;

export default function MoviesPage() {
  return (
    <div className="container mx-auto px-0">
      <PageHeader title="Movies" description="Explore a vast collection of movies across all genres." />
      {hasPlaylistsConfigured ? (
        <Card className="shadow-lg border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Film className="h-6 w-6 text-primary" />
              Browse by Genre
            </CardTitle>
            <CardDescription>Select a genre to discover movies.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {MOCK_MOVIE_GENRES.map(genre => (
                <Button 
                  key={genre} 
                  variant="outline" 
                  className="justify-between w-full text-left h-auto p-4 rounded-lg hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground" 
                  asChild
                >
                  <Link href={`/app/movies/genre/${encodeURIComponent(genre.toLowerCase())}`}>
                    <span className="text-base font-medium">{genre}</span>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </Link>
                </Button>
              ))}
            </div>
            {/* Optionally, could also add a ContentGrid here for "Popular Movies" or "New Releases" */}
            {/* For example:
            <Separator className="my-8" />
            <h3 className="text-xl font-semibold mb-4">Popular Movies</h3>
            <ContentGrid items={MOCK_CONTENT_ITEMS(6, "popular movie")} type="movie" />
            */}
          </CardContent>
        </Card>
      ) : (
        <PlaceholderContent type="movies" />
      )}
    </div>
  );
}
