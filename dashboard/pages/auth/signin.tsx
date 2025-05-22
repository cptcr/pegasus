// dashboard/pages/auth/signin.tsx
import { GetServerSideProps } from 'next';
import { getSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import Head from 'next/head';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

export default function SignIn() {
  const router = useRouter();
  const { error } = router.query;

  const handleSignIn = () => {
    signIn('discord', { 
      callbackUrl: '/dashboard',
      redirect: true 
    });
  };

  useEffect(() => {
    // Auto-redirect to Discord login if no error is present
    if (!error && router.isReady) {
      console.log('Auto-redirecting to Discord login...');
      handleSignIn();
    }
  }, [error, router.isReady]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center">
      <Head>
        <title>Sign In - Hinko Bot Dashboard</title>
        <meta name="description" content="Sign in to access the Hinko Bot Dashboard" />
      </Head>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <ShieldCheckIcon className="h-12 w-12 text-indigo-600" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Sign in to Dashboard
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {error ? 'Authentication failed - please try again' : 'Redirecting to Discord...'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <div className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <ShieldCheckIcon className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Authentication Error
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p>Please ensure you are using the correct Discord account.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <ShieldCheckIcon className="h-5 w-5 text-blue-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-blue-800">
                    Authorized Access Only
                  </h3>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>
                      This dashboard is restricted to authorized administrators only.
                      Expected Role ID: 797927858420187186 in Guild: 554266392262737930
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <button
                onClick={handleSignIn}
                disabled={!error && router.isReady} // Disable if auto-redirecting
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-200 disabled:opacity-50"
              >
                {!error && router.isReady ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Redirecting to Discord...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.010c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                    Sign in with Discord
                  </>
                )}
              </button>
            </div>

            <div className="text-xs text-gray-500 text-center">
              By signing in, you acknowledge that access is restricted and monitored.
            </div>

            {process.env.NODE_ENV === 'development' && (
              <div className="mt-4">
                <details className="text-xs">
                  <summary className="cursor-pointer text-gray-500">Debug Info</summary>
                  <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                    <p>Expected Role ID: 797927858420187186</p>
                    <p>Expected Guild ID: 554266392262737930</p>
                    <p>Error: {error || 'none'}</p>
                    <p>Note: You need the ROLE, not just server membership!</p>
                  </div>
                </details>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  if (session) {
    return {
      redirect: {
        destination: '/dashboard',
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};