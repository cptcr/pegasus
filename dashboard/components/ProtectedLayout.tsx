
// dashboard/components/ProtectedLayout.tsx
import { useSession, signOut } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { ShieldCheckIcon, ArrowRightOnRectangleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface ProtectedLayoutProps {
  children: React.ReactNode;
  requiredGuildId?: string;
}

const ALLOWED_GUILD_ID = '554266392262737930';
const REQUIRED_ROLE_ID = '797927858420187186';

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

    // Check if user has required access (guild membership + role)
    if (session.user?.hasRequiredAccess !== true) {
      console.log('Access denied - redirecting to error page');
      router.push('/auth/error?error=AccessDenied');
      return;
    }

    setIsAuthorized(true);
    setIsLoading(false);
  }, [session, status, router, requiredGuildId]);

  const handleSignOut = async () => {
    await signOut({ callbackUrl: '/auth/signin' });
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verifying access...</p>
          <p className="text-sm text-gray-500">Checking guild membership and permissions...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="h-16 w-16 text-red-500 mx-auto" />
          <h1 className="mt-4 text-2xl font-bold text-red-600">Access Denied</h1>
          <p className="mt-2 text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <ShieldCheckIcon className="h-8 w-8 text-indigo-600" />
              <span className="ml-2 text-xl font-semibold text-gray-900">
                Hinko Dashboard
              </span>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                {session?.user?.avatar && (
                  <img
                    src={`https://cdn.discordapp.com/avatars/${session.user.id}/${session.user.avatar}.png`}
                    alt="Avatar"
                    className="h-8 w-8 rounded-full"
                  />
                )}
                <span className="text-sm text-gray-700">
                  {session?.user?.username}#{session?.user?.discriminator}
                </span>
              </div>
              
              <div className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                Authorized
              </div>
              
              <button
                onClick={handleSignOut}
                className="flex items-center space-x-1 text-gray-500 hover:text-gray-700 transition-colors"
                title="Sign Out"
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
                <span className="text-sm">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-500">
              Hinko Bot Dashboard v2.0.0 - Guild: {requiredGuildId} - Role: {REQUIRED_ROLE_ID}
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