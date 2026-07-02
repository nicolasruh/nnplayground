export type DataLabelMode = 'full' | 'compact';

export type DataScrollMode = 'none' | 'input-only' | 'input-target';

export type DataLayout = {
  labelMode: DataLabelMode;
  scrollMode: DataScrollMode;
  inputScrollable: boolean;
  targetScrollable: boolean;
  inputWidth?: number;
  targetWidth?: number;
  tableScrollable: boolean;
};

export const createDataLayout = (
  availableWidth: number,
  inputCount: number,
  targetCount: number,
  fixedColumnsWidth: number
): DataLayout => {
  const n = inputCount + targetCount;
  const minCellWidth = 46;
  const totalMinContentWidth = fixedColumnsWidth + n * minCellWidth;

  if (n < 19) {
    return {
      labelMode: 'compact',
      scrollMode: 'none',
      inputScrollable: false,
      targetScrollable: false,
      tableScrollable: totalMinContentWidth > availableWidth,
    };
  }

  const fixedRightWidth = fixedColumnsWidth + targetCount * minCellWidth;
  const remainingWidth = Math.max(0, availableWidth - fixedRightWidth);

  const minInputWidth = Math.max(180, Math.floor(availableWidth * 0.3));
  const inputWidth = Math.max(minInputWidth, remainingWidth);
  const tableScrollable = fixedRightWidth + inputWidth > availableWidth;

  return {
    labelMode: 'compact',
    scrollMode: 'input-only',
    inputScrollable: true,
    targetScrollable: false,
    inputWidth,
    tableScrollable,
  };
};
