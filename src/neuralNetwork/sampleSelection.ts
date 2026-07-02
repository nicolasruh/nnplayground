import { TrainSample } from './HelperObjects';

export const ensureSamplesNotEmpty = (
  samples: TrainSample[],
  inputSize: number,
  outputSize: number
) => {
  if (samples.length > 0) {
    return;
  }

  samples.push(
    new TrainSample(
      new Array(inputSize).fill(1),
      new Array(outputSize).fill(0),
      true
    )
  );
};

export const normalizePercent = (value: number, fallback = 80) => {
  const candidate = Number.isFinite(value) ? value : fallback;
  return Math.max(0, Math.min(100, candidate));
};

export const applyRandomTrainSelection = (samples: TrainSample[], percent: number) => {
  if (samples.length === 0) {
    return 0;
  }

  const selectedCount = Math.round((percent / 100) * samples.length);
  const indices = samples.map((_, idx) => idx);

  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }

  const selected = new Set(indices.slice(0, selectedCount));
  samples.forEach((sample, idx) => {
    sample.trainSample = selected.has(idx);
  });

  return selectedCount;
};
