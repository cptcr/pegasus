import { Command } from '../../types/command';
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from 'discord.js';
import { getI18n } from '../../utils/i18n';

export const xpconfig: Command = {
    data: new SlashCommandBuilder()
        .setName('xpconfig')
        .setDescription('Configure XP system settings')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName('channel-multiplier')
                .setDescription('Set XP multiplier for a channel')
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('The channel to configure')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)
                )
                .addNumberOption(option =>
                    option.setName('multiplier')
                        .setDescription('XP multiplier (0.5 = 50%, 2 = 200%)')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(10)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('role-multiplier')
                .setDescription('Set XP multiplier for a role')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('The role to configure')
                        .setRequired(true)
                )
                .addNumberOption(option =>
                    option.setName('multiplier')
                        .setDescription('XP multiplier (0.5 = 50%, 2 = 200%)')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(10)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('user-multiplier')
                .setDescription('Set XP multiplier for a user')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to configure')
                        .setRequired(true)
                )
                .addNumberOption(option =>
                    option.setName('multiplier')
                        .setDescription('XP multiplier (0.5 = 50%, 2 = 200%)')
                        .setRequired(true)
                        .setMinValue(0)
                        .setMaxValue(10)
                )
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the multiplier')
                        .setRequired(true)
                )
                .addIntegerOption(option =>
                    option.setName('duration')
                        .setDescription('Duration in hours (leave empty for permanent)')
                        .setRequired(false)
                        .setMinValue(1)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('event')
                .setDescription('Create a server-wide XP event')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Event name')
                        .setRequired(true)
                )
                .addNumberOption(option =>
                    option.setName('multiplier')
                        .setDescription('XP multiplier during event')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(10)
                )
                .addIntegerOption(option =>
                    option.setName('duration')
                        .setDescription('Duration in hours')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(168) // 1 week max
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('role-reward')
                .setDescription('Configure role rewards for levels')
                .addIntegerOption(option =>
                    option.setName('level')
                        .setDescription('Level to reward at')
                        .setRequired(true)
                        .setMinValue(1)
                )
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to award')
                        .setRequired(true)
                )
                .addBooleanOption(option =>
                    option.setName('remove-previous')
                        .setDescription('Remove previous level roles when assigning this one')
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('reset-user')
                .setDescription('Reset a user\'s XP and level')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('The user to reset')
                        .setRequired(true)
                )
        ),
    
    async execute(interaction) {
        if (!interaction.guild) return;
        
        const i18n = getI18n(interaction.locale);
        const subcommand = interaction.options.getSubcommand();
        const xpHandler = interaction.client.xpHandler;
        
        try {
            switch (subcommand) {
                case 'channel-multiplier': {
                    const channel = interaction.options.getChannel('channel');
                    const multiplier = interaction.options.getNumber('multiplier')!;
                    
                    await xpHandler.setChannelMultiplier(interaction.guild.id, channel!.id, multiplier);
                    
                    await interaction.reply({
                        content: i18n.t('xp.channelMultiplierSet', { 
                            channel: channel!.toString(), 
                            multiplier: `${multiplier}x` 
                        }),
                        ephemeral: true
                    });
                    break;
                }
                
                case 'role-multiplier': {
                    const role = interaction.options.getRole('role');
                    const multiplier = interaction.options.getNumber('multiplier')!;
                    
                    await xpHandler.setRoleMultiplier(interaction.guild.id, role!.id, multiplier);
                    
                    await interaction.reply({
                        content: i18n.t('xp.roleMultiplierSet', { 
                            role: role!.toString(), 
                            multiplier: `${multiplier}x` 
                        }),
                        ephemeral: true
                    });
                    break;
                }
                
                case 'user-multiplier': {
                    const user = interaction.options.getUser('user');
                    const multiplier = interaction.options.getNumber('multiplier')!;
                    const reason = interaction.options.getString('reason')!;
                    const duration = interaction.options.getInteger('duration');
                    
                    const expiresAt = duration ? new Date(Date.now() + duration * 60 * 60 * 1000) : undefined;
                    
                    await xpHandler.setUserMultiplier(
                        interaction.guild.id, 
                        user!.id, 
                        multiplier, 
                        reason, 
                        expiresAt
                    );
                    
                    await interaction.reply({
                        content: i18n.t('xp.userMultiplierSet', { 
                            user: user!.toString(), 
                            multiplier: `${multiplier}x`,
                            duration: duration ? i18n.t('xp.hours', { hours: duration }) : i18n.t('xp.permanent')
                        }),
                        ephemeral: true
                    });
                    break;
                }
                
                case 'event': {
                    const name = interaction.options.getString('name')!;
                    const multiplier = interaction.options.getNumber('multiplier')!;
                    const duration = interaction.options.getInteger('duration')!;
                    
                    const startTime = new Date();
                    const endTime = new Date(Date.now() + duration * 60 * 60 * 1000);
                    
                    await xpHandler.createEventMultiplier(
                        interaction.guild.id,
                        name,
                        multiplier,
                        startTime,
                        endTime
                    );
                    
                    await interaction.reply({
                        content: i18n.t('xp.eventCreated', { 
                            name,
                            multiplier: `${multiplier}x`,
                            duration: i18n.t('xp.hours', { hours: duration })
                        })
                    });
                    break;
                }
                
                case 'role-reward': {
                    const level = interaction.options.getInteger('level')!;
                    const role = interaction.options.getRole('role');
                    const removePrevious = interaction.options.getBoolean('remove-previous') || false;
                    
                    await xpHandler.addRoleReward(
                        interaction.guild.id,
                        level,
                        role!.id,
                        removePrevious
                    );
                    
                    await interaction.reply({
                        content: i18n.t('xp.roleRewardSet', { 
                            level,
                            role: role!.toString()
                        }),
                        ephemeral: true
                    });
                    break;
                }
                
                case 'reset-user': {
                    const user = interaction.options.getUser('user');
                    
                    await xpHandler.resetUserXP(user!.id, interaction.guild.id);
                    
                    await interaction.reply({
                        content: i18n.t('xp.userReset', { user: user!.toString() }),
                        ephemeral: true
                    });
                    break;
                }
            }
        } catch (error) {
            console.error('Error in xpconfig command:', error);
            await interaction.reply({
                content: i18n.t('errors.generic'),
                ephemeral: true
            });
        }
    }
};