// dashboard/components/ThemeToggle.tsx - Fixed Hydration Issues
import { SunIcon, MoonIcon } from '@heroicons/react/24/outline';
import { useTheme } from '@/lib/ThemeContext';
import { useEffect, useState } from 'react';

interface ThemeToggleProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function ThemeToggle({ className = '', size = 'md' }: ThemeToggleProps) {
  const { toggleTheme, isDark } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const sizeClasses = {
    sm: 'w-8 h-8 p-1.5',
    md: 'w-10 h-10 p-2',
    lg: 'w-12 h-12 p-2.5'
  };

  const iconSizes = {
    sm: 'w-5 h-5',
    md: 'w-6 h-6',
    lg: 'w-7 h-7'
  };

  // Don't render anything until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div
        className={`
          ${sizeClasses[size]}
          relative inline-flex items-center justify-center
          rounded-lg border border-gray-300 dark:border-gray-600
          bg-white dark:bg-gray-800
          text-gray-700 dark:text-gray-200
          ${className}
        `}
      >
        <div className={`${iconSizes[size]} opacity-50`}>
          <div className="w-full h-full bg-gray-400 rounded-full animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={`
        ${sizeClasses[size]}
        relative inline-flex items-center justify-center
        rounded-lg border border-gray-300 dark:border-gray-600
        bg-white dark:bg-gray-800
        text-gray-700 dark:text-gray-200
        hover:bg-gray-50 dark:hover:bg-gray-700
        focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
        dark:focus:ring-offset-gray-800
        transition-all duration-200 ease-in-out
        ${className}
      `}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <div className="relative">
        {/* Sun Icon for Light Mode */}
        <SunIcon 
          className={`
            ${iconSizes[size]}
            absolute inset-0 transition-all duration-300 ease-in-out
            ${isDark ? 'opacity-0 rotate-90 scale-0' : 'opacity-100 rotate-0 scale-100'}
          `}
        />
        
        {/* Moon Icon for Dark Mode */}
        <MoonIcon 
          className={`
            ${iconSizes[size]}
            absolute inset-0 transition-all duration-300 ease-in-out
            ${isDark ? 'opacity-100 rotate-0 scale-100' : 'opacity-0 -rotate-90 scale-0'}
          `}
        />
      </div>
    </button>
  );
}