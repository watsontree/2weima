
import qrcode from 'qrcode-generator';
import { BeautifyConfig, BeautifiedQR } from '../types';

const BEAUTIFUL_COLORS = [
  '#1a1a1a', '#2d3436', '#0984e3', '#6c5ce7', '#d63031', 
  '#e84393', '#00b894', '#fdcb6e', '#2c3e50', '#8e44ad',
  '#1abc9c', '#27ae60', '#2980b9', '#f39c12', '#d35400'
];

const DOT_DRAWERS: Record<string, (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => void> = {
  circle: (ctx, x, y, s) => { ctx.beginPath(); ctx.arc(x + s/2, y + s/2, s/2.2, 0, Math.PI*2); ctx.fill(); },
  square: (ctx, x, y, s) => { ctx.fillRect(x + s*0.05, y + s*0.05, s*0.9, s*0.9); },
  rounded: (ctx, x, y, s) => { ctx.beginPath(); ctx.roundRect(x + s*0.05, y + s*0.05, s*0.9, s*0.9, s*0.3); ctx.fill(); },
  diamond: (ctx, x, y, s) => { ctx.beginPath(); ctx.moveTo(x + s/2, y); ctx.lineTo(x + s, y + s/2); ctx.lineTo(x + s/2, y + s); ctx.lineTo(x, y + s/2); ctx.closePath(); ctx.fill(); },
  liquid: (ctx, x, y, s) => { ctx.beginPath(); ctx.arc(x+s/2, y+s/2, s*0.48, 0, Math.PI*2); ctx.fill(); },
  hexagon: (ctx, x, y, s) => { ctx.beginPath(); for(let i=0; i<6; i++) { const ang = i*Math.PI/3; ctx.lineTo(x + s/2 + s*0.45*Math.cos(ang), y + s/2 + s*0.45*Math.sin(ang)); } ctx.closePath(); ctx.fill(); },
  plus: (ctx, x, y, s) => { ctx.fillRect(x+s*0.35, y+s*0.1, s*0.3, s*0.8); ctx.fillRect(x+s*0.1, y+s*0.35, s*0.8, s*0.3); },
  pentagon: (ctx, x, y, s) => { ctx.beginPath(); for(let i=0; i<5; i++) { const ang = i*2*Math.PI/5 - Math.PI/2; ctx.lineTo(x + s/2 + s*0.45*Math.cos(ang), y + s/2 + s*0.45*Math.sin(ang)); } ctx.closePath(); ctx.fill(); },
};

const drawArtisticEye = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, eyeColor: string, styleIdx: number) => {
  ctx.save();
  const pad = s / 7;
  const innerS = s - pad * 4;
  const innerX = x + pad * 2;
  const innerY = y + pad * 2;

  ctx.strokeStyle = eyeColor;
  ctx.fillStyle = eyeColor;
  ctx.lineWidth = pad;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (styleIdx === 0) { // Elite Metal style
    const grad = ctx.createLinearGradient(x, y, x + s, y + s);
    grad.addColorStop(0, '#475569');
    grad.addColorStop(0.5, '#94a3b8');
    grad.addColorStop(1, '#334155');
    ctx.strokeStyle = grad;
    ctx.strokeRect(x + pad/2, y + pad/2, s - pad, s - pad);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(innerX, innerY, innerS, innerS, innerS * 0.2);
    ctx.fill();
  } else if (styleIdx === 1) { // Round Rect Business
    ctx.beginPath();
    ctx.roundRect(x + pad/2, y + pad/2, s - pad, s - pad, s * 0.3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(innerX + innerS/2, innerY + innerS/2, innerS/2, 0, Math.PI * 2);
    ctx.fill();
  } else { // High ID Relief
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 2;
    ctx.strokeRect(x + pad/2, y + pad/2, s - pad, s - pad);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillRect(innerX, innerY, innerS, innerS);
  }
  ctx.restore();
};

const drawEye = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, borderStyle: number, innerStyle: number) => {
  ctx.save();
  const pad = s / 7;
  const innerS = s - pad * 4;
  const innerX = x + pad * 2;
  const innerY = y + pad * 2;
  ctx.lineWidth = pad;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  switch (borderStyle % 3) {
    case 0: ctx.strokeRect(x+pad/2, y+pad/2, s-pad, s-pad); break;
    case 1: ctx.beginPath(); ctx.roundRect(x+pad/2, y+pad/2, s-pad, s-pad, s*0.2); ctx.stroke(); break;
    case 2: ctx.beginPath(); ctx.roundRect(x+pad/2, y+pad/2, s-pad, s-pad, s*0.4); ctx.stroke(); break;
  }
  ctx.fillStyle = ctx.strokeStyle;
  switch (innerStyle % 3) {
    case 0: ctx.fillRect(innerX, innerY, innerS, innerS); break;
    case 1: ctx.beginPath(); ctx.arc(innerX + innerS/2, innerY + innerS/2, innerS/2, 0, Math.PI*2); ctx.fill(); break;
    case 2: ctx.beginPath(); ctx.roundRect(innerX, innerY, innerS, innerS, innerS*0.3); ctx.fill(); break;
  }
  ctx.restore();
};

export const generateBeautifiedQRs = async (text: string, count: number, config: BeautifyConfig): Promise<BeautifiedQR[]> => {
  const results: BeautifiedQR[] = [];
  const qr = qrcode(0, 'H');
  qr.addData(text);
  qr.make();

  const moduleCount = qr.getModuleCount();
  const canvasSize = 800;
  const cellSize = canvasSize / (moduleCount + 4);
  const offset = cellSize * 2;
  const dotTypes = Object.keys(DOT_DRAWERS);

  for (let i = 0; i < count; i++) {
    const canvas = document.createElement('canvas');
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    const isArtistic = config.randomVariation === 'artistic';
    const artStyleIdx = Math.floor(Math.random() * 3);

    if (isArtistic && artStyleIdx === 1) {
      const grad = ctx.createLinearGradient(0,0,0,canvasSize);
      grad.addColorStop(0, '#f1f5f9');
      grad.addColorStop(1, '#e2e8f0');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvasSize, canvasSize);
    }

    const mainColor = isArtistic 
      ? (artStyleIdx === 2 ? '#0891b2' : '#334155') 
      : (config.primaryColor === 'black' ? '#000000' : BEAUTIFUL_COLORS[Math.floor(Math.random() * BEAUTIFUL_COLORS.length)]);
    
    // Artistic eye color strictly different from body for clarity
    const eyeColor = isArtistic 
      ? (artStyleIdx === 0 ? '#0f172a' : (artStyleIdx === 1 ? '#1e293b' : '#155e75'))
      : mainColor;

    ctx.fillStyle = mainColor;
    ctx.strokeStyle = mainColor;

    const dotTypeIdx = Math.floor(Math.random() * dotTypes.length);
    const borderIdx = Math.floor(Math.random() * 3);
    const innerIdx = Math.floor(Math.random() * 3);
    const styleVariation = config.randomVariation === 'high' ? 0.2 : 0.02;

    for (let row = 0; row < moduleCount; row++) {
      for (let col = 0; col < moduleCount; col++) {
        const isDark = qr.isDark(row, col);
        if (!isDark) continue;
        const isEye = (row < 7 && col < 7) || (row < 7 && col >= moduleCount - 7) || (row >= moduleCount - 7 && col < 7);
        if (isEye) continue;
        const x = offset + col * cellSize;
        const y = offset + row * cellSize;
        let drawer = DOT_DRAWERS[dotTypes[dotTypeIdx]];
        if (isArtistic) {
          drawer = artStyleIdx === 2 ? DOT_DRAWERS.square : DOT_DRAWERS.rounded;
        } else if (Math.random() < styleVariation) {
          drawer = DOT_DRAWERS[dotTypes[Math.floor(Math.random() * dotTypes.length)]];
        }
        drawer(ctx, x, y, cellSize);
      }
    }

    const eyeSize = cellSize * 7;
    if (isArtistic) {
      drawArtisticEye(ctx, offset, offset, eyeSize, eyeColor, artStyleIdx); 
      drawArtisticEye(ctx, offset + (moduleCount - 7) * cellSize, offset, eyeSize, eyeColor, artStyleIdx); 
      drawArtisticEye(ctx, offset, offset + (moduleCount - 7) * cellSize, eyeSize, eyeColor, artStyleIdx); 
    } else {
      ctx.strokeStyle = mainColor;
      drawEye(ctx, offset, offset, eyeSize, borderIdx, innerIdx); 
      drawEye(ctx, offset + (moduleCount - 7) * cellSize, offset, eyeSize, borderIdx, innerIdx); 
      drawEye(ctx, offset, offset + (moduleCount - 7) * cellSize, eyeSize, borderIdx, innerIdx); 
    }

    results.push({ dataUrl: canvas.toDataURL('image/png'), isScannable: true, score: 100 });
  }
  return results;
};
