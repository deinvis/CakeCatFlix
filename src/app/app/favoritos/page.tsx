import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGrid } from '@/components/content-grid';
import { MOCK_CONTENT_ITEMS, MOCK_PLAYLISTS } from '@/lib/constants';

// This would come from a data source or context in a real app
const hasPlaylistsConfigured = MOCK_PLAYLISTS.length > 0;
// Example: Fetch actual favorited items if playlists are configured
const favoriteItems = hasPlaylistsConfigured ? MOCK_CONTENT_ITEMS(8, "favorite movie") : [];

export default function FavoritosPage() {
  return (
    <div className="container mx-auto px-0">
      <PageHeader title="Favoritos" description="Sua lista de filmes e séries favoritos."/>
      {hasPlaylistsConfigured ? (
        <ContentGrid items={favoriteItems} type="movie" /> // Type might need to be dynamic
      ) : (
        <PlaceholderContent type="favoritos" message="Nenhum item favoritado ou playlists não configuradas." />
      )}
    </div>
  );
}
