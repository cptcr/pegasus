// src/commands/ticket/ticket.ts - Ticket Commands
export const ticketCommand = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket system commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('open')
        .setDescription('Open a new support ticket')
        .addStringOption(option =>
          option
            .setName('category')
            .setDescription('Ticket category')
            .setRequired(true)
            .addChoices(
              { name: 'General Support', value: 'general' },
              { name: 'Technical Issue', value: 'technical' },
              { name: 'Bug Report', value: 'bug' },
              { name: 'Feature Request', value: 'feature' },
              { name: 'Account Issue', value: 'account' }
            )
        )
        .addStringOption(option =>
          option
            .setName('subject')
            .setDescription('Brief description of your issue')
            .setRequired(true)
            .setMaxLength(Config.LIMITS.TICKET_SUBJECT_LENGTH)
        )
        .addStringOption(option =>
          option
            .setName('description')
            .setDescription('Detailed description of your issue')
            .setMaxLength(1024)
        )
        .addStringOption(option =>
          option
            .setName('priority')
            .setDescription('Ticket priority')
            .addChoices(
              { name: 'Low', value: 'LOW' },
              { name: 'Medium', value: 'MEDIUM' },
              { name: 'High', value: 'HIGH' },
              { name: 'Urgent', value: 'URGENT' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('close')
        .setDescription('Close a ticket')
        .addStringOption(option =>
          option
            .setName('reason')
            .setDescription('Reason for closing the ticket')
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a user to the ticket')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to add to the ticket')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a user from the ticket')
        .addUserOption(option =>
          option
            .setName('user')
            .setDescription('User to remove from the ticket')
            .setRequired(true)
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('priority')
        .setDescription('Set ticket priority')
        .addStringOption(option =>
          option
            .setName('priority')
            .setDescription('New priority level')
            .setRequired(true)
            .addChoices(
              { name: 'Low', value: 'LOW' },
              { name: 'Medium', value: 'MEDIUM' },
              { name: 'High', value: 'HIGH' },
              { name: 'Urgent', value: 'URGENT' }
            )
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List your tickets or all tickets (staff only)')
        .addBooleanOption(option =>
          option
            .setName('all')
            .setDescription('Show all tickets (staff only)')
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    // Ticket command implementation
  }
};
