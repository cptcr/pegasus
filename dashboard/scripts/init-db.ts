// dashboard/scripts/init-db.ts
import { PrismaClient } from '@prisma/client';
import { discordService } from '../lib/discordService';

const prisma = new PrismaClient();

async function initializeDatabase() {
  console.log('🚀 Initializing database...');

  try {
    // Initialize Discord service
    await discordService.initialize();

    // Get all guilds from Discord
    const discordGuilds = await discordService.getAllGuilds();
    console.log(`📊 Found ${discordGuilds.length} Discord guilds`);

    // Sync guilds to database
    for (const guild of discordGuilds) {
      try {
        await prisma.guild.upsert({
          where: { id: guild.id },
          update: { 
            name: guild.name,
            updatedAt: new Date()
          },
          create: {
            id: guild.id,
            name: guild.name,
            prefix: '!',
            enableLeveling: true,
            enableModeration: true,
            enableGeizhals: false,
            enablePolls: true,
            enableGiveaways: true,
            enableAutomod: false,
            enableTickets: false,
            enableMusic: false,
            enableJoinToCreate: false
          }
        });

        console.log(`✅ Synced guild: ${guild.name} (${guild.id})`);
      } catch (error) {
        console.error(`❌ Error syncing guild ${guild.id}:`, error);
      }
    }

    // Create some sample data for development
    if (process.env.NODE_ENV === 'development') {
      await createSampleData();
    }

    console.log('✅ Database initialization completed');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

async function createSampleData() {
  console.log('📝 Creating sample data...');

  // Get first guild for sample data
  const guild = await prisma.guild.findFirst();
  if (!guild) {
    console.log('⚠️ No guilds found, skipping sample data creation');
    return;
  }

  // Create sample user
  const sampleUser = await prisma.user.upsert({
    where: { id: 'sample_user_123' },
    update: {},
    create: {
      id: 'sample_user_123',
      username: 'SampleUser'
    }
  });

  // Create sample user level
  await prisma.userLevel.upsert({
    where: {
      userId_guildId: {
        userId: sampleUser.id,
        guildId: guild.id
      }
    },
    update: {},
    create: {
      userId: sampleUser.id,
      guildId: guild.id,
      xp: 1500,
      level: 3,
      messages: 50,
      voiceTime: 3600
    }
  });

  // Create sample level rewards
  const levelRewards = [
    { level: 5, roleId: 'role_level_5', description: 'Level 5 reward' },
    { level: 10, roleId: 'role_level_10', description: 'Level 10 reward' },
    { level: 25, roleId: 'role_level_25', description: 'Level 25 reward' }
  ];

  for (const reward of levelRewards) {
    await prisma.levelReward.upsert({
      where: {
        guildId_level: {
          guildId: guild.id,
          level: reward.level
        }
      },
      update: {},
      create: {
        guildId: guild.id,
        level: reward.level,
        roleId: reward.roleId,
        description: reward.description
      }
    });
  }

  // Create sample poll
  const poll = await prisma.poll.create({
    data: {
      guildId: guild.id,
      channelId: 'sample_channel_123',
      title: 'Sample Poll',
      description: 'This is a sample poll for testing',
      creatorId: sampleUser.id,
      multiple: false,
      anonymous: false,
      active: true
    }
  });

  // Create poll options
  const pollOptions = [
    { text: 'Option A', emoji: '🅰️' },
    { text: 'Option B', emoji: '🅱️' },
    { text: 'Option C', emoji: '🅾️' }
  ];

  for (let i = 0; i < pollOptions.length; i++) {
    await prisma.pollOption.create({
      data: {
        pollId: poll.id,
        text: pollOptions[i].text,
        emoji: pollOptions[i].emoji,
        orderIndex: i
      }
    });
  }

  // Create sample giveaway
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  await prisma.giveaway.create({
    data: {
      guildId: guild.id,
      channelId: 'sample_channel_123',
      title: 'Sample Giveaway',
      description: 'This is a sample giveaway for testing',
      prize: 'Discord Nitro',
      winners: 1,
      creatorId: sampleUser.id,
      endTime: tomorrow,
      active: true,
      ended: false
    }
  });

  // Create sample ticket
  await prisma.ticket.create({
    data: {
      guildId: guild.id,
      channelId: 'sample_ticket_channel_123',
      userId: sampleUser.id,
      category: 'support',
      subject: 'Sample Support Ticket',
      status: 'OPEN',
      priority: 'MEDIUM'
    }
  });

  // Create sample custom command
  await prisma.customCommand.create({
    data: {
      guildId: guild.id,
      name: 'hello',
      response: 'Hello {user}! Welcome to the server!',
      description: 'A simple greeting command',
      enabled: true,
      creatorId: sampleUser.id,
      uses: 42
    }
  });

  console.log('✅ Sample data created');
}

// Run the initialization
initializeDatabase().catch(console.error);