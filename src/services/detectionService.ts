import { Detection } from '../types/detection';

const API_BASE_URL = 'http://localhost:5000/api';

export const detectionService = {
  async getDetectionHistory(): Promise<Detection[]> {
    const response = await fetch(`${API_BASE_URL}/detections`);
    if (!response.ok) {
      throw new Error('Failed to fetch detection history');
    }
    return response.json();
  },

  async getDetectionImage(imagePath: string): Promise<string> {
    const response = await fetch(`${API_BASE_URL}/images/${imagePath}`);
    if (!response.ok) {
      throw new Error('Failed to fetch image');
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },

  async deleteDetection(id: number): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/detections/${id}`, {
      method: 'DELETE'
    });
    if (!response.ok) {
      throw new Error('Failed to delete detection');
    }
  }
};