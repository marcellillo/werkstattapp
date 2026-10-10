// Minimaler ZIP-Schreiber (ohne Kompression, "stored"). Genügt für CSV-/JSON-/PDF-Pakete (PDFs sind ohnehin komprimiert)
// und kommt ohne Zusatzbibliothek aus. Dateinamen werden als UTF-8 gekennzeichnet (Umlaute bleiben erhalten).

const CRC_TABELLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

export function crc32(daten: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < daten.length; i++) c = CRC_TABELLE[(c ^ daten[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export interface ZipEintrag { name: string; daten: Uint8Array | string }

function dosZeit(d: Date) {
  const zeit = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)
  const tag = ((Math.max(d.getFullYear(), 1980) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return { zeit, tag }
}

/** Erzeugt den Inhalt einer ZIP-Datei. Namen mit "/" ergeben Ordner. Höchstens 65 535 Einträge und 4 GB (hier nie erreicht). */
export function zipErstellen(eintraege: ZipEintrag[], datum: Date = new Date()): Buffer {
  if (eintraege.length > 65535) throw new Error('Zu viele Dateien für ein ZIP')
  const { zeit, tag } = dosZeit(datum)
  const teile: Buffer[] = []
  const zentral: Buffer[] = []
  let offset = 0
  for (const e of eintraege) {
    const name = Buffer.from(e.name.replace(/\\/g, '/').replace(/^\/+/, ''), 'utf8')
    const daten = typeof e.daten === 'string' ? Buffer.from(e.daten, 'utf8') : Buffer.from(e.daten)
    const crc = crc32(daten)

    const lokal = Buffer.alloc(30)
    lokal.writeUInt32LE(0x04034b50, 0)
    lokal.writeUInt16LE(20, 4)        // benötigte Version
    lokal.writeUInt16LE(0x0800, 6)    // Bit 11: Name ist UTF-8
    lokal.writeUInt16LE(0, 8)         // Methode 0 = gespeichert
    lokal.writeUInt16LE(zeit, 10)
    lokal.writeUInt16LE(tag, 12)
    lokal.writeUInt32LE(crc, 14)
    lokal.writeUInt32LE(daten.length, 18)
    lokal.writeUInt32LE(daten.length, 22)
    lokal.writeUInt16LE(name.length, 26)
    lokal.writeUInt16LE(0, 28)
    teile.push(lokal, name, daten)

    const z = Buffer.alloc(46)
    z.writeUInt32LE(0x02014b50, 0)
    z.writeUInt16LE(20, 4)
    z.writeUInt16LE(20, 6)
    z.writeUInt16LE(0x0800, 8)
    z.writeUInt16LE(0, 10)
    z.writeUInt16LE(zeit, 12)
    z.writeUInt16LE(tag, 14)
    z.writeUInt32LE(crc, 16)
    z.writeUInt32LE(daten.length, 20)
    z.writeUInt32LE(daten.length, 24)
    z.writeUInt16LE(name.length, 28)
    z.writeUInt32LE(offset, 42)
    zentral.push(z, name)
    offset += 30 + name.length + daten.length
  }
  const zentralGroesse = zentral.reduce((s, b) => s + b.length, 0)
  const ende = Buffer.alloc(22)
  ende.writeUInt32LE(0x06054b50, 0)
  ende.writeUInt16LE(eintraege.length, 8)
  ende.writeUInt16LE(eintraege.length, 10)
  ende.writeUInt32LE(zentralGroesse, 12)
  ende.writeUInt32LE(offset, 16)
  return Buffer.concat([...teile, ...zentral, ende])
}
