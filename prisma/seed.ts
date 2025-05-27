// prisma/seed.ts - Database Seed File
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  try {
    // Create example guild
    const exampleGuild = await prisma.guild.upsert({
      where: { id: '554266392262737930' },
      update: {},
      create: {
        id: '554266392262737930',
        name: 'Example Guild',
        prefix: '!',
        enableLeveling: true,
        enableModeration: true,
        enablePolls: true,
        enableGiveaways: true,
        enableTickets: true,
      }
    });

    console.log('✅ Created example guild:', exampleGuild.name);

    // Create example user
    const exampleUser = await prisma.user.upsert({
      where: { id: '797927858420187186' },
      update: {},
      create: {
        id: '797927858420187186',
        username: 'ExampleUser',
      }
    });

    console.log('✅ Created example user:', exampleUser.username);

    // Create user level
    await prisma.userLevel.upsert({
      where: {
        userId_guildId: {
          userId: exampleUser.id,
          guildId: exampleGuild.id
        }
      },
      update: {},
      create: {
        userId: exampleUser.id,
        guildId: exampleGuild.id,
        xp: 1500,
        level: 5,
        messages: 150,
        voiceTime: 3600
      }
    });

    console.log('✅ Created user level data');

    // Create level rewards
    const levelRewards = [
      { level: 5, roleId: '123456789012345678', description: 'Active Member' },
      { level: 10, roleId: '123456789012345679', description: 'Veteran Member' },
      { level: 25, roleId: '123456789012345680', description: 'Elite Member' },
      { level: 50, roleId: '123456789012345681', description: 'Legendary Member' }
    ];

    for (const reward of levelRewards) {
      await prisma.levelReward.upsert({
        where: {
          guildId_level: {
            guildId: exampleGuild.id,
            level: reward.level
          }
        },
        update: {},
        create: {
          guildId: exampleGuild.id,
          ...reward
        }
      });
    }

    console.log('✅ Created level rewards');

    // Create ticket categories
    const ticketCategories = [
      { name: 'general', description: 'General support and questions', emoji: '❓' },
      { name: 'technical', description: 'Technical issues and bugs', emoji: '🔧' },
      { name: 'bug', description: 'Bug reports', emoji: '🐛' },
      { name: 'feature', description: 'Feature requests', emoji: '💡' },
      { name: 'account', description: 'Account related issues', emoji: '👤' }
    ];

    for (const category of ticketCategories) {
      await prisma.ticketCategory.upsert({
        where: {
          guildId_name: {
            guildId: exampleGuild.id,
            name: category.name
          }
        },
        update: {},
        create: {
          guildId: exampleGuild.id,
          ...category
        }
      });
    }

    console.log('✅ Created ticket categories');

    // Create example custom commands
    const customCommands = [
      { 
        name: 'rules', 
        response: 'Please read our server rules in the #rules channel!', 
        description: 'Shows server rules message' 
      },
      { 
        name: 'discord', 
        response: 'Join our Discord community: https://discord.gg/example', 
        description: 'Discord invite link' 
      },
      { 
        name: 'website', 
        response: 'Visit our website: https://example.com', 
        description: 'Website link' 
      }
    ];

    for (const command of customCommands) {
      await prisma.customCommand.upsert({
        where: {
          guildId_name: {
            guildId: exampleGuild.id,
            name: command.name
          }
        },
        update: {},
        create: {
          guildId: exampleGuild.id,
          creatorId: exampleUser.id,
          ...command
        }
      });
    }

    console.log('✅ Created custom commands');

    console.log('🎉 Database seed completed successfully!');
  } catch (e) {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();