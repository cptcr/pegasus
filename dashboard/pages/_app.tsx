// dashboard/pages/_app.tsx
import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { SessionProvider } from 'next-auth/react'
import ModernProtectedLayout from '../components/ModernProtectedLayout' // Assuming ModernProtectedLayout is default export
import { ThemeProvider } from '../lib/ThemeContext'
import { useRouter } from 'next/router'
import { ErrorBoundary, FallbackProps } from 'react-error-boundary' // Import FallbackProps
import { ComponentType } from 'react'; // Import ComponentType

const publicPages = ['/auth/signin', '/auth/error', '/']; // '/' might be your landing page

// Define props for ErrorFallback based on FallbackProps
function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-8 space-y-4 text-center">
        <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">
          Something went wrong
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          {error.message}
        </p>
        <button
          onClick={resetErrorBoundary}
          className="px-4 py-2 text-white transition-colors duration-200 bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

interface AppContentProps {
  Component: ComponentType<Record<string, unknown>>; // Use ComponentType and allow any props for the page
  pageProps: Record<string, unknown>; // Page props can be anything
}

function AppContent({ Component, pageProps }: AppContentProps) {
  const router = useRouter();
  const isPublicPage = publicPages.includes(router.pathname);

  if (isPublicPage) {
    return <Component {...pageProps} />;
  }

  // Assuming ModernProtectedLayout handles its own props, or you can pass them if needed
  return (
    <ModernProtectedLayout>
      <Component {...pageProps} />
    </ModernProtectedLayout>
  );
}

// Define a more specific type for session in pageProps
interface AppPageProps {
  session?: ReturnType<typeof useSession>['data']; // Or a more specific session type
  [key: string]: unknown; // Allow other pageProps
}

export default function App({ Component, pageProps }: AppProps<AppPageProps>) {
  const { session, ...restPageProps } = pageProps;
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => {
        // Attempt to reload the page or navigate to a safe route
        if (typeof window !== "undefined") {
            window.location.reload();
        }
      }}
    >
      <SessionProvider session={session}>
        <ThemeProvider>
          <AppContent Component={Component} pageProps={restPageProps} />
        </ThemeProvider>
      </SessionProvider>
    </ErrorBoundary>
  );
}