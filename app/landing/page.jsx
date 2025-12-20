'use client';

import LandingPage from '../components/LandingPage';
import { useRouter } from 'next/navigation';

export default function Page() {
  const router = useRouter();

  return (
    <LandingPage
      onLaunch={() => router.push('/?login=true')}
    />
  );
}
