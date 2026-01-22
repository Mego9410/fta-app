import {
  fetchLatestArticlePreviewsFromSupabase,
  fetchArticleDetailFromSupabase,
} from '@/src/data/webContent/supabaseRepo';

export type ArticlePreview = {
  title: string;
  url: string;
  dateText?: string | null;
  excerpt?: string | null;
};

export type ArticleDetail = {
  title: string;
  url: string;
  dateText?: string | null;
  contentText: string;
  blocks?: ArticleBlock[];
};

export type ArticleInline = {
  text: string;
  bold?: boolean;
  italic?: boolean;
};

export type ArticleBlock =
  | { type: 'p'; inlines: ArticleInline[] }
  | { type: 'h2' | 'h3'; inlines: ArticleInline[] }
  | { type: 'li'; inlines: ArticleInline[] };

/**
 * Fetch article previews from Supabase only.
 */
export async function fetchLatestArticlePreviews({ limit }: { limit: number }): Promise<ArticlePreview[]> {
  return await fetchLatestArticlePreviewsFromSupabase({ limit });
}

/**
 * Fetch article detail from Supabase only.
 */
export async function fetchArticleDetail(url: string): Promise<ArticleDetail | null> {
  if (!url) return null;
  return await fetchArticleDetailFromSupabase(url);
}

