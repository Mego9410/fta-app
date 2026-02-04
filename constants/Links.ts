function env(name: string): string {
  const v = (process.env as any)?.[name];
  return typeof v === 'string' ? v : '';
}

export const LINKS = {
  privacy: env('EXPO_PUBLIC_PRIVACY_URL') || '/privacy',
  terms: env('EXPO_PUBLIC_TERMS_URL') || '/terms',
  supportEmail: env('EXPO_PUBLIC_SUPPORT_EMAIL') || 'oliver.acton@ft-associates.com',
  supportSite: env('EXPO_PUBLIC_SUPPORT_URL') || 'https://www.ft-associates.com/contact/',
};

