// dashboard/components/ProtectedLayout.tsx - Fixed All Issues with Type Assertion
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { ShieldCheckIcon, ArrowRightOnRectangleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ProtectedLayoutProps {
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

export default function ProtectedLayout({
  children,
  requiredGuildId = ALLOWED_GUILD_ID
}: ProtectedLayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    // Type assertion to access extended properties
    const extendedUser = session.user as ExtendedUser;
    
    // Check if user has required access (guild membership + role)
    if (extendedUser?.hasRequiredAccess !== true) {
      console.log('Access denied - redirecting to error page (ProtectedLayout)');
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
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-32 h-32 mx-auto border-b-2 border-indigo-500 rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Verifying access...</p>
          <p className="text-sm text-gray-500">Checking guild membership and permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-16 h-16 mx-auto text-red-500" />
          <h1 className="mt-4 text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="mt-2 text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <ShieldCheckIcon className="w-8 h-8 text-indigo-600" />
              <span className="ml-2 text-xl font-semibold text-gray-900">
                Pegasus Dashboard
              </span>
            </div>

            {currentUser && (
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  {currentUser.avatar && (
                    <Image
                      src={`https://cdn.discordapp.com/avatars/${currentUser.id}/${currentUser.avatar}.png`}
                      alt="User Avatar"
                      width={32}
                      height={32}
                      className="rounded-full"
                    />
                  )}
                  <span className="text-sm text-gray-700">
                    {currentUser.username || currentUser.name || 'Unknown User'}
                    {currentUser.discriminator && `#${currentUser.discriminator}`}
                  </span>
                </div>

                <div className="px-2 py-1 text-xs text-green-600 bg-green-100 rounded">
                  Authorized
                </div>

                <button
                  onClick={handleSignOut}
                  className="flex items-center space-x-1 text-gray-500 transition-colors hover:text-gray-700"
                  title="Sign Out"
                >
                  <ArrowRightOnRectangleIcon className="w-5 h-5" />
                  <span className="text-sm">Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {children}
      </main>

      {/* Footer */}
      <footer className="mt-12 bg-white border-t border-gray-200">
        <div className="px-4 py-6 mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500">
              Pegasus Bot Dashboard v2.0.0 - Guild: {requiredGuildId} - Role: {REQUIRED_ROLE_ID}
            </div>
            <div className="text-sm text-gray-500">
              Authorized access only
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}