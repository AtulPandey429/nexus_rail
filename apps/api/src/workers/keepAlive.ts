export class KeepAliveWorker {
  private static timer: NodeJS.Timeout | null = null;

  static startKeepAlive(): void {
    const externalUrl = process.env.RENDER_EXTERNAL_URL || process.env.BACKEND_URL;
    if (!externalUrl) {
      console.log('⏰ [KeepAliveWorker] RENDER_EXTERNAL_URL environment variable ready for Render deployment.');
      return;
    }

    const healthEndpoint = `${externalUrl.replace(/\/$/, '')}/api/v1/health`;
    console.log(`⏰ [KeepAliveWorker] Anti-sleep 24/7 keep-alive ping active for: ${healthEndpoint}`);

    // Self-ping every 10 minutes (600,000 ms) to keep Render free tier awake 24/7
    this.timer = setInterval(async () => {
      try {
        const res = await fetch(healthEndpoint);
        console.log(`⏰ [KeepAliveWorker] Render keep-alive ping status: ${res.status}`);
      } catch (err: any) {
        console.warn(`⚠️ [KeepAliveWorker] Keep-alive ping warning: ${err.message}`);
      }
    }, 10 * 60 * 1000);
  }
}
