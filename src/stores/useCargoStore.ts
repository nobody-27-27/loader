import { create } from 'zustand';
import type { CargoInput, Container, LoadingResult } from '../types/core';

interface CargoStore {
  // --- State ---
  activeContainer: Container;
  cargoList: CargoInput[];
  loadingResult: LoadingResult | null;
  isCalculating: boolean;

  // Ayarlar
  settings: {
    palletSpacing: number; // Paletler arası boşluk (cm)
  };

  // --- Actions ---
  setContainer: (
    dimensions: { width: number; height: number; length: number },
    name: string,
    id: string
  ) => void;
  addCargo: (cargo: CargoInput) => void;
  removeCargo: (id: string) => void;
  updateSettings: (settings: Partial<CargoStore['settings']>) => void;

  setResult: (result: LoadingResult) => void;
  setCalculating: (status: boolean) => void;
  reset: () => void;
}

// Varsayılan Tır Boyutları (240x1340x260)
const DEFAULT_CONTAINER: Container = {
  id: 'default-truck',
  name: 'Standart Tır',
  dimensions: { width: 240, length: 1340, height: 260 },
};

export const useCargoStore = create<CargoStore>((set) => ({
  activeContainer: DEFAULT_CONTAINER,
  cargoList: [],
  loadingResult: null,
  isCalculating: false,
  settings: {
    palletSpacing: 0, // Varsayılan boşluksuz
  },

  setContainer: (dim, name, id) =>
    set((state) => ({
      activeContainer: { ...state.activeContainer, dimensions: dim, name, id },
    })),

  addCargo: (cargo) =>
    set((state) => ({
      cargoList: [...state.cargoList, cargo],
    })),

  removeCargo: (id) =>
    set((state) => ({
      cargoList: state.cargoList.filter((c) => c.id !== id),
    })),

  updateSettings: (newSettings) =>
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    })),

  setResult: (result) => set({ loadingResult: result }),
  setCalculating: (status) => set({ isCalculating: status }),

  reset: () => set({ cargoList: [], loadingResult: null }),
}));
