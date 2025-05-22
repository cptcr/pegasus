// dashboard/pages/_app.tsx
import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { SessionProvider } from 'next-auth/react'
import ProtectedLayout from '../components/ProtectedLayout'
import { useRouter } from 'next/router'

const publicPages = ['/auth/signin', '/auth/error', '/']

export default function App({ Component, pageProps: { session, ...pageProps } }: AppProps) {
  const router = useRouter()
  const isPublicPage = publicPages.includes(router.pathname)

  if (isPublicPage) {
    return (
      <SessionProvider session={session}>
        <Component {...pageProps} />
      </SessionProvider>
    )
  }

  return (
    <SessionProvider session={session}>
      <ProtectedLayout>
        <Component {...pageProps} />
      </ProtectedLayout>
    </SessionProvider>
  )
}