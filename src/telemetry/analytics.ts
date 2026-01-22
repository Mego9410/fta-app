import { getDistinctId } from '@/src/telemetry/distinctId';

type Props = Record<string, unknown>;

const DEFAULT_HOST = 'https://app.posthog.com';

function env(name: string): string {
  const v = (process.env as any)?.[name];
  return typeof v === 'string' ? v : '';
}

function host() {
  return (env('EXPO_PUBLIC_POSTHOG_HOST') || DEFAULT_HOST).replace(/\/+$/, '');
}

function apiKey() {
  return (env('EXPO_PUBLIC_POSTHOG_API_KEY') || '').trim();
}

export async function track(event: string, props: Props = {}): Promise<void> {
  const key = apiKey();
  if (!key) return;

  try {
    const distinctId = await getDistinctId();
    const payload = {
      api_key: key,
      event,
      properties: {
        distinct_id: distinctId,
        $lib: 'fta-app',
        ...props,
      },
    };

    await fetch(`${host()}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    // best-effort: silently fail if tracking fails (e.g., network error, SecureStore error)
    // Don't log to avoid console spam
  }
}

