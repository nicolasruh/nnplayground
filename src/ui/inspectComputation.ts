export type DendrogramNode = {
  id: number;
  left?: DendrogramNode;
  right?: DendrogramNode;
  leaves: number[];
  height: number;
};

const dotProduct = (a: number[], b: number[]) => a.reduce((sum, value, idx) => sum + value * (b[idx] || 0), 0);

const vectorNorm = (v: number[]) => Math.sqrt(dotProduct(v, v));

const normalizeVector = (v: number[]) => {
  const norm = vectorNorm(v);
  if (norm < 1e-12) {
    const fallback = new Array(v.length).fill(0);
    if (fallback.length > 0) {
      fallback[0] = 1;
    }
    return fallback;
  }
  return v.map((value) => value / norm);
};

const multiplyMatrixVector = (matrix: number[][], vector: number[]) => matrix.map((row) => dotProduct(row, vector));

export const projectPca = (data: number[][], componentCount: number) => {
  if (data.length === 0) {
    return [] as number[][];
  }

  const dim = data[0].length;
  if (dim === 0) {
    return data.map(() => new Array(componentCount).fill(0));
  }

  const mean = new Array(dim).fill(0);
  data.forEach((row) => {
    row.forEach((value, idx) => {
      mean[idx] += value;
    });
  });
  for (let idx = 0; idx < dim; idx++) {
    mean[idx] /= data.length;
  }

  const centered = data.map((row) => row.map((value, idx) => value - mean[idx]));
  const covariance = Array.from({ length: dim }, () => new Array(dim).fill(0));
  centered.forEach((row) => {
    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        covariance[i][j] += row[i] * row[j];
      }
    }
  });
  const denom = Math.max(1, centered.length - 1);
  for (let i = 0; i < dim; i++) {
    for (let j = 0; j < dim; j++) {
      covariance[i][j] /= denom;
    }
  }

  const components: number[][] = [];
  const maxComponents = Math.min(componentCount, dim);
  for (let componentIdx = 0; componentIdx < maxComponents; componentIdx++) {
    let vector = new Array(dim).fill(0).map((_, idx) => (idx === componentIdx ? 1 : 0));
    vector = normalizeVector(vector);

    for (let iteration = 0; iteration < 80; iteration++) {
      vector = normalizeVector(multiplyMatrixVector(covariance, vector));
    }

    const covTimesVector = multiplyMatrixVector(covariance, vector);
    const eigenvalue = dotProduct(vector, covTimesVector);
    components.push(vector.slice());

    for (let i = 0; i < dim; i++) {
      for (let j = 0; j < dim; j++) {
        covariance[i][j] -= eigenvalue * vector[i] * vector[j];
      }
    }
  }

  const projected = centered.map((row) => components.map((component) => dotProduct(row, component)));
  return projected.map((coords) => {
    const padded = coords.slice();
    while (padded.length < componentCount) {
      padded.push(0);
    }
    return padded;
  });
};

const squaredDistance = (a: number[], b: number[]) => {
  const len = Math.min(a.length, b.length);
  let sum = 0;
  for (let i = 0; i < len; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return sum;
};

const averageLinkageDistance = (clusterA: number[], clusterB: number[], vectors: number[][]) => {
  let sum = 0;
  let count = 0;
  clusterA.forEach((aIdx) => {
    clusterB.forEach((bIdx) => {
      sum += squaredDistance(vectors[aIdx], vectors[bIdx]);
      count += 1;
    });
  });
  return count === 0 ? 0 : sum / count;
};

export const buildDendrogram = (vectors: number[][]): DendrogramNode => {
  let nextId = vectors.length;
  let clusters: DendrogramNode[] = vectors.map((_, idx) => ({
    id: idx,
    leaves: [idx],
    height: 0,
  }));

  while (clusters.length > 1) {
    let bestI = 0;
    let bestJ = 1;
    let bestDist = Number.POSITIVE_INFINITY;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const dist = averageLinkageDistance(clusters[i].leaves, clusters[j].leaves, vectors);
        if (dist < bestDist) {
          bestDist = dist;
          bestI = i;
          bestJ = j;
        }
      }
    }

    const left = clusters[bestI];
    const right = clusters[bestJ];
    const merged: DendrogramNode = {
      id: nextId++,
      left,
      right,
      leaves: [...left.leaves, ...right.leaves],
      height: Math.sqrt(bestDist),
    };
    clusters = clusters.filter((_, idx) => idx !== bestI && idx !== bestJ);
    clusters.push(merged);
  }

  return clusters[0];
};

export const chooseRandomSubsetIndices = (totalCount: number, maxCount: number) => {
  const indices = Array.from({ length: totalCount }, (_, idx) => idx);
  for (let idx = indices.length - 1; idx > 0; idx--) {
    const swapIdx = Math.floor(Math.random() * (idx + 1));
    const tmp = indices[idx];
    indices[idx] = indices[swapIdx];
    indices[swapIdx] = tmp;
  }
  return indices.slice(0, maxCount);
};
