import { useState, useEffect } from 'react';
import { useWebSocket } from './useWebSocket';
import { Detection } from '../types/detection';
import { detectionService } from '../services/detectionService';

export const useDetectionHistory = () => {
  const [detections, setDetections] = useState<Detection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetections = async () => {
    try {
      setLoading(true);
      const data = await detectionService.getDetectionHistory();
      setDetections(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch detection history');
      console.error('Error fetching detections:', err);
    } finally {
      setLoading(false);
    }
  };

  const { stats } = useWebSocket('http://localhost:5000');

  useEffect(() => {
    fetchDetections();
  }, []);

  // تحديث عند تغير stats (أي بث WebSocket)
  useEffect(() => {
    if (stats) {
      fetchDetections();
    }
  }, [stats]);



  return {
    detections,
    loading,
    error,
    refresh: fetchDetections
  };
};