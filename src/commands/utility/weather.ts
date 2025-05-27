// src/commands/utility/weather.ts - Weather Utility Command
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../types/index.js';
import { CommandMetadata } from '../../types/CommandMetadata.js';
import { ExtendedClient } from '../../index.js';
import { Config } from '../../config/Config.js';

export const metadata: CommandMetadata = {
  name: 'weather',
  description: 'Get current weather information for a location',
  category: 'utility',
  usage: '/weather <location>',
  examples: [
    '/weather London',
    '/weather New York',
    '/weather Tokyo, Japan'
  ],
  cooldown: 10,
  guildOnly: false
};

interface WeatherData {
  name: string;
  country: string;
  temperature: number;
  feels_like: number;
  humidity: number;
  pressure: number;
  visibility: number;
  uv_index: number;
  condition: string;
  icon: string;
  wind_speed: number;
  wind_direction: string;
  local_time: string;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Get current weather information for a location')
    .addStringOption(option =>
      option.setName('location')
        .setDescription('The location to get weather for')
        .setRequired(true)
        .setMaxLength(100)),
  category: 'utility',
  cooldown: 10,

  async execute(interaction: ChatInputCommandInteraction, client: ExtendedClient): Promise<void> {
    const location = interaction.options.getString('location', true);

    if (!process.env.WEATHER_API_KEY) {
      await interaction.reply({
        content: '❌ Weather service is not configured. Please contact the bot administrator.',
        ephemeral: true
      });
      return;
    }

    await interaction.deferReply();

    try {
      const weatherData = await fetchWeatherData(location);
      
      if (!weatherData) {
        await interaction.editReply({
          content: `❌ Could not find weather data for "${location}". Please check the spelling and try again.`
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setTitle(`🌤️ Weather in ${weatherData.name}, ${weatherData.country}`)
        .setColor(getWeatherColor(weatherData.condition))
        .setTimestamp()
        .setFooter({ 
          text: `Requested by ${interaction.user.username} • Data from WeatherAPI`,
          iconURL: interaction.user.displayAvatarURL()
        });

      // Weather icon if available
      if (weatherData.icon) {
        embed.setThumbnail(`https:${weatherData.icon}`);
      }

      // Current conditions
      embed.addFields({
        name: '🌡️ Current Conditions',
        value: [
          `**Condition:** ${weatherData.condition}`,
          `**Temperature:** ${weatherData.temperature}°C (${celsiusToFahrenheit(weatherData.temperature)}°F)`,
          `**Feels Like:** ${weatherData.feels_like}°C (${celsiusToFahrenheit(weatherData.feels_like)}°F)`,
          `**Humidity:** ${weatherData.humidity}%`
        ].join('\n'),
        inline: true
      });

      // Atmospheric conditions
      embed.addFields({
        name: '🌬️ Atmospheric',
        value: [
          `**Pressure:** ${weatherData.pressure} mb`,
          `**Visibility:** ${weatherData.visibility} km`,
          `**UV Index:** ${weatherData.uv_index} ${getUVLevel(weatherData.uv_index)}`,
          `**Local Time:** ${weatherData.local_time}`
        ].join('\n'),
        inline: true
      });

      // Wind information
      embed.addFields({
        name: '💨 Wind',
        value: [
          `**Speed:** ${weatherData.wind_speed} km/h (${(weatherData.wind_speed * 0.621371).toFixed(1)} mph)`,
          `**Direction:** ${weatherData.wind_direction}`,
          `**Scale:** ${getWindScale(weatherData.wind_speed)}`
        ].join('\n'),
        inline: true
      });

      // Weather advice
      const advice = getWeatherAdvice(weatherData);
      if (advice) {
        embed.addFields({
          name: '💡 Weather Advice',
          value: advice,
          inline: false
        });
      }

      await interaction.editReply({ embeds: [embed] });

      // Log for utility usage stats
      if (interaction.guild) {
        client.wsManager.emitRealtimeEvent(interaction.guild.id, 'utility:weather_checked', {
          userId: interaction.user.id,
          location: location,
          temperature: weatherData.temperature,
          condition: weatherData.condition
        });
      }

      client.logger.debug(`${interaction.user.tag} checked weather for ${location}`);

    } catch (error) {
      client.logger.error('Error fetching weather data:', error);
      
      await interaction.editReply({
        content: '❌ An error occurred while fetching weather data. Please try again later.'
      });
    }
  }
};

async function fetchWeatherData(location: string): Promise<WeatherData | null> {
  const apiKey = process.env.WEATHER_API_KEY;
  const url = `http://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${encodeURIComponent(location)}&aqi=no`;

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    
    return {
      name: data.location.name,
      country: data.location.country,
      temperature: Math.round(data.current.temp_c),
      feels_like: Math.round(data.current.feelslike_c),
      humidity: data.current.humidity,
      pressure: Math.round(data.current.pressure_mb),
      visibility: Math.round(data.current.vis_km),
      uv_index: Math.round(data.current.uv),
      condition: data.current.condition.text,
      icon: data.current.condition.icon,
      wind_speed: Math.round(data.current.wind_kph),
      wind_direction: data.current.wind_dir,
      local_time: new Date(data.location.localtime).toLocaleString()
    };
  } catch (error) {
    console.error('Weather API error:', error);
    return null;
  }
}

function celsiusToFahrenheit(celsius: number): number {
  return Math.round((celsius * 9/5) + 32);
}

function getWeatherColor(condition: string): number {
  const conditionLower = condition.toLowerCase();
  
  if (conditionLower.includes('sunny') || conditionLower.includes('clear')) {
    return 0xFFD700; // Gold
  } else if (conditionLower.includes('cloud') || conditionLower.includes('overcast')) {
    return 0x808080; // Gray
  } else if (conditionLower.includes('rain') || conditionLower.includes('drizzle')) {
    return 0x4169E1; // Royal Blue
  } else if (conditionLower.includes('snow') || conditionLower.includes('blizzard')) {
    return 0xF0F8FF; // Alice Blue
  } else if (conditionLower.includes('thunder') || conditionLower.includes('storm')) {
    return 0x483D8B; // Dark Slate Blue
  } else if (conditionLower.includes('fog') || conditionLower.includes('mist')) {
    return 0xDCDCDC; // Gainsboro
  }
  
  return 0x5865F2; // Return number instead of Config.COLORS.INFO
}

function getUVLevel(uvIndex: number): string {
  if (uvIndex <= 2) return '(Low)';
  if (uvIndex <= 5) return '(Moderate)';
  if (uvIndex <= 7) return '(High)';
  if (uvIndex <= 10) return '(Very High)';
  return '(Extreme)';
}

function getWindScale(windSpeed: number): string {
  if (windSpeed < 1) return 'Calm';
  if (windSpeed < 6) return 'Light Air';
  if (windSpeed < 12) return 'Light Breeze';
  if (windSpeed < 20) return 'Gentle Breeze';
  if (windSpeed < 29) return 'Moderate Breeze';
  if (windSpeed < 39) return 'Fresh Breeze';
  if (windSpeed < 50) return 'Strong Breeze';
  if (windSpeed < 62) return 'Near Gale';
  if (windSpeed < 75) return 'Gale';
  if (windSpeed < 89) return 'Strong Gale';
  if (windSpeed < 103) return 'Storm';
  if (windSpeed < 118) return 'Violent Storm';
  return 'Hurricane';
}

function getWeatherAdvice(weather: WeatherData): string | null {
  const advice: string[] = [];
  
  // Temperature advice
  if (weather.temperature < 0) {
    advice.push('🧥 Bundle up! It\'s freezing outside.');
  } else if (weather.temperature < 10) {
    advice.push('🧥 Wear a warm jacket - it\'s quite cold.');
  } else if (weather.temperature > 30) {
    advice.push('🌞 Stay hydrated and seek shade - it\'s very hot!');
  }
  
  // Condition advice
  if (weather.condition.toLowerCase().includes('rain')) {
    advice.push('☔ Don\'t forget your umbrella!');
  } else if (weather.condition.toLowerCase().includes('snow')) {
    advice.push('❄️ Drive carefully and wear appropriate footwear.');
  } else if (weather.condition.toLowerCase().includes('fog')) {
    advice.push('🌫️ Be extra careful when driving - visibility is limited.');
  }
  
  // UV advice
  if (weather.uv_index >= 6) {
    advice.push('🧴 Apply sunscreen - UV levels are high.');
  }
  
  // Wind advice
  if (weather.wind_speed > 40) {
    advice.push('💨 Strong winds expected - secure any loose objects.');
  }
  
  // Humidity advice
  if (weather.humidity > 80) {
    advice.push('💧 High humidity - it may feel warmer than the actual temperature.');
  }
  
  return advice.length > 0 ? advice.join('\n') : null;
}

export default command;