export type PublicSupabaseConfig = {
  url: string;
  publishableKey: string;
};

export function getPublicSupabaseConfig(): PublicSupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey || publishableKey.startsWith('replace-with-')) {
    return null;
  }

  return { url, publishableKey };
}

export function isSupabaseConfigured() {
  return getPublicSupabaseConfig() !== null;
}
