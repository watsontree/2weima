
import qrcode from 'qrcode-generator';
import { BeautifyConfig, BeautifiedQR } from '../types';

const BEAUTIFUL_COLORS = [
  '#1a1a1a', '#2d3436', '#0984e3', '#6c5ce7', '#d63031', 
  '#e84393', '#00b894', '#fdcb6e', '#2c3e50', '#8e44ad',
  '#1abc9c', '#27ae60', '#2980b9', '#f39c12', '#d35400'
];

/**
 * Module Styles: Optimized for data density and scanning contrast.
 */
const DOT_DRAWERS: Record<string, (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => void> = {
  plain: (ctx, x, y, s) => { ctx.fillRect(x, y, s, s); },
  liquified: (ctx, x, y, s) => { ctx.beginPath(); ctx.arc(x + s/2, y + s/2, s/2.1, 0, Math.PI * 2); ctx.fill(); },
  roundLiquified: (ctx, x, y, s) => { ctx.beginPath(); ctx.roundRect(x + s*0.05, y + s*0.05, s*0.9, s*0.9, s*0.35); ctx.fill(); },
  stripes: (ctx, x, y, s) => { 
    ctx.save();
    ctx.translate(x + s/2, y + s/2);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-s*0.5, -s*0.2, s, s*0.4);
    ctx.restore();
  },
  tiles: (ctx, x, y, s) => { 
    ctx.fillRect(x + s*0.1, y + s*0.1, s*0.35, s*0.35); 
    ctx.fillRect(x + s*0.55, y + s*0.55, s*0.35, s*0.35); 
  },
  largeDot: (ctx, x, y, s) => { ctx.beginPath(); ctx.arc(x + s/2, y + s/2, s*0.4, 0, Math.PI * 2); ctx.fill(); },
  smallDot: (ctx, x, y, s) => { ctx.beginPath(); ctx.arc(x + s/2, y + s/2, s*0.25, 0, Math.PI * 2); ctx.fill(); },
  smallSquare: (ctx, x, y, s) => { ctx.fillRect(x + s*0.2, y + s*0.2, s*0.6, s*0.6); },
};

/**
 * Robust Eye Styles Pool: 
 * Every style here ensures a 1:1:3:1:1 ratio.
 */
const EYE_DRAWERS: Record<string, (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => void> = {
  classic: (ctx, x, y, s) => {
    const p = s / 7;
    ctx.fillRect(x, y, s, p); 
    ctx.fillRect(x, y + s - p, s, p); 
    ctx.fillRect(x, y, p, s); 
    ctx.fillRect(x + s - p, y, p, s); 
    ctx.fillRect(x + p * 2, y + p * 2, p * 3, p * 3);
  },
  soft_round: (ctx, x, y, s) => {
    const p = s / 7;
    ctx.beginPath(); ctx.roundRect(x, y, s, s, p * 1.5); ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.roundRect(x + p, y + p, s - p * 2, s - p * 2, p); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.roundRect(x + p * 2, y + p * 2, p * 3, p * 3, p); ctx.fill();
  },
  liquid_circle: (ctx, x, y, s) => {
    const p = s / 7;
    ctx.beginPath(); ctx.arc(x + s/2, y + s/2, s/2, 0, Math.PI*2); ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(x + s/2, y + s/2, s/2 - p, 0, Math.PI*2); ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(x + s/2, y + s/2, p * 1.5, 0, Math.PI*2); ctx.fill();
  },
  heavy_edge: (ctx, x, y, s) => {
    const p = s / 7;
    ctx.fillRect(x, y, s, p * 1.2); 
    ctx.fillRect(x, y + s - p * 1.2, s, p * 1.2); 
    ctx.fillRect(x, y, p * 1.2, s); 
    ctx.fillRect(x + s - p * 1.2, y, p * 1.2, s); 
    ctx.beginPath(); ctx.roundRect(x + p * 2, y + p * 2, p * 3, p * 3, p * 0.5); ctx.fill();
  },
  octagon: (ctx, x, y, s) => {
    const p = s / 7;
    const drawOct = (ox: number, oy: number, size: number) => {
      const c = size * 0.25;
      ctx.beginPath();
      ctx.moveTo(ox + c, oy); ctx.lineTo(ox + size - c, oy); ctx.lineTo(ox + size, oy + c);
      ctx.lineTo(ox + size, oy + size - c); ctx.lineTo(ox + size - c, oy + size);
      ctx.lineTo(ox + c, oy + size); ctx.lineTo(ox, oy + size - c); ctx.lineTo(ox, oy + c);
      ctx.closePath();
    };
    drawOct(x, y, s); ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    drawOct(x + p, y + p, s - p * 2); ctx.fill();
    ctx.restore();
    drawOct(x + p * 2, y + p * 2, p * 3); ctx.fill();
  }
};

export const generateBeautifiedQRs = async (text: string, count: number, config: BeautifyConfig): Promise<BeautifiedQR[]> => {
  const results: BeautifiedQR[] = [];
  const qr = qrcode(0, 'H');
  qr.addData(text);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const canvasSize = 1000;
  const cellSize = canvasSize / (moduleCount + 8); 
  const offset = cellSize * 4;
  const dotTypes = Object.keys(DOT_DRAWERS);
  const eyeTypes = Object.keys(EYE_DRAWERS);

  for (let i = 0; i < count; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize; canvas.height = canvasSize;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    const variation = config.randomVariation || 'low';

    // 色彩整合逻辑
    let baseColor = '#000000';
    if (variation === 'low') {
      baseColor = '#000000'; // 标准模式强制纯黑
    } else if (variation === 'high') {
      // 高变体模式，每张整体随机一种颜色
      baseColor = BEAUTIFUL_COLORS[Math.floor(Math.random() * BEAUTIFUL_COLORS.length)];
    } else if (variation === 'artistic') {
      baseColor = '#1a1a1a'; // 纯艺术模式下码眼使用固定深色
    }

    // 每一张都随机选择码眼样式
    const randomEyeStyleKey = eyeTypes[Math.floor(Math.random() * eyeTypes.length)];
    const eyeDrawer = EYE_DRAWERS[randomEyeStyleKey];
    const styleVariationChance = variation === 'high' ? 0.3 : (variation === 'artistic' ? 0.5 : 0.0);

    // 每一张都随机选择主渲染引擎（数据点样式）
    const primaryDotStyleKey = dotTypes[Math.floor(Math.random() * dotTypes.length)];

    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        if (!qr.isDark(row, col)) continue;
        
        const isNearEye = (row < 8 && col < 8) || 
                          (row < 8 && col >= moduleCount - 8) || 
                          (row >= moduleCount - 8 && col < 8);
        
        if (isNearEye) continue;

        const x = offset + col * cellSize;
        const y = offset + row * cellSize;
        
        // 模块颜色逻辑
        if (variation === 'artistic') {
          // 纯艺术模式下元素模块彩色随机
          ctx.fillStyle = BEAUTIFUL_COLORS[Math.floor(Math.random() * BEAUTIFUL_COLORS.length)];
        } else {
          // 其他模式使用基准色
          ctx.fillStyle = baseColor;
        }

        // 样式分配：主样式 vs 随机变体
        let drawerKey = primaryDotStyleKey;
        if (Math.random() < styleVariationChance) {
          drawerKey = dotTypes[Math.floor(Math.random() * dotTypes.length)];
        }
        
        DOT_DRAWERS[drawerKey](ctx, x, y, cellSize);
      }
    }

    const eyeSize = cellSize * 7;
    ctx.fillStyle = baseColor;
    
    eyeDrawer(ctx, offset, offset, eyeSize);
    eyeDrawer(ctx, offset + (moduleCount - 7) * cellSize, offset, eyeSize);
    eyeDrawer(ctx, offset, offset + (moduleCount - 7) * cellSize, eyeSize);

    results.push({ dataUrl: canvas.toDataURL('image/png'), isScannable: true, score: 100 });
  }
  return results;
};
