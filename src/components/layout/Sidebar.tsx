import React, { useState, useEffect } from 'react';
import { useCargoStore } from '../../stores/useCargoStore';
import { PackerEngine } from '../../core/algorithms/PackerEngine';
import { CONTAINER_PRESETS } from '../../core/constants/containers';
import { nanoid } from 'nanoid';
import { generatePDFReport } from '../../features/reporting/PDFGenerator';

export const Sidebar: React.FC = () => {
  const store = useCargoStore();

  const [selectedPresetId, setSelectedPresetId] = useState<string>('truck-std');
  const [containerDims, setContainerDims] = useState(
    CONTAINER_PRESETS[0].dimensions
  );
  const [palletSpacing, setPalletSpacing] = useState(0);

  const [cargoType, setCargoType] = useState<'box' | 'cylinder'>('box');
  const [dims, setDims] = useState({
    width: 60,
    height: 40,
    length: 40,
    diameter: 60,
  });
  const [qty, setQty] = useState(10);
  const [isPalletized, setIsPalletized] = useState(false);
  const [cargoColor, setCargoColor] = useState('#3b82f6');
  const [enableDetail, setEnableDetail] = useState(false);
  const [unitDims, setUnitDims] = useState({ diameter: 40, height: 50 });
  const [layout, setLayout] = useState({ col: 1, row: 1, stack: 1 }); // Hesaplanan sonuç buraya yazılır

  const handlePresetChange = (id: string) => {
    setSelectedPresetId(id);
    const preset = CONTAINER_PRESETS.find((p) => p.id === id);
    if (preset) {
      setContainerDims(preset.dimensions);
      store.setContainer(preset.dimensions, preset.name, preset.id);
    }
  };

  const handleDimChange = (key: keyof typeof containerDims, val: string) => {
    const newDims = { ...containerDims, [key]: Number(val) };
    setContainerDims(newDims);
    store.setContainer(newDims, 'Özel Araç (Manuel)', 'custom');
  };

  const handleSpacingChange = (val: string) => {
    const spacing = Number(val);
    setPalletSpacing(spacing);
    store.updateSettings({ palletSpacing: spacing });
  };

  const generateRandomColor = () => {
    const color =
      '#' +
      Math.floor(Math.random() * 16777215)
        .toString(16)
        .padStart(6, '0');
    setCargoColor(color);
  };

  useEffect(() => {
    // Eğer detay kapalıysa veya paletli değilse hesaplama yapma (Varsayılan 1x1x1 kalır)
    if (!isPalletized || !enableDetail) {
      setLayout({ col: 1, row: 1, stack: 1 });
      return;
    }

    const palletW = Number(dims.width);
    const palletL = Number(dims.length);
    const palletH = Number(dims.height);

    // Rulo veya Kutu ayrımı (Şu an arayüzde sadece rulo detayı var ama altyapı hazır)
    const uW = Number(unitDims.diameter);
    const uL = Number(unitDims.diameter);
    const uH = Number(unitDims.height);

    if (uW > 0 && uL > 0 && uH > 0) {
      const col = Math.floor(palletW / uW);
      const row = Math.floor(palletL / uL);
      const PALLET_BASE_H = 15;
      const stack = Math.floor((palletH - PALLET_BASE_H) / uH);

      setLayout({
        col: Math.max(1, col),
        row: Math.max(1, row),
        stack: Math.max(1, stack),
      });
    }
  }, [enableDetail, isPalletized, dims, unitDims, cargoType]);

  const handleAddCargo = () => {
    // Mevcut konteyner boyutlarını al
    const {
      width: cW,
      height: cH,
      length: cL,
    } = store.activeContainer.dimensions;

    // Girilen yük boyutlarını hazırla
    let checkW = 0,
      checkH = 0,
      checkL = 0;

    if (isPalletized || cargoType === 'box') {
      checkW = Number(dims.width);
      checkH = Number(dims.height);
      checkL = Number(dims.length);
    } else {
      // Rulo ise (Çap, Uzunluk)
      // Rulo dik veya yatay girebilir, en büyük boyutu konteyneri aşmamalı
      const diameter = Number(dims.diameter);
      const length = Number(dims.length);

      // Rulo için basit kontrol: Çap konteynerin en dar yerinden büyükse veya boyu sığmıyorsa
      checkW = diameter;
      checkH = diameter; // Dik duruşta taban
      checkL = length;
    }

    // Basit sığma kontrolü (Döndürme ihtimalini de göz önüne alarak en kaba kontrol)
    // Hiçbir kenar, konteynerin en uzun kenarından büyük olamaz ve
    // En az bir oryantasyonda sığabilmeli.
    // Burada kullanıcıyı çok sıkmadan "Kesinlikle Sığmaz" durumunu yakalıyoruz.

    const itemDims = [checkW, checkH, checkL].sort((a, b) => b - a);
    const contDims = [cW, cH, cL].sort((a, b) => b - a);

    // Eğer yükün en uzun kenarı, konteynerin en uzun kenarından büyükse
    // VEYA yükün en kısa kenarı, konteynerin en kısa kenarından büyükse sığmaz.
    if (
      itemDims[0] > contDims[0] ||
      itemDims[1] > contDims[1] ||
      itemDims[2] > contDims[2]
    ) {
      alert('Hata: Yük boyutları seçili araçtan daha büyük!');
      return;
    }
    // ---------------------------

    let finalDimensions;
    let finalRadius;
    let finalHeight;

    if (isPalletized || cargoType === 'box') {
      finalDimensions = {
        width: Number(dims.width),
        height: Number(dims.height),
        length: Number(dims.length),
      };
    } else {
      finalRadius = Number(dims.diameter) / 2;
      finalHeight = Number(dims.length);
    }

    store.addCargo({
      id: nanoid(),
      name: `Yük ${store.cargoList.length + 1}`,
      type: cargoType,
      quantity: qty,
      color: cargoColor,
      isPalletized,
      // --- YENİ: Dizilim bilgisini kaydet ---
      layout: isPalletized && enableDetail ? layout : undefined,
      dimensions: finalDimensions,
      radius: finalRadius,
      height: finalHeight,
    });
    generateRandomColor();
  };

  const handleCalculate = () => {
    store.setCalculating(true);
    setTimeout(() => {
      const engine = new PackerEngine(store.activeContainer, store.settings);
      const result = engine.pack(store.cargoList);
      store.setResult(result);
      store.setCalculating(false);
    }, 100);
  };

  const handleDownloadPDF = () => {
    if (!store.loadingResult) return;
    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.id = 'scene-canvas';
      generatePDFReport(
        store.activeContainer,
        store.loadingResult,
        'scene-canvas'
      );
    } else {
      alert('3D sahne bulunamadı!');
    }
  };

  const handleReset = () => {
    if (store.cargoList.length > 0) {
      if (
        window.confirm(
          'Tüm yük listesi ve sonuçlar silinecek. Onaylıyor musunuz?'
        )
      ) {
        store.reset();
      }
    } else {
      store.reset();
    }
  };

  const showBoxInputs = cargoType === 'box' || isPalletized;

  return (
    <div className="w-96 h-screen bg-white border-r border-gray-200 flex flex-col shadow-xl z-10">
      {/* HEADER */}
      <div className="p-5 border-b border-gray-100 bg-slate-50">
        <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <span className="text-blue-600 text-2xl">■</span> Yükleme Simülasyonu
        </h1>
        <p className="text-xs text-gray-500 mt-1">v1.0.0 Enterprise</p>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-6 custom-scrollbar">
        {/* BÖLÜM 1: ARAÇ */}
        <section className="space-y-3">
          {/* ... (Araç seçimi inputları aynen kalacak) ... */}
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Araç & Konteyner
          </h2>
          <div>
            <label className="block text-[10px] font-semibold text-gray-500 mb-1">
              ARAÇ TİPİ
            </label>
            <select
              className="w-full p-2 bg-gray-50 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              value={selectedPresetId}
              onChange={(e) => handlePresetChange(e.target.value)}
            >
              {CONTAINER_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[9px] font-bold text-gray-400 block mb-1">
                GENİŞLİK
              </label>
              <input
                type="number"
                className="w-full p-2 border rounded-md text-sm"
                value={containerDims.width}
                onChange={(e) => handleDimChange('width', e.target.value)}
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-gray-400 block mb-1">
                YÜKSEKLİK
              </label>
              <input
                type="number"
                className="w-full p-2 border rounded-md text-sm"
                value={containerDims.height}
                onChange={(e) => handleDimChange('height', e.target.value)}
              />
            </div>
            <div>
              <label className="text-[9px] font-bold text-gray-400 block mb-1">
                UZUNLUK
              </label>
              <input
                type="number"
                className="w-full p-2 border rounded-md text-sm"
                value={containerDims.length}
                onChange={(e) => handleDimChange('length', e.target.value)}
              />
            </div>
          </div>
        </section>

        <hr className="border-gray-100" />

        {/* BÖLÜM 2: YÜK EKLEME */}
        <section className="space-y-3">
          <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
            Yük Ekle
          </h2>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
            {/* Koli / Rulo Butonları */}
            <div className="flex rounded-md shadow-sm isolate" role="group">
              <button
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-l-md border ${
                  cargoType === 'box'
                    ? 'bg-blue-600 text-white border-blue-600 z-10'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => setCargoType('box')}
              >
                Koli 📦
              </button>
              <button
                className={`flex-1 px-4 py-2 text-sm font-medium rounded-r-md border -ml-px ${
                  cargoType === 'cylinder'
                    ? 'bg-blue-600 text-white border-blue-600 z-10'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => setCargoType('cylinder')}
              >
                Rulo ⭕
              </button>
            </div>

            {/* INPUTLAR (Palet veya Kutu Boyutları) */}
            {showBoxInputs ? (
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-gray-400 block mb-1">
                    EN (cm)
                  </label>
                  <input
                    type="number"
                    className="p-2 border rounded text-sm w-full"
                    value={dims.width}
                    onChange={(e) =>
                      setDims({ ...dims, width: +e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-gray-400 block mb-1">
                    BOY (cm)
                  </label>
                  <input
                    type="number"
                    className="p-2 border rounded text-sm w-full"
                    value={dims.length}
                    onChange={(e) =>
                      setDims({ ...dims, length: +e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-gray-400 block mb-1">
                    YÜKSEKLİK
                  </label>
                  <input
                    type="number"
                    className="p-2 border rounded text-sm w-full"
                    value={dims.height}
                    onChange={(e) =>
                      setDims({ ...dims, height: +e.target.value })
                    }
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="relative group">
                  <label className="text-[9px] font-bold text-gray-400 block mb-1">
                    ÇAP (cm)
                  </label>
                  <input
                    type="number"
                    className="p-2 border rounded text-sm w-full pr-6"
                    value={dims.diameter}
                    onChange={(e) =>
                      setDims({ ...dims, diameter: +e.target.value })
                    }
                  />
                  <span className="absolute right-2 top-8 text-xs text-gray-400">
                    Ø
                  </span>
                </div>
                <div className="relative group">
                  <label className="text-[9px] font-bold text-gray-400 block mb-1">
                    UZUNLUK (cm)
                  </label>
                  <input
                    type="number"
                    className="p-2 border rounded text-sm w-full pr-6"
                    value={dims.length}
                    onChange={(e) =>
                      setDims({ ...dims, length: +e.target.value })
                    }
                  />
                  <span className="absolute right-2 top-8 text-xs text-gray-400">
                    h
                  </span>
                </div>
              </div>
            )}

            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-[9px] font-bold text-gray-400 block mb-1">
                  RENK
                </label>
                <div className="flex gap-1">
                  <input
                    type="color"
                    className="h-9 w-9 p-1 bg-white rounded border cursor-pointer"
                    value={cargoColor}
                    onChange={(e) => setCargoColor(e.target.value)}
                  />
                  <button
                    onClick={generateRandomColor}
                    className="text-xs bg-gray-200 px-2 py-1 rounded hover:bg-gray-300 flex-1"
                  >
                    Rastgele
                  </button>
                </div>
              </div>
              <div className="flex-1">
                <label className="text-[9px] font-bold text-gray-400 block mb-1">
                  ADET
                </label>
                <input
                  type="number"
                  className="w-full p-2 border rounded text-sm h-9"
                  value={qty}
                  onChange={(e) => setQty(+e.target.value)}
                />
              </div>
            </div>

            {/* --- PALET SEÇİMİ & AYARLAR --- */}
            <div className="space-y-3">
              <label className="flex items-center space-x-2 cursor-pointer bg-white p-2 rounded border border-gray-200 hover:border-blue-300 transition select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  checked={isPalletized}
                  onChange={(e) => setIsPalletized(e.target.checked)}
                />
                <span className="text-sm font-medium text-gray-700">
                  Paletli Yük
                </span>
              </label>

              {isPalletized && (
                <div className="space-y-2 animate-pulse-once">
                  {/* 1. Detay Checkbox (YENİ) */}
                  <label className="flex items-center space-x-2 cursor-pointer p-1 ml-1">
                    <input
                      type="checkbox"
                      className="w-3.5 h-3.5 text-blue-600 rounded"
                      checked={enableDetail}
                      onChange={(e) => setEnableDetail(e.target.checked)}
                    />
                    <span className="text-xs text-gray-600">
                      Palet içi ürünleri göster
                    </span>
                  </label>

                  {/* 2. Ürün Detayları (Sadece checkbox seçiliyse görünür) */}
                  {enableDetail && (
                    <div className="p-2 bg-blue-50 rounded border border-blue-100">
                      <label className="text-[9px] font-bold text-blue-800 block mb-1.5 uppercase">
                        Tekil Ürün Ölçüleri (cm)
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[8px] text-gray-500 block">
                            ÇAP / EN
                          </span>
                          <input
                            type="number"
                            className="w-full p-1 text-sm border rounded"
                            value={unitDims.diameter}
                            onChange={(e) =>
                              setUnitDims({
                                ...unitDims,
                                diameter: +e.target.value,
                              })
                            }
                          />
                        </div>
                        <div>
                          <span className="text-[8px] text-gray-500 block">
                            YÜKSEKLİK
                          </span>
                          <input
                            type="number"
                            className="w-full p-1 text-sm border rounded"
                            value={unitDims.height}
                            onChange={(e) =>
                              setUnitDims({
                                ...unitDims,
                                height: +e.target.value,
                              })
                            }
                          />
                        </div>
                      </div>
                      {/* Hesaplanan Sonuç Bilgisi */}
                      <div className="mt-2 text-[9px] text-blue-600 text-center bg-white p-1 rounded border border-blue-100">
                        <span>Otomatik Hesaplanan:</span>
                        <br />
                        <b>{layout.col}</b> sıra x <b>{layout.row}</b> derinlik
                        x <b>{layout.stack}</b> kat
                        <br />
                        <span className="text-gray-400">
                          (Toplam: {layout.col * layout.row * layout.stack}{' '}
                          adet/palet)
                        </span>
                      </div>
                    </div>
                  )}

                  {/* 3. Palet Boşluğu */}
                  <div className="p-2 bg-gray-50 rounded border border-gray-200">
                    <label className="text-[10px] font-bold text-gray-500 flex justify-between mb-1">
                      <span>PALETLER ARASI BOŞLUK</span>
                      <span>{palletSpacing} cm</span>
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="50"
                      step="1"
                      className="w-full h-1.5 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-gray-600"
                      value={palletSpacing}
                      onChange={(e) => handleSpacingChange(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={handleAddCargo}
              className="w-full bg-slate-800 text-white py-2.5 rounded-md hover:bg-slate-900 transition text-sm font-bold shadow-sm active:scale-95"
            >
              + Listeye Ekle
            </button>
          </div>
        </section>

        {/* LİSTE */}
        <section>
          <div className="flex justify-between items-end mb-2">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Yük Listesi ({store.cargoList.length})
            </h2>
            {store.cargoList.length > 0 && (
              <button
                onClick={() => store.reset()}
                className="text-[10px] text-red-500 hover:underline"
              >
                Temizle
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
            {store.cargoList.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-white p-2.5 rounded border border-gray-200 hover:border-blue-300 transition shadow-sm group"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-3 h-3 rounded-full shadow-sm ring-1 ring-gray-200"
                    style={{ backgroundColor: item.color }}
                  ></div>
                  <div>
                    <div className="font-bold text-gray-700 text-xs">
                      {item.type === 'box' ? 'Koli' : 'Rulo'}{' '}
                      <span className="text-gray-400">x</span> {item.quantity}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">
                      {item.isPalletized ? 'Paletli' : 'Dökme'}
                      {item.type === 'box' || item.isPalletized
                        ? ` | ${item.dimensions?.width}x${item.dimensions?.length}x${item.dimensions?.height}`
                        : ` | Ø:${(item.radius || 0) * 2} h:${item.height}`}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => store.removeCargo(item.id)}
                  className="text-gray-300 hover:text-red-500 transition p-1"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
            {store.cargoList.length === 0 && (
              <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                <p className="text-gray-400 text-xs">Henüz yük eklenmedi.</p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* FOOTER */}
      <div className="p-4 border-t border-gray-200 bg-white flex flex-col gap-2">
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-2 rounded-lg font-bold text-gray-500 bg-gray-100 hover:bg-red-50 hover:text-red-600 transition border border-transparent hover:border-red-100"
            title="Sıfırla"
          >
            🗑️
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={!store.loadingResult}
            className={`flex-1 py-2 rounded-lg font-bold text-xs border transition flex items-center justify-center gap-2 ${
              !store.loadingResult
                ? 'bg-gray-50 text-gray-300 border-gray-200 cursor-not-allowed'
                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
            }`}
          >
            📄 PDF RAPOR
          </button>
        </div>
        <button
          onClick={handleCalculate}
          disabled={store.isCalculating || store.cargoList.length === 0}
          className={`w-full py-3 rounded-lg font-bold text-white shadow-lg shadow-blue-200 transition transform active:scale-95 flex justify-center items-center gap-2 ${
            store.isCalculating || store.cargoList.length === 0
              ? 'bg-gray-400 cursor-not-allowed shadow-none'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {store.isCalculating ? (
            <span>HESAPLANIYOR...</span>
          ) : (
            <span>🚀 SİMÜLASYONU BAŞLAT</span>
          )}
        </button>
      </div>
    </div>
  );
};
