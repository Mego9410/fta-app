import { initSentry } from '@/src/telemetry/sentry';

let initialized = false;

export function initTelemetry() {
  if (initialized) return;
  initialized = true;
  initSentry();
}

