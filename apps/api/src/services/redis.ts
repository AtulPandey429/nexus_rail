const cacheStore = new Map<string, { value: any; expiresAt: number }>();

export class RedisCacheService {
  static async getCache<T>(key: string): Promise<T | null> {
    const item = cacheStore.get(key);
    if (!item) return null;
    if (item.expiresAt < Date.now()) {
      cacheStore.delete(key);
      return null;
    }
    return item.value as T;
  }

  static async setCache(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    cacheStore.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  static async invalidateCache(key: string): Promise<void> {
    cacheStore.delete(key);
  }
}
