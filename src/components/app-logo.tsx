import { Film } from 'lucide-react';
import { APP_NAME } from '@/lib/constants';

export function AppLogo() {
  return (
    <div className="flex items-center gap-2 text-primary whitespace-nowrap overflow-hidden">
      <Film className="h-7 w-7 md:h-8 md:w-8 flex-shrink-0" />
      <span className="text-xl md:text-2xl font-bold group-data-[collapsible=icon]:hidden">
        {APP_NAME}
      </span>
    </div>
  );
}
