'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useActivity } from '@/hooks/useActivity';

// Filter browser extension-injected attribute hydration mismatches and benign TTS cancellation events
if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const msg = args.map(a => {
      try {
        return typeof a === 'string' ? a : JSON.stringify(a) || '';
      } catch {
        return String(a);
      }
    }).join(' ');
    if (
      msg.includes('bis_skin_checked') ||
      msg.includes('TTS error: "interrupted"') ||
      msg.includes('TTS error: "canceled"') ||
      msg.includes('"interrupted"')
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

/**
 * Component that automatically tracks navigation events.
 * Placed in RootLayout to cover all pages.
 */
export function ActivityTracker() {
  const pathname = usePathname();
  const { trackPageView } = useActivity();

  useEffect(() => {
    // Determine a clean panel name from the pathname
    let panel = pathname === '/' ? 'home' : pathname.split('/')[1];
    
    // Deeper path handling
    if (pathname.includes('/lesson/')) panel = 'lesson';
    if (pathname.includes('/interview/')) panel = 'interview';
    if (pathname.includes('/roadmap/')) panel = 'roadmap';
    if (pathname.includes('/chat')) panel = 'chat';

    trackPageView(panel);
  }, [pathname, trackPageView]);

  return null; // This component doesn't render anything
}
