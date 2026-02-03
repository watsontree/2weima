
import React, { useState, useRef, useEffect } from 'react';
import { Asset, Library, TextLibrary, GeneratorConfig, GeneratedItem, BeautifyConfig, BeautifiedQR, User } from './types';
import { generateImage } from './services/imageService';
import { getCreativeVariations } from './services/geminiService';
import { generateBeautifiedQRs } from './services/qrBeautifyService';
import { authService } from './services/authService';

const App: React.FC = () => {
  // --- Auth State ---
  const [currentUser, setCurrentUser] = useState<User | null>(authService.getCurrentUser());
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // --- State for Libraries ---
  const [iconLibraries, setIconLibraries] = useState<Library<Asset>[]>([
    { id: 'default-icons', name: '默认图标库', items: [], isActive: true }
  ]);
  const [qrLibraries, setQrLibraries] = useState<Library<Asset>[]>([
    { id: 'default-qr', name: '我的二维码库', items: [], isActive: true }
  ]);
  const [textLibraries, setTextLibraries] = useState<TextLibrary[]>([
    { id: 'default-text', name: '默认文案库', content: "群聊：私域引流交流群", isActive: true }
  ]);

  // --- UI State ---
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedItems, setGeneratedItems] = useState<GeneratedItem[]>([]);
  const [activeTab, setActiveTab] = useState<'icons' | 'text' | 'qr' | 'beautify' | 'results' | 'account'>('icons');
  const [batchCount, setBatchCount] = useState(5);
  const [newLibName, setNewLibName] = useState('');

  // --- Text Generation Mode ---
  const [textGenerationMode, setTextGenerationMode] = useState<'fixed' | 'ai'>('ai');

  // --- Beautify State ---
  const [beautifyUrl, setBeautifyUrl] = useState('https://example.com');
  const [beautifyCount, setBeautifyCount] = useState(12);
  const [beautifiedQRs, setBeautifiedQRs] = useState<BeautifiedQR[]>([]);
  const [isBeautifying, setIsBeautifying] = useState(false);
  const [beautifyConfig, setBeautifyConfig] = useState<BeautifyConfig>({
    mode: 'camouflage',
    primaryColor: 'random',
    randomVariation: 'low',
  });

  // --- Account State ---
  const [passForm, setPassForm] = useState({ old: '', new: '', confirm: '' });
  const [passMsg, setPassMsg] = useState({ type: '', text: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<{ type: 'icons' | 'qr', libId: string } | null>(null);

  // --- Auth Handlers ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const user = authService.login(loginForm.username, loginForm.password);
    if (user) {
      setCurrentUser(user);
      setLoginError('');
    } else {
      setLoginError('用户名或密码错误');
    }
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setActiveTab('icons');
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passForm.new !== passForm.confirm) {
      setPassMsg({ type: 'error', text: '两次输入的新密码不一致' });
      return;
    }
    const success = authService.changePassword(currentUser!.username, passForm.old, passForm.new);
    if (success) {
      setPassMsg({ type: 'success', text: '密码修改成功' });
      setPassForm({ old: '', new: '', confirm: '' });
    } else {
      setPassMsg({ type: 'error', text: '原密码错误' });
    }
  };

  // --- Library Management ---
  const addLibrary = (type: 'icons' | 'qr' | 'text') => {
    if (!newLibName.trim()) return;
    const id = Math.random().toString(36).substr(2, 9);
    const name = newLibName.trim();
    if (type === 'icons') setIconLibraries(prev => [...prev, { id, name, items: [], isActive: true }]);
    else if (type === 'qr') setQrLibraries(prev => [...prev, { id, name, items: [], isActive: true }]);
    else setTextLibraries(prev => [...prev, { id, name, content: '', isActive: true }]);
    setNewLibName('');
  };

  const removeLibrary = (type: 'icons' | 'qr' | 'text', id: string) => {
    if (type === 'icons') setIconLibraries(prev => prev.filter(l => l.id !== id));
    else if (type === 'qr') setQrLibraries(prev => prev.filter(l => l.id !== id));
    else setTextLibraries(prev => prev.filter(l => l.id !== id));
  };

  const toggleLibrary = (type: 'icons' | 'qr' | 'text', id: string) => {
    if (type === 'icons') setIconLibraries(prev => prev.map(l => l.id === id ? { ...l, isActive: !l.isActive } : l));
    else if (type === 'qr') setQrLibraries(prev => prev.map(l => l.id === id ? { ...l, isActive: !l.isActive } : l));
    else setTextLibraries(prev => prev.map(l => l.id === id ? { ...l, isActive: !l.isActive } : l));
  };

  const updateTextContent = (id: string, content: string) => {
    setTextLibraries(prev => prev.map(l => l.id === id ? { ...l, content } : l));
  };

  // --- Asset Upload ---
  const triggerUpload = (type: 'icons' | 'qr', libId: string) => {
    setUploadTarget({ type, libId });
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !uploadTarget) return;

    const newAssets: Asset[] = Array.from(files).map((file: File) => ({
      id: Math.random().toString(36).substr(2, 9),
      url: URL.createObjectURL(file),
      name: file.name,
    }));

    if (uploadTarget.type === 'icons') {
      setIconLibraries(prev => prev.map(l => l.id === uploadTarget.libId ? { ...l, items: [...l.items, ...newAssets] } : l));
    } else {
      setQrLibraries(prev => prev.map(l => l.id === uploadTarget.libId ? { ...l, items: [...l.items, ...newAssets] } : l));
    }
    setUploadTarget(null);
  };

  const removeAsset = (type: 'icons' | 'qr', libId: string, assetId: string) => {
    if (type === 'icons') {
      setIconLibraries(prev => prev.map(l => l.id === libId ? { ...l, items: l.items.filter(a => a.id !== assetId) } : l));
    } else {
      setQrLibraries(prev => prev.map(l => l.id === libId ? { ...l, items: l.items.filter(a => a.id !== assetId) } : l));
    }
  };

  // --- Beautify Function ---
  const runBeautify = async () => {
    if (!beautifyUrl.trim()) return;
    setIsBeautifying(true);
    try {
      const results = await generateBeautifiedQRs(beautifyUrl, beautifyCount, beautifyConfig);
      setBeautifiedQRs(results);
    } finally {
      setIsBeautifying(false);
    }
  };

  const importToLibrary = (dataUrl: string) => {
    const activeLibId = qrLibraries.find(l => l.isActive)?.id || qrLibraries[0].id;
    const newAsset: Asset = {
      id: `beautified-${Date.now()}`,
      url: dataUrl,
      name: 'Artistic QR',
    };
    setQrLibraries(prev => prev.map(l => l.id === activeLibId ? { ...l, items: [...l.items, newAsset] } : l));
    alert("已成功导入到二维码库！");
  };

  const importAllToLibrary = () => {
    if (beautifiedQRs.length === 0) return;
    const activeLibId = qrLibraries.find(l => l.isActive)?.id || qrLibraries[0].id;
    const newAssets: Asset[] = beautifiedQRs.map((qr, i) => ({
      id: `beautified-${Date.now()}-${i}`,
      url: qr.dataUrl,
      name: `Artistic QR ${i+1}`
    }));
    setQrLibraries(prev => prev.map(l => l.id === activeLibId ? { ...l, items: [...l.items, ...newAssets] } : l));
    alert(`成功将 ${newAssets.length} 个艺术二维码导入码库！`);
  };

  // --- Generation Logic ---
  const startGeneration = async () => {
    const activeIcons = iconLibraries.filter(l => l.isActive).flatMap(l => l.items);
    const activeQRs = qrLibraries.filter(l => l.isActive).flatMap(l => l.items);
    const activeTextRaw = textLibraries.filter(l => l.isActive).map(l => l.content).join('\n');
    
    if (activeIcons.length === 0 || activeQRs.length === 0 || !activeTextRaw.trim()) {
      alert("请确保已开启并填充了至少一个图标库、文案库和二维码库！");
      return;
    }

    setIsGenerating(true);
    setActiveTab('results');
    setGeneratedItems([]);

    try {
      const baseTexts = activeTextRaw.split('\n').filter(t => t.trim() !== '');
      let finalTexts: string[] = [];

      if (textGenerationMode === 'ai') {
        finalTexts = await getCreativeVariations(baseTexts, batchCount);
      } else {
        for (let i = 0; i < batchCount; i++) {
          finalTexts.push(baseTexts[i % baseTexts.length]);
        }
      }

      const config: GeneratorConfig = {
        batchCount,
        minScale: 0.98,
        maxScale: 1.02,
        textPool: finalTexts,
        icons: activeIcons,
        qrCodes: activeQRs,
        canvasWidth: 800,
        canvasHeight: 1200,
      };

      const newItems: GeneratedItem[] = [];
      for (let i = 0; i < batchCount; i++) {
        const currentText = finalTexts[i % finalTexts.length];
        const randomIcon = activeIcons[Math.floor(Math.random() * activeIcons.length)];
        const randomQR = activeQRs[Math.floor(Math.random() * activeQRs.length)];

        try {
          const dataUrl = await generateImage(config, currentText, randomIcon.url, randomQR.url);
          newItems.push({
            id: `gen-${i}-${Date.now()}`,
            dataUrl,
            text: currentText,
            iconId: randomIcon.id,
            qrId: randomQR.id,
          });
        } catch (err) {
          console.error("Image generation failed", err);
        }
      }
      setGeneratedItems(newItems);
    } catch (error) {
      console.error("Overall generation process failed", error);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadAll = () => {
    generatedItems.forEach((item, index) => {
      const link = document.createElement('a');
      link.href = item.dataUrl;
      link.download = `generated-image-${index + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  // --- Render Login View ---
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10">
          <div className="flex flex-col items-center mb-10">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black mb-4 shadow-xl shadow-indigo-100">G</div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">批量引流素材生成系统</h1>
            <p className="text-slate-400 mt-2 text-sm">请输入您的凭据以继续</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">用户名</label>
              <input 
                type="text" 
                required
                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-700 font-medium" 
                placeholder="wsadwdf"
                value={loginForm.username}
                onChange={(e) => setLoginForm({...loginForm, username: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 ml-1">密码</label>
              <input 
                type="password" 
                required
                className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-slate-700 font-medium" 
                placeholder="wsadwdf"
                value={loginForm.password}
                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
              />
            </div>
            {loginError && <p className="text-red-500 text-xs font-bold ml-1">{loginError}</p>}
            <button type="submit" className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 transition-all transform active:scale-95">
              立即登录
            </button>
          </form>
          <div className="mt-8 text-center">
            <p className="text-[10px] text-slate-300 uppercase tracking-[0.2em]">Default: wsadwdf / wsadwdf</p>
          </div>
        </div>
      </div>
    );
  }

  // --- Render Dashboard ---
  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 font-sans">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-20 bg-slate-900 flex md:flex-col items-center py-4 md:py-8 gap-6 shadow-2xl z-50">
        <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white font-black text-xl mb-4 shadow-lg shadow-indigo-500/20">G</div>
        <nav className="flex md:flex-col gap-4 flex-1 justify-center md:justify-start">
          <NavBtn active={activeTab === 'icons'} onClick={() => setActiveTab('icons')} icon={<IconSetIcon />} label="图标" />
          <NavBtn active={activeTab === 'text'} onClick={() => setActiveTab('text')} icon={<TextIcon />} label="文案" />
          <NavBtn active={activeTab === 'qr'} onClick={() => setActiveTab('qr')} icon={<QRIcon />} label="码库" />
          <NavBtn active={activeTab === 'beautify'} onClick={() => setActiveTab('beautify')} icon={<MagicIcon />} label="美化" />
          <NavBtn active={activeTab === 'results'} onClick={() => setActiveTab('results')} icon={<GalleryIcon />} label="画廊" />
          <div className="md:mt-auto">
            <NavBtn active={activeTab === 'account'} onClick={() => setActiveTab('account')} icon={<UserIcon />} label="账号" />
          </div>
        </nav>
      </aside>

      {/* Control Panel (Hidden on Account tab) */}
      {activeTab !== 'account' && (
        <aside className="w-full md:w-[400px] bg-white border-r border-slate-200 overflow-y-auto max-h-screen flex flex-col shadow-sm">
          <div className="p-6 flex-1">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">
                {activeTab === 'icons' && '图标素材库'}
                {activeTab === 'text' && '分类文案库'}
                {activeTab === 'qr' && '二维码库管理'}
                {activeTab === 'beautify' && '艺术美化实验室'}
                {activeTab === 'results' && '合成预览画廊'}
              </h2>
              {['icons', 'text', 'qr'].includes(activeTab) && (
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="新建库..." 
                    className="px-3 py-1 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={newLibName}
                    onChange={(e) => setNewLibName(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addLibrary(activeTab as any)}
                  />
                  <button 
                    onClick={() => addLibrary(activeTab as any)}
                    className="bg-indigo-600 text-white p-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <PlusIcon size={16} />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-6">
              {activeTab === 'icons' && iconLibraries.map(lib => (
                <LibrarySection key={lib.id} title={lib.name} isActive={lib.isActive} onToggle={() => toggleLibrary('icons', lib.id)} onRemove={() => removeLibrary('icons', lib.id)} onAdd={() => triggerUpload('icons', lib.id)}>
                  <div className="grid grid-cols-4 gap-2">
                    {lib.items.map(item => <AssetItem key={item.id} url={item.url} onRemove={() => removeAsset('icons', lib.id, item.id)} />)}
                  </div>
                </LibrarySection>
              ))}

              {activeTab === 'text' && (
                <>
                  <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100 mb-6">
                    <label className="block text-xs font-bold text-indigo-900 uppercase tracking-widest mb-3">文案生成规则</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-indigo-100 cursor-pointer hover:border-indigo-400 transition-all">
                        <input 
                          type="radio" 
                          name="textMode"
                          className="w-4 h-4 accent-indigo-600"
                          checked={textGenerationMode === 'fixed'}
                          onChange={() => setTextGenerationMode('fixed')}
                        />
                        <div className="flex-1">
                          <span className="text-xs font-bold text-slate-800">指定文本内容 (不进行AI变化)</span>
                          <p className="text-[10px] text-slate-500 mt-0.5">严格使用您在下方文案库中填写的原始文案。</p>
                        </div>
                      </label>
                      <label className="flex items-center gap-3 p-3 bg-white rounded-xl border border-indigo-100 cursor-pointer hover:border-indigo-400 transition-all">
                        <input 
                          type="radio" 
                          name="textMode"
                          className="w-4 h-4 accent-indigo-600"
                          checked={textGenerationMode === 'ai'}
                          onChange={() => setTextGenerationMode('ai')}
                        />
                        <div className="flex-1">
                          <span className="text-xs font-bold text-slate-800">AI 随机生成 (基于参考内容)</span>
                          <p className="text-[10px] text-slate-500 mt-0.5">基于当前生成逻辑及提供的参考内容进行智能随机变体。</p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {textLibraries.map(lib => (
                    <LibrarySection key={lib.id} title={lib.name} isActive={lib.isActive} onToggle={() => toggleLibrary('text', lib.id)} onRemove={() => removeLibrary('text', lib.id)}>
                      <textarea 
                        className="w-full h-40 p-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none bg-slate-50" 
                        placeholder="每一行作为一个文案条目..." 
                        value={lib.content} 
                        onChange={(e) => updateTextContent(lib.id, e.target.value)} 
                      />
                    </LibrarySection>
                  ))}
                </>
              )}

              {activeTab === 'qr' && qrLibraries.map(lib => (
                <LibrarySection key={lib.id} title={lib.name} isActive={lib.isActive} onToggle={() => toggleLibrary('qr', lib.id)} onRemove={() => removeLibrary('qr', lib.id)} onAdd={() => triggerUpload('qr', lib.id)}>
                  <div className="grid grid-cols-4 gap-2">
                    {lib.items.map(item => <AssetItem key={item.id} url={item.url} onRemove={() => removeAsset('qr', lib.id, item.id)} />)}
                  </div>
                </LibrarySection>
              ))}

              {activeTab === 'beautify' && (
                <div className="space-y-6">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">二维码内容</label>
                    <input 
                      type="text" 
                      className="w-full p-3 text-sm border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none mb-4" 
                      placeholder="输入网址或文本..."
                      value={beautifyUrl}
                      onChange={(e) => setBeautifyUrl(e.target.value)}
                    />

                    <div className="mb-4">
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-2">核心色调</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => setBeautifyConfig(prev => ({ ...prev, primaryColor: 'black' }))}
                          className={`py-2 text-xs font-bold rounded-lg border transition-all ${beautifyConfig.primaryColor === 'black' ? 'bg-slate-800 text-white border-slate-800 shadow-md' : 'bg-white text-slate-600 border-slate-200'}`}
                        >
                          沉稳黑色
                        </button>
                        <button 
                          onClick={() => setBeautifyConfig(prev => ({ ...prev, primaryColor: 'random' }))}
                          className={`py-2 text-xs font-bold rounded-lg border transition-all ${beautifyConfig.primaryColor === 'random' ? 'bg-indigo-600 text-white border-indigo-600 shadow-md' : 'bg-white text-slate-600 border-slate-200'}`}
                        >
                          绚丽随机
                        </button>
                      </div>
                    </div>

                    <div className="mb-6">
                       <label className="block text-xs font-bold text-slate-500 uppercase mb-3">随机变异程度 (影响码眼/样式)</label>
                       <div className="flex flex-col gap-2">
                         <div className="flex gap-2">
                           <button 
                             onClick={() => setBeautifyConfig(prev => ({ ...prev, randomVariation: 'low' }))}
                             className={`flex-1 py-2.5 px-2 text-xs font-bold rounded-xl border transition-all ${beautifyConfig.randomVariation === 'low' ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}
                           >
                             标准 (低变异)
                           </button>
                           <button 
                             onClick={() => setBeautifyConfig(prev => ({ ...prev, randomVariation: 'high' }))}
                             className={`flex-1 py-2.5 px-2 text-xs font-bold rounded-xl border transition-all ${beautifyConfig.randomVariation === 'high' ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-sm' : 'bg-white border-slate-200 text-slate-500'}`}
                           >
                             超高 (强差异化)
                           </button>
                         </div>
                         <button 
                           onClick={() => setBeautifyConfig(prev => ({ ...prev, randomVariation: 'artistic' }))}
                           className={`w-full py-2.5 px-2 text-xs font-bold rounded-xl border transition-all ${beautifyConfig.randomVariation === 'artistic' ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-400'}`}
                         >
                           艺术（过平台检测）
                         </button>
                       </div>
                    </div>
                    
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-xs font-bold text-slate-500 uppercase">生成样式总数</label>
                      <span className="text-indigo-600 font-bold">{beautifyCount}</span>
                    </div>
                    <input 
                      type="range" min="1" max="36" step="1" 
                      className="w-full accent-indigo-600 h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer mb-6"
                      value={beautifyCount}
                      onChange={(e) => setBeautifyCount(parseInt(e.target.value))}
                    />
                    
                    <button 
                      onClick={runBeautify}
                      disabled={isBeautifying}
                      className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 transform active:scale-[0.98]"
                    >
                      {isBeautifying ? <LoadingSpinner size={20} /> : '执行魔法美化'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Global Footer Controls */}
          <div className="p-6 border-t border-slate-100 bg-white sticky bottom-0 z-10">
            <div className="flex justify-between items-center mb-3">
               <span className="text-xs font-bold text-slate-400 uppercase">最终批量张数</span>
               <span className="text-sm font-black text-indigo-600">{batchCount} 张</span>
            </div>
            <input 
              type="range" min="1" max="100" step="1" 
              className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer mb-6"
              value={batchCount}
              onChange={(e) => setBatchCount(parseInt(e.target.value))}
            />
            <button 
              onClick={startGeneration}
              disabled={isGenerating}
              className={`w-full h-14 flex items-center justify-center gap-3 rounded-2xl font-bold text-white transition-all transform active:scale-95 shadow-xl ${
                isGenerating ? 'bg-slate-400 cursor-not-allowed shadow-none' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
              }`}
            >
              {isGenerating ? <div className="flex items-center gap-3"><LoadingSpinner /> 智能生成中...</div> : '立即生成批量图片'}
            </button>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto bg-slate-50/50">
        {activeTab === 'account' ? (
          <div className="max-w-4xl mx-auto space-y-10">
            <header className="mb-8">
               <h1 className="text-3xl font-black text-slate-900 tracking-tight">账号中心</h1>
               <p className="text-slate-500 mt-1">管理您的个人资料及系统安全性</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
               {/* Profile Info */}
               <div className="md:col-span-1 space-y-6">
                 <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 text-center">
                    <div className="w-24 h-24 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl font-black border-4 border-white shadow-lg">
                      {currentUser.username[0].toUpperCase()}
                    </div>
                    <h2 className="text-xl font-black text-slate-800">{currentUser.username}</h2>
                    <span className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-full uppercase tracking-widest mt-2 inline-block">
                      {currentUser.role}
                    </span>
                    <hr className="my-8 border-slate-50" />
                    <button 
                      onClick={handleLogout}
                      className="w-full py-4 bg-red-50 text-red-600 font-bold rounded-2xl hover:bg-red-100 transition-all"
                    >
                      退出系统
                    </button>
                 </div>
               </div>

               {/* Password Management */}
               <div className="md:col-span-2 space-y-6">
                 <div className="bg-white p-10 rounded-[2.5rem] shadow-sm border border-slate-100">
                    <h3 className="text-lg font-black text-slate-800 mb-8 flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                      安全设置 (修改密码)
                    </h3>
                    <form onSubmit={handleChangePassword} className="space-y-6">
                      <div className="grid grid-cols-1 gap-6">
                        <div>
                          <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">当前密码</label>
                          <input 
                            type="password" 
                            required
                            className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium" 
                            value={passForm.old}
                            onChange={(e) => setPassForm({...passForm, old: e.target.value})}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                           <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">新密码</label>
                              <input 
                                type="password" 
                                required
                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium" 
                                value={passForm.new}
                                onChange={(e) => setPassForm({...passForm, new: e.target.value})}
                              />
                           </div>
                           <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 ml-1">确认新密码</label>
                              <input 
                                type="password" 
                                required
                                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium" 
                                value={passForm.confirm}
                                onChange={(e) => setPassForm({...passForm, confirm: e.target.value})}
                              />
                           </div>
                        </div>
                      </div>
                      
                      {passMsg.text && (
                        <div className={`p-4 rounded-xl text-xs font-bold ${passMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
                          {passMsg.text}
                        </div>
                      )}

                      <div className="pt-4">
                        <button type="submit" className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-xl shadow-indigo-100 transition-all transform active:scale-95">
                          更新安全凭据
                        </button>
                      </div>
                    </form>
                 </div>
               </div>
            </div>
          </div>
        ) : (
          <>
            <header className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                  {activeTab === 'beautify' ? '美化二维码实验室' : '视觉画廊画板'}
                </h1>
                <p className="text-slate-500 mt-1">
                  {activeTab === 'beautify' ? '提供艺术化处理与码眼样式改造，显著提高素材辨识度' : 'AI智能分词、随机配色与库素材动态排版'}
                </p>
              </div>
              <div className="flex gap-4">
                {activeTab === 'beautify' && beautifiedQRs.length > 0 && (
                  <button 
                    onClick={importAllToLibrary} 
                    className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-indigo-50 hover:-translate-y-0.5"
                  >
                    一键同步到码库
                  </button>
                )}
                {activeTab === 'results' && generatedItems.length > 0 && (
                  <button onClick={downloadAll} className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all shadow-xl shadow-emerald-50 hover:-translate-y-0.5">
                    <DownloadIcon size={20} /> 打包下载全部 ({generatedItems.length})
                  </button>
                )}
              </div>
            </header>

            {activeTab === 'beautify' ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-8">
                {beautifiedQRs.map((qr, idx) => (
                  <div key={idx} className="group relative bg-white p-3 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-xl transition-all tab-content">
                    <div className="relative">
                      <img src={qr.dataUrl} className="w-full h-auto rounded-3xl" alt="Artistic QR" />
                    </div>
                    <div className="absolute inset-0 bg-indigo-900/70 opacity-0 group-hover:opacity-100 transition-opacity rounded-[2rem] flex flex-col items-center justify-center gap-3 p-6 backdrop-blur-[2px]">
                      <button 
                        onClick={() => importToLibrary(qr.dataUrl)}
                        className="w-full py-2.5 bg-white text-indigo-900 text-xs font-bold rounded-xl hover:scale-105 transition-transform"
                      >
                        导入此枚
                      </button>
                      <a 
                        href={qr.dataUrl} 
                        download={`qr-art-${idx}.png`}
                        className="w-full py-2.5 bg-indigo-500 text-white text-xs font-bold rounded-xl text-center hover:bg-indigo-400"
                      >
                        存为图片
                      </a>
                    </div>
                  </div>
                ))}
                {beautifiedQRs.length === 0 && !isBeautifying && (
                   <div className="col-span-full h-[450px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-[3rem] bg-white shadow-inner">
                     <MagicIcon size={80} className="text-slate-100 mb-6 animate-pulse" />
                     <p className="font-bold text-slate-400 text-lg">点击下方执行，快速生成艺术化二维码</p>
                   </div>
                )}
                {isBeautifying && Array.from({ length: Math.min(beautifyCount, 5) }).map((_, i) => (
                  <div key={i} className="aspect-square bg-white animate-pulse rounded-[2rem] p-4 shadow-sm border border-slate-100 flex items-center justify-center">
                    <LoadingSpinner size={40} className="text-indigo-200" />
                  </div>
                ))}
              </div>
            ) : (
              <div>
                {generatedItems.length === 0 && !isGenerating ? (
                  <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400 bg-white rounded-[3rem] border-2 border-dashed border-slate-200 shadow-inner">
                    <div className="p-12 bg-indigo-50 rounded-full mb-8">
                      <EmptyStateIcon size={72} />
                    </div>
                    <p className="text-2xl font-bold text-slate-700">尚未开始批量生成</p>
                    <p className="text-sm mt-3 text-slate-500 max-w-sm text-center">系统将自动从图标库、码库中挑选素材，并根据文案库智能生成各不相同的营销图片。</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-10">
                    {isGenerating && generatedItems.length === 0 && Array.from({ length: batchCount }).map((_, i) => (
                      <div key={i} className="aspect-[2/3] bg-white border border-slate-100 animate-pulse rounded-[2.5rem] p-8 shadow-md">
                        <div className="w-2/3 aspect-square bg-slate-50 rounded-3xl mx-auto mb-12"></div>
                        <div className="h-8 bg-slate-50 rounded-xl w-3/4 mx-auto mb-5"></div>
                        <div className="h-8 bg-slate-50 rounded-xl w-1/2 mx-auto mb-16"></div>
                        <div className="w-full aspect-square bg-slate-50 rounded-3xl mt-auto"></div>
                      </div>
                    ))}
                    {generatedItems.map((item) => (
                      <div key={item.id} className="group relative bg-white p-4 rounded-[2.5rem] shadow-md border border-slate-100 hover:shadow-2xl transition-all transform hover:-translate-y-2 tab-content">
                        <img src={item.dataUrl} className="w-full h-auto rounded-[1.8rem]" alt="generated result" loading="lazy" />
                        <a href={item.dataUrl} download={`gen-${item.id}.png`} className="absolute top-8 right-8 bg-white/90 backdrop-blur-xl p-4 rounded-2xl shadow-xl opacity-0 group-hover:opacity-100 transition-all hover:bg-indigo-600 hover:text-white">
                          <DownloadIcon size={24} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
    </div>
  );
};

// --- Helper Components ---
const NavBtn = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl transition-all ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-800'}`}>
    {icon}
    <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
  </button>
);

const LibrarySection = ({ title, isActive, onToggle, onRemove, onAdd, children }: any) => (
  <div className={`p-5 rounded-2xl border transition-all ${isActive ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-transparent opacity-60 grayscale'}`}>
    <div className="flex items-center justify-between mb-5">
      <div className="flex items-center gap-4">
        <input type="checkbox" checked={isActive} onChange={onToggle} className="w-5 h-5 accent-indigo-600 rounded cursor-pointer" />
        <h3 className="font-bold text-slate-700 truncate max-w-[160px] text-sm">{title}</h3>
      </div>
      <div className="flex gap-1.5">
        {onAdd && <button onClick={onAdd} className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"><PlusIcon size={18} /></button>}
        <button onClick={onRemove} className="p-2 text-slate-300 hover:text-red-600 transition-colors"><TrashIcon size={18} /></button>
      </div>
    </div>
    <div className="mt-2">{children}</div>
  </div>
);

const AssetItem = ({ url, onRemove }: { url: string, onRemove: () => void }) => (
  <div className="relative group aspect-square rounded-2xl overflow-hidden bg-slate-50 border border-slate-100">
    <img src={url} className="w-full h-full object-cover" alt="asset" />
    <button onClick={onRemove} className="absolute inset-0 bg-red-600/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-bold text-[10px] backdrop-blur-sm">删除</button>
  </div>
);

const LoadingSpinner = ({ size = 20, className = "" }) => (
  <svg className={`animate-spin ${className}`} width={size} height={size} viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

// --- Icons ---
const PlusIcon = ({ size = 24 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;
const TrashIcon = ({ size = 24 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
const IconSetIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>;
const TextIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></svg>;
const QRIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><rect x="7" y="7" width="3" height="3" /><rect x="14" y="7" width="3" height="3" /><rect x="7" y="14" width="3" height="3" /><path d="M14 14h3v3h-3z" /></svg>;
const MagicIcon = ({ size = 24, className = "" }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72Z"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>;
const GalleryIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>;
const DownloadIcon = ({ size = 24 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>;
const EmptyStateIcon = ({ size = 48 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="4" x2="12" y2="15" /></svg>;
const UserIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;

export default App;
