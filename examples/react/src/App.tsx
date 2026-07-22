import { useEffect } from 'react';
import { MarketplaceSDK } from '@mission_sciences/provider-sdk';

const APP_ID = 'YOUR_APP_ID';
const API_KEY = 'YOUR_API_KEY';

export default function App() {
  useEffect(() => {
    const sdk = new MarketplaceSDK({
      applicationId:            APP_ID,
      apiKey:                   API_KEY,
      environment:              'production',   // 'demo' | 'production'
      autoStart:                true,
      themeMode:                'auto',          // 'light' | 'dark' | 'auto'
      warningThresholdSeconds:  300,            // seconds before expiry warning
      enableHeartbeat:          false,          // keep-alive ping
      heartbeatIntervalSeconds: 30,
      debug:                    false,
    });
    sdk.initialize().catch(console.error);
    return () => sdk.destroy();
  }, []);

  return (
    <div>
      {/* Your application content */}
    </div>
  );
}
