/**
 * getWebAudioNode
 *
 * A wrapper to create an AudioNode and apply a filter for frame extraction
 * Copyright (c) Adrian Holovary https://github.com/adrianholovaty
 *
 * @param context - AudioContext
 * @param filter - Object containing an 'extract()' method
 * @param bufferSize - units of sample frames (256, 512, 1024, 2048, 4096, 8192, 16384)
 * @returns {ScriptProcessorNode}
 */
const getWebAudioNode = function (context, filter, bufferSize) {
    const BUFFER_SIZE = bufferSize || 4096;
    const node = context.createScriptProcessor(BUFFER_SIZE, 2, 2);
    const samples = new Float32Array(BUFFER_SIZE * 2);

    node.onaudioprocess = (event) => {
        let left = event.outputBuffer.getChannelData(0);
        let right = event.outputBuffer.getChannelData(1);
        let framesExtracted = filter.extract(samples, BUFFER_SIZE);
        if (framesExtracted === 0) {
            filter.onEnd();
        }
        let i = 0;
        for (; i < framesExtracted; i++) {
            left[i] = samples[i * 2];
            right[i] = samples[i * 2 + 1];
        }
    };
    return node;
};

export default getWebAudioNode;