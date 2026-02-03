
import { GeneratedItem, GeneratorConfig } from '../types';

const getRandomColor = () => {
  const colors = [
    '#000000', '#1F2937', '#DC2626', '#2563EB', '#059669', 
    '#D97706', '#7C3AED', '#DB2777', '#4B5563'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

const getRandomFont = () => {
  const fonts = ['Inter', 'sans-serif', 'system-ui', 'Arial'];
  return fonts[Math.floor(Math.random() * fonts.length)];
};

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

export const generateImage = async (
  config: GeneratorConfig,
  text: string,
  iconUrl: string,
  qrUrl: string
): Promise<string> => {
  const canvas = document.createElement('canvas');
  canvas.width = config.canvasWidth;
  canvas.height = config.canvasHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas context');

  // 1. Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const startY = canvas.height * 0.04;
  
  // 2. Icon (Top)
  let iconBottom = 0;
  try {
    const iconImg = await loadImage(iconUrl);
    const baseIconSize = canvas.width * 0.4; 
    const iconScale = config.minScale + Math.random() * (config.maxScale - config.minScale);
    const iconW = baseIconSize * iconScale;
    const iconH = iconW; 
    const iconX = (canvas.width - iconW) / 2;
    const iconY = startY;
    iconBottom = iconY + iconH;
    
    ctx.save();
    const radius = 32;
    ctx.beginPath();
    ctx.roundRect(iconX, iconY, iconW, iconH, radius);
    ctx.clip();
    ctx.drawImage(iconImg, iconX, iconY, iconW, iconH);
    ctx.restore();
  } catch (e) {
    iconBottom = startY + 300;
  }

  // 3. Text (Middle)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const textColor = getRandomColor();
  const fontStyle = getRandomFont();
  let baseFontSize = Math.floor(canvas.width * 0.09);
  const maxWidth = canvas.width * 0.9;

  ctx.fillStyle = textColor;
  const textY = iconBottom + (canvas.height * 0.06); 
  
  const lines = text.split('\n');
  let currentY = textY;
  
  lines.forEach((line) => {
    let fontSize = baseFontSize;
    ctx.font = `bold ${fontSize}px ${fontStyle}`;
    let metrics = ctx.measureText(line);
    while (metrics.width > maxWidth && fontSize > 24) {
      fontSize -= 2;
      ctx.font = `bold ${fontSize}px ${fontStyle}`;
      metrics = ctx.measureText(line);
    }
    ctx.fillText(line, canvas.width / 2, currentY);
    currentY += fontSize * 1.3;
  });

  const textBottom = currentY;

  // 4. QR Code (Bottom)
  try {
    const qrImg = await loadImage(qrUrl);
    const baseQrSize = canvas.width * 0.7; 
    const qrScale = config.minScale + Math.random() * (config.maxScale - config.minScale);
    const qrW = baseQrSize * qrScale;
    const qrH = qrW;
    const qrX = (canvas.width - qrW) / 2;
    const qrY = textBottom + (canvas.height * 0.04);
    ctx.drawImage(qrImg, qrX, qrY, qrW, qrH);
  } catch (e) {
    console.error("QR load failed", e);
  }

  return canvas.toDataURL('image/png');
};
