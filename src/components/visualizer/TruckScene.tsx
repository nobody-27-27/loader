import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  Grid,
  Environment,
  ContactShadows,
} from '@react-three/drei';
import { useCargoStore } from '../../stores/useCargoStore';
import { CargoItem } from './CargoItem';

export const TruckScene: React.FC = () => {
  const { activeContainer, loadingResult } = useCargoStore();
  const { width, height, length } = activeContainer.dimensions;

  // Dinamik Grid Boyutu
  const gridSize = Math.max(width, length) * 4;

  // --- SIĞMAYANLARI GRUPLAMA MANTIĞI ---
  // Sığmayanlar listesini (unplacedItems) tarayıp, aynı olanları grupluyoruz.
  // Örn: "Koli A"dan 3 tane varsa, listede 3 satır değil "Koli A x 3" yazsın.
  const missingGroups = useMemo(() => {
    if (!loadingResult) return [];

    const groups: Record<
      string,
      { count: number; name: string; dimStr: string }
    > = {};

    loadingResult.unplacedItems.forEach((item) => {
      const dim = item.dimensions;
      // Eğer ürün 'box' İSE veya 'paletli' İSE -> Boyutları (WxLxH) göster
      // Aksi takdirde (Paletsiz Rulo) -> Çap ve Yükseklik göster
      const dimStr =
        item.type === 'box' || item.isPalletized
          ? `${dim?.width}x${dim?.length}x${dim?.height}`
          : `Ø:${(item.radius || 0) * 2} h:${item.height}`;

      const key = `${item.type}-${dimStr}`;

      if (!groups[key]) {
        groups[key] = {
          count: 0,
          name: item.type === 'box' ? 'Koli' : 'Rulo',
          dimStr,
        };
      }
      groups[key].count += 1;
    });

    return Object.values(groups);
  }, [loadingResult]);

  return (
    <div className="w-full h-full bg-[#f0f2f5] relative border-l border-gray-300">
      <Canvas
        shadows
        // Bu ayar, ekran görüntüsü alınabilmesi için son karenin hafızada tutulmasını sağlar.
        gl={{ preserveDrawingBuffer: true }}
        // ---------------------
        camera={{
          position: [width * 1.5, height * 2, length * 2],
          fov: 45,
          near: 0.1,
          far: 50000,
        }}
        dpr={[1, 2]}
      >
        <color attach="background" args={['#f0f2f5']} />

        <OrbitControls
          makeDefault
          target={[width / 2, height / 2, length / 2]}
          minDistance={100}
          maxDistance={5000}
        />

        <ambientLight intensity={0.7} />
        <directionalLight
          position={[500, 1000, 500]}
          intensity={1.2}
          castShadow
        />
        <directionalLight position={[-500, 500, -500]} intensity={0.5} />

        <group position={[0, 0, 0]}>
          {/* TIR GÖVDESİ */}
          <mesh position={[width / 2, height / 2, length / 2]}>
            <boxGeometry args={[width, height, length]} />
            <meshBasicMaterial color="#1e293b" wireframe />
          </mesh>

          {/* YÜKLER */}
          {loadingResult?.placedItems.map((item) => (
            <CargoItem key={item.uniqueId} data={item} />
          ))}

          {/* ZEMİN */}
          <group position={[width / 2, -5, length / 2]}>
            <Grid
              args={[gridSize, gridSize]}
              sectionSize={100}
              cellSize={100}
              cellColor="#cbd5e1"
              sectionColor="#94a3b8"
              fadeDistance={gridSize / 2}
            />
          </group>

          <ContactShadows
            position={[width / 2, -6, length / 2]}
            opacity={0.4}
            scale={Math.max(width, length) * 1.5}
            blur={2.5}
            far={20}
            color="#000000"
          />
        </group>

        <Environment preset="city" />
      </Canvas>

      {/* --- GÜNCELLENMİŞ BİLGİ KARTI --- */}
      <div className="absolute top-4 right-4 bg-white/95 backdrop-blur p-4 rounded-lg shadow-xl border border-gray-200 w-72 max-h-[80vh] overflow-y-auto custom-scrollbar">
        <h3 className="font-bold text-slate-800 mb-3 border-b pb-2 text-xs uppercase tracking-wider">
          Yükleme Özeti
        </h3>
        {loadingResult ? (
          <div className="space-y-3 text-sm">
            {/* İstatistikler */}
            <div className="grid grid-cols-2 gap-2 pb-2 border-b border-gray-100">
              <div className="bg-blue-50 p-2 rounded text-center">
                <div className="text-xs text-gray-500">Doluluk</div>
                <div className="font-bold text-blue-600">
                  % {loadingResult.volumeUtilization.toFixed(1)}
                </div>
              </div>
              <div className="bg-green-50 p-2 rounded text-center">
                <div className="text-xs text-gray-500">Yüklenen</div>
                <div className="font-bold text-green-600">
                  {loadingResult.totalLoadedCount}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-medium">Dışarıda Kalan:</span>
              <span className="font-bold text-red-500">
                {loadingResult.unplacedItems.length} Adet
              </span>
            </div>

            {/* --- EKSİK LİSTESİ (BURASI YENİ) --- */}
            {missingGroups.length > 0 && (
              <div className="bg-red-50 rounded-md p-2 border border-red-100 mt-2">
                <p className="text-[10px] font-bold text-red-400 mb-1 uppercase">
                  Sığmayanlar Detayı:
                </p>
                <ul className="space-y-1">
                  {missingGroups.map((g, idx) => (
                    <li
                      key={idx}
                      className="text-xs text-red-700 flex justify-between border-b border-red-100 pb-1 last:border-0"
                    >
                      <span>
                        {g.name}{' '}
                        <span className="text-[10px] text-red-400">
                          ({g.dimStr})
                        </span>
                      </span>
                      <span className="font-bold">x{g.count}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-1 text-[10px] text-gray-400 text-right">
              {activeContainer.dimensions.width}x
              {activeContainer.dimensions.height}x
              {activeContainer.dimensions.length}
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">
            Simülasyon bekleniyor...
          </p>
        )}
      </div>
    </div>
  );
};
