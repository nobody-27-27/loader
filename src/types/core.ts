// src/types/core.ts

// Temel Boyut Birimi (cm cinsinden)
export type Dimensions = {
  length: number; // Uzunluk (L) - Derinlik (Z ekseni)
  width: number; // Genişlik (W) - En (X ekseni)
  height: number; // Yükseklik (H) - Yükseklik (Y ekseni)
};

// Yük Türleri
export type CargoType = 'box' | 'cylinder';

// Yükün Temel Özellikleri (Kullanıcı Girdisi)
export interface CargoInput {
  id: string;
  name: string;
  type: CargoType;
  quantity: number;
  color: string;

  // Koli ise
  dimensions?: Dimensions;

  // Rulo ise
  radius?: number; // Çap / 2
  height?: number; // Rulo uzunluğu

  isPalletized: boolean;
  // Paletliyse palet yüksekliği dahildir, ancak ayrıca belirtilebilir
  palletHeight?: number;

  // Palet içi dizilim: En (col), Boy (row), Yükseklik (stack) adedi
  layout?: { col: number; row: number; stack: number };
}

// Konteyner / Tır Tanımı
export interface Container {
  id: string;
  name: string;
  dimensions: Dimensions;
  maxWeight?: number; // Şimdilik kullanmayacağız ama altyapı hazır olsun
}

// Yerleştirilmiş Yükün Koordinatları (Sonuç Verisi)
export interface PlacedItem {
  id: string; // CargoInput id'si ile eşleşir
  cargoId: string;
  uniqueId: string; // Her bir kutu için eşsiz ID
  type: CargoType;
  color?: string;
  // Uzaydaki konumu (Sol-Alt-Arka köşe baz alınır)
  position: { x: number; y: number; z: number };

  // Dönme durumu (Radyan cinsinden veya eksen bazlı)
  rotation: { x: number; y: number; z: number };

  // O anki boyutları (Döndürülmüş olabilir)
  dimensions: Dimensions;

  // Hangi katmanda veya neyin üstünde olduğu bilgisi (Raporlama için)
  description?: string;
  isPalletized?: boolean;
  // --- YENİ ALAN ---
  layout?: { col: number; row: number; stack: number };
}

// Hesaplama Sonucu
export interface LoadingResult {
  containerId: string;
  placedItems: PlacedItem[];
  unplacedItems: CargoInput[]; // Sığmayanlar

  volumeUtilization: number; // Doluluk oranı %
  totalLoadedCount: number;

  // Kalan boşlukların analizi (Raporlama için)
  remainingSpace?: {
    floorArea: number;
    totalVolume: number;
  };
}
