// Generates icon-192.png and icon-512.png using pure Node.js (no deps)
import { createDeflate } from 'zlib'
import { writeFileSync } from 'fs'
import { promisify } from 'util'
import { deflate } from 'zlib'

const deflateAsync = promisify(deflate)

function crc32(buf) {
  let crc = 0xffffffff
  for (const b of buf) {
    crc ^= b
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([t, data])
  const c = Buffer.alloc(4); c.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, c])
}

async function makePng(size, r, g, b) {
  // IHDR
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 2 // 8-bit RGB
  const ihdrChunk = chunk('IHDR', ihdr)

  // Raw scanlines: filter byte 0 + RGB pixels per row
  const row = Buffer.alloc(1 + size * 3)
  row[0] = 0 // filter: None
  for (let x = 0; x < size; x++) {
    row[1 + x * 3] = r; row[2 + x * 3] = g; row[3 + x * 3] = b
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row))
  const compressed = await deflateAsync(raw, { level: 6 })
  const idatChunk = chunk('IDAT', compressed)

  const iendChunk = chunk('IEND', Buffer.alloc(0))

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk])
}

// Orange #ea580c = rgb(234, 88, 12)
const png192 = await makePng(192, 234, 88, 12)
const png512 = await makePng(512, 234, 88, 12)

writeFileSync('public/icon-192.png', png192)
writeFileSync('public/icon-512.png', png512)
console.log('✓ public/icon-192.png and public/icon-512.png generated')
