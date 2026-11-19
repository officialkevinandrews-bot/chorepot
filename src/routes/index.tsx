import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from '@/features/family/dashboard';
import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';

// The home route ships no og:image, so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: 'Chorepot | Little chores, big possibilities' }, { name: 'description', content: 'A cheerful family space for chores, pocket money and savings goals in pounds and pence.' }, { property: 'og:title', content: 'Chorepot | Little chores, big possibilities' }, { property: 'og:description', content: 'Grow good habits together with family chores and pocket money.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  const navigate = useNavigate();
  useEffect(() => { supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: '/dashboard' }); }); }, [navigate]);
  return <Dashboard />;
}
