export interface HealthResponse {
    status: 'ok' | 'degraded';
    service: string;
    version: string;
    uptimeSeconds: number;
    timestamp: string;
}
//# sourceMappingURL=health.d.ts.map