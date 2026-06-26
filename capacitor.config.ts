import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.blackhole.streaming',
  appName: 'Black Hole',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
