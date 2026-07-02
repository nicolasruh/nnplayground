import { Neuron } from "./Neuron";
import { Connection } from "./Connection";
import {
  TrainSample,
} from "./HelperObjects";

export class NeuralCore {
  private inputSize: number;
  private hiddenLayerSizes: number[];
  private outputSize: number;

  private layerCnt: number;

  private iterCnt = 0;

  private rate = 1;
  private momentum = 0;

  private biasNeuron = new Neuron('bias', true);
  private neurons: Neuron[][] = [];
  private connections: Connection[][] = [];

  private trainSamples: TrainSample[] = [];

  constructor(inputSize: number, hiddenLayerSizes: number[], outputSize: number) {
    this.inputSize = inputSize;
    this.hiddenLayerSizes = hiddenLayerSizes;
    this.outputSize = outputSize;
    this.layerCnt = hiddenLayerSizes.length + 2;

    // Reset
    this.neurons = [];
    this.connections = [];

    this.init();
  }

  private init() {
    // Create the neurons
    for (let l = 0; l < this.layerCnt; l++) {
      // How many neurons are in each layer?
      let neuronsInLayerCnt = 0;
      switch (l) {
        case 0:
          neuronsInLayerCnt = this.inputSize;
          break;
        case this.hiddenLayerSizes.length + 1:
          neuronsInLayerCnt = this.outputSize;
          break;
        default:
          neuronsInLayerCnt = this.hiddenLayerSizes[l - 1];
          break;
      }

      this.neurons[l] = [];

      // Create them
      for (let n = 0; n < neuronsInLayerCnt; n++) {
        this.neurons[l][n] = new Neuron(`Neuron${l}${n}`);
        if (l == 0) {
          this.neurons[l][n].setAsInputNeuron(0); // just to avoid crashes, the 0 should be overriden later 
        }
      }
    }

    // Create the Connections
    this.createConnections(0, this.layerCnt - 1);
  }

  public randomWeights() {
    this.connections.forEach(connPerLayer => {
      connPerLayer.forEach(conn => {
        conn.setWeight(Math.random() - 0.5);
        conn.resetLearningState();
      })
    });
  }

  private updateConnections(weights: number[][][]) {
    this.connections.forEach((connPerLayer, l) => {
      const nextLayerSize = this.neurons[l + 1].length;
      const weightsPerNeuron = this.neurons[l].length + 1;
      for (let neuron = 0; neuron < nextLayerSize; neuron++) {
        for (let weightIdx = 0; weightIdx < weightsPerNeuron; weightIdx++) {
          const connIdx = weightIdx + neuron * weightsPerNeuron;
          connPerLayer[connIdx].setWeight(weights[l][neuron][weightIdx]);
        }
      }
    })
  }

  private describeExpectedWeightsShape() {
    return this.neurons
      .slice(0, this.neurons.length - 1)
      .map((layer, idx) => `${idx === 0 ? 'input' : `layer ${idx}`} -> ${this.neurons[idx + 1].length} neurons x ${layer.length + 1} weights`)
      .join('; ');
  }

  private validateWeightsShape(weights: number[][][]) {
    if (!Array.isArray(weights) || weights.length !== this.layerCnt - 1) {
      throw `Weights JSON does not match the current architecture. Expected ${this.layerCnt - 1} layer matrices (${this.describeExpectedWeightsShape()}).`;
    }

    for (let l = 0; l < this.layerCnt - 1; l++) {
      const expectedNeuronCount = this.neurons[l + 1].length;
      const expectedWeightsPerNeuron = this.neurons[l].length + 1;
      if (!Array.isArray(weights[l]) || weights[l].length !== expectedNeuronCount) {
        throw `Weights JSON does not match layer ${l + 1}. Expected ${expectedNeuronCount} neurons in this layer, with ${expectedWeightsPerNeuron} weights each. Current architecture: ${this.describeExpectedWeightsShape()}.`;
      }

      for (let neuron = 0; neuron < weights[l].length; neuron++) {
        if (!Array.isArray(weights[l][neuron]) || weights[l][neuron].length !== expectedWeightsPerNeuron) {
          throw `Weights JSON does not match layer ${l + 1}, neuron ${neuron + 1}. Expected ${expectedWeightsPerNeuron} weights. Current architecture: ${this.describeExpectedWeightsShape()}.`;
        }
      }
    }
  }

  public getWeights() {
    return this.connections.map((connPerLayer, l) => {
      const previousLayerSize = this.neurons[l].length;
      const nextLayerSize = this.neurons[l + 1].length;
      const weightsPerNeuron = previousLayerSize + 1;
      const layerWeights: number[][] = [];

      for (let neuron = 0; neuron < nextLayerSize; neuron++) {
        const startIdx = neuron * weightsPerNeuron;
        const endIdx = startIdx + weightsPerNeuron;
        layerWeights.push(connPerLayer.slice(startIdx, endIdx).map((connection) => connection.getWeight()));
      }

      return layerWeights;
    });
  }

  public setWeights(weights: number[][][]) {
    this.validateWeightsShape(weights);
    this.updateConnections(weights);
    this.connections.forEach(connPerLayer => {
      connPerLayer.forEach(conn => conn.resetLearningState());
    });
  }


  public evaluate(input: number[]): number[] {

    if (input.length != this.inputSize) {
      throw 'Input size does not match';
    }
    // Reset, so each neuron is recalculated
    this.neurons.forEach(layer => {
      layer.forEach(neuron => neuron.reset())
    })
    // Set input layer
    this.neurons[0].forEach((neuron, idx) => {
      neuron.setInput(input[idx])
    });

    this.neurons[this.layerCnt - 1].forEach(neuron => {
      neuron.calculateActivation();
    });

    return this.neurons[this.layerCnt - 1].map(neuron => neuron.getActivation());
  }

  public evaluateWithActivations(input: number[]) {
    const output = this.evaluate(input);
    const hiddenLayers = this.neurons
      .slice(1, this.layerCnt - 1)
      .map((layer) => layer.map((neuron) => neuron.getActivation()));

    return {
      output: output.slice(),
      hiddenLayers,
    };
  }

  public addTrainingSet(input: number[], output: number[], trainSample = true) {
    if (input.length != this.inputSize) {
      throw 'Input size does not match';
    } else if (output.length != this.outputSize) {
      throw 'Output size does not match';
    }

    this.trainSamples.push(new TrainSample(input, output, trainSample))
  }

  public getCost(): number {
    const trainingSamples = this.trainSamples.filter((sample) => sample.trainSample);
    if (trainingSamples.length == 0) {
      return 0;
    }

    const costSum = trainingSamples.reduce((costSum, sample) => { // Add up all samples
      this.evaluate(sample.input);
      return costSum + this.neurons[this.layerCnt - 1].reduce((acc, neuron, i) => { // Add up all output neurons
        return acc + (neuron.getActivation() - sample.output[i]) ** 2;
      }, 0);
    }, 0);

    return 1 / 2 * costSum * (1 / trainingSamples.length);
  }

  public train() {
    const shuffledSamples = this.trainSamples.filter((sample) => sample.trainSample);
    for (let i = shuffledSamples.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = shuffledSamples[i];
      shuffledSamples[i] = shuffledSamples[j];
      shuffledSamples[j] = tmp;
    }

    shuffledSamples.forEach((sample) => {
      this.trainOnSample(sample.input, sample.output);
    });

    this.iterCnt++;
  }

  public trainOnSample(input: number[], output: number[]) {
    this.accumulateTrainingSample(input, output);
    this.applyAccumulatedWeightChanges();
  }

  private accumulateTrainingSample(input: number[], output: number[]) {
    this.evaluate(input)

    // Calculate sigmas of the last layer
    this.neurons[this.layerCnt - 1].forEach((neuron, idx) => {
      const activation = neuron.getActivation();
      const newSigma = (output[idx] - activation) * activation * (1 - activation);

      neuron.setSigma(newSigma);
    });

    // Calculate sigmas for each neuron in the lower layers
    for (let l = this.layerCnt - 2; l >= 0; l--) {
      this.neurons[l].forEach((neuron) => {
        const activation = neuron.getActivation();
        const newSigma =
          neuron.getOutputs().reduce((acc, connection) => {
            return acc + connection.getOutputNeuron().getSigma() * connection.getWeight();
          }, 0) * activation * (1 - activation);
        neuron.setSigma(newSigma);
      });
    }

    // Accumulate all weight updates
    this.connections.forEach((connLayer) => {
      connLayer.forEach((connection) => {
        const weightChange =
          connection.getOutputNeuron().getSigma() *
          connection.getInputNeuron().getActivation() *
          this.rate;

        connection.addSampleWeightChange(weightChange);
      });
    });
  }

  private applyAccumulatedWeightChanges() {
    this.connections.forEach((connLayer) => {
      connLayer.forEach((connection) => {
        connection.applyAverageWeightChangeWithMomentum(this.momentum);
      });
    });
  }

  public incrementIteration() {
    this.iterCnt++;
  }

  public addOrRemoveLayer(add: boolean) {
    if (add) {
      if (this.hiddenLayerSizes.length >= 3) {
        return;
      }

      const newLayerSize = 3;
      this.hiddenLayerSizes.push(newLayerSize);
      this.layerCnt++;

      // Create the new neurons
      this.createLayerOfNeurons(this.layerCnt - 2, newLayerSize);

      // Recreate the last layer
      this.createLayerOfNeurons(this.layerCnt - 1, this.outputSize);

      // Recreate all necessary connections
      this.createConnections(this.layerCnt - 3, this.layerCnt - 1);
    } else {
      if (this.layerCnt == 2) {
        return;
      }

      this.hiddenLayerSizes.pop();
      this.layerCnt--;
      this.neurons.pop();
      this.connections.pop();

      // Recreate the last layer
      this.createLayerOfNeurons(this.layerCnt - 1, this.outputSize);

      // Recreate all necessary connections
      this.createConnections(this.layerCnt - 2, this.layerCnt - 1);
    }
  }

  // This function is very long and ugly, I dont want to simply rebuild the network because I want to keep the weights
  public addOrRemoveNeuron(add: boolean, layerIdx: number) {
    const isInput = layerIdx == 0;
    const isOutput = layerIdx == this.layerCnt - 1;
    const isHidden = !isInput && !isOutput;

    const sizeChange = (add) ? 1 : -1

    if (isHidden) {
      this.hiddenLayerSizes[layerIdx - 1] += sizeChange;
    } else if (isInput) {
      this.inputSize += sizeChange;
      this.trainSamples = this.trainSamples.map((sample) => {
        const nextInput = sample.input.slice();
        if (add) {
          nextInput.push(1);
        } else if (nextInput.length > 0) {
          nextInput.pop();
        }
        return new TrainSample(nextInput, sample.output.slice(), sample.trainSample);
      });
    } else {
      this.outputSize += sizeChange;
      this.trainSamples = this.trainSamples.map((sample) => {
        const nextOutput = sample.output.slice();
        if (add) {
          nextOutput.push(0);
        } else if (nextOutput.length > 0) {
          nextOutput.pop();
        }
        return new TrainSample(sample.input.slice(), nextOutput, sample.trainSample);
      });
    }

    if (add) {
      let newNeuronIdx;

      if (isHidden) {
        newNeuronIdx = this.hiddenLayerSizes[layerIdx - 1] - 1;
      } else if (isInput) {
        newNeuronIdx = this.inputSize - 1;
      } else {
        newNeuronIdx = this.outputSize - 1;
      }

      const newNeuron = new Neuron(`Neuron${layerIdx}${newNeuronIdx}`);
      this.neurons[layerIdx][newNeuronIdx] = newNeuron;

      if (isInput)
        newNeuron.setAsInputNeuron(0);

      //// Add connections from the prev layer
      if (!isInput) {
        this.neurons[layerIdx - 1].forEach((neuron) => {
          const connection = new Connection(neuron, newNeuron);
          neuron.addOutput(connection);
          newNeuron.addInput(connection);
          this.connections[layerIdx - 1].push(connection);
        });
        // Dont forget the bias
        const connection = new Connection(this.biasNeuron, newNeuron);
        newNeuron.addInput(connection);
        this.connections[layerIdx - 1].push(connection);
      }

      if (!isOutput) {
        //// Add connections to the next layer
        this.neurons[layerIdx + 1].forEach((neuron) => {
          const connection = new Connection(newNeuron, neuron);
          neuron.addInput(connection);
          this.connections[layerIdx].push(connection);
        });
      }
    } else {
      const removedNeuron = this.neurons[layerIdx].pop();
      if (!removedNeuron) {
        return;
      }

      // Remove outputs from the prev layer
      if (!isInput) {
        this.neurons[layerIdx - 1].forEach((neuron) => {
          neuron.setOutputs(neuron.getOutputs().filter((connection) => {
            return connection.getOutputNeuron().getName() != removedNeuron.getName();
          }));
        });
      }

      // Remove input in the next layer
      if (!isOutput) {
        this.neurons[layerIdx + 1].forEach((neuron) => {
          neuron.setInputs(neuron.getInputs().filter((connection) => {
            return connection.getInputNeuron().getName() != removedNeuron.getName();
          }));
        });
      }

      // Remove the unused connections
      if (!isInput) {
        this.connections[layerIdx - 1] = this.connections[layerIdx - 1].filter((connection: Connection) => {
          return connection.getOutputNeuron().getName() != removedNeuron.getName();
        });
      }

      if (!isOutput) {
        this.connections[layerIdx] = this.connections[layerIdx].filter((connection: Connection) => {
          return connection.getInputNeuron().getName() != removedNeuron.getName();
        });
      }
    }
  }

  public reset() {
    this.iterCnt = 0;
    this.createConnections(0, this.layerCnt - 1);
  }

  private createLayerOfNeurons(layerIdx: number, layerSize: number) {
    this.neurons[layerIdx] = [];
    for (let i = 0; i < layerSize; i++) {
      this.neurons[layerIdx][i] = new Neuron(`Neuron${layerIdx}${i}`);
    }
  }

  private createConnections(firstLayer: number, lastLayer: number) {
    for (let l = firstLayer; l < lastLayer; l++) {
      // For each neuron in the layer add all connections to neurons in the next layer
      this.connections[l] = [];

      // Reset input & outputs
      this.neurons[l + 1].forEach(nextNeuron => {
        nextNeuron.resetInputs()
      });
      this.neurons[l].forEach(nextNeuron => {
        nextNeuron.resetOutputs()
      });

      this.neurons[l + 1].forEach((nextNeuron) => { // If you wonder why this cycles are switched, it's because of the bias
        this.neurons[l].forEach((currNeuron) => {
          const connection = new Connection(currNeuron, nextNeuron)
          currNeuron.addOutput(connection);
          nextNeuron.addInput(connection);
          this.connections[l].push(connection);
        });

        // Add bias neuron to each layer
        const biasConnection = new Connection(this.biasNeuron, nextNeuron);
        nextNeuron.addInput(biasConnection);
        this.connections[l].push(biasConnection);
      });
    }
  }

  public getNeurons() {
    return this.neurons;
  }

  public getConnections() {
    return this.connections;
  }

  public getInputSize() {
    return this.inputSize;
  }

  public getOutputSize() {
    return this.outputSize;
  }

  public getLayerCnt() {
    return this.layerCnt;
  }

  public getHiddenLayerSizes() {
    return this.hiddenLayerSizes;
  }

  public setRate(newRate: number) {
    this.rate = newRate;
  }

  public getIteration() {
    return this.iterCnt;
  }

  public setMomentum(momentum: number) {
    this.momentum = Math.max(0, Math.min(1, momentum));
  }

  public getTrainingSamples() {
    return this.trainSamples;
  }

  public setTrainingSamples(samples: TrainSample[]) {
    this.trainSamples = samples;
  }
}
