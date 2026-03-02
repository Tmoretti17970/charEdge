const fs = require('fs');
const path = require('path');

const png = fs.readFileSync(path.resolve('public', 'favicon.png'));

// ICO with embedded PNG (single entry — browsers render at any size)
const hdr = 6, de = 16, dOff = hdr + de;
const ico = Buffer.alloc(dOff + png.length);
ico.writeUInt16LE(0, 0);       // Reserved
ico.writeUInt16LE(1, 2);       // Type: ICO
ico.writeUInt16LE(1, 4);       // Image count
ico.writeUInt8(0, hdr);        // Width (0 = 256+)
ico.writeUInt8(0, hdr + 1);    // Height
ico.writeUInt8(0, hdr + 2);    // Palette
ico.writeUInt8(0, hdr + 3);    // Reserved
ico.writeUInt16LE(1, hdr + 4); // Planes
ico.writeUInt16LE(32, hdr + 6);// BPP
ico.writeUInt32LE(png.length, hdr + 8);
ico.writeUInt32LE(dOff, hdr + 12);
png.copy(ico, dOff);

fs.writeFileSync(path.resolve('public', 'favicon.ico'), ico);
console.log('Created favicon.ico (' + ico.length + ' bytes)');
