export type TestingSortField = 'nr' | 'cost' | 'predicted';
export type TestingSortDirection = 'asc' | 'desc';

export type SortableTestingRow = {
  nr: number;
  cost: number;
  output: number[];
  isClassification: boolean;
};

export const getTestingCorrectColor = (value: number) => {
  // 0 = saturated green, 0.5 = white, 1 = saturated red
  const clamped = Math.max(0, Math.min(1, value));
  const green = { r: 34, g: 139, b: 34 };
  const white = { r: 255, g: 255, b: 255 };
  const red = { r: 205, g: 40, b: 40 };
  const mix = (a: {r:number;g:number;b:number}, b: {r:number;g:number;b:number}, t: number) => ({
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  });
  const color = clamped <= 0.5
    ? mix(green, white, clamped * 2)
    : mix(white, red, (clamped - 0.5) * 2);
  return `rgb(${color.r}, ${color.g}, ${color.b})`;
};

export const isOneHotTarget = (target: number[]) =>
  target.length > 1
  && target.filter((v) => v === 1).length === 1
  && target.filter((v) => v === 0).length === target.length - 1;

export const getTestingSingleCostColor = (value: number) => {
  // Single-target deviation is in [-1, 1].
  // 0 -> light green, |1| -> light red.
  const absValue = Math.max(0, Math.min(1, Math.abs(value)));
  const green = { r: 132, g: 206, b: 142 };
  const red = { r: 236, g: 131, b: 123 };
  const mix = (a: {r:number;g:number;b:number}, b: {r:number;g:number;b:number}, t: number) => ({
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  });

  const color = mix(green, red, absValue);
  const alpha = 0.24 + absValue * 0.44;

  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha.toFixed(3)})`;
};

export const getTestingActiveSortSelector = (field: TestingSortField, direction: TestingSortDirection) => {
  if (field === 'nr') {
    return direction === 'asc'
      ? `button[onclick=\"sortTestingResultsBy('nr', 'asc')\"]`
      : `button[onclick=\"sortTestingResultsBy('nr', 'desc')\"]`;
  }

  if (field === 'cost') {
    return direction === 'asc'
      ? `button[onclick=\"sortTestingResultsBy('cost', 'asc')\"]`
      : `button[onclick=\"sortTestingResultsBy('cost', 'desc')\"]`;
  }

  return direction === 'asc'
    ? `button[onclick=\"sortTestingResultsBy('predicted', 'asc')\"]`
    : `button[onclick=\"sortTestingResultsBy('predicted', 'desc')\"]`;
};

export const sortTestingRows = <T extends SortableTestingRow>(rows: T[], field: TestingSortField, direction: TestingSortDirection) => {
  const sorted = rows.slice();
  sorted.sort((a, b) => {
    if (field === 'nr') {
      return direction === 'asc' ? a.nr - b.nr : b.nr - a.nr;
    }

    if (field === 'predicted') {
      const predictedA = a.isClassification && a.output.length > 0 ? Math.max(...a.output) : Number.NEGATIVE_INFINITY;
      const predictedB = b.isClassification && b.output.length > 0 ? Math.max(...b.output) : Number.NEGATIVE_INFINITY;
      return direction === 'asc' ? predictedA - predictedB : predictedB - predictedA;
    }

    return direction === 'asc' ? a.cost - b.cost : b.cost - a.cost;
  });

  return sorted;
};
