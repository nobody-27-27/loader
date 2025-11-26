import type { Dimensions } from '../../types/core';

export interface ContainerPreset {
  id: string;
  name: string;
  dimensions: Dimensions;
}

export const CONTAINER_PRESETS: ContainerPreset[] = [
  {
    id: 'truck-std',
    name: 'Standart Tır',
    dimensions: { width: 240, length: 1340, height: 260 },
  },
  {
    id: '40-hc',
    name: '40 HC Konteyner',
    dimensions: { width: 235, length: 1190, height: 255 },
  },
  {
    id: '40-dc',
    name: '40 DC Konteyner',
    dimensions: { width: 235, length: 1190, height: 230 },
  },
  {
    id: '20-dc',
    name: '20 DC Konteyner',
    dimensions: { width: 235, length: 565, height: 230 },
  },
];
