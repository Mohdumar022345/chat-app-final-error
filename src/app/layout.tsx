'use client';

import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { useState, useEffect } from 'react';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5, // 5 minutes
        refetchOnWindowFocus: false,
      },
    },
  }));
  
  const [customTheme, setCustomTheme] = useState<string>('none');

  useEffect(() => {
    // Load custom theme from localStorage on mount
    const savedTheme = localStorage.getItem('customTheme') || 'none';
    console.log('🎨 [Layout] Loading saved theme from localStorage:', savedTheme);
    setCustomTheme(savedTheme);
    applyCustomTheme(savedTheme);

    // Listen for storage changes (when settings are updated)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'customTheme' && e.newValue) {
        console.log('🎨 [Layout] Storage change detected, applying theme:', e.newValue);
        setCustomTheme(e.newValue);
        applyCustomTheme(e.newValue);
      }
    };

    // Listen for custom storage events dispatched from settings
    const handleCustomStorageChange = (e: StorageEvent) => {
      if (e.key === 'customTheme' && e.newValue) {
        console.log('🎨 [Layout] Custom storage event detected, applying theme:', e.newValue);
        setCustomTheme(e.newValue);
        applyCustomTheme(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('storage', handleCustomStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('storage', handleCustomStorageChange);
    };
  }, []);

  const applyCustomTheme = (theme: string) => {
    console.log('🎨 [Layout] Applying custom theme:', theme);
    const html = document.documentElement;
    
    // Remove all custom theme classes
    html.classList.remove('theme-pink', 'theme-blue', 'theme-coffee', 'theme-wood');
    
    // If a custom theme is selected, remove dark class and apply custom theme
    if (theme !== 'none') {
      console.log('🎨 [Layout] Removing dark class and applying theme-' + theme);
      html.classList.remove('dark');
      html.classList.add(`theme-${theme}`);
    } else {
      console.log('🎨 [Layout] No custom theme selected, allowing next-themes to manage dark/light');
      // When no custom theme, let next-themes handle dark/light mode
    }
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryClientProvider client={queryClient}>
            {children}
            <Toaster position="top-right" />
          </QueryClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}