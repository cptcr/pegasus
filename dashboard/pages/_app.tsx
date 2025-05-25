// dashboard/pages/_app.tsx
import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { SessionProvider } from 'next-auth/react'
import ModernProtectedLayout from '../components/ModernProtectedLayout'
import { ThemeProvider } from '../lib/ThemeContext'
import { useRouter } from 'next/router'
import { ErrorBoundary } from 'react-error-boundary'

const publicPages = ['/auth/signin', '/auth/error', '/']

function ErrorFallback({ error, resetErrorBoundary }: { error: Error; resetErrorBoundary: () => void }) {
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
  )
}

function AppContent({ Component, pageProps }: { Component: any; pageProps: any }) {
  const router = useRouter()
  const isPublicPage = publicPages.includes(router.pathname)

  if (isPublicPage) {
    return <Component {...pageProps} />
  }

  return (
    <ModernProtectedLayout>
      <Component {...pageProps} />
    </ModernProtectedLayout>
  )
}

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  return (
    <ErrorBoundary
      FallbackComponent={ErrorFallback}
      onReset={() => window.location.reload()}
    >
      <SessionProvider session={session}>
        <ThemeProvider>
          <AppContent Component={Component} pageProps={pageProps} />
        </ThemeProvider>
      </SessionProvider>
    </ErrorBoundary>
  )
}