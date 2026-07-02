import { Visualizer, DrawableNeuron } from './Visualizer';
import { NeuralCore } from './neuralNetwork/NeuralCore';
import { Neuron } from './neuralNetwork/Neuron';
import { TrainSample } from './neuralNetwork/HelperObjects';
import { createDataLayout, type DataLayout } from './ui/dataLayout';
import { applyRandomTrainSelection, ensureSamplesNotEmpty, normalizePercent } from './neuralNetwork/sampleSelection';
import { renderMainTableLabels, renderMainTableData } from './ui/mainTableRenderer';
import { buildDendrogram, chooseRandomSubsetIndices, projectPca } from './ui/inspectComputation';
import { renderInspectNearestCanvas, renderInspectPca2DCanvas } from './ui/inspectCanvasRendering';
import { buildInspectLayerButtonsHtml, createResetInspectSubsetState, getInspectOverlayOpenState, isValidInspectLayerIdx, setActiveInspectModeButton, type InspectMode } from './features/inspect/inspectOverlayController';
import { buildTestingOverlayTexts, getNextTestingMode } from './features/testing/testingOverlayController';
import { getTestingActiveSortSelector, getTestingCorrectColor, getTestingSingleCostColor, isOneHotTarget, sortTestingRows, type TestingSortDirection, type TestingSortField } from './ui/testingComputations';
import { buildTestingCorrectCellHtml as renderTestingCorrectCellHtml, buildTestingCostCellHtml as renderTestingCostCellHtml, buildTestingModelCellHtml as renderTestingModelCellHtml, buildTestingOutputCellHtml as renderTestingOutputCellHtml, buildTestingTargetCellHtml as renderTestingTargetCellHtml } from './ui/testingRendering';
import basicProject from '../Projekts/basic.json';
import perceptronProject from '../Projekts/perceptron.json';
import xorProject from '../Projekts/XOR.json';
import twoByTwoProject from '../Projekts/2x2.json';
import threeByThreeProject from '../Projekts/3x3.json';
import fourByFourProject from '../Projekts/4x4.json';
import fiveByFiveProject from '../Projekts/5x5.json';
import smileysProject from '../Projekts/smileys.json';
import mnistMiniProject from '../Projekts/MNIST-mini.json';

declare const Plotly: any;

type SerializedSample = [number[], number[], [boolean]];

type ProjectData = {
  samples: SerializedSample[];
  targetLabels?: string[];
};

type ProjectArchitecture = {
  inputSize: number;
  hiddenSizes: number[];
  outputSize: number;
};

type ProjectLearning = {
  rate: number;
  momentum: number;
  epochs: number;
};

type ProjectConfig = {
  projectType?: string;
  architecture: ProjectArchitecture;
  learning: ProjectLearning;
  data: ProjectData;
  weights: number[][][];
};

type TestingMode = 'train' | 'test';

type TestingResultRow = {
  nr: number;
  input: number[];
  output: number[];
  target: number[];
  cost: number;
  isSingleOutput: boolean;
  isClassification: boolean;
};

type InspectPoint = {
  nr: number;
  input: number[];
  output: number[];
  target: number[];
  trainSample: boolean;
  cost: number;
  isClassification: boolean;
  hiddenLayers: number[][];
};

type InspectMarker = {
  x: number;
  y: number;
  size: number;
  input: number[];
  target: number[];
};

let testingInputHoverTooltip: HTMLDivElement;
let testingInputHoverCanvas: HTMLCanvasElement;
let testingInputHoverCtx: CanvasRenderingContext2D;
let inspectOverlay: HTMLElement;
let inspectCanvas: HTMLCanvasElement;
let inspectCtx: CanvasRenderingContext2D;
let inspectLayerControls: HTMLElement;
let inspectPlotlyContainer: HTMLElement;
let inspectHiddenBtn: HTMLButtonElement;
let inspectActiveMode: InspectMode = 'pca2d';
let inspectActiveLayerIdx = 0;
let inspectPoints: InspectPoint[] = [];
let inspectMarkers: InspectMarker[] = [];
const INSPECT_NEAREST_MAX_SAMPLES = 100;
let inspectNearestSubsetIndices: number[] | null = null;
let inspectNearestSubsetLayerIdx = -1;
let inspectNearestSubsetSourceCount = 0;
let inspectPca3SubsetIndices: number[] | null = null;
let inspectPca3SubsetLayerIdx = -1;
let inspectPca3SubsetSourceCount = 0;
let inspectHoverTooltip: HTMLDivElement;
let inspectHoverInputCanvas: HTMLCanvasElement;
let inspectHoverInputCtx: CanvasRenderingContext2D;
let inspectHoverTargetWrap: HTMLDivElement;
let interfaceHelpTooltip: HTMLDivElement;

(window as any).slide = (i: number, value: number) => {
  input[i] = Number(value);
  isManualInput = true;
  selectedSampleIndex = -1;
  updateUI();
}

(window as any).addOrRemoveLayer = (add: boolean) => {
  neuralCore.addOrRemoveLayer(add);
  resetEpochHistory();
  updateUI();
}

(window as any).addOrRemoveNeuron = (add: boolean, layerIdx: number) => {
  if (add && layerIdx === neuralCore.getLayerCnt() - 1 && neuralCore.getOutputSize() >= MAX_OUTPUTS) {
    return;
  }
  neuralCore.addOrRemoveNeuron(add, layerIdx);
  syncTargetLabelsWithOutputSize();

  ensureTrainingSamplesNotEmpty();
  const samples = neuralCore.getTrainingSamples();
  if (samples.length > 0) {
    selectedSampleIndex = Math.min(Math.max(selectedSampleIndex, 0), samples.length - 1);
    input = samples[selectedSampleIndex].input.slice();
    isManualInput = false;
  } else {
    selectedSampleIndex = -1;
  }

  resetEpochHistory();
  updateUI();
}

(window as any).setArchitectureValue = (type: string, layerIdx: number, value: string) => {
  setArchitectureValue(type as ArchitectureValueType, layerIdx, value);
}

(window as any).trainCurrentSample = () => {
  trainCurrentSample();
}

(window as any).trainOneEpoch = () => {
  trainOneEpoch();
}

(window as any).runFullTraining = () => {
  startFullTraining();
}

(window as any).stopFullTraining = () => {
  stopFullTraining();
}

(window as any).continueFullTraining = () => {
  continueFullTraining();
}

(window as any).closeTrainingGraphOverlay = () => {
  closeTrainingGraphOverlay();
}

(window as any).openTestingResultsOverlay = (mode: string) => {
  openTestingResultsOverlay(mode as TestingMode);
}

(window as any).closeTestingResultsOverlay = () => {
  closeTestingResultsOverlay();
}

(window as any).switchTestingResultsMode = () => {
  switchTestingResultsMode();
}

(window as any).sortTestingResultsBy = (field: string, direction: string) => {
  sortTestingResultsBy(field as TestingSortField, direction as TestingSortDirection);
}

(window as any).openInspectOverlay = () => {
  openInspectOverlay();
}

(window as any).closeInspectOverlay = () => {
  closeInspectOverlay();
}

(window as any).setInspectMode = (mode: string) => {
  setInspectMode(mode as InspectMode);
}

(window as any).setInspectLayer = (layerIdx: number) => {
  setInspectLayer(layerIdx);
}

(window as any).openTrainingDataEditor = () => {
  openTrainingDataEditor();
}

(window as any).applyTrainingDataFromEditor = () => {
  applyTrainingDataFromEditor();
}

(window as any).cancelTrainingDataEditor = () => {
  cancelTrainingDataEditor();
}

(window as any).setTrainingData = () => {
  applyTrainingDataFromEditor();
}

(window as any).toggleTrainSample = (idx: number, checked: boolean) => {
  const samples = neuralCore.getTrainingSamples();
  if (idx < 0 || idx >= samples.length) {
    return;
  }
  samples[idx].trainSample = checked;
  resetEpochHistory();
  updateUI();
}

(window as any).shiftMainInputColumns = (delta: number) => {
  const inputCount = neuralCore.getInputSize();
  if (inputCount <= 16) {
    inputColumnWindowStart = 0;
    return;
  }

  const visibleInputCount = 15;
  const maxWindowStart = Math.max(0, inputCount - visibleInputCount);
  inputColumnWindowStart = Math.max(0, Math.min(maxWindowStart, inputColumnWindowStart + delta));
  updateUI();
}

(window as any).openEditableDataOverlay = () => {
  toggleMainTableEditMode();
}

(window as any).openVisualDataEditor = () => {
  openVisualDataEditor();
}

(window as any).cancelEditableDataOverlay = () => {
  if (mainTableEditMode) {
    closeMainTableEditModeDiscard();
  }
}

(window as any).applyEditableDataOverlay = () => {
  finishMainTableEdits();
}

(window as any).addEditableDataSample = () => {
  addMainTableEditSample();
}

(window as any).applyEditableTrainSamplePercentage = () => {
  applyMainEditTrainSamplePercentage();
}

(window as any).updateEditableDataValue = (rowIdx: number, section: 'input' | 'output', valueIdx: number, value: number) => {
  updateMainTableEditValue(rowIdx, section, valueIdx, value);
}

(window as any).toggleEditableDataTrainSample = (rowIdx: number, checked: boolean) => {
  if (rowIdx < 0 || rowIdx >= editableDataSamples.length) {
    return;
  }
  editableDataSamples[rowIdx].trainSample = checked;
}

(window as any).deleteEditableDataSample = (rowIdx: number) => {
  deleteMainTableEditSample(rowIdx);
}

(window as any).toggleMainTableEditMode = () => {
  toggleMainTableEditMode();
}

(window as any).handleEditInTableButton = () => {
  handleEditInTableButton();
}

(window as any).finishMainTableEdits = () => {
  finishMainTableEdits();
}

(window as any).addMainTableEditSample = () => {
  addMainTableEditSample();
}

(window as any).toggleMainTableEditTrainSample = (rowIdx: number, checked: boolean) => {
  toggleMainTableEditTrainSample(rowIdx, checked);
}

(window as any).applyMainEditTrainSamplePercentage = () => {
  applyMainEditTrainSamplePercentage();
}

(window as any).deleteMainTableEditSample = (rowIdx: number) => {
  deleteMainTableEditSample(rowIdx);
}

(window as any).requestDeleteAllMainTableEditSamples = () => {
  requestDeleteAllMainTableEditSamples();
}

(window as any).confirmDeleteAllMainTableEditSamples = () => {
  confirmDeleteAllMainTableEditSamples();
}

(window as any).cancelDeleteAllMainTableEditSamples = () => {
  cancelDeleteAllMainTableEditSamples();
}

(window as any).focusMainTableCellInput = (inputEl: HTMLInputElement) => {
  focusMainTableCellInput(inputEl);
}

(window as any).blurMainTableCellInput = (inputEl: HTMLInputElement, rowIdx: number, section: 'input' | 'output', valueIdx: number) => {
  blurMainTableCellInput(inputEl, rowIdx, section, valueIdx);
}

(window as any).handleMainTableCellInputKey = (event: KeyboardEvent, inputEl: HTMLInputElement, rowIdx: number, section: 'input' | 'output', valueIdx: number) => {
  handleMainTableCellInputKey(event, inputEl, rowIdx, section, valueIdx);
}

(window as any).showEditableDataPreview = (rowIdx: number, anchorEl: HTMLElement) => {
  showEditableDataPreview(rowIdx, anchorEl);
}

(window as any).showTrainingDataPreview = (rowIdx: number, anchorEl: HTMLElement) => {
  showTrainingDataPreview(rowIdx, anchorEl);
}

(window as any).showTestingInputHoverForCanvas = (canvasEl: HTMLCanvasElement) => {
  showTestingInputHover(canvasEl);
}

(window as any).hideTestingInputHoverForCanvas = () => {
  hideTestingInputHover();
}

(window as any).hideEditableDataPreview = () => {
  hideEditableDataPreview();
}

(window as any).editEditableDataRow = (rowIdx: number) => {
  editEditableDataRow(rowIdx);
}

(window as any).editTrainingDataRow = (rowIdx: number) => {
  editTrainingDataRow(rowIdx);
}

(window as any).editMainTableRow = (rowIdx: number) => {
  editMainTableRow(rowIdx);
}

(window as any).setPixelEditorTool = (tool: 'toggle' | 'black' | 'white') => {
  setPixelEditorTool(tool);
}

(window as any).undoPixelEditorStroke = () => {
  undoPixelEditorStroke();
}

(window as any).fillPixelEditorBlack = () => {
  fillPixelEditorBlack();
}

(window as any).fillPixelEditorWhite = () => {
  fillPixelEditorWhite();
}

(window as any).fillPixelEditorTargetsBlack = () => {
  fillPixelEditorTargetsBlack();
}

(window as any).fillPixelEditorTargetsWhite = () => {
  fillPixelEditorTargetsWhite();
}

(window as any).applyPixelEditorCircle = () => {
  applyPixelEditorCircle();
}

(window as any).setPixelOutputEditMode = (mode: 'paint' | 'numeric') => {
  setPixelOutputEditMode(mode);
}

(window as any).setTargetToggleBrushMode = () => {
  setTargetToggleBrushMode();
}

(window as any).navigateEditablePixelSample = (delta: number) => {
  navigateEditablePixelSample(delta);
}

(window as any).selectEditablePixelSample = (rowIdx: number) => {
  selectEditablePixelSample(rowIdx);
}

(window as any).addEditablePixelSample = () => {
  addEditablePixelSample();
}

(window as any).deleteEditablePixelSample = (rowIdx: number) => {
  deleteEditablePixelSample(rowIdx);
}

(window as any).toggleActiveEditablePixelSampleTrain = (checked: boolean) => {
  toggleActiveEditablePixelSampleTrain(checked);
}

(window as any).toggleEditablePixelSampleTrain = (rowIdx: number, checked: boolean) => {
  toggleEditablePixelSampleTrain(rowIdx, checked);
}

(window as any).updatePixelEditorTargetValue = (idx: number, value: number) => {
  updatePixelEditorTargetValue(idx, value);
}

(window as any).focusPixelTargetNumericInput = (inputEl: HTMLInputElement) => {
  focusPixelTargetNumericInput(inputEl);
}

(window as any).blurPixelTargetNumericInput = (inputEl: HTMLInputElement, idx: number) => {
  blurPixelTargetNumericInput(inputEl, idx);
}

(window as any).handlePixelTargetNumericInputKey = (event: KeyboardEvent, inputEl: HTMLInputElement, idx: number) => {
  handlePixelTargetNumericInputKey(event, inputEl, idx);
}

(window as any).resetPixelEditorInputs = () => {
  resetPixelEditorInputs();
}

(window as any).resetPixelEditorTargets = () => {
  resetPixelEditorTargets();
}

(window as any).applyPixelEditorData = () => {
  applyPixelEditorData();
}

(window as any).resetPixelEditorData = () => {
  resetPixelEditorData();
}

(window as any).cancelPixelEditorOverlay = () => {
  cancelPixelEditorOverlay();
}

(window as any).addLiveInputAsTestSample = () => {
  addLiveInputAsTestSample();
}
(window as any).randomWeights = () => {
  try {
    neuralCore.randomWeights();
  } catch (err) {
    alert(err);
  }
  resetEpochHistory();
  updateUI()
}
(window as any).openWeightsEditor = () => {
  openWeightsEditor();
}

(window as any).applyWeightsFromEditor = () => {
  applyWeightsFromEditor();
}

(window as any).cancelWeightsEditor = () => {
  cancelWeightsEditor();
}

(window as any).openSaveWeightsOverlay = () => {
  openSaveWeightsOverlay();
}

(window as any).closeSaveWeightsOverlay = () => {
  closeSaveWeightsOverlay();
}

(window as any).copyWeightsToClipboard = () => {
  copyWeightsToClipboard();
}

(window as any).setWeights = () => {
  applyWeightsFromEditor();
}

(window as any).openSaveProjectOverlay = () => {
  openSaveProjectOverlay();
}

(window as any).closeSaveProjectOverlay = () => {
  closeSaveProjectOverlay();
}

(window as any).copyProjectToClipboard = () => {
  copyProjectToClipboard();
}

(window as any).saveProjectToFile = () => {
  saveProjectToFile();
}

(window as any).openLoadProjectOverlay = () => {
  openLoadProjectOverlay();
}

(window as any).loadProjectFromFile = () => {
  loadProjectFromFile();
}

(window as any).cancelLoadProjectOverlay = () => {
  cancelLoadProjectOverlay();
}

(window as any).applyProjectFromEditor = () => {
  applyProjectFromEditor();
}

(window as any).openTargetLabelsOverlay = () => {
  openTargetLabelsOverlay();
}

(window as any).updateTargetLabelValue = (idx: number, value: string) => {
  updateTargetLabelValue(idx, value);
}

(window as any).applyTargetLabelsOverlay = () => {
  applyTargetLabelsOverlay();
}

(window as any).cancelTargetLabelsOverlay = () => {
  cancelTargetLabelsOverlay();
}

(window as any).syncEditableGroupScroll = (groupName: 'input' | 'target', scrollLeft: number, sourceId: string) => {
  const groupElements = Array.from(document.querySelectorAll(`#editable-data-overlay .group-${groupName}-group`)) as HTMLElement[];
  groupElements.forEach((element) => {
    if (element.dataset.scrollId !== sourceId) {
      element.scrollLeft = scrollLeft;
    }
  });
}

(window as any).syncMainDataInputScroll = (scrollLeft: number, sourceId: string) => {
  if (mainDataScrollSyncing) {
    return;
  }
  mainDataScrollSyncing = true;
  const groupElements = Array.from(document.querySelectorAll('.main-data-input-scrollable')) as HTMLElement[];
  groupElements.forEach((element) => {
    if (element.dataset.scrollId !== sourceId) {
      element.scrollLeft = scrollLeft;
    }
  });
  mainDataScrollSyncing = false;
}

(window as any).reset = () => {
  neuralCore.reset();
  resetEpochHistory();
  updateUI();
}

(window as any).applyTrainingSample = (idx: number) => {
  const samples = neuralCore.getTrainingSamples();
  if (idx < 0 || idx >= samples.length) {
    return;
  }
  selectedSampleIndex = idx;
  input = samples[idx].input.slice();
  isManualInput = false;
  updateUI();
}

window.onload = () => {
  main();
};

window.addEventListener('resize', () => {
  hideEditableDataPreview();
  hideInterfaceHelpTooltip();
  if (editablePixelEditorOverlay && editablePixelEditorOverlay.style.display !== 'none') {
    updatePixelEditorCanvas();
    updatePixelTargetEditor();
  }
  if (graphView && graphView.style.display !== 'none') {
    updateTrainingGraphDialogWidth();
  }
  if (neuralCore) {
    updateUI();
  }
  if (inspectOverlay && inspectOverlay.style.display !== 'none') {
    renderInspectVisualization();
  }
});

let neuralCore: NeuralCore;
let visualizer: Visualizer;
let input: number[];
let selectedSampleIndex = -1;
let fullTrainingRunning = false;
let fullTrainingTimer: number | null = null;
let epochCostHistory: number[] = [];
let currentTrainingTargetEpoch = 0;
let isManualInput = false;
let trainOneEpochRunning = false;
let epochNoticeTimer: number | null = null;
let inputColumnWindowStart = 0;

const MAIN_DATA_VIRTUAL_THRESHOLD = 120;
const MAIN_DATA_VIRTUAL_BUFFER_ROWS = 8;
const MAIN_DATA_VIRTUAL_ROW_HEIGHT = 40;
const MAX_OUTPUTS = 11;

let mainDataVirtualActive = false;
let mainDataLastWindowStart = -1;
let mainDataLastWindowEnd = -1;
let mainDataLastWindowOffset = -1;
let mainDataLastSelectedSample = -1;
let mainTableEditMode = false;
let mainTableEditSamples: TrainSample[] = [];

const presetProjects: Record<string, ProjectConfig> = {
  basic: basicProject as ProjectConfig,
  perceptron: perceptronProject as ProjectConfig,
  XOR: xorProject as ProjectConfig,
  '2x2': twoByTwoProject as ProjectConfig,
  '3x3': threeByThreeProject as ProjectConfig,
  '4x4': fourByFourProject as ProjectConfig,
  '5x5': fiveByFiveProject as ProjectConfig,
  smileys: smileysProject as ProjectConfig,
  'MNIST-mini': mnistMiniProject as ProjectConfig,
};

const presetProjectAliases: Record<string, string> = {
  smiley: 'smileys',
  'mnist mini': 'MNIST-mini',
  'mnist-mini': 'MNIST-mini',
};

let currentProjectType = 'basic';
let inputSize = 1;
let hiddenSizes: number[] = [];
let outputSize = 1;

let mainContainer: HTMLElement;
let visualizationView: HTMLElement;
let graphView: HTMLElement;
let trainingGraphDialog: HTMLElement;
let layerControls: HTMLElement;
let inputControls: HTMLElement;
let canvas: HTMLCanvasElement;
let trainingGraphCanvas: HTMLCanvasElement;
let trainingGraphCtx: CanvasRenderingContext2D;
let trainCurrentSampleBtn: HTMLButtonElement;
let trainOneEpochBtn: HTMLButtonElement;
let runFullTrainingBtn: HTMLButtonElement;
let stopFullTrainingBtn: HTMLButtonElement;
let continueTrainingBtn: HTMLButtonElement;
let closeTrainingGraphBtn: HTMLButtonElement;
let resetBtn: HTMLButtonElement;
let trainingEpochNotice: HTMLElement;
let projectLoadingOverlay: HTMLElement;
let randomWeightsBtn: HTMLButtonElement;
let setWeightsManuallyBtn: HTMLButtonElement;
let saveWeightsBtn: HTMLButtonElement;
let testingResultsOverlay: HTMLElement;
let testingResultsBody: HTMLElement;
let testingResultsHeader: HTMLElement;
let testingResultsTitle: HTMLElement;
let testingResultsEmpty: HTMLElement;
let testingResultsSwitchBtn: HTMLButtonElement;
let testingCurrentMode: TestingMode = 'train';
let testingRows: TestingResultRow[] = [];
let testingSortField: TestingSortField = 'nr';
let testingSortDirection: TestingSortDirection = 'asc';
let projectSelect: HTMLSelectElement;
let saveProjectBtn: HTMLButtonElement;
let loadProjectBtn: HTMLButtonElement;
let projectSaveOverlay: HTMLElement;
let projectSaveOutput: HTMLTextAreaElement;
let projectEditorOverlay: HTMLElement;
let projectEditorInput: HTMLTextAreaElement;
let projectEditorError: HTMLElement;

let rateInput: HTMLSelectElement;
let momentumInput: HTMLInputElement;
let itersInput: HTMLInputElement;

let trainingSetLabelsOutput: HTMLElement;
let trainingSetDataOutput: HTMLElement;
let mainDataHint: HTMLElement;
let editInTableBtn: HTMLButtonElement;
let mainDataEditControls: HTMLElement;
let mainEditTrainSelectControl: HTMLElement;
let mainEditTrainPercentInput: HTMLInputElement;
let mainDataDeleteAllOverlay: HTMLElement;
let trainingSetInput: HTMLTextAreaElement;
let trainingDataEditorOverlay: HTMLElement;
let trainingDataEditorError: HTMLElement;
let dataAdjustArchitectureCheckbox: HTMLInputElement;
let weightsPreviewInput: HTMLTextAreaElement;
let weightsEditorOverlay: HTMLElement;
let weightsEditorInput: HTMLTextAreaElement;
let weightsEditorError: HTMLElement;
let weightsAdjustArchitectureCheckbox: HTMLInputElement;
let weightsSaveOverlay: HTMLElement;
let weightsSaveOutput: HTMLTextAreaElement;
let editableDataOverlay: HTMLElement;
let editableDataHeaders: HTMLElement;
let editableDataBody: HTMLElement;
let editableDataError: HTMLElement;
let editableTrainSelectControl: HTMLElement;
let editableTrainPercentInput: HTMLInputElement;
let editableDataSamples: TrainSample[] = [];
let editableDataScrollSyncing = false;
let mainDataScrollSyncing = false;
let editablePreviewTooltip: HTMLDivElement;
let editablePreviewCanvas: HTMLCanvasElement;
let editablePreviewCtx: CanvasRenderingContext2D;
let editablePixelEditorOverlay: HTMLElement;
let editablePixelOverlayTitle: HTMLElement;
let editablePixelApplyBtn: HTMLButtonElement;
let liveInputAddTestSampleControls: HTMLElement;
let editablePixelEditorCanvas: HTMLCanvasElement;
let editablePixelEditorCtx: CanvasRenderingContext2D;
let editableTargetEditorCanvas: HTMLCanvasElement;
let editableTargetEditorCtx: CanvasRenderingContext2D;
let editablePixelTargetLabelsEl: HTMLElement;
let editableTargetNumericWrap: HTMLElement;
let editableSampleList: HTMLElement;
let editableActiveSampleTrainCheckbox: HTMLInputElement;
let editablePixelEditorError: HTMLElement;
let editablePixelUndoBtn: HTMLButtonElement;
let editablePixelEditorActiveRow = -1;
let editablePixelEditorCols = 1;
let editablePixelEditorInputValues: number[] = [];
let editablePixelEditorOutputValues: number[] = [];
let editablePixelEditorOriginalInputValues: number[] = [];
let editablePixelEditorOriginalOutputValues: number[] = [];
let editablePixelEditorTool: 'toggle' | 'black' | 'white' = 'toggle';
let editablePixelEditorOutputMode: 'paint' | 'numeric' = 'paint';
let editablePixelEditorMouseDown = false;
let editablePixelEditorMouseSurface: 'input' | 'target' | null = null;
let editablePixelEditorStrokeSnapshot: number[] | null = null;
let editablePixelEditorStrokeHistory: number[][] = [];
let editablePixelEditorMode: 'samples' | 'live-input' = 'samples';
let liveInputOverlayOriginalInputValues: number[] = [];
let liveInputRefreshPending = false;
let targetLabelsOverlay: HTMLElement;
let targetLabelsBody: HTMLElement;
let targetLabelsError: HTMLElement;
let targetLabels: string[] = [];
let editableTargetLabels: string[] = [];
let targetLabelsJson = '[]';

const getMainDataLayout = (): DataLayout => {
  const mainTableWrap = (trainingSetDataOutput
    ? (trainingSetDataOutput.closest('.main-data-table-wrap') as HTMLElement | null)
    : null) || (document.querySelector('.main-data-table-wrap') as HTMLElement | null);
  const mainContainerWidth = mainTableWrap?.clientWidth || window.innerWidth;
  const baseLayout = createDataLayout(mainContainerWidth, neuralCore.getInputSize(), neuralCore.getOutputSize(), 190);
  return {
    ...baseLayout,
    scrollMode: 'none',
    inputScrollable: false,
    targetScrollable: false,
    inputWidth: undefined,
    targetWidth: undefined,
    tableScrollable: false,
  };
};

const getEditableDataLayout = () => {
  const dialogWidth = editableDataOverlay
    ? (editableDataOverlay.querySelector('.weights-editor-dialog') as HTMLElement)?.clientWidth || 900
    : 900;
  const tableContainerWidth = editableDataOverlay
    ? (editableDataOverlay.querySelector('.table-responsive') as HTMLElement)?.clientWidth || Math.max(320, dialogWidth - 48)
    : Math.max(320, dialogWidth - 48);
  const inputCount = neuralCore.getInputSize();
  const targetCount = neuralCore.getOutputSize();
  return createDataLayout(tableContainerWidth, inputCount, targetCount, 248);
};

const ensureTrainingSamplesNotEmpty = () => {
  if (!neuralCore || neuralCore.getTrainingSamples().length > 0) {
    return;
  }

  const defaultInput = new Array(neuralCore.getInputSize()).fill(1);
  const defaultOutput = new Array(neuralCore.getOutputSize()).fill(0);
  neuralCore.addTrainingSet(defaultInput, defaultOutput, true);
};

const ensureEditableSamplesNotEmpty = () => {
  ensureSamplesNotEmpty(editableDataSamples, neuralCore.getInputSize(), neuralCore.getOutputSize());
};

const updateEditableTrainSelectControlVisibility = () => {
  if (!editableTrainSelectControl) {
    return;
  }
  editableTrainSelectControl.style.display = editableDataSamples.length > 10 ? 'inline-flex' : 'none';
};

const applyEditableTrainSamplePercentage = () => {
  if (editableDataSamples.length === 0) {
    return;
  }

  const parsedPercent = Number.parseFloat(editableTrainPercentInput?.value || '80');
  const normalizedPercent = normalizePercent(parsedPercent, 80);
  if (editableTrainPercentInput) {
    editableTrainPercentInput.value = Math.round(normalizedPercent).toString();
  }

  applyRandomTrainSelection(editableDataSamples, normalizedPercent);
  buildEditableDataTable();
};

const initEditableGroupScrollSync = () => {
  const syncGroupScroll = (groupElements: HTMLElement[], source: HTMLElement) => {
    if (editableDataScrollSyncing) {
      return;
    }
    editableDataScrollSyncing = true;
    const sourceScrollLeft = source.scrollLeft;
    groupElements.forEach((other) => {
      if (other !== source) {
        other.scrollLeft = sourceScrollLeft;
      }
    });
    editableDataScrollSyncing = false;
  };

  const wireGroup = (groupName: 'input' | 'target') => {
    const groupElements = Array.from(document.querySelectorAll(`#editable-data-overlay .group-${groupName}-group.group-scrollable`)) as HTMLElement[];
    groupElements.forEach((element) => {
      if (element.dataset.scrollSyncBound === '1') {
        return;
      }

      element.addEventListener('scroll', () => {
        syncGroupScroll(groupElements, element);
      });

      element.addEventListener('wheel', (event) => {
        const wheelEvent = event as WheelEvent;
        const dominantDelta = Math.abs(wheelEvent.deltaX) > Math.abs(wheelEvent.deltaY)
          ? wheelEvent.deltaX
          : wheelEvent.deltaY;
        if (dominantDelta === 0) {
          return;
        }
        wheelEvent.preventDefault();
        element.scrollLeft += dominantDelta;
        syncGroupScroll(groupElements, element);
      }, { passive: false });

      element.dataset.scrollSyncBound = '1';
    });
  };

  wireGroup('input');
  wireGroup('target');
};

const resetEpochHistory = () => {
  epochCostHistory = [neuralCore.getCost()];
};

const configureTrainingSettings = () => {
  neuralCore.setRate(Number.parseFloat(rateInput.value));
  neuralCore.setMomentum(Number.parseFloat(momentumInput.value));
};

const getSerializedSamples = (): SerializedSample[] => neuralCore.getTrainingSamples().map((sample) => {
  return [sample.input.slice(), sample.output.slice(), [!!sample.trainSample]];
});

const formatDataBlock = (data: ProjectData) => {
  const sampleLines = data.samples.map((sample) => `    ${JSON.stringify(sample)}`);
  const samplesBlock = sampleLines.length
    ? `[
${sampleLines.join(',\n')}
  ]`
    : '[]';
  const labelsBlock = JSON.stringify(data.targetLabels || [], null, 2)
    .split('\n')
    .map((line) => `  ${line}`)
    .join('\n')
    .trimStart();

  return `{
  "samples": ${samplesBlock},
  "targetLabels": ${labelsBlock}
}`;
};

const setSelectValue = (select: HTMLSelectElement, rawValue: number) => {
  const value = `${rawValue}`;
  const hasValue = Array.from(select.options).some((option) => option.value === value);
  if (!hasValue) {
    const option = document.createElement('option');
    option.value = value;
    option.text = value;
    select.appendChild(option);
  }
  select.value = value;
};

const toFiniteNumber = (value: any, fieldName: string) => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    throw `${fieldName} must be a number.`;
  }
  return num;
};

const toPositiveInt = (value: any, fieldName: string) => {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1) {
    throw `${fieldName} must be an integer >= 1.`;
  }
  return num;
};

const parseTrainingDataPayload = (payload: any, expectedInputSize?: number, expectedOutputSize?: number) => {
  let parsedSamples: any;
  let parsedTargetLabels: any = undefined;

  if (Array.isArray(payload)) {
    parsedSamples = payload;
  } else if (payload && typeof payload === 'object') {
    parsedSamples = payload.samples;
    parsedTargetLabels = payload.targetLabels;
  } else {
    throw 'Training data must be a JSON array or object with "samples".';
  }

  if (!Array.isArray(parsedSamples)) {
    throw 'Training data "samples" must be a JSON array.';
  }

  let inferredInputSize: number | null = null;
  let inferredOutputSize: number | null = null;

  const nextSamples = parsedSamples.map((sample, idx) => {
    if (!Array.isArray(sample) || sample.length !== 3) {
      throw `Sample ${idx + 1} must have exactly 3 entries: [input, output, [trainSample]].`;
    }

    const sampleInput = sample[0];
    const sampleOutput = sample[1];
    const trainFlagArray = sample[2];

    if (!Array.isArray(sampleInput)) {
      throw `Sample ${idx + 1}: input must be an array.`;
    }
    if (!Array.isArray(sampleOutput)) {
      throw `Sample ${idx + 1}: output must be an array.`;
    }
    if (!Array.isArray(trainFlagArray) || trainFlagArray.length !== 1 || typeof trainFlagArray[0] !== 'boolean') {
      throw `Sample ${idx + 1}: third entry must be [true] or [false].`;
    }

    if (inferredInputSize == null) {
      inferredInputSize = sampleInput.length;
    }
    if (inferredOutputSize == null) {
      inferredOutputSize = sampleOutput.length;
    }

    if (sampleInput.length !== inferredInputSize) {
      throw `Sample ${idx + 1}: input size mismatch. Expected ${inferredInputSize}, got ${sampleInput.length}.`;
    }
    if (sampleOutput.length !== inferredOutputSize) {
      throw `Sample ${idx + 1}: output size mismatch. Expected ${inferredOutputSize}, got ${sampleOutput.length}.`;
    }

    const sampleInputNums = sampleInput.map((value, inputIdx) => {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        throw `Sample ${idx + 1}, input ${inputIdx + 1}: must be a number.`;
      }
      return num;
    });

    const sampleOutputNums = sampleOutput.map((value, outputIdx) => {
      const num = Number(value);
      if (!Number.isFinite(num)) {
        throw `Sample ${idx + 1}, output ${outputIdx + 1}: must be a number.`;
      }
      return num;
    });

    return {
      input: sampleInputNums,
      output: sampleOutputNums,
      trainSample: trainFlagArray[0],
    };
  });

  if (typeof expectedInputSize === 'number' && inferredInputSize !== null && inferredInputSize !== expectedInputSize) {
    throw `Input size does not match current architecture. Expected ${expectedInputSize}, got ${inferredInputSize}.`;
  }
  if (inferredOutputSize !== null && inferredOutputSize > MAX_OUTPUTS) {
    throw `Output size is limited to ${MAX_OUTPUTS}. Got ${inferredOutputSize}.`;
  }
  if (typeof expectedOutputSize === 'number' && inferredOutputSize !== null && inferredOutputSize !== expectedOutputSize) {
    throw `Output size does not match current architecture. Expected ${expectedOutputSize}, got ${inferredOutputSize}.`;
  }

  let nextTargetLabels: string[] | undefined;
  if (typeof parsedTargetLabels !== 'undefined') {
    if (!Array.isArray(parsedTargetLabels)) {
      throw 'Training data "targetLabels" must be an array of strings.';
    }

    const validatedTargetLabels = parsedTargetLabels.map((value, idx) => {
      if (typeof value !== 'string') {
        throw `targetLabels ${idx + 1}: must be a string.`;
      }
      const trimmed = value.trim();
      if (trimmed.length > 10) {
        throw `targetLabels ${idx + 1}: max length is 10.`;
      }
      return trimmed;
    });

    const targetCountForValidation =
      inferredOutputSize
      ?? expectedOutputSize
      ?? neuralCore.getOutputSize();

    if (validatedTargetLabels.length !== targetCountForValidation) {
      throw `targetLabels count mismatch. Expected ${targetCountForValidation}, got ${validatedTargetLabels.length}.`;
    }

    nextTargetLabels = validatedTargetLabels.map((label, idx) => label.length > 0 ? label : makeDefaultTargetLabel(idx));
  }

  return {
    samples: nextSamples,
    inputSize: inferredInputSize,
    outputSize: inferredOutputSize,
    targetLabels: nextTargetLabels,
  };
};

const getCurrentProjectConfig = (): ProjectConfig => ({
  projectType: currentProjectType,
  architecture: {
    inputSize: neuralCore.getInputSize(),
    hiddenSizes: neuralCore.getHiddenLayerSizes().slice(),
    outputSize: neuralCore.getOutputSize(),
  },
  learning: {
    rate: Number.parseFloat(rateInput.value),
    momentum: Number.parseFloat(momentumInput.value),
    epochs: Number.parseInt(itersInput.value, 10),
  },
  data: {
    samples: getSerializedSamples(),
    targetLabels: targetLabels.slice(),
  },
  weights: neuralCore.getWeights(),
});

const normalizeProjectConfig = (raw: any): ProjectConfig => {
  if (!raw || typeof raw !== 'object') {
    throw 'Project JSON must be an object.';
  }

  const architecture = raw.architecture;
  const learning = raw.learning;
  const data = raw.data;
  const weights = raw.weights;

  if (!architecture || typeof architecture !== 'object') {
    throw 'Project JSON requires an "architecture" object.';
  }
  if (!learning || typeof learning !== 'object') {
    throw 'Project JSON requires a "learning" object.';
  }

  const normalizedArchitecture: ProjectArchitecture = {
    inputSize: toPositiveInt(architecture.inputSize, 'architecture.inputSize'),
    hiddenSizes: Array.isArray(architecture.hiddenSizes)
      ? architecture.hiddenSizes.map((value: any, idx: number) => toPositiveInt(value, `architecture.hiddenSizes[${idx}]`))
      : (() => { throw 'architecture.hiddenSizes must be an array.'; })(),
    outputSize: toPositiveInt(architecture.outputSize, 'architecture.outputSize'),
  };

  if (normalizedArchitecture.outputSize > MAX_OUTPUTS) {
    throw `architecture.outputSize must be <= ${MAX_OUTPUTS}.`;
  }

  if (normalizedArchitecture.hiddenSizes.length > 3) {
    throw 'At most 3 hidden layers are supported.';
  }

  const normalizedLearning: ProjectLearning = {
    rate: toFiniteNumber(learning.rate, 'learning.rate'),
    momentum: toFiniteNumber(learning.momentum, 'learning.momentum'),
    epochs: toPositiveInt(learning.epochs, 'learning.epochs'),
  };

  const parsedData = parseTrainingDataPayload(
    data,
    normalizedArchitecture.inputSize,
    normalizedArchitecture.outputSize
  );

  if (!Array.isArray(weights)) {
    throw 'Project JSON requires a "weights" array.';
  }

  // Validate consistency with architecture before mutating the active project.
  const validationCore = new NeuralCore(
    normalizedArchitecture.inputSize,
    normalizedArchitecture.hiddenSizes.slice(),
    normalizedArchitecture.outputSize
  );

  validationCore.setWeights(weights);
  parsedData.samples.forEach((sample) => {
    validationCore.addTrainingSet(sample.input, sample.output, sample.trainSample);
  });

  return {
    projectType: typeof raw.projectType === 'string' ? raw.projectType : undefined,
    architecture: normalizedArchitecture,
    learning: normalizedLearning,
    data: {
      samples: parsedData.samples.map((sample) => [sample.input, sample.output, [sample.trainSample]]),
      targetLabels: parsedData.targetLabels,
    },
    weights,
  };
};

const applyProjectConfig = (project: ProjectConfig, projectType?: string) => {
  inputSize = project.architecture.inputSize;
  hiddenSizes = project.architecture.hiddenSizes.slice();
  outputSize = project.architecture.outputSize;
  initCore(false);

  setSelectValue(rateInput, project.learning.rate);
  momentumInput.value = `${project.learning.momentum}`;
  itersInput.value = `${project.learning.epochs}`;

  neuralCore.setTrainingSamples([]);
  project.data.samples.forEach((sample) => {
    neuralCore.addTrainingSet(sample[0], sample[1], sample[2][0]);
  });

  neuralCore.setWeights(project.weights);

  if (project.data.targetLabels && project.data.targetLabels.length === outputSize) {
    targetLabels = project.data.targetLabels.slice();
    targetLabelsJson = JSON.stringify(targetLabels);
  } else {
    syncTargetLabelsWithOutputSize();
  }

  const samples = neuralCore.getTrainingSamples();
  if (samples.length > 0) {
    selectedSampleIndex = 0;
    input = samples[0].input.slice();
    isManualInput = false;
  } else {
    selectedSampleIndex = -1;
    input = new Array(neuralCore.getInputSize()).fill(0);
  }

  if (projectType && projectSelect) {
    const hasProjectType = Array.from(projectSelect.options).some((option) => option.value === projectType);
    if (!hasProjectType) {
      const option = document.createElement('option');
      option.value = projectType;
      option.text = projectType;
      projectSelect.appendChild(option);
    }
    projectSelect.value = projectType;
    currentProjectType = projectType;
  } else {
    currentProjectType = project.projectType || currentProjectType;
  }

  resetEpochHistory();
  updateTrainButtonLabel();
  updateUI();
};

const loadPresetProject = async (projectType: string) => {
  const normalizedProjectType = projectType.trim();
  const resolvedProjectType = presetProjects[normalizedProjectType]
    ? normalizedProjectType
    : (presetProjectAliases[normalizedProjectType.toLowerCase()] || normalizedProjectType);

  const preset = presetProjects[resolvedProjectType];
  if (!preset) {
    throw `Unknown project preset: ${projectType}`;
  }

  showProjectLoadingOverlay();
  await delay(0);
  try {
    const normalized = normalizeProjectConfig(preset);
    applyProjectConfig(normalized, resolvedProjectType);
  } finally {
    hideProjectLoadingOverlay();
  }
};

const makeDefaultTargetLabel = (idx: number) => `target ${idx + 1}`;

const escapeHtmlAttr = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

const syncTargetLabelsWithOutputSize = () => {
  const outputSizeNow = neuralCore.getOutputSize();
  if (targetLabels.length < outputSizeNow) {
    for (let i = targetLabels.length; i < outputSizeNow; i++) {
      targetLabels.push(makeDefaultTargetLabel(i));
    }
  } else if (targetLabels.length > outputSizeNow) {
    targetLabels = targetLabels.slice(0, outputSizeNow);
  }
  targetLabelsJson = JSON.stringify(targetLabels);
};

const getTargetLabel = (idx: number, compact: boolean) => {
  const raw = targetLabels[idx] || '';
  const trimmed = raw.trim();
  const defaultLabel = makeDefaultTargetLabel(idx);
  const isCustom = trimmed.length > 0 && trimmed !== defaultLabel && trimmed !== `t${idx + 1}`;
  if (isCustom) {
    return trimmed;
  }
  if (compact) {
    return `t${idx + 1}`;
  }
  return makeDefaultTargetLabel(idx);
};

const buildTargetLabelsTable = () => {
  if (!targetLabelsBody) {
    return;
  }

  let rows = '';
  editableTargetLabels.forEach((label, idx) => {
    rows += '<tr>';
    rows += `<td>${idx + 1}</td>`;
    rows += `<td><input type="text" maxlength="10" class="form-control form-control-sm" value="${escapeHtmlAttr(label)}" onchange="updateTargetLabelValue(${idx}, this.value)"></td>`;
    rows += '</tr>';
  });
  targetLabelsBody.innerHTML = rows;
};

const openTargetLabelsOverlay = () => {
  syncTargetLabelsWithOutputSize();
  editableTargetLabels = targetLabels.slice();
  if (targetLabelsError) {
    targetLabelsError.textContent = '';
  }
  buildTargetLabelsTable();
  if (targetLabelsOverlay) {
    targetLabelsOverlay.style.display = 'flex';
  }
};

const updateTargetLabelValue = (idx: number, value: string) => {
  if (idx < 0 || idx >= editableTargetLabels.length) {
    return;
  }
  editableTargetLabels[idx] = value.slice(0, 10);
};

const cancelTargetLabelsOverlay = () => {
  if (targetLabelsOverlay) {
    targetLabelsOverlay.style.display = 'none';
  }
  if (targetLabelsError) {
    targetLabelsError.textContent = '';
  }
};

const applyTargetLabelsOverlay = () => {
  const invalidIdx = editableTargetLabels.findIndex((label) => label.length > 10);
  if (invalidIdx >= 0) {
    if (targetLabelsError) {
      targetLabelsError.textContent = `Label ${invalidIdx + 1} exceeds max length of 10.`;
    }
    return;
  }

  targetLabels = editableTargetLabels.map((label, idx) => {
    const trimmed = label.trim();
    return trimmed.length > 0 ? trimmed : makeDefaultTargetLabel(idx);
  });
  targetLabelsJson = JSON.stringify(targetLabels);
  cancelTargetLabelsOverlay();
  if (mainTableEditMode) {
    updateUI();
    return;
  }
  updateUI();
};

const clampEditableValue = (value: number) => {
  const clamped = Math.max(0, Math.min(1, value));
  return Math.round(clamped * 10) / 10;
};

const hideInterfaceHelpTooltip = () => {
  if (!interfaceHelpTooltip) {
    return;
  }
  interfaceHelpTooltip.style.display = 'none';
};

const showInterfaceHelpTooltip = (tooltipSourceId: string, anchorEl: HTMLElement) => {
  if (!interfaceHelpTooltip || !anchorEl) {
    return;
  }

  const sourceEl = document.getElementById(tooltipSourceId) as HTMLElement | null;
  if (!sourceEl) {
    hideInterfaceHelpTooltip();
    return;
  }

  interfaceHelpTooltip.innerHTML = sourceEl.innerHTML;
  interfaceHelpTooltip.style.display = 'block';

  const anchorRect = anchorEl.getBoundingClientRect();
  const tooltipRect = interfaceHelpTooltip.getBoundingClientRect();
  const left = Math.max(8, Math.min(window.innerWidth - tooltipRect.width - 8, anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2));
  const preferredTop = anchorRect.top - tooltipRect.height - 10;
  const top = preferredTop < 8
    ? Math.min(window.innerHeight - tooltipRect.height - 8, anchorRect.bottom + 10)
    : preferredTop;

  interfaceHelpTooltip.style.left = `${left}px`;
  interfaceHelpTooltip.style.top = `${top}px`;
};

const bindInterfaceHelpTooltip = (triggerId: string, tooltipSourceId: string) => {
  const triggerEl = document.getElementById(triggerId) as HTMLElement | null;
  if (!triggerEl) {
    return;
  }

  const show = () => showInterfaceHelpTooltip(tooltipSourceId, triggerEl);
  triggerEl.addEventListener('mouseenter', show);
  triggerEl.addEventListener('focus', show);
  triggerEl.addEventListener('mouseleave', hideInterfaceHelpTooltip);
  triggerEl.addEventListener('blur', hideInterfaceHelpTooltip);
};

const hideEditableDataPreview = () => {
  if (editablePreviewTooltip) {
    editablePreviewTooltip.style.display = 'none';
  }
};

const isPerfectSquare = (value: number) => {
  const root = Math.sqrt(value);
  return Number.isInteger(root);
};

const drawEditableSamplePreview = (values: number[]) => {
  if (!editablePreviewCanvas || !editablePreviewCtx) {
    return;
  }

  const count = Math.max(1, values.length);
  const square = isPerfectSquare(count);
  const cols = square ? Math.sqrt(count) : count;
  const rows = square ? Math.sqrt(count) : 1;
  const minCanvasWidth = 150;
  const maxCanvasWidth = 300;
  const preferredPixelSize = 15;

  const preferredWidth = cols * preferredPixelSize;
  const width = preferredWidth > maxCanvasWidth
    ? maxCanvasWidth
    : Math.max(minCanvasWidth, preferredWidth);

  const pixelSize = width / cols;
  const height = Math.max(20, Math.round(rows * pixelSize));

  editablePreviewCanvas.width = Math.round(width);
  editablePreviewCanvas.height = height;

  const ctx = editablePreviewCtx;
  ctx.clearRect(0, 0, editablePreviewCanvas.width, editablePreviewCanvas.height);

  for (let idx = 0; idx < count; idx++) {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    const value = idx < values.length ? Math.max(0, Math.min(1, Number(values[idx]))) : 0;
    const gray = Math.round(value * 255);
    const x = c * pixelSize;
    const y = r * pixelSize;
    ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
    ctx.fillRect(x, y, pixelSize, pixelSize);
  }

  ctx.strokeStyle = 'rgba(46, 40, 42, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, editablePreviewCanvas.width - 1, editablePreviewCanvas.height - 1);
};

const showEditableDataPreview = (rowIdx: number, anchorEl: HTMLElement) => {
  if (!editablePreviewTooltip || !anchorEl) {
    return;
  }
  if (rowIdx < 0 || rowIdx >= editableDataSamples.length) {
    hideEditableDataPreview();
    return;
  }

  drawEditableSamplePreview(editableDataSamples[rowIdx].input);
  editablePreviewTooltip.style.display = 'block';

  const anchorRect = anchorEl.getBoundingClientRect();
  const tooltipRect = editablePreviewTooltip.getBoundingClientRect();
  const left = Math.max(8, Math.min(window.innerWidth - tooltipRect.width - 8, anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2));
  const top = Math.max(8, anchorRect.top - tooltipRect.height - 8);

  editablePreviewTooltip.style.left = `${left}px`;
  editablePreviewTooltip.style.top = `${top}px`;
};

const showTrainingDataPreview = (rowIdx: number, anchorEl: HTMLElement) => {
  if (!editablePreviewTooltip || !anchorEl) {
    return;
  }

  const trainingSamples = getMainTableRenderSamples();
  if (rowIdx < 0 || rowIdx >= trainingSamples.length) {
    hideEditableDataPreview();
    return;
  }

  drawEditableSamplePreview(trainingSamples[rowIdx].input);
  editablePreviewTooltip.style.display = 'block';

  const anchorRect = anchorEl.getBoundingClientRect();
  const tooltipRect = editablePreviewTooltip.getBoundingClientRect();
  const left = Math.max(8, Math.min(window.innerWidth - tooltipRect.width - 8, anchorRect.left + anchorRect.width / 2 - tooltipRect.width / 2));
  const top = Math.max(8, anchorRect.top - tooltipRect.height - 8);

  editablePreviewTooltip.style.left = `${left}px`;
  editablePreviewTooltip.style.top = `${top}px`;
};

const buildTestingCorrectCellHtml = (output: number[], target: number[]): string => renderTestingCorrectCellHtml(output, target, getTargetLabel, escapeHtmlAttr);

const drawTestingInputHoverCanvas = (values: number[]) => {
  if (!testingInputHoverCanvas || !testingInputHoverCtx || values.length === 0) {
    return false;
  }
  const count = Math.max(1, values.length);
  const root = Math.sqrt(count);
  const cols = Number.isInteger(root) ? root : count;
  const rows = Number.isInteger(root) ? root : 1;
  const maxW = 300, maxH = 300;
  const scale = Math.max(1, Math.floor(Math.min(maxW / cols, maxH / rows)));
  const w = Math.floor(cols * scale);
  const h = Math.floor(rows * scale);

  testingInputHoverCanvas.width = w;
  testingInputHoverCanvas.height = h;
  const ctx = testingInputHoverCtx;
  ctx.clearRect(0, 0, w, h);
  for (let idx = 0; idx < count; idx++) {
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const value = idx < values.length ? Math.max(0, Math.min(1, Number(values[idx]))) : 0;
    const gray = Math.round(value * 255);
    ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
    ctx.fillRect(col * scale, row * scale, scale, scale);
  }
  ctx.strokeStyle = 'rgba(46, 40, 42, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);

  return true;
};

const showTestingInputHoverAt = (values: number[], anchorX: number, anchorY: number) => {
  if (!testingInputHoverTooltip) {
    return;
  }

  const rendered = drawTestingInputHoverCanvas(values);
  if (!rendered) {
    return;
  }

  testingInputHoverTooltip.style.display = 'block';
  const tipRect = testingInputHoverTooltip.getBoundingClientRect();
  const left = Math.max(8, Math.min(window.innerWidth - tipRect.width - 8, anchorX - tipRect.width / 2));
  const topCandidate = anchorY - tipRect.height - 8;
  const top = topCandidate < 8 ? Math.min(window.innerHeight - tipRect.height - 8, anchorY + 8) : topCandidate;
  testingInputHoverTooltip.style.left = `${left}px`;
  testingInputHoverTooltip.style.top = `${top}px`;
};

const showTestingInputHover = (canvasEl: HTMLCanvasElement) => {
  const serialized = canvasEl.dataset.values || '';
  const values = serialized.split(',').map(Number).filter(v => !Number.isNaN(v));
  if (values.length === 0) {
    return;
  }
  const rect = canvasEl.getBoundingClientRect();
  showTestingInputHoverAt(values, rect.left + rect.width / 2, rect.top);
};

const hideTestingInputHover = () => {
  if (testingInputHoverTooltip) {
    testingInputHoverTooltip.style.display = 'none';
  }
};

const buildTestingOutputCellHtml = (values: number[]) => renderTestingOutputCellHtml(values, getTargetLabel, escapeHtmlAttr);

const buildTestingTargetCellHtml = (values: number[]) => renderTestingTargetCellHtml(values, getTargetLabel, escapeHtmlAttr);

const buildTestingCostCellHtml = (cost: number, isSingleOutput: boolean) => renderTestingCostCellHtml(cost, isSingleOutput);

const buildTestingModelCellHtml = () => {
  const parts = [neuralCore.getInputSize(), ...neuralCore.getHiddenLayerSizes(), neuralCore.getOutputSize()];
  const currentEpoch = Math.max(0, epochCostHistory.length - 1);
  return renderTestingModelCellHtml(parts, currentEpoch, escapeHtmlAttr);
};

const drawTestingInputCanvas = (canvasEl: HTMLCanvasElement, values: number[]) => {
  if (!canvasEl) {
    return;
  }
  const count = Math.max(1, values.length);
  const root = Math.sqrt(count);
  const cols = Number.isInteger(root) ? root : count;
  const rows = Number.isInteger(root) ? root : 1;
  // height = 40px (row height), width = 40 * (cols/rows), capped at 100px
  const pixelH = 40 / rows;
  const pixelW = Math.min(pixelH, 100 / cols);
  const scale = Math.max(1, Math.floor(pixelW));
  const width = Math.max(1, Math.floor(cols * scale));
  const height = Math.max(1, Math.floor(rows * scale));

  canvasEl.width = width;
  canvasEl.height = height;
  const ctx = canvasEl.getContext('2d');
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, width, height);
  for (let idx = 0; idx < count; idx++) {
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const value = idx < values.length ? Math.max(0, Math.min(1, Number(values[idx]))) : 0;
    const gray = Math.round(value * 255);
    ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
    ctx.fillRect(col * scale, row * scale, scale, scale);
  }

  ctx.strokeStyle = 'rgba(46, 40, 42, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
};

const drawTestingInputCanvases = () => {
  if (!testingResultsBody) {
    return;
  }

  const canvases = Array.from(testingResultsBody.querySelectorAll('.testing-input-canvas')) as HTMLCanvasElement[];
  canvases.forEach((canvasEl) => {
    const serialized = canvasEl.dataset.values || '';
    const values = serialized
      .split(',')
      .map((part) => Number(part))
      .filter((value) => !Number.isNaN(value));
    drawTestingInputCanvas(canvasEl, values);
    canvasEl.addEventListener('mouseenter', () => showTestingInputHover(canvasEl));
    canvasEl.addEventListener('mouseleave', hideTestingInputHover);
  });
};

const drawTrainingDataVizCanvas = (canvasEl: HTMLCanvasElement, values: number[]) => {
  if (!canvasEl) {
    return;
  }

  const parentCell = canvasEl.parentElement as HTMLElement | null;
  const cellWidth = Math.max(18, (parentCell?.clientWidth || 60) - 6);
  const cellHeight = Math.max(18, (parentCell?.clientHeight || 34) - 6);

  const count = Math.max(1, values.length);
  const root = Math.sqrt(count);
  const cols = Number.isInteger(root) ? root : count;
  const rows = Number.isInteger(root) ? root : 1;
  const isSquare = Number.isInteger(root);

  let width = cellWidth;
  let height = cellHeight;
  if (isSquare) {
    const side = Math.max(1, Math.min(cellWidth, cellHeight));
    width = side;
    height = side;
  }

  canvasEl.width = width;
  canvasEl.height = height;
  const ctx = canvasEl.getContext('2d');
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, width, height);
  const pixelW = width / cols;
  const pixelH = height / rows;
  for (let idx = 0; idx < count; idx++) {
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const value = idx < values.length ? Math.max(0, Math.min(1, Number(values[idx]))) : 0;
    const gray = Math.round(value * 255);
    ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
    ctx.fillRect(col * pixelW, row * pixelH, pixelW, pixelH);
  }

  ctx.strokeStyle = 'rgba(46, 40, 42, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
};

const drawTrainingDataVizCanvases = () => {
  if (!trainingSetDataOutput) {
    return;
  }

  const canvases = Array.from(trainingSetDataOutput.querySelectorAll('.training-data-viz-canvas')) as HTMLCanvasElement[];
  canvases.forEach((canvasEl) => {
    const serialized = canvasEl.dataset.values || '';
    const values = serialized
      .split(',')
      .map((part) => Number(part))
      .filter((value) => !Number.isNaN(value));
    drawTrainingDataVizCanvas(canvasEl, values);
  });
};

const getMainDataColumnCount = () => {
  const inputCount = neuralCore.getInputSize();
  const useInputWindow = inputCount > 16;
  const visibleInputCount = useInputWindow ? 15 : inputCount;
  const targetCount = neuralCore.getOutputSize();
  const deleteColCount = mainTableEditMode ? 1 : 0;
  return 1 + 1 + (useInputWindow ? 1 : 0) + visibleInputCount + (useInputWindow ? 1 : 0) + targetCount + 1 + deleteColCount;
};

const renderMainDataBody = (samples: TrainSample[], layout: DataLayout, forceRender = false) => {
  if (!trainingSetDataOutput) {
    return;
  }

  const mainDataWrap = trainingSetDataOutput.closest('.main-data-table-wrap') as HTMLElement | null;
  const rowCount = samples.length;
  const shouldVirtualize = rowCount > MAIN_DATA_VIRTUAL_THRESHOLD;
  const totalColumns = getMainDataColumnCount();

  let windowStart = 0;
  let windowEnd = rowCount;
  let topSpacerPx = 0;
  let bottomSpacerPx = 0;

  if (shouldVirtualize && mainDataWrap) {
    const viewportHeight = mainDataWrap.clientHeight || 460;
    const visibleRows = Math.max(1, Math.ceil(viewportHeight / MAIN_DATA_VIRTUAL_ROW_HEIGHT));
    windowStart = Math.max(0, Math.floor(mainDataWrap.scrollTop / MAIN_DATA_VIRTUAL_ROW_HEIGHT) - MAIN_DATA_VIRTUAL_BUFFER_ROWS);
    windowEnd = Math.min(rowCount, windowStart + visibleRows + MAIN_DATA_VIRTUAL_BUFFER_ROWS * 2);
    topSpacerPx = windowStart * MAIN_DATA_VIRTUAL_ROW_HEIGHT;
    bottomSpacerPx = Math.max(0, (rowCount - windowEnd) * MAIN_DATA_VIRTUAL_ROW_HEIGHT);
  }

  const subset = shouldVirtualize ? samples.slice(windowStart, windowEnd) : samples;
  const offset = shouldVirtualize ? windowStart : 0;

  if (!forceRender
    && mainDataVirtualActive === shouldVirtualize
    && mainDataLastWindowStart === windowStart
    && mainDataLastWindowEnd === windowEnd
    && mainDataLastWindowOffset === offset
    && mainDataLastSelectedSample === selectedSampleIndex) {
    return;
  }

  let bodyHtml = '';
  if (topSpacerPx > 0) {
    bodyHtml += `<tr class="main-data-spacer-row"><td colspan="${totalColumns}" style="height:${topSpacerPx}px;"></td></tr>`;
  }

  bodyHtml += renderMainTableData({
    layout,
    samples: subset,
    selectedSampleIndex,
    getTargetLabel,
    inputWindowStart: inputColumnWindowStart,
    rowOffset: offset,
    editMode: mainTableEditMode,
  });

  if (bottomSpacerPx > 0) {
    bodyHtml += `<tr class="main-data-spacer-row"><td colspan="${totalColumns}" style="height:${bottomSpacerPx}px;"></td></tr>`;
  }

  trainingSetDataOutput.innerHTML = bodyHtml;
  drawTrainingDataVizCanvases();

  mainDataVirtualActive = shouldVirtualize;
  mainDataLastWindowStart = windowStart;
  mainDataLastWindowEnd = windowEnd;
  mainDataLastWindowOffset = offset;
  mainDataLastSelectedSample = selectedSampleIndex;
};

const evaluateTestingRows = (mode: TestingMode): TestingResultRow[] => {
  const isTrainMode = mode === 'train';
  const filteredSamples = neuralCore
    .getTrainingSamples()
    .map((sample, idx) => ({ sample, idx }))
    .filter((sampleEntry) => sampleEntry.sample.trainSample === isTrainMode);

  const rows = filteredSamples.map((sampleEntry) => {
    const prediction = neuralCore.evaluate(sampleEntry.sample.input.slice());
    const isSingleOutput = sampleEntry.sample.output.length === 1;
    const isClassification = isOneHotTarget(sampleEntry.sample.output);
    const cost = isSingleOutput
      ? ((sampleEntry.sample.output[0] || 0) - prediction[0])
      : prediction.reduce((acc, value, idx) => {
          const expectedValue = sampleEntry.sample.output[idx] || 0;
          return acc + (value - expectedValue) ** 2;
        }, 0);
    return {
      nr: sampleEntry.idx + 1,
      input: sampleEntry.sample.input.slice(),
      output: prediction,
      target: sampleEntry.sample.output.slice(),
      cost,
      isSingleOutput,
      isClassification,
    };
  });

  updateUI();
  return rows;
};

const updateTestingHeaderSortIndicators = () => {
  if (!testingResultsHeader) {
    return;
  }
  const triangles = Array.from(testingResultsHeader.querySelectorAll('.testing-sort-triangle')) as HTMLButtonElement[];
  triangles.forEach((triangle) => triangle.classList.remove('active'));

  const activeSelector = getTestingActiveSortSelector(testingSortField, testingSortDirection);
  const activeButton = testingResultsHeader.querySelector(activeSelector) as HTMLButtonElement | null;
  if (activeButton) {
    activeButton.classList.add('active');
  }
};

const renderTestingResultsBody = () => {
  if (!testingResultsBody || !testingResultsEmpty) {
    return;
  }

  const sortedRows = sortTestingRows(testingRows, testingSortField, testingSortDirection);

  if (sortedRows.length === 0) {
    testingResultsBody.innerHTML = '';
    testingResultsEmpty.style.display = 'block';
    updateTestingHeaderSortIndicators();
    return;
  }

  testingResultsEmpty.style.display = 'none';

  const rowCount = sortedRows.length;
  const showPredictedColumn = sortedRows.length > 0 && sortedRows[0].isClassification;
  testingResultsBody.classList.toggle('testing-gap-md', rowCount > 5 && rowCount <= 10);
  testingResultsBody.classList.toggle('testing-gap-sm', rowCount > 10);
  testingResultsBody.classList.toggle('testing-scroll', rowCount > 10);
  testingResultsBody.classList.toggle('testing-no-predicted', !showPredictedColumn);

  if (testingResultsHeader) {
    testingResultsHeader.classList.toggle('testing-no-predicted', !showPredictedColumn);
  }

  // Update target column header with custom label for single target
  const targetHeaderEl = document.getElementById('testing-header-target');
  if (targetHeaderEl) {
    const outputSize = sortedRows.length > 0 ? sortedRows[0].target.length : 0;
    if (outputSize === 1) {
      const customLabel = getTargetLabel(0, false);
      const defaultLabel = `target ${1}`;
      const isTrivial = customLabel === defaultLabel || customLabel === 't1';
      targetHeaderEl.textContent = isTrivial ? 'target' : customLabel;
    } else {
      targetHeaderEl.textContent = 'target';
    }
  }

  const costHeaderLabelEl = document.getElementById('testing-cost-label');
  if (costHeaderLabelEl) {
    const outputSize = sortedRows.length > 0 ? sortedRows[0].target.length : 0;
    costHeaderLabelEl.textContent = outputSize > 1 ? 'summed error' : 'error';
  }

  let html = '';
  sortedRows.forEach((row) => {
    const serializedInput = row.input.join(',');
    html += `<div class="testing-results-row">`;
    html += `<div class="testing-cell testing-cell-nr">${row.nr}</div>`;
    html += `<div class="testing-cell"><div class="testing-input-wrap"><canvas class="testing-input-canvas" data-values="${escapeHtmlAttr(serializedInput)}"></canvas></div></div>`;
    html += `<div class="testing-cell">${buildTestingModelCellHtml()}</div>`;
    html += `<div class="testing-cell">${buildTestingOutputCellHtml(row.output)}</div>`;
    html += `<div class="testing-cell">${buildTestingTargetCellHtml(row.target)}</div>`;
    html += `<div class="testing-cell">${buildTestingCostCellHtml(row.cost, row.isSingleOutput)}</div>`;
    if (row.isClassification) {
      html += `<div class="testing-cell">${buildTestingCorrectCellHtml(row.output, row.target)}</div>`;
    }
    html += `</div>`;
  });

  testingResultsBody.innerHTML = html;
  drawTestingInputCanvases();
  updateTestingHeaderSortIndicators();
};

const updateTestingOverlayControls = () => {
  if (!testingResultsSwitchBtn || !testingResultsTitle) {
    return;
  }

  const overlayTexts = buildTestingOverlayTexts(testingCurrentMode, testingRows);
  testingResultsSwitchBtn.textContent = overlayTexts.switchButtonText;

  if (testingRows.length > 0) {
    testingResultsTitle.innerHTML = overlayTexts.titleHtml;
  } else {
    testingResultsTitle.textContent = overlayTexts.titleText;
  }
};

const openTestingResultsOverlay = (mode: TestingMode) => {
  if (!testingResultsOverlay) {
    return;
  }

  testingCurrentMode = mode;
  testingRows = evaluateTestingRows(mode);
  updateTestingOverlayControls();
  renderTestingResultsBody();
  testingResultsOverlay.style.display = 'flex';
};

const closeTestingResultsOverlay = () => {
  if (!testingResultsOverlay) {
    return;
  }
  testingResultsOverlay.style.display = 'none';
};

const switchTestingResultsMode = () => {
  const nextMode = getNextTestingMode(testingCurrentMode);
  openTestingResultsOverlay(nextMode);
};

const sortTestingResultsBy = (field: TestingSortField, direction: TestingSortDirection) => {
  testingSortField = field;
  testingSortDirection = direction;
  renderTestingResultsBody();
};

const inspectClassPalette = [
  'rgb(33, 100, 205)',
  'rgb(205, 83, 52)',
  'rgb(66, 139, 70)',
  'rgb(153, 85, 187)',
  'rgb(209, 162, 40)',
  'rgb(56, 167, 154)',
  'rgb(190, 76, 110)',
  'rgb(120, 120, 120)',
];

const getInspectTargetFillColor = (point: InspectPoint) => {
  if (point.target.length === 1) {
    const value = point.target[0];
    if (value <= 0.2) {
      return 'rgb(56, 127, 219)';
    }
    if (value >= 0.8) {
      return 'rgb(216, 83, 52)';
    }
    return 'rgb(160, 119, 195)';
  }

  if (point.isClassification) {
    const classIdx = Math.max(0, point.target.findIndex((value) => value === 1));
    return inspectClassPalette[classIdx % inspectClassPalette.length];
  }

  return 'rgb(130, 130, 130)';
};

const getInspectCorrectnessBorderColor = (point: InspectPoint) => {
  if (point.target.length === 1) {
    return getTestingSingleCostColor(point.cost);
  }

  if (point.isClassification) {
    const argmaxOutput = point.output.indexOf(Math.max(...point.output));
    const argmaxTarget = point.target.indexOf(1);
    return argmaxOutput === argmaxTarget ? 'rgb(34, 139, 34)' : 'rgb(205, 40, 40)';
  }

  const normalized = Math.max(0, Math.min(1, point.cost / Math.max(1, point.target.length)));
  return getTestingCorrectColor(normalized);
};

const evaluateInspectPoints = (): InspectPoint[] => neuralCore.getTrainingSamples().map((sample, idx) => {
  const evaluation = neuralCore.evaluateWithActivations(sample.input.slice());
  const output = evaluation.output;
  const isSingleOutput = sample.output.length === 1;
  const isClassification = isOneHotTarget(sample.output);
  const cost = isSingleOutput
    ? ((sample.output[0] || 0) - output[0])
    : output.reduce((acc, value, outputIdx) => {
        const targetValue = sample.output[outputIdx] || 0;
        return acc + (value - targetValue) ** 2;
      }, 0);

  return {
    nr: idx + 1,
    input: sample.input.slice(),
    output,
    target: sample.output.slice(),
    trainSample: sample.trainSample,
    cost,
    isClassification,
    hiddenLayers: evaluation.hiddenLayers,
  };
});

const getInspectLayerData = () => inspectPoints.map((point) => point.hiddenLayers[inspectActiveLayerIdx] || []);

const getInspectNearestSubsetIndices = (totalCount: number) => {
  if (totalCount <= INSPECT_NEAREST_MAX_SAMPLES) {
    return Array.from({ length: totalCount }, (_, idx) => idx);
  }

  if (
    inspectNearestSubsetIndices
    && inspectNearestSubsetLayerIdx === inspectActiveLayerIdx
    && inspectNearestSubsetSourceCount === totalCount
    && inspectNearestSubsetIndices.length === INSPECT_NEAREST_MAX_SAMPLES
  ) {
    return inspectNearestSubsetIndices;
  }

  inspectNearestSubsetIndices = chooseRandomSubsetIndices(totalCount, INSPECT_NEAREST_MAX_SAMPLES);
  inspectNearestSubsetLayerIdx = inspectActiveLayerIdx;
  inspectNearestSubsetSourceCount = totalCount;
  return inspectNearestSubsetIndices;
};

const getInspectPca3SubsetIndices = (totalCount: number) => {
  if (totalCount <= INSPECT_NEAREST_MAX_SAMPLES) {
    return Array.from({ length: totalCount }, (_, idx) => idx);
  }

  if (
    inspectPca3SubsetIndices
    && inspectPca3SubsetLayerIdx === inspectActiveLayerIdx
    && inspectPca3SubsetSourceCount === totalCount
    && inspectPca3SubsetIndices.length === INSPECT_NEAREST_MAX_SAMPLES
  ) {
    return inspectPca3SubsetIndices;
  }

  inspectPca3SubsetIndices = chooseRandomSubsetIndices(totalCount, INSPECT_NEAREST_MAX_SAMPLES);
  inspectPca3SubsetLayerIdx = inspectActiveLayerIdx;
  inspectPca3SubsetSourceCount = totalCount;
  return inspectPca3SubsetIndices;
};

const getInspectNearestRenderCount = () => Math.min(inspectPoints.length, INSPECT_NEAREST_MAX_SAMPLES);

const hideInspectHover = () => {
  if (inspectHoverTooltip) {
    inspectHoverTooltip.style.display = 'none';
  }
};

const renderInspectHoverTarget = (target: number[]) => {
  if (!inspectHoverTargetWrap) {
    return;
  }
  inspectHoverTargetWrap.innerHTML = '';
  if (target.length <= 1) {
    const value = target.length ? target[0] : 0;
    const clamped = Math.max(0, Math.min(1, value));
    inspectHoverTargetWrap.innerHTML = `<div class="inspect-hover-target-single"><div class="inspect-hover-target-single-fill" style="width:${clamped * 100}%;"></div><div class="inspect-hover-target-single-value">${value.toFixed(4)}</div></div>`;
    return;
  }

  const bars = target
    .map((value) => {
      const clamped = Math.max(0, Math.min(1, value));
      return `<div class="inspect-hover-target-bar" style="height:${Math.max(4, clamped * 100)}%;"></div>`;
    })
    .join('');
  inspectHoverTargetWrap.innerHTML = `<div class="inspect-hover-target-bars">${bars}</div>`;
};

const showInspectHover = (inputValues: number[], targetValues: number[], anchorX: number, anchorY: number) => {
  if (!inspectHoverTooltip || !inspectHoverInputCanvas || !inspectHoverInputCtx) {
    return;
  }

  const count = Math.max(1, inputValues.length);
  const root = Math.sqrt(count);
  const cols = Number.isInteger(root) ? root : count;
  const rows = Number.isInteger(root) ? root : 1;
  const maxW = 140;
  const maxH = 140;
  const scale = Math.max(1, Math.floor(Math.min(maxW / cols, maxH / rows)));
  const width = Math.floor(cols * scale);
  const height = Math.floor(rows * scale);
  inspectHoverInputCanvas.width = width;
  inspectHoverInputCanvas.height = height;

  inspectHoverInputCtx.clearRect(0, 0, width, height);
  for (let idx = 0; idx < count; idx++) {
    const row = Math.floor(idx / cols);
    const col = idx % cols;
    const value = idx < inputValues.length ? Math.max(0, Math.min(1, Number(inputValues[idx]))) : 0;
    const gray = Math.round(value * 255);
    inspectHoverInputCtx.fillStyle = `rgb(${gray},${gray},${gray})`;
    inspectHoverInputCtx.fillRect(col * scale, row * scale, scale, scale);
  }
  inspectHoverInputCtx.strokeStyle = 'rgba(46, 40, 42, 0.35)';
  inspectHoverInputCtx.lineWidth = 1;
  inspectHoverInputCtx.strokeRect(0.5, 0.5, width - 1, height - 1);

  renderInspectHoverTarget(targetValues);

  inspectHoverTooltip.style.display = 'block';
  const tipRect = inspectHoverTooltip.getBoundingClientRect();
  const left = Math.max(8, Math.min(window.innerWidth - tipRect.width - 8, anchorX + 10));
  const topCandidate = anchorY - tipRect.height - 10;
  const top = topCandidate < 8 ? Math.min(window.innerHeight - tipRect.height - 8, anchorY + 10) : topCandidate;
  inspectHoverTooltip.style.left = `${left}px`;
  inspectHoverTooltip.style.top = `${top}px`;
};

const renderInspectPca2D = () => {
  const layerData = getInspectLayerData();
  const projected = projectPca(layerData, 2);
  if (projected.length === 0) {
    return;
  }

  inspectMarkers = renderInspectPca2DCanvas({
    ctx: inspectCtx,
    canvasWidth: inspectCanvas.width,
    canvasHeight: inspectCanvas.height,
    projected,
    points: inspectPoints,
    getFillColor: getInspectTargetFillColor,
    getBorderColor: getInspectCorrectnessBorderColor,
  });
};

const renderInspectPca3D = () => {
  if (!inspectPlotlyContainer) {
    return;
  }
  const allLayerData = getInspectLayerData();
  const subsetIndices = getInspectPca3SubsetIndices(allLayerData.length);
  const layerData = subsetIndices.map((sourceIdx) => allLayerData[sourceIdx]);
  const subsetPoints = subsetIndices.map((sourceIdx) => inspectPoints[sourceIdx]);
  const projected = projectPca(layerData, 3);
  if (projected.length === 0) {
    return;
  }

  const trace = {
    x: projected.map((p) => p[0]),
    y: projected.map((p) => p[1]),
    z: projected.map((p) => p[2]),
    mode: 'markers+text',
    type: 'scatter3d',
    text: subsetPoints.map((point) => `${point.nr}`),
    textposition: 'top center',
    marker: {
      size: 10,
      symbol: subsetPoints.map((point) => point.trainSample ? 'circle' : 'diamond'),
      color: subsetPoints.map((point) => getInspectTargetFillColor(point)),
      line: {
        color: subsetPoints.map((point) => getInspectCorrectnessBorderColor(point)),
        width: 3,
      },
    },
    hoverinfo: 'none',
    hovertemplate: '<extra></extra>',
    customdata: subsetIndices,
  };

  const samplingNote = subsetIndices.length < allLayerData.length
    ? `showing random ${subsetIndices.length} of ${allLayerData.length} samples`
    : '';

  const layout = {
    margin: { l: 0, r: 0, b: 0, t: samplingNote ? 26 : 0 },
    scene: {
      xaxis: { title: 'PC1', showspikes: false, spikesides: false },
      yaxis: { title: 'PC2', showspikes: false, spikesides: false },
      zaxis: { title: 'PC3', showspikes: false, spikesides: false },
      hovermode: false,
      camera: {
        eye: { x: 1.5, y: 1.5, z: 1.2 },
      },
    },
    paper_bgcolor: '#ffffff',
    plot_bgcolor: '#ffffff',
    annotations: samplingNote
      ? [{
          text: samplingNote,
          xref: 'paper',
          yref: 'paper',
          x: 0,
          y: 1.08,
          xanchor: 'left',
          yanchor: 'top',
          showarrow: false,
          font: { size: 11, color: 'rgba(46, 40, 42, 0.74)' },
        }]
      : [],
  };

  Plotly.react(inspectPlotlyContainer, [trace], layout, {
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['toImage', 'resetCameraDefault3d'],
    responsive: true,
  });

  if (inspectPlotlyContainer && inspectPlotlyContainer.dataset.hoverBound !== '1') {
    const plotlyEl = inspectPlotlyContainer as any;
    plotlyEl.on('plotly_hover', (event: any) => {
      if (!event || !event.points || event.points.length === 0) {
        return;
      }
      const hoveredPoint = event.points[0];
      const sourceIdx = Number(hoveredPoint.customdata);
      if (Number.isNaN(sourceIdx) || sourceIdx < 0 || sourceIdx >= inspectPoints.length) {
        return;
      }
      const sourcePoint = inspectPoints[sourceIdx];
      const hoverEvent = event.event || {};
      let clientX = Number(hoverEvent.clientX);
      let clientY = Number(hoverEvent.clientY);
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
        const containerRect = inspectPlotlyContainer.getBoundingClientRect();
        const bbox = hoveredPoint.bbox || {};
        const localX = Number(bbox.x0);
        const localY = Number(bbox.y0);
        clientX = Number.isFinite(localX) ? containerRect.left + localX : containerRect.left + containerRect.width / 2;
        clientY = Number.isFinite(localY) ? containerRect.top + localY : containerRect.top + containerRect.height / 2;
      }
      showInspectHover(sourcePoint.input, sourcePoint.target, clientX, clientY);
    });
    plotlyEl.on('plotly_unhover', () => {
      hideInspectHover();
    });
    inspectPlotlyContainer.dataset.hoverBound = '1';
  }

  inspectMarkers = [];
};

const renderInspectNearest = () => {
  const allLayerVectors = getInspectLayerData();
  if (allLayerVectors.length === 0) {
    return;
  }

  const subsetIndices = getInspectNearestSubsetIndices(allLayerVectors.length);
  const subsetVectors = subsetIndices.map((sourceIdx) => allLayerVectors[sourceIdx]);

  const dendrogram = buildDendrogram(subsetVectors);
  inspectMarkers = renderInspectNearestCanvas({
    ctx: inspectCtx,
    canvasWidth: inspectCanvas.width,
    canvasHeight: inspectCanvas.height,
    tree: dendrogram,
    subsetIndices,
    allVectorCount: allLayerVectors.length,
    points: inspectPoints,
    getFillColor: getInspectTargetFillColor,
    getBorderColor: getInspectCorrectnessBorderColor,
  });
};

const renderInspectVisualization = () => {
  if (!inspectCanvas || !inspectCtx || !inspectOverlay || inspectOverlay.style.display === 'none') {
    return;
  }

  if (inspectPlotlyContainer) {
    if (inspectActiveMode === 'pca3d') {
      hideInspectHover();
      inspectPlotlyContainer.style.display = 'block';
      inspectCanvas.style.display = 'none';
    } else {
      inspectPlotlyContainer.style.display = 'none';
      inspectCanvas.style.display = 'block';
      if (typeof Plotly !== 'undefined') {
        Plotly.purge(inspectPlotlyContainer);
      }
    }
  }

  if (inspectActiveMode === 'pca3d') {
    renderInspectPca3D();
    return;
  }

  const inspectScrollArea = document.getElementById('inspect-scroll-area') as HTMLElement | null;
  const availableWidth = inspectScrollArea
    ? Math.floor(inspectScrollArea.clientWidth || 1000)
    : Math.floor(inspectCanvas.getBoundingClientRect().width || 1000);
  const baseCanvasHeight = 560;
  const fixedPlotSpacing = (baseCanvasHeight - 70) / 16;
  const nearestModeHeight = Math.ceil(70 + fixedPlotSpacing * Math.max(1, getInspectNearestRenderCount()));
  inspectCanvas.width = Math.max(800, availableWidth);
  inspectCanvas.height = inspectActiveMode === 'nearest'
    ? Math.max(baseCanvasHeight, nearestModeHeight)
    : baseCanvasHeight;
  inspectCtx.clearRect(0, 0, inspectCanvas.width, inspectCanvas.height);
  inspectCtx.fillStyle = '#ffffff';
  inspectCtx.fillRect(0, 0, inspectCanvas.width, inspectCanvas.height);

  if (inspectPoints.length === 0) {
    inspectCtx.fillStyle = 'rgba(46, 40, 42, 0.8)';
    inspectCtx.font = '14px sans-serif';
    inspectCtx.fillText('No samples available.', 30, 40);
    return;
  }

  if (neuralCore.getHiddenLayerSizes().length === 0) {
    inspectCtx.fillStyle = 'rgba(46, 40, 42, 0.8)';
    inspectCtx.font = '14px sans-serif';
    inspectCtx.fillText('No hidden layers to inspect.', 30, 40);
    return;
  }

  if (inspectActiveMode === 'pca2d') {
    renderInspectPca2D();
  } else {
    renderInspectNearest();
  }
};

const updateInspectControlButtons = () => {
  const modeButtons = Array.from(document.querySelectorAll('#inspect-overlay .inspect-mode-btn')) as HTMLButtonElement[];
  setActiveInspectModeButton(modeButtons, inspectActiveMode);
};

const renderInspectLayerButtons = () => {
  if (!inspectLayerControls) {
    return;
  }

  const hiddenLayerCount = neuralCore.getHiddenLayerSizes().length;
  inspectLayerControls.innerHTML = buildInspectLayerButtonsHtml(hiddenLayerCount, inspectActiveLayerIdx);
};

const setInspectLayer = (layerIdx: number) => {
  const hiddenLayerCount = neuralCore.getHiddenLayerSizes().length;
  if (!isValidInspectLayerIdx(layerIdx, hiddenLayerCount)) {
    return;
  }
  inspectActiveLayerIdx = layerIdx;
  inspectNearestSubsetIndices = null;
  inspectPca3SubsetIndices = null;
  renderInspectLayerButtons();
  renderInspectVisualization();
};

const setInspectMode = (mode: InspectMode) => {
  inspectActiveMode = mode;
  hideInspectHover();
  updateInspectControlButtons();
  renderInspectVisualization();
};

const handleInspectCanvasHover = (event: MouseEvent) => {
  if (!inspectCanvas || inspectMarkers.length === 0) {
    hideInspectHover();
    return;
  }

  const rect = inspectCanvas.getBoundingClientRect();
  const cursorX = event.clientX - rect.left;
  const cursorY = event.clientY - rect.top;

  let hoveredMarker: InspectMarker | null = null;
  for (let idx = 0; idx < inspectMarkers.length; idx++) {
    const marker = inspectMarkers[idx];
    const dx = cursorX - marker.x;
    const dy = cursorY - marker.y;
    if (dx * dx + dy * dy <= marker.size * marker.size) {
      hoveredMarker = marker;
      break;
    }
  }

  if (!hoveredMarker) {
    hideInspectHover();
    return;
  }

  showInspectHover(hoveredMarker.input, hoveredMarker.target, event.clientX, event.clientY);
};

const openInspectOverlay = () => {
  if (!inspectOverlay) {
    return;
  }

  if (neuralCore.getHiddenLayerSizes().length === 0) {
    return;
  }

  inspectPoints = evaluateInspectPoints();
  const resetSubsetState = createResetInspectSubsetState();
  inspectNearestSubsetIndices = resetSubsetState.nearestIndices;
  inspectNearestSubsetLayerIdx = resetSubsetState.nearestLayerIdx;
  inspectNearestSubsetSourceCount = resetSubsetState.nearestSourceCount;
  inspectPca3SubsetIndices = resetSubsetState.pca3Indices;
  inspectPca3SubsetLayerIdx = resetSubsetState.pca3LayerIdx;
  inspectPca3SubsetSourceCount = resetSubsetState.pca3SourceCount;
  const hiddenLayerCount = neuralCore.getHiddenLayerSizes().length;
  const nextOverlayState = getInspectOverlayOpenState(inspectActiveLayerIdx, hiddenLayerCount);
  inspectActiveLayerIdx = nextOverlayState.activeLayerIdx;
  inspectActiveMode = nextOverlayState.activeMode;
  renderInspectLayerButtons();
  updateInspectControlButtons();
  inspectOverlay.style.display = 'flex';
  renderInspectVisualization();
};

const closeInspectOverlay = () => {
  if (!inspectOverlay) {
    return;
  }
  inspectOverlay.style.display = 'none';
  hideInspectHover();
  if (inspectPlotlyContainer && typeof Plotly !== 'undefined') {
    Plotly.purge(inspectPlotlyContainer);
  }
};

const editEditableDataRow = (rowIdx: number) => {
  const sourceSamples = getPixelEditorSourceSamples();
  if (rowIdx < 0 || rowIdx >= sourceSamples.length) {
    return;
  }

  openEditablePixelEditorOverlay(rowIdx);
};

const editTrainingDataRow = (rowIdx: number) => {
  const sourceSamples = getPixelEditorSourceSamples();
  if (rowIdx < 0 || rowIdx >= sourceSamples.length) {
    return;
  }
  openEditablePixelEditorOverlay(rowIdx);
};

const openVisualDataEditor = () => {
  const initialSamples = getPixelEditorSourceSamples();
  if (initialSamples.length === 0) {
    ensureTrainingSamplesNotEmpty();
  }

  const activeSamples = getPixelEditorSourceSamples();
  if (activeSamples.length === 0) {
    return;
  }

  const rowIdx = (selectedSampleIndex >= 0 && selectedSampleIndex < activeSamples.length)
    ? selectedSampleIndex
    : 0;
  selectedSampleIndex = rowIdx;
  input = activeSamples[rowIdx].input.slice();
  isManualInput = false;
  updateUI();
  openEditablePixelEditorOverlay(rowIdx);
};

const editMainTableRow = (rowIdx: number) => {
  if (mainTableEditMode) {
    const sourceSamples = getPixelEditorSourceSamples();
    if (rowIdx < 0 || rowIdx >= sourceSamples.length) {
      return;
    }
    openEditablePixelEditorOverlay(rowIdx);
    return;
  }
  editTrainingDataRow(rowIdx);
};

const getInputEditorShape = (inputCount: number) => {
  if (inputCount <= 0) {
    return { cols: 1, rows: 1, totalCells: 1, square: true };
  }

  const root = Math.sqrt(inputCount);
  const isSquare = Number.isInteger(root);
  if (isSquare) {
    const size = Math.floor(root);
    return { cols: size, rows: size, totalCells: inputCount, square: true };
  }

  if (inputCount < 25) {
    return { cols: inputCount, rows: 1, totalCells: inputCount, square: false };
  }

  const size = Math.ceil(Math.sqrt(inputCount));
  return { cols: size, rows: size, totalCells: size * size, square: true };
};

const setPixelEditorTool = (tool: 'toggle' | 'black' | 'white') => {
  editablePixelEditorTool = tool;
  const byId = (id: string) => document.getElementById(id) as HTMLButtonElement | null;
  const toolButtons = {
    toggle: byId('pixel-tool-toggle-btn'),
    black: byId('pixel-tool-black-btn'),
    white: byId('pixel-tool-white-btn'),
  };
  Object.entries(toolButtons).forEach(([key, btn]) => {
    if (!btn) {
      return;
    }
    if (key === tool) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
};

const updatePixelEditorUndoButton = () => {
  if (!editablePixelUndoBtn) {
    return;
  }
  editablePixelUndoBtn.disabled = editablePixelEditorStrokeHistory.length === 0;
};

const clearEditablePixelStrokeHistory = () => {
  editablePixelEditorStrokeSnapshot = null;
  editablePixelEditorStrokeHistory = [];
  updatePixelEditorUndoButton();
};

const beginEditablePixelStroke = () => {
  editablePixelEditorStrokeSnapshot = editablePixelEditorInputValues.slice();
};

const endEditablePixelStroke = () => {
  if (!editablePixelEditorStrokeSnapshot) {
    return;
  }

  const before = editablePixelEditorStrokeSnapshot;
  editablePixelEditorStrokeSnapshot = null;
  if (before.length !== editablePixelEditorInputValues.length) {
    return;
  }

  for (let idx = 0; idx < before.length; idx++) {
    if (before[idx] !== editablePixelEditorInputValues[idx]) {
      editablePixelEditorStrokeHistory.push(before);
      if (editablePixelEditorStrokeHistory.length > 200) {
        editablePixelEditorStrokeHistory.shift();
      }
      updatePixelEditorUndoButton();
      return;
    }
  }
};

const undoPixelEditorStroke = () => {
  if (editablePixelEditorStrokeHistory.length === 0) {
    return;
  }

  const previousInput = editablePixelEditorStrokeHistory.pop();
  if (!previousInput) {
    return;
  }

  editablePixelEditorInputValues = previousInput.slice();
  syncCurrentEditablePixelSampleFromEditor();
  applyLiveInputPreview();
  updatePixelEditorCanvas();
  renderEditableSampleNavigator();
  updatePixelEditorUndoButton();
};

const setPixelOutputEditMode = (mode: 'paint' | 'numeric') => {
  editablePixelEditorOutputMode = mode;
  const numericBtn = document.getElementById('target-mode-numeric-btn') as HTMLButtonElement | null;
  const toggleBtn = document.getElementById('target-tool-toggle-btn') as HTMLButtonElement | null;
  if (numericBtn) {
    if (mode === 'numeric') {
      numericBtn.classList.add('active');
    } else {
      numericBtn.classList.remove('active');
    }
  }
  if (toggleBtn) {
    if (mode === 'paint') {
      toggleBtn.classList.add('active');
    } else {
      toggleBtn.classList.remove('active');
    }
  }
  updatePixelTargetEditor();
};

const setTargetToggleBrushMode = () => {
  setPixelEditorTool('toggle');
  setPixelOutputEditMode('paint');
};

const applyLiveInputPreview = () => {
  if (editablePixelEditorMode !== 'live-input') {
    return;
  }
  input = editablePixelEditorInputValues.slice();
  isManualInput = true;
  selectedSampleIndex = -1;
  if (liveInputRefreshPending) {
    return;
  }
  liveInputRefreshPending = true;
  window.requestAnimationFrame(() => {
    liveInputRefreshPending = false;
    resizeCanvasToContainer();
    const currentCost = neuralCore.getCost();
    neuralCore.evaluate(input);
    const trainingSamples = neuralCore.getTrainingSamples();
    const selectedTargets = selectedSampleIndex >= 0 && selectedSampleIndex < trainingSamples.length
      ? trainingSamples[selectedSampleIndex].output
      : undefined;
    visualizer.draw(
      neuralCore.getNeurons(),
      neuralCore.getConnections(),
      selectedTargets,
      isManualInput,
      neuralCore.getIteration(),
      currentCost,
      targetLabels
    );
  });
};

const syncVisualizationInputToSelectedSample = () => {
  const trainingSamples = neuralCore.getTrainingSamples();
  if (trainingSamples.length === 0) {
    selectedSampleIndex = -1;
    input = new Array(neuralCore.getInputSize()).fill(0);
    isManualInput = true;
    return;
  }

  selectedSampleIndex = Math.min(Math.max(selectedSampleIndex, 0), trainingSamples.length - 1);
  input = trainingSamples[selectedSampleIndex].input.slice();
  isManualInput = false;
};

const restoreInputFromSelectedSample = () => {
  const trainingSamples = neuralCore.getTrainingSamples();
  if (selectedSampleIndex >= 0 && selectedSampleIndex < trainingSamples.length) {
    input = trainingSamples[selectedSampleIndex].input.slice();
    isManualInput = false;
    return;
  }
  if (trainingSamples.length > 0) {
    selectedSampleIndex = 0;
    input = trainingSamples[0].input.slice();
    isManualInput = false;
    return;
  }
  input = new Array(neuralCore.getInputSize()).fill(0);
  isManualInput = true;
};

const applyEditablePixelOverlayMode = (mode: 'samples' | 'live-input') => {
  editablePixelEditorMode = mode;
  if (editablePixelEditorOverlay) {
    editablePixelEditorOverlay.classList.toggle('input-only-mode', mode === 'live-input');
  }
  if (editablePixelOverlayTitle) {
    editablePixelOverlayTitle.textContent = mode === 'live-input' ? 'set input visually' : 'edit samples visually';
  }
  if (editablePixelApplyBtn) {
    editablePixelApplyBtn.textContent = mode === 'live-input' ? 'set' : 'set data';
  }
  if (liveInputAddTestSampleControls) {
    liveInputAddTestSampleControls.style.display = mode === 'live-input' ? 'block' : 'none';
  }
};

const addLiveInputAsTestSample = () => {
  const sampleInput = editablePixelEditorMode === 'live-input'
    ? editablePixelEditorInputValues.slice()
    : input.slice();
  const sampleOutput = new Array(neuralCore.getOutputSize()).fill(0);

  if (mainTableEditMode) {
    mainTableEditSamples.push(new TrainSample(sampleInput, sampleOutput, false));
    updateMainEditTrainSelectControlVisibility();
  } else {
    neuralCore.addTrainingSet(sampleInput, sampleOutput, false);
    resetEpochHistory();
  }

  input = sampleInput.slice();
  isManualInput = true;
  selectedSampleIndex = -1;
  updateUI();
  scrollMainDataTableToBottomIfScrollable();
};

const syncCurrentEditablePixelSampleFromEditor = () => {
  const sourceSamples = getPixelEditorSourceSamples();
  if (editablePixelEditorActiveRow < 0 || editablePixelEditorActiveRow >= sourceSamples.length) {
    return;
  }
  sourceSamples[editablePixelEditorActiveRow].input = editablePixelEditorInputValues.slice();
  sourceSamples[editablePixelEditorActiveRow].output = editablePixelEditorOutputValues.slice();
};

const updateActiveSampleTrainCheckbox = () => {
  if (!editableActiveSampleTrainCheckbox) {
    return;
  }
  const sourceSamples = getPixelEditorSourceSamples();
  if (editablePixelEditorActiveRow < 0 || editablePixelEditorActiveRow >= sourceSamples.length) {
    editableActiveSampleTrainCheckbox.checked = false;
    return;
  }
  editableActiveSampleTrainCheckbox.checked = !!sourceSamples[editablePixelEditorActiveRow].trainSample;
};

const updatePixelEditorCanvas = () => {
  if (!editablePixelEditorCanvas || !editablePixelEditorCtx) {
    return;
  }

  const shape = getInputEditorShape(editablePixelEditorInputValues.length);
  editablePixelEditorCols = shape.cols;

  const canvasWrap = editablePixelEditorCanvas.closest('.editable-pixel-canvas-wrap') as HTMLElement | null;
  const availableWidth = Math.max(1, Math.floor(canvasWrap?.clientWidth || editablePixelEditorCanvas.clientWidth || 1));
  const availableHeight = Math.max(1, Math.floor(canvasWrap?.clientHeight || editablePixelEditorCanvas.clientHeight || 1));

  const maxPixelSizeForSmallLayout = shape.cols < 5 ? 50 : 999;
  const targetDisplayWidth = Math.min(availableWidth, shape.cols * maxPixelSizeForSmallLayout);
  const widthDrivenPixel = Math.max(1, Math.floor(targetDisplayWidth / shape.cols));
  const heightDrivenPixel = Math.max(1, Math.floor(availableHeight / shape.rows));
  const pixelSize = Math.max(1, Math.min(widthDrivenPixel, heightDrivenPixel));

  const width = Math.max(1, shape.cols * pixelSize);
  const height = Math.max(1, shape.rows * pixelSize);
  editablePixelEditorCanvas.width = width;
  editablePixelEditorCanvas.height = height;
  editablePixelEditorCanvas.style.width = `${width}px`;
  editablePixelEditorCanvas.style.height = `${height}px`;

  const ctx = editablePixelEditorCtx;
  ctx.clearRect(0, 0, width, height);

  for (let idx = 0; idx < shape.totalCells; idx++) {
    const row = Math.floor(idx / shape.cols);
    const col = idx % shape.cols;
    if (idx >= editablePixelEditorInputValues.length) {
      ctx.fillStyle = '#e6b8c1';
    } else {
      const value = Math.max(0, Math.min(1, editablePixelEditorInputValues[idx]));
      const gray = Math.round(value * 255);
      ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
    }
    ctx.fillRect(col * pixelSize, row * pixelSize, pixelSize, pixelSize);
  }

  ctx.strokeStyle = 'rgba(46, 40, 42, 0.2)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= shape.cols; c++) {
    const x = c * pixelSize + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let r = 0; r <= shape.rows; r++) {
    const y = r * pixelSize + 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
};

const renderEditableTargetLabels = () => {
  if (!editablePixelTargetLabelsEl) {
    return;
  }
  const count = Math.max(1, editablePixelEditorOutputValues.length);
  editablePixelTargetLabelsEl.style.gridTemplateColumns = `repeat(${count}, minmax(0, 1fr))`;
  editablePixelTargetLabelsEl.innerHTML = editablePixelEditorOutputValues
    .map((_, idx) => `<div class="editable-target-label-cell">${getTargetLabel(idx, false)}</div>`)
    .join('');
};

const updatePixelTargetCanvas = () => {
  if (!editableTargetEditorCanvas || !editableTargetEditorCtx) {
    return;
  }

  const count = Math.max(1, editablePixelEditorOutputValues.length);
  const canvasWrap = editableTargetEditorCanvas.closest('.editable-target-edit-wrap') as HTMLElement | null;
  const availableWidth = Math.max(1, Math.floor(canvasWrap?.clientWidth || editableTargetEditorCanvas.clientWidth || 1));
  const maxPixelSizeForSmallLayout = count < 5 ? 50 : 999;
  const targetDisplayWidth = Math.min(availableWidth, count * maxPixelSizeForSmallLayout);
  const pixelSize = Math.max(1, Math.floor(targetDisplayWidth / count));
  const width = count * pixelSize;
  const height = pixelSize;

  editableTargetEditorCanvas.width = width;
  editableTargetEditorCanvas.height = height;
  editableTargetEditorCanvas.style.width = `${width}px`;
  editableTargetEditorCanvas.style.height = `${height}px`;
  if (editablePixelTargetLabelsEl) {
    editablePixelTargetLabelsEl.style.width = `${width}px`;
  }

  const ctx = editableTargetEditorCtx;
  ctx.clearRect(0, 0, width, height);

  for (let idx = 0; idx < count; idx++) {
    const value = Math.max(0, Math.min(1, editablePixelEditorOutputValues[idx] || 0));
    const gray = Math.round(value * 255);
    ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
    ctx.fillRect(idx * pixelSize, 0, pixelSize, pixelSize);
  }

  ctx.strokeStyle = 'rgba(46, 40, 42, 0.25)';
  ctx.lineWidth = 1;
  for (let c = 0; c <= count; c++) {
    const x = c * pixelSize + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(0, 0.5);
  ctx.lineTo(width, 0.5);
  ctx.moveTo(0, height - 0.5);
  ctx.lineTo(width, height - 0.5);
  ctx.stroke();
};

const updatePixelTargetNumericInputs = () => {
  if (!editableTargetNumericWrap) {
    return;
  }

  const count = Math.max(1, editablePixelEditorOutputValues.length);
  const wrapHost = editableTargetNumericWrap.closest('.editable-target-edit-wrap') as HTMLElement | null;
  const availableWidth = Math.max(1, Math.floor(wrapHost?.clientWidth || editableTargetNumericWrap.clientWidth || 1));
  const gridWidth = availableWidth;

  editableTargetNumericWrap.classList.toggle('compact-target-numeric', count > 5);
  editableTargetNumericWrap.style.width = `${gridWidth}px`;
  editableTargetNumericWrap.style.gridTemplateColumns = `repeat(${count}, minmax(0, 1fr))`;
  if (editablePixelTargetLabelsEl) {
    editablePixelTargetLabelsEl.style.width = `${gridWidth}px`;
  }
  editableTargetNumericWrap.innerHTML = editablePixelEditorOutputValues
    .map((value, idx) => `<div class="editable-target-number-cell"><input type="number" min="0" max="1" step="0.1" class="form-control form-control-sm main-inline-edit-input editable-target-number-input" value="${value}" title="${value}" onfocus="focusPixelTargetNumericInput(this)" onblur="blurPixelTargetNumericInput(this, ${idx})" onkeydown="handlePixelTargetNumericInputKey(event, this, ${idx})"></div>`)
    .join('');
};

const focusPixelTargetNumericInput = (inputEl: HTMLInputElement) => {
  if (!inputEl) {
    return;
  }
  inputEl.dataset.prevValue = inputEl.value;
  const shouldExpand = editablePixelEditorOutputValues.length > 5;
  if (!shouldExpand) {
    inputEl.select();
    return;
  }
  const hostCell = inputEl.closest('.editable-target-number-cell');
  if (hostCell) {
    hostCell.classList.add('editable-target-number-cell-active');
  }
  inputEl.classList.add('main-inline-edit-input-focused');
  inputEl.classList.add('editable-target-number-input-focused');
  window.requestAnimationFrame(() => {
    inputEl.select();
  });
};

const blurPixelTargetNumericInput = (inputEl: HTMLInputElement, idx: number) => {
  if (!inputEl) {
    return;
  }
  const hostCell = inputEl.closest('.editable-target-number-cell');
  if (hostCell) {
    hostCell.classList.remove('editable-target-number-cell-active');
  }
  inputEl.classList.remove('main-inline-edit-input-focused');
  inputEl.classList.remove('editable-target-number-input-focused');

  updatePixelEditorTargetValue(idx, Number(inputEl.value));
};

const handlePixelTargetNumericInputKey = (event: KeyboardEvent, inputEl: HTMLInputElement, idx: number) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    inputEl.blur();
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    inputEl.value = inputEl.dataset.prevValue || inputEl.value;
    blurPixelTargetNumericInput(inputEl, idx);
  }
};

const updatePixelTargetEditor = () => {
  if (!editableTargetEditorCanvas || !editableTargetNumericWrap) {
    return;
  }

  const isNumeric = editablePixelEditorOutputMode === 'numeric';
  editableTargetEditorCanvas.style.display = isNumeric ? 'none' : 'block';
  editableTargetNumericWrap.style.display = isNumeric ? 'grid' : 'none';

  if (isNumeric) {
    updatePixelTargetNumericInputs();
  } else {
    updatePixelTargetCanvas();
  }
};

const renderEditableSampleNavigator = () => {
  if (!editableSampleList) {
    return;
  }
  const sourceSamples = getPixelEditorSourceSamples();
  editableSampleList.innerHTML = sourceSamples
    .map((sample, idx) => {
      const activeClass = idx === editablePixelEditorActiveRow ? ' active' : '';
      const serialized = sample.input.join(',');
      return `<div class="editable-sample-list-item${activeClass}"><button type="button" class="editable-sample-select-btn" onclick="selectEditablePixelSample(${idx})"><span class="editable-sample-list-index">${idx + 1}</span><canvas class="editable-sample-list-canvas" data-values="${serialized}"></canvas></button><input class="editable-sample-row-train" type="checkbox" ${sample.trainSample ? 'checked' : ''} onchange="toggleEditablePixelSampleTrain(${idx}, this.checked)"><button type="button" class="editable-sample-delete-btn" title="delete sample" onclick="deleteEditablePixelSample(${idx})">&#128465;</button></div>`;
    })
    .join('');

  const miniCanvases = Array.from(editableSampleList.querySelectorAll('.editable-sample-list-canvas')) as HTMLCanvasElement[];
  miniCanvases.forEach((canvasEl) => {
    const serialized = canvasEl.dataset.values || '';
    const values = serialized
      .split(',')
      .map((part) => Number(part))
      .filter((value) => !Number.isNaN(value));
    drawTrainingDataVizCanvas(canvasEl, values);
  });

  const activeItem = editableSampleList.querySelector('.editable-sample-list-item.active') as HTMLElement | null;
  if (activeItem) {
    activeItem.scrollIntoView({ block: 'nearest' });
  }
};

const toggleActiveEditablePixelSampleTrain = (checked: boolean) => {
  const sourceSamples = getPixelEditorSourceSamples();
  if (editablePixelEditorActiveRow < 0 || editablePixelEditorActiveRow >= sourceSamples.length) {
    return;
  }
  sourceSamples[editablePixelEditorActiveRow].trainSample = checked;
  renderEditableSampleNavigator();
};

const toggleEditablePixelSampleTrain = (rowIdx: number, checked: boolean) => {
  const sourceSamples = getPixelEditorSourceSamples();
  if (rowIdx < 0 || rowIdx >= sourceSamples.length) {
    return;
  }
  sourceSamples[rowIdx].trainSample = checked;
  if (rowIdx === editablePixelEditorActiveRow) {
    updateActiveSampleTrainCheckbox();
  }
};

const applyPixelToolAtIndex = (idx: number) => {
  if (idx < 0 || idx >= editablePixelEditorInputValues.length) {
    return;
  }

  const current = editablePixelEditorInputValues[idx];
  let next = current;
  if (editablePixelEditorTool === 'toggle') {
    next = current >= 0.5 ? 0 : 1;
  } else if (editablePixelEditorTool === 'black') {
    next = 0;
  } else if (editablePixelEditorTool === 'white') {
    next = 1;
  }
  editablePixelEditorInputValues[idx] = Math.round(next * 10) / 10;
  syncCurrentEditablePixelSampleFromEditor();
};

const getPixelIndexFromPointer = (clientX: number, clientY: number) => {
  if (!editablePixelEditorCanvas) {
    return -1;
  }
  const shape = getInputEditorShape(editablePixelEditorInputValues.length);
  const rect = editablePixelEditorCanvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) {
    return -1;
  }
  const pixelW = rect.width / shape.cols;
  const pixelH = rect.height / shape.rows;
  const col = Math.floor(x / pixelW);
  const row = Math.floor(y / pixelH);
  const idx = row * shape.cols + col;
  if (idx < 0 || idx >= editablePixelEditorInputValues.length) {
    return -1;
  }
  return idx;
};

const handlePixelEditorPointer = (clientX: number, clientY: number) => {
  const idx = getPixelIndexFromPointer(clientX, clientY);
  if (idx < 0) {
    return;
  }
  applyPixelToolAtIndex(idx);
  updatePixelEditorCanvas();
};

const getPixelOutputIndexFromPointer = (clientX: number, clientY: number) => {
  if (!editableTargetEditorCanvas) {
    return -1;
  }
  const rect = editableTargetEditorCanvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) {
    return -1;
  }
  const count = Math.max(1, editablePixelEditorOutputValues.length);
  const pixelW = rect.width / count;
  const idx = Math.floor(x / pixelW);
  if (idx < 0 || idx >= editablePixelEditorOutputValues.length) {
    return -1;
  }
  return idx;
};

const handlePixelEditorTargetPointer = (clientX: number, clientY: number) => {
  if (editablePixelEditorOutputMode !== 'paint') {
    return;
  }
  const idx = getPixelOutputIndexFromPointer(clientX, clientY);
  if (idx < 0) {
    return;
  }
  const current = editablePixelEditorOutputValues[idx];
  let next = current;
  if (editablePixelEditorTool === 'toggle') {
    next = current >= 0.5 ? 0 : 1;
  } else if (editablePixelEditorTool === 'black') {
    next = 0;
  } else if (editablePixelEditorTool === 'white') {
    next = 1;
  }
  editablePixelEditorOutputValues[idx] = Math.round(next * 10) / 10;
  syncCurrentEditablePixelSampleFromEditor();
  updatePixelTargetCanvas();
};

const updatePixelEditorTargetValue = (idx: number, value: number) => {
  if (idx < 0 || idx >= editablePixelEditorOutputValues.length) {
    return;
  }
  editablePixelEditorOutputValues[idx] = clampEditableValue(Number(value));
  syncCurrentEditablePixelSampleFromEditor();
  updatePixelTargetNumericInputs();
};

const loadEditablePixelSample = (rowIdx: number) => {
  const sourceSamples = getPixelEditorSourceSamples();
  if (rowIdx < 0 || rowIdx >= sourceSamples.length) {
    return;
  }

  const sourceSample = sourceSamples[rowIdx];
  editablePixelEditorActiveRow = rowIdx;
  editablePixelEditorInputValues = sourceSample.input.slice();
  editablePixelEditorOutputValues = sourceSample.output.slice();
  editablePixelEditorOriginalInputValues = sourceSample.input.slice();
  editablePixelEditorOriginalOutputValues = sourceSample.output.slice();
  clearEditablePixelStrokeHistory();

  renderEditableTargetLabels();
  updatePixelEditorCanvas();
  updatePixelTargetEditor();
  renderEditableSampleNavigator();
  updateActiveSampleTrainCheckbox();
};

const selectEditablePixelSample = (rowIdx: number) => {
  const sourceSamples = getPixelEditorSourceSamples();
  if (rowIdx < 0 || rowIdx >= sourceSamples.length) {
    return;
  }

  syncCurrentEditablePixelSampleFromEditor();
  loadEditablePixelSample(rowIdx);
};

const navigateEditablePixelSample = (delta: number) => {
  const sourceSamples = getPixelEditorSourceSamples();
  if (sourceSamples.length === 0) {
    return;
  }
  const nextRowIdx = Math.max(0, Math.min(sourceSamples.length - 1, editablePixelEditorActiveRow + delta));
  if (nextRowIdx === editablePixelEditorActiveRow) {
    return;
  }
  selectEditablePixelSample(nextRowIdx);
};

const addEditablePixelSample = () => {
  const sourceSamples = getPixelEditorSourceSamples();
  const inputValues = new Array(neuralCore.getInputSize()).fill(1);
  const outputValues = new Array(neuralCore.getOutputSize()).fill(0);
  sourceSamples.push(new TrainSample(inputValues, outputValues, true));
  if (mainTableEditMode) {
    updateMainEditTrainSelectControlVisibility();
  }
  selectEditablePixelSample(sourceSamples.length - 1);
};

const deleteEditablePixelSample = (rowIdx: number) => {
  const sourceSamples = getPixelEditorSourceSamples();
  if (rowIdx < 0 || rowIdx >= sourceSamples.length) {
    return;
  }

  sourceSamples.splice(rowIdx, 1);
  ensureSamplesNotEmpty(sourceSamples, neuralCore.getInputSize(), neuralCore.getOutputSize());
  if (mainTableEditMode) {
    updateMainEditTrainSelectControlVisibility();
  }

  const nextRowIdx = Math.min(rowIdx, sourceSamples.length - 1);
  loadEditablePixelSample(Math.max(0, nextRowIdx));
};

const openEditablePixelEditorOverlay = (rowIdx: number) => {
  if (!editablePixelEditorOverlay) {
    return;
  }

  hideEditableDataPreview();

  const sourceSamples = getPixelEditorSourceSamples();
  if (rowIdx < 0 || rowIdx >= sourceSamples.length) {
    return;
  }

  if (editablePixelEditorError) {
    editablePixelEditorError.textContent = '';
  }
  applyEditablePixelOverlayMode('samples');
  setPixelEditorTool('toggle');
  editablePixelEditorOutputMode = 'paint';
  editablePixelEditorOverlay.style.display = 'flex';

  // Wait one frame so pane dimensions are measurable before sizing the canvases.
  window.requestAnimationFrame(() => {
    loadEditablePixelSample(rowIdx);
    setPixelOutputEditMode('paint');
  });
};

const openLiveInputVisualOverlay = () => {
  if (!editablePixelEditorOverlay) {
    return;
  }

  hideEditableDataPreview();
  if (editablePixelEditorError) {
    editablePixelEditorError.textContent = '';
  }

  applyEditablePixelOverlayMode('live-input');
  liveInputOverlayOriginalInputValues = input.slice();
  editablePixelEditorInputValues = input.slice();
  editablePixelEditorOriginalInputValues = input.slice();
  editablePixelEditorOutputValues = [];
  editablePixelEditorOriginalOutputValues = [];
  editablePixelEditorActiveRow = -1;
  clearEditablePixelStrokeHistory();
  setPixelEditorTool('toggle');
  editablePixelEditorOutputMode = 'paint';
  editablePixelEditorOverlay.style.display = 'flex';

  window.requestAnimationFrame(() => {
    updatePixelEditorCanvas();
  });
};

const fillPixelEditorBlack = () => {
  editablePixelEditorInputValues = editablePixelEditorInputValues.map(() => 0);
  syncCurrentEditablePixelSampleFromEditor();
  applyLiveInputPreview();
  updatePixelEditorCanvas();
  renderEditableSampleNavigator();
};

const fillPixelEditorWhite = () => {
  editablePixelEditorInputValues = editablePixelEditorInputValues.map(() => 1);
  syncCurrentEditablePixelSampleFromEditor();
  applyLiveInputPreview();
  updatePixelEditorCanvas();
  renderEditableSampleNavigator();
};

const fillPixelEditorTargetsBlack = () => {
  editablePixelEditorOutputValues = editablePixelEditorOutputValues.map(() => 0);
  syncCurrentEditablePixelSampleFromEditor();
  updatePixelTargetEditor();
};

const fillPixelEditorTargetsWhite = () => {
  editablePixelEditorOutputValues = editablePixelEditorOutputValues.map(() => 1);
  syncCurrentEditablePixelSampleFromEditor();
  updatePixelTargetEditor();
};

const resetPixelEditorInputs = () => {
  editablePixelEditorInputValues = editablePixelEditorMode === 'live-input'
    ? liveInputOverlayOriginalInputValues.slice()
    : editablePixelEditorOriginalInputValues.slice();
  syncCurrentEditablePixelSampleFromEditor();
  applyLiveInputPreview();
  updatePixelEditorCanvas();
  renderEditableSampleNavigator();
};

const resetPixelEditorTargets = () => {
  editablePixelEditorOutputValues = editablePixelEditorOriginalOutputValues.slice();
  syncCurrentEditablePixelSampleFromEditor();
  updatePixelTargetEditor();
};

const applyPixelEditorCircle = () => {
  const shape = getInputEditorShape(editablePixelEditorInputValues.length);
  if (!shape.square || shape.rows !== shape.cols) {
    if (editablePixelEditorError) {
      editablePixelEditorError.textContent = 'Circle is available only for square layouts.';
    }
    return;
  }

  const size = shape.cols;
  const center = (size - 1) / 2;
  const radius = size / 2;
  const strokeWidth = 0.52;
  editablePixelEditorInputValues = editablePixelEditorInputValues.map((value, idx) => {
    const row = Math.floor(idx / size);
    const col = idx % size;
    const distance = Math.sqrt((col - center) ** 2 + (row - center) ** 2);
    return Math.abs(distance - radius) <= strokeWidth ? 0 : value;
  });
  syncCurrentEditablePixelSampleFromEditor();
  applyLiveInputPreview();
  if (editablePixelEditorError) {
    editablePixelEditorError.textContent = '';
  }
  updatePixelEditorCanvas();
};

const applyPixelEditorData = () => {
  if (editablePixelEditorMode === 'live-input') {
    input = editablePixelEditorInputValues.slice();
    isManualInput = true;
    updateUI();
    cancelPixelEditorOverlay(false);
    return;
  }
  syncCurrentEditablePixelSampleFromEditor();
  syncVisualizationInputToSelectedSample();
  resetEpochHistory();
  updateUI();
  cancelPixelEditorOverlay(false);
};

const resetPixelEditorData = () => {
  editablePixelEditorInputValues = editablePixelEditorOriginalInputValues.slice();
  editablePixelEditorOutputValues = editablePixelEditorOriginalOutputValues.slice();
  syncCurrentEditablePixelSampleFromEditor();
  if (editablePixelEditorError) {
    editablePixelEditorError.textContent = '';
  }
  updatePixelEditorCanvas();
  updatePixelTargetEditor();
  renderEditableSampleNavigator();
};

const cancelPixelEditorOverlay = (revertLiveInput = true) => {
  if (editablePixelEditorMode === 'live-input' && revertLiveInput) {
    input = liveInputOverlayOriginalInputValues.length > 0
      ? liveInputOverlayOriginalInputValues.slice()
      : input;
    restoreInputFromSelectedSample();
    updateUI();
  }
  if (editablePixelEditorOverlay) {
    editablePixelEditorOverlay.style.display = 'none';
  }
  editablePixelEditorMouseDown = false;
  editablePixelEditorMouseSurface = null;
  applyEditablePixelOverlayMode('samples');
  if (editablePixelEditorError) {
    editablePixelEditorError.textContent = '';
  }
};

const getMainTableRenderSamples = () => {
  if (mainTableEditMode) {
    ensureSamplesNotEmpty(mainTableEditSamples, neuralCore.getInputSize(), neuralCore.getOutputSize());
    return mainTableEditSamples;
  }
  return neuralCore.getTrainingSamples();
};

const getPixelEditorSourceSamples = () => {
  if (mainTableEditMode) {
    ensureSamplesNotEmpty(mainTableEditSamples, neuralCore.getInputSize(), neuralCore.getOutputSize());
    return mainTableEditSamples;
  }
  if (editableDataSamples.length > 0) {
    return editableDataSamples;
  }
  return neuralCore.getTrainingSamples();
};

const cloneSamplesForMainTableEdit = () => {
  mainTableEditSamples = neuralCore
    .getTrainingSamples()
    .map((sample) => new TrainSample(sample.input.slice(), sample.output.slice(), sample.trainSample));
  ensureSamplesNotEmpty(mainTableEditSamples, neuralCore.getInputSize(), neuralCore.getOutputSize());
};

const updateMainEditTrainSelectControlVisibility = () => {
  if (!mainEditTrainSelectControl) {
    return;
  }
  mainEditTrainSelectControl.style.display = mainTableEditMode && mainTableEditSamples.length > 10 ? 'inline-flex' : 'none';
};

const applyMainTableEditSamplesToCore = () => {
  const normalizedSamples = mainTableEditSamples.map((sample, sampleIdx) => {
    const normalizedInput = sample.input.map((value, idx) => {
      const normalized = clampEditableValue(Number(value));
      if (Number.isNaN(normalized)) {
        throw `Sample ${sampleIdx + 1}, input ${idx + 1}: invalid number.`;
      }
      return normalized;
    });
    const normalizedOutput = sample.output.map((value, idx) => {
      const normalized = clampEditableValue(Number(value));
      if (Number.isNaN(normalized)) {
        throw `Sample ${sampleIdx + 1}, output ${idx + 1}: invalid number.`;
      }
      return normalized;
    });
    return new TrainSample(normalizedInput, normalizedOutput, sample.trainSample);
  });

  neuralCore.setTrainingSamples([]);
  normalizedSamples.forEach((sample) => {
    neuralCore.addTrainingSet(sample.input, sample.output, sample.trainSample);
  });

  syncVisualizationInputToSelectedSample();

  resetEpochHistory();
};

const scrollMainDataTableToBottomIfScrollable = () => {
  const mainDataWrap = trainingSetDataOutput?.closest('.main-data-table-wrap') as HTMLElement | null;
  if (!mainDataWrap || !mainDataWrap.classList.contains('table-rows-scroll')) {
    return;
  }

  // Wait for the updated rows and virtual spacers to be laid out before scrolling.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      mainDataWrap.scrollTop = mainDataWrap.scrollHeight;
    });
  });
};

const toggleMainTableEditMode = () => {
  if (!mainTableEditMode) {
    ensureTrainingSamplesNotEmpty();
    syncTargetLabelsWithOutputSize();
    cloneSamplesForMainTableEdit();
    mainTableEditMode = true;
    updateUI();
    return;
  }

  finishMainTableEdits();
};

const handleEditInTableButton = () => {
  if (mainTableEditMode) {
    finishMainTableEdits();
    return;
  }
  toggleMainTableEditMode();
};

const closeMainTableEditModeDiscard = () => {
  if (!mainTableEditMode) {
    return;
  }
  mainTableEditMode = false;
  mainTableEditSamples = [];
  hideEditableDataPreview();
  cancelPixelEditorOverlay();
  cancelDeleteAllMainTableEditSamples();
  updateUI();
};

const finishMainTableEditsOnExternalControlUse = (target: EventTarget | null) => {
  if (!mainTableEditMode || !(target instanceof HTMLElement)) {
    return;
  }

  const controlEl = target.closest('button, input, select, textarea, [role="button"], a[href]') as HTMLElement | null;
  if (!controlEl) {
    return;
  }
  if (controlEl.id === 'edit-in-table-btn') {
    return;
  }
  if (controlEl.id === 'open-visual-editor-btn') {
    return;
  }

  const insideEditArea = !!controlEl.closest('.main-data-table-wrap')
    || !!controlEl.closest('#main-data-edit-controls')
    || !!controlEl.closest('#main-data-delete-all-overlay')
    || !!controlEl.closest('#editable-pixel-editor-overlay')
    || !!controlEl.closest('#target-labels-overlay');

  if (insideEditArea) {
    return;
  }

  finishMainTableEdits();
};

const finishMainTableEdits = () => {
  if (!mainTableEditMode) {
    return;
  }
  try {
    applyMainTableEditSamplesToCore();
    mainTableEditMode = false;
    mainTableEditSamples = [];
    hideEditableDataPreview();
    cancelPixelEditorOverlay();
    cancelDeleteAllMainTableEditSamples();
    updateUI();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    window.alert(`Could not set data: ${message}`);
  }
};

const updateMainTableEditValue = (rowIdx: number, section: 'input' | 'output', valueIdx: number, value: number) => {
  if (rowIdx < 0 || rowIdx >= mainTableEditSamples.length) {
    return;
  }
  const valueArray = section === 'input' ? mainTableEditSamples[rowIdx].input : mainTableEditSamples[rowIdx].output;
  if (valueIdx < 0 || valueIdx >= valueArray.length) {
    return;
  }
  valueArray[valueIdx] = Number.isNaN(value) ? 0 : clampEditableValue(value);

  if (section === 'input' && editablePreviewTooltip && editablePreviewTooltip.style.display !== 'none') {
    drawEditableSamplePreview(mainTableEditSamples[rowIdx].input);
  }
};

const addMainTableEditSample = () => {
  if (!mainTableEditMode) {
    return;
  }
  const inputValues = new Array(neuralCore.getInputSize()).fill(1);
  const outputValues = new Array(neuralCore.getOutputSize()).fill(0);
  mainTableEditSamples.push(new TrainSample(inputValues, outputValues, true));
  updateMainEditTrainSelectControlVisibility();
  updateUI();
  scrollMainDataTableToBottomIfScrollable();
};

const deleteMainTableEditSample = (rowIdx: number) => {
  if (!mainTableEditMode || rowIdx < 0 || rowIdx >= mainTableEditSamples.length) {
    return;
  }
  mainTableEditSamples.splice(rowIdx, 1);
  ensureSamplesNotEmpty(mainTableEditSamples, neuralCore.getInputSize(), neuralCore.getOutputSize());
  updateMainEditTrainSelectControlVisibility();
  updateUI();
};

const toggleMainTableEditTrainSample = (rowIdx: number, checked: boolean) => {
  if (!mainTableEditMode || rowIdx < 0 || rowIdx >= mainTableEditSamples.length) {
    return;
  }
  mainTableEditSamples[rowIdx].trainSample = checked;
};

const applyMainEditTrainSamplePercentage = () => {
  if (!mainTableEditMode || mainTableEditSamples.length === 0) {
    return;
  }
  const parsedPercent = Number.parseFloat(mainEditTrainPercentInput?.value || '80');
  const normalizedPercent = normalizePercent(parsedPercent, 80);
  if (mainEditTrainPercentInput) {
    mainEditTrainPercentInput.value = Math.round(normalizedPercent).toString();
  }
  applyRandomTrainSelection(mainTableEditSamples, normalizedPercent);
  updateUI();
};

const requestDeleteAllMainTableEditSamples = () => {
  if (!mainTableEditMode || !mainDataDeleteAllOverlay) {
    return;
  }
  mainDataDeleteAllOverlay.style.display = 'flex';
};

const cancelDeleteAllMainTableEditSamples = () => {
  if (!mainDataDeleteAllOverlay) {
    return;
  }
  mainDataDeleteAllOverlay.style.display = 'none';
};

const confirmDeleteAllMainTableEditSamples = () => {
  if (!mainTableEditMode) {
    return;
  }
  mainTableEditSamples = [];
  ensureSamplesNotEmpty(mainTableEditSamples, neuralCore.getInputSize(), neuralCore.getOutputSize());
  cancelDeleteAllMainTableEditSamples();
  updateMainEditTrainSelectControlVisibility();
  updateUI();
};

const formatMainInlineInputValue = (value: number) => {
  const rounded = Math.round(value * 100000) / 100000;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
};

const focusMainTableCellInput = (inputEl: HTMLInputElement) => {
  if (!inputEl) {
    return;
  }
  const hostCell = inputEl.closest('td');
  if (hostCell) {
    hostCell.classList.add('main-inline-edit-active');
  }
  inputEl.dataset.prevValue = inputEl.value;
  const parsed = Number.parseFloat(inputEl.value);
  if (!Number.isNaN(parsed)) {
    inputEl.value = parsed.toFixed(5);
  }
  inputEl.classList.add('main-inline-edit-input-focused');
  window.requestAnimationFrame(() => {
    inputEl.select();
  });
};

const blurMainTableCellInput = (inputEl: HTMLInputElement, rowIdx: number, section: 'input' | 'output', valueIdx: number) => {
  if (!inputEl) {
    return;
  }
  const hostCell = inputEl.closest('td');
  if (hostCell) {
    hostCell.classList.remove('main-inline-edit-active');
  }
  inputEl.classList.remove('main-inline-edit-input-focused');
  if (!mainTableEditMode) {
    return;
  }
  const parsed = Number.parseFloat(inputEl.value);
  updateMainTableEditValue(rowIdx, section, valueIdx, Number.isNaN(parsed) ? 0 : parsed);
  const row = mainTableEditSamples[rowIdx];
  if (!row) {
    return;
  }
  const source = section === 'input' ? row.input : row.output;
  const normalized = source[valueIdx] ?? 0;
  inputEl.value = formatMainInlineInputValue(normalized);
};

const handleMainTableCellInputKey = (event: KeyboardEvent, inputEl: HTMLInputElement, rowIdx: number, section: 'input' | 'output', valueIdx: number) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    inputEl.blur();
    return;
  }
  if (event.key === 'Escape') {
    event.preventDefault();
    inputEl.value = inputEl.dataset.prevValue || inputEl.value;
    inputEl.blur();
  }
};

const buildEditableDataTable = () => {
  if (mainTableEditMode) {
    updateUI();
  }
};

const openEditableDataOverlay = () => {
  if (!mainTableEditMode) {
    toggleMainTableEditMode();
  }
};

const cancelEditableDataOverlay = () => {
  if (mainTableEditMode) {
    closeMainTableEditModeDiscard();
  }
};

const addEditableDataSample = () => {
  addMainTableEditSample();
};

const deleteEditableDataSample = (rowIdx: number) => {
  deleteMainTableEditSample(rowIdx);
};

const updateEditableDataValue = (rowIdx: number, section: 'input' | 'output', valueIdx: number, value: number) => {
  updateMainTableEditValue(rowIdx, section, valueIdx, value);
};

const applyEditableDataOverlay = () => {
  finishMainTableEdits();
};

const serializeTrainingData = () => {
  const trainingData = {
    samples: getSerializedSamples(),
    targetLabels: targetLabels.slice(),
  };
  targetLabelsJson = JSON.stringify(trainingData.targetLabels);
  return formatDataBlock(trainingData);
};

const parseTrainingDataFromEditor = (expectedInputSize?: number, expectedOutputSize?: number) => {
  const parsed = JSON.parse(trainingSetInput.value);
  return parseTrainingDataPayload(parsed, expectedInputSize, expectedOutputSize);
};

const inferArchitectureFromWeights = (weights: any) => {
  if (!Array.isArray(weights) || weights.length === 0) {
    throw 'Weights JSON must contain at least one layer matrix.';
  }

  let inputSizeFromWeights: number | null = null;
  let previousLayerNeuronCount: number | null = null;
  const hiddenSizesFromWeights: number[] = [];

  weights.forEach((layer, layerIdx) => {
    if (!Array.isArray(layer) || layer.length === 0) {
      throw `Layer ${layerIdx + 1}: must contain at least one neuron weight array.`;
    }

    layer.forEach((neuronWeights, neuronIdx) => {
      if (!Array.isArray(neuronWeights) || neuronWeights.length === 0) {
        throw `Layer ${layerIdx + 1}, neuron ${neuronIdx + 1}: must be a non-empty weights array.`;
      }

      neuronWeights.forEach((weight, weightIdx) => {
        if (!Number.isFinite(Number(weight))) {
          throw `Layer ${layerIdx + 1}, neuron ${neuronIdx + 1}, weight ${weightIdx + 1}: must be a number.`;
        }
      });

      if (layerIdx === 0) {
        if (inputSizeFromWeights == null) {
          inputSizeFromWeights = neuronWeights.length - 1;
          if (inputSizeFromWeights < 1) {
            throw 'Input size inferred from weights must be at least 1.';
          }
        }
        if (neuronWeights.length - 1 !== inputSizeFromWeights) {
          throw `Layer 1 has inconsistent neuron weight lengths.`;
        }
      } else if (previousLayerNeuronCount != null) {
        const expectedLen = previousLayerNeuronCount + 1;
        if (neuronWeights.length !== expectedLen) {
          throw `Layer ${layerIdx + 1}, neuron ${neuronIdx + 1}: expected ${expectedLen} weights, got ${neuronWeights.length}.`;
        }
      }
    });

    if (layerIdx < weights.length - 1) {
      hiddenSizesFromWeights.push(layer.length);
    }
    previousLayerNeuronCount = layer.length;
  });

  if (inputSizeFromWeights == null || previousLayerNeuronCount == null) {
    throw 'Could not infer architecture from weights JSON.';
  }

  return {
    inputSize: inputSizeFromWeights,
    hiddenSizes: hiddenSizesFromWeights,
    outputSize: previousLayerNeuronCount,
  };
};

const openTrainingDataEditor = () => {
  if (!trainingDataEditorOverlay || !trainingSetInput) {
    return;
  }

  if (trainingDataEditorError) {
    trainingDataEditorError.textContent = '';
  }
  if (dataAdjustArchitectureCheckbox) {
    dataAdjustArchitectureCheckbox.checked = false;
  }
  trainingSetInput.value = serializeTrainingData();
  trainingDataEditorOverlay.style.display = 'flex';
  focusJsonEditorAtTop(trainingSetInput);
};

const cancelTrainingDataEditor = () => {
  if (!trainingDataEditorOverlay) {
    return;
  }

  trainingDataEditorOverlay.style.display = 'none';
  if (trainingDataEditorError) {
    trainingDataEditorError.textContent = '';
  }
  if (dataAdjustArchitectureCheckbox) {
    dataAdjustArchitectureCheckbox.checked = false;
  }
};

const applyTrainingDataFromEditor = () => {
  try {
    const shouldAdjustArchitecture = dataAdjustArchitectureCheckbox ? dataAdjustArchitectureCheckbox.checked : false;
    const parsed = parseTrainingDataFromEditor(
      shouldAdjustArchitecture ? undefined : neuralCore.getInputSize(),
      shouldAdjustArchitecture ? undefined : neuralCore.getOutputSize()
    );

    if (shouldAdjustArchitecture && parsed.samples.length > 0) {
      if (parsed.inputSize == null || parsed.outputSize == null) {
        throw 'Could not infer architecture from data.';
      }
      inputSize = parsed.inputSize;
      outputSize = parsed.outputSize;
      initCore(false);
      syncTargetLabelsWithOutputSize();
    }

    if (parsed.targetLabels) {
      targetLabels = parsed.targetLabels.slice();
      targetLabelsJson = JSON.stringify(targetLabels);
    } else {
      syncTargetLabelsWithOutputSize();
    }

    neuralCore.setTrainingSamples([]);
    parsed.samples.forEach((sample) => {
      neuralCore.addTrainingSet(sample.input, sample.output, sample.trainSample);
    });

    const samples = neuralCore.getTrainingSamples();
    if (samples.length > 0) {
      selectedSampleIndex = 0;
      input = samples[0].input.slice();
      isManualInput = false;
    } else {
      selectedSampleIndex = -1;
    }

    cancelTrainingDataEditor();
    resetEpochHistory();
    updateUI();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (trainingDataEditorError) {
      trainingDataEditorError.textContent = `Could not set training data: ${message}`;
    }
  }
};

const formatWeightsForDisplay = (
  weights: number[][][],
  formatWeight: (weight: number) => string
) => {
  const layerLines = weights.map((layer) => {
    const nodeTexts = layer.map((nodeWeights) => {
      return `[${nodeWeights.map((weight) => formatWeight(weight)).join(', ')}]`;
    });

    const layerWeightCount = layer.reduce((acc, nodeWeights) => acc + nodeWeights.length, 0);
    if (layerWeightCount <= 16) {
      return `  [${nodeTexts.join(', ')}]`;
    }

    const multilines = nodeTexts.map((nodeText, idx) => {
      const suffix = idx < nodeTexts.length - 1 ? ',' : '';
      return `    ${nodeText}${suffix}`;
    });
    return `  [\n${multilines.join('\n')}\n  ]`;
  });

  const withLayerCommas = layerLines.map((line, idx) => {
    const suffix = idx < layerLines.length - 1 ? ',' : '';
    return `${line}${suffix}`;
  });

  return `[
${withLayerCommas.join('\n')}
]`;
};

const serializeExactWeights = () => formatWeightsForDisplay(neuralCore.getWeights(), (weight) => `${weight}`);

const serializeEditorInitialWeights = () => formatWeightsForDisplay(
  neuralCore.getWeights(),
  (weight) => weight.toFixed(2)
);

const serializePreviewWeights = () => formatWeightsForDisplay(
  neuralCore.getWeights(),
  (weight) => weight.toFixed(3)
);

const indentBlock = (text: string, spaces: number) => {
  const prefix = ' '.repeat(spaces);
  return text.split('\n').map((line) => `${prefix}${line}`).join('\n');
};

const formatProjectForDisplay = (project: ProjectConfig) => {
  const dataJson = formatDataBlock(project.data);
  const weightsJson = formatWeightsForDisplay(project.weights, (weight) => `${weight}`);

  return `{
  "projectType": ${JSON.stringify(project.projectType || currentProjectType)},
  "architecture": {
    "inputSize": ${project.architecture.inputSize},
    "hiddenSizes": ${JSON.stringify(project.architecture.hiddenSizes)},
    "outputSize": ${project.architecture.outputSize}
  },
  "learning": {
    "rate": ${project.learning.rate},
    "momentum": ${project.learning.momentum},
    "epochs": ${project.learning.epochs}
  },
  "data": ${indentBlock(dataJson, 2).trimStart()},
  "weights": ${indentBlock(weightsJson, 2).trimStart()}
}`;
};

const focusJsonEditorAtTop = (editor: HTMLTextAreaElement) => {
  editor.focus();
  editor.scrollTop = 0;
  editor.scrollLeft = 0;
  editor.setSelectionRange(0, 0);
};

const makeProjectFileNameBase = (fileName: string) => {
  return fileName.replace(/\.json$/i, '').trim();
};

const saveProjectToFile = () => {
  if (!projectSaveOutput) {
    return;
  }

  const blob = new Blob([projectSaveOutput.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement('a');
  downloadLink.href = url;
  downloadLink.download = 'custom.json';
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
};

const loadProjectFromFile = () => {
  if (!projectEditorInput || !projectEditorError) {
    return;
  }

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json,application/json';
  fileInput.onchange = async () => {
    const selectedFile = fileInput.files && fileInput.files[0];
    if (!selectedFile) {
      return;
    }

    try {
      const rawText = await selectedFile.text();
      const parsed = JSON.parse(rawText);
      const fileProjectType = makeProjectFileNameBase(selectedFile.name);

      if (fileProjectType.length > 0 && parsed && typeof parsed === 'object') {
        const currentType = typeof parsed.projectType === 'string'
          ? parsed.projectType
          : (typeof parsed['project-type'] === 'string' ? parsed['project-type'] : '');
        if (currentType !== fileProjectType) {
          parsed.projectType = fileProjectType;
          if ('project-type' in parsed) {
            delete parsed['project-type'];
          }
        }
      }

      projectEditorInput.value = formatProjectForDisplay(normalizeProjectConfig(parsed));
      projectEditorError.textContent = '';
      focusJsonEditorAtTop(projectEditorInput);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      projectEditorError.textContent = `Could not read project file: ${message}`;
    }
  };

  fileInput.click();
};

const resizeCanvasToContainer = () => {
  if (!canvas) {
    return;
  }

  const containerWidth = Math.max(320, Math.round(canvas.parentElement ? canvas.parentElement.clientWidth : canvas.clientWidth));
  const nextWidth = containerWidth;
  const inputCount = neuralCore ? neuralCore.getInputSize() : inputSize;
  const heightScale = inputCount > 16 ? 1.44 : inputCount > 9 ? 1.2 : 1;
  const nextHeight = Math.max(220, Math.round(nextWidth * (600 / 982) * heightScale));

  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }

  if (inputControls) {
    inputControls.style.height = `${nextHeight}px`;
  }
};

const updateWeightsPreview = () => {
  if (!weightsPreviewInput || fullTrainingRunning) {
    return;
  }

  const nextWeights = serializePreviewWeights();
  if (weightsPreviewInput.value !== nextWeights) {
    const scrollTop = weightsPreviewInput.scrollTop;
    weightsPreviewInput.value = nextWeights;
    weightsPreviewInput.scrollTop = scrollTop;
  }
};

const setWeightControlsDisabled = (disabled: boolean) => {
  if (randomWeightsBtn) {
    randomWeightsBtn.disabled = disabled;
  }
  if (setWeightsManuallyBtn) {
    setWeightsManuallyBtn.disabled = disabled;
  }
  if (saveWeightsBtn) {
    saveWeightsBtn.disabled = disabled;
  }
  if (saveProjectBtn) {
    saveProjectBtn.disabled = disabled;
  }
  if (loadProjectBtn) {
    loadProjectBtn.disabled = disabled;
  }
  if (projectSelect) {
    projectSelect.disabled = disabled;
  }
};

const openWeightsEditor = () => {
  if (!weightsEditorOverlay || !weightsEditorInput) {
    return;
  }

  if (weightsEditorError) {
    weightsEditorError.textContent = '';
  }
  if (weightsAdjustArchitectureCheckbox) {
    weightsAdjustArchitectureCheckbox.checked = false;
  }
  weightsEditorInput.value = serializeEditorInitialWeights();
  weightsEditorOverlay.style.display = 'flex';
  focusJsonEditorAtTop(weightsEditorInput);
};

const cancelWeightsEditor = () => {
  if (!weightsEditorOverlay) {
    return;
  }

  weightsEditorOverlay.style.display = 'none';
  if (weightsEditorError) {
    weightsEditorError.textContent = '';
  }
  if (weightsAdjustArchitectureCheckbox) {
    weightsAdjustArchitectureCheckbox.checked = false;
  }
};

const openSaveWeightsOverlay = () => {
  if (!weightsSaveOverlay || !weightsSaveOutput) {
    return;
  }

  weightsSaveOutput.value = serializeExactWeights();
  weightsSaveOverlay.style.display = 'flex';
  focusJsonEditorAtTop(weightsSaveOutput);
};

const closeSaveWeightsOverlay = () => {
  if (!weightsSaveOverlay) {
    return;
  }

  weightsSaveOverlay.style.display = 'none';
};

const copyWeightsToClipboard = async () => {
  if (!weightsSaveOutput) {
    return;
  }

  const textToCopy = weightsSaveOutput.value;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(textToCopy);
      return;
    }
  } catch (err) {
    // Fallback to execCommand below.
  }

  weightsSaveOutput.focus();
  weightsSaveOutput.select();
  document.execCommand('copy');
};

const openSaveProjectOverlay = () => {
  if (!projectSaveOverlay || !projectSaveOutput) {
    return;
  }

  const customProjectConfig = {
    ...getCurrentProjectConfig(),
    projectType: 'custom',
  };
  projectSaveOutput.value = formatProjectForDisplay(customProjectConfig);
  projectSaveOverlay.style.display = 'flex';
  focusJsonEditorAtTop(projectSaveOutput);
};

const closeSaveProjectOverlay = () => {
  if (!projectSaveOverlay) {
    return;
  }
  projectSaveOverlay.style.display = 'none';
};

const copyProjectToClipboard = async () => {
  if (!projectSaveOutput) {
    return;
  }

  const textToCopy = projectSaveOutput.value;
  let copied = false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(textToCopy);
      copied = true;
    }
  } catch (err) {
    // Fallback to execCommand below.
  }

  if (!copied) {
    projectSaveOutput.focus();
    projectSaveOutput.select();
    document.execCommand('copy');
  }

  closeSaveProjectOverlay();
};

const openLoadProjectOverlay = () => {
  if (!projectEditorOverlay || !projectEditorInput) {
    return;
  }

  if (projectEditorError) {
    projectEditorError.textContent = '';
  }

  projectEditorInput.value = formatProjectForDisplay(getCurrentProjectConfig());
  projectEditorOverlay.style.display = 'flex';
  focusJsonEditorAtTop(projectEditorInput);
};

const cancelLoadProjectOverlay = () => {
  if (!projectEditorOverlay) {
    return;
  }
  projectEditorOverlay.style.display = 'none';
  if (projectEditorError) {
    projectEditorError.textContent = '';
  }
};

const applyProjectFromEditor = async () => {
  if (!projectEditorInput) {
    return;
  }

  showProjectLoadingOverlay();
  await delay(0);
  try {
    const parsedProject = JSON.parse(projectEditorInput.value);
    const normalizedProject = normalizeProjectConfig(parsedProject);
    applyProjectConfig(
      normalizedProject,
      typeof normalizedProject.projectType === 'string' ? normalizedProject.projectType : undefined
    );
    cancelLoadProjectOverlay();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (projectEditorError) {
      projectEditorError.textContent = `Could not load project: ${message}`;
    }
  } finally {
    hideProjectLoadingOverlay();
  }
};

const applyWeightsFromEditor = () => {
  if (!weightsEditorInput) {
    return;
  }

  try {
    const parsedWeights = JSON.parse(weightsEditorInput.value);

    const shouldAdjustArchitecture = weightsAdjustArchitectureCheckbox ? weightsAdjustArchitectureCheckbox.checked : false;
    if (shouldAdjustArchitecture) {
      const inferredArchitecture = inferArchitectureFromWeights(parsedWeights);
      inputSize = inferredArchitecture.inputSize;
      hiddenSizes = inferredArchitecture.hiddenSizes;
      outputSize = inferredArchitecture.outputSize;
      initCore(false);
      syncTargetLabelsWithOutputSize();
    }

    neuralCore.setWeights(parsedWeights);
    cancelWeightsEditor();
    resetEpochHistory();
    updateUI();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (weightsEditorError) {
      weightsEditorError.textContent = `Could not set weights: ${message}`;
    }
  }
};

const updateTrainButtonLabel = () => {
  if (!runFullTrainingBtn || !itersInput) {
    return;
  }

  const parsedEpochs = Number.parseInt(itersInput.value);
  const epochs = Number.isNaN(parsedEpochs) || parsedEpochs < 1 ? 1 : parsedEpochs;
  runFullTrainingBtn.innerText = `Train ${epochs} epochs`;
};

const getActiveSampleIndex = () => {
  const trainingSamples = neuralCore.getTrainingSamples();
  if (!trainingSamples.length) {
    return -1;
  }

  if (selectedSampleIndex < 0 || selectedSampleIndex >= trainingSamples.length) {
    return 0;
  }

  return selectedSampleIndex;
};

const setTrainingModeVisible = (fullTraining: boolean) => {
  if (!graphView) {
    return;
  }

  if (fullTraining) {
    updateTrainingGraphDialogWidth();
    graphView.style.display = 'flex';
  }
};

const setTrainingButtonsDisabled = (disabled: boolean) => {
  trainCurrentSampleBtn.disabled = disabled;
  trainOneEpochBtn.disabled = disabled;
  runFullTrainingBtn.disabled = disabled;
  resetBtn.disabled = disabled;
  setWeightControlsDisabled(disabled);
};

const showTrainingEpochNotice = (message: string) => {
  if (!trainingEpochNotice) {
    return;
  }

  trainingEpochNotice.textContent = message;
  trainingEpochNotice.style.display = 'block';
};

const hideTrainingEpochNotice = () => {
  if (!trainingEpochNotice) {
    return;
  }

  trainingEpochNotice.textContent = '';
  trainingEpochNotice.style.display = 'none';
};

const showProjectLoadingOverlay = () => {
  if (projectLoadingOverlay) {
    projectLoadingOverlay.style.display = 'flex';
  }
};

const hideProjectLoadingOverlay = () => {
  if (projectLoadingOverlay) {
    projectLoadingOverlay.style.display = 'none';
  }
};

const updateTrainingGraphDialogWidth = () => {
  if (!mainContainer || !trainingGraphDialog) {
    return;
  }

  const targetWidth = Math.floor(mainContainer.clientWidth * 0.9);
  trainingGraphDialog.style.width = `${Math.max(targetWidth, 560)}px`;
};

const setTrainingGraphOverlayButtons = (isRunning: boolean, isVisible: boolean) => {
  if (!stopFullTrainingBtn || !continueTrainingBtn || !closeTrainingGraphBtn) {
    return;
  }

  if (!isVisible) {
    stopFullTrainingBtn.style.display = 'none';
    continueTrainingBtn.style.display = 'none';
    closeTrainingGraphBtn.style.display = 'none';
    return;
  }

  if (isRunning) {
    stopFullTrainingBtn.style.display = 'inline-block';
    continueTrainingBtn.style.display = 'none';
    closeTrainingGraphBtn.style.display = 'none';
    return;
  }

  stopFullTrainingBtn.style.display = 'none';
  continueTrainingBtn.style.display = 'inline-block';
  closeTrainingGraphBtn.style.display = 'inline-block';
};

const drawFullTrainingGraph = (costHistory: number[]) => {
  if (!trainingGraphCtx) {
    return;
  }

  const ctx = trainingGraphCtx;
  const width = trainingGraphCanvas.width;
  const height = trainingGraphCanvas.height;
  const left = 72;
  const right = 24;
  const top = 36;
  const bottom = 54;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const originX = left;
  const originY = height - bottom;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(255,255,255,1)';
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = 'rgb(46, 40, 42, 1)';
  ctx.textAlign = 'center';
  ctx.font = '12px sans-serif';
  ctx.fillText('epochs', width / 2, height - 12);
  ctx.save();
  ctx.translate(18, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('error', 0, 0);
  ctx.restore();

  ctx.strokeStyle = 'rgba(46, 40, 42, 0.55)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(originX, top);
  ctx.lineTo(originX, originY);
  ctx.lineTo(width - right, originY);
  ctx.stroke();

  const maxCost = costHistory.length ? Math.max(...costHistory) : 1;
  const costRange = maxCost || 1;

  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(46, 40, 42, 0.8)';
  for (let i = 0; i <= 4; i++) {
    const y = top + (plotHeight * i) / 4;
    const value = maxCost - (costRange * i) / 4;
    ctx.strokeStyle = 'rgba(46, 40, 42, 0.12)';
    ctx.beginPath();
    ctx.moveTo(originX, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();
    ctx.fillText(value.toFixed(2), originX - 8, y + 4);
  }

  if (costHistory.length > 0) {
    const currentEpoch = costHistory.length - 1;
    const tickStep = currentEpoch > 3000 ? 1000 : 100;
    if (currentEpoch > 0) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(46, 40, 42, 0.75)';
      ctx.font = '11px sans-serif';
      for (let tick = 0; tick <= currentEpoch; tick += tickStep) {
        const x = originX + (tick / currentEpoch) * plotWidth;
        ctx.strokeStyle = 'rgba(46, 40, 42, 0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, originY);
        ctx.lineTo(x, originY + 6);
        ctx.stroke();
        ctx.fillText(`${tick}`, x, originY + 18);
      }

      if (currentEpoch % tickStep !== 0) {
        const x = originX + plotWidth;
        ctx.strokeStyle = 'rgba(46, 40, 42, 0.35)';
        ctx.beginPath();
        ctx.moveTo(x, originY);
        ctx.lineTo(x, originY + 6);
        ctx.stroke();
        ctx.fillText(`${currentEpoch}`, x, originY + 18);
      }
    }

    const stepX = costHistory.length > 1 ? plotWidth / (costHistory.length - 1) : 0;
    ctx.strokeStyle = 'rgba(33, 100, 205, 1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    costHistory.forEach((value, idx) => {
      const x = originX + idx * stepX;
      const normalized = value / costRange;
      const y = originY - normalized * plotHeight;
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    const lastValue = costHistory[costHistory.length - 1];
    const lastX = originX + (costHistory.length > 1 ? (costHistory.length - 1) * stepX : 0);
    const lastY = originY - (lastValue / costRange) * plotHeight;

    ctx.strokeStyle = 'rgba(255, 140, 0, 0.65)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(lastX, top);
    ctx.lineTo(lastX, originY);
    ctx.stroke();

    ctx.fillStyle = 'rgba(33, 100, 205, 1)';
    ctx.beginPath();
    ctx.arc(lastX, lastY, 3.5, 0, 2 * Math.PI);
    ctx.fill();

    const targetEpoch = Math.max(currentTrainingTargetEpoch, currentEpoch);
    const lineHeight = 18;
    // second line baseline 20px above the blue dot, first line one lineHeight above that
    const currentLabelY = Math.max(top + 16, lastY - 20 - lineHeight);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255, 140, 0, 1)';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`current epoch: ${currentEpoch}/${targetEpoch}`, width - right - 20, currentLabelY);
    ctx.fillStyle = 'rgba(33, 100, 205, 1)';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`current error: ${lastValue.toFixed(4)}`, width - right - 20, currentLabelY + lineHeight);
  }
};

const finishFullTraining = (naturalCompletion: boolean, closeOverlay: boolean) => {
  if (fullTrainingTimer != null) {
    clearTimeout(fullTrainingTimer);
    fullTrainingTimer = null;
  }

  fullTrainingRunning = false;
  setTrainingButtonsDisabled(false);
  if (graphView && closeOverlay) {
    graphView.style.display = 'none';
    setTrainingGraphOverlayButtons(false, false);
  } else {
    setTrainingGraphOverlayButtons(false, naturalCompletion);
  }

  const trainingSamples = neuralCore.getTrainingSamples();
  if (trainingSamples.length > 0) {
    selectedSampleIndex = 0;
    input = trainingSamples[0].input.slice();
    isManualInput = false;
  } else {
    selectedSampleIndex = -1;
  }

  updateUI();
};

const trainCurrentSample = () => {
  const trainingSamples = neuralCore.getTrainingSamples();
  const sampleIndex = getActiveSampleIndex();
  if (sampleIndex < 0) {
    return;
  }
  if (!trainingSamples[sampleIndex].trainSample) {
    return;
  }

  configureTrainingSettings();
  neuralCore.trainOnSample(input, trainingSamples[sampleIndex].output);
  neuralCore.incrementIteration();
  updateUI();
};

const delay = (ms: number) => new Promise<void>((resolve) => {
  window.setTimeout(resolve, ms);
});

const trainOneEpoch = async () => {
  if (trainOneEpochRunning || fullTrainingRunning) {
    return;
  }

  const sampleOrder = neuralCore
    .getTrainingSamples()
    .map((sample, idx) => ({ sample, idx }))
    .filter((entry) => entry.sample.trainSample);

  if (!sampleOrder.length) {
    return;
  }

  configureTrainingSettings();
  for (let i = sampleOrder.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = sampleOrder[i];
    sampleOrder[i] = sampleOrder[j];
    sampleOrder[j] = tmp;
  }

  trainOneEpochRunning = true;
  setTrainingButtonsDisabled(true);

  const showCondensedVisualization = sampleOrder.length > 20;

  try {
    if (showCondensedVisualization) {
      if (epochNoticeTimer !== null) {
        clearTimeout(epochNoticeTimer);
        epochNoticeTimer = null;
      }
      showTrainingEpochNotice(`If an epoch contains > 20 samples (currently ${sampleOrder.length}) visualisation of individual samples during training will be skipped`);
      epochNoticeTimer = window.setTimeout(() => {
        hideTrainingEpochNotice();
        epochNoticeTimer = null;
      }, 1000);
      await delay(0);
    } else {
      hideTrainingEpochNotice();
    }

    for (let i = 0; i < sampleOrder.length; i++) {
      const { sample, idx } = sampleOrder[i];
      input = sample.input.slice();
      selectedSampleIndex = idx;
      isManualInput = false;
      neuralCore.trainOnSample(sample.input, sample.output);

      if (!showCondensedVisualization) {
        updateUI();
        if (i < sampleOrder.length - 1) {
          await delay(100);
        }
      }
    }

    neuralCore.incrementIteration();
    epochCostHistory.push(neuralCore.getCost());
    updateUI();
  } finally {
    trainOneEpochRunning = false;
    setTrainingButtonsDisabled(false);
  }
};

const startFullTraining = () => {
  if (fullTrainingRunning) {
    return;
  }

  const samples = neuralCore.getTrainingSamples().filter((sample) => sample.trainSample);
  const totalIterations = Number.parseInt(itersInput.value);
  if (!samples.length || Number.isNaN(totalIterations) || totalIterations <= 0) {
    finishFullTraining(false, true);
    return;
  }

  configureTrainingSettings();
  fullTrainingRunning = true;
  if (epochCostHistory.length === 0) {
    resetEpochHistory();
  }
  const startEpoch = Math.max(0, epochCostHistory.length - 1);
  currentTrainingTargetEpoch = startEpoch + totalIterations;
  setTrainingModeVisible(true);
  setTrainingButtonsDisabled(true);
  setTrainingGraphOverlayButtons(true, true);
  drawFullTrainingGraph(epochCostHistory);

  let completedIterations = 0;
  const runNextIteration = () => {
    if (!fullTrainingRunning) {
      return;
    }

    if (completedIterations >= totalIterations) {
      finishFullTraining(true, false);
      return;
    }

    neuralCore.train();
    completedIterations++;
    epochCostHistory.push(neuralCore.getCost());
    drawFullTrainingGraph(epochCostHistory);
    fullTrainingTimer = window.setTimeout(runNextIteration, 0);
  };

  runNextIteration();
};

const stopFullTraining = () => {
  if (!fullTrainingRunning) {
    return;
  }

  fullTrainingRunning = false;
  finishFullTraining(false, true);
};

const closeTrainingGraphOverlay = () => {
  if (fullTrainingRunning || !graphView) {
    return;
  }

  graphView.style.display = 'none';
  setTrainingGraphOverlayButtons(false, false);
};

const continueFullTraining = () => {
  if (fullTrainingRunning || !graphView) {
    return;
  }

  startFullTraining();
};

const main = () => {
  mainContainer = document.getElementById('id_main') as HTMLElement;
  canvas = document.getElementById('content') as HTMLCanvasElement;
  trainingGraphCanvas = document.getElementById('training-graph') as HTMLCanvasElement;
  trainingGraphCtx = trainingGraphCanvas.getContext('2d');
  visualizationView = document.getElementById('visualization-view');
  graphView = document.getElementById('training-graph-view') as HTMLElement;
  trainingGraphDialog = document.getElementById('training-graph-dialog') as HTMLElement;
  inputControls = document.getElementById('input-controls');
  layerControls = document.getElementById('layer-controls');
  rateInput = document.getElementById('rate-input') as HTMLSelectElement;
  momentumInput = document.getElementById('momentum-input') as HTMLInputElement;
  itersInput = document.getElementById('iters-input') as HTMLInputElement;
  projectSelect = document.getElementById('project-select') as HTMLSelectElement;
  saveProjectBtn = document.getElementById('save-project-btn') as HTMLButtonElement;
  loadProjectBtn = document.getElementById('load-project-btn') as HTMLButtonElement;
  editInTableBtn = document.getElementById('edit-in-table-btn') as HTMLButtonElement;
  trainingSetDataOutput = document.getElementById('training-set-data-output') as HTMLInputElement;
  trainingSetLabelsOutput = document.getElementById('training-set-neurons-output') as HTMLInputElement;
  mainDataHint = document.getElementById('main-data-hint');
  mainDataEditControls = document.getElementById('main-data-edit-controls');
  mainEditTrainSelectControl = document.getElementById('main-edit-train-select-control');
  mainEditTrainPercentInput = document.getElementById('main-edit-train-percent-input') as HTMLInputElement;
  mainDataDeleteAllOverlay = document.getElementById('main-data-delete-all-overlay');
  trainingSetInput = document.getElementById('training-set-input') as HTMLTextAreaElement;
  trainingDataEditorOverlay = document.getElementById('training-data-editor-overlay');
  trainingDataEditorError = document.getElementById('training-data-editor-error');
  dataAdjustArchitectureCheckbox = document.getElementById('data-adjust-architecture-checkbox') as HTMLInputElement;
  trainCurrentSampleBtn = document.getElementById('train-current-sample-btn') as HTMLButtonElement;
  trainOneEpochBtn = document.getElementById('train-one-epoch-btn') as HTMLButtonElement;
  runFullTrainingBtn = document.getElementById('run-full-training-btn') as HTMLButtonElement;
  stopFullTrainingBtn = document.getElementById('stop-full-training-btn') as HTMLButtonElement;
  continueTrainingBtn = document.getElementById('continue-training-btn') as HTMLButtonElement;
  closeTrainingGraphBtn = document.getElementById('close-training-graph-btn') as HTMLButtonElement;
  resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
  trainingEpochNotice = document.getElementById('training-epoch-notice');
  projectLoadingOverlay = document.getElementById('project-loading-overlay');
  randomWeightsBtn = document.getElementById('random-weights-btn') as HTMLButtonElement;
  setWeightsManuallyBtn = document.getElementById('set-weights-manually-btn') as HTMLButtonElement;
  saveWeightsBtn = document.getElementById('save-weights-btn') as HTMLButtonElement;
  testingResultsOverlay = document.getElementById('testing-results-overlay');
  testingResultsBody = document.getElementById('testing-results-body');
  testingResultsHeader = document.getElementById('testing-results-header');
  testingResultsTitle = document.getElementById('testing-results-title');
  testingResultsEmpty = document.getElementById('testing-results-empty');
  testingResultsSwitchBtn = document.getElementById('testing-results-switch-btn') as HTMLButtonElement;
  inspectHiddenBtn = document.getElementById('inspect-hidden-btn') as HTMLButtonElement;
  inspectOverlay = document.getElementById('inspect-overlay');
  inspectCanvas = document.getElementById('inspect-canvas') as HTMLCanvasElement;
  inspectCtx = inspectCanvas.getContext('2d');
  inspectLayerControls = document.getElementById('inspect-layer-controls');
  inspectPlotlyContainer = document.getElementById('inspect-plotly');

  testingInputHoverTooltip = document.createElement('div');
  testingInputHoverTooltip.className = 'testing-input-hover-tooltip';
  testingInputHoverCanvas = document.createElement('canvas');
  testingInputHoverCanvas.className = 'testing-input-hover-canvas';
  testingInputHoverTooltip.appendChild(testingInputHoverCanvas);
  document.body.appendChild(testingInputHoverTooltip);
  testingInputHoverCtx = testingInputHoverCanvas.getContext('2d');

  inspectHoverTooltip = document.createElement('div');
  inspectHoverTooltip.className = 'inspect-hover-tooltip';
  const inputTitle = document.createElement('div');
  inputTitle.className = 'inspect-hover-section-title';
  inputTitle.textContent = 'input';
  inspectHoverInputCanvas = document.createElement('canvas');
  inspectHoverInputCanvas.className = 'testing-input-hover-canvas';
  const targetTitle = document.createElement('div');
  targetTitle.className = 'inspect-hover-section-title target-title';
  targetTitle.textContent = 'target';
  inspectHoverTargetWrap = document.createElement('div');
  inspectHoverTooltip.appendChild(inputTitle);
  inspectHoverTooltip.appendChild(inspectHoverInputCanvas);
  inspectHoverTooltip.appendChild(targetTitle);
  inspectHoverTooltip.appendChild(inspectHoverTargetWrap);
  document.body.appendChild(inspectHoverTooltip);
  inspectHoverInputCtx = inspectHoverInputCanvas.getContext('2d');

  if (inspectCanvas) {
    inspectCanvas.addEventListener('mousemove', (event) => handleInspectCanvasHover(event));
    inspectCanvas.addEventListener('mouseleave', () => hideInspectHover());
  }

  document.addEventListener('pointerdown', (event) => {
    finishMainTableEditsOnExternalControlUse(event.target);
  }, true);

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') {
      return;
    }
    finishMainTableEditsOnExternalControlUse(event.target);
  }, true);

  visualizer = new Visualizer(canvas);
  itersInput.addEventListener('input', updateTrainButtonLabel);
  window.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key !== 'Escape') {
      return;
    }
    if (inspectOverlay && inspectOverlay.style.display !== 'none') {
      event.preventDefault();
      closeInspectOverlay();
      return;
    }
    if (!graphView || graphView.style.display === 'none') {
      return;
    }
    event.preventDefault();
    if (fullTrainingRunning) {
      stopFullTraining();
    } else {
      closeTrainingGraphOverlay();
    }
  });
  setTrainingGraphOverlayButtons(false, false);
  updateTrainButtonLabel();
  weightsPreviewInput = document.getElementById('weights-preview') as HTMLTextAreaElement;
  weightsEditorOverlay = document.getElementById('weights-editor-overlay');
  weightsEditorInput = document.getElementById('weights-editor-input') as HTMLTextAreaElement;
  weightsEditorError = document.getElementById('weights-editor-error');
  weightsAdjustArchitectureCheckbox = document.getElementById('weights-adjust-architecture-checkbox') as HTMLInputElement;
  weightsSaveOverlay = document.getElementById('weights-save-overlay');
  weightsSaveOutput = document.getElementById('weights-save-output') as HTMLTextAreaElement;
  projectSaveOverlay = document.getElementById('project-save-overlay');
  projectSaveOutput = document.getElementById('project-save-output') as HTMLTextAreaElement;
  projectEditorOverlay = document.getElementById('project-editor-overlay');
  projectEditorInput = document.getElementById('project-editor-input') as HTMLTextAreaElement;
  projectEditorError = document.getElementById('project-editor-error');
  editableDataOverlay = document.getElementById('editable-data-overlay');
  editableDataHeaders = document.getElementById('editable-data-headers');
  editableDataBody = document.getElementById('editable-data-body');
  editableDataError = document.getElementById('editable-data-error');
  editableTrainSelectControl = document.getElementById('editable-train-select-control');
  editableTrainPercentInput = document.getElementById('editable-train-percent-input') as HTMLInputElement;
  editablePixelEditorOverlay = document.getElementById('editable-pixel-editor-overlay');
  editablePixelOverlayTitle = document.getElementById('editable-pixel-overlay-title');
  editablePixelApplyBtn = document.getElementById('editable-pixel-apply-btn') as HTMLButtonElement;
  liveInputAddTestSampleControls = document.getElementById('live-input-add-test-controls');
  editablePixelEditorCanvas = document.getElementById('editable-pixel-editor-canvas') as HTMLCanvasElement;
  editablePixelEditorCtx = editablePixelEditorCanvas.getContext('2d');
  editablePixelUndoBtn = document.getElementById('pixel-tool-undo-btn') as HTMLButtonElement;
  editableTargetEditorCanvas = document.getElementById('editable-target-editor-canvas') as HTMLCanvasElement;
  editableTargetEditorCtx = editableTargetEditorCanvas.getContext('2d');
  editablePixelTargetLabelsEl = document.getElementById('editable-target-labels');
  editableTargetNumericWrap = document.getElementById('editable-target-numeric-wrap');
  editableSampleList = document.getElementById('editable-sample-list');
  editableActiveSampleTrainCheckbox = document.getElementById('editable-active-sample-train-checkbox') as HTMLInputElement;
  editablePixelEditorError = document.getElementById('editable-pixel-editor-error');
  editablePreviewTooltip = document.createElement('div');
  editablePreviewTooltip.className = 'editable-preview-tooltip';
  editablePreviewCanvas = document.createElement('canvas');
  editablePreviewCanvas.className = 'editable-preview-canvas';
  const previewHint = document.createElement('div');
  previewHint.className = 'editable-preview-hint';
  previewHint.textContent = 'click to edit';
  editablePreviewTooltip.appendChild(editablePreviewCanvas);
  editablePreviewTooltip.appendChild(previewHint);
  document.body.appendChild(editablePreviewTooltip);
  editablePreviewCtx = editablePreviewCanvas.getContext('2d');

  interfaceHelpTooltip = document.createElement('div');
  interfaceHelpTooltip.className = 'interface-help-tooltip';
  interfaceHelpTooltip.style.display = 'none';
  document.body.appendChild(interfaceHelpTooltip);
  bindInterfaceHelpTooltip('project-selector-help-btn', 'tt_project-selector-help');
  bindInterfaceHelpTooltip('architecture-help-btn', 'tt_architecture-help');
  bindInterfaceHelpTooltip('weights-help-btn', 'tt_weights-help');
  bindInterfaceHelpTooltip('data-help-btn', 'tt_data-help');
  bindInterfaceHelpTooltip('training-help-btn', 'tt_training-help');
  bindInterfaceHelpTooltip('testing-help-btn', 'tt_testing-help');
  bindInterfaceHelpTooltip('visualisation-help-btn', 'tt_visualisation-help');

  editablePixelEditorCanvas.addEventListener('mousedown', (event) => {
    editablePixelEditorMouseDown = true;
    editablePixelEditorMouseSurface = 'input';
    beginEditablePixelStroke();
    handlePixelEditorPointer(event.clientX, event.clientY);
  });
  editablePixelEditorCanvas.addEventListener('mousemove', (event) => {
    if (!editablePixelEditorMouseDown) {
      return;
    }
    if (editablePixelEditorTool === 'toggle') {
      return;
    }
    handlePixelEditorPointer(event.clientX, event.clientY);
  });
  editableTargetEditorCanvas.addEventListener('mousedown', (event) => {
    editablePixelEditorMouseDown = true;
    editablePixelEditorMouseSurface = 'target';
    handlePixelEditorTargetPointer(event.clientX, event.clientY);
  });
  editableTargetEditorCanvas.addEventListener('mousemove', (event) => {
    if (!editablePixelEditorMouseDown) {
      return;
    }
    if (editablePixelEditorTool === 'toggle') {
      return;
    }
    handlePixelEditorTargetPointer(event.clientX, event.clientY);
  });
  window.addEventListener('mouseup', () => {
    if (editablePixelEditorMouseSurface === 'input') {
      endEditablePixelStroke();
      applyLiveInputPreview();
    }
    editablePixelEditorMouseSurface = null;
    editablePixelEditorMouseDown = false;
  });
  window.addEventListener('keydown', (event: KeyboardEvent) => {
    if (!editablePixelEditorOverlay || editablePixelEditorOverlay.style.display === 'none') {
      return;
    }
    const target = event.target as HTMLElement | null;
    const isTextEditingTarget = !!target && (
      target.tagName === 'INPUT'
      || target.tagName === 'TEXTAREA'
      || target.isContentEditable
    );

    if (!isTextEditingTarget) {
      const key = event.key.toLowerCase();
      if ((event.metaKey || event.ctrlKey) && key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoPixelEditorStroke();
        return;
      }
      if (key === 't') {
        event.preventDefault();
        setPixelEditorTool('toggle');
        setPixelOutputEditMode('paint');
        return;
      }
      if (key === 'b') {
        event.preventDefault();
        setPixelEditorTool('black');
        setPixelOutputEditMode('paint');
        return;
      }
      if (key === 'w') {
        event.preventDefault();
        setPixelEditorTool('white');
        setPixelOutputEditMode('paint');
        return;
      }
      if (key === 'r') {
        event.preventDefault();
        resetPixelEditorInputs();
        return;
      }
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault();
      navigateEditablePixelSample(-1);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault();
      navigateEditablePixelSample(1);
    }
  });
  targetLabelsOverlay = document.getElementById('target-labels-overlay');
  targetLabelsBody = document.getElementById('target-labels-body');
  targetLabelsError = document.getElementById('target-labels-error');

  projectSelect.addEventListener('change', () => {
    loadPresetProject(projectSelect.value).catch((err) => {
      alert(err instanceof Error ? err.message : String(err));
    });
  });

  loadPresetProject('basic');
}
const initCore = (_loadDefaults = true) => {
  neuralCore = new NeuralCore(inputSize, hiddenSizes, outputSize);
  syncTargetLabelsWithOutputSize();

  // Set default values
  input = new Array(neuralCore.getInputSize());
  input.fill(1);

  neuralCore.evaluate(input);

  resetEpochHistory();

  selectedSampleIndex = neuralCore.getTrainingSamples().length > 0 ? 0 : -1;
  updateUI();
}

const updateUI = () => {
  ensureTrainingSamplesNotEmpty();

  if (inspectHiddenBtn) {
    const hasHiddenLayer = neuralCore.getHiddenLayerSizes().length > 0;
    inspectHiddenBtn.style.display = hasHiddenLayer ? 'inline-block' : 'none';
    if (!hasHiddenLayer && inspectOverlay && inspectOverlay.style.display !== 'none') {
      closeInspectOverlay();
    }
  }

  resizeCanvasToContainer();
  const currentCost = neuralCore.getCost();
  neuralCore.evaluate(input);
  const trainingSamples = neuralCore.getTrainingSamples();
  const selectedTargets = selectedSampleIndex >= 0 && selectedSampleIndex < trainingSamples.length
    ? trainingSamples[selectedSampleIndex].output
    : undefined;
  visualizer.draw(
    neuralCore.getNeurons(),
    neuralCore.getConnections(),
    selectedTargets,
    isManualInput,
    neuralCore.getIteration(),
    currentCost,
    targetLabels
  );

  let content = addLayerControlRow(
    'Layers',
    neuralCore.getLayerCnt().toString(),
    'addOrRemoveLayer(true)',
    'addOrRemoveLayer(false)',
    'layers',
    -1,
    2,
    5
  );


  content += addLayerControlRow(
    'Input size',
    neuralCore.getInputSize().toString(),
    'addOrRemoveNeuron(true, 0)',
    'addOrRemoveNeuron(false, 0)',
    'input',
    0,
    1
  );

  for (let i = 0; i < neuralCore.getLayerCnt() - 2; i++) {
    content += addLayerControlRow(
      'Hidden layer size',
      neuralCore.getHiddenLayerSizes()[i].toString(),
      `addOrRemoveNeuron(true, ${i + 1})`,
      `addOrRemoveNeuron(false, ${i + 1})`,
      'hidden',
      i + 1,
      1
    );
  }

  content += addLayerControlRow(
    'Output size',
    neuralCore.getOutputSize().toString(),
    `addOrRemoveNeuron(true, ${neuralCore.getLayerCnt() - 1})`,
    `addOrRemoveNeuron(false, ${neuralCore.getLayerCnt() - 1})`,
    'output',
    neuralCore.getLayerCnt() - 1,
    1,
    MAX_OUTPUTS
  );

  layerControls.innerHTML = content;

  updateWeightsPreview();

  if (!visualizer.getDrawableInputNeurons()) {
    visualizer.draw(
      neuralCore.getNeurons(),
      neuralCore.getConnections(),
      selectedTargets,
      isManualInput,
      neuralCore.getIteration(),
      neuralCore.getCost(),
      targetLabels
    );
  }


  const inputNeurons = visualizer.getDrawableInputNeurons();
  const spinnerElements = new Map<number, HTMLInputElement>();
  const spinnerLabelElements = new Map<number, HTMLSpanElement>();
  Array.from(inputControls.querySelectorAll('input[type="number"][data-neuron-id]')).forEach((el) => {
    const spinner = el as HTMLInputElement;
    const id = Number.parseInt(spinner.dataset.neuronId || '', 10);
    if (!Number.isNaN(id)) {
      spinnerElements.set(id, spinner);
    }
  });
  Array.from(inputControls.querySelectorAll('span[data-neuron-label-id]')).forEach((el) => {
    const label = el as HTMLSpanElement;
    const id = Number.parseInt(label.dataset.neuronLabelId || '', 10);
    if (!Number.isNaN(id)) {
      spinnerLabelElements.set(id, label);
    }
  });

  if (inputNeurons && inputNeurons.length) {
    const canvasOffsetX = canvas.getBoundingClientRect().left - inputControls.getBoundingClientRect().left;
    const liveColumnShiftPx = 30;
    const activeIds = new Set<number>();

    inputNeurons.forEach((neuron: DrawableNeuron) => {
      activeIds.add(neuron.id);

      let spinner = spinnerElements.get(neuron.id);
      if (!spinner) {
        spinner = document.createElement('input');
        spinner.type = 'number';
        spinner.min = '0';
        spinner.max = '1';
        spinner.step = '0.1';
        spinner.dataset.neuronId = neuron.id.toString();
        spinner.className = 'form-control form-control-sm';
        spinner.style.position = 'absolute';
        spinner.addEventListener('input', () => {
          const normalized = Math.max(0, Math.min(1, Number(spinner.value)));
          (window as any).slide(neuron.id, normalized);
        });
        spinner.addEventListener('change', () => {
          const normalized = Math.max(0, Math.min(1, Number(spinner.value)));
          spinner.value = normalized.toFixed(1);
          (window as any).slide(neuron.id, normalized);
        });
        spinner.addEventListener('mousedown', (event) => {
          if (spinner.dataset.liveOverlayTrigger !== '1') {
            return;
          }
          event.preventDefault();
          openLiveInputVisualOverlay();
        });
        spinner.addEventListener('focus', () => {
          if (spinner.dataset.liveOverlayTrigger !== '1') {
            return;
          }
          spinner.blur();
          openLiveInputVisualOverlay();
        });
        inputControls.appendChild(spinner);
        spinnerElements.set(neuron.id, spinner);
      }

      let shortLabel = spinnerLabelElements.get(neuron.id);
      if (!shortLabel) {
        shortLabel = document.createElement('span');
        shortLabel.dataset.neuronLabelId = neuron.id.toString();
        shortLabel.style.position = 'absolute';
        shortLabel.style.fontSize = '12px';
        shortLabel.style.fontWeight = '600';
        shortLabel.style.color = 'rgb(46, 40, 42)';
        shortLabel.style.pointerEvents = 'none';
        inputControls.appendChild(shortLabel);
        spinnerLabelElements.set(neuron.id, shortLabel);
      }

      const spinnerWidth = 74;
      const x = Math.round(canvasOffsetX + visualizer.getManualInputX() + liveColumnShiftPx - spinnerWidth / 2);
      const y = Math.round(neuron.y - 16);
      const truncatedInputView = neuralCore.getInputSize() > 25;
      spinner.style.left = `${x}px`;
      spinner.style.top = `${y}px`;
      spinner.dataset.liveOverlayTrigger = truncatedInputView ? '1' : '0';
      spinner.readOnly = truncatedInputView;
      spinner.style.cursor = truncatedInputView ? 'pointer' : 'text';
      spinner.title = truncatedInputView ? 'set input visually' : '';
      shortLabel.textContent = `i${neuron.id + 1}`;
      shortLabel.style.left = `${x - 24}px`;
      shortLabel.style.top = `${y + 6}px`;

      if (document.activeElement !== spinner) {
        spinner.value = neuron.activation.toFixed(1);
      }
    });

    spinnerElements.forEach((spinner, id) => {
      if (!activeIds.has(id)) {
        spinner.remove();
      }
    });
    spinnerLabelElements.forEach((label, id) => {
      if (!activeIds.has(id)) {
        label.remove();
      }
    });

    const eyeButtons = new Map<string, HTMLButtonElement>();
    Array.from(inputControls.querySelectorAll('button[data-live-input-eye-id]')).forEach((el) => {
      const eyeBtn = el as HTMLButtonElement;
      const id = eyeBtn.dataset.liveInputEyeId || '';
      if (id) {
        eyeButtons.set(id, eyeBtn);
      }
    });

    const upsertEyeButton = (id: string, x: number, y: number, compact = false) => {
      let eyeBtn = eyeButtons.get(id);
      if (!eyeBtn) {
        eyeBtn = document.createElement('button');
        eyeBtn.type = 'button';
        eyeBtn.className = `live-input-eye-btn${compact ? ' compact' : ''}`;
        eyeBtn.dataset.liveInputEyeId = id;
        eyeBtn.title = 'set input visually';
        eyeBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12C4.6 7.2 8.1 5 12 5C15.9 5 19.4 7.2 22 12C19.4 16.8 15.9 19 12 19C8.1 19 4.6 16.8 2 12Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"></path><circle cx="12" cy="12" r="3" fill="currentColor"></circle></svg>';
        eyeBtn.addEventListener('click', (event) => {
          event.preventDefault();
          openLiveInputVisualOverlay();
        });
        inputControls.appendChild(eyeBtn);
        eyeButtons.set(id, eyeBtn);
      }
      eyeBtn.style.left = `${Math.round(x)}px`;
      eyeBtn.style.top = `${Math.round(y)}px`;
      eyeBtn.classList.toggle('compact', compact);
      eyeBtn.classList.toggle('summary-bulk', id === 'summary-bulk');
    };

    upsertEyeButton('header', canvasOffsetX + visualizer.getManualInputX() + liveColumnShiftPx + 22, 12, false);

    let hasSummaryBulkEye = false;
    if (neuralCore.getInputSize() > 25) {
      const summaryNeurons = visualizer.getInputSummaryNeurons();
      if (summaryNeurons.length >= 3) {
        const midY = (summaryNeurons[1].y + summaryNeurons[2].y) / 2 - 42;
        upsertEyeButton('summary-bulk', canvasOffsetX + visualizer.getManualInputX() + liveColumnShiftPx - 42, midY, false);
        hasSummaryBulkEye = true;
      }
    }

    eyeButtons.forEach((eyeBtn, id) => {
      if (id === 'header') {
        return;
      }
      if (id === 'summary-bulk') {
        if (!hasSummaryBulkEye) {
          eyeBtn.remove();
        }
        return;
      }
      eyeBtn.remove();
    });
  } else {
    inputControls.innerHTML = '';
  }

  // Add training set data labels
  const mainDataLayout = getMainDataLayout();
  const renderSamples = getMainTableRenderSamples();
  const inputCount = neuralCore.getInputSize();
  if (inputCount <= 16) {
    inputColumnWindowStart = 0;
  } else {
    const maxWindowStart = Math.max(0, inputCount - 15);
    inputColumnWindowStart = Math.max(0, Math.min(maxWindowStart, inputColumnWindowStart));
  }
  const mainDataWrap = trainingSetDataOutput.closest('.main-data-table-wrap') as HTMLElement | null;
  const mainDataTable = trainingSetDataOutput.closest('.main-data-table') as HTMLElement | null;
  if (mainDataWrap) {
    mainDataWrap.style.overflowX = 'hidden';
    mainDataWrap.classList.toggle('main-data-edit-mode-active', mainTableEditMode);
    if (!mainDataWrap.dataset.mainDataVirtualBound) {
      mainDataWrap.addEventListener('scroll', () => {
        if (!neuralCore) {
          return;
        }
        const activeSamples = getMainTableRenderSamples();
        const activeLayout = getMainDataLayout();
        renderMainDataBody(activeSamples, activeLayout);
      });
      mainDataWrap.dataset.mainDataVirtualBound = '1';
    }
  }
  if (mainDataTable) {
    mainDataTable.classList.remove('main-data-center-mode');
  }

  trainingSetLabelsOutput.innerHTML = renderMainTableLabels({
    layout: mainDataLayout,
    samples: renderSamples,
    selectedSampleIndex,
    getTargetLabel,
    inputWindowStart: inputColumnWindowStart,
    editMode: mainTableEditMode,
  });

  mainDataVirtualActive = false;
  mainDataLastWindowStart = -1;
  mainDataLastWindowEnd = -1;
  mainDataLastWindowOffset = -1;
  mainDataLastSelectedSample = -1;
  renderMainDataBody(renderSamples, mainDataLayout, true);

  if (editInTableBtn) {
    editInTableBtn.textContent = mainTableEditMode ? 'finish edits' : 'edit in table';
  }
  if (mainDataHint) {
    mainDataHint.style.display = mainTableEditMode ? 'none' : 'block';
  }
  if (mainDataEditControls) {
    mainDataEditControls.style.display = mainTableEditMode ? 'flex' : 'none';
  }
  updateMainEditTrainSelectControlVisibility();

  // Add training data row scroll indicator
  if (mainDataWrap) {
    if (renderSamples.length > 10) {
      mainDataWrap.classList.add('table-rows-scroll');
    } else {
      mainDataWrap.classList.remove('table-rows-scroll');
    }
  }
}

type ArchitectureValueType = 'layers' | 'input' | 'hidden' | 'output';

const setArchitectureValue = (type: ArchitectureValueType, layerIdx: number, value: string) => {
  const parsedValue = Number.parseInt(value, 10);
  if (Number.isNaN(parsedValue)) {
    updateUI();
    return;
  }

  if (type === 'layers') {
    const targetLayerCount = Math.max(2, Math.min(5, parsedValue));
    const currentLayerCount = neuralCore.getLayerCnt();
    const delta = targetLayerCount - currentLayerCount;
    if (delta === 0) {
      updateUI();
      return;
    }

    for (let i = 0; i < Math.abs(delta); i++) {
      neuralCore.addOrRemoveLayer(delta > 0);
    }
    resetEpochHistory();
    updateUI();
    return;
  }

  const targetSize = type === 'output'
    ? Math.max(1, Math.min(MAX_OUTPUTS, parsedValue))
    : Math.max(1, parsedValue);
  let currentSize = 1;
  let effectiveLayerIdx = layerIdx;

  if (type === 'input') {
    currentSize = neuralCore.getInputSize();
    effectiveLayerIdx = 0;
  } else if (type === 'output') {
    currentSize = neuralCore.getOutputSize();
    effectiveLayerIdx = neuralCore.getLayerCnt() - 1;
  } else {
    currentSize = neuralCore.getHiddenLayerSizes()[layerIdx - 1] || 1;
  }

  const delta = targetSize - currentSize;
  if (delta === 0) {
    updateUI();
    return;
  }

  for (let i = 0; i < Math.abs(delta); i++) {
    neuralCore.addOrRemoveNeuron(delta > 0, effectiveLayerIdx);
  }

  if (type === 'input') {
    ensureTrainingSamplesNotEmpty();
    const trainingSamples = neuralCore.getTrainingSamples();
    if (trainingSamples.length > 0) {
      selectedSampleIndex = Math.min(Math.max(selectedSampleIndex, 0), trainingSamples.length - 1);
      input = trainingSamples[selectedSampleIndex].input.slice();
      isManualInput = false;
    }
  }

  if (type === 'output') {
    syncTargetLabelsWithOutputSize();
  }

  selectedSampleIndex = neuralCore.getTrainingSamples().length > 0 ? 0 : -1;
  isManualInput = false;
  resetEpochHistory();
  updateUI();
};

const addLayerControlRow = (
  label: string,
  size: string,
  onclickPos: string,
  onclickNeg: string,
  type: ArchitectureValueType,
  layerIdx: number,
  min: number,
  max?: number
): string => {
  const maxAttr = typeof max === 'number' ? ` max="${max}"` : '';
  const currentSize = Number.parseInt(size, 10);
  const plusDisabled = typeof max === 'number' && !Number.isNaN(currentSize) && currentSize >= max;
  const plusDisabledAttr = plusDisabled ? ' disabled' : '';
  const plusDisabledClass = plusDisabled ? ' disabled' : '';
  return `<tr><td align='right'><label>${label}:</label><b style="margin: auto 6px"><input type="number" class="architecture-size-input" min="${min}"${maxAttr} step="1" value="${size}" onchange="setArchitectureValue('${type}', ${layerIdx}, this.value)" onblur="setArchitectureValue('${type}', ${layerIdx}, this.value)"></b></td><td>
  <div class="btn-group" role="group">
    <button type="button" class="btn btn-secondary btn-sm" onclick="${onclickNeg}">-</button>
    <button type="button" class="btn btn-secondary btn-sm${plusDisabledClass}" onclick="${onclickPos}"${plusDisabledAttr}>+</button>
  </div></td></tr>`;
}