import { ClientWithCommands, Feature } from '../../types';
import { getGuildSettings } from '../../utils/guildSettings';
import { Events, MessageReaction, User, PartialMessageReaction, PartialUser, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';

const activePolls = new Map<string, { messageId: string, options: string[], votes: Map<string, string[]>, multiple: boolean, anonymous: boolean, creatorId: string, endsAt?: number }>();

const pollsFeature: Feature = {
  name: 'polls',
  description: 'Ermöglicht Benutzern das Erstellen und Teilnehmen an Umfragen.',
  enabled: true,
  async initialize(client: ClientWithCommands) {
    if (!client.config.enabledFeatures.polls) {
      return;
    }

    client.on(Events.InteractionCreate, async interaction => {
      if (!interaction.isButton() || !interaction.guildId) return;
      if (!interaction.customId.startsWith('poll_')) return;

      const guildSettings = await getGuildSettings(interaction.guildId, client);
      if (!guildSettings.enablePolls) return;

      const parts = interaction.customId.split('_');
      const pollMessageId = parts[1];
      const optionIndex = parseInt(parts[2]);

      const pollData = activePolls.get(pollMessageId);
      if (!pollData) {
        await interaction.reply({ content: 'Diese Umfrage ist nicht mehr aktiv oder wurde nicht gefunden.', ephemeral: true });
        return;
      }
      
      if (pollData.endsAt && Date.now() > pollData.endsAt) {
        await interaction.reply({ content: 'Diese Umfrage ist bereits beendet.', ephemeral: true });
        return;
      }

      const userId = interaction.user.id;
      const selectedOption = pollData.options[optionIndex];

      if (!pollData.votes.has(selectedOption)) {
        pollData.votes.set(selectedOption, []);
      }

      let alreadyVotedForThisOption = pollData.votes.get(selectedOption)!.includes(userId);
      let userPreviousVotes: string[] = [];
      pollData.votes.forEach((voters, option) => {
        if (voters.includes(userId)) {
            userPreviousVotes.push(option);
        }
      });


      if (pollData.multiple) {
        if (alreadyVotedForThisOption) {
          pollData.votes.set(selectedOption, pollData.votes.get(selectedOption)!.filter(id => id !== userId));
        } else {
          pollData.votes.get(selectedOption)!.push(userId);
        }
      } else {
        // Remove previous vote if any
        userPreviousVotes.forEach(prevOption => {
            pollData.votes.set(prevOption, pollData.votes.get(prevOption)!.filter(id => id !== userId));
        });
        // Add new vote, unless it's unvoting the same option
        if (!alreadyVotedForThisOption) {
            pollData.votes.get(selectedOption)!.push(userId);
        }
      }
      activePolls.set(pollMessageId, pollData);

      const pollMessage = await interaction.channel?.messages.fetch(pollMessageId).catch(() => null);
      if (pollMessage && pollMessage.embeds.length > 0) {
        const originalEmbed = pollMessage.embeds[0];
        const newEmbed = EmbedBuilder.from(originalEmbed);
        
        const fields = pollData.options.map((opt, index) => {
          const voteCount = pollData.votes.get(opt)?.length || 0;
          const voters = pollData.votes.get(opt) || [];
          let votersDisplay = "";
          if (!pollData.anonymous && voteCount > 0) {
            votersDisplay = ` (${voters.slice(0, 3).map(uid => `<@${uid}>`).join(', ')}${voters.length > 3 ? ` und ${voters.length-3} weitere` : ''})`;
          }
          return { name: `${getEmojiForIndex(index)} ${opt} (${voteCount} Stimme${voteCount === 1 ? '' : 'n'}) ${votersDisplay}`, value: ` `, inline: false };
        });
        newEmbed.setFields(fields);

        await pollMessage.edit({ embeds: [newEmbed] });
      }
      await interaction.reply({ content: `Deine Stimme für "${selectedOption}" wurde ${alreadyVotedForThisOption && !pollData.multiple ? 'entfernt' : (alreadyVotedForThisOption && pollData.multiple ? 'entfernt' : 'gezählt')}.`, ephemeral: true });
    });
  },
};

function getEmojiForIndex(index: number): string {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    return emojis[index] || '☑️';
}

export function getActivePoll(messageId: string) {
    return activePolls.get(messageId);
}

export function setActivePoll(messageId: string, data: any) {
    activePolls.set(messageId, data);
}

export function removeActivePoll(messageId: string) {
    activePolls.delete(messageId);
}


export default pollsFeature;