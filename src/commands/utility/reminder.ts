import { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  CommandInteraction, 
  ActionRowBuilder, 
  StringSelectMenuBuilder, 
  ComponentType 
} from 'discord.js';
import { reminders } from '../../handlers/reminders';
import { i18n } from '../../i18n';

export const data = new SlashCommandBuilder()
  .setName('reminder')
  .setDescription('Manage your reminders')
  .addSubcommand(subcommand =>
    subcommand
      .setName('set')
      .setDescription('Set a new reminder')
      .addStringOption(option =>
        option
          .setName('time')
          .setDescription('When to remind you (e.g., 1h30m, 2d, 30s)')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('message')
          .setDescription('What to remind you about')
          .setRequired(true)
      )
      .addBooleanOption(option =>
        option
          .setName('here')
          .setDescription('Send reminder in this channel instead of DM')
          .setRequired(false)
      )
      .addBooleanOption(option =>
        option
          .setName('repeat')
          .setDescription('Make this a repeating reminder')
          .setRequired(false)
      )
      .addStringOption(option =>
        option
          .setName('interval')
          .setDescription('How often to repeat (only if repeat is true)')
          .setRequired(false)
      )
      .addIntegerOption(option =>
        option
          .setName('max-repeats')
          .setDescription('Maximum number of times to repeat (unlimited if not set)')
          .setMinValue(1)
          .setMaxValue(100)
          .setRequired(false)
      )
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('list')
      .setDescription('List your active reminders')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('cancel')
      .setDescription('Cancel a reminder')
      .addStringOption(option =>
        option
          .setName('reminder-id')
          .setDescription('ID of the reminder to cancel (use /reminder list to see IDs)')
          .setRequired(false)
      )
  );

export async function execute(interaction: any) {
  const t = i18n.createTranslator(interaction.user.id, interaction.guildId || undefined);
  const subcommand = interaction.options.getSubcommand();

  try {
    switch (subcommand) {
      case 'set':
        await handleSetReminder(interaction, t);
        break;
      case 'list':
        await handleListReminders(interaction, t);
        break;
      case 'cancel':
        await handleCancelReminder(interaction, t);
        break;
      default:
        await interaction.reply({
          content: t('errors.invalid_arguments'),
          ephemeral: true
        });
    }
  } catch (error) {
    console.error('Reminder command error:', error);
    
    const content = interaction.replied || interaction.deferred 
      ? { content: t('errors.generic') }
      : { content: t('errors.generic'), ephemeral: true };
    
    if (interaction.replied) {
      await interaction.followUp(content);
    } else if (interaction.deferred) {
      await interaction.editReply(content);
    } else {
      await interaction.reply(content);
    }
  }
}

async function handleSetReminder(interaction: any, t: Function) {
  const time = interaction.options.get('time')?.value as string;
  const message = interaction.options.get('message')?.value as string;
  const here = interaction.options.get('here')?.value as boolean;
  const repeat = interaction.options.get('repeat')?.value as boolean;
  const interval = interaction.options.get('interval')?.value as string;
  const maxRepeats = interaction.options.get('max-repeats')?.value as number;

  if (repeat && !interval) {
    await interaction.reply({
      content: 'You must specify an interval when creating a repeating reminder.',
      ephemeral: true
    });
    return;
  }

  const result = await reminders.createReminder({
    userId: interaction.user.id,
    guildId: interaction.guildId || undefined,
    channelId: here ? interaction.channelId : undefined,
    message,
    duration: time,
    repeating: repeat || false,
    interval: interval || undefined,
    maxRepeats: maxRepeats || undefined
  });

  if (result.success) {
    const embed = new EmbedBuilder()
      .setTitle('⏰ Reminder Set')
      .setDescription(result.message)
      .setColor(0x00ff00)
      .addFields(
        { name: 'Message', value: message, inline: false },
        { name: 'Duration', value: time, inline: true },
        { name: 'Location', value: here ? 'This channel' : 'Direct message', inline: true }
      );

    if (repeat) {
      embed.addFields(
        { name: 'Repeating', value: `Every ${interval}`, inline: true }
      );
      
      if (maxRepeats) {
        embed.addFields(
          { name: 'Max Repeats', value: maxRepeats.toString(), inline: true }
        );
      }
    }

    if (result.reminderId) {
      embed.setFooter({ text: `Reminder ID: ${result.reminderId}` });
    }

    await interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  } else {
    await interaction.reply({
      content: result.message,
      ephemeral: true
    });
  }
}

async function handleListReminders(interaction: any, t: Function) {
  await interaction.deferReply({ ephemeral: true });

  const userReminders = await reminders.getUserReminders(
    interaction.user.id, 
    interaction.guildId || undefined
  );

  if (userReminders.length === 0) {
    await interaction.editReply({
      content: t('reminders.no_reminders')
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(t('reminders.list_title'))
    .setColor(0x0099ff)
    .setDescription(`You have ${userReminders.length} active reminder${userReminders.length > 1 ? 's' : ''}`);

  const now = new Date();
  
  for (let i = 0; i < Math.min(userReminders.length, 10); i++) {
    const reminder = userReminders[i];
    const timeUntil = reminder.remindAt.getTime() - now.getTime();
    const timeString = timeUntil > 0 ? formatTimeUntil(timeUntil) : 'Due now';
    
    let fieldValue = `**Due:** ${timeString}\n**Message:** ${reminder.message}`;
    
    if (reminder.repeating) {
      fieldValue += `\n**Repeating:** Every ${formatDuration(reminder.interval || 0)}`;
      if (reminder.maxRepeats) {
        fieldValue += ` (${reminder.currentRepeats}/${reminder.maxRepeats})`;
      }
    }

    fieldValue += `\n**Location:** ${reminder.channelId ? 'Channel' : 'DM'}`;

    embed.addFields({
      name: `Reminder ${i + 1}`,
      value: fieldValue,
      inline: false
    });
  }

  if (userReminders.length > 10) {
    embed.setFooter({ 
      text: `Showing 10 of ${userReminders.length} reminders. Use ID to cancel specific reminders.` 
    });
  }

  await interaction.editReply({ embeds: [embed] });
}

async function handleCancelReminder(interaction: any, t: Function) {
  const reminderId = interaction.options.get('reminder-id')?.value as string;

  if (reminderId) {
    // Cancel specific reminder
    const result = await reminders.cancelReminder(reminderId, interaction.user.id);
    
    await interaction.reply({
      content: result.message,
      ephemeral: true
    });
    return;
  }

  // Show selection menu for reminders
  await interaction.deferReply({ ephemeral: true });

  const userReminders = await reminders.getUserReminders(
    interaction.user.id,
    interaction.guildId || undefined
  );

  if (userReminders.length === 0) {
    await interaction.editReply({
      content: t('reminders.no_reminders')
    });
    return;
  }

  const options = userReminders.slice(0, 25).map((reminder, index) => {
    const timeUntil = reminder.remindAt.getTime() - Date.now();
    const timeString = timeUntil > 0 ? formatTimeUntil(timeUntil) : 'Due now';
    
    return {
      label: `Reminder ${index + 1}`,
      value: reminder.id,
      description: `${reminder.message.substring(0, 80)}... - Due ${timeString}`.substring(0, 100)
    };
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('cancel_reminder')
    .setPlaceholder('Select a reminder to cancel')
    .addOptions(options);

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  const response = await interaction.editReply({
    content: 'Select a reminder to cancel:',
    components: [row]
  });

  const collector = response.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    time: 60000
  });

  collector.on('collect', async (selectInteraction: any) => {
    if (selectInteraction.user.id !== interaction.user.id) {
      await selectInteraction.reply({
        content: t('errors.permission_denied'),
        ephemeral: true
      });
      return;
    }

    await selectInteraction.deferUpdate();
    
    const reminderIdToCancel = selectInteraction.values[0];
    const result = await reminders.cancelReminder(reminderIdToCancel, interaction.user.id);
    
    await selectInteraction.editReply({
      content: result.message,
      components: []
    });
  });

  collector.on('end', async (collected: any) => {
    if (collected.size === 0) {
      try {
        await interaction.editReply({
          content: 'Reminder cancellation timed out.',
          components: []
        });
      } catch (error) {
        // Interaction might have been already updated
      }
    }
  });
}

function formatTimeUntil(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}`;
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`;
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  } else {
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
  }
}