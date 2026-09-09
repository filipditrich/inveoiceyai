const LOCAL_SIG = 0x04034b50;
const CENTRAL_SIG = 0x02014b50;
const EOCD_SIG = 0x06054b50;

const CRC_TABLE = buildCrcTable();

function buildCrcTable(): Uint32Array {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    table[i] = crc;
  }
  return table;
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number): Buffer {
  const buf = Buffer.allocUnsafe(2);
  buf.writeUInt16LE(value);
  return buf;
}

function u32(value: number): Buffer {
  const buf = Buffer.allocUnsafe(4);
  buf.writeUInt32LE(value);
  return buf;
}

export type ZipStoreEntry = {
  name: string;
  data: Uint8Array;
};

function localHeader(
  nameBytes: Buffer,
  checksum: number,
  size: number,
): Buffer {
  return Buffer.concat([
    u32(LOCAL_SIG),
    u16(20),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(checksum),
    u32(size),
    u32(size),
    u16(nameBytes.length),
    u16(0),
  ]);
}

function centralHeader(
  nameBytes: Buffer,
  checksum: number,
  size: number,
  localOffset: number,
): Buffer {
  return Buffer.concat([
    u32(CENTRAL_SIG),
    u16(20),
    u16(20),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(checksum),
    u32(size),
    u32(size),
    u16(nameBytes.length),
    u16(0),
    u16(0),
    u16(0),
    u16(0),
    u32(0),
    u32(localOffset),
  ]);
}

/**
 * Uncompressed ZIP (store). PDFs are already compressed; this only bundles.
 */
export function zipStore(files: readonly ZipStoreEntry[]): Uint8Array {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const nameBytes = Buffer.from(file.name, "utf8");
    const data = Buffer.from(
      file.data.buffer,
      file.data.byteOffset,
      file.data.byteLength,
    );
    const checksum = crc32(file.data);
    const size = data.length;
    locals.push(localHeader(nameBytes, checksum, size), nameBytes, data);
    centrals.push(centralHeader(nameBytes, checksum, size, offset), nameBytes);
    offset += 30 + nameBytes.length + size;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const eocd = Buffer.concat([
    u32(EOCD_SIG),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralSize),
    u32(offset),
    u16(0),
  ]);

  return new Uint8Array(Buffer.concat([...locals, ...centrals, eocd]));
}
