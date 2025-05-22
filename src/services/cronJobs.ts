import cron from 'node-cron';
import { DatabaseService } from '../lib/database';
import { geizhalsTracker } from './geizhalsTracker';
import { cleanupTempChannels } from '../events/joinToCreateHandler';
import { client } from '../index';
import { EmbedBuilder, TextChannel } from 'discord.js';

export function startCronJobs() {
  console.log('⏰ Starte Cron Jobs...');

  // Alle 30 Minuten - Geizhals Preisüberprüfung
  cron.schedule('*/30 * * * *', async () => {
    console.log('🔍 Führe Geizhals Preisüberprüfung aus...');
    await geizhalsTracker.checkAllTrackers();
  });

  // Täglich um 8:00 - Geizhals Daily Deals
  cron.schedule('0 8 * * *', async () => {
    console.log('🔥 Sende tägliche Geizhals Deals...');
    await geizhalsTracker.sendDailyDeals();
  });

  // Alle 15 Minuten - Abgelaufene Polls beenden
  cron.schedule('*/15 * * * *', async () => {
    console.log('📊 Überprüfe abgelaufene Polls...');
    await checkExpiredPolls();
  });

  // Alle 10 Minuten - Abgelaufene Giveaways beenden
  cron.schedule('*/10 * * * *', async () => {
    console.log('🎉 Überprüfe abgelaufene Giveaways...');
    await checkExpiredGiveaways();
  });

  // Alle 5 Minuten - Cleanup temporärer Voice Channels
  cron.schedule('*/5 * * * *', async () => {
    console.log('🧹 Cleanup temporärer Voice Channels...');
    await cleanupTempChannels();
  });

  // Täglich um 2:00 - Monatliche Stats aktualisieren
  cron.schedule('0 2 * * *', async () => {
    console.log('📈 Aktualisiere monatliche Statistiken...');
    await updateMonthlyStats();
  });

  // Wöchentlich Sonntag um 3:00 - Alte Daten cleanup
  cron.schedule('0 3 * * 0', async () => {
    console.log('🗑️ Führe wöchentliches Cleanup aus...');
    await weeklyCleanup();
  });

  // Täglich um 4:00 - Database maintenance
  cron.schedule('0 4 * * *', async () => {
    console.log('🔧 Führe Database Maintenance aus...');
    await databaseMaintenance();
  });

  console.log('✅ Alle Cron Jobs gestartet');
}

async function checkExpiredPolls() {
  try {
    const expiredPolls = await DatabaseService.cleanupExpiredPolls();
    
    for (const poll of expiredPolls) {
      try {
        // Ergebnisse berechnen
        const results = await DatabaseService.getPollResults(poll.id);
        const totalVotes = results.reduce((sum, result) => sum + result.votes, 0);

        // Channel für Ergebnisse finden
        const channel = await client.channels.fetch(poll.channelId).catch(() => null) as TextChannel;
        if (!channel) continue;

        // Ergebnisse-Embed erstellen
        const embed = new EmbedBuilder()
          .setColor(0x95a5a6)
          .setTitle(`📊 Umfrage beendet: ${poll.title}`)
          .setDescription(`Die Umfrage wurde automatisch beendet.`)
          .setTimestamp();

        if (results.length > 0 && totalVotes > 0) {
          embed.addFields({
            name: '📊 Endergebnisse',
            value: results.map(result => {
              const percentage = Math.round((result.votes / totalVotes) * 100);
              const bar = '█'.repeat(Math.floor(percentage / 10)) + '░'.repeat(10 - Math.floor(percentage / 10));
              return `${result.emoji} **${result.text}**\n${bar} ${result.votes} (${percentage}%)`;
            }).join('\n\n'),
            inline: false
          });
          
          embed.addFields({
            name: '📈 Statistiken',
            value: `Gesamtstimmen: ${totalVotes}`,
            inline: true
          });
        } else {
          embed.addFields({
            name: '😔 Keine Stimmen',
            value: 'Es wurden keine Stimmen abgegeben.',
            inline: false
          });
        }

        await channel.send({ embeds: [embed] });

        // Original Poll Message aktualisieren
        if (poll.messageId) {
          try {
            const originalMessage = await channel.messages.fetch(poll.messageId);
            const updatedEmbed = EmbedBuilder.from(originalMessage.embeds[0])
              .setColor(0x95a5a6)
              .setTitle(`📊 ${poll.title} [BEENDET]`);
            
            await originalMessage.edit({
              embeds: [updatedEmbed],
              components: [] // Buttons entfernen
            });
          } catch (error) {
            console.error('Fehler beim Aktualisieren der Poll-Message:', error);
          }
        }

      } catch (error) {
        console.error(`Fehler beim Beenden der Poll ${poll.id}:`, error);
      }
    }

    if (expiredPolls.length > 0) {
      console.log(`✅ ${expiredPolls.length} abgelaufene Poll(s) beendet`);
    }

  } catch (error) {
    console.error('Fehler beim Überprüfen abgelaufener Polls:', error);
  }
}

async function checkExpiredGiveaways() {
  try {
    const expiredGiveaways = await DatabaseService.cleanupExpiredGiveaways();
    
    for (const giveaway of expiredGiveaways) {
      try {
        // Gewinner auslosen
        const winners = await DatabaseService.drawGiveawayWinners(giveaway.id);
        
        // Channel finden
        const channel = await client.channels.fetch(giveaway.channelId).catch(() => null) as TextChannel;
        if (!channel) continue;

        // Ergebnisse-Embed erstellen
        const embed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('🎉 Giveaway beendet!')
          .setDescription(`Das Giveaway für **${giveaway.prize}** wurde automatisch beendet.`)
          .setTimestamp();

        if (winners.length > 0) {
          embed.addFields({
            name: '🏆 Gewinner',
            value: winners.map(winner => `<@${winner.userId}>`).join('\n'),
            inline: false
          });
          
          embed.addFields({
            name: '📊 Statistiken',
            value: `Teilnehmer: ${giveaway.entries.length}\nGewinner: ${winners.length}`,
            inline: true
          });

          // Gewinner benachrichtigen
          for (const winner of winners) {
            try {
              const user = await client.users.fetch(winner.userId);
              const guild = await client.guilds.fetch(giveaway.guildId);
              
              const dmEmbed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setTitle('🎉 Glückwunsch!')
                .setDescription(`Du hast das Giveaway auf **${guild.name}** gewonnen!`)
                .addFields({
                  name: '🎁 Gewinn',
                  value: giveaway.prize,
                  inline: true
                })
                .setTimestamp();

              await user.send({ embeds: [dmEmbed] });
            } catch (error) {
              console.error(`Fehler beim Benachrichtigen von Gewinner ${winner.userId}:`, error);
            }
          }

        } else {
          embed.addFields({
            name: '😔 Keine Gewinner',
            value: 'Es gab nicht genügend gültige Teilnehmer.',
            inline: false
          });
        }

        await channel.send({ embeds: [embed] });

        // Original Giveaway Message aktualisieren
        if (giveaway.messageId) {
          try {
            const originalMessage = await channel.messages.fetch(giveaway.messageId);
            const updatedEmbed = EmbedBuilder.from(originalMessage.embeds[0])
              .setColor(0x95a5a6)
              .setTitle(`${giveaway.title} [BEENDET]`);

            if (winners.length > 0) {
              updatedEmbed.addFields({
                name: '🏆 Gewinner',
                value: winners.map(winner => `<@${winner.userId}>`).join('\n'),
                inline: false
              });
            }
            
            await originalMessage.edit({
              embeds: [updatedEmbed],
              components: [] // Buttons entfernen
            });
          } catch (error) {
            console.error('Fehler beim Aktualisieren der Giveaway-Message:', error);
          }
        }

      } catch (error) {
        console.error(`Fehler beim Beenden des Giveaways ${giveaway.id}:`, error);
      }
    }

    if (expiredGiveaways.length > 0) {
      console.log(`✅ ${expiredGiveaways.length} abgelaufene Giveaway(s) beendet`);
    }

  } catch (error) {
    console.error('Fehler beim Überprüfen abgelaufener Giveaways:', error);
  }
}

async function updateMonthlyStats() {
  try {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Alle Guilds mit Level-System abrufen
    const guilds = await DatabaseService.prisma.guild.findMany({
      where: { enableLeveling: true },
      include: {
        userLevels: {
          where: {
            lastMessageTime: {
              gte: new Date(currentYear, currentMonth - 1, 1), // Anfang des Monats
            },
          },
        },
      },
    });

    let updatedStats = 0;

    for (const guild of guilds) {
      for (const userLevel of guild.userLevels) {
        // Monatliche Stats berechnen (vereinfacht)
        const monthlyXP = Math.floor(userLevel.xp * 0.1); // 10% des Gesamt-XP als monatlicher Beitrag
        const monthlyMessages = Math.floor(userLevel.messages * 0.1);
        const monthlyVoiceTime = Math.floor(userLevel.voiceTime * 0.1);

        await DatabaseService.updateMonthlyStats(
          userLevel.userId,
          guild.id,
          monthlyXP,
          monthlyMessages,
          monthlyVoiceTime
        );

        updatedStats++;
      }
    }

    console.log(`✅ ${updatedStats} monatliche Statistiken aktualisiert`);

  } catch (error) {
    console.error('Fehler beim Aktualisieren der monatlichen Statistiken:', error);
  }
}

async function weeklyCleanup() {
  try {
    let cleanupCount = 0;

    // Alte monatliche Stats löschen (älter als 12 Monate)
    const oldStats = await DatabaseService.cleanupOldMonthlyStats(12);
    cleanupCount += oldStats.count || 0;

    // Inaktive Warnungen löschen (älter als 6 Monate)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const oldWarns = await DatabaseService.prisma.warn.deleteMany({
      where: {
        active: false,
        updatedAt: {
          lt: sixMonthsAgo,
        },
      },
    });
    cleanupCount += oldWarns.count;

    // Inaktive Quarantäne-Einträge löschen
    const oldQuarantine = await DatabaseService.prisma.quarantineEntry.deleteMany({
      where: {
        active: false,
        updatedAt: {
          lt: sixMonthsAgo,
        },
      },
    });
    cleanupCount += oldQuarantine.count;

    // Beendete Polls löschen (älter als 30 Tage)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const oldPolls = await DatabaseService.prisma.poll.deleteMany({
      where: {
        active: false,
        updatedAt: {
          lt: thirtyDaysAgo,
        },
      },
    });
    cleanupCount += oldPolls.count;

    // Beendete Giveaways löschen (älter als 30 Tage)
    const oldGiveaways = await DatabaseService.prisma.giveaway.deleteMany({
      where: {
        ended: true,
        updatedAt: {
          lt: thirtyDaysAgo,
        },
      },
    });
    cleanupCount += oldGiveaways.count;

    // Geschlossene Tickets löschen (älter als 30 Tage)
    const oldTickets = await DatabaseService.prisma.ticket.deleteMany({
      where: {
        status: 'CLOSED',
        closedAt: {
          lt: thirtyDaysAgo,
        },
      },
    });
    cleanupCount += oldTickets.count;

    console.log(`✅ Wöchentliches Cleanup abgeschlossen: ${cleanupCount} Einträge entfernt`);

  } catch (error) {
    console.error('Fehler beim wöchentlichen Cleanup:', error);
  }
}

async function databaseMaintenance() {
  try {
    // Verwaiste temporäre Channels aus der Datenbank entfernen
    const tempChannels = await DatabaseService.prisma.tempVoiceChannel.findMany();
    let removedChannels = 0;

    for (const tempChannel of tempChannels) {
      try {
        // Versuche Channel zu finden
        const channel = await client.channels.fetch(tempChannel.channelId).catch(() => null);
        if (!channel) {
          await DatabaseService.deleteTempChannel(tempChannel.channelId);
          removedChannels++;
        }
      } catch (error) {
        await DatabaseService.deleteTempChannel(tempChannel.channelId);
        removedChannels++;
      }
    }

    // Verwaiste Tracker für nicht mehr existierende Guilds entfernen
    const allTrackers = await DatabaseService.prisma.geizhalsTracker.findMany({
      include: { guild: true },
    });

    let removedTrackers = 0;
    for (const tracker of allTrackers) {
      try {
        const guild = await client.guilds.fetch(tracker.guildId).catch(() => null);
        if (!guild) {
          await DatabaseService.removeGeizhalsTracker(tracker.id);
          removedTrackers++;
        }
      } catch (error) {
        await DatabaseService.removeGeizhalsTracker(tracker.id);
        removedTrackers++;
      }
    }

    // Verwaiste User Level Einträge für nicht mehr existierende Guilds
    const allUserLevels = await DatabaseService.prisma.userLevel.findMany({
      include: { guild: true },
    });

    let removedUserLevels = 0;
    for (const userLevel of allUserLevels) {
      try {
        const guild = await client.guilds.fetch(userLevel.guildId).catch(() => null);
        if (!guild) {
          await DatabaseService.prisma.userLevel.delete({
            where: { id: userLevel.id },
          });
          removedUserLevels++;
        }
      } catch (error) {
        // Guild existiert nicht mehr
        await DatabaseService.prisma.userLevel.delete({
          where: { id: userLevel.id },
        });
        removedUserLevels++;
      }
    }

    // Database-Statistiken optimieren (PostgreSQL spezifisch)
    try {
      await DatabaseService.prisma.$executeRaw`ANALYZE;`;
    } catch (error) {
      // Ignoriere Fehler bei ANALYZE
    }

    console.log(`✅ Database Maintenance abgeschlossen:`);
    console.log(`   - ${removedChannels} verwaiste Temp-Channels entfernt`);
    console.log(`   - ${removedTrackers} verwaiste Tracker entfernt`);
    console.log(`   - ${removedUserLevels} verwaiste User-Level entfernt`);

  } catch (error) {
    console.error('Fehler bei Database Maintenance:', error);
  }
}

// Performance Monitoring
export function startPerformanceMonitoring() {
  // Memory Usage Monitoring
  setInterval(() => {
    const memUsage = process.memoryUsage();
    const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const memTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
    
    if (memUsedMB > 500) { // Warnung bei über 500MB
      console.log(`⚠️ Hoher RAM-Verbrauch: ${memUsedMB}MB / ${memTotalMB}MB`);
    }

    // Garbage Collection forcieren wenn Speicher über 800MB
    if (memUsedMB > 800 && global.gc) {
      global.gc();
      console.log('🗑️ Garbage Collection ausgeführt');
    }
  }, 300000); // Alle 5 Minuten

  // Database Connection Monitoring
  setInterval(async () => {
    try {
      await DatabaseService.prisma.$queryRaw`SELECT 1;`;
    } catch (error) {
      console.error('❌ Database Connection Error:', error);
      // Versuche Reconnect
      try {
        await DatabaseService.prisma.$disconnect();
        await DatabaseService.prisma.$connect();
        console.log('✅ Database Reconnect erfolgreich');
      } catch (reconnectError) {
        console.error('❌ Database Reconnect fehlgeschlagen:', reconnectError);
      }
    }
  }, 600000); // Alle 10 Minuten

  console.log('📊 Performance Monitoring gestartet');
}

// Cleanup bei Process Exit
process.on('SIGINT', async () => {
  console.log('🛑 Shutdown Signal erhalten, führe Cleanup aus...');
  
  try {
    // Alle temporären Channels löschen
    await cleanupTempChannels();
    
    // Database Connection schließen
    await DatabaseService.disconnect();
    
    console.log('✅ Cleanup abgeschlossen');
  } catch (error) {
    console.error('❌ Fehler beim Cleanup:', error);
  }
  
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Terminate Signal erhalten, führe Cleanup aus...');
  
  try {
    await DatabaseService.disconnect();
    console.log('✅ Graceful Shutdown abgeschlossen');
  } catch (error) {
    console.error('❌ Fehler beim Graceful Shutdown:', error);
  }
  
  process.exit(0);
});