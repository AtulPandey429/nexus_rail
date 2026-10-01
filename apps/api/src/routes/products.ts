import { Router, Request, Response } from 'express';
import { ProductService } from '../services/products.js';
import { RedisCacheService } from '../services/redis.js';

export const productRouter = Router();

// GET /api/v1/products - Fetch active product catalog with Redis Cache-Aside
productRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const cacheKey = 'products:active';
    const cachedData = await RedisCacheService.getCache<any[]>(cacheKey);

    if (cachedData) {
      return res.json({
        success: true,
        cached: true,
        count: cachedData.length,
        data: cachedData,
      });
    }

    const products = await ProductService.getActiveProducts();
    await RedisCacheService.setCache(cacheKey, products, 300);

    res.json({
      success: true,
      cached: false,
      count: products.length,
      data: products,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch products' });
  }
});

// GET /api/v1/products/:sku - Fetch single product by SKU
productRouter.get('/:sku', async (req: Request, res: Response) => {
  try {
    const sku = Array.isArray(req.params.sku) ? req.params.sku[0] : req.params.sku;
    const product = await ProductService.getProductBySku(sku);
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch product details' });
  }
});
