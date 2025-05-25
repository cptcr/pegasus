import { Events, Interaction, ChatInputCommandInteraction } from 'discord.js';
import { ClientWithCommands, Event, SlashCommand } from '../types';
import { handleCooldown } from '../utils/cooldown';

const event: Event<typeof Events.InteractionCreate> = {
  name: Events.InteractionCreate,
  async execute(client: ClientWithCommands, interaction: Interaction) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.slashCommands.get(interaction.commandName) as SlashCommand | undefined;

    if (!command) {
      try {
        await interaction.reply({
          content: '❌ Dieser Befehl existiert nicht oder ist nicht mehr verfügbar.',
          ephemeral: true,
        });
      } catch (replyError) {
        console.error('Fehler beim Antworten auf unbekannten Befehl:', replyError);
      }
      return;
    }

    if (command.devOnly && !client.config.devUsers.includes(interaction.user.id)) {
      await interaction.reply({
        content: '⚠️ Dieser Befehl kann nur von Bot-Entwicklern verwendet werden.',
        ephemeral: true,
      });
      return;
    }
    
    if (command.testOnly && (!interaction.guildId || !client.config.devGuilds.includes(interaction.guildId))) {
      await interaction.reply({
        content: '⚠️ Dieser Befehl ist nur auf Test-Servern verfügbar.',
        ephemeral: true,
      });
      return;
    }

    const cooldownResult = handleCooldown({
      userId: interaction.user.id,
      commandName: interaction.commandName + (interaction.options.getSubcommand(false) ? `_${interaction.options.getSubcommand(false)}` : ''), // Cooldown per subcommand
      cooldownAmount: command.cooldown || 0,
    }, client);

    if (cooldownResult.onCooldown) {
      await interaction.reply({
        content: `⏱️ Bitte warte noch ${cooldownResult.remainingTime.toFixed(1)} Sekunden, bevor du diesen Befehl erneut verwendest.`,
        ephemeral: true,
      });
      return;
    }

    try {
      // The command's execute function is now responsible for handling subcommands
      await command.execute(interaction, client);
    } catch (error) {
      console.error(`Fehler beim Ausführen des Befehls ${interaction.commandName}:`, error);
      const errorMessage = 'Beim Ausführen dieses Befehls ist ein interner Fehler aufgetreten.';

      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: errorMessage,
          ephemeral: true,
        }).catch(console.error);
      } else {
        await interaction.reply({
          content: errorMessage,
          ephemeral: true,
        }).catch(console.error);
      }
    }
  }
};

export default event;