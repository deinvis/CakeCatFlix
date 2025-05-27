import { redirect } from 'next/navigation';
import { STARTUP_PAGES } from '@/lib/constants';

export default function HomePage() {
  // In a real app, this default might come from user settings
  const defaultStartupPath = `/app/${STARTUP_PAGES[0].value}`;
  redirect(defaultStartupPath);
  //This component will not render anything as it redirects.
  return null;
}
