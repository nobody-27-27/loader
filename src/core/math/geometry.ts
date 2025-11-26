import type { Dimensions } from '../../types/core';

// 3D Uzayda Nokta
export type Point3D = { x: number; y: number; z: number };

// Basit Kutu Çarpışma Kontrolü (AABB - Axis Aligned Bounding Box)
// İki kutu birbirine değiyor mu?
export const checkCollision = (
  pos1: Point3D,
  dim1: Dimensions,
  pos2: Point3D,
  dim2: Dimensions,
  spacing: number = 0 // İsteğe bağlı güvenlik boşluğu
): boolean => {
  return (
    pos1.x < pos2.x + dim2.width + spacing &&
    pos1.x + dim1.width + spacing > pos2.x &&
    pos1.y < pos2.y + dim2.height &&
    pos1.y + dim1.height > pos2.y &&
    pos1.z < pos2.z + dim2.length &&
    pos1.z + dim1.length > pos2.z
  );
};

// Silindir Hacim Hesabı (Kullanıcı Rulo seçerse)
export const calculateCylinderVolume = (
  radius: number,
  height: number
): number => {
  return Math.PI * radius * radius * height;
};

// Kutu Hacim Hesabı
export const calculateBoxVolume = (dim: Dimensions): number => {
  return dim.width * dim.height * dim.length;
};

// Verilen bir alanın içine sığar mı?
export const doesItFit = (
  itemDim: Dimensions,
  spaceDim: Dimensions
): boolean => {
  return (
    itemDim.width <= spaceDim.width &&
    itemDim.height <= spaceDim.height &&
    itemDim.length <= spaceDim.length
  );
};
