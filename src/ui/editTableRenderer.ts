import { TrainSample } from '../neuralNetwork/HelperObjects';
import { DataLayout } from './dataLayout';

export interface EditTableRenderOptions {
  layout: DataLayout;
  samples: TrainSample[];
  getTargetLabel: (idx: number, short: boolean) => string;
  clampValue: (v: number) => number;
}

export const renderEditTableHeaders = (options: EditTableRenderOptions): string => {
  const { layout, samples, getTargetLabel } = options;
  const inputCount = samples.length > 0 ? samples[0].input.length : 1;
  const targetCount = samples.length > 0 ? samples[0].output.length : 1;
  const labelForInput = (idx: number) => `i${idx + 1}`;
  const labelForTarget = (idx: number) => getTargetLabel(idx, true);
  const trainLabel = 'train?';
  const compactClass = 'group-compact';
  const groupStyleInputs = layout.inputScrollable && layout.inputWidth ? ` style="max-width:${layout.inputWidth}px;"` : '';
  const groupStyleTargets = layout.targetScrollable && layout.targetWidth ? ` style="max-width:${layout.targetWidth}px;"` : '';
  const inputHeaderId = 'input-header';
  const targetHeaderId = 'target-header';
  const inputColClass = layout.inputScrollable ? 'scroll-hint-col' : '';

  const inputSyncHandlers = (scrollId: string) => layout.inputScrollable
    ? ` data-scroll-id="${scrollId}" onscroll="syncEditableGroupScroll('input', this.scrollLeft, '${scrollId}')" onwheel="event.preventDefault(); this.scrollLeft += (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY); syncEditableGroupScroll('input', this.scrollLeft, '${scrollId}')"`
    : '';

  const targetSyncHandlers = (scrollId: string) => layout.targetScrollable
    ? ` data-scroll-id="${scrollId}" onscroll="syncEditableGroupScroll('target', this.scrollLeft, '${scrollId}')" onwheel="event.preventDefault(); this.scrollLeft += (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY); syncEditableGroupScroll('target', this.scrollLeft, '${scrollId}')"`
    : '';

  const inputHeaderLabels = new Array(inputCount).fill(0).map((_, idx) => `<span class="group-col-label">${labelForInput(idx)}</span>`).join('');
  const targetHeaderLabels = new Array(targetCount).fill(0).map((_, idx) => `<span class="group-col-label">${labelForTarget(idx)}</span>`).join('');

  let headers = '<th class="narrow-col nr-col">nr.</th>';
  headers += `<th class="${inputColClass}"><div class="group-label-strip group-input-group ${layout.inputScrollable ? 'group-scrollable group-scroll-header' : ''} ${compactClass}"${groupStyleInputs}${inputSyncHandlers(inputHeaderId)}>${inputHeaderLabels}</div></th>`;
  headers += '<th class="narrow-col">viz</th>';
  headers += `<th><div class="group-label-strip group-target-group ${layout.targetScrollable ? 'group-scrollable group-scroll-header' : ''} ${compactClass}"${groupStyleTargets}${targetSyncHandlers(targetHeaderId)}>${targetHeaderLabels}</div></th>`;
  headers += `<th class="train-col">${trainLabel}</th><th class="narrow-col">delete</th>`;

  return headers;
};

export const renderEditTableBody = (options: EditTableRenderOptions): string => {
  const { layout, samples, getTargetLabel, clampValue } = options;
  const inputCount = samples.length > 0 ? samples[0].input.length : 1;
  const targetCount = samples.length > 0 ? samples[0].output.length : 1;
  const compactClass = 'group-compact';
  const wheelGuard = ' onwheel="event.preventDefault();"';
  const groupStyleInputs = layout.inputScrollable && layout.inputWidth ? ` style="max-width:${layout.inputWidth}px;"` : '';
  const groupStyleTargets = layout.targetScrollable && layout.targetWidth ? ` style="max-width:${layout.targetWidth}px;"` : '';
  const inputColClass = layout.inputScrollable ? 'scroll-hint-col' : '';

  const inputSyncHandlers = (scrollId: string) => layout.inputScrollable
    ? ` data-scroll-id="${scrollId}" onscroll="syncEditableGroupScroll('input', this.scrollLeft, '${scrollId}')" onwheel="event.preventDefault(); this.scrollLeft += (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY); syncEditableGroupScroll('input', this.scrollLeft, '${scrollId}')"`
    : '';

  const targetSyncHandlers = (scrollId: string) => layout.targetScrollable
    ? ` data-scroll-id="${scrollId}" onscroll="syncEditableGroupScroll('target', this.scrollLeft, '${scrollId}')" onwheel="event.preventDefault(); this.scrollLeft += (Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY); syncEditableGroupScroll('target', this.scrollLeft, '${scrollId}')"`
    : '';

  let rows = '';
  samples.forEach((sample, rowIdx) => {
    rows += '<tr>';
    rows += `<td class="narrow-col nr-col">${rowIdx + 1}</td>`;

    const inputEditors = sample.input.map((value, valueIdx) => {
      const inputId = `editable-input-${rowIdx}-${valueIdx}`;
      return `<input id="${inputId}" type="number" min="0" max="1" step="0.1" value="${value.toFixed(1)}"${wheelGuard} onchange="const normalized = Math.round(Math.max(0, Math.min(1, Number(this.value))) * 10) / 10; updateEditableDataValue(${rowIdx}, 'input', ${valueIdx}, normalized); this.value = normalized.toFixed(1);">`;
    }).join('');
    rows += `<td class="${inputColClass}"><div class="group-input-strip group-input-group ${layout.inputScrollable ? 'group-scrollable' : ''} ${compactClass}"${groupStyleInputs}${inputSyncHandlers(`input-row-${rowIdx}`)}>${inputEditors}</div></td>`;

    rows += `<td class="narrow-col" style="text-align:center"><button type="button" class="main-data-eye-btn" title="viz" onmouseenter="showEditableDataPreview(${rowIdx}, this)" onmouseleave="hideEditableDataPreview()" onclick="editEditableDataRow(${rowIdx})">&#128065;</button></td>`;

    const targetEditors = sample.output.map((value, valueIdx) => {
      return `<input type="number" min="0" max="1" step="0.1" value="${value.toFixed(1)}"${wheelGuard} onchange="const normalized = Math.round(Math.max(0, Math.min(1, Number(this.value))) * 10) / 10; updateEditableDataValue(${rowIdx}, 'output', ${valueIdx}, normalized); this.value = normalized.toFixed(1);">`;
    }).join('');
    rows += `<td><div class="group-input-strip group-target-group ${layout.targetScrollable ? 'group-scrollable' : ''} ${compactClass}"${groupStyleTargets}${targetSyncHandlers(`target-row-${rowIdx}`)}>${targetEditors}</div></td>`;

    rows += `<td class="train-col" style="text-align:center"><input type="checkbox" ${sample.trainSample ? 'checked' : ''} onchange="toggleEditableDataTrainSample(${rowIdx}, this.checked)"></td>`;
    rows += `<td class="narrow-col" style="text-align:center"><button type="button" class="btn btn-outline-danger btn-sm editable-action-btn" title="delete" onclick="deleteEditableDataSample(${rowIdx})">&#128465;</button></td>`;
    rows += '</tr>';
  });

  return rows;
};
