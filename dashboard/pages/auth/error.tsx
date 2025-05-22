// dashboard/pages/auth/error.tsx
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { ExclamationTriangleIcon, HomeIcon } from '@heroicons/react/24/outline';

const errorMessages: Record<string, string> = {
  AccessDenied: 'You do not have permission to access this dashboard. Only authorized administrators can sign in.',
  Configuration: 'There is a problem with the server configuration. Please contact the administrator.',
  Default: 'An error occurred during sign in. Please try again.',
};

export default function AuthError() {
  const router = useRouter();
  const { error } = router.query;
  
  const errorMessage = errorMessages[error as string] || errorMessages.Default;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center">
      <Head>
        <title>Sign In Error - Hinko Bot Dashboard</title>
        <meta name="description" content="An error occurred during sign in" />
      </Head>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <ExclamationTriangleIcon className="h-12 w-12 text-red-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign In Failed
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-6">
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    Access Denied
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{errorMessage}</p>
                  </div>
                </div>
              </div>
            </div>

            {error === 'AccessDenied' && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="text-sm text-blue-700">
                  <p><strong>Requirements for access:</strong></p>
                  <ul className="mt-2 list-disc list-inside space-y-1">
                    <li>You must be a specific authorized user</li>
                    <li>You must be a member of the designated Discord server</li>
                    <li>Your Discord account must have the required permissions</li>
                  </ul>
                </div>
              </div>
            )}

            <div className="flex space-x-3">
              <Link 
                href="/auth/signin"
                className="flex-1 flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Try Again
              </Link>
              <Link 
                href="/"
                className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <HomeIcon className="h-4 w-4 mr-1" />
                Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}