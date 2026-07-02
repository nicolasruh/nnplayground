import { Neuron } from "./Neuron";

export class Connection {
  private weight: number;
  private inputNeuron: Neuron;
  private outputNeuron: Neuron;
  private sampleWeightChanges: number[] = [];
  private lastWeightChange = 0;

  constructor(input: Neuron, output: Neuron, weight?: number) {
    this.inputNeuron = input;
    this.outputNeuron = output;
    this.weight = weight || Math.random() - 0.5;
  }

  public addSampleWeightChange(weightChange: number) {
    this.sampleWeightChanges.push(weightChange);
  }

  public applyAverageWeightChange() {
    if (this.sampleWeightChanges.length === 0) {
      return;
    }

    const change = (this.sampleWeightChanges.reduce((acc, val) => acc + val, 0) / this.sampleWeightChanges.length);
    this.weight += change;
    this.sampleWeightChanges = [];
  }

  public applyAverageWeightChangeWithMomentum(momentum: number) {
    if (this.sampleWeightChanges.length === 0) {
      return;
    }

    const averageChange = this.sampleWeightChanges.reduce((acc, val) => acc + val, 0) / this.sampleWeightChanges.length;
    const momentumChange = momentum * this.lastWeightChange + averageChange;
    this.weight += momentumChange;
    this.lastWeightChange = momentumChange;
    this.sampleWeightChanges = [];
  }

  public resetLearningState() {
    this.sampleWeightChanges = [];
    this.lastWeightChange = 0;
  }

  public getWeight() {
    return this.weight;
  }

  public setWeight(weight: number) {
    this.weight = weight;
  }

  public calculateValue() {
    return this.weight * this.inputNeuron.calculateActivation();
  }

  public getOutputNeuron() {
    return this.outputNeuron;
  }

  public getInputNeuron() {
    return this.inputNeuron;
  }
}