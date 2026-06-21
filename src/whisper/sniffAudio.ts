/** Sniff common audio container types from magic bytes. */
export function sniffAudioExtension(buf: Uint8Array | Buffer): string {
  if (buf.length >= 12) {
    const head = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
    const wave = String.fromCharCode(buf[8], buf[9], buf[10], buf[11]);
    if (head === 'RIFF' && wave === 'WAVE') return 'wav';
  }
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) {
    return 'webm';
  }
  if (buf.length >= 4) {
    const ogg = String.fromCharCode(buf[0], buf[1], buf[2], buf[3]);
    if (ogg === 'OggS') return 'ogg';
  }
  if (buf.length >= 3 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) {
    return 'mp3';
  }
  return 'webm';
}

export function mimeTypeForAudioExtension(ext: string): string {
  switch (ext) {
    case 'wav':
      return 'audio/wav';
    case 'ogg':
      return 'audio/ogg';
    case 'mp3':
      return 'audio/mpeg';
    default:
      return 'audio/webm';
  }
}
