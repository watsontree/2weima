
import { GeneratedItem, GeneratorConfig } from '../types';

const getRandomColor = () => {
  const colors = [
    '#000000', '#1F2937', '#DC2626', '#2563EB', '#059669', 
    '#D97706', '#7C3AED', '#DB2777', '#4B5563'
  ];
  return colors[Math.floor(Math.random() * colors.length)];
};

const FONT_FAMILIES = [
  'Inter', 'system-ui', 'Arial', 'Helvetica', 'Verdana', 
  'Georgia', 'Times New Roman', 'Impact', 'Courier New', 
  'Tahoma', 'Trebuchet MS', 'Arial Black', 'Palatino'
];

const getRandomFont = () => {
  return FONT_FAMILIES[Math.floor(Math.random() * FONT_FAMILIES.length)];
};

const getRandomWeight = () => {
  return Math.random() > 0.5 ? 'bold' : 'normal';
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

  // 1. 背景绘制
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 起始位置调整为画布高度的 6%
  const startY = canvas.height * 0.06;
  
  // 2. 图标绘制 (顶部)
  // 缩放图标：从 45% 缩小到 38%，使画面不显得过于拥挤
  let iconBottom = 0;
  try {
    const iconImg = await loadImage(iconUrl);
    const baseIconSize = canvas.width * 0.38; 
    const iconScale = config.minScale + Math.random() * (config.maxScale - config.minScale);
    const iconW = baseIconSize * iconScale;
    const iconH = iconW; 
    const iconX = (canvas.width - iconW) / 2;
    const iconY = startY;
    iconBottom = iconY + iconH;
    
    ctx.save();
    const radius = canvas.width * 0.06; // 稍微圆润一点的圆角
    ctx.beginPath();
    ctx.roundRect(iconX, iconY, iconW, iconH, radius);
    ctx.clip();
    ctx.drawImage(iconImg, iconX, iconY, iconW, iconH);
    ctx.restore();
  } catch (e) {
    iconBottom = startY + (canvas.height * 0.2);
  }

  // 3. 文案绘制 (中间)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const textColor = getRandomColor();
  
  const fontStyle = config.fontMode === 'random' ? getRandomFont() : 'Inter';
  const fontWeight = config.fontWeight === 'random' 
    ? getRandomWeight() 
    : (config.fontWeight === 'bold' ? 'bold' : 'normal');

  // 调整文字大小和间距
  let baseFontSize = Math.floor(canvas.width * 0.085);
  const maxWidth = canvas.width * 0.88;

  ctx.fillStyle = textColor;
  // 缩小图标与文字的间距：由 8% 缩小为 4%
  const textY = iconBottom + (canvas.height * 0.04); 
  
  const lines = text.split('\n');
  let currentY = textY;
  
  lines.forEach((line) => {
    let fontSize = baseFontSize;
    ctx.font = `${fontWeight} ${fontSize}px ${fontStyle}`;
    let metrics = ctx.measureText(line);
    // 自动降级字号以适配最大宽度
    while (metrics.width > maxWidth && fontSize > 24) {
      fontSize -= 2;
      ctx.font = `${fontWeight} ${fontSize}px ${fontStyle}`;
      metrics = ctx.measureText(line);
    }
    ctx.fillText(line, canvas.width / 2, currentY);
    currentY += fontSize * 1.35; // 紧凑行间距
  });

  const textBottom = currentY;

  // 4. 二维码绘制 (底部)
  try {
    const qrImg = await loadImage(qrUrl);
    // 缩小二维码比例：从 75% 调整为 70%
    const baseQrSize = canvas.width * 0.70; 
    const qrScale = config.minScale + Math.random() * (config.maxScale - config.minScale);
    const qrW = baseQrSize * qrScale;
    const qrH = qrW;
    const qrX = (canvas.width - qrW) / 2;
    
    // 缩小文字与二维码的间距：由 5% 缩小为 3.5%
    // 增加逻辑保护：如果文案太长，强制在底部预留位置，避免二维码被挤出画布
    const availableTop = textBottom + (canvas.height * 0.035);
    const safeBottom = canvas.height - qrH - (canvas.height * 0.05);
    
    // 取两者中较大的一个，但如果文案实在太长导致重叠，则二维码会优先保证不超出画布底部
    const qrY = Math.min(Math.max(availableTop, canvas.height * 0.55), safeBottom);
    
    ctx.drawImage(qrImg, qrX, qrY, qrW, qrH);
  } catch (e) {
    console.error("QR load failed", e);
  }

  return canvas.toDataURL('image/png');
};
