export interface Detection {
  id: number;
  timestamp: string;
  personCount: number;
  imagePath: string;
  confidence: number;
}

export interface DetectionFrame {
  image: string; // base64 encoded image
  personCount: number;
  timestamp: string;
  detections: BoundingBox[];
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
  class: string;
}

export interface WebSocketMessage {
  type: 'detection' | 'error' | 'status';
  data: DetectionFrame | string;
}