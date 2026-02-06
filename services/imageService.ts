
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

  // 1. 预计算尺寸
  const iconScale = config.minScale + Math.random() * (config.maxScale - config.minScale);
  const iconW = canvas.width * 0.32 * iconScale; 
  const iconH = iconW;

  const qrScale = config.minScale + Math.random() * (config.maxScale - config.minScale);
  const qrW = canvas.width * 0.60 * qrScale; // 稍微恢复一点二维码尺寸比例
  const qrH = qrW;

  const lines = text.split('\n');
  const baseFontSize = Math.floor(canvas.width * 0.08);
  const lineHeight = baseFontSize * 1.35;
  const textTotalHeight = lines.length * lineHeight;

  // 2. 布局优化：更紧凑的间距和上移重心
  // 缩小间距至画布高度的 4.5%
  const verticalGap = canvas.height * 0.045; 
  const totalContentHeight = iconH + verticalGap + textTotalHeight + verticalGap + qrH;
  
  // 向上调整位置：内容起始点由完全居中（0.5）改为偏上（0.42 比例处开始）
  let currentY = (canvas.height - totalContentHeight) * 0.42;

  // 3. 背景绘制
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 4. 绘制图标
  try {
    const iconImg = await loadImage(iconUrl);
    const iconX = (canvas.width - iconW) / 2;
    const iconY = currentY;
    
    ctx.save();
    const radius = canvas.width * 0.055; 
    ctx.beginPath();
    ctx.roundRect(iconX, iconY, iconW, iconH, radius);
    ctx.clip();
    ctx.drawImage(iconImg, iconX, iconY, iconW, iconH);
    ctx.restore();
  } catch (e) {
    console.error("Icon load failed", e);
  }

  currentY += iconH + verticalGap;

  // 5. 绘制文案
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const textColor = getRandomColor();
  const fontStyle = config.fontMode === 'random' ? getRandomFont() : 'Inter';
  const fontWeight = config.fontWeight === 'random' ? getRandomWeight() : (config.fontWeight === 'bold' ? 'bold' : 'normal');
  const maxWidth = canvas.width * 0.88;

  ctx.fillStyle = textColor;
  lines.forEach((line) => {
    let fontSize = baseFontSize;
    ctx.font = `${fontWeight} ${fontSize}px ${fontStyle}`;
    let metrics = ctx.measureText(line);
    while (metrics.width > maxWidth && fontSize > 20) {
      fontSize -= 2;
      ctx.font = `${fontWeight} ${fontSize}px ${fontStyle}`;
      metrics = ctx.measureText(line);
    }
    ctx.fillText(line, canvas.width / 2, currentY);
    currentY += lineHeight;
  });

  // 6. 绘制二维码 (间距与上方保持一致)
  currentY += verticalGap - (lineHeight - baseFontSize * 1.1); // 微调对齐
  
  try {
    const qrImg = await loadImage(qrUrl);
    const qrX = (canvas.width - qrW) / 2;
    const qrY = currentY;
    ctx.drawImage(qrImg, qrX, qrY, qrW, qrH);
  } catch (e) {
    console.error("QR load failed", e);
  }

  return canvas.toDataURL('image/png');
};
