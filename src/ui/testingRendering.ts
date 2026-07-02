import { getTestingCorrectColor, getTestingSingleCostColor, isOneHotTarget } from './testingComputations';

type EscapeFn = (value: string) => string;
type TargetLabelFn = (index: number, short: boolean) => string;

const getTestingOutputFillColor = (value: number) => {
  const clamped = Math.max(0, Math.min(1, value));
  const alpha = Math.max(0.18, clamped);
  return `rgba(33, 100, 205, ${alpha})`;
};

const getTestingTargetFillColor = (value: number) => {
  const clamped = Math.max(0, Math.min(1, value));
  const shade = Math.round(clamped * 255);
  return `rgb(${shade}, ${shade}, ${shade})`;
};

const buildTestingChartTooltipRows = (
  values: number[],
  getTargetLabel: TargetLabelFn,
  escapeHtmlAttr: EscapeFn,
  getFillColor: (value: number) => string
) => values
  .map((value, idx) => {
    const label = escapeHtmlAttr(getTargetLabel(idx, false));
    const widthPercent = Math.max(0, Math.min(100, value * 100));
    return `<div class="testing-chart-tooltip-row"><span class="testing-chart-tooltip-label">${label}</span><div class="testing-chart-tooltip-bar-wrap"><div class="testing-chart-tooltip-bar" style="width:${widthPercent}%; background:${getFillColor(value)};"></div></div><span class="testing-chart-tooltip-value">${value.toFixed(5)}</span></div>`;
  })
  .join('');

const buildTestingBarCellHtml = (
  values: number[],
  getTargetLabel: TargetLabelFn,
  escapeHtmlAttr: EscapeFn,
  isTarget = false
) => {
  const fillColor = isTarget ? getTestingTargetFillColor : getTestingOutputFillColor;
  if (values.length <= 1) {
    const value = values.length === 1 ? values[0] : 0;
    const clamped = Math.max(0, Math.min(1, value));
    const textColor = isTarget && clamped < 0.55 ? '#ffffff' : undefined;
    const textColorStyle = textColor ? ` color:${textColor};` : '';
    return `<div class="testing-single-wrap"><div class="testing-single-bar-frame"><div class="testing-single-bar-fill" style="width:${clamped * 100}%; background:${fillColor(clamped)};"></div><span class="testing-single-value" style="${textColorStyle}">${value.toFixed(5)}</span></div><div class="testing-single-scale-labels"><span>0</span><span>1</span></div></div>`;
  }

  const bars = values
    .map((value) => {
      const clamped = Math.max(0, Math.min(1, value));
      return `<div class="testing-mini-bar" style="height:${clamped * 100}%; background:${fillColor(clamped)};"></div>`;
    })
    .join('');
  const tooltipRows = buildTestingChartTooltipRows(values, getTargetLabel, escapeHtmlAttr, fillColor);
  return `<div class="testing-multi-wrap"><span class="testing-mini-axis-label testing-mini-axis-top">1</span><span class="testing-mini-axis-label testing-mini-axis-bottom">0</span><div class="testing-multi-bars">${bars}</div><div class="testing-chart-tooltip">${tooltipRows}</div></div>`;
};

export const buildTestingOutputCellHtml = (values: number[], getTargetLabel: TargetLabelFn, escapeHtmlAttr: EscapeFn) =>
  buildTestingBarCellHtml(values, getTargetLabel, escapeHtmlAttr, false);

export const buildTestingTargetCellHtml = (values: number[], getTargetLabel: TargetLabelFn, escapeHtmlAttr: EscapeFn) =>
  buildTestingBarCellHtml(values, getTargetLabel, escapeHtmlAttr, true);

export const buildTestingCostCellHtml = (cost: number, isSingleOutput: boolean) => {
  if (isSingleOutput) {
    const bg = getTestingSingleCostColor(cost);
    return `<div class="testing-cost-box" style="background:${bg};">${cost.toFixed(5)}</div>`;
  }
  const normalized = Math.max(0, Math.min(1, cost));
  const bg = getTestingSingleCostColor(normalized);
  return `<div class="testing-cost-box" style="background:${bg};">${cost.toFixed(5)}</div>`;
};

export const buildTestingCorrectCellHtml = (output: number[], target: number[], getTargetLabel: TargetLabelFn, escapeHtmlAttr: EscapeFn): string => {
  const oneHot = isOneHotTarget(target);

  if (target.length === 1) {
    const diff = output[0] - target[0];
    const cost = diff * diff;
    const bg = getTestingCorrectColor(Math.min(1, cost));
    return `<div class="testing-correct-box" style="background:${bg};">${cost.toFixed(5)}</div>`;
  }

  if (oneHot) {
    const argmaxOutput = output.indexOf(Math.max(...output));
    const argmaxTarget = target.indexOf(1);
    const correct = argmaxOutput === argmaxTarget;
    const bg = correct ? 'rgb(34, 139, 34)' : 'rgb(205, 40, 40)';
    const confidence = output[argmaxOutput];
    const label = escapeHtmlAttr(getTargetLabel(argmaxOutput, true));
    return `<div class="testing-correct-box" style="background:${bg}; color:#fff;">${label} (${confidence.toFixed(2)})</div>`;
  }

  return '<div class="testing-correct-box" style="background:rgba(200,200,200,0.4);">–</div>';
};

export const getTestingModelText = (architectureParts: number[], currentEpoch: number) => `${architectureParts.join('x')} (${currentEpoch})`;

export const buildTestingModelCellHtml = (architectureParts: number[], currentEpoch: number, escapeHtmlAttr: EscapeFn) => {
  const label = escapeHtmlAttr(getTestingModelText(architectureParts, currentEpoch));
  return `<div class="testing-model-arrow"><div class="testing-model-arrow-shaft">${label}</div><div class="testing-model-arrow-head"></div></div>`;
};
