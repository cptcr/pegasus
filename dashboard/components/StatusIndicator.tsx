import { useRealtime } from "@/lib/websocket";

// Connection status indicator component
export function ConnectionStatus({ guildId }: { guildId: string }) {
    const { isConnected } = useRealtime(guildId, []);
  
    return (
      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
        isConnected 
          ? 'bg-green-900/20 text-green-400 border border-green-500/20' 
          : 'bg-red-900/20 text-red-400 border border-red-500/20'
      }`}>
        <div className={`w-2 h-2 rounded-full mr-1 ${
          isConnected ? 'bg-green-400' : 'bg-red-400'
        } ${isConnected ? 'animate-pulse' : ''}`} />
        {isConnected ? 'Live' : 'Offline'}
      </div>
    );
  }