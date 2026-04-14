const textEncoder = new TextEncoder();

export interface ZipEntryInput {
  path: string;
  bytes: Uint8Array;
}

function buildCrc32Table() {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let crc = index;

    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) === 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }

    table[index] = crc >>> 0;
  }

  return table;
}

const crc32Table = buildCrc32Table();

function computeCrc32(bytes: Uint8Array) {
  let crc = 0xffffffff;

  for (let index = 0; index < bytes.length; index += 1) {
    crc = crc32Table[(crc ^ bytes[index]!) & 0xff]! ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function encodeDosTime(date: Date) {
  const seconds = Math.floor(date.getSeconds() / 2);
  const minutes = date.getMinutes();
  const hours = date.getHours();

  return (hours << 11) | (minutes << 5) | seconds;
}

function encodeDosDate(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();

  return ((year - 1980) << 9) | (month << 5) | day;
}

function writeUint16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value & 0xffff, true);
}

function writeUint32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value >>> 0, true);
}

function toBlobPart(bytes: Uint8Array) {
  return bytes.buffer instanceof ArrayBuffer
    ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    : new Uint8Array(bytes).buffer;
}

export async function createStoredZipBlob(
  entries: ZipEntryInput[],
  options?: { createdAt?: Date },
) {
  const createdAt = options?.createdAt ?? new Date();
  const dosTime = encodeDosTime(createdAt);
  const dosDate = encodeDosDate(createdAt);
  const fileParts: BlobPart[] = [];
  const centralDirectoryParts: BlobPart[] = [];
  let offset = 0;

  entries.forEach((entry) => {
    const pathBytes = textEncoder.encode(entry.path);
    const crc32 = computeCrc32(entry.bytes);
    const localHeader = new Uint8Array(30 + pathBytes.length);
    const localHeaderView = new DataView(localHeader.buffer);

    writeUint32(localHeaderView, 0, 0x04034b50);
    writeUint16(localHeaderView, 4, 20);
    writeUint16(localHeaderView, 6, 0);
    writeUint16(localHeaderView, 8, 0);
    writeUint16(localHeaderView, 10, dosTime);
    writeUint16(localHeaderView, 12, dosDate);
    writeUint32(localHeaderView, 14, crc32);
    writeUint32(localHeaderView, 18, entry.bytes.byteLength);
    writeUint32(localHeaderView, 22, entry.bytes.byteLength);
    writeUint16(localHeaderView, 26, pathBytes.length);
    writeUint16(localHeaderView, 28, 0);
    localHeader.set(pathBytes, 30);

    fileParts.push(localHeader, toBlobPart(entry.bytes));

    const centralHeader = new Uint8Array(46 + pathBytes.length);
    const centralHeaderView = new DataView(centralHeader.buffer);

    writeUint32(centralHeaderView, 0, 0x02014b50);
    writeUint16(centralHeaderView, 4, 20);
    writeUint16(centralHeaderView, 6, 20);
    writeUint16(centralHeaderView, 8, 0);
    writeUint16(centralHeaderView, 10, 0);
    writeUint16(centralHeaderView, 12, dosTime);
    writeUint16(centralHeaderView, 14, dosDate);
    writeUint32(centralHeaderView, 16, crc32);
    writeUint32(centralHeaderView, 20, entry.bytes.byteLength);
    writeUint32(centralHeaderView, 24, entry.bytes.byteLength);
    writeUint16(centralHeaderView, 28, pathBytes.length);
    writeUint16(centralHeaderView, 30, 0);
    writeUint16(centralHeaderView, 32, 0);
    writeUint16(centralHeaderView, 34, 0);
    writeUint16(centralHeaderView, 36, 0);
    writeUint32(centralHeaderView, 38, 0);
    writeUint32(centralHeaderView, 42, offset);
    centralHeader.set(pathBytes, 46);
    centralDirectoryParts.push(centralHeader);

    offset += localHeader.byteLength + entry.bytes.byteLength;
  });

  const centralDirectorySize = centralDirectoryParts.reduce(
    (total, part) => total + (part as Uint8Array).byteLength,
    0,
  );
  const endOfCentralDirectory = new Uint8Array(22);
  const endOfCentralDirectoryView = new DataView(endOfCentralDirectory.buffer);

  writeUint32(endOfCentralDirectoryView, 0, 0x06054b50);
  writeUint16(endOfCentralDirectoryView, 4, 0);
  writeUint16(endOfCentralDirectoryView, 6, 0);
  writeUint16(endOfCentralDirectoryView, 8, entries.length);
  writeUint16(endOfCentralDirectoryView, 10, entries.length);
  writeUint32(endOfCentralDirectoryView, 12, centralDirectorySize);
  writeUint32(endOfCentralDirectoryView, 16, offset);
  writeUint16(endOfCentralDirectoryView, 20, 0);

  return new Blob(
    [...fileParts, ...centralDirectoryParts, endOfCentralDirectory],
    { type: "application/zip" },
  );
}
