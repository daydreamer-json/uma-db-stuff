export default {
  getRandomHexHashStr: (bytesLength: number) =>
    [...crypto.getRandomValues(new Uint8Array(bytesLength))].map((b) => b.toString(16).padStart(2, '0')).join(''),
};
