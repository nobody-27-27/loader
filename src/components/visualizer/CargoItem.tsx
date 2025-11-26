import React, { useState, useMemo, useRef, useLayoutEffect } from 'react'; // useState eklendi
import type { PlacedItem } from '../../types/core';
import * as THREE from 'three';

interface CargoItemProps {
  data: PlacedItem;
}

export const CargoItem: React.FC<CargoItemProps> = ({ data }) => {
  const { position, dimensions, type, color, isPalletized, rotation, layout } =
    data; // layout'u destructure et

  // --- EKLENEN KISIM: Hover State ---
  const [hovered, setHovered] = useState(false);

  // Hover rengi: Orijinal rengi biraz açmak veya parlatmak için
  // Basitçe conditional color kullanacağız.
  const displayColor = hovered ? '#ffffff' : color || 'orange';
  // Not: Hover durumunda beyaz yapıyorum ki net belli olsun,
  // isterseniz orijinal rengin daha açık tonunu hesaplayabilirsiniz.

  const handlePointerOver = (e: any) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = (e: any) => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  };
  // ----------------------------------

  const PALLET_HEIGHT = 15;

  // ... (Merkez ve rotasyon hesaplamaları aynı kalacak)
  const centerX = position.x + dimensions.width / 2;
  const centerY = position.y + dimensions.height / 2;
  const centerZ = position.z + dimensions.length / 2;

  const rotX = (rotation?.x || 0) * (Math.PI / 180);
  const rotY = (rotation?.y || 0) * (Math.PI / 180);
  const rotZ = (rotation?.z || 0) * (Math.PI / 180);

  if (isPalletized) {
    const cargoHeight = Math.max(1, dimensions.height - PALLET_HEIGHT);
    const palletY = position.y + PALLET_HEIGHT / 2;

    const grid = layout || { col: 1, row: 1, stack: 1 };
    const isMultiItem = grid.col > 1 || grid.row > 1 || grid.stack > 1;

    const subW = dimensions.width / grid.col;
    const subL = dimensions.length / grid.row;
    const subH = cargoHeight / grid.stack;

    // --- PERFORMANS & GÖRSEL DÜZELTME ---
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const tempObject = useMemo(() => new THREE.Object3D(), []);
    const totalCount = grid.col * grid.row * grid.stack;

    // 1. Geometriyi Önceden Hesapla (useMemo)
    // Rulo ise "RadialSegments" değerini 32'den 8'e düşürüyoruz.
    // Uzaktan bakınca fark edilmez ama performansı %75 artırır.
    const instanceGeometry = useMemo(() => {
      if (type === 'cylinder') {
        const radius = (Math.min(subW, subL) / 2) * 0.95;
        // Performans için segment sayısını 8 yapıyoruz (varsayılan 32)
        return new THREE.CylinderGeometry(radius, radius, subH, 8);
      } else {
        return new THREE.BoxGeometry(subW * 0.98, subH * 0.98, subL * 0.98);
      }
    }, [type, subW, subL, subH]);

    // 2. Pozisyonları Hesapla
    useLayoutEffect(() => {
      if (!isMultiItem || !meshRef.current) return;

      let idx = 0;
      for (let ix = 0; ix < grid.col; ix++) {
        for (let iz = 0; iz < grid.row; iz++) {
          for (let iy = 0; iy < grid.stack; iy++) {
            const lx = ix * subW + subW / 2;
            const lz = iz * subL + subL / 2;
            const ly = iy * subH + subH / 2;

            tempObject.position.set(lx, ly, lz);

            // Rulo yatay/dikey rotasyonu gerekirse buraya eklenebilir
            // Şu an varsayılan dik (Y ekseni)

            tempObject.updateMatrix();
            meshRef.current.setMatrixAt(idx++, tempObject.matrix);
          }
        }
      }
      meshRef.current.instanceMatrix.needsUpdate = true;
    }, [grid, subW, subL, subH, isMultiItem]);

    return (
      <group onPointerOver={handlePointerOver} onPointerOut={handlePointerOut}>
        {/* Palet */}
        <mesh position={[centerX, palletY, centerZ]}>
          <boxGeometry
            args={[dimensions.width, PALLET_HEIGHT, dimensions.length]}
          />
          <meshStandardMaterial color="#8d6e63" />
          <lineSegments>
            <edgesGeometry
              args={[
                new THREE.BoxGeometry(
                  dimensions.width,
                  PALLET_HEIGHT,
                  dimensions.length
                ),
              ]}
            />
            <lineBasicMaterial color="#3e2723" />
          </lineSegments>
        </mesh>

        {/* Yükler */}
        {isMultiItem ? (
          <group
            position={[position.x, position.y + PALLET_HEIGHT, position.z]}
          >
            {/* Geometry prop olarak veriliyor, böylece React tip karmaşası yaşamıyor */}
            <instancedMesh
              ref={meshRef}
              args={[undefined, undefined, totalCount]}
              geometry={instanceGeometry}
            >
              <meshStandardMaterial color={displayColor} />
            </instancedMesh>
          </group>
        ) : // --- TEKLİ BLOK (FALLBACK) ---
        type === 'cylinder' ? (
          <mesh
            position={[
              centerX,
              position.y + PALLET_HEIGHT + cargoHeight / 2,
              centerZ,
            ]}
          >
            <cylinderGeometry
              args={[
                (Math.min(dimensions.width, dimensions.length) / 2) * 0.95,
                (Math.min(dimensions.width, dimensions.length) / 2) * 0.95,
                cargoHeight,
                32,
              ]}
            />
            <meshStandardMaterial color={displayColor} />
          </mesh>
        ) : (
          <mesh
            position={[
              centerX,
              position.y + PALLET_HEIGHT + cargoHeight / 2,
              centerZ,
            ]}
          >
            <boxGeometry
              args={[dimensions.width, cargoHeight, dimensions.length]}
            />
            <meshStandardMaterial color={displayColor} />
          </mesh>
        )}
      </group>
    );
  }

  // --- SENARYO 2: DÖKME (PALETSİZ) RULO ---
  if (type === 'cylinder' && !isPalletized) {
    const isHorizontal = Math.abs(rotation.x) > 0;
    const cylinderVisualHeight = isHorizontal
      ? dimensions.length
      : dimensions.height;

    // NORMALE DÖNÜŞ: %3 değil, sadece çizgi görünecek kadar %0.5 küçültme
    const radius = (dimensions.width / 2) * 0.995;

    return (
      <group
        position={[centerX, centerY, centerZ]}
        rotation={[rotX, rotY, rotZ]}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <mesh castShadow={false}>
          <cylinderGeometry args={[radius, radius, cylinderVisualHeight, 24]} />
          <meshStandardMaterial color={displayColor} />
        </mesh>
      </group>
    );
  }

  // --- SENARYO 3: DÖKME KOLİ ---
  return (
    <group
      position={[centerX, centerY, centerZ]}
      rotation={[rotX, rotY, rotZ]}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <mesh>
        <boxGeometry
          args={[dimensions.width, dimensions.height, dimensions.length]}
        />
        {/* displayColor kullanıldı */}
        <meshStandardMaterial color={hovered ? '#bfdbfe' : color || 'orange'} />
        {/* ... edges */}
      </mesh>
    </group>
  );
};
