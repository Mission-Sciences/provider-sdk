import { Component, OnInit, OnDestroy } from '@angular/core';
import { MarketplaceSDK } from '@mission_sciences/provider-sdk';

const APP_ID = 'YOUR_APP_ID';
const API_KEY = 'YOUR_API_KEY';

@Component({
  selector: 'app-root',
  standalone: true,
  template: `
    <div>
      <!-- Your application content -->
    </div>
  `,
})
export class AppComponent implements OnInit, OnDestroy {
  private sdk: MarketplaceSDK | null = null;

  ngOnInit(): void {
    this.sdk = new MarketplaceSDK({
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
    this.sdk.initialize().catch(console.error);
  }

  ngOnDestroy(): void {
    this.sdk?.destroy();
  }
}
