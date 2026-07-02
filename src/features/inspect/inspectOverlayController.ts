export type InspectMode = 'pca2d' | 'pca3d' | 'nearest';

export type InspectSubsetState = {
  nearestIndices: number[] | null;
  nearestLayerIdx: number;
  nearestSourceCount: number;
  pca3Indices: number[] | null;
  pca3LayerIdx: number;
  pca3SourceCount: number;
};

export const setActiveInspectModeButton = (buttons: HTMLButtonElement[], activeMode: InspectMode) => {
  buttons.forEach((button) => {
    const mode = (button.dataset.inspectMode || '') as InspectMode;
    button.classList.toggle('active', mode === activeMode);
  });
};

export const buildInspectLayerButtonsHtml = (hiddenLayerCount: number, activeLayerIdx: number) => {
  if (hiddenLayerCount <= 0) {
    return '<span class="text-muted">no hidden layers</span>';
  }

  return Array.from({ length: hiddenLayerCount }, (_, idx) => (
    `<button type="button" class="btn btn-sm btn-outline-dark mr-2 mb-2 inspect-layer-btn ${idx === activeLayerIdx ? 'active' : ''}" onclick="setInspectLayer(${idx})">hidden ${idx + 1}</button>`
  )).join('');
};

export const isValidInspectLayerIdx = (layerIdx: number, hiddenLayerCount: number) => (
  layerIdx >= 0 && layerIdx < hiddenLayerCount
);

export const clampInspectLayerIdx = (layerIdx: number, hiddenLayerCount: number) => (
  Math.max(0, Math.min(layerIdx, Math.max(0, hiddenLayerCount - 1)))
);

export const createResetInspectSubsetState = (): InspectSubsetState => ({
  nearestIndices: null,
  nearestLayerIdx: -1,
  nearestSourceCount: 0,
  pca3Indices: null,
  pca3LayerIdx: -1,
  pca3SourceCount: 0,
});

export const getInspectOverlayOpenState = (currentLayerIdx: number, hiddenLayerCount: number) => ({
  activeLayerIdx: clampInspectLayerIdx(currentLayerIdx, hiddenLayerCount),
  activeMode: 'pca2d' as InspectMode,
});
