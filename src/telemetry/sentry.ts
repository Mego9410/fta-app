import * as Sentry from '@sentry/react-native';

function env(name: string): string {
  const v = (process.env as any)?.[name];
  return typeof v === 'string' ? v : '';
}

export function initSentry() {
  const dsn = env('EXPO_PUBLIC_SENTRY_DSN').trim();
  if (!dsn) return;

  Sentry.init({
    dsn,
    enableAutoSessionTracking: true,
    environment: __DEV__ ? 'dev' : 'prod',
  });
}

export function captureError(err: unknown, context?: Record<string, unknown>) {
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    // ignore
  }
}

