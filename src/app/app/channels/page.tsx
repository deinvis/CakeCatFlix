import { PageHeader } from '@/components/page-header';
import { PlaceholderContent } from '@/components/placeholder-content';
import { ContentGrid } from '@/components/content-grid';
import { MOCK_CONTENT_ITEMS, MOCK_PLAYLISTS } from '@/lib/constants';

// This would come from a data source or context in a real app
const hasPlaylistsConfigured = MOCK_PLAYLISTS.length > 0; 
// Example: Fetch actual channel items if playlists are configured
const channelItems = hasPlaylistsConfigured ? MOCK_CONTENT_ITEMS(18, "tv broadcast screen") : [];

export default function ChannelsPage() {
  return (
    <div className="container mx-auto px-0">
      <PageHeader title="Live Channels" description="Watch your favorite TV channels live."/>
      {hasPlaylistsConfigured ? (
        <ContentGrid items={channelItems} type="channel" />
      ) : (
        <PlaceholderContent type="channels" />
      )}
    </div>
  );
}
