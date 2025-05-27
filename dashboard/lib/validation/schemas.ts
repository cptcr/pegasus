// dashboard/lib/validation/schemas.ts - Zod Validation Schemas
import { z } from 'zod';

// Discord ID validation (18-19 digits)
const discordIdSchema = z.string().regex(/^\d{17,19}$/, 'Invalid Discord ID format');

// --- Guild Settings Validation ---
export const guildSettingsSchema = z.object({
  // Core Configuration
  prefix: z.string().min(1).max(5).optional().nullable(),
  
  // Channel Configuration
  modLogChannelId: discordIdSchema.optional().nullable(),
  welcomeChannelId: discordIdSchema.optional().nullable(),
  levelUpChannelId: discordIdSchema.optional().nullable(),
  geizhalsChannelId: discordIdSchema.optional().nullable(),
  joinToCreateChannelId: discordIdSchema.optional().nullable(),
  joinToCreateCategoryId: discordIdSchema.optional().nullable(),
  
  // Role Configuration
  quarantineRoleId: discordIdSchema.optional().nullable(),
  staffRoleId: discordIdSchema.optional().nullable(),
  
  // Feature Toggles
  enableLeveling: z.boolean().optional(),
  enableModeration: z.boolean().optional(),
  enablePolls: z.boolean().optional(),
  enableGiveaways: z.boolean().optional(),
  enableTickets: z.boolean().optional(),
  enableGeizhals: z.boolean().optional(),
  enableAutomod: z.boolean().optional(),
  enableMusic: z.boolean().optional(),
  enableJoinToCreate: z.boolean().optional(),
  
  // Message Templates
  welcomeMessage: z.string().max(2000).optional().nullable(),
  goodbyeMessage: z.string().max(2000).optional().nullable(),
}).strict();

export const guildSettingsUpdateSchema = guildSettingsSchema.partial();

// --- Level Reward Validation ---
export const levelRewardSchema = z.object({
  guildId: discordIdSchema,
  level: z.number().int().min(1).max(1000),
  roleId: discordIdSchema,
  description: z.string().min(1).max(200),
});

export const levelRewardUpdateSchema = levelRewardSchema.omit({ guildId: true }).partial();

// --- Pagination Validation ---
export const paginationSchema = z.object({
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(25),
});

// --- API Query Validation ---
export const guildQuerySchema = z.object({
  guildId: discordIdSchema,
});

export const levelQuerySchema = guildQuerySchema.extend({
  page: z.string().transform((val: string) => parseInt(val) || 1).pipe(z.number().int().min(1)).optional(),
  limit: z.string().transform((val: string) => parseInt(val) || 25).pipe(z.number().int().min(1).max(100)).optional(),
});

// --- Moderation Validation ---
export const warnCreateSchema = z.object({
  userId: discordIdSchema,
  guildId: discordIdSchema,
  moderatorId: discordIdSchema,
  reason: z.string().min(1).max(1000),
});

export const quarantineCreateSchema = z.object({
  userId: discordIdSchema,
  guildId: discordIdSchema,
  moderatorId: discordIdSchema,
  reason: z.string().min(1).max(1000),
});

export const autoModRuleSchema = z.object({
  guildId: discordIdSchema,
  name: z.string().min(1).max(100),
  type: z.enum(['SPAM', 'LINKS', 'CAPS', 'PROFANITY', 'MENTIONS', 'CUSTOM']),
  enabled: z.boolean().default(true),
  trigger: z.record(z.any()), // JSON object for trigger configuration
  action: z.record(z.any()),  // JSON object for action configuration
  exemptRoles: z.array(discordIdSchema).optional().default([]),
  exemptChannels: z.array(discordIdSchema).optional().default([]),
});

// --- Poll Validation ---
export const pollCreateSchema = z.object({
  guildId: discordIdSchema,
  channelId: discordIdSchema,
  title: z.string().min(1).max(256),
  description: z.string().max(2000).optional().nullable(),
  creatorId: discordIdSchema,
  multiple: z.boolean().default(false),
  anonymous: z.boolean().default(false),
  endTime: z.string().datetime().transform((str: string | number | Date) => new Date(str)).optional().nullable(),
  options: z.array(z.object({
    text: z.string().min(1).max(100),
    emoji: z.string().max(10).optional().nullable(),
  })).min(2).max(10),
});

// --- Giveaway Validation ---
export const giveawayCreateSchema = z.object({
  guildId: discordIdSchema,
  channelId: discordIdSchema,
  title: z.string().min(1).max(256),
  description: z.string().max(2000).optional().nullable(),
  prize: z.string().min(1).max(256),
  winners: z.number().int().min(1).max(100).default(1),
  creatorId: discordIdSchema,
  endTime: z.string().datetime().transform((str: string | number | Date) => new Date(str)),
  requiredRole: discordIdSchema.optional().nullable(),
  requiredLevel: z.number().int().min(1).optional().nullable(),
});

// --- Ticket Validation ---
export const ticketCreateSchema = z.object({
  guildId: discordIdSchema,
  channelId: discordIdSchema,
  userId: discordIdSchema,
  category: z.string().min(1).max(50),
  subject: z.string().min(1).max(256),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
});

// --- Response Validation ---
export const apiResponseSchema = <T extends z.ZodType>(dataSchema: T) => z.object({
  success: z.boolean(),
  data: dataSchema.optional(),
  error: z.string().optional(),
  message: z.string().optional(),
});

// --- User Validation ---
export const userSchema = z.object({
  id: discordIdSchema,
  username: z.string().min(1).max(32),
  discriminator: z.string().regex(/^\d{4}$/).optional().nullable(),
  avatar: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
});

// --- Activity Metrics Validation ---
export const activityMetricsSchema = z.object({
  activityScore: z.number().min(0).max(100),
  healthScore: z.number().min(0).max(100),
  totalEvents: z.number().int().min(0),
  averageDaily: z.object({
    warns: z.number().min(0),
    polls: z.number().min(0),
    giveaways: z.number().min(0),
    tickets: z.number().min(0),
  }),
});

// --- Validation Helper Functions ---
export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public code: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Validate data against a Zod schema and return typed result
 */
export function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context?: string
): T {
  try {
    return schema.parse(data);
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      throw new ValidationError(
        `${context ? `${context}: ` : ''}${firstError.message}`,
        firstError.path.join('.'),
        firstError.code
      );
    }
    throw error;
  }
}

/**
 * Safely validate data and return result with error handling
 */
export function safeValidateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string; field?: string } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: firstError.message,
        field: firstError.path.join('.')
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown validation error'
    };
  }
}

/**
 * Validate guild ID format
 */
export function isValidDiscordId(id: string): boolean {
  return discordIdSchema.safeParse(id).success;
}

/**
 * Validate multiple Discord IDs
 */
export function validateDiscordIds(ids: string[]): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  
  ids.forEach(id => {
    if (isValidDiscordId(id)) {
      valid.push(id);
    } else {
      invalid.push(id);
    }
  });
  
  return { valid, invalid };
}

// Export all schemas for external use
export const schemas = {
  guildSettings: guildSettingsSchema,
  guildSettingsUpdate: guildSettingsUpdateSchema,
  levelReward: levelRewardSchema,
  pagination: paginationSchema,
  guildQuery: guildQuerySchema,
  levelQuery: levelQuerySchema,
  warnCreate: warnCreateSchema,
  quarantineCreate: quarantineCreateSchema,
  autoModRule: autoModRuleSchema,
  pollCreate: pollCreateSchema,
  giveawayCreate: giveawayCreateSchema,
  ticketCreate: ticketCreateSchema,
  user: userSchema,
  activityMetrics: activityMetricsSchema,
  apiResponse: apiResponseSchema,
} as const;

// Type exports for TypeScript inference
export type GuildSettingsInput = z.infer<typeof guildSettingsSchema>;
export type GuildSettingsUpdate = z.infer<typeof guildSettingsUpdateSchema>;
export type LevelRewardInput = z.infer<typeof levelRewardSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type WarnCreateInput = z.infer<typeof warnCreateSchema>;
export type QuarantineCreateInput = z.infer<typeof quarantineCreateSchema>;
export type AutoModRuleInput = z.infer<typeof autoModRuleSchema>;
export type PollCreateInput = z.infer<typeof pollCreateSchema>;
export type GiveawayCreateInput = z.infer<typeof giveawayCreateSchema>;
export type TicketCreateInput = z.infer<typeof ticketCreateSchema>;
export type UserInput = z.infer<typeof userSchema>;
export type ActivityMetricsInput = z.infer<typeof activityMetricsSchema>;