export type TestingMode = 'train' | 'test';

export type TestingOverlayRow = {
  cost: number;
  isClassification: boolean;
  output: number[];
  target: number[];
};

export type TestingOverlayTexts = {
  switchButtonText: string;
  titleHtml: string;
  titleText: string;
};

export const getNextTestingMode = (mode: TestingMode): TestingMode => (
  mode === 'train' ? 'test' : 'train'
);

export const buildTestingOverlayTexts = (mode: TestingMode, rows: TestingOverlayRow[]): TestingOverlayTexts => {
  const avgError = rows.length > 0
    ? rows.reduce((sum, row) => sum + row.cost, 0) / rows.length
    : 0;
  const modeLabel = mode === 'train' ? 'train data' : 'test data';
  const sampleInfo = `${modeLabel}, ${rows.length} sample${rows.length === 1 ? '' : 's'}`;

  const switchButtonText = mode === 'train'
    ? 'test with test data'
    : 'test with train data';

  if (rows.length > 0) {
    const performanceParts = [`avg. error: ${avgError.toFixed(5)}`];
    const classificationRows = rows.filter((row) => row.isClassification && row.output.length === row.target.length && row.output.length > 0);

    if (classificationRows.length > 0) {
      const correctCount = classificationRows.reduce((sum, row) => {
        const predictedIdx = row.output.indexOf(Math.max(...row.output));
        const targetIdx = row.target.indexOf(Math.max(...row.target));
        return sum + (predictedIdx === targetIdx ? 1 : 0);
      }, 0);
      const correctPercent = (correctCount / classificationRows.length) * 100;
      performanceParts.push(`${correctPercent.toFixed(2)}% correct class`);
    }

    return {
      switchButtonText,
      titleHtml: `testing results (${sampleInfo})<span class="testing-average-error">Performance: ${performanceParts.join(' | ')}</span>`,
      titleText: `testing results (${sampleInfo})`,
    };
  }

  return {
    switchButtonText,
    titleHtml: '',
    titleText: `testing results (${sampleInfo})`,
  };
};
