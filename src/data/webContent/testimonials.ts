import {
  fetchAllTestimonialsFromSupabase,
  fetchLatestTestimonialsFromSupabase,
} from '@/src/data/webContent/supabaseRepo';

export type TestimonialPreview = {
  id: string;
  author: string;
  quote: string;
  dateText?: string | null;
  url?: string | null;
};

/**
 * Fetch all testimonials from Supabase only.
 */
export async function fetchAllTestimonials(): Promise<TestimonialPreview[]> {
  return await fetchAllTestimonialsFromSupabase();
}

/**
 * Fetch latest testimonials from Supabase only.
 */
export async function fetchLatestTestimonials({ limit }: { limit: number }): Promise<TestimonialPreview[]> {
  return await fetchLatestTestimonialsFromSupabase({ limit });
}

