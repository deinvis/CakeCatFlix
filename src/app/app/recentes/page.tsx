import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGrid } from '@/components/content-grid';
import { MOCK_CONTENT_ITEMS, MOCK_PLAYLISTS } from '@/lib/constants';

// This would come from a data source or context in a real app
const hasPlaylistsConfigured = MOCK_PLAYLISTS.length > 0;
// Example: Fetch actual recently watched items if playlists are configured
const recentItems = hasPlaylistsConfigured ? MOCK_CONTENT_ITEMS(10, "recently watched") : [];

export default function RecentesPage() {
  return (
    <div className="container mx-auto px-0">
      <PageHeader title="Recentes" description="Continue de onde parou."/>
      {hasPlaylistsConfigured ? (
        <ContentGrid items={recentItems} type="movie" /> // Type might need to be dynamic
      ) : (
        <PlaceholderContent type="recentes" message="Nenhum item visto recentemente ou playlists não configuradas." />
      )}
    </div>
  );
}
