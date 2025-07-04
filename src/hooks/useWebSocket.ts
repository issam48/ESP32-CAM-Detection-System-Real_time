import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { WebSocketMessage, DetectionFrame } from '../types/detection';

type StatsType = {
  live_count: number;
  today_detections: number;
  total_detections: number;
  avg_persons: number;
};

export const useWebSocket = (url: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastFrame, setLastFrame] = useState<DetectionFrame | null>(null);
  const [stats, setStats] = useState<StatsType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const connect = useCallback(() => {
    try {
      const socket = io(url, {
        path: '/socket.io/',
        transports: ['websocket', 'polling']
      });
      
      socketRef.current = socket;

      socket.on('connect', () => {
        setIsConnected(true);
        setError(null);
        console.log('Socket.IO connected');
      });

      socket.on('detection', (data: DetectionFrame) => {
        setLastFrame(data);
      });
      socket.on('stats', (data: StatsType) => {
        setStats(data);
      });

      socket.on('error', (errorData: string) => {
        setError(errorData);
        console.error('Socket.IO error:', errorData);
      });

      socket.on('connect_error', (err) => {
        setError('Socket.IO connection error');
        console.error('Socket.IO connection error:', err);
      });

      socket.on('disconnect', (reason) => {
        setIsConnected(false);
        console.log('Socket.IO disconnected:', reason);
      });

    } catch (err) {
      setError('Failed to connect to Socket.IO');
      console.error('Connection error:', err);
    }
  }, [url]);

  useEffect(() => {
    connect();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((message: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('message', message);
    }
  }, []);

  return {
    isConnected,
    lastFrame,
    stats,
    error,
    sendMessage
  };
};