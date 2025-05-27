// dashboard/pages/auth/error.tsx - Fixed Hydration Issue
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { ExclamationTriangleIcon, HomeIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';

const errorMessages: Record<string, { title: string; description: string; canRetry: boolean }> = {
  AccessDenied: {
    title: 'Access Denied',
    description: 'You do not have permission to access this dashboard. Only authorized administrators can sign in.',
    canRetry: false
  },
  Configuration: {
    title: 'Configuration Error',
    description: 'There is a problem with the server configuration. Please contact the administrator.',
    canRetry: false
  },
  RateLimit: {
    title: 'Rate Limited',
    description: 'Discord API rate limit reached. Please wait a moment and try again.',
    canRetry: true
  },
  Verification: {
    title: 'Verification Failed',
    description: 'Unable to verify your Discord permissions. This may be temporary.',
    canRetry: true
  },
  Default: {
    title: 'Authentication Error',
    description: 'An error occurred during sign in. Please try again.',
    canRetry: true
  },
};

export default function AuthError() {
  const router = useRouter();
  const { error } = router.query;
  const [retrying, setRetrying] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const errorInfo = errorMessages[error as string] || errorMessages.Default;

  // Fix hydration issue by only showing timestamp after component mounts
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleRetry = async () => {
    setRetrying(true);
    // Wait a bit before redirecting
    await new Promise(resolve => setTimeout(resolve, 2000));
    router.push('/auth/signin');
  };

  return (
    <div className="flex flex-col justify-center min-h-screen bg-gray-50">
      <Head>
        <title>Sign In Error - Hinko Bot Dashboard</title>
        <meta name="description" content="An error occurred during sign in" />
      </Head>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <ExclamationTriangleIcon className="w-16 h-16 text-red-600" />
        </div>
        <h2 className="mt-6 text-3xl font-extrabold text-center text-gray-900">
          {errorInfo.title}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="px-4 py-8 bg-white shadow sm:rounded-lg sm:px-10">
          <div className="space-y-6">
            <div className="p-4 border border-red-200 rounded-md bg-red-50">
              <div className="flex">
                <div className="flex-shrink-0">
                  <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    {errorInfo.title}
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{errorInfo.description}</p>
                  </div>
                </div>
              </div>
            </div>

            {error === 'AccessDenied' && (
              <div className="p-4 border border-blue-200 rounded-md bg-blue-50">
                <div className="text-sm text-blue-700">
                  <p><strong>Requirements for access:</strong></p>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>You must be a member of Discord server: <code className="px-1 bg-blue-100 rounded">554266392262737930</code></li>
                    <li>You must have the role with ID: <code className="px-1 bg-blue-100 rounded">797927858420187186</code></li>
                    <li>Your Discord account must be verified and in good standing</li>
                  </ul>
                </div>
              </div>
            )}

            {(error === 'RateLimit' || error === 'Verification') && (
              <div className="p-4 border border-yellow-200 rounded-md bg-yellow-50">
                <div className="text-sm text-yellow-700">
                  <p><strong>This is usually temporary:</strong></p>
                  <ul className="mt-2 space-y-1 list-disc list-inside">
                    <li>Discord API rate limits reset automatically</li>
                    <li>Wait 1-2 minutes before trying again</li>
                    <li>If the problem persists, contact an administrator</li>
                  </ul>
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              {errorInfo.canRetry && (
                <button
                  onClick={handleRetry}
                  disabled={retrying}
                  className="flex items-center justify-center flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {retrying ? (
                    <>
                      <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                      Retrying...
                    </>
                  ) : (
                    <>
                      <ArrowPathIcon className="w-4 h-4 mr-2" />
                      Try Again
                    </>
                  )}
                </button>
              )}
              
              <Link 
                href="/auth/signin"
                className={`${errorInfo.canRetry ? 'flex-1' : 'flex-1'} flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500`}
              >
                {errorInfo.canRetry ? 'Back to Sign In' : 'Try Again'}
              </Link>
              
              <Link 
                href="/"
                className="flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-gray-600 border border-transparent rounded-md shadow-sm hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
              >
                <HomeIcon className="w-4 h-4 mr-1" />
                Home
              </Link>
            </div>

            {/* Debug info for development - Only show after hydration */}
            {process.env.NODE_ENV === 'development' && mounted && (
              <div className="pt-4 mt-6 border-t border-gray-200">
                <details className="text-xs">
                  <summary className="font-medium text-gray-500 cursor-pointer">Debug Information</summary>
                  <div className="p-3 mt-2 font-mono text-xs bg-gray-100 rounded">
                    <div><strong>Error Code:</strong> {error || 'none'}</div>
                    <div><strong>Required Guild:</strong> 554266392262737930</div>
                    <div><strong>Required Role:</strong> 797927858420187186</div>
                    <div><strong>Can Retry:</strong> {errorInfo.canRetry ? 'Yes' : 'No'}</div>
                    <div><strong>Timestamp:</strong> {new Date().toISOString()}</div>
                  </div>
                </details>
              </div>
            )}

            <div className="text-center">
              <p className="text-xs text-gray-500">
                If you believe this is an error, please contact a server administrator.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}