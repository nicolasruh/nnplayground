import type { DendrogramNode } from './inspectComputation';

export type InspectCanvasPoint = {
  nr: number;
  input: number[];
  target: number[];
  trainSample: boolean;
};

export type InspectCanvasMarker = {
  x: number;
  y: number;
  size: number;
  input: number[];
  target: number[];
};

type PlotRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

const getInspectPlotRect = (width: number, height: number): PlotRect => ({
  left: 70,
  right: width - 30,
  top: 30,
  bottom: height - 40,
  width: Math.max(10, width - 100),
  height: Math.max(10, height - 70),
});

const mapToPlot = (x: number, y: number, minX: number, maxX: number, minY: number, maxY: number, rect: PlotRect) => {
  const xDenom = Math.abs(maxX - minX) < 1e-9 ? 1 : (maxX - minX);
  const yDenom = Math.abs(maxY - minY) < 1e-9 ? 1 : (maxY - minY);
  const px = rect.left + ((x - minX) / xDenom) * rect.width;
  const py = rect.bottom - ((y - minY) / yDenom) * rect.height;
  return { x: px, y: py };
};

const drawInspectMarker = (ctx: CanvasRenderingContext2D, x: number, y: number, trainSample: boolean, color: string, hovered: boolean) => {
  const size = hovered ? 14 : 12;
  ctx.beginPath();
  if (trainSample) {
    ctx.arc(x, y, size, 0, 2 * Math.PI);
  } else {
    ctx.moveTo(x, y - size);
    ctx.lineTo(x - size, y + size);
    ctx.lineTo(x + size, y + size);
    ctx.closePath();
  }
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.lineWidth = 3;
  ctx.stroke();
  return size;
};

const drawInspectAxes = (ctx: CanvasRenderingContext2D, rect: PlotRect, xLabel: string, yLabel: string) => {
  ctx.strokeStyle = 'rgba(46, 40, 42, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(rect.left, rect.top, rect.width, rect.height);
  ctx.fillStyle = 'rgba(46, 40, 42, 0.8)';
  ctx.font = '12px sans-serif';
  ctx.fillText(xLabel, rect.right - 35, rect.bottom + 18);
  ctx.save();
  ctx.translate(rect.left - 46, rect.top + rect.height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
};

export const renderInspectPca2DCanvas = (args: {
  ctx: CanvasRenderingContext2D;
  canvasWidth: number;
  canvasHeight: number;
  projected: number[][];
  points: InspectCanvasPoint[];
  getFillColor: (point: InspectCanvasPoint) => string;
  getBorderColor: (point: InspectCanvasPoint) => string;
}): InspectCanvasMarker[] => {
  const { ctx, canvasWidth, canvasHeight, projected, points, getFillColor, getBorderColor } = args;
  if (projected.length === 0) {
    return [];
  }

  const rect = getInspectPlotRect(canvasWidth, canvasHeight);
  drawInspectAxes(ctx, rect, 'PC1', 'PC2');

  const minX = Math.min(...projected.map((p) => p[0]));
  const maxX = Math.max(...projected.map((p) => p[0]));
  const minY = Math.min(...projected.map((p) => p[1]));
  const maxY = Math.max(...projected.map((p) => p[1]));

  const markers: InspectCanvasMarker[] = [];
  projected.forEach((point, idx) => {
    const coords = mapToPlot(point[0], point[1], minX, maxX, minY, maxY, rect);
    const marker = points[idx];
    const size = drawInspectMarker(ctx, coords.x, coords.y, marker.trainSample, getFillColor(marker), false);
    ctx.strokeStyle = getBorderColor(marker);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(20, 20, 20, 0.92)';
    ctx.font = '11px sans-serif';
    ctx.fillText(`${marker.nr}`, coords.x + size + 2, coords.y + 3);
    markers.push({ x: coords.x, y: coords.y, size: size + 4, input: marker.input.slice(), target: marker.target.slice() });
  });

  return markers;
};

export const renderInspectNearestCanvas = (args: {
  ctx: CanvasRenderingContext2D;
  canvasWidth: number;
  canvasHeight: number;
  tree: DendrogramNode;
  subsetIndices: number[];
  allVectorCount: number;
  points: InspectCanvasPoint[];
  getFillColor: (point: InspectCanvasPoint) => string;
  getBorderColor: (point: InspectCanvasPoint) => string;
}): InspectCanvasMarker[] => {
  const { ctx, canvasWidth, canvasHeight, tree, subsetIndices, allVectorCount, points, getFillColor, getBorderColor } = args;
  const rect = getInspectPlotRect(canvasWidth, canvasHeight);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  ctx.fillStyle = 'rgba(46, 40, 42, 0.88)';
  ctx.font = '13px sans-serif';
  ctx.fillText('hierarchical clustering of hidden activations', rect.left, rect.top - 10);
  if (subsetIndices.length < allVectorCount) {
    ctx.fillStyle = 'rgba(46, 40, 42, 0.74)';
    ctx.font = '11px sans-serif';
    ctx.fillText(`showing random ${subsetIndices.length} of ${allVectorCount} samples`, rect.left, rect.top + 8);
  }

  const leaves = tree.leaves.slice();
  const yMap = new Map<number, number>();
  leaves.forEach((leafIdx, orderIdx) => {
    const y = rect.top + (orderIdx + 0.5) * (rect.height / Math.max(1, leaves.length));
    yMap.set(leafIdx, y);
  });

  ctx.font = '12px sans-serif';
  const markerLabelTexts = new Map<number, string>();
  let maxLabelWidth = 0;
  leaves.forEach((leafIdx) => {
    const sourceIdx = subsetIndices[leafIdx];
    const label = `sample ${points[sourceIdx].nr}`;
    markerLabelTexts.set(leafIdx, label);
    maxLabelWidth = Math.max(maxLabelWidth, ctx.measureText(label).width);
  });

  const markerRadius = 12;
  const markerTextGap = 15;
  const rightLabelReserve = Math.ceil(markerRadius * 2 + markerTextGap + maxLabelWidth + 14);
  const branchWidth = Math.max(120, rect.width - rightLabelReserve - 24);
  const leafTailLength = 18;
  const maxHeight = Math.max(tree.height, 1e-6);
  const xForHeight = (height: number) => rect.left + ((maxHeight - height) / maxHeight) * branchWidth;
  const leafXMap = new Map<number, number>();

  const drawNode = (node: DendrogramNode, parentX?: number): { x: number; y: number } => {
    if (!node.left || !node.right) {
      const leafIdx = node.leaves[0];
      const fallbackRight = rect.left + branchWidth;
      const x = Math.min(rect.left + branchWidth + leafTailLength, (parentX ?? fallbackRight) + leafTailLength);
      leafXMap.set(leafIdx, x);
      return { x, y: yMap.get(leafIdx) || rect.top };
    }

    const x = xForHeight(node.height);
    const leftPos = drawNode(node.left, x);
    const rightPos = drawNode(node.right, x);
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.88)';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(x, leftPos.y);
    ctx.lineTo(x, rightPos.y);
    ctx.moveTo(x, leftPos.y);
    ctx.lineTo(leftPos.x, leftPos.y);
    ctx.moveTo(x, rightPos.y);
    ctx.lineTo(rightPos.x, rightPos.y);
    ctx.stroke();

    ctx.fillStyle = 'rgba(46, 40, 42, 0.78)';
    ctx.font = '10px sans-serif';
    ctx.fillText(node.height.toFixed(2), x + 4, (leftPos.y + rightPos.y) / 2 - 2);
    return { x, y: (leftPos.y + rightPos.y) / 2 };
  };

  drawNode(tree);

  const markers: InspectCanvasMarker[] = [];
  leaves.forEach((leafIdx) => {
    const y = yMap.get(leafIdx) || rect.top;
    const x = leafXMap.get(leafIdx) || (rect.left + branchWidth + leafTailLength);
    const sourceIdx = subsetIndices[leafIdx];
    const point = points[sourceIdx];
    const size = drawInspectMarker(ctx, x, y, point.trainSample, getFillColor(point), false);
    ctx.strokeStyle = getBorderColor(point);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = 'rgba(20, 20, 20, 0.92)';
    ctx.font = '12px sans-serif';
    ctx.fillText(markerLabelTexts.get(leafIdx) || `sample ${point.nr}`, x + markerTextGap, y + 4);
    markers.push({ x, y, size: size + 5, input: point.input.slice(), target: point.target.slice() });
  });

  return markers;
};
