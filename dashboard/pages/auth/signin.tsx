// dashboard/pages/auth/signin.tsx
import { GetServerSideProps } from 'next';
import { getSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';

export default function SignIn() {
  const router = useRouter();
  const { error, callbackUrl } = router.query;
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSignIn = async () => {
    setIsLoading(true);
    try {
      await signIn('discord', { 
        callbackUrl: (callbackUrl as string) || '/dashboard/554266392262737930',
        redirect: true 
      });
    } catch (err) {
      console.error('Sign in error:', err);
      setIsLoading(false);
    }
  };

  const handleThemeToggle = () => {
    const html = document.documentElement;
    const isDark = html.classList.contains('dark');
    
    if (isDark) {
      html.classList.remove('dark');
      localStorage.setItem('dashboard-theme', 'light');
    } else {
      html.classList.add('dark');
      localStorage.setItem('dashboard-theme', 'dark');
    }
  };

  // Set initial theme
  useEffect(() => {
    if (mounted) {
      const savedTheme = localStorage.getItem('dashboard-theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldBeDark = savedTheme ? savedTheme === 'dark' : prefersDark;
      
      if (shouldBeDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, [mounted]);

  const getErrorMessage = (errorCode: string) => {
    switch (errorCode) {
      case 'AccessDenied':
        return 'Access denied - you do not have the required permissions.';
      case 'OAuthSignin':
      case 'OAuthCallback':
      case 'OAuthCreateAccount':
        return 'Error connecting to Discord. Please try again.';
      case 'RateLimit':
        return 'Too many requests. Please wait a moment before trying again.';
      case 'Verification':
        return 'Unable to verify your Discord permissions. Please try again.';
      default:
        return 'Authentication failed - please try again.';
    }
  };

  if (!mounted) {
    return null; // Prevent SSR mismatch
  }

  return (
    <div className="min-h-screen transition-all duration-500 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <Head>
        <title>Sign In - Pegasus Bot Dashboard</title>
        <meta name="description" content="Sign in to access the Pegasus Bot Dashboard" />
      </Head>

      {/* Theme Toggle - Top Right */}
      <div className="absolute z-10 top-4 right-4">
        <button
          onClick={handleThemeToggle}
          className="w-10 h-10 p-2 text-gray-700 transition-all duration-200 bg-white border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          title="Toggle theme"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path className="dark:hidden" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            <path className="hidden dark:block" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </button>
      </div>

      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute rounded-full -top-40 -right-40 w-80 h-80 bg-indigo-400/20 blur-3xl"></div>
        <div className="absolute rounded-full -bottom-40 -left-40 w-80 h-80 bg-purple-400/20 blur-3xl"></div>
      </div>

      <div className="relative flex flex-col justify-center min-h-screen py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <div className="relative">
              <div className="flex items-center justify-center w-20 h-20 transition-transform duration-300 transform shadow-2xl bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl shadow-indigo-500/25 rotate-3 hover:rotate-0">
                <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="absolute w-6 h-6 bg-green-500 border-4 border-white rounded-full -top-2 -right-2 dark:border-gray-900 animate-pulse"></div>
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <h1 className="mb-2 text-4xl font-bold text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text">
              Pegasus Dashboard
            </h1>
            <p className="mb-1 text-lg text-gray-600 dark:text-gray-300">
              {error ? 'Authentication failed - please try again' : 
               isLoading ? 'Redirecting to Discord...' : 
               'Welcome back'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {isLoading ? 'Please wait while we redirect you' : 'Access the bot administration panel'}
            </p>
          </div>
        </div>

        {/* Main Content */}
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="p-8 border shadow-lg bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-gray-200/50 dark:border-gray-700/50 rounded-xl">
            <div className="space-y-6">
              {/* Error Display */}
              {error && (
                <div className="flex items-start p-4 space-x-3 border border-red-200 rounded-lg dark:border-red-800 bg-red-50 dark:bg-red-900/10">
                  <svg className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <h3 className="text-sm font-medium text-red-800 dark:text-red-400">
                      Authentication Error
                    </h3>
                    <div className="mt-1 text-sm text-red-600 dark:text-red-300">
                      <p>{getErrorMessage(error as string)}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Access Requirements */}
              <div className="flex items-start p-4 space-x-3 border border-blue-200 rounded-lg dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div>
                  <h3 className="text-sm font-medium text-blue-800 dark:text-blue-400">
                    Authorized Access Only
                  </h3>
                  <div className="mt-2 text-sm text-blue-600 dark:text-blue-300">
                    <p className="mb-2">
                      This dashboard requires membership in a specific Discord server and role.
                    </p>
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center justify-between">
                        <span>Discord Server ID:</span>
                        <code className="px-2 py-1 font-mono bg-blue-100 rounded dark:bg-blue-900/30">
                          554266392262737930
                        </code>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Required Role ID:</span>
                        <code className="px-2 py-1 font-mono bg-blue-100 rounded dark:bg-blue-900/30">
                          797927858420187186
                        </code>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sign In Button */}
              <div>
                <button
                  onClick={handleSignIn}
                  disabled={isLoading}
                  className="group relative w-full flex justify-center items-center px-6 py-4 text-base font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed transform hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
                >
                  {isLoading ? (
                    <>
                      <div className="w-5 h-5 mr-3 border-2 border-white rounded-full border-t-transparent animate-spin"></div>
                      <span>Redirecting to Discord...</span>
                    </>
                  ) : (
                    <>
                      {/* Discord Logo */}
                      <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.010c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                      </svg>
                      <span>Sign in with Discord</span>
                      <svg className="w-5 h-5 ml-2 transition-transform duration-200 transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </>
                  )}
                </button>
              </div>

              {/* Footer */}
              <div className="text-xs text-center text-gray-500 dark:text-gray-400">
                By signing in, you acknowledge that access is restricted and monitored.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  if (session?.user?.hasRequiredAccess) {
    return {
      redirect: {
        destination: '/dashboard/554266392262737930',
        permanent: false,
      },
    };
  }

  return {
    props: {},
  };
};