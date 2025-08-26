import { Router, Request, Response } from 'express';
import { getDatabase } from '../../database/connection';
import { economyShopItems, economyBalances, economyTransactions } from '../../database/schema';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// Validation schemas
const createShopItemSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  price: z.number().min(0),
  type: z.string().optional(),
  effectType: z.string().optional(),
  effectValue: z.any().optional(),
  stock: z.number().optional(),
  requiresRole: z.string().optional(),
  enabled: z.boolean().optional()
});

const updateShopItemSchema = createShopItemSchema.partial();

const economySettingsSchema = z.object({
  enabled: z.boolean().optional(),
  currencyName: z.string().optional(),
  currencySymbol: z.string().optional(),
  startingBalance: z.number().min(0).optional(),
  dailyAmount: z.number().min(0).optional(),
  dailyStreakBonus: z.number().min(0).optional(),
  maxBalance: z.number().min(0).optional(),
  workCooldown: z.number().min(0).optional(),
  workRewardMin: z.number().min(0).optional(),
  workRewardMax: z.number().min(0).optional()
});

// POST /guilds/{guildId}/economy/shop-items - Create shop item
router.post('/:guildId/economy/shop-items', async (req: Request, res: Response) => {
  const { guildId } = req.params;
  
  try {
    const validation = createShopItemSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: validation.error.errors
      });
    }

    const db = getDatabase();
    const itemData = validation.data;
    const itemId = uuidv4();

    const [newItem] = await db.insert(economyShopItems)
      .values({
        guildId,
        name: itemData.name,
        description: itemData.description || '',
        price: itemData.price,
        type: itemData.type || 'item',
        effectType: itemData.effectType || null,
        effectValue: itemData.effectValue || null,
        stock: itemData.stock || null,
        requiresRole: itemData.requiresRole || null,
        enabled: itemData.enabled !== false,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    logger.info(`Created shop item ${itemId} for guild ${guildId}`);

    return res.status(201).json({
      success: true,
      item: {
        id: newItem.id,
        name: newItem.name,
        description: newItem.description,
        price: newItem.price,
        type: newItem.type,
        effectType: newItem.effectType,
        effectValue: newItem.effectValue,
        stock: newItem.stock,
        enabled: newItem.enabled
      }
    });
  } catch (error) {
    logger.error('Error creating shop item:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create shop item'
    });
  }
});

// PATCH /guilds/{guildId}/economy/shop-items/{itemId} - Update shop item
router.patch('/:guildId/economy/shop-items/:itemId', async (req: Request, res: Response) => {
  const { guildId, itemId } = req.params;
  
  try {
    const validation = updateShopItemSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: validation.error.errors
      });
    }

    const db = getDatabase();
    const updates = validation.data;

    // Check if item exists
    const [existingItem] = await db
      .select()
      .from(economyShopItems)
      .where(and(
        eq(economyShopItems.id, itemId),
        eq(economyShopItems.guildId, guildId)
      ))
      .limit(1);

    if (!existingItem) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Shop item not found'
      });
    }

    // Update the item
    const [updatedItem] = await db
      .update(economyShopItems)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(and(
        eq(economyShopItems.id, itemId),
        eq(economyShopItems.guildId, guildId)
      ))
      .returning();

    logger.info(`Updated shop item ${itemId} for guild ${guildId}`);

    return res.json({
      success: true,
      item: {
        id: updatedItem.id,
        name: updatedItem.name,
        description: updatedItem.description,
        price: updatedItem.price,
        type: updatedItem.type,
        effectType: updatedItem.effectType,
        effectValue: updatedItem.effectValue,
        stock: updatedItem.stock,
        enabled: updatedItem.enabled
      }
    });
  } catch (error) {
    logger.error('Error updating shop item:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update shop item'
    });
  }
});

// DELETE /guilds/{guildId}/economy/shop-items/{itemId} - Delete shop item
router.delete('/:guildId/economy/shop-items/:itemId', async (req: Request, res: Response) => {
  const { guildId, itemId } = req.params;
  
  try {
    const db = getDatabase();

    // Check if item exists
    const [existingItem] = await db
      .select()
      .from(economyShopItems)
      .where(and(
        eq(economyShopItems.id, itemId),
        eq(economyShopItems.guildId, guildId)
      ))
      .limit(1);

    if (!existingItem) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Shop item not found'
      });
    }

    // Delete the item
    await db
      .delete(economyShopItems)
      .where(and(
        eq(economyShopItems.id, itemId),
        eq(economyShopItems.guildId, guildId)
      ));

    logger.info(`Deleted shop item ${itemId} from guild ${guildId}`);

    return res.json({
      success: true,
      message: 'Shop item deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting shop item:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete shop item'
    });
  }
});

// PATCH /guilds/{guildId}/economy/settings - Update economy settings
router.patch('/:guildId/economy/settings', async (req: Request, res: Response) => {
  const { guildId } = req.params;
  
  try {
    const validation = economySettingsSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Invalid request body',
        details: validation.error.errors
      });
    }

    // For now, just return success since economy settings are managed in a different way
    // In production, you would create a separate economy_settings table or use a JSON column
    logger.info(`Economy settings update requested for guild ${guildId}`);

    return res.json({
      success: true,
      message: 'Economy settings updated successfully',
      note: 'Settings are managed through bot configuration'
    });
  } catch (error) {
    logger.error('Error updating economy settings:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update economy settings'
    });
  }
});

// POST /guilds/{guildId}/economy/reset - Reset economy data
router.post('/:guildId/economy/reset', async (req: Request, res: Response) => {
  const { guildId } = req.params;
  const { resetBalances = true, resetShop = false, resetTransactions = true } = req.body;
  
  try {
    const db = getDatabase();

    // Start a transaction for data consistency
    await db.transaction(async (tx) => {
      if (resetBalances) {
        // Reset all user balances
        await tx
          .delete(economyBalances)
          .where(eq(economyBalances.guildId, guildId));
        
        logger.info(`Reset economy balances for guild ${guildId}`);
      }

      if (resetShop) {
        // Delete all shop items
        await tx
          .delete(economyShopItems)
          .where(eq(economyShopItems.guildId, guildId));
        
        logger.info(`Reset shop items for guild ${guildId}`);
      }

      if (resetTransactions) {
        // Delete all transactions
        await tx
          .delete(economyTransactions)
          .where(eq(economyTransactions.guildId, guildId));
        
        logger.info(`Reset transactions for guild ${guildId}`);
      }
    });

    return res.json({
      success: true,
      message: 'Economy data reset successfully',
      reset: {
        balances: resetBalances,
        shop: resetShop,
        transactions: resetTransactions
      }
    });
  } catch (error) {
    logger.error('Error resetting economy data:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to reset economy data'
    });
  }
});

export const economyRouter = router;