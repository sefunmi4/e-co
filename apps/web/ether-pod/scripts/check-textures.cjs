#!/usr/bin/env node
const { promises: fs } = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(PROJECT_ROOT, 'public', 'assets');
const MAX_DIMENSION = 2048;
const TEXTURE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const COMPANION_EXTENSION = '.ktx2';

async function directoryExists(dir) {
  try {
    const stat = await fs.stat(dir);
    return stat.isDirectory();
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function listFilesRecursive(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFilesRecursive(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }

  return files;
}

async function validateTextures() {
  const errors = [];

  if (!(await directoryExists(ASSETS_DIR))) {
    return errors;
  }

  const files = await listFilesRecursive(ASSETS_DIR);

  for (const filePath of files) {
    const extension = path.extname(filePath).toLowerCase();

    if (!TEXTURE_EXTENSIONS.has(extension)) {
      continue;
    }

    const relativePath = path.relative(PROJECT_ROOT, filePath);
    const companionPath = filePath.slice(0, -extension.length) + COMPANION_EXTENSION;
    const companionRelative = path.relative(PROJECT_ROOT, companionPath);

    try {
      await fs.access(companionPath);
    } catch (error) {
      if (error && error.code === 'ENOENT') {
        errors.push(`• ${relativePath} is missing its ${COMPANION_EXTENSION} companion (${companionRelative}).`);
      } else {
        throw error;
      }
    }

    let width;
    let height;
    try {
      ({ width, height } = await getImageDimensions(filePath, extension));
    } catch (error) {
      errors.push(`• ${relativePath} could not be inspected: ${error.message}`);
      continue;
    }

    if (width && width > MAX_DIMENSION || height && height > MAX_DIMENSION) {
      errors.push(`• ${relativePath} is ${width || '?'}x${height || '?'} which exceeds the ${MAX_DIMENSION}px limit.`);
    }
  }

  return errors;
}

function ensureMinimumLength(buffer, length) {
  if (buffer.length < length) {
    throw new Error('file is truncated');
  }
}

function parsePngDimensions(buffer) {
  ensureMinimumLength(buffer, 24);
  const expectedSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const actualSignature = buffer.subarray(0, 8);
  if (!actualSignature.equals(expectedSignature)) {
    throw new Error('unexpected PNG signature');
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function parseJpegDimensions(buffer) {
  ensureMinimumLength(buffer, 4);
  if (buffer.readUInt16BE(0) !== 0xffd8) {
    throw new Error('missing JPEG SOI marker');
  }

  let offset = 2;
  while (offset + 4 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);

    if (length < 2) {
      throw new Error('invalid JPEG segment length');
    }

    const start = offset + 4;

    const isSofMarker =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isSofMarker) {
      if (start + 5 >= buffer.length) {
        throw new Error('invalid JPEG SOF segment');
      }
      const height = buffer.readUInt16BE(start + 1);
      const width = buffer.readUInt16BE(start + 3);
      return { width, height };
    }

    offset += 2 + length;
  }

  throw new Error('missing JPEG SOF marker');
}

function readUInt24LE(buffer, offset) {
  return buffer[offset] | (buffer[offset + 1] << 8) | (buffer[offset + 2] << 16);
}

function parseWebpDimensions(buffer) {
  ensureMinimumLength(buffer, 16);
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('unexpected WEBP header');
  }

  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkType = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (chunkStart + chunkSize > buffer.length) {
      throw new Error('invalid WEBP chunk size');
    }

    if (chunkType === 'VP8X') {
      if (chunkSize < 10) {
        throw new Error('invalid VP8X chunk');
      }
      const width = readUInt24LE(buffer, chunkStart + 4) + 1;
      const height = readUInt24LE(buffer, chunkStart + 7) + 1;
      return { width, height };
    }

    if (chunkType === 'VP8 ') {
      if (chunkSize < 10) {
        throw new Error('invalid VP8 chunk');
      }
      const signature = buffer.slice(chunkStart + 3, chunkStart + 6);
      if (signature[0] !== 0x9d || signature[1] !== 0x01 || signature[2] !== 0x2a) {
        throw new Error('invalid VP8 signature');
      }
      const width = buffer.readUInt16LE(chunkStart + 6) & 0x3fff;
      const height = buffer.readUInt16LE(chunkStart + 8) & 0x3fff;
      return { width, height };
    }

    if (chunkType === 'VP8L') {
      if (chunkSize < 5) {
        throw new Error('invalid VP8L chunk');
      }
      if (buffer[chunkStart] !== 0x2f) {
        throw new Error('invalid VP8L signature');
      }
      const data = buffer.readUInt32LE(chunkStart + 1);
      const width = (data & 0x3fff) + 1;
      const height = ((data >> 14) & 0x3fff) + 1;
      return { width, height };
    }

    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  throw new Error('missing WEBP dimension chunk');
}

async function getImageDimensions(filePath, extension) {
  const buffer = await fs.readFile(filePath);

  switch (extension) {
    case '.png':
      return parsePngDimensions(buffer);
    case '.jpg':
    case '.jpeg':
      return parseJpegDimensions(buffer);
    case '.webp':
      return parseWebpDimensions(buffer);
    default:
      throw new Error(`unsupported extension ${extension}`);
  }
}

async function main() {
  try {
    const errors = await validateTextures();
    if (errors.length > 0) {
      console.error('Texture validation failed for assets in public/assets:\n');
      for (const message of errors) {
        console.error(message);
      }
      console.error('\nSee docs/assets.md for remediation steps.');
      process.exitCode = 1;
      return;
    }
  } catch (error) {
    console.error('Unexpected error while validating textures:');
    console.error(error);
    process.exitCode = 1;
    return;
  }
}

main();
