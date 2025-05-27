
import { PageHeader } from '@/components/page-header';
import { PlaylistManagement } from '@/components/settings/playlist-management';
import { StartupPageConfig } from '@/components/settings/startup-page-config';
import { ThemeToggle } from '@/components/settings/theme-toggle';
import { ParentalControl } from '@/components/settings/parental-control';
import { Separator } from '@/components/ui/separator';

export default function SettingsPage() {
  return (
    <div className="container mx-auto px-0 space-y-8 md:space-y-10">
      <PageHeader title="Configurações da Aplicação" description="Gerencie suas playlists e personalize sua experiência no app."/>
      
      <section id="theme-settings">
        <ThemeToggle />
      </section>
      
      <Separator className="my-8 md:my-10" />

      <section id="playlist-management">
        <PlaylistManagement />
      </section>
      
      <Separator className="my-8 md:my-10" />
      
      <section id="startup-page-config">
        <StartupPageConfig />
      </section>

      <Separator className="my-8 md:my-10" />

      <section id="parental-control">
        <ParentalControl />
      </section>
    </div>
  );
}
