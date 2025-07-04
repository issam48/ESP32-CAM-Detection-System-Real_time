import React from 'react';
import { Camera, Users, Wifi, WifiOff } from 'lucide-react';
import { DetectionFrame } from '../types/detection';

interface LiveStreamProps {
  frame: DetectionFrame | null;
  isConnected: boolean;
  error: string | null;
}

export const LiveStream: React.FC<LiveStreamProps> = ({ frame, isConnected, error }) => {
  return (
    <div className="bg-white/10 backdrop-blur-md rounded-2xl border border-white/20 shadow-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <Camera className="w-6 h-6 text-blue-400" />
          <h2 className="text-xl font-semibold text-white">Live Stream</h2>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            {isConnected ? (
              <>
                <Wifi className="w-5 h-5 text-green-400" />
                <span className="text-green-400 text-sm font-medium">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="w-5 h-5 text-red-400" />
                <span className="text-red-400 text-sm font-medium">Disconnected</span>
              </>
            )}
          </div>
          
          {/* Person Count */}
          {frame && (
            <div className="flex items-center space-x-2 bg-blue-500/20 px-3 py-1 rounded-full">
              <Users className="w-4 h-4 text-blue-400" />
              <span className="text-blue-400 font-semibold">
                {frame.personCount} person{frame.personCount !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Video Stream Area */}
      <div className="relative bg-gray-900/50 rounded-xl overflow-hidden aspect-video">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-red-400 text-lg font-medium mb-2">Connection Error</div>
              <div className="text-gray-400 text-sm">{error}</div>
            </div>
          </div>
        ) : frame ? (
          <img
            src={`data:image/jpeg;base64,${frame.image}`}
            alt="Live stream"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Camera className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <div className="text-gray-400 text-lg">
                {isConnected ? 'Waiting for stream...' : 'Connecting...'}
              </div>
            </div>
          </div>
        )}
        
        {/* Timestamp Overlay */}
        {frame && (
          <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-lg">
            <span className="text-white text-sm font-mono">
              {new Date(frame.timestamp).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};