import { TrainSample } from '../neuralNetwork/HelperObjects';
import { DataLayout } from './dataLayout';

export interface MainTableRenderOptions {
  layout: DataLayout;
  samples: TrainSample[];
  selectedSampleIndex: number;
  getTargetLabel: (idx: number, short: boolean) => string;
  inputWindowStart: number;
  rowOffset?: number;
  editMode?: boolean;
}

export const renderMainTableLabels = (options: MainTableRenderOptions): string => {
  const { samples, getTargetLabel, inputWindowStart, editMode = false } = options;
  const inputLabel = (idx: number) => `i${idx + 1}`;
  const targetLabel = (idx: number) => getTargetLabel(idx, true);
  const trainLabel = 'train?';
  const inputCount = samples.length > 0 ? samples[0].input.length : 1;
  const targetCount = samples.length > 0 ? samples[0].output.length : 1;
  const useInputWindow = inputCount > 16;
  const compactTargets = targetCount > 3;
  const visibleInputCount = useInputWindow ? 15 : inputCount;
  const maxWindowStart = Math.max(0, inputCount - visibleInputCount);
  const windowStart = useInputWindow
    ? Math.max(0, Math.min(maxWindowStart, inputWindowStart))
    : 0;
  const windowEnd = windowStart + visibleInputCount;
  const canShiftLeft = windowStart > 0;
  const canShiftRight = windowStart < maxWindowStart;

  let labels = '';
  labels += `<th scope='col' class="nr-col">nr.</th>`;
  labels += `<th scope='col' class="main-data-v-col"><span class="main-data-eye-icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 12C4.6 7.2 8.1 5 12 5C15.9 5 19.4 7.2 22 12C19.4 16.8 15.9 19 12 19C8.1 19 4.6 16.8 2 12Z" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.2" fill="#ffffff"/></svg></span></th>`;
  if (useInputWindow) {
    const leftDisabledAttr = canShiftLeft ? '' : ' disabled';
    const leftDisabledClass = canShiftLeft ? '' : ' disabled';
    labels += `<th scope='col' class="main-data-input-nav-col main-data-input-nav-left main-data-input-window-left"><button type="button" class="main-data-input-shift-btn${leftDisabledClass}" onclick="event.stopPropagation(); shiftMainInputColumns(-10)"${leftDisabledAttr}>&lt;</button></th>`;
  }
  for (let i = windowStart; i < windowEnd; i++) {
    labels += `<th scope='col' class="main-data-value-col main-data-input-col">${inputLabel(i)}</th>`;
  }
  if (useInputWindow) {
    const rightDisabledAttr = canShiftRight ? '' : ' disabled';
    const rightDisabledClass = canShiftRight ? '' : ' disabled';
    labels += `<th scope='col' class="main-data-input-nav-col main-data-input-nav-right main-data-input-window-right"><button type="button" class="main-data-input-shift-btn${rightDisabledClass}" onclick="event.stopPropagation(); shiftMainInputColumns(10)"${rightDisabledAttr}>&gt;</button></th>`;
  }
  for (let i = 0; i < targetCount; i++) {
    const targetCompactClass = compactTargets ? ' main-data-target-col-compact' : '';
    labels += `<th scope='col' class="main-data-value-col main-data-target-col${targetCompactClass}" style="text-align: right">${targetLabel(i)}</th>`;
  }
  labels += `<th scope='col' class="main-data-train-col" style="text-align: center">${trainLabel}</th>`;
  if (editMode) {
    labels += `<th scope='col' class="main-data-delete-col" style="text-align:center"><button type="button" class="main-data-delete-btn main-data-delete-all-btn" title="delete all" onclick="requestDeleteAllMainTableEditSamples()">&#128465;</button></th>`;
  }

  return labels;
};

export const renderMainTableData = (options: MainTableRenderOptions): string => {
  const { samples, selectedSampleIndex, inputWindowStart, rowOffset = 0, editMode = false } = options;
  const inputCount = samples.length > 0 ? samples[0].input.length : 1;
  const useInputWindow = inputCount > 16;
  const targetCount = samples.length > 0 ? samples[0].output.length : 1;
  const compactTargets = targetCount > 3;
  const visibleInputCount = useInputWindow ? 15 : inputCount;
  const maxWindowStart = Math.max(0, inputCount - visibleInputCount);
  const windowStart = useInputWindow
    ? Math.max(0, Math.min(maxWindowStart, inputWindowStart))
    : 0;
  const windowEnd = windowStart + visibleInputCount;

  let trainingData = '';
  samples.forEach((sample, localIdx) => {
    const idx = rowOffset + localIdx;
    const highlightStyle = (!editMode && selectedSampleIndex === idx) ? 'background-color: #e8f0ff;' : '';
    trainingData += `<tr style="cursor:${editMode ? 'default' : 'pointer'}; ${highlightStyle}" ${editMode ? '' : `onclick="applyTrainingSample(${idx})"`}>`;
    trainingData += `<td class="nr-col">${idx + 1}</td>`;
    const serializedInput = sample.input.join(',');
    trainingData += `<td class="main-data-v-col main-data-viz-cell" style="text-align:center" onclick="event.stopPropagation();"><canvas class="training-data-viz-canvas" data-values="${serializedInput}" onmouseenter="showTrainingDataPreview(${idx}, this)" onmouseleave="hideEditableDataPreview()" onclick="event.stopPropagation(); editMainTableRow(${idx})"></canvas></td>`;
    if (useInputWindow) {
      trainingData += `<td class="main-data-input-nav-col main-data-input-nav-left main-data-input-window-left"></td>`;
    }
    for (let i = windowStart; i < windowEnd; i++) {
      const value = i < sample.input.length ? sample.input[i] : '';
      if (editMode) {
        const shown = typeof value === 'number' ? String(value) : '';
        trainingData += `<td class="main-data-value-col main-data-input-col" onclick="event.stopPropagation();"><div class="main-inline-edit-wrap"><input class="main-inline-edit-input" type="number" min="0" max="1" step="0.1" value="${shown}" onfocus="focusMainTableCellInput(this)" onblur="blurMainTableCellInput(this, ${idx}, 'input', ${i})" onkeydown="handleMainTableCellInputKey(event, this, ${idx}, 'input', ${i})"></div></td>`;
      } else {
        trainingData += `<td class="main-data-value-col main-data-input-col">${value}</td>`;
      }
    }
    if (useInputWindow) {
      trainingData += `<td class="main-data-input-nav-col main-data-input-nav-right main-data-input-window-right"></td>`;
    }
    sample.output.forEach((val, outputIdx) => {
      const targetCompactClass = compactTargets ? ' main-data-target-col-compact' : '';
      if (editMode) {
        const shown = typeof val === 'number' ? String(val) : '';
        trainingData += `<td class="main-data-value-col main-data-target-col${targetCompactClass}" style="text-align: right" onclick="event.stopPropagation();"><div class="main-inline-edit-wrap"><input class="main-inline-edit-input" type="number" min="0" max="1" step="0.1" value="${shown}" onfocus="focusMainTableCellInput(this)" onblur="blurMainTableCellInput(this, ${idx}, 'output', ${outputIdx})" onkeydown="handleMainTableCellInputKey(event, this, ${idx}, 'output', ${outputIdx})"></div></td>`;
      } else {
        trainingData += `<td class="main-data-value-col main-data-target-col${targetCompactClass}" style="text-align: right">${val}</td>`;
      }
    });
    trainingData += `<td class="main-data-train-col" style="text-align: center" onclick="event.stopPropagation();"><input type="checkbox" ${sample.trainSample ? 'checked' : ''} onchange="${editMode ? `toggleMainTableEditTrainSample(${idx}, this.checked)` : `toggleTrainSample(${idx}, this.checked)`}"></td>`;
    if (editMode) {
      trainingData += `<td class="main-data-delete-col" style="text-align:center" onclick="event.stopPropagation();"><button type="button" class="main-data-delete-btn" title="delete" onclick="deleteMainTableEditSample(${idx})">&#128465;</button></td>`;
    }
    trainingData += '</tr>';
  });

  return trainingData;
};
