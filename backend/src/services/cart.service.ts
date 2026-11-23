import { MongoService, MongoCartItemDoc } from './mongo.js';

export interface CartItemDto {
  sku: string;
  qty: number;
}

export class CartService {
  /**
   * Load active shopping cart items for a user
   */
  static async getCart(userId: string): Promise<CartItemDto[]> {
    const col = await MongoService.getCollection<MongoCartItemDoc>('cart_items');
    const items = await col
      .find({ user_id: userId })
      .project({ _id: 0, sku: 1, qty: 1 })
      .toArray();

    return items as CartItemDto[];
  }

  /**
   * Update or upsert an item quantity in the user's cart
   */
  static async updateItem(userId: string, sku: string, qty: number): Promise<CartItemDto[]> {
    const col = await MongoService.getCollection<MongoCartItemDoc>('cart_items');

    if (qty <= 0) {
      await col.deleteOne({ user_id: userId, sku });
    } else {
      await col.updateOne(
        { user_id: userId, sku },
        {
          $set: {
            user_id: userId,
            sku,
            qty: Math.floor(qty),
            updated_at: new Date().toISOString(),
          },
        },
        { upsert: true }
      );
    }

    return this.getCart(userId);
  }

  /**
   * Clear all items from a user's cart
   */
  static async clearCart(userId: string): Promise<void> {
    const col = await MongoService.getCollection<MongoCartItemDoc>('cart_items');
    await col.deleteMany({ user_id: userId });
  }
}
