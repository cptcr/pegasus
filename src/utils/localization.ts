import { LocalizationMap } from 'discord.js';

export interface LocalizedStrings {
  en: string;
  de?: string;
  es?: string;
  fr?: string;
}

export const createLocalizationMap = (strings: LocalizedStrings): LocalizationMap => {
  const map: LocalizationMap = {};

  if (strings.de) map.de = strings.de;
  if (strings.es) map['es-ES'] = strings.es;
  if (strings.fr) map.fr = strings.fr;

  return map;
};

// Command name localizations
export const commandNames = {
  warn: {
    en: 'warn',
    de: 'warnen',
    es: 'advertir',
    fr: 'avertir',
  },
  moderation: {
    en: 'moderation',
    de: 'moderation',
    es: 'moderacion',
    fr: 'moderation',
  },
  config: {
    en: 'config',
    de: 'konfiguration',
    es: 'configuracion',
    fr: 'configuration',
  },
  giveaway: {
    en: 'gw',
    de: 'gewinnspiel',
    es: 'sorteo',
    fr: 'concours',
  },
  economy: {
    en: 'eco',
    de: 'wirtschaft',
    es: 'economia',
    fr: 'economie',
  },
  xp: {
    en: 'xp',
    de: 'xp',
    es: 'xp',
    fr: 'xp',
  },
  ticket: {
    en: 'ticket',
    de: 'ticket',
    es: 'ticket',
    fr: 'ticket',
  },
  language: {
    en: 'language',
    de: 'sprache',
    es: 'idioma',
    fr: 'langue',
  },
  utils: {
    en: 'utils',
    de: 'werkzeuge',
    es: 'utilidades',
    fr: 'utilitaires',
  },
  blacklist: {
    en: 'blacklist',
    de: 'sperrliste',
    es: 'listanegra',
    fr: 'listenoire',
  },
  fun: {
    en: 'fun',
    de: 'spass',
    es: 'diversion',
    fr: 'amusant',
  },
};

// Command descriptions
export const commandDescriptions = {
  warn: {
    en: 'Manage user warnings',
    de: 'Benutzerwarnungen verwalten',
    es: 'Gestionar advertencias de usuario',
    fr: 'Gérer les avertissements utilisateur',
  },
  moderation: {
    en: 'Moderation commands for server management',
    de: 'Moderationsbefehle für die Serververwaltung',
    es: 'Comandos de moderación para la gestión del servidor',
    fr: 'Commandes de modération pour la gestion du serveur',
  },
  config: {
    en: 'Configure bot settings for your server',
    de: 'Bot-Einstellungen für Ihren Server konfigurieren',
    es: 'Configurar ajustes del bot para tu servidor',
    fr: 'Configurer les paramètres du bot pour votre serveur',
  },
  giveaway: {
    en: 'Manage giveaways on your server',
    de: 'Gewinnspiele auf Ihrem Server verwalten',
    es: 'Gestionar sorteos en tu servidor',
    fr: 'Gérer les concours sur votre serveur',
  },
  economy: {
    en: 'Economy system commands',
    de: 'Wirtschaftssystem-Befehle',
    es: 'Comandos del sistema económico',
    fr: 'Commandes du système économique',
  },
  xp: {
    en: 'XP and leveling system',
    de: 'XP- und Levelsystem',
    es: 'Sistema de XP y niveles',
    fr: 'Système XP et de niveaux',
  },
  ticket: {
    en: 'Support ticket system',
    de: 'Support-Ticket-System',
    es: 'Sistema de tickets de soporte',
    fr: 'Système de tickets de support',
  },
  language: {
    en: 'Language preferences',
    de: 'Spracheinstellungen',
    es: 'Preferencias de idioma',
    fr: 'Préférences linguistiques',
  },
  utils: {
    en: 'Utility commands',
    de: 'Nützliche Befehle',
    es: 'Comandos de utilidad',
    fr: 'Commandes utilitaires',
  },
  blacklist: {
    en: 'Manage bot blacklist',
    de: 'Bot-Sperrliste verwalten',
    es: 'Gestionar lista negra del bot',
    fr: 'Gérer la liste noire du bot',
  },
  fun: {
    en: 'Fun and entertainment commands',
    de: 'Spaß- und Unterhaltungsbefehle',
    es: 'Comandos de diversión y entretenimiento',
    fr: 'Commandes amusantes et de divertissement',
  },
};

// Subcommand localizations
export const subcommandDescriptions = {
  warn: {
    create: {
      en: 'Issue a warning to a user',
      de: 'Eine Warnung an einen Benutzer ausgeben',
      es: 'Emitir una advertencia a un usuario',
      fr: 'Émettre un avertissement à un utilisateur',
    },
    edit: {
      en: 'Edit an existing warning',
      de: 'Eine bestehende Warnung bearbeiten',
      es: 'Editar una advertencia existente',
      fr: 'Modifier un avertissement existant',
    },
    lookup: {
      en: 'Look up a specific warning',
      de: 'Eine bestimmte Warnung nachschlagen',
      es: 'Buscar una advertencia específica',
      fr: 'Rechercher un avertissement spécifique',
    },
    view: {
      en: 'View all warnings for a user',
      de: 'Alle Warnungen für einen Benutzer anzeigen',
      es: 'Ver todas las advertencias de un usuario',
      fr: 'Voir tous les avertissements pour un utilisateur',
    },
    automation: {
      create: {
        en: 'Create a warning automation',
        de: 'Eine Warnungsautomatisierung erstellen',
        es: 'Crear una automatización de advertencia',
        fr: "Créer une automatisation d'avertissement",
      },
      view: {
        en: 'View all warning automations',
        de: 'Alle Warnungsautomatisierungen anzeigen',
        es: 'Ver todas las automatizaciones de advertencia',
        fr: "Voir toutes les automatisations d'avertissement",
      },
      delete: {
        en: 'Delete a warning automation',
        de: 'Eine Warnungsautomatisierung löschen',
        es: 'Eliminar una automatización de advertencia',
        fr: "Supprimer une automatisation d'avertissement",
      },
    },
  },
  moderation: {
    ban: {
      en: 'Ban a user from the server',
      de: 'Einen Benutzer vom Server verbannen',
      es: 'Banear a un usuario del servidor',
      fr: 'Bannir un utilisateur du serveur',
    },
    kick: {
      en: 'Kick a user from the server',
      de: 'Einen Benutzer vom Server kicken',
      es: 'Expulsar a un usuario del servidor',
      fr: 'Expulser un utilisateur du serveur',
    },
    timeout: {
      en: 'Timeout a user',
      de: 'Einen Benutzer in Timeout setzen',
      es: 'Poner a un usuario en tiempo fuera',
      fr: 'Mettre un utilisateur en timeout',
    },
    resetxp: {
      en: "Reset a user's XP",
      de: 'XP eines Benutzers zurücksetzen',
      es: 'Reiniciar el XP de un usuario',
      fr: "Réinitialiser l'XP d'un utilisateur",
    },
  },
};

// Option descriptions
export const optionDescriptions = {
  user: {
    en: 'The user to target',
    de: 'Der Zielbenutzer',
    es: 'El usuario objetivo',
    fr: "L'utilisateur cible",
  },
  title: {
    en: 'Title of the warning',
    de: 'Titel der Warnung',
    es: 'Título de la advertencia',
    fr: "Titre de l'avertissement",
  },
  description: {
    en: 'Description of the warning',
    de: 'Beschreibung der Warnung',
    es: 'Descripción de la advertencia',
    fr: "Description de l'avertissement",
  },
  level: {
    en: 'Warning level (1-10)',
    de: 'Warnstufe (1-10)',
    es: 'Nivel de advertencia (1-10)',
    fr: "Niveau d'avertissement (1-10)",
  },
  proof: {
    en: 'Proof attachment for the warning',
    de: 'Beweisanhang für die Warnung',
    es: 'Prueba adjunta para la advertencia',
    fr: "Preuve jointe pour l'avertissement",
  },
  warnid: {
    en: 'The warning ID',
    de: 'Die Warnungs-ID',
    es: 'El ID de advertencia',
    fr: "L'ID d'avertissement",
  },
  reason: {
    en: 'Reason for the action',
    de: 'Grund für die Aktion',
    es: 'Razón de la acción',
    fr: "Raison de l'action",
  },
  duration: {
    en: 'Duration of the action',
    de: 'Dauer der Aktion',
    es: 'Duración de la acción',
    fr: "Durée de l'action",
  },
};
