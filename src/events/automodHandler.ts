import { Events, Message, GuildMember } from 'discord.js';
import { DatabaseService } from '../lib/database';

const userMessageCounts = new Map<string, { count: number; timestamp: number; messages: string[] }>();
const userViolations = new Map<string, { count: number; lastViolation: number }>();

export const messageCreate = {
  name: Events.MessageCreate,
  async execute(message: Message) {
    // Ignore bots und System-Nachrichten
    if (message.author.bot || !message.guild || !message.content) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const member = message.member as GuildMember;

    try {
      // Guild-Einstellungen prüfen
      const guildSettings = await DatabaseService.getGuildSettings(guildId);
      if (!guildSettings.enableAutomod) return;

      // Automod-Regeln abrufen
      const rules = await DatabaseService.getAutomodRules(guildId);
      if (rules.length === 0) return;

      // Für jede Regel prüfen
      for (const rule of rules) {
        if (!rule.enabled) continue;

        // Exempt Roles prüfen
        if (rule.exemptRoles && rule.exemptRoles.some(roleId => member.roles.cache.has(roleId))) {
          continue;
        }

        // Exempt Channels prüfen
        if (rule.exemptChannels && rule.exemptChannels.includes(message.channelId)) {
          continue;
        }

        // Moderatoren ausschließen
        if (member.permissions.has('ManageMessages')) {
          continue;
        }

        const violated = await checkRule(message, rule);
        if (violated) {
          await executeAction(message, rule);
          break; // Nur eine Regel pro Nachricht ausführen
        }
      }

    } catch (error) {
      console.error('Fehler beim Automod:', error);
    }
  },
};

async function checkRule(message: Message, rule: any): Promise<boolean> {
  const content = message.content;
  const trigger = rule.trigger;
  const userId = message.author.id;
  const userKey = `${userId}-${message.guild!.id}`;

  switch (rule.type) {
    case 'SPAM':
      return checkSpam(message, trigger);
    
    case 'CAPS':
      return checkCaps(content, trigger);
    
    case 'MENTIONS':
      return checkMentions(message, trigger);
    
    case 'LINKS':
      return checkLinks(content, trigger);
    
    case 'INVITES':
      return checkInvites(content, trigger);
    
    case 'PROFANITY':
      return checkProfanity(content, trigger);
    
    case 'REPEATED_TEXT':
      return checkRepeatedText(message, trigger);
    
    case 'ZALGO':
      return checkZalgo(content, trigger);
    
    case 'EMOJI_SPAM':
      return checkEmojiSpam(content, trigger);
    
    default:
      return false;
  }
}

function checkSpam(message: Message, trigger: any): boolean {
  const userId = message.author.id;
  const userKey = `${userId}-${message.guild!.id}`;
  const now = Date.now();
  const threshold = trigger.threshold || 5;
  const timeframe = (trigger.timeframe || 10) * 1000; // Sekunden zu Millisekunden

  // User-Daten initialisieren oder abrufen
  if (!userMessageCounts.has(userKey)) {
    userMessageCounts.set(userKey, { count: 0, timestamp: now, messages: [] });
  }

  const userData = userMessageCounts.get(userKey)!;

  // Alte Nachrichten entfernen (außerhalb des Zeitrahmens)
  if (now - userData.timestamp > timeframe) {
    userData.count = 0;
    userData.messages = [];
    userData.timestamp = now;
  }

  // Nachricht hinzufügen
  userData.count++;
  userData.messages.push(message.content);

  // Spam prüfen
  if (userData.count >= threshold) {
    // Reset für nächste Überprüfung
    userData.count = 0;
    userData.messages = [];
    userData.timestamp = now;
    return true;
  }

  return false;
}

function checkCaps(content: string, trigger: any): boolean {
  const percentage = trigger.percentage || 70;
  const minLength = trigger.minLength || 10;

  if (content.length < minLength) return false;

  const upperCaseCount = (content.match(/[A-Z]/g) || []).length;
  const letterCount = (content.match(/[A-Za-z]/g) || []).length;

  if (letterCount === 0) return false;

  const capsPercentage = (upperCaseCount / letterCount) * 100;
  return capsPercentage >= percentage;
}

function checkMentions(message: Message, trigger: any): boolean {
  const threshold = trigger.threshold || 5;
  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  return mentionCount >= threshold;
}

function checkLinks(content: string, trigger: any): boolean {
  const linkRegex = /https?:\/\/[^\s]+/gi;
  const matches = content.match(linkRegex);
  return matches !== null && matches.length > 0;
}

function checkInvites(content: string, trigger: any): boolean {
  const inviteRegex = /(discord\.gg|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/gi;
  return inviteRegex.test(content);
}

function checkProfanity(content: string, trigger: any): boolean {
  // Basis-Schimpfwörter Liste (in Produktion würde eine umfassendere Liste verwendet)
  const badWords = [
    'scheiße', 'fuck', 'shit', 'bitch', 'asshole', 'damn', 'hell',
    'idiot', 'dummkopf', 'arschloch', 'schlampe', 'hurensohn'
  ];
  
  const lowerContent = content.toLowerCase();
  return badWords.some(word => lowerContent.includes(word));
}

function checkRepeatedText(message: Message, trigger: any): boolean {
  const userId = message.author.id;
  const userKey = `${userId}-${message.guild!.id}`;
  const threshold = trigger.threshold || 3;

  if (!userMessageCounts.has(userKey)) {
    userMessageCounts.set(userKey, { count: 1, timestamp: Date.now(), messages: [message.content] });
    return false;
  }

  const userData = userMessageCounts.get(userKey)!;
  
  // Prüfen ob die letzten X Nachrichten identisch sind
  userData.messages.push(message.content);
  if (userData.messages.length > threshold) {
    userData.messages.shift(); // Älteste Nachricht entfernen
  }

  // Alle Nachrichten gleich?
  if (userData.messages.length >= threshold) {
    const firstMessage = userData.messages[0];
    const allSame = userData.messages.every(msg => msg === firstMessage);
    return allSame;
  }

  return false;
}

function checkZalgo(content: string, trigger: any): boolean {
  // Zalgo-Zeichen erkennen (kombinierte diakritische Zeichen)
  const zalgoRegex = /[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/g;
  const zalgoMatches = content.match(zalgoRegex);
  return zalgoMatches !== null && zalgoMatches.length > 10; // Mehr als 10 Zalgo-Zeichen
}

function checkEmojiSpam(content: string, trigger: any): boolean {
  const threshold = trigger.threshold || 10;
  // Unicode-Emojis und Discord-Custom-Emojis
  const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|<a?:[a-zA-Z0-9_]+:[0-9]+>)/gu;
  const matches = content.match(emojiRegex);
  return matches !== null && matches.length >= threshold;
}

async function executeAction(message: Message, rule: any): Promise<void> {
  const action = rule.action;
  const member = message.member as GuildMember;
  const guild = message.guild!;

  try {
    // Violation Count erhöhen (für eskalierte Aktionen)
    const userKey = `${message.author.id}-${guild.id}`;
    if (!userViolations.has(userKey)) {
      userViolations.set(userKey, { count: 0, lastViolation: 0 });
    }
    const violations = userViolations.get(userKey)!;
    violations.count++;
    violations.lastViolation = Date.now();

    // Nachricht löschen (fast immer)
    if (action.type !== 'WARN') {
      try {
        await message.delete();
      } catch (error) {
        console.error('Fehler beim Löschen der Nachricht:', error);
      }
    }

    // Warnung hinzufügen wenn konfiguriert
    if (action.warn) {
      await DatabaseService.addWarn({
        userId: message.author.id,
        guildId: guild.id,
        moderatorId: message.client.user!.id,
        reason: `Automod: ${rule.name} (${getViolationDescription(rule.type)})`
      });
    }

    // Haupt-Aktion ausführen
    switch (action.type) {
      case 'DELETE':
        // Bereits gelöscht
        await sendAutomodLog(message, rule, 'Nachricht gelöscht');
        break;

      case 'WARN':
        await sendAutomodLog(message, rule, 'Warnung erteilt');
        break;

      case 'TIMEOUT_1H':
        try {
          await member.timeout(60 * 60 * 1000, `Automod: ${rule.name}`); // 1 Stunde
          await sendAutomodLog(message, rule, 'Timeout (1h) erteilt');
        } catch (error) {
          console.error('Fehler beim Timeout:', error);
        }
        break;

      case 'TIMEOUT_24H':
        try {
          await member.timeout(24 * 60 * 60 * 1000, `Automod: ${rule.name}`); // 24 Stunden
          await sendAutomodLog(message, rule, 'Timeout (24h) erteilt');
        } catch (error) {
          console.error('Fehler beim Timeout:', error);
        }
        break;

      case 'KICK':
        try {
          await member.kick(`Automod: ${rule.name}`);
          await sendAutomodLog(message, rule, 'Benutzer gekickt');
        } catch (error) {
          console.error('Fehler beim Kick:', error);
        }
        break;

      case 'BAN':
        try {
          await member.ban({ reason: `Automod: ${rule.name}` });
          await sendAutomodLog(message, rule, 'Benutzer gebannt');
        } catch (error) {
          console.error('Fehler beim Ban:', error);
        }
        break;
    }

    // User über Verstoß informieren (außer bei Ban)
    if (action.type !== 'BAN') {
      try {
        const dmMessage = `⚠️ **Automod-Warnung** auf ${guild.name}\n\n` +
          `**Grund:** ${getViolationDescription(rule.type)}\n` +
          `**Aktion:** ${getActionDescription(action.type)}\n` +
          `**Regel:** ${rule.name}\n\n` +
          `Bitte halte dich an die Serverregeln, um weitere Maßnahmen zu vermeiden.`;

        await message.author.send(dmMessage);
      } catch (error) {
        // DM konnte nicht gesendet werden
      }
    }

  } catch (error) {
    console.error('Fehler beim Ausführen der Automod-Aktion:', error);
  }
}

async function sendAutomodLog(message: Message, rule: any, action: string): Promise<void> {
  try {
    const guild = message.guild!;
    const guildSettings = await DatabaseService.getGuildSettings(guild.id);
    
    if (!guildSettings.modLogChannelId) return;

    const logChannel = await guild.channels.fetch(guildSettings.modLogChannelId);
    if (!logChannel || !logChannel.isTextBased()) return;

    const embed = {
      color: 0xff6b35,
      title: '🤖 Automod-Aktion',
      fields: [
        { name: '👤 Benutzer', value: `${message.author} (${message.author.tag})`, inline: true },
        { name: '📺 Channel', value: `${message.channel}`, inline: true },
        { name: '🛡️ Regel', value: rule.name, inline: true },
        { name: '📋 Verstoß', value: getViolationDescription(rule.type), inline: true },
        { name: '⚡ Aktion', value: action, inline: true },
        { name: '💬 Nachricht', value: message.content.length > 1024 ? message.content.slice(0, 1021) + '...' : message.content, inline: false }
      ],
      timestamp: new Date().toISOString(),
      footer: { text: `User-ID: ${message.author.id}` }
    };

    await logChannel.send({ embeds: [embed] });

  } catch (error) {
    console.error('Fehler beim Senden des Automod-Logs:', error);
  }
}

function getViolationDescription(type: string): string {
  const descriptions: Record<string, string> = {
    SPAM: 'Spam (zu viele Nachrichten)',
    CAPS: 'Übermäßige Großschreibung',
    MENTIONS: 'Zu viele Mentions',
    LINKS: 'Unerlaubte Links',
    INVITES: 'Discord-Einladungen',
    PROFANITY: 'Anstößige Sprache',
    REPEATED_TEXT: 'Wiederholter Text',
    ZALGO: 'Zalgo-Text (unleserlich)',
    EMOJI_SPAM: 'Emoji-Spam'
  };
  return descriptions[type] || type;
}

function getActionDescription(action: string): string {
  const actions: Record<string, string> = {
    DELETE: 'Nachricht gelöscht',
    WARN: 'Warnung erteilt',
    TIMEOUT_1H: 'Timeout (1 Stunde)',
    TIMEOUT_24H: 'Timeout (24 Stunden)',
    KICK: 'Vom Server entfernt',
    BAN: 'Permanent gebannt'
  };
  return actions[action] || action;
}

// Cleanup alte Daten alle 10 Minuten
setInterval(() => {
  const now = Date.now();
  const maxAge = 30 * 60 * 1000; // 30 Minuten

  // Message Counts cleanup
  for (const [key, data] of userMessageCounts.entries()) {
    if (now - data.timestamp > maxAge) {
      userMessageCounts.delete(key);
    }
  }

  // Violations cleanup (nach 24 Stunden)
  const violationMaxAge = 24 * 60 * 60 * 1000;
  for (const [key, data] of userViolations.entries()) {
    if (now - data.lastViolation > violationMaxAge) {
      userViolations.delete(key);
    }
  }
}, 10 * 60 * 1000);