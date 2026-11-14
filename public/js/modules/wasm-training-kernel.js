// Small development-only missing gradient kernel. TensorFlow.js WASM handles the
// remaining operations. Mathematical operation: sum rows by integer segment ID.
// Contract follows TF.js BackendWasm.makeOutput(shape,dtype,offset,values).
export function registerEmbeddingGradient(tf) {
  tf.registerKernel({ kernelName: 'UnsortedSegmentSum', backendName: 'wasm', kernelFunc: ({ inputs, attrs, backend }) => {
    const { x, segmentIds } = inputs;
    const count = attrs.numSegments;
    const width = x.shape.slice(1).reduce((a,b)=>a*b,1);
    const source = backend.readSync(x.dataId), ids = backend.readSync(segmentIds.dataId);
    const output = x.dtype === 'int32' ? new Int32Array(count*width) : new Float32Array(count*width);
    for(let row=0;row<x.shape[0];row++) {
      const id=ids[row]; if(id<0||id>=count)continue;
      for(let column=0;column<width;column++) output[id*width+column]+=source[row*width+column];
    }
    return backend.makeOutput([count,...x.shape.slice(1)],x.dtype,undefined,output);
  } });
}
