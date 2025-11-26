import type {
  CargoInput,
  Container,
  LoadingResult,
  PlacedItem,
  Dimensions,
} from '../../types/core';
import { SpaceManager } from './SpaceManager';

export class PackerEngine {
  private container: Container;
  private spaceManager: SpaceManager;
  private result: PlacedItem[] = [];
  private unplaced: CargoInput[] = [];
  private settings: { palletSpacing: number };

  constructor(container: Container, settings: { palletSpacing: number }) {
    this.container = container;
    this.settings = settings;
    this.spaceManager = new SpaceManager(container.dimensions);
  }

  public pack(cargoList: CargoInput[]): LoadingResult {
    this.result = [];
    this.unplaced = [];

    const pallets = cargoList.filter((c) => c.isPalletized);

    let cylinders: CargoInput[] = [];
    cargoList
      .filter((c) => !c.isPalletized && c.type === 'cylinder')
      .forEach((c) => {
        for (let i = 0; i < c.quantity; i++)
          cylinders.push({ ...c, quantity: 1 });
      });
    cylinders.sort((a, b) => (b.radius || 0) - (a.radius || 0));

    const boxes = cargoList.filter((c) => !c.isPalletized && c.type === 'box');

    if (pallets.length > 0) this.packPallets(pallets);
    if (cylinders.length > 0) this.packCylindersSplitStrategy(cylinders);
    if (boxes.length > 0) this.packBoxes(boxes);

    return this.calculateResults();
  }

  private packPallets(pallets: CargoInput[]) {
    const {
      width: contW,
      height: contH,
      length: contL,
    } = this.container.dimensions;
    const spacing = this.settings.palletSpacing;

    let rawItems: { cargo: CargoInput; index: number }[] = [];
    pallets.forEach((p) => {
      for (let i = 0; i < p.quantity; i++)
        rawItems.push({ cargo: p, index: i });
    });

    if (rawItems.length === 0) return;

    let bestResult = {
      placed: [] as PlacedItem[],
      unplaced: [] as CargoInput[],
      score: -1,
    };

    const strategies = [
      (a: any, b: any) =>
        b.cargo.dimensions!.width * b.cargo.dimensions!.length -
        a.cargo.dimensions!.width * a.cargo.dimensions!.length,
      (a: any, b: any) =>
        Math.max(b.cargo.dimensions!.width, b.cargo.dimensions!.length) -
        Math.max(a.cargo.dimensions!.width, a.cargo.dimensions!.length),
    ];
    const heuristics = ['BSSF', 'BAF', 'BL'];

    for (const sortFunc of strategies) {
      const sortedItems = [...rawItems].sort(sortFunc);
      for (const heuristic of heuristics) {
        const res = this.runMaxRectsSimulation(
          sortedItems,
          contW,
          contL,
          spacing,
          heuristic
        );
        if (res.placed.length > bestResult.score) {
          bestResult = {
            placed: res.placed,
            unplaced: res.unplaced,
            score: res.placed.length,
          };
        }
        if (bestResult.score === rawItems.length) break;
      }
      if (bestResult.score === rawItems.length) break;
    }

    if (bestResult.score < rawItems.length) {
      const MAX_ITERATIONS = 500;
      for (let i = 0; i < MAX_ITERATIONS; i++) {
        const shuffledItems = [...rawItems].sort(() => Math.random() - 0.5);
        const res = this.runMaxRectsSimulation(
          shuffledItems,
          contW,
          contL,
          spacing,
          'BSSF'
        );
        if (res.placed.length > bestResult.score) {
          bestResult = {
            placed: res.placed,
            unplaced: res.unplaced,
            score: res.placed.length,
          };
          if (res.placed.length === rawItems.length) break;
        }
      }
    }

    bestResult.placed.forEach((item) => {
      this.result.push(item);
      const isRotated = Math.abs(item.rotation.y) > 0;
      const finalW = isRotated ? item.dimensions.length : item.dimensions.width;
      const finalL = isRotated ? item.dimensions.width : item.dimensions.length;
      this.spaceManager.addUsedSpace({
        x: item.position.x,
        y: item.position.y,
        z: item.position.z,
        width: finalW + spacing,
        height: item.dimensions.height,
        length: finalL,
      });
    });
    bestResult.unplaced.forEach((u) => this.unplaced.push(u));
  }

  private runMaxRectsSimulation(
    items: any[],
    contW: number,
    contL: number,
    spacing: number,
    heuristic: string
  ) {
    const placedItems: PlacedItem[] = [];
    const unplacedItems: CargoInput[] = [];
    let freeRects = [{ x: 0, z: 0, w: contW, l: contL }];
    for (const item of items) {
      const dim = item.cargo.dimensions!;
      let bestNode = {
        score1: Infinity,
        score2: Infinity,
        rectIndex: -1,
        rotated: false,
        x: 0,
        z: 0,
        w: 0,
        l: 0,
      };
      for (let i = 0; i < freeRects.length; i++) {
        const free = freeRects[i];
        const variations = [
          { w: dim.width + spacing, l: dim.length, rot: false },
          { w: dim.length + spacing, l: dim.width, rot: true },
        ];
        for (const v of variations) {
          // --- KENAR BOŞLUK DÜZELTMESİ KORUNDU ---
          const fitsWidth =
            v.w <= free.w + 0.1 || v.w - spacing <= free.w + 0.1;
          const fitsLength =
            v.l <= free.l + 0.1 || v.l - spacing <= free.l + 0.1;

          if (fitsWidth && fitsLength) {
            let score1 = Infinity,
              score2 = Infinity;
            if (heuristic === 'BSSF') {
              const residueW = Math.abs(free.w - v.w);
              const residueL = Math.abs(free.l - v.l);
              score1 = Math.min(residueW, residueL);
              score2 = Math.max(residueW, residueL);
            } else if (heuristic === 'BAF') {
              score1 = free.w * free.l - v.w * v.l;
              score2 = Math.min(Math.abs(free.w - v.w), Math.abs(free.l - v.l));
            } else {
              score1 = free.z;
              score2 = free.x;
            }
            if (
              score1 < bestNode.score1 ||
              (score1 === bestNode.score1 && score2 < bestNode.score2)
            )
              bestNode = {
                score1,
                score2,
                rectIndex: i,
                rotated: v.rot,
                x: free.x,
                z: free.z,
                w: v.w,
                l: v.l,
              };
          }
        }
      }
      if (bestNode.rectIndex !== -1) {
        // --- TİP DÜZELTMESİ KORUNDU ---
        placedItems.push({
          id: item.cargo.id,
          cargoId: item.cargo.id,
          uniqueId: `${item.cargo.id}-${item.index}-sim`,
          type: item.cargo.type, // 'box' yerine dinamik tip
          position: { x: bestNode.x, y: 0, z: bestNode.z },
          rotation: { x: 0, y: bestNode.rotated ? 90 : 0, z: 0 },
          dimensions: bestNode.rotated
            ? { ...dim, width: dim.length, length: dim.width }
            : dim,
          color: item.cargo.color,
          description: `MaxRects`,
          isPalletized: true,
          layout: item.cargo.layout, // Layout verisi varsa taşı
        });
        this.splitFreeRects(freeRects, bestNode);
        this.pruneFreeRects(freeRects);
      } else {
        unplacedItems.push({ ...item.cargo, quantity: 1 });
      }
    }
    return { placed: placedItems, unplaced: unplacedItems };
  }

  private splitFreeRects(freeRects: any[], placedRect: any) {
    for (let i = 0; i < freeRects.length; i++) {
      const free = freeRects[i];
      if (
        this.rectIntersect(
          {
            x: placedRect.x,
            z: placedRect.z,
            w: placedRect.w,
            l: placedRect.l,
          },
          free
        )
      ) {
        if (
          placedRect.x < free.x + free.w &&
          placedRect.x + placedRect.w > free.x
        ) {
          if (placedRect.z > free.z && placedRect.z < free.z + free.l)
            freeRects.push({
              x: free.x,
              z: free.z,
              w: free.w,
              l: placedRect.z - free.z,
            });
          if (placedRect.z + placedRect.l < free.z + free.l)
            freeRects.push({
              x: free.x,
              z: placedRect.z + placedRect.l,
              w: free.w,
              l: free.z + free.l - (placedRect.z + placedRect.l),
            });
        }
        if (
          placedRect.z < free.z + free.l &&
          placedRect.z + placedRect.l > free.z
        ) {
          if (placedRect.x > free.x && placedRect.x < free.x + free.w)
            freeRects.push({
              x: free.x,
              z: free.z,
              w: placedRect.x - free.x,
              l: free.l,
            });
          if (placedRect.x + placedRect.w < free.x + free.w)
            freeRects.push({
              x: placedRect.x + placedRect.w,
              z: free.z,
              w: free.x + free.w - (placedRect.x + placedRect.w),
              l: free.l,
            });
        }
        freeRects.splice(i, 1);
        i--;
      }
    }
  }
  private rectIntersect(r1: any, r2: any): boolean {
    if (!r1 || !r2) return false;
    return (
      r1.x < r2.x + r2.w &&
      r1.x + r1.w > r2.x &&
      r1.z < r2.z + r2.l &&
      r1.z + r1.l > r2.z
    );
  }
  private pruneFreeRects(rects: any[]) {
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        if (this.isContained(rects[i], rects[j])) {
          rects.splice(i, 1);
          i--;
          break;
        }
        if (this.isContained(rects[j], rects[i])) {
          rects.splice(j, 1);
          j--;
        }
      }
    }
  }
  private isContained(a: any, b: any): boolean {
    return (
      a.x >= b.x &&
      a.z >= b.z &&
      a.x + a.w <= b.x + b.w &&
      a.z + a.l <= b.z + b.l
    );
  }

  private packCylindersSplitStrategy(items: CargoInput[]) {
    const {
      width: contW,
      height: contH,
      length: contL,
    } = this.container.dimensions;
    const startZ = this.result.reduce(
      (max, p) => Math.max(max, p.position.z + p.dimensions.length),
      0
    );
    const remainingL = contL - startZ;

    if (remainingL <= 0) {
      items.forEach((i) => this.unplaced.push(i));
      return;
    }

    let bestSimResult = {
      placed: [] as PlacedItem[],
      unplaced: [] as CargoInput[],
      count: -1,
    };

    for (
      let splitIndex = 0;
      splitIndex <= items.length;
      splitIndex += Math.max(1, Math.floor(items.length / 20))
    ) {
      const horizItems = items.slice(0, splitIndex).map((i) => ({ ...i }));
      const vertItems = items.slice(splitIndex).map((i) => ({ ...i }));

      const resH = this.simulateHorizontalStack(
        horizItems,
        contW,
        contH,
        remainingL,
        startZ
      );

      let maxZAfterHoriz = startZ;
      if (resH.placed.length > 0) {
        maxZAfterHoriz = resH.placed.reduce(
          (max, p) => Math.max(max, p.position.z + p.dimensions.length),
          startZ
        );
      }

      const remainingLForVert = contL - maxZAfterHoriz;
      const resV = this.simulateVerticalFill(
        vertItems,
        contW,
        contH,
        remainingLForVert,
        maxZAfterHoriz
      );

      const totalPlaced = resH.placed.length + resV.placed.length;
      if (totalPlaced > bestSimResult.count) {
        bestSimResult = {
          placed: [...resH.placed, ...resV.placed],
          unplaced: [...resH.unplaced, ...resV.unplaced],
          count: totalPlaced,
        };
      }
    }

    bestSimResult.placed.forEach((item) => {
      this.result.push(item);
      this.spaceManager.addUsedSpace({
        x: item.position.x,
        y: item.position.y,
        z: item.position.z,
        width: item.dimensions.width,
        height: item.dimensions.height,
        length: item.dimensions.length,
      });
    });
    bestSimResult.unplaced.forEach((u) => this.unplaced.push(u));
  }

  private simulateHorizontalStack(
    items: CargoInput[],
    W: number,
    H: number,
    L: number,
    offsetZ: number
  ) {
    const placed: PlacedItem[] = [];
    const unplaced: CargoInput[] = [];
    if (items.length === 0) return { placed, unplaced };

    const sample = items[0];
    const r = sample.radius || 30;
    const h = sample.height || 100;
    const D = r * 2;

    // ORİJİNAL METODA DÖNÜŞ: Sadece Grid vs Honeycomb
    const wallPattern = this.solveCylinderSlice(W, H, r);

    let currentZ = offsetZ;
    let itemIdx = 0;

    while (itemIdx < items.length) {
      if (currentZ + h > offsetZ + L + 0.1) break;
      for (const coord of wallPattern) {
        if (itemIdx >= items.length) break;
        const item = items[itemIdx];
        placed.push({
          id: item.id,
          cargoId: item.id,
          uniqueId: `h-split-${item.id}-${itemIdx}`,
          type: 'cylinder',
          dimensions: { width: D, height: D, length: h },
          rotation: { x: 90, y: 0, z: 0 },
          position: { x: coord.x - r, y: coord.y - r, z: currentZ },
          color: item.color,
          description: 'Yatay',
        });
        itemIdx++;
      }
      currentZ += h;
    }
    for (let i = itemIdx; i < items.length; i++) unplaced.push(items[i]);
    return { placed, unplaced };
  }

  private simulateVerticalFill(
    items: CargoInput[],
    W: number,
    H: number,
    L: number,
    offsetZ: number
  ) {
    const placed: PlacedItem[] = [];
    const unplaced: CargoInput[] = [];
    if (items.length === 0 || L <= 0) {
      items.forEach((i) => unplaced.push(i));
      return { placed, unplaced };
    }

    const sample = items[0];
    const r = sample.radius || 30;
    const h = sample.height || 100;
    const D = r * 2;

    if (h > H) {
      items.forEach((i) => unplaced.push(i));
      return { placed, unplaced };
    }
    const vLayers = Math.floor(H / h);
    if (vLayers === 0) {
      items.forEach((i) => unplaced.push(i));
      return { placed, unplaced };
    }

    // ORİJİNAL METODA DÖNÜŞ
    const floorPattern = this.solveCylinderSlice(W, L, r);
    let itemIdx = 0;

    for (const coord of floorPattern) {
      if (itemIdx >= items.length) break;
      if (coord.y - r + D > L + 0.1) continue;
      for (let layer = 0; layer < vLayers; layer++) {
        if (itemIdx >= items.length) break;
        const item = items[itemIdx];
        placed.push({
          id: item.id,
          cargoId: item.id,
          uniqueId: `v-split-${item.id}-${itemIdx}`,
          type: 'cylinder',
          dimensions: { width: D, height: h, length: D },
          rotation: { x: 0, y: 0, z: 0 },
          position: {
            x: coord.x - r,
            y: layer * h,
            z: offsetZ + (coord.y - r),
          },
          color: item.color,
          description: 'Dikey',
        });
        itemIdx++;
      }
    }
    for (let i = itemIdx; i < items.length; i++) unplaced.push(items[i]);
    return { placed, unplaced };
  }

  // --- ORİJİNAL VE SAĞLAM GEOMETRİ MOTORU ---
  private solveCylinderSlice(
    W: number,
    H: number,
    r: number
  ): { x: number; y: number }[] {
    const D = r * 2;
    // 1. Grid
    const layoutGrid: { x: number; y: number }[] = [];
    const cols = Math.floor(W / D);
    const rows = Math.floor(H / D);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        layoutGrid.push({ x: r + col * D, y: r + row * D });
      }
    }

    // 2. Petek (Monte-Carlo ile en iyiyi arar)
    const layoutHoneycomb = this.solveHoneycomb(W, H, r);

    return layoutGrid.length >= layoutHoneycomb.length
      ? layoutGrid
      : layoutHoneycomb;
  }

  private solveHoneycomb(
    W: number,
    H: number,
    r: number
  ): { x: number; y: number }[] {
    const placed: { x: number; y: number }[] = [];
    const R = r;
    const D = r * 2;
    const EPSILON = 0.01;
    const candidates: { x: number; y: number }[] = [];
    candidates.push({ x: R, y: R });
    candidates.push({ x: W - R, y: R });
    for (let x = R; x <= W - R; x += R) candidates.push({ x: x, y: R });

    // Deneme sayısını performans için makul tutalım
    for (let n = 0; n < 2000; n++) {
      let bestCand = null;
      let minY = Infinity;
      let minX = Infinity;
      for (let i = 0; i < candidates.length; i++) {
        const cand = candidates[i];
        if (cand.x < R - EPSILON || cand.x > W - R + EPSILON) continue;
        if (cand.y < R - EPSILON || cand.y > H - R + EPSILON) continue;
        let collision = false;
        for (const p of placed) {
          const distSq = (cand.x - p.x) ** 2 + (cand.y - p.y) ** 2;
          if (distSq < (D - EPSILON) ** 2) {
            collision = true;
            break;
          }
        }
        if (collision) continue;
        if (
          cand.y < minY - EPSILON ||
          (Math.abs(cand.y - minY) < EPSILON && cand.x < minX)
        ) {
          minY = cand.y;
          minX = cand.x;
          bestCand = cand;
        }
      }
      if (!bestCand) break;
      placed.push(bestCand);
      for (const p of placed) {
        if (p === bestCand) continue;
        const distSq = (bestCand.x - p.x) ** 2 + (bestCand.y - p.y) ** 2;
        if (distSq < (2 * D + EPSILON) ** 2) {
          const cx = (bestCand.x + p.x) / 2;
          const cy = (bestCand.y + p.y) / 2;
          const d = Math.sqrt(distSq);
          const hPart = Math.sqrt(Math.max(0, D * D - (d / 2) ** 2));
          const dx = p.x - bestCand.x;
          const dy = p.y - bestCand.y;
          candidates.push({
            x: cx - (dy / d) * hPart,
            y: cy + (dx / d) * hPart,
          });
          candidates.push({
            x: cx + (dy / d) * hPart,
            y: cy - (dx / d) * hPart,
          });
        }
      }
      const distLeft = bestCand.x - R;
      if (distLeft < D && distLeft > 0) {
        const hWall = Math.sqrt(Math.max(0, D * D - distLeft * distLeft));
        candidates.push({ x: R, y: bestCand.y + hWall });
      }
      const distRight = W - R - bestCand.x;
      if (distRight < D && distRight > 0) {
        const hWall = Math.sqrt(Math.max(0, D * D - distRight * distRight));
        candidates.push({ x: W - R, y: bestCand.y + hWall });
      }
    }
    return placed;
  }

  private packBoxes(boxes: CargoInput[]) {
    for (const b of boxes) {
      for (let i = 0; i < b.quantity; i++) {
        const dim = b.dimensions!;
        let renderDim = dim;
        if (b.type === 'cylinder') {
          const d = b.radius! * 2;
          renderDim = { width: d, height: d, length: b.height! };
        }
        const spot = this.spaceManager.findSpot(renderDim, false);
        if (spot) {
          this.result.push({
            id: b.id,
            cargoId: b.id,
            uniqueId: `${b.id}-${i}`,
            type: b.type,
            position: { x: spot.x, y: spot.y, z: spot.z },
            rotation: { x: 0, y: 0, z: 0 },
            dimensions: renderDim,
            color: b.color,
            description: 'Koli/Rulo',
          });
          this.spaceManager.addUsedSpace({
            ...spot,
            width: renderDim.width,
            height: renderDim.height,
            length: renderDim.length,
          });
        } else {
          this.unplaced.push({ ...b, quantity: 1 });
        }
      }
    }
  }
  private calculateResults(): LoadingResult {
    const loadedVol = this.result.reduce(
      (acc, i) =>
        acc + i.dimensions.width * i.dimensions.height * i.dimensions.length,
      0
    );
    const totalVol =
      this.container.dimensions.width *
      this.container.dimensions.height *
      this.container.dimensions.length;
    return {
      containerId: this.container.id,
      placedItems: this.result,
      unplacedItems: this.unplaced,
      volumeUtilization: (loadedVol / totalVol) * 100,
      totalLoadedCount: this.result.length,
    };
  }
}
