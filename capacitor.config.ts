import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.irontrack.app',
  appName: 'Iron Track',
  webDir: 'dist',
  backgroundColor: '#121418',
  android: {
    // Never load remote content; the app is fully bundled.
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
      style: 'DARK',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_iron',
      iconColor: '#A3E635',
    },
  },
};

export default config;
