import type { Dimensions } from '../../types/core';

// Boşluk Tanımı (Koordinat + Boyut)
export interface FreeSpace {
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  length: number;
}

export class SpaceManager {
  private spaces: FreeSpace[] = [];

  constructor(containerDim: Dimensions) {
    // Başlangıçta tüm tır tek bir boşluktur
    this.spaces.push({
      x: 0,
      y: 0,
      z: 0,
      width: containerDim.width,
      height: containerDim.height,
      length: containerDim.length,
    });
  }

  // En uygun boşluğu bul (Best Fit)
  // itemDim: Yükün boyutları
  // preferFloor: Paletler için zemin önceliği
  findSpot(
    itemDim: Dimensions,
    preferFloor: boolean = false
  ): FreeSpace | null {
    // Boşlukları Z (derinlik), Y (yükseklik), X (en) sırasına göre sırala
    // Bu sayede arkadan öne, aşağıdan yukarıya doldururuz.
    this.spaces.sort((a, b) => {
      if (preferFloor) {
        if (a.y !== b.y) return a.y - b.y; // Önce yere yakın olanlar
      }
      if (a.z !== b.z) return a.z - b.z; // Önce en arkadakiler
      if (a.x !== b.x) return a.x - b.x; // Sonra soldakiler
      return 0;
    });

    for (const space of this.spaces) {
      if (
        itemDim.width <= space.width &&
        itemDim.height <= space.height &&
        itemDim.length <= space.length
      ) {
        return space;
      }
    }
    return null;
  }

  // Bir yük yerleştirildiğinde boşlukları güncelle (Subtract logic)
  addUsedSpace(itemBox: FreeSpace) {
    const newSpaces: FreeSpace[] = [];

    for (const space of this.spaces) {
      // Eğer yerleştirilen yük bu boşlukla kesişmiyorsa, boşluğu koru
      if (!this.intersect(space, itemBox)) {
        newSpaces.push(space);
        continue;
      }

      // Kesişiyorsa, boşluğu parçala (Subdivide)
      // 1. Yükün ÜSTÜNDEKİ boşluk
      if (itemBox.y + itemBox.height < space.y + space.height) {
        newSpaces.push({
          x: Math.max(space.x, itemBox.x), // Yükün hizasında kalmalı
          y: itemBox.y + itemBox.height,
          z: Math.max(space.z, itemBox.z),
          width: Math.min(space.width, itemBox.width), // Sadece yükün üzeri kadar
          height: space.y + space.height - (itemBox.y + itemBox.height),
          length: Math.min(space.length, itemBox.length),
        });
      }

      // 2. Yükün SAĞINDAKI boşluk (Tır enine göre)
      if (itemBox.x + itemBox.width < space.x + space.width) {
        newSpaces.push({
          x: itemBox.x + itemBox.width,
          y: space.y,
          z: space.z,
          width: space.x + space.width - (itemBox.x + itemBox.width),
          height: space.height,
          length: space.length,
        });
      }

      // 3. Yükün ÖNÜNDEKİ boşluk (Tır kapısına doğru)
      if (itemBox.z + itemBox.length < space.z + space.length) {
        newSpaces.push({
          x: space.x,
          y: space.y,
          z: itemBox.z + itemBox.length,
          width: space.width,
          height: space.height,
          length: space.z + space.length - (itemBox.z + itemBox.length),
        });
      }
    }

    // İç içe geçmiş gereksiz küçük boşlukları temizle (Optimization)
    this.spaces = this.mergeSpaces(newSpaces);
  }

  private intersect(s: FreeSpace, b: FreeSpace): boolean {
    return (
      s.x < b.x + b.width &&
      s.x + s.width > b.x &&
      s.y < b.y + b.height &&
      s.y + s.height > b.y &&
      s.z < b.z + b.length &&
      s.z + s.length > b.z
    );
  }

  // Küçük boşlukları birleştirme (Geliştirilmiş Versiyon)
  private mergeSpaces(spaces: FreeSpace[]): FreeSpace[] {
    // 1. Önce çok küçük (işlevsiz) boşlukları temizle
    let filtered = spaces.filter(
      (s) => s.width > 1 && s.length > 1 && s.height > 1
    );

    // 2. Birleştirme döngüsü (Değişiklik olmadığında durur)
    let changed = true;
    while (changed) {
      changed = false;
      for (let i = 0; i < filtered.length; i++) {
        for (let j = i + 1; j < filtered.length; j++) {
          const s1 = filtered[i];
          const s2 = filtered[j];

          // Sadece aynı hizada ve bitişik olanları birleştir
          if (this.canMerge(s1, s2)) {
            const merged = this.mergeTwo(s1, s2);
            // Eskileri sil, yeniyi ekle
            filtered.splice(j, 1);
            filtered.splice(i, 1);
            filtered.push(merged);
            changed = true;
            i--; // Döngüyü resetle
            break;
          }
        }
        if (changed) break;
      }
    }
    return filtered;
  }

  // İki boşluğun birleşip birleşemeyeceğini kontrol eder
  private canMerge(s1: FreeSpace, s2: FreeSpace): boolean {
    // X Ekseninde Bitişik mi? (Y ve Z aynı olmalı, Height ve Length aynı olmalı)
    const xAdjacent = s1.x + s1.width === s2.x || s2.x + s2.width === s1.x;
    if (
      xAdjacent &&
      s1.y === s2.y &&
      s1.z === s2.z &&
      s1.height === s2.height &&
      s1.length === s2.length
    )
      return true;

    // Z Ekseninde Bitişik mi?
    const zAdjacent = s1.z + s1.length === s2.z || s2.z + s2.length === s1.z;
    if (
      zAdjacent &&
      s1.x === s2.x &&
      s1.y === s2.y &&
      s1.width === s2.width &&
      s1.height === s2.height
    )
      return true;

    // Y Ekseninde (Üst üste) birleşimi şimdilik yapmıyoruz çünkü yerçekimi mantığına göre alt taraf dolu olmalı.
    return false;
  }

  // İki boşluğu birleştirir
  private mergeTwo(s1: FreeSpace, s2: FreeSpace): FreeSpace {
    const minX = Math.min(s1.x, s2.x);
    const minY = Math.min(s1.y, s2.y);
    const minZ = Math.min(s1.z, s2.z);

    // Eğer X ekseninde birleşiyorsa genişlikleri topla
    if (s1.x !== s2.x) {
      return {
        x: minX,
        y: minY,
        z: minZ,
        width: s1.width + s2.width,
        height: s1.height,
        length: s1.length,
      };
    }
    // Z ekseninde birleşiyorsa uzunlukları topla
    return {
      x: minX,
      y: minY,
      z: minZ,
      width: s1.width,
      height: s1.height,
      length: s1.length + s2.length,
    };
  }
  // --- DEĞİŞECEK KISIM SONU ---
}
