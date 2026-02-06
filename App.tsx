
import React, { useState, useRef, useEffect } from 'react';
import JSZip from 'jszip';
import { Asset, AddressAsset, Library, TextLibrary, GeneratorConfig, GeneratedItem, BeautifyConfig, BeautifiedQR, User } from './types';
import { generateImage } from './services/imageService';
import { getCreativeVariations } from './services/geminiService';
import { generateBeautifiedQRs } from './services/qrBeautifyService';
import { authService } from './services/authService';
import { storageService } from './services/storageService';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    aistudio?: AIStudio;
  }
}

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(authService.getCurrentUser());
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [manualKey, setManualKey] = useState<string>(localStorage.getItem('CUSTOM_GEMINI_API_KEY') || '');
  const [showKey, setShowKey] = useState(false);

  const [iconLibraries, setIconLibraries] = useState<Library<Asset>[]>([{ id: 'default-icons', name: '默认图标库', items: [], isActive: true }]);
  const [qrLibraries, setQrLibraries] = useState<Library<Asset>[]>([{ id: 'default-qr', name: '我的二维码库', items: [], isActive: true }]);
  const [textLibraries, setTextLibraries] = useState<TextLibrary[]>([{ id: 'default-text', name: '默认文案库', content: "群聊：私域引流交流群", isActive: true }]);
  const [addressLibraries, setAddressLibraries] = useState<Library<AddressAsset>[]>([{ id: 'default-address', name: '常用地址库', items: [], isActive: true }]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generatedItems, setGeneratedItems] = useState<GeneratedItem[]>([]);
  const [activeTab, setActiveTab] = useState<'icons' | 'text' | 'qr' | 'beautify' | 'results' | 'account'>('beautify');
  const [batchCount, setBatchCount] = useState(5);
  const [previewItem, setPreviewItem] = useState<any>(null);
  const [isZipping, setIsZipping] = useState(false);

  const [alertModal, setAlertModal] = useState<{show: boolean; title: string; message: string; targetTab: 'icons' | 'text' | 'qr' | 'account' | null; }>({ show: false, title: '', message: '', targetTab: null });

  const [textGenerationMode, setTextGenerationMode] = useState<'fixed' | 'ai'>('ai');
  const [fontWeight, setFontWeight] = useState<'random' | 'bold' | 'normal'>('random');

  const [beautifyUrl, setBeautifyUrl] = useState('https://example.com');
  const [newAddressForm, setNewAddressForm] = useState({ name: '', url: '' });
  const [beautifyCount, setBeautifyCount] = useState(12);
  const [beautifiedQRs, setBeautifiedQRs] = useState<BeautifiedQR[]>([]);
  const [isBeautifying, setIsBeautifying] = useState(false);
  const [beautifyConfig, setBeautifyConfig] = useState<BeautifyConfig>({
    mode: 'camouflage', primaryColor: 'colorful', randomVariation: 'artistic', eyeStyle: 'classic'
  });

  const [passForm, setPassForm] = useState({ old: '', new: '', confirm: '' });
  const [passMsg, setPassMsg] = useState({ type: '', text: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ type: 'icons' | 'qr', libId: string } | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    const loadSavedData = async () => {
      const iconPromises = iconLibraries.map(async lib => ({ ...lib, items: await storageService.loadAssets(lib.id) }));
      setIconLibraries(await Promise.all(iconPromises));
      const qrPromises = qrLibraries.map(async lib => ({ ...lib, items: await storageService.loadAssets(lib.id) }));
      setQrLibraries(await Promise.all(qrPromises));
      const addressPromises = addressLibraries.map(async lib => ({ ...lib, items: await storageService.loadAssets(lib.id) }));
      setAddressLibraries(await Promise.all(addressPromises));
    };
    const checkKeyStatus = async () => {
      const storedKey = localStorage.getItem('CUSTOM_GEMINI_API_KEY');
      if (storedKey) setHasApiKey(true);
    };
    loadSavedData();
    checkKeyStatus();
  }, [currentUser]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    setTimeout(() => {
      const user = authService.login(loginForm.username, loginForm.password);
      if (user) {
        setCurrentUser(user);
      } else {
        setLoginError('账号或密码错误，请重试');
      }
      setIsLoggingIn(false);
    }, 600);
  };

  const handleSaveManualKey = () => {
    if (manualKey.trim()) {
      localStorage.setItem('CUSTOM_GEMINI_API_KEY', manualKey.trim());
      setHasApiKey(true);
      setPassMsg({ type: 'success', text: 'API 秘钥已手动保存至本地' });
    } else {
      localStorage.removeItem('CUSTOM_GEMINI_API_KEY');
      setHasApiKey(false);
      setPassMsg({ type: 'error', text: '已清除手动设置的秘钥' });
    }
    setTimeout(() => setPassMsg({ type: '', text: '' }), 3000);
  };

  const handleLogout = () => { authService.logout(); setCurrentUser(null); setActiveTab('beautify'); };

  const triggerUpload = (type: 'icons' | 'qr', libId: string) => {
    setUploadTarget({ type, libId });
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !uploadTarget) return;
    const newAssets: Asset[] = await Promise.all(Array.from(files).map(async (file: File) => {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      return { id: Math.random().toString(36).substr(2, 9), url: dataUrl, name: file.name };
    }));
    await storageService.saveAssets(uploadTarget.libId, newAssets);
    if (uploadTarget.type === 'icons') setIconLibraries(prev => prev.map(l => l.id === uploadTarget.libId ? { ...l, items: [...l.items, ...newAssets] } : l));
    else setQrLibraries(prev => prev.map(l => l.id === uploadTarget.libId ? { ...l, items: [...l.items, ...newAssets] } : l));
    setUploadTarget(null);
  };

  const removeAsset = async (type: 'icons' | 'qr' | 'address', libId: string, assetId: string) => {
    await storageService.deleteAsset(assetId);
    if (type === 'icons') setIconLibraries(prev => prev.map(l => l.id === libId ? { ...l, items: l.items.filter(a => a.id !== assetId) } : l));
    else if (type === 'qr') setQrLibraries(prev => prev.map(l => l.id === libId ? { ...l, items: l.items.filter(a => a.id !== assetId) } : l));
    else if (type === 'address') setAddressLibraries(prev => prev.map(l => l.id === libId ? { ...l, items: l.items.filter(a => a.id !== assetId) } : l));
  };

  const addAddressToLib = async (libId: string) => {
    if (!newAddressForm.name || !newAddressForm.url) return;
    const newAddr: AddressAsset = { id: `addr-${Date.now()}`, name: newAddressForm.name, url: newAddressForm.url };
    await storageService.saveAssets(libId, [newAddr]);
    setAddressLibraries(prev => prev.map(l => l.id === libId ? { ...l, items: [...l.items, newAddr] } : l));
    setNewAddressForm({ name: '', url: '' });
  };

  const toggleLibrary = (type: 'icons' | 'qr' | 'text' | 'address', id: string) => {
    if (type === 'icons') setIconLibraries(prev => prev.map(l => l.id === id ? { ...l, isActive: !l.isActive } : l));
    else if (type === 'qr') setQrLibraries(prev => prev.map(l => l.id === id ? { ...l, isActive: !l.isActive } : l));
    else if (type === 'text') setTextLibraries(prev => prev.map(l => l.id === id ? { ...l, isActive: !l.isActive } : l));
    else if (type === 'address') setAddressLibraries(prev => prev.map(l => l.id === id ? { ...l, isActive: !l.isActive } : l));
  };

  const removeLibrary = (type: 'icons' | 'qr' | 'text' | 'address', id: string) => {
    if (type === 'icons') setIconLibraries(prev => prev.filter(l => l.id !== id));
    else if (type === 'qr') setQrLibraries(prev => prev.filter(l => l.id !== id));
    else if (type === 'text') setTextLibraries(prev => prev.filter(l => l.id !== id));
    else if (type === 'address') setAddressLibraries(prev => prev.filter(l => l.id !== id));
  };

  const updateTextContent = (id: string, content: string) => {
    setTextLibraries(prev => prev.map(l => l.id === id ? { ...l, content } : l));
  };

  const runBeautify = async () => {
    if (!beautifyUrl.trim()) return;
    setIsBeautifying(true);
    try { 
      const count = Math.min(beautifyCount, 20);
      const results = await generateBeautifiedQRs(beautifyUrl, count, beautifyConfig); 
      setBeautifiedQRs(results); 
    } finally { setIsBeautifying(false); }
  };

  const importToLibrary = async (dataUrl: string) => {
    const activeLibId = qrLibraries.find(l => l.isActive)?.id || qrLibraries[0].id;
    const newAsset: Asset = { id: `beautified-${Date.now()}`, url: dataUrl, name: 'Artistic QR' };
    await storageService.saveAssets(activeLibId, [newAsset]);
    setQrLibraries(prev => prev.map(l => l.id === activeLibId ? { ...l, items: [...l.items, newAsset] } : l));
    setAlertModal({ show: true, title: '导入成功', message: '艺术二维码已导入库中！', targetTab: 'qr' });
  };

  const importAllToLibrary = async () => {
    if (beautifiedQRs.length === 0) return;
    const activeLibId = qrLibraries.find(l => l.isActive)?.id || qrLibraries[0].id;
    const newAssets: Asset[] = beautifiedQRs.map((qr, i) => ({ id: `beautified-${Date.now()}-${i}`, url: qr.dataUrl, name: `Artistic QR ${i+1}` }));
    await storageService.saveAssets(activeLibId, newAssets);
    setQrLibraries(prev => prev.map(l => l.id === activeLibId ? { ...l, items: [...l.items, ...newAssets] } : l));
    setAlertModal({ show: true, title: '批量导入完成', message: `成功导入 ${newAssets.length} 个码点！`, targetTab: 'qr' });
  };

  const startGeneration = async () => {
    const activeIcons = iconLibraries.filter(l => l.isActive).flatMap(l => l.items);
    const activeQRs = qrLibraries.filter(l => l.isActive).flatMap(l => l.items);
    const activeTextRaw = textLibraries.filter(l => l.isActive).map(l => l.content).join('\n').trim();
    
    if (activeIcons.length === 0) { setAlertModal({ show: true, title: '缺少图标', message: '请上传图标', targetTab: 'icons' }); return; }
    if (activeTextRaw === "") { setAlertModal({ show: true, title: '缺少文案', message: '请输入文案', targetTab: 'text' }); return; }
    if (activeQRs.length === 0) { setAlertModal({ show: true, title: '缺少二维码', message: '请上传二维码或进行美化', targetTab: 'qr' }); return; }

    setIsGenerating(true); setGenerationProgress(0); setActiveTab('results'); setGeneratedItems([]);

    try {
      const baseTexts = activeTextRaw.split('\n').filter(t => t.trim() !== '');
      let finalTexts: string[] = [];
      
      if (textGenerationMode === 'ai') {
        try {
          finalTexts = await getCreativeVariations(baseTexts, batchCount);
        } catch (aiErr: any) {
          console.error("AI 生成文案失败:", aiErr);
          setIsGenerating(false);
          const msg = aiErr.message || "";
          if (msg.includes("QUOTA_EXHAUSTED")) {
            setAlertModal({ show: true, title: '⚠️ AI 额度耗尽', message: '您的 Gemini API 免费额度已用完。请在【账号】页面检查您的 Key。', targetTab: 'account' });
          } else {
            setAlertModal({ show: true, title: '❌ AI 生成故障', message: `AI 暂时无法生成文案: ${msg}。系统将尝试按固定文案继续生成。`, targetTab: null });
            finalTexts = Array.from({length: batchCount}, (_, i) => baseTexts[i % baseTexts.length]);
          }
          return;
        }
      } else {
        finalTexts = Array.from({length: batchCount}, (_, i) => baseTexts[i % baseTexts.length]);
      }

      const config: GeneratorConfig = { batchCount, minScale: 0.98, maxScale: 1.02, textPool: finalTexts, icons: activeIcons, qrCodes: activeQRs, canvasWidth: 1200, canvasHeight: 1800, fontMode: 'random', fontWeight };

      for (let i = 0; i < batchCount; i++) {
        const text = finalTexts[i % finalTexts.length];
        const icon = activeIcons[Math.floor(Math.random() * activeIcons.length)];
        const qr = activeQRs[Math.floor(Math.random() * activeQRs.length)];
        try {
          const dataUrl = await generateImage(config, text, icon.url, qr.url);
          setGeneratedItems(prev => [...prev, { id: `gen-${i}-${Date.now()}`, dataUrl, text, iconId: icon.id, qrId: qr.id }]);
          setGenerationProgress(Math.round(((i + 1) / batchCount) * 100));
          await new Promise(r => setTimeout(r, 50));
        } catch (err) { console.error(err); }
      }
    } finally { setIsGenerating(false); }
  };

  const downloadAllAsZip = async () => {
    if (generatedItems.length === 0) return;
    setIsZipping(true);
    const zip = new JSZip();
    generatedItems.forEach((item, i) => zip.file(`marketing-gen-${i+1}.png`, item.dataUrl.split(',')[1], { base64: true }));
    const blob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Batch-Export-${Date.now()}.zip`;
    link.click();
    setIsZipping(false);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passForm.new !== passForm.confirm) { setPassMsg({ type: 'error', text: '密码不一致' }); return; }
    if (authService.changePassword(currentUser!.username, passForm.old, passForm.new)) {
      setPassMsg({ type: 'success', text: '修改成功' }); setPassForm({ old: '', new: '', confirm: '' });
    } else { setPassMsg({ type: 'error', text: '原密码错误' }); }
  };

  if (!currentUser) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#F8FAFC] p-6 overflow-hidden relative">
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-indigo-200/30 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-purple-200/30 blur-[120px] rounded-full"></div>
        <div className="w-full max-w-[460px] bg-white rounded-[3rem] shadow-2xl border border-white p-12 relative z-10 animate-in fade-in zoom-in duration-500">
          <div className="flex flex-col items-center mb-10">
            <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white font-black text-4xl shadow-2xl shadow-indigo-200 mb-6">G</div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">欢迎回来</h1>
            <p className="text-slate-400 mt-2 font-medium">请登录以继续使用画报合成系统</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">管理员账号</label>
              <input type="text" required className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-bold" placeholder="请输入账号" value={loginForm.username} onChange={(e) => setLoginForm({...loginForm, username: e.target.value})} />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 mb-2">登录密码</label>
              <input type="password" required className="w-full px-6 py-5 bg-slate-50 border border-slate-100 rounded-[1.5rem] outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-bold" placeholder="请输入密码" value={loginForm.password} onChange={(e) => setLoginForm({...loginForm, password: e.target.value})} />
            </div>
            {loginError && <div className="p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold text-center animate-bounce">{loginError}</div>}
            <button type="submit" disabled={isLoggingIn} className="w-full py-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-[1.5rem] font-black shadow-2xl shadow-indigo-200 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"> {isLoggingIn ? <LoadingSpinner /> : '立即进入系统'} </button>
          </form>
          <div className="mt-12 pt-8 border-t border-slate-50 text-center">
            <p className="text-slate-300 text-[11px] font-bold">默认测试凭据: wsadwdf / wsadwdf</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col md:flex-row bg-slate-50 font-sans overflow-hidden relative">
      {previewItem && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-slate-900/95 backdrop-blur-md animate-in fade-in duration-300" onClick={() => setPreviewItem(null)}>
          <div className="relative max-w-5xl w-full h-full flex flex-col items-center justify-center gap-6" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/20 relative group">
              <img src={previewItem.dataUrl} className="max-h-[85vh] w-auto object-contain" alt="Preview" />
              <div className="absolute inset-x-0 bottom-0 p-8 bg-gradient-to-t from-black/80 to-transparent flex items-end justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xl font-black drop-shadow-lg">{previewItem.text}</p>
                <button onClick={() => { const link = document.createElement('a'); link.href = previewItem.dataUrl; link.download = `gen-${previewItem.id}.png`; link.click(); }} className="px-8 py-4 bg-white text-indigo-600 rounded-2xl font-black shadow-2xl flex items-center gap-2 hover:scale-105 transition-transform"> <DownloadIcon size={24} /> 下载超清原图 </button>
              </div>
            </div>
            <button onClick={() => setPreviewItem(null)} className="px-10 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full font-bold border border-white/10 backdrop-blur-sm transition-all"> 点击此处或背景关闭预览 </button>
          </div>
        </div>
      )}
      {alertModal.show && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm transition-all">
          <div className="w-full max-sm:px-6 w-full max-w-sm bg-white rounded-[2.5rem] shadow-2xl p-8 transform animate-[pop_0.3s_ease-out]">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${alertModal.title.includes('❌') || alertModal.title.includes('⚠️') ? 'bg-red-50 text-red-500' : 'bg-amber-50 text-amber-500'}`}> <WarningIcon size={32} /> </div>
            <h2 className="text-xl font-black text-slate-900 text-center mb-2">{alertModal.title}</h2>
            <p className="text-slate-500 text-center text-sm leading-relaxed mb-8">{alertModal.message}</p>
            <div className="space-y-3">
              <button onClick={() => { if (alertModal.targetTab) setActiveTab(alertModal.targetTab); setAlertModal({ ...alertModal, show: false }); }} className="w-full py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2"> {alertModal.targetTab ? '立即前往设置' : '确 认'} </button>
              <button onClick={() => setAlertModal({ ...alertModal, show: false })} className="w-full py-4 bg-slate-50 hover:bg-slate-100 text-slate-400 rounded-2xl font-bold transition-all"> 关 闭 </button>
            </div>
          </div>
        </div>
      )}

      <aside className="w-full md:w-24 bg-slate-900 flex md:flex-col items-center py-4 md:py-8 gap-6 shadow-2xl z-50">
        <div className="w-12 h-12 bg-indigo-500 rounded-xl flex items-center justify-center text-white font-black text-2xl mb-4">G</div>
        <nav className="flex md:flex-col gap-5 flex-1 justify-center md:justify-start">
          <NavBtn active={activeTab === 'beautify'} onClick={() => setActiveTab('beautify')} icon={<MagicIcon />} label="美化" />
          <NavBtn active={activeTab === 'qr'} onClick={() => setActiveTab('qr')} icon={<QRIcon />} label="码库" />
          <NavBtn active={activeTab === 'icons'} onClick={() => setActiveTab('icons')} icon={<IconSetIcon />} label="图标" />
          <NavBtn active={activeTab === 'text'} onClick={() => setActiveTab('text')} icon={<TextIcon />} label="文案" />
          <div className="hidden md:block h-px bg-slate-800 mx-4" />
          <NavBtn active={activeTab === 'results'} onClick={() => setActiveTab('results')} icon={<GalleryIcon />} label="画廊" />
          <div className="md:mt-auto"> <NavBtn active={activeTab === 'account'} onClick={() => setActiveTab('account')} icon={<UserIcon />} label="账号" /> </div>
        </nav>
      </aside>

      {activeTab !== 'account' && (
        <aside className="w-full md:w-[320px] lg:w-[400px] bg-white border-r border-slate-200 h-full flex flex-col shadow-sm">
          <div className="p-6 flex-1 overflow-y-auto">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight mb-6"> {activeTab === 'icons' ? '图标管理' : activeTab === 'text' ? '文案库' : activeTab === 'qr' ? '码库' : activeTab === 'beautify' ? '美化' : '画廊'} </h2>
            <div className="space-y-6">
              {activeTab === 'icons' && iconLibraries.map(lib => <LibrarySection key={lib.id} title={lib.name} isActive={lib.isActive} onToggle={() => toggleLibrary('icons', lib.id)} onRemove={() => removeLibrary('icons', lib.id)} onAdd={() => triggerUpload('icons', lib.id)}> <div className="grid grid-cols-4 gap-2"> {lib.items.map(item => <AssetItem key={item.id} url={item.url} onRemove={() => removeAsset('icons', lib.id, item.id)} />)} </div> </LibrarySection>)}
              {activeTab === 'text' && (
                <div className="space-y-6">
                  <div className="bg-indigo-50/50 p-5 rounded-3xl border border-indigo-100">
                    <label className="block text-xs font-black text-indigo-400 uppercase tracking-widest mb-4">生成设置</label>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => setTextGenerationMode('fixed')} className={`py-3 text-[10px] font-black rounded-xl border transition-all ${textGenerationMode === 'fixed' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border-slate-100'}`}>固定文案</button>
                        <button onClick={() => setTextGenerationMode('ai')} className={`py-3 text-[10px] font-black rounded-xl border transition-all ${textGenerationMode === 'ai' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border-slate-100'}`}>AI 智能</button>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button onClick={() => setFontWeight('random')} className={`py-3 text-[10px] font-black rounded-xl border transition-all ${fontWeight === 'random' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border-slate-100'}`}>随机重</button>
                        <button onClick={() => setFontWeight('bold')} className={`py-3 text-[10px] font-black rounded-xl border transition-all ${fontWeight === 'bold' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border-slate-100'}`}>加粗</button>
                        <button onClick={() => setFontWeight('normal')} className={`py-3 text-[10px] font-black rounded-xl border transition-all ${fontWeight === 'normal' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-500 border-slate-100'}`}>常规</button>
                      </div>
                    </div>
                  </div>
                  {textLibraries.map(lib => <LibrarySection key={lib.id} title={lib.name} isActive={lib.isActive} onToggle={() => toggleLibrary('text', lib.id)} onRemove={() => removeLibrary('text', lib.id)}> <textarea className="w-full h-48 p-4 text-sm border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none bg-slate-50 font-medium" value={lib.content} onChange={(e) => updateTextContent(lib.id, e.target.value)} /> </LibrarySection>)}
                </div>
              )}
              {activeTab === 'qr' && qrLibraries.map(lib => <LibrarySection key={lib.id} title={lib.name} isActive={lib.isActive} onToggle={() => toggleLibrary('qr', lib.id)} onRemove={() => removeLibrary('qr', lib.id)} onAdd={() => triggerUpload('qr', lib.id)}> <div className="grid grid-cols-4 gap-2"> {lib.items.map(item => <AssetItem key={item.id} url={item.url} onRemove={() => removeAsset('qr', lib.id, item.id)} />)} </div> </LibrarySection>)}
              {activeTab === 'beautify' && (
                <div className="space-y-6">
                  <div className="bg-slate-50 p-5 rounded-[2.5rem] border border-slate-100 space-y-6">
                    <div> <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">目标地址 (URL)</label> <input type="text" className="w-full p-4 text-sm border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none bg-white" value={beautifyUrl} onChange={(e) => setBeautifyUrl(e.target.value)} /> </div>
                    <div> <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-3 ml-1">风格选择</label>
                      <div className="flex gap-2">
                        <button onClick={() => setBeautifyConfig(p => ({ ...p, randomVariation: 'low' }))} className={`flex-1 py-3 text-[10px] font-black rounded-xl border transition-all ${beautifyConfig.randomVariation === 'low' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-500 border-slate-100'}`}>标准</button>
                        <button onClick={() => setBeautifyConfig(p => ({ ...p, randomVariation: 'high' }))} className={`flex-1 py-3 text-[10px] font-black rounded-xl border transition-all ${beautifyConfig.randomVariation === 'high' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-500 border-slate-100'}`}>高变体</button>
                        <button onClick={() => setBeautifyConfig(p => ({ ...p, randomVariation: 'artistic' }))} className={`flex-1 py-3 text-[10px] font-black rounded-xl border transition-all ${beautifyConfig.randomVariation === 'artistic' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-500 border-slate-100'}`}>全彩艺术</button>
                      </div>
                    </div>
                    <button onClick={runBeautify} disabled={isBeautifying} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black shadow-2xl transition-all"> {isBeautifying ? <LoadingSpinner size={20} /> : '执行 AI 美化渲染'} </button>
                  </div>
                  
                  {addressLibraries.map(lib => (
                    <div key={lib.id} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">常用地址库</h3>
                        <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center"><NavIcon size={14} /></div>
                      </div>
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {lib.items.map(addr => (
                          <div key={addr.id} className="group relative flex items-center justify-between p-3 bg-slate-50 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer border border-transparent hover:border-indigo-100" onClick={() => setBeautifyUrl(addr.url)}>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-black text-slate-700 truncate">{addr.name}</span>
                              <span className="text-[9px] text-slate-400 truncate opacity-60">{addr.url}</span>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); removeAsset('address', lib.id, addr.id); }} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 transition-all">
                              <TrashIcon size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="pt-2 border-t border-slate-50 space-y-2">
                        <input type="text" placeholder="别名" className="w-full px-4 py-2 text-xs bg-slate-50 border border-slate-100 rounded-xl outline-none" value={newAddressForm.name} onChange={(e) => setNewAddressForm({...newAddressForm, name: e.target.value})} />
                        <div className="flex gap-2">
                          <input type="text" placeholder="URL 地址" className="flex-1 px-4 py-2 text-xs bg-slate-50 border border-slate-100 rounded-xl outline-none" value={newAddressForm.url} onChange={(e) => setNewAddressForm({...newAddressForm, url: e.target.value})} />
                          <button onClick={() => addAddressToLib(lib.id)} className="px-4 bg-slate-900 text-white rounded-xl text-xs font-black hover:bg-slate-800 transition-all">添加</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="p-6 border-t border-slate-100 bg-white sticky bottom-0 z-10 space-y-4">
            {activeTab === 'beautify' && beautifiedQRs.length > 0 && (
              <button onClick={importAllToLibrary} className="w-full py-4 bg-white border-2 border-indigo-600 text-indigo-600 rounded-2xl font-black hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
                <QRIcon size={20} /> 同步结果至码库
              </button>
            )}
            <div className="flex justify-between items-center"> 
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">合成批次</span> 
              <span className="text-sm font-black text-indigo-600 px-3 py-1 bg-indigo-50 rounded-full">{batchCount} 张</span> 
            </div>
            <input type="range" min="1" max="100" className="w-full accent-indigo-600 h-1 bg-slate-100 rounded-lg appearance-none cursor-pointer" value={batchCount} onChange={(e) => setBatchCount(parseInt(e.target.value))} />
            <button onClick={startGeneration} disabled={isGenerating} className={`w-full h-16 flex items-center justify-center gap-3 rounded-2xl font-black text-white transition-all shadow-2xl ${isGenerating ? 'bg-slate-900' : 'bg-indigo-600 hover:bg-indigo-700'}`}> {isGenerating ? <div className="flex items-center gap-2"><LoadingSpinner /> <span className="text-sm">正在合成 ({generationProgress}%)</span></div> : '立即批量合成画报'} </button>
          </div>
        </aside>
      )}

      <main className="flex-1 flex flex-col h-full bg-slate-50/50 overflow-hidden">
        <header className="p-10 pb-6 flex items-center justify-between">
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter"> {activeTab === 'account' ? '账号配置中心' : activeTab === 'beautify' ? 'AI 艺术二维码' : '合成画廊'} </h1>
          <div className="flex gap-4">
            {activeTab === 'results' && generatedItems.length > 0 && <button onClick={downloadAllAsZip} disabled={isZipping} className="flex items-center gap-2 px-10 py-4 bg-emerald-600 text-white rounded-2xl font-black shadow-2xl hover:-translate-y-1 transition-all"> {isZipping ? <LoadingSpinner size={20} /> : <><DownloadIcon size={20} /> 打包下载 ZIP</>} </button>}
          </div>
        </header>
        <div className="flex-1 overflow-y-auto px-10 pb-10">
          {activeTab === 'account' ? (
             <div className="max-w-4xl mx-auto space-y-10 pt-4 pb-20">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 <div className="bg-white p-12 rounded-[3rem] shadow-sm border border-slate-100 text-center"> 
                   <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl font-black"> {currentUser?.username[0].toUpperCase()} </div> 
                   <h2 className="text-2xl font-black">{currentUser?.username}</h2> 
                   <button onClick={handleLogout} className="w-full py-5 bg-red-50 text-red-600 font-bold rounded-2xl mt-10">退出登录</button> 
                 </div>
                 <div className="md:col-span-2 space-y-8">
                    <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                      <h3 className="text-xl font-black mb-8 flex items-center gap-3"> <div className="w-2 h-8 bg-indigo-600 rounded-full"></div> AI 服务秘钥设置 </h3>
                      <div className="space-y-6">
                        <div className="p-6 bg-slate-50 rounded-[2rem] border border-slate-100 space-y-4">
                          <label className="block text-xs font-black text-slate-500 uppercase tracking-widest">手动输入秘钥</label>
                          <div className="relative">
                            <input type={showKey ? "text" : "password"} placeholder="在此粘贴您的 Gemini API Key" className={`w-full px-6 py-5 bg-white rounded-2xl border outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-mono text-sm ${!hasApiKey && manualKey ? 'border-amber-300' : 'border-slate-200'}`} value={manualKey} onChange={(e) => setManualKey(e.target.value)} />
                            <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-indigo-600" onClick={() => setShowKey(!showKey)}> {showKey ? "隐藏" : "显示"} </button>
                          </div>
                          <div className="flex items-center justify-between">
                             <span className={`text-[10px] font-black ${hasApiKey ? 'text-emerald-500' : 'text-slate-300'}`}> 状态: {hasApiKey ? "● 已保存秘钥" : "○ 待保存"} </span>
                             <div className="flex gap-2"> <button onClick={handleSaveManualKey} className="px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all">保存配置</button> </div>
                          </div>
                        </div>
                        <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 text-[11px] text-amber-700 leading-relaxed">
                          <strong>温馨提示：</strong> 如果 AI 无法自动生成群名，通常是因为您的免费额度耗尽。
                        </div>
                      </div>
                    </div>
                    <div className="bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100">
                      <h3 className="text-xl font-black mb-8 flex items-center gap-3"> <div className="w-2 h-8 bg-indigo-600 rounded-full"></div> 修改密码 </h3>
                      <form onSubmit={handleChangePassword} className="space-y-6">
                        <input type="password" placeholder="当前旧密码" className="w-full px-6 py-5 bg-slate-50 rounded-2xl border border-slate-100 outline-none" value={passForm.old} onChange={(e) => setPassForm({...passForm, old: e.target.value})} />
                        <input type="password" placeholder="设置新密码" className="w-full px-6 py-5 bg-slate-50 rounded-2xl border border-slate-100 outline-none" value={passForm.new} onChange={(e) => setPassForm({...passForm, new: e.target.value})} />
                        <input type="password" placeholder="再次确认新密码" className="w-full px-6 py-5 bg-slate-50 rounded-2xl border border-slate-100 outline-none" value={passForm.confirm} onChange={(e) => setPassForm({...passForm, confirm: e.target.value})} />
                        {passMsg.text && <div className={`p-4 rounded-xl text-xs font-bold ${passMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{passMsg.text}</div>}
                        <button type="submit" className="px-12 py-5 bg-indigo-600 text-white rounded-2xl font-black shadow-2xl">提交更新</button>
                      </form>
                    </div>
                 </div>
               </div>
             </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12 max-w-7xl mx-auto pt-4">
              {(activeTab === 'results' ? generatedItems : beautifiedQRs).map((item: any, idx) => (
                <div key={idx} className="group relative bg-white p-4 rounded-[3rem] shadow-xl border border-slate-100 hover:shadow-2xl transition-all cursor-zoom-in transform hover:-translate-y-2" onClick={() => activeTab === 'results' && setPreviewItem(item)}>
                  <img src={item.dataUrl} className="w-full aspect-[2/3] object-contain rounded-[2.5rem] bg-slate-50" loading="lazy" />
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-[3rem] flex flex-col items-center justify-center gap-4 backdrop-blur-sm">
                    {activeTab === 'beautify' && <button onClick={(e) => { e.stopPropagation(); importToLibrary(item.dataUrl); }} className="px-8 py-3 bg-white text-slate-900 font-black rounded-2xl shadow-xl hover:scale-105 transition-all">导入至码库</button>}
                    <button onClick={(e) => { e.stopPropagation(); const link = document.createElement('a'); link.href = item.dataUrl; link.download = `gen-${idx}.png`; link.click(); }} className="px-8 py-3 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:scale-105 transition-all">下载图片</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
    </div>
  );
};

const NavBtn = ({ active, onClick, icon, label }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-2.5 p-3 rounded-2xl transition-all min-w-[64px] ${active ? 'bg-indigo-600 text-white shadow-2xl' : 'text-slate-500 hover:bg-slate-800 hover:text-white'}`}> {icon} <span className="text-[10px] font-black uppercase tracking-wider">{label}</span> </button>
);
const LibrarySection = ({ title, isActive, onToggle, onRemove, onAdd, children }: any) => (
  <div className={`p-5 rounded-[2.5rem] border transition-all ${isActive ? 'bg-white border-slate-100 shadow-sm' : 'bg-slate-50 border-transparent opacity-60 grayscale'}`}>
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3"> <input type="checkbox" checked={isActive} onChange={onToggle} className="w-4 h-4 accent-indigo-600 rounded" /> <h3 className="font-black text-slate-700 text-xs">{title}</h3> </div>
      <div className="flex gap-1.5"> {onAdd && <button onClick={onAdd} className="p-1.5 text-slate-300 hover:text-indigo-600 transition-colors"><PlusIcon size={14} /></button>} <button onClick={onRemove} className="p-1.5 text-slate-300 hover:text-red-600 transition-colors"><TrashIcon size={14} /></button> </div>
    </div>
    {children}
  </div>
);
const AssetItem = ({ url, onRemove }: any) => (
  <div className="relative group aspect-square rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 shadow-inner"> <img src={url} className="w-full h-full object-cover" /> <button onClick={onRemove} className="absolute inset-0 bg-red-600/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 font-black text-[9px] transition-opacity">移除</button> </div>
);
const LoadingSpinner = ({ size = 20 }: any) => ( <svg className="animate-spin" width={size} height={size} viewBox="0 0 24 24"> <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /> <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /> </svg> );
const MagicIcon = ({ size = 24 }: any) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/></svg>;
const QRIcon = ({ size = 24 }: any) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><rect x="7" y="7" width="3" height="3" /><rect x="14" y="7" width="3" height="3" /><rect x="7" y="14" width="3" height="3" /><path d="M14 14h3v3h-3z" /></svg>;
const IconSetIcon = ({ size = 24 }: any) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>;
const TextIcon = ({ size = 24 }: any) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>;
const GalleryIcon = ({ size = 24 }: any) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>;
const DownloadIcon = ({ size = 24 }: any) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
const UserIcon = ({ size = 24 }: any) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
const PlusIcon = ({ size = 24 }: any) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
const TrashIcon = ({ size = 24 }: any) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
const WarningIcon = ({ size = 24 }: any) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const NavIcon = ({ size = 24 }: any) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>;

export default App;
