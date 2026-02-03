
export interface Asset {
  id: string;
  url: string;
  name: string;
}

export interface Library<T> {
  id: string;
  name: string;
  items: T[];
  isActive: boolean;
}

export interface TextLibrary {
  id: string;
  name: string;
  content: string;
  isActive: boolean;
}

export interface GeneratorConfig {
  batchCount: number;
  minScale: number;
  maxScale: number;
  textPool: string[];
  icons: Asset[];
  qrCodes: Asset[];
  canvasWidth: number;
  canvasHeight: number;
}

export interface GeneratedItem {
  id: string;
  dataUrl: string;
  text: string;
  iconId: string;
  qrId: string;
}

export interface BeautifyConfig {
  mode: 'standard' | 'camouflage' | 'colorful';
  primaryColor: 'random' | 'black';
  randomVariation: 'high' | 'low' | 'artistic';
}

export interface BeautifiedQR {
  dataUrl: string;
  isScannable: boolean;
  score: number;
}

export interface User {
  username: string;
  role: 'admin' | 'user';
}
