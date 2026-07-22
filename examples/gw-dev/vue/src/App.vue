<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { MarketplaceSDK } from '@mission_sciences/provider-sdk';
import type { SessionData } from '@mission_sciences/provider-sdk';

const APP_ID  = '91108a6a-7f25-4b41-a20c-6a904e49048c';
// Get a real key from the GW setup page (Developer → Applications → your app → Setup). Never commit one.
const API_KEY = 'YOUR_API_KEY';

type Status = 'waiting' | 'loading' | 'active' | 'error';

const status  = ref<Status>('waiting');
const session = ref<SessionData | null>(null);
const error   = ref<string | null>(null);
let sdk: MarketplaceSDK | null = null;

const hasSession = new URLSearchParams(window.location.search).has('gwSession');

const badgeStyle = computed(() => ({
  waiting: { background: '#1e293b', color: '#94a3b8', border: '1px solid #334155' },
  loading: { background: '#1e3a5f', color: '#60a5fa', border: '1px solid #2563eb' },
  active:  { background: '#14532d', color: '#4ade80', border: '1px solid #16a34a' },
  error:   { background: '#450a0a', color: '#f87171', border: '1px solid #dc2626' },
} as const)[status.value]);

const badgeText = computed(() => ({
  waiting: 'Waiting for session…',
  loading: 'Initializing…',
  active:  '● Session active',
  error:   'Error',
}[status.value]));

onMounted(async () => {
  if (!hasSession) return;

  status.value = 'loading';
  sdk = new MarketplaceSDK({
    applicationId: APP_ID,
    apiKey: API_KEY,
    environment: 'dev',
    autoStart: true,
    warningThresholdSeconds: 300,
    debug: true,
  });

  try {
    session.value = await sdk.initialize();
    status.value = 'active';
  } catch (err) {
    error.value = (err as Error).message;
    status.value = 'error';
  }
});

onUnmounted(() => { sdk?.destroy(); });
</script>

<template>
  <div style="background:#0f1117;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
    <div style="background:#1a1f2e;border:1px solid #2d3748;border-radius:12px;padding:32px;max-width:480px;width:100%;color:#e2e8f0">
      <h1 style="font-size:1.5rem;margin-bottom:8px;color:#efc139">Vue 3 Example</h1>
      <p style="color:#94a3b8;font-size:0.875rem;margin-bottom:24px">@mission_sciences/provider-sdk · environment: dev</p>

      <span :style="{ display:'inline-block', padding:'4px 10px', borderRadius:'999px', fontSize:'0.75rem', fontWeight:600, marginBottom:'16px', ...badgeStyle }">
        {{ badgeText }}
      </span>

      <pre style="background:#0d1117;border:1px solid #2d3748;border-radius:8px;padding:16px;font-family:monospace;font-size:0.8rem;color:#94a3b8;min-height:80px;white-space:pre-wrap;word-break:break-all">
        <template v-if="status === 'waiting'">No ?gwSession= found.&#10;&#10;Visit the setup page and launch a test session.</template>
        <template v-else-if="status === 'loading'">Initializing SDK…</template>
        <template v-else-if="status === 'error'">Error: {{ error }}</template>
        <template v-else-if="status === 'active' && session">Session active!&#10;  sessionId:       {{ session.sessionId }}&#10;  durationMinutes: {{ session.durationMinutes }}</template>
      </pre>
    </div>
  </div>
</template>
