/* 內建 QR Code 產生器（byte mode, UTF-8, 版本 1~40, 自動選版）
   演算法依 ISO/IEC 18004 實作，不依賴任何外部函式庫。 */
const QRCodeGen = (function () {
  const ECL = { L: 0, M: 1, Q: 2, H: 3 };
  const ECL_FORMAT_BITS = [1, 0, 3, 2]; // L, M, Q, H

  const ECC_CODEWORDS_PER_BLOCK = [
    [-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
    [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  ];
  const NUM_ECC_BLOCKS = [
    [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
    [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
    [-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
    [-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,57,60,63,66,70,74,77,81,84],
  ];

  function getNumRawDataModules(ver) {
    let result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }

  function getNumDataCodewords(ver, ecl) {
    return Math.floor(getNumRawDataModules(ver) / 8)
      - ECC_CODEWORDS_PER_BLOCK[ecl][ver] * NUM_ECC_BLOCKS[ecl][ver];
  }

  function getAlignmentPatternPositions(ver) {
    if (ver === 1) return [];
    const numAlign = Math.floor(ver / 7) + 2;
    const step = (ver === 32) ? 26
      : Math.ceil((ver * 4 + 4) / (numAlign * 2 - 2)) * 2;
    const result = [6];
    for (let pos = ver * 4 + 17 - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
    return result;
  }

  // ---- Reed-Solomon over GF(256), primitive polynomial 0x11D ----
  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xFF;
  }
  function rsDivisor(degree) {
    const result = new Uint8Array(degree);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < degree; j++) {
        result[j] = gfMul(result[j], root);
        if (j + 1 < degree) result[j] ^= result[j + 1];
      }
      root = gfMul(root, 0x02);
    }
    return result;
  }
  function rsRemainder(data, divisor) {
    const result = new Uint8Array(divisor.length);
    for (const b of data) {
      const factor = b ^ result[0];
      result.copyWithin(0, 1);
      result[result.length - 1] = 0;
      for (let i = 0; i < divisor.length; i++) result[i] ^= gfMul(divisor[i], factor);
    }
    return result;
  }

  function addEccAndInterleave(data, ver, ecl) {
    const numBlocks = NUM_ECC_BLOCKS[ecl][ver];
    const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl][ver];
    const rawCodewords = Math.floor(getNumRawDataModules(ver) / 8);
    const numShortBlocks = numBlocks - rawCodewords % numBlocks;
    const shortBlockLen = Math.floor(rawCodewords / numBlocks);
    const shortDataLen = shortBlockLen - blockEccLen;

    const blocks = [];
    const rsDiv = rsDivisor(blockEccLen);
    for (let i = 0, k = 0; i < numBlocks; i++) {
      const len = shortDataLen + (i < numShortBlocks ? 0 : 1);
      const dat = data.slice(k, k + len);
      k += len;
      const ecc = rsRemainder(dat, rsDiv);
      const blk = Array.from(dat);
      if (i < numShortBlocks) blk.push(0); // 佔位，稍後跳過
      blocks.push(blk.concat(Array.from(ecc)));
    }

    const result = [];
    for (let i = 0; i < blocks[0].length; i++) {
      for (let j = 0; j < blocks.length; j++) {
        if (i !== shortDataLen || j >= numShortBlocks) result.push(blocks[j][i]);
      }
    }
    return result;
  }

  function getBit(x, i) { return ((x >>> i) & 1) !== 0; }

  function encode(text, eclName) {
    let ecl = ECL[eclName || 'M'];
    const bytes = new TextEncoder().encode(text);

    // 選版本
    let ver = 1;
    for (; ver <= 40; ver++) {
      const capacityBits = getNumDataCodewords(ver, ecl) * 8;
      const ccBits = ver < 10 ? 8 : 16;
      if (4 + ccBits + bytes.length * 8 <= capacityBits) break;
    }
    if (ver > 40) throw new Error('資料太長，無法產生 QR Code');

    // 若空間充裕，自動提升容錯等級（不改變版本）
    for (const better of [ECL.M, ECL.Q, ECL.H]) {
      if (better > ecl) {
        const ccBits = ver < 10 ? 8 : 16;
        if (4 + ccBits + bytes.length * 8 <= getNumDataCodewords(ver, better) * 8) ecl = better;
      }
    }

    // 位元串
    const bb = [];
    const appendBits = (val, len) => { for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1); };
    appendBits(0b0100, 4);
    appendBits(bytes.length, ver < 10 ? 8 : 16);
    for (const b of bytes) appendBits(b, 8);

    const dataCapacityBits = getNumDataCodewords(ver, ecl) * 8;
    appendBits(0, Math.min(4, dataCapacityBits - bb.length));
    appendBits(0, (8 - bb.length % 8) % 8);
    for (let pad = 0xEC; bb.length < dataCapacityBits; pad ^= 0xEC ^ 0x11) appendBits(pad, 8);

    const dataCodewords = new Uint8Array(bb.length / 8);
    bb.forEach((bit, i) => { dataCodewords[i >>> 3] |= bit << (7 - (i & 7)); });

    const allCodewords = addEccAndInterleave(dataCodewords, ver, ecl);
    return buildMatrix(ver, ecl, allCodewords);
  }

  function buildMatrix(ver, ecl, codewords) {
    const size = ver * 4 + 17;
    const modules = Array.from({ length: size }, () => new Array(size).fill(false));
    const isFunc = Array.from({ length: size }, () => new Array(size).fill(false));

    const setFunc = (x, y, dark) => {
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      modules[y][x] = dark;
      isFunc[y][x] = true;
    };

    // 定位圖形 + 分隔
    const drawFinder = (x, y) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        setFunc(x + dx, y + dy, dist !== 2 && dist !== 4);
      }
    };
    // 時序圖形
    for (let i = 0; i < size; i++) { setFunc(6, i, i % 2 === 0); setFunc(i, 6, i % 2 === 0); }
    drawFinder(3, 3); drawFinder(size - 4, 3); drawFinder(3, size - 4);

    // 校正圖形
    const alignPos = getAlignmentPatternPositions(ver);
    for (let i = 0; i < alignPos.length; i++) {
      for (let j = 0; j < alignPos.length; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === alignPos.length - 1) || (i === alignPos.length - 1 && j === 0)) continue;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          setFunc(alignPos[j] + dx, alignPos[i] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }

    const drawFormatBits = (mask) => {
      const data = (ECL_FORMAT_BITS[ecl] << 3) | mask;
      let rem = data;
      for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      const bits = ((data << 10) | rem) ^ 0x5412;
      for (let i = 0; i <= 5; i++) setFunc(8, i, getBit(bits, i));
      setFunc(8, 7, getBit(bits, 6));
      setFunc(8, 8, getBit(bits, 7));
      setFunc(7, 8, getBit(bits, 8));
      for (let i = 9; i < 15; i++) setFunc(14 - i, 8, getBit(bits, i));
      for (let i = 0; i < 8; i++) setFunc(size - 1 - i, 8, getBit(bits, i));
      for (let i = 8; i < 15; i++) setFunc(8, size - 15 + i, getBit(bits, i));
      setFunc(8, size - 8, true);
    };
    drawFormatBits(0);

    if (ver >= 7) {
      let rem = ver;
      for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      const bits = (ver << 12) | rem;
      for (let i = 0; i < 18; i++) {
        const bit = getBit(bits, i);
        const a = size - 11 + i % 3, b = Math.floor(i / 3);
        setFunc(a, b, bit); setFunc(b, a, bit);
      }
    }

    // 填入資料位元
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!isFunc[y][x] && i < codewords.length * 8) {
            modules[y][x] = getBit(codewords[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }

    const maskFn = [
      (x, y) => (x + y) % 2 === 0,
      (x, y) => y % 2 === 0,
      (x, y) => x % 3 === 0,
      (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
      (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
      (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
      (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0,
    ];
    const applyMask = (mask) => {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        if (!isFunc[y][x] && maskFn[mask](x, y)) modules[y][x] = !modules[y][x];
      }
    };

    // 選最佳遮罩
    let bestMask = 0, minPenalty = Infinity;
    for (let mask = 0; mask < 8; mask++) {
      applyMask(mask); drawFormatBits(mask);
      const p = penalty(modules, size);
      if (p < minPenalty) { minPenalty = p; bestMask = mask; }
      applyMask(mask); // 還原
    }
    applyMask(bestMask);
    drawFormatBits(bestMask);

    return { size, modules };
  }

  function penalty(modules, size) {
    let result = 0;
    const N1 = 3, N2 = 3, N3 = 40, N4 = 10;

    const addHistory = (len, rh) => { if (rh[0] === 0) len += size; rh.pop(); rh.unshift(len); };
    const countPatterns = (rh) => {
      const n = rh[1];
      const core = n > 0 && rh[2] === n && rh[3] === n * 3 && rh[4] === n && rh[5] === n;
      return (core && rh[0] >= n * 4 && rh[6] >= n ? 1 : 0) + (core && rh[6] >= n * 4 && rh[0] >= n ? 1 : 0);
    };
    const terminate = (color, len, rh) => {
      if (color) { addHistory(len, rh); len = 0; }
      len += size;
      addHistory(len, rh);
      return countPatterns(rh);
    };

    for (let y = 0; y < size; y++) {
      let color = false, run = 0; const rh = [0, 0, 0, 0, 0, 0, 0];
      for (let x = 0; x < size; x++) {
        if (modules[y][x] === color) { run++; if (run === 5) result += N1; else if (run > 5) result++; }
        else { addHistory(run, rh); if (!color) result += countPatterns(rh) * N3; color = modules[y][x]; run = 1; }
      }
      result += terminate(color, run, rh) * N3;
    }
    for (let x = 0; x < size; x++) {
      let color = false, run = 0; const rh = [0, 0, 0, 0, 0, 0, 0];
      for (let y = 0; y < size; y++) {
        if (modules[y][x] === color) { run++; if (run === 5) result += N1; else if (run > 5) result++; }
        else { addHistory(run, rh); if (!color) result += countPatterns(rh) * N3; color = modules[y][x]; run = 1; }
      }
      result += terminate(color, run, rh) * N3;
    }
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
      const c = modules[y][x];
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) result += N2;
    }
    let dark = 0;
    for (const row of modules) for (const c of row) if (c) dark++;
    const total = size * size;
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += k * N4;
    return result;
  }

  return { encode };
})();
