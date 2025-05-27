// dashboard/components/ModernProtectedLayout.tsx - Fixed All Issues with Type Assertion
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import {
  ShieldCheckIcon,
  ArrowRightOnRectangleIcon,
  ExclamationTriangleIcon,
  UserCircleIcon,
  Bars3Icon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { ThemeToggle } from './ThemeToggle';
import { useTheme } from '@/lib/ThemeContext';

interface ModernProtectedLayoutProps {
  children: ReactNode;
  requiredGuildId?: string;
}

// Extended user interface for proper typing
interface ExtendedUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  username?: string;
  discriminator?: string;
  avatar?: string | null;
  hasRequiredAccess?: boolean;
}

const ALLOWED_GUILD_ID = process.env.NEXT_PUBLIC_TARGET_GUILD_ID || '554266392262737930';
const REQUIRED_ROLE_ID = process.env.NEXT_PUBLIC_REQUIRED_ROLE_ID || '797927858420187186';

export default function ModernProtectedLayout({
  children,
  requiredGuildId = ALLOWED_GUILD_ID
}: ModernProtectedLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { isDark } = useTheme();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    // Type assertion to access extended properties
    const extendedUser = session.user as ExtendedUser;
    
    if (extendedUser?.hasRequiredAccess !== true) {
      console.log('Access denied - redirecting to error page (ModernProtectedLayout)');
      router.push('/auth/error?error=AccessDenied');
      return;
    }

    setIsAuthorized(true);
    setIsLoading(false);
  }, [session, status, router, requiredGuildId]);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth/signin' });
  };

  // Type-safe current user access with assertion
  const currentUser = session?.user as ExtendedUser | undefined;

  if (status === 'loading' || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen transition-colors duration-200 bg-gray-50 dark:bg-gray-900">
        <div className="space-y-4 text-center">
          <div className="relative">
            <div className="w-24 h-24 mx-auto">
              <div className="absolute inset-0 border-4 border-indigo-200 rounded-full dark:border-indigo-800 animate-pulse"></div>
              <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
              <ShieldCheckIcon className="absolute w-12 h-12 text-indigo-600 transform -translate-x-1/2 -translate-y-1/2 top-1/2 left-1/2" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Verifying Access
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Checking guild membership and permissions...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen transition-colors duration-200 bg-gray-50 dark:bg-gray-900">
        <div className="space-y-4 text-center">
          <div className="flex items-center justify-center w-16 h-16 mx-auto bg-red-100 rounded-full dark:bg-red-900/20">
            <ExclamationTriangleIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">
              Access Denied
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Redirecting...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-200 ${isDark ? 'dark' : ''} bg-gray-50 dark:bg-gray-900`}>
      {/* Modern Navigation */}
      <nav className="sticky top-0 z-40 transition-colors duration-200 border-b border-gray-200 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md dark:border-gray-700">
        <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Left side - Logo and brand */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <div className="flex items-center justify-center w-10 h-10 shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl">
                    <ShieldCheckIcon className="w-6 h-6 text-white" />
                  </div>
                  <div className="absolute w-4 h-4 bg-green-500 border-2 border-white rounded-full -top-1 -right-1 dark:border-gray-800 animate-pulse"></div>
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-xl font-bold text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text">
                    Pegasus Dashboard
                  </h1>
                  <p className="-mt-1 text-xs text-gray-500 dark:text-gray-400">
                    v2.0.0 • Modern Interface
                  </p>
                </div>
              </div>
            </div>

            {/* Right side - User info and controls */}
            <div className="flex items-center space-x-4">
              {/* Theme Toggle */}
              <ThemeToggle size="md" />

              {/* User info - Desktop */}
              {currentUser && (
                <div className="items-center hidden space-x-3 md:flex">
                  <div className="flex items-center px-3 py-2 space-x-3 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-700/50 dark:border-gray-600">
                    {currentUser.avatar ? (
                      <Image
                        src={`https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png`}
                        alt="User Avatar"
                        width={32}
                        height={32}
                        className="rounded-full ring-2 ring-indigo-500/20"
                      />
                    ) : (
                      <UserCircleIcon className="w-8 h-8 text-gray-400" />
                    )}
                    <div className="text-sm">
                      <div className="font-medium text-gray-900 dark:text-gray-100">
                        {currentUser.username || currentUser.name || 'Unknown User'}
                      </div>
                      {currentUser.discriminator && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          #{currentUser.discriminator}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="px-3 py-1 text-xs font-medium text-green-700 bg-green-100 border border-green-200 rounded-full dark:text-green-400 dark:bg-green-900/20 dark:border-green-800">
                      Authorized
                    </div>
                  </div>
                </div>
              )}

              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 text-gray-500 transition-colors duration-200 rounded-lg md:hidden dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              >
                {isMobileMenuOpen ? (
                  <XMarkIcon className="w-6 h-6" />
                ) : (
                  <Bars3Icon className="w-6 h-6" />
                )}
              </button>

              {/* Sign out button - Desktop */}
              <button
                onClick={handleSignOut}
                className="items-center hidden px-3 py-2 space-x-2 text-sm font-medium text-gray-700 transition-all duration-200 border border-gray-200 rounded-lg md:flex dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600"
                title="Sign Out"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="bg-white border-t border-gray-200 md:hidden dark:border-gray-700 dark:bg-gray-800">
            <div className="px-4 py-4 space-y-4">
              {/* User info - Mobile */}
              {currentUser && (
                <div className="flex items-center p-3 space-x-3 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  {currentUser.avatar ? (
                    <Image
                      src={`https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png`}
                      alt="User Avatar"
                      width={40}
                      height={40}
                      className="rounded-full ring-2 ring-indigo-500/20"
                    />
                  ) : (
                    <UserCircleIcon className="w-10 h-10 text-gray-400" />
                  )}
                  <div>
                    <div className="font-medium text-gray-900 dark:text-gray-100">
                      {currentUser.username || currentUser.name || 'Unknown User'}
                      {currentUser.discriminator && `#${currentUser.discriminator}`}
                    </div>
                    <div className="text-sm text-green-600 dark:text-green-400">
                      Authorized Access
                    </div>
                  </div>
                </div>
              )}

              {/* Sign out button - Mobile */}
              <button
                onClick={handleSignOut}
                className="flex items-center justify-center w-full px-4 py-3 space-x-2 text-sm font-medium text-gray-700 transition-all duration-200 border border-gray-200 rounded-lg dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 dark:border-gray-600"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Main Content */}
      <main className="relative">
        {children}
      </main>

      {/* Modern Footer */}
      <footer className="mt-12 transition-colors duration-200 border-t border-gray-200 bg-white/50 dark:bg-gray-800/50 backdrop-blur-md dark:border-gray-700">
        <div className="px-4 py-6 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between space-y-4 sm:flex-row sm:space-y-0">
            <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span>Pegasus Bot Dashboard v2.0.0</span>
              </div>
              <span className="hidden sm:inline">•</span>
              <span className="font-mono text-xs">Guild: {requiredGuildId}</span>
            </div>
            <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
              <span>Authorized access only</span>
              <span>•</span>
              <span>Role: {REQUIRED_ROLE_ID}</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}