// src/events/interactionCreate.ts - Behandelt Slash-Befehl-Interaktionen
import { Events, Interaction } from 'discord.js';
import { ClientWithCommands, Event, SlashCommand } from '../types'; // ClientWithCommands verwenden
import { handleCooldown } from '../utils/cooldown'; // Cooldown-Helfer importieren

const event: Event<typeof Events.InteractionCreate> = {
  name: Events.InteractionCreate,
  async execute(client: ClientWithCommands, interaction: Interaction) { // Client als erstes Argument
    // Behandelt Slash-Befehle
    if (interaction.isChatInputCommand()) {
      const command = client.slashCommands.get(interaction.commandName) as SlashCommand | undefined;

      if (!command) {
        console.error(`Kein Befehl passend zu ${interaction.commandName} gefunden.`);
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

      // Prüft auf devOnly-Befehle
      if (command.devOnly && !client.config.devUsers.includes(interaction.user.id)) {
        await interaction.reply({
          content: '⚠️ Dieser Befehl kann nur von Bot-Entwicklern verwendet werden.',
          ephemeral: true,
        });
        return;
      }
      
      // Prüft auf testOnly-Befehle (nur in devGuilds)
      if (command.testOnly && !client.config.devGuilds.includes(interaction.guildId || '')) {
        await interaction.reply({
          content: '⚠️ Dieser Befehl ist nur auf Test-Servern verfügbar.',
          ephemeral: true,
        });
        return;
      }

      // Handhabt Befehls-Cooldowns
      const cooldownResult = handleCooldown({
        userId: interaction.user.id,
        commandName: interaction.commandName,
        cooldownAmount: command.cooldown || 0, // Standard-Cooldown von 0, falls nicht definiert
      }, client);

      if (cooldownResult.onCooldown) {
        await interaction.reply({
          content: `⏱️ Bitte warte noch ${cooldownResult.remainingTime.toFixed(1)} Sekunden, bevor du diesen Befehl erneut verwendest.`,
          ephemeral: true,
        });
        return;
      }

      try {
        // Führt den Befehl aus
        await command.execute(interaction, client);
      } catch (error) {
        console.error(`Fehler beim Ausführen des Befehls ${interaction.commandName}:`, error);
        const errorMessage = ' Beim Ausführen dieses Befehls ist ein interner Fehler aufgetreten.';

        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({
            content: errorMessage,
            ephemeral: true,
          }).catch(followUpError => console.error("Fehler beim Follow-Up:", followUpError));
        } else {
          await interaction.reply({
            content: errorMessage,
            ephemeral: true,
          }).catch(replyError => console.error("Fehler beim Reply:", replyError));
        }
      }
    }
    // Hier könnten andere Interaktionstypen behandelt werden (Buttons, Select-Menüs, Modals)
    // else if (interaction.isButton()) { ... }
    // else if (interaction.isStringSelectMenu()) { ... }
    // else if (interaction.isModalSubmit()) { ... }
  }
};

export default event;
