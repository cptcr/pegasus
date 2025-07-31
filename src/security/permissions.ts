import { 
  ChatInputCommandInteraction, 
  GuildMember, 
  PermissionFlagsBits,
  PermissionsBitField,
  Guild
} from 'discord.js';
import { database } from '../database/connection';
import { logger } from '../utils/logger';

export interface PermissionNode {
  node: string;
  allowed: boolean;
  source: 'role' | 'user' | 'default';
}

export class PermissionManager {
  private cache: Map<string, PermissionNode[]> = new Map();
  private readonly cacheTimeout = 300000; // 5 minutes

  /**
   * Check if a member has a specific permission
   */
  async hasPermission(
    member: GuildMember,
    permission: string
  ): Promise<boolean> {
    // Guild owner always has permission
    if (member.guild.ownerId === member.id) {
      return true;
    }

    // Check Discord admin permission
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {
      return true;
    }

    // Get all permission nodes for the member
    const nodes = await this.getMemberPermissions(member);
    
    // Check for exact match or wildcard
    return this.evaluatePermission(permission, nodes);
  }

  /**
   * Get all permissions for a member
   */
  private async getMemberPermissions(member: GuildMember): Promise<PermissionNode[]> {
    const cacheKey = `${member.guild.id}:${member.id}`;
    
    // Check cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const permissions: PermissionNode[] = [];

    // Get user-specific permissions
    const userPerms = await database.query<{ permission: string; allowed: boolean }>(
      'SELECT permission, allowed FROM user_permissions WHERE guild_id = $1 AND user_id = $2',
      [member.guild.id, member.id]
    );

    for (const perm of userPerms.rows) {
      permissions.push({
        node: perm.permission,
        allowed: perm.allowed,
        source: 'user'
      });
    }

    // Get role permissions
    const roleIds = member.roles.cache.map(r => r.id);
    if (roleIds.length > 0) {
      const rolePerms = await database.query<{ permission: string; allowed: boolean; role_id: string }>(
        'SELECT permission, allowed, role_id FROM role_permissions WHERE guild_id = $1 AND role_id = ANY($2)',
        [member.guild.id, roleIds]
      );

      // Sort by role position (higher position = higher priority)
      const sortedPerms = rolePerms.rows.sort((a, b) => {
        const roleA = member.roles.cache.get(a.role_id);
        const roleB = member.roles.cache.get(b.role_id);
        return (roleB?.position || 0) - (roleA?.position || 0);
      });

      for (const perm of sortedPerms) {
        permissions.push({
          node: perm.permission,
          allowed: perm.allowed,
          source: 'role'
        });
      }
    }

    // Cache the results
    this.cache.set(cacheKey, permissions);
    setTimeout(() => this.cache.delete(cacheKey), this.cacheTimeout);

    return permissions;
  }

  /**
   * Evaluate if a permission is granted based on nodes
   */
  private evaluatePermission(permission: string, nodes: PermissionNode[]): boolean {
    const parts = permission.split('.');
    let allowed = false;

    // Check from most specific to least specific
    for (let i = parts.length; i >= 0; i--) {
      const checkPerm = i === 0 ? '*' : parts.slice(0, i).join('.');
      const wildcardPerm = i === 0 ? '*' : `${parts.slice(0, i).join('.')}.*`;

      // Check exact match
      const exactMatch = nodes.find(n => n.node === checkPerm);
      if (exactMatch) {
        allowed = exactMatch.allowed;
        if (exactMatch.source === 'user') {
          // User permissions override all
          return allowed;
        }
      }

      // Check wildcard
      const wildcardMatch = nodes.find(n => n.node === wildcardPerm);
      if (wildcardMatch) {
        allowed = wildcardMatch.allowed;
        if (wildcardMatch.source === 'user') {
          // User permissions override all
          return allowed;
        }
      }
    }

    return allowed;
  }

  /**
   * Grant a permission to a user
   */
  async grantUserPermission(
    guildId: string,
    userId: string,
    permission: string
  ): Promise<void> {
    await database.query(
      `INSERT INTO user_permissions (guild_id, user_id, permission, allowed)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (guild_id, user_id, permission)
       DO UPDATE SET allowed = true`,
      [guildId, userId, permission]
    );

    // Clear cache
    this.cache.delete(`${guildId}:${userId}`);
    
    logger.audit('Permission granted', userId, guildId, { permission });
  }

  /**
   * Revoke a permission from a user
   */
  async revokeUserPermission(
    guildId: string,
    userId: string,
    permission: string
  ): Promise<void> {
    await database.query(
      `INSERT INTO user_permissions (guild_id, user_id, permission, allowed)
       VALUES ($1, $2, $3, false)
       ON CONFLICT (guild_id, user_id, permission)
       DO UPDATE SET allowed = false`,
      [guildId, userId, permission]
    );

    // Clear cache
    this.cache.delete(`${guildId}:${userId}`);
    
    logger.audit('Permission revoked', userId, guildId, { permission });
  }

  /**
   * Grant a permission to a role
   */
  async grantRolePermission(
    guildId: string,
    roleId: string,
    permission: string
  ): Promise<void> {
    await database.query(
      `INSERT INTO role_permissions (guild_id, role_id, permission, allowed)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (guild_id, role_id, permission)
       DO UPDATE SET allowed = true`,
      [guildId, roleId, permission]
    );

    // Clear cache for all members with this role
    this.clearGuildCache(guildId);
    
    logger.audit('Role permission granted', 'system', guildId, { roleId, permission });
  }

  /**
   * Revoke a permission from a role
   */
  async revokeRolePermission(
    guildId: string,
    roleId: string,
    permission: string
  ): Promise<void> {
    await database.query(
      `INSERT INTO role_permissions (guild_id, role_id, permission, allowed)
       VALUES ($1, $2, $3, false)
       ON CONFLICT (guild_id, role_id, permission)
       DO UPDATE SET allowed = false`,
      [guildId, roleId, permission]
    );

    // Clear cache for all members with this role
    this.clearGuildCache(guildId);
    
    logger.audit('Role permission revoked', 'system', guildId, { roleId, permission });
  }

  /**
   * Clear cache for a guild
   */
  private clearGuildCache(guildId: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${guildId}:`)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get all permissions for display
   */
  async getPermissionList(guildId: string, targetId: string, type: 'user' | 'role'): Promise<PermissionNode[]> {
    const table = type === 'user' ? 'user_permissions' : 'role_permissions';
    const column = type === 'user' ? 'user_id' : 'role_id';
    
    const result = await database.query<{ permission: string; allowed: boolean }>(
      `SELECT permission, allowed FROM ${table} WHERE guild_id = $1 AND ${column} = $2 ORDER BY permission`,
      [guildId, targetId]
    );

    return result.rows.map(row => ({
      node: row.permission,
      allowed: row.allowed,
      source: type
    }));
  }

  /**
   * Middleware for command permission checking
   */
  async checkCommandPermission(
    interaction: ChatInputCommandInteraction,
    requiredPermission?: string
  ): Promise<boolean> {
    if (!interaction.guild || !interaction.member) {
      return false;
    }

    const member = interaction.member as GuildMember;
    const permission = requiredPermission || `command.${interaction.commandName}`;

    const hasPermission = await this.hasPermission(member, permission);
    
    if (!hasPermission) {
      logger.warn('Permission denied', {
        userId: member.id,
        guildId: interaction.guild.id,
        permission,
        command: interaction.commandName
      });
    }

    return hasPermission;
  }

  /**
   * Get permission nodes for commands
   */
  static getCommandPermissions(): Record<string, string> {
    return {
      // Moderation
      'ban': 'moderation.ban',
      'kick': 'moderation.kick',
      'mute': 'moderation.mute',
      'warn': 'moderation.warn',
      'clear': 'moderation.clear',
      
      // Admin
      'config': 'admin.config',
      'setup': 'admin.setup',
      'permissions': 'admin.permissions',
      
      // Economy
      'economy': 'economy.manage',
      'give': 'economy.give',
      'take': 'economy.take',
      
      // Giveaways
      'giveaway': 'giveaway.manage',
      
      // Tickets
      'ticket-setup': 'tickets.setup',
      'ticket-close': 'tickets.close',
      
      // Utility
      'say': 'utility.say',
      'embed': 'utility.embed',
    };
  }
}

// Global permission manager instance
export const permissions = new PermissionManager();