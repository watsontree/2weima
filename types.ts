
export interface Asset {
  id: string;
  url: string;
  name: string;
}

export interface AddressAsset {
  id: string;
  name: string;
  url: string;
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
  fontMode: 'random' | 'fixed';
  fontWeight: 'random' | 'bold' | 'normal';
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
  primaryColor: 'random' | 'black' | 'colorful';
  randomVariation: 'high' | 'low' | 'artistic';
  eyeStyle: string;
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
