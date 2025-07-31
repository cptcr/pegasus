import { Client, Interaction } from 'discord.js';
import { handleLeaderboardButton } from '../interactions/buttons/xpLeaderboard';
import { 
    handleGiveawayEnter, 
    handleGiveawayLeave, 
    handleGiveawayToggle, 
    handleGiveawayInfo 
} from '../interactions/buttons/giveawayButtons';
import { 
    handleGiveawayConfirmEnd, 
    handleGiveawayConfirmCancel, 
    handleGiveawayCancelAction, 
    handleGiveawayEntriesExport,
    handleGiveawayConfirmReroll
} from '../interactions/buttons/giveawayConfirmations';
import { handleGiveawayManagement } from '../interactions/selectMenus/giveawayManagement';
import { 
    handleGiveawayEditModal, 
    handleGiveawayRerollModal, 
    handleGiveawayRequirementsModal, 
    handleGiveawayManageEntriesModal 
} from '../interactions/modals/giveawayModals';
import { logger } from '../utils/logger';

export class InteractionHandler {
    private client: Client;
    
    constructor(client: Client) {
        this.client = client;
        this.setupEventListeners();
    }
    
    private setupEventListeners(): void {
        this.client.on('interactionCreate', this.handleInteraction.bind(this));
    }
    
    private async handleInteraction(interaction: Interaction): Promise<void> {
        try {
            // Handle slash commands
            if (interaction.isChatInputCommand()) {
                const command = this.client.commandHandler?.commands.get(interaction.commandName);
                
                if (!command) {
                    logger.warn(`Unknown command: ${interaction.commandName}`);
                    return;
                }
                
                await command.execute(interaction);
            }
            
            // Handle button interactions
            else if (interaction.isButton()) {
                // XP Leaderboard navigation
                if (interaction.customId.startsWith('leaderboard_')) {
                    await handleLeaderboardButton(interaction);
                }
                // Giveaway entry buttons
                else if (interaction.customId.startsWith('giveaway_enter_')) {
                    await handleGiveawayEnter(interaction);
                }
                else if (interaction.customId.startsWith('giveaway_leave_')) {
                    await handleGiveawayLeave(interaction);
                }
                else if (interaction.customId.startsWith('giveaway_toggle_')) {
                    await handleGiveawayToggle(interaction);
                }
                else if (interaction.customId.startsWith('giveaway_info_')) {
                    await handleGiveawayInfo(interaction);
                }
                // Giveaway confirmation buttons
                else if (interaction.customId.startsWith('giveaway_confirm_end_')) {
                    await handleGiveawayConfirmEnd(interaction);
                }
                else if (interaction.customId.startsWith('giveaway_confirm_cancel_')) {
                    await handleGiveawayConfirmCancel(interaction);
                }
                else if (interaction.customId.startsWith('giveaway_cancel_action_')) {
                    await handleGiveawayCancelAction(interaction);
                }
                else if (interaction.customId.startsWith('giveaway_entries_export_')) {
                    await handleGiveawayEntriesExport(interaction);
                }
                else if (interaction.customId.startsWith('giveaway_confirm_reroll_')) {
                    await handleGiveawayConfirmReroll(interaction);
                }
                // Add more button handlers here
            }
            
            // Handle select menu interactions
            else if (interaction.isStringSelectMenu()) {
                // Giveaway management select menus
                if (interaction.customId.startsWith('giveaway_manage_')) {
                    await handleGiveawayManagement(interaction);
                }
                // Add more select menu handlers here
            }
            
            // Handle modal submissions
            else if (interaction.isModalSubmit()) {
                // Giveaway modals
                if (interaction.customId.startsWith('giveaway_edit_modal_')) {
                    await handleGiveawayEditModal(interaction);
                }
                else if (interaction.customId.startsWith('giveaway_reroll_modal_')) {
                    await handleGiveawayRerollModal(interaction);
                }
                else if (interaction.customId.startsWith('giveaway_requirements_modal_')) {
                    await handleGiveawayRequirementsModal(interaction);
                }
                else if (interaction.customId.startsWith('giveaway_manage_entries_modal_')) {
                    await handleGiveawayManageEntriesModal(interaction);
                }
                // Add more modal handlers here
            }
            
            // Handle autocomplete
            else if (interaction.isAutocomplete()) {
                const command = this.client.commandHandler?.commands.get(interaction.commandName);
                
                if (!command || !command.autocomplete) {
                    return;
                }
                
                await command.autocomplete(interaction);
            }
            
        } catch (error) {
            logger.error('Error handling interaction:', error);
            
            if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'There was an error while executing this interaction!',
                    ephemeral: true
                }).catch(() => {});
            }
        }
    }
}