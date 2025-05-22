// dashboard/pages/index.tsx
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import Head from 'next/head';
import { ShieldCheckIcon } from '@heroicons/react/24/outline';

const ALLOWED_GUILD_ID = '554266392262737930';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;

    if (!session) {
      router.push('/auth/signin');
      return;
    }

    // Redirect authenticated users to the main dashboard
    router.push('/dashboard');
  }, [session, status, router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Head>
        <title>Hinko Bot Dashboard</title>
        <meta name="description" content="Admin Dashboard for Hinko Discord Bot" />
      </Head>

      <div className="text-center">
        <ShieldCheckIcon className="h-16 w-16 text-indigo-600 mx-auto mb-4" />
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Hinko Bot Dashboard</h1>
        <p className="text-gray-600 mb-4">Loading...</p>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto"></div>
      </div>
    </div>
  );
}