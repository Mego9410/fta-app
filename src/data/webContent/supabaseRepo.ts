import { requireSupabase } from '@/src/supabase/client';
import type { ArticlePreview, ArticleDetail, ArticleBlock } from './articles';
import type { TestimonialPreview } from './testimonials';

/**
 * Fetch article previews from Supabase.
 * Falls back to empty array if Supabase is not configured or query fails.
 */
export async function fetchLatestArticlePreviewsFromSupabase({
  limit,
}: {
  limit: number;
}): Promise<ArticlePreview[]> {
  try {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('articles')
      .select('title, url, date_text, excerpt')
      .order('updated_at', { ascending: false })
      .limit(Math.max(1, limit));

    if (error) {
      console.warn('Failed to fetch articles from Supabase:', error);
      return [];
    }

    return (data || []).map((row) => ({
      title: row.title,
      url: row.url,
      dateText: row.date_text || null,
      excerpt: row.excerpt || null,
    }));
  } catch (e) {
    console.warn('Supabase not configured or error fetching articles:', e);
    return [];
  }
}

/**
 * Fetch article detail from Supabase.
 * Falls back to null if Supabase is not configured or query fails.
 */
export async function fetchArticleDetailFromSupabase(url: string): Promise<ArticleDetail | null> {
  if (!url) return null;

  try {
    const supabase = requireSupabase();
    const { data, error } = await supabase.from('articles').select('*').eq('url', url).single();

    if (error || !data) {
      console.warn(`Failed to fetch article ${url} from Supabase:`, error);
      return null;
    }

    return {
      title: data.title,
      url: data.url,
      dateText: data.date_text || null,
      contentText: data.content_text,
      blocks: (data.blocks_json as ArticleBlock[]) || undefined,
    };
  } catch (e) {
    console.warn(`Supabase not configured or error fetching article ${url}:`, e);
    return null;
  }
}

/**
 * Fetch all testimonials from Supabase.
 * Falls back to empty array if Supabase is not configured or query fails.
 */
export async function fetchAllTestimonialsFromSupabase(): Promise<TestimonialPreview[]> {
  try {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('testimonials')
      .select('id, author, quote, date_text, url')
      .order('updated_at', { ascending: false });

    if (error) {
      console.warn('Failed to fetch testimonials from Supabase:', error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      author: row.author,
      quote: row.quote,
      dateText: row.date_text || null,
      url: row.url || null,
    }));
  } catch (e) {
    console.warn('Supabase not configured or error fetching testimonials:', e);
    return [];
  }
}

/**
 * Fetch latest testimonials from Supabase.
 * Falls back to empty array if Supabase is not configured or query fails.
 */
export async function fetchLatestTestimonialsFromSupabase({
  limit,
}: {
  limit: number;
}): Promise<TestimonialPreview[]> {
  try {
    const supabase = requireSupabase();
    const { data, error } = await supabase
      .from('testimonials')
      .select('id, author, quote, date_text, url')
      .order('updated_at', { ascending: false })
      .limit(Math.max(1, limit));

    if (error) {
      console.warn('Failed to fetch testimonials from Supabase:', error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      author: row.author,
      quote: row.quote,
      dateText: row.date_text || null,
      url: row.url || null,
    }));
  } catch (e) {
    console.warn('Supabase not configured or error fetching testimonials:', e);
    return [];
  }
}
