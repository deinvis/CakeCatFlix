import { PageHeader } from '@/components/page-header';
import { PlaylistManagement } from '@/components/settings/playlist-management';
import { StartupPageConfig } from '@/components/settings/startup-page-config';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  return (
    <div className="container mx-auto px-0 space-y-8 md:space-y-10">
      <PageHeader title="Application Settings" description="Manage your playlists and personalize your app experience."/>
      
      <section>
        <PlaylistManagement />
      </section>
      
      <Separator className="my-8 md:my-10" />
      
      <section>
        <StartupPageConfig />
      </section>
    </div>
  );
}
