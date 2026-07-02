import { Neuron } from "./neuralNetwork/Neuron";
import { Connection } from "./neuralNetwork/Connection";

export class DrawableNeuron {
  public x: number;
  public y: number;
  public activation: number;
  public name: string;
  public isBias: boolean;
  public id: number;
  public isSummary: boolean;
  public showActivation: boolean;

  constructor(
    x: number,
    y: number,
    activation: number,
    name: string,
    id: number,
    isBias = false,
    isSummary = false,
    showActivation = true
  ) {
    this.x = x;
    this.y = y;
    this.activation = activation;
    this.name = name;
    this.isBias = isBias;
    this.id = id;
    this.isSummary = isSummary;
    this.showActivation = showActivation;
  }
}

export class Visualizer {

  private content: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private height: number;
  private width: number;
  private drawableNeurons: DrawableNeuron[] = [];
  private drawableInputNeurons: DrawableNeuron[] = [];
  private manualInputX = 0;
  private manualInputVisible: boolean;

  constructor(content: HTMLCanvasElement) {
    this.content = content;
    const context = content.getContext('2d');
    if (!context) {
      throw new Error('2D canvas context is not available.');
    }
    this.ctx = context;
    this.height = content.height;
    this.width = content.width;
    this.manualInputVisible = true;
  }

  public draw(
    neurons: Neuron[][],
    connections: Connection[][],
    targets?: number[],
    isManualInput = false,
    epochsTrained = 0,
    currentEpochCost = 0,
    targetLabels: string[] = []
  ) {
    this.width = this.content.width;
    this.height = this.content.height;
    this.ctx.clearRect(0, 0, this.width, this.height);

    this.drawableNeurons = [];
    this.drawableInputNeurons = [];
    const topPadding = 84;
    const bottomPadding = 88;
    const usableHeight = Math.max(80, this.height - topPadding - bottomPadding);
    const hasTargets = targets && targets.length > 0;
    const inputLayerTruncated = neurons.length > 0 && neurons[0].length > 25;
    this.manualInputVisible = true;
    const layerColumnOffset = 1;
    const columnCount = neurons.length + layerColumnOffset + (hasTargets ? 2 : 0);
    const columnWidth = this.width / columnCount;
    const columnCenter = (columnIdx: number) => columnWidth * (columnIdx + 0.5);
    this.manualInputX = columnCenter(0);
    const outputTargets: DrawableNeuron[] = [];
    let outputVirtualBiasY: number | null = null;
    const drawableNameMap = new Map<string, DrawableNeuron>();
    const summaryNameSet = new Set<string>();

    // (Labels are rendered after neuron layout so spacing matches positions)

    // Neurons
    neurons.forEach((layer, lIdx) => {
      const isOutputLayer = lIdx === neurons.length - 1;
      const x = columnCenter(lIdx + layerColumnOffset);
      const isTruncated = layer.length > 25;

      if (isTruncated) {
        const virtualStep = usableHeight / 9;

        layer.slice(0, 5).forEach((neuron, nIdx) => {
          const y = topPadding + virtualStep * (nIdx + 0.5);
          const drawableNeuron = new DrawableNeuron(x, y, neuron.getActivation(), neuron.getName(), nIdx);
          this.drawableNeurons.push(drawableNeuron);
          drawableNameMap.set(neuron.getName(), drawableNeuron);

          if (lIdx === 0) {
            this.drawableInputNeurons.push(drawableNeuron);
          }
          if (targets && isOutputLayer) {
            outputTargets.push(drawableNeuron);
          }
        });

        const hiddenNeurons = layer.slice(5);
        const summaryNodes: DrawableNeuron[] = [];
        const summaryStartY = topPadding + virtualStep * 5.75;
        const summaryStep = virtualStep / 2;
        for (let sIdx = 0; sIdx < 4; sIdx++) {
          const y = summaryStartY + summaryStep * sIdx;
          const summaryName = `summary-${lIdx}-${sIdx}`;
          const summaryNode = new DrawableNeuron(x, y, 0, summaryName, 1000 + sIdx, false, true, false);
          this.drawableNeurons.push(summaryNode);
          summaryNodes.push(summaryNode);
          summaryNameSet.add(summaryName);
        }

        hiddenNeurons.forEach((neuron, hiddenIdx) => {
          const bucket = Math.min(3, Math.floor((hiddenIdx * 4) / Math.max(1, hiddenNeurons.length)));
          drawableNameMap.set(neuron.getName(), summaryNodes[bucket]);
        });

        outputVirtualBiasY = topPadding + virtualStep * 8.5;
        if (!isOutputLayer) {
          const biasNode = new DrawableNeuron(x, outputVirtualBiasY, 1, `bias${lIdx}`, layer.length, true);
          this.drawableNeurons.push(biasNode);
          drawableNameMap.set(`bias${lIdx}`, biasNode);
        }
      } else {
        const visualCount = layer.length + 1;
        const step = usableHeight / Math.max(1, visualCount);

        layer.forEach((neuron, nIdx) => {
          const y = topPadding + step * (nIdx + 0.5);

          const drawableNeuron = new DrawableNeuron(x, y, neuron.getActivation(), neuron.getName(), nIdx);
          this.drawableNeurons.push(drawableNeuron);
          drawableNameMap.set(neuron.getName(), drawableNeuron);

          if (lIdx === 0) {
            this.drawableInputNeurons.push(drawableNeuron);
          }
          if (targets && isOutputLayer) {
            outputTargets.push(drawableNeuron);
          }
        });

        outputVirtualBiasY = topPadding + step * (layer.length + 0.5);

        if (!isOutputLayer) {
          const biasNode = new DrawableNeuron(x, outputVirtualBiasY, 1, `bias${lIdx}`, layer.length, true);
          this.drawableNeurons.push(biasNode);
          drawableNameMap.set(`bias${lIdx}`, biasNode);
        }
      }
    });

    // Connections
    connections.forEach((layer, lIdx) => {
      layer.forEach((connection) => {
        const inputNName =
          (connection.getInputNeuron().getIsBias()) ?
            `bias${lIdx}` :
            connection.getInputNeuron().getName();

        const inputDrawable = drawableNameMap.get(inputNName);
        const outputDrawable = drawableNameMap.get(connection.getOutputNeuron().getName());
        if (!inputDrawable || !outputDrawable) {
          return;
        }

        const isSummaryConnection = summaryNameSet.has(inputDrawable.name) || summaryNameSet.has(outputDrawable.name);

        this.drawConnection(
          inputDrawable,
          outputDrawable,
          connection.getWeight(),
          isSummaryConnection
        );
      });
    });

    this.drawableNeurons.forEach((neuron) => {
      this.drawNeuron(neuron);
    });

    // Top labels (render here so positions align with computed layout)
    this.ctx.fillStyle = `rgb(46, 40, 42, 1)`;
    this.ctx.font = `bold 14px sans-serif`;
    this.ctx.textAlign = 'center';
    const labelY = 28;
    if (this.manualInputVisible) {
      this.ctx.fillText('live', columnCenter(0), labelY);
    }

    neurons.forEach((layer, lIdx) => {
      const labelX = columnCenter(lIdx + layerColumnOffset);
      let label = '';
      if (lIdx === 0) label = 'input';
      else if (lIdx === neurons.length - 1) label = 'output';
      else label = `hidden${lIdx}`;
      this.ctx.fillText(label, labelX, labelY);
    });

    if (hasTargets) {
      const targetLabelX = columnCenter(neurons.length + layerColumnOffset);
      const costLabelX = columnCenter(neurons.length + layerColumnOffset + 1);
      this.ctx.globalAlpha = isManualInput ? 0.25 : 1.0;
      this.ctx.fillText('target', targetLabelX, labelY);
      this.ctx.fillText('error', costLabelX, labelY);
      this.ctx.globalAlpha = 1.0;
    }

    this.ctx.textAlign = 'start';

    if (hasTargets) {
      const boxWidth = 44;
      const boxHeight = 44;
      const targetColumnX = columnCenter(neurons.length + layerColumnOffset);
      const costColumnX = columnCenter(neurons.length + layerColumnOffset + 1);
      const outputLayer = neurons.length > 0 ? neurons[neurons.length - 1] : [];
      const sampleCost = outputLayer.reduce((acc, neuron, idx) => {
        const targetValue = targets[idx];
        if (typeof targetValue !== 'number') {
          return acc;
        }
        return acc + (neuron.getActivation() - targetValue) ** 2;
      }, 0);

      this.ctx.globalAlpha = isManualInput ? 0.25 : 1.0;
      outputTargets.forEach((neuron, idx) => {
        const targetValue = targets[idx];
        if (typeof targetValue !== 'number') {
          return;
        }
        const diff = Math.max(-1, Math.min(1, neuron.activation - targetValue));

        const targetLabel = targetLabels[idx] || `target ${idx + 1}`;
        this.ctx.fillStyle = isManualInput ? `rgba(120, 120, 120, 1)` : `rgb(46, 40, 42, 1)`;
        this.ctx.font = `11px sans-serif`;
        this.ctx.textAlign = 'center';
        this.ctx.fillText(targetLabel, targetColumnX, neuron.y - boxHeight / 2 - 6);

        this.drawTargetSquare(targetColumnX - boxWidth / 2, neuron.y - boxHeight / 2, boxWidth, boxHeight, 10, targetValue, isManualInput);
        this.drawDiffSquare(costColumnX - boxWidth / 2, neuron.y - boxHeight / 2, boxWidth, boxHeight, 10, diff, isManualInput);
      });

      const summaryAnchorY = outputVirtualBiasY != null
        ? outputVirtualBiasY
        : Math.min(this.height - 62, outputTargets.length > 0 ? outputTargets[outputTargets.length - 1].y + 42 : this.height - 62);
      const summaryLabelY = Math.min(this.height - 62, summaryAnchorY);
      const summaryValueY = Math.min(this.height - 38, summaryLabelY + 20);
      this.ctx.fillStyle = isManualInput ? `rgba(120, 120, 120, 1)` : `rgb(46, 40, 42, 1)`;
      this.ctx.font = `12px sans-serif`;
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`summed squares`, costColumnX, summaryLabelY);
      this.ctx.font = `bold 14px sans-serif`;
      this.ctx.fillText(sampleCost.toFixed(4), costColumnX, summaryValueY);
      this.ctx.textAlign = 'start';
      this.ctx.globalAlpha = 1.0;
    }

    this.ctx.fillStyle = `rgb(46, 40, 42, 1)`;
    this.ctx.font = `15px sans-serif`;
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`epochs trained: ${epochsTrained}`, 18, this.height - 14);
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`current error of an epoch: ${currentEpochCost.toFixed(6)}`, this.width - 18, this.height - 14);
    this.ctx.textAlign = 'start';
  }

  public getDrawableInputNeurons() {
    return this.drawableInputNeurons;
  }

  public getManualInputX() {
    return this.manualInputX;
  }

  public getInputSummaryNeurons() {
    return this.drawableNeurons.filter((neuron) => neuron.isSummary && neuron.name.startsWith('summary-0-'));
  }

  private drawNeuron(drawableNeuron: DrawableNeuron) {
    const radius = drawableNeuron.isSummary ? 12 : 25;

    // white background
    this.ctx.beginPath();
    this.ctx.arc(drawableNeuron.x, drawableNeuron.y, radius, 0, 2 * Math.PI);
    this.ctx.fillStyle = `rgb(255, 255, 255)`;
    this.ctx.fill();

    this.ctx.beginPath();
    if (drawableNeuron.isSummary)
      this.ctx.fillStyle = `rgba(170, 170, 170, 1)`;
    else if (drawableNeuron.isBias)
      this.ctx.fillStyle = `rgba(140, 140, 140, 1)`; // medium gray for bias nodes
    else
      this.ctx.fillStyle = `rgba(33, 100, 205, ${drawableNeuron.activation})`;
    this.ctx.strokeStyle = `rgb(46, 40, 42, 1)`;
    this.ctx.lineWidth = 1;
    this.ctx.arc(drawableNeuron.x, drawableNeuron.y, radius, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = `rgb(46, 40, 42, 1)`;
    const fontSize = drawableNeuron.isSummary ? 10 : 12;
    this.ctx.font = `bold ${fontSize}px sans-serif`;
    const text = drawableNeuron.showActivation ? Number(drawableNeuron.activation).toFixed(2) : '...';
    this.ctx.fillText(
      text,
      drawableNeuron.x - this.ctx.measureText(text).width / 2,
      drawableNeuron.y + fontSize / 3);
  }

  private drawTargetSquare(x: number, y: number, width: number, height: number, _radius: number, value: number, gray = false) {
    const clamped = Math.max(0, Math.min(1, value));
    const shade = Math.round(clamped * 255);
    const fillColor = `rgb(${shade}, ${shade}, ${shade})`;
    const strokeColor = `rgba(46, 40, 42, 1)`;

    this.ctx.fillStyle = fillColor;
    this.ctx.fillRect(x, y, width, height);
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

    const text = Number(value).toFixed(2);
    const fontSize = 12;
    const textColor = shade < 140 ? 'rgb(255, 255, 255)' : 'rgb(46, 40, 42)';
    this.ctx.fillStyle = gray ? 'rgba(120, 120, 120, 1)' : textColor;
    this.ctx.font = `bold ${fontSize}px`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(
      text,
      x + width / 2,
      y + height / 2
    );
    this.ctx.textBaseline = 'alphabetic';
  }

  private drawDiffSquare(x: number, y: number, width: number, height: number, _radius: number, value: number, gray = false) {
    const clamped = Math.max(-1, Math.min(1, value));
    const color = gray ? this.getGrayDiffColor(clamped) : this.getDiffColor(clamped);
    const strokeColor = `rgba(46, 40, 42, 1)`;

    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, width, height);
    this.ctx.strokeStyle = strokeColor;
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);

    const text = Number(value).toFixed(2);
    const fontSize = 12;
    this.ctx.fillStyle = gray ? `rgba(120, 120, 120, 1)` : `rgb(46, 40, 42, 1)`;
    this.ctx.font = `bold ${fontSize}px`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(
      text,
      x + width / 2,
      y + height / 2
    );
    this.ctx.textBaseline = 'alphabetic';
  }

  private getDiffColor(value: number) {
    const lightGreen = { r: 132, g: 206, b: 142 };
    const lightRed = { r: 236, g: 131, b: 123 };
    const absValue = Math.max(0, Math.min(1, Math.abs(value)));

    const mix = (from: { r: number; g: number; b: number }, to: { r: number; g: number; b: number }, t: number) => {
      const clampedT = Math.max(0, Math.min(1, t));
      const r = Math.round(from.r + (to.r - from.r) * clampedT);
      const g = Math.round(from.g + (to.g - from.g) * clampedT);
      const b = Math.round(from.b + (to.b - from.b) * clampedT);
      return { r, g, b };
    };

    const mixed = mix(lightGreen, lightRed, absValue);
    const alpha = 0.26 + absValue * 0.46;
    return `rgba(${mixed.r}, ${mixed.g}, ${mixed.b}, ${alpha.toFixed(3)})`;
  }

  private getGrayDiffColor(value: number) {
    const clamped = Math.max(-1, Math.min(1, value));
    const shade = Math.round(220 - 70 * Math.abs(clamped));
    const alpha = 0.22 + Math.abs(clamped) * 0.3;
    return `rgba(${shade}, ${shade}, ${shade}, ${alpha.toFixed(3)})`;
  }

  private drawConnection(inputNeuron: DrawableNeuron, outputNeuron: DrawableNeuron, weight: number, isSummaryConnection = false) {
    this.ctx.beginPath();
    if (isSummaryConnection) {
      this.ctx.lineWidth = 1;
      this.ctx.strokeStyle = `rgba(135, 135, 135, 0.8)`;
    } else {
      this.ctx.lineWidth = Math.max(1, Math.log(1.001 + Math.abs(weight)) * 2);
      this.ctx.strokeStyle = (weight > 0) ?
        `rgba(33, 100, 205, 1)` :
        `rgba(205, 83, 52, 1)`;
    }

    this.ctx.moveTo(inputNeuron.x, inputNeuron.y);
    this.ctx.lineTo(outputNeuron.x, outputNeuron.y);
    this.ctx.closePath();
    this.ctx.stroke();

    if (isSummaryConnection) {
      return;
    }

    // Draw connection weights
    // y = ax + c
    const a = (outputNeuron.y - inputNeuron.y) / (outputNeuron.x - inputNeuron.x)
    const c = outputNeuron.y - a * outputNeuron.x
    let x;
    const distanceFromOrigin = 100;
    if (inputNeuron.name.indexOf("bias") > -1) {
      x = inputNeuron.x + (distanceFromOrigin / Math.sqrt(1 + a ** 2))
    } else {
      x = outputNeuron.x - (distanceFromOrigin / Math.sqrt(1 + a ** 2))
    }
    const y = a * x + c;

    this.ctx.font = `8px sans-serif`;
    this.ctx.save();
    this.ctx.translate(x, y);
    this.ctx.rotate(Math.atan(a));
    this.ctx.fillText(Number(weight).toFixed(3), 0, 0);
    this.ctx.restore();
  }
}
