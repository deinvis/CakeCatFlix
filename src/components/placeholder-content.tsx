import { AlertTriangle } from 'lucide-react'; // Changed icon for more emphasis
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface PlaceholderContentProps {
  type: string; // e.g., "channels", "movies", "series"
  message?: string;
}

export function PlaceholderContent({ type, message }: PlaceholderContentProps) {
  return (
    <Card className="w-full max-w-md mx-auto shadow-xl border-primary/20">
      <CardHeader className="items-center text-center">
        <AlertTriangle className="h-12 w-12 text-primary mb-3" />
        <CardTitle className="text-2xl">No Content Available</CardTitle>
        <CardDescription>
          {message || `It seems no playlists are configured or they don't contain any ${type}.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <p className="mb-4">
          Please add or check your playlists in the settings to populate this section.
        </p>
        <Button asChild className="bg-primary hover:bg-primary/90 text-primary-foreground">
          <Link href="/app/settings">Go to Settings</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
