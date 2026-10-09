import sharp from "sharp";
import fs from "fs";

async function main() {
  console.log("Reading original base icon...");
  const origSvg = fs.readFileSync("scripts/original-icon.svg", "utf8");
  const match = origSvg.match(/data:image\/png;base64,([^"]+)/);
  if (!match) throw new Error("Could not find base64 image in scripts/original-icon.svg");
  
  const rawBuf = Buffer.from(match[1], "base64");
  const originalImg = await sharp(rawBuf).raw().toBuffer({ resolveWithObject: true });
  const origRaw = originalImg.data;
  
  // Extract pure fish alpha mask based on linear color distance from background #0f4c81 (15, 76, 129)
  // Fish bounding box in 512x512: left: 98, top: 158, width: 316, height: 196
  const cropL = 98, cropT = 158, cropW = 316, cropH = 196;
  const croppedRaw = Buffer.alloc(cropW * cropH * 4);
  
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const origIdx = ((cropT + y) * 512 + (cropL + x)) * 4;
      const r = origRaw[origIdx];
      const g = origRaw[origIdx + 1];
      const b = origRaw[origIdx + 2];
      
      const aR = Math.max(0, Math.min(1, (r - 15) / 240));
      const aG = Math.max(0, Math.min(1, (g - 76) / 179));
      const aB = Math.max(0, Math.min(1, (b - 129) / 126));
      let a = (aR + aG + aB) / 3;
      if (a < 0.05) a = 0;
      else a = (a - 0.05) / 0.95;
      
      const outIdx = (y * cropW + x) * 4;
      croppedRaw[outIdx] = 255;
      croppedRaw[outIdx + 1] = 255;
      croppedRaw[outIdx + 2] = 255;
      croppedRaw[outIdx + 3] = Math.round(a * 255);
    }
  }
  
  const baseFishPng = await sharp(croppedRaw, {
    raw: { width: cropW, height: cropH, channels: 4 }
  }).png().toBuffer();
  
  // Function to create crisp, razor-sharp upscaled fish at specific target width
  async function makeCrispFish(targetW) {
    const resized = await sharp(baseFishPng)
      .resize(targetW, null, { kernel: "lanczos3" })
      .raw()
      .toBuffer({ resolveWithObject: true });
      
    const { width, height } = resized.info;
    const rawData = resized.data;
    const outData = Buffer.alloc(width * height * 4);
    
    for (let i = 0; i < width * height; i++) {
      const idx = i * 4;
      const a = rawData[idx + 3] / 255;
      
      // Smoothstep sigmoid curve: strokes become solid pure white and edges razor sharp
      let smoothA;
      if (a <= 0.18) smoothA = 0;
      else if (a >= 0.62) smoothA = 1;
      else {
        const t = (a - 0.18) / (0.62 - 0.18);
        smoothA = t * t * (3 - 2 * t);
      }
      
      outData[idx] = 255;
      outData[idx + 1] = 255;
      outData[idx + 2] = 255;
      outData[idx + 3] = Math.round(smoothA * 255);
    }
    
    return {
      buffer: await sharp(outData, { raw: { width, height, channels: 4 } }).png().toBuffer(),
      width,
      height
    };
  }
  
  // Generate Standard 512x512 Icon (fish width: 420px, ~36% bigger, prominent, sharp)
  const standardFish = await makeCrispFish(420);
  const icon512Buffer = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 15, g: 76, b: 129, alpha: 1 }
    }
  })
  .composite([{
    input: standardFish.buffer,
    left: Math.round((512 - standardFish.width) / 2),
    top: Math.round((512 - standardFish.height) / 2)
  }])
  .png({ compressionLevel: 9 })
  .toBuffer();
  
  // Generate Maskable 512x512 Icon (fish width: 385px, stays safely within Android 80% circle safe zone)
  const maskableFish = await makeCrispFish(385);
  const maskable512Buffer = await sharp({
    create: {
      width: 512,
      height: 512,
      channels: 4,
      background: { r: 15, g: 76, b: 129, alpha: 1 }
    }
  })
  .composite([{
    input: maskableFish.buffer,
    left: Math.round((512 - maskableFish.width) / 2),
    top: Math.round((512 - maskableFish.height) / 2)
  }])
  .png({ compressionLevel: 9 })
  .toBuffer();
  
  // Generate 192x192 Icon
  const icon192Buffer = await sharp(icon512Buffer)
    .resize(192, 192, { kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toBuffer();
    
  // Generate 180x180 Apple Touch Icon
  const apple180Buffer = await sharp(icon512Buffer)
    .resize(180, 180, { kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toBuffer();
    
  // Write PNG files
  fs.writeFileSync("public/icon-512.png", icon512Buffer);
  fs.writeFileSync("public/icon-maskable-512.png", maskable512Buffer);
  fs.writeFileSync("public/icon-192.png", icon192Buffer);
  fs.writeFileSync("public/icon.png", icon512Buffer);
  fs.writeFileSync("public/apple-icon.png", apple180Buffer);
  fs.writeFileSync("app/icon.png", icon512Buffer);
  fs.writeFileSync("app/apple-icon.png", apple180Buffer);
  
  // Also create a crisp 48x48 favicon.ico replacement
  const favicon32 = await sharp(icon512Buffer).resize(48, 48, { kernel: "lanczos3" }).png().toBuffer();
  fs.writeFileSync("public/favicon.ico", favicon32);
  
  // Create SVG icons with high-res crisp transparent fish embedded on the #0f4c81 background
  const fishBase64 = standardFish.buffer.toString("base64");
  const svgLeft = Math.round((512 - standardFish.width) / 2);
  const svgTop = Math.round((512 - standardFish.height) / 2);
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <rect width="512" height="512" rx="112" fill="#0f4c81"/>
  <image href="data:image/png;base64,${fishBase64}" x="${svgLeft}" y="${svgTop}" width="${standardFish.width}" height="${standardFish.height}"/>
</svg>
`;
  fs.writeFileSync("app/icon.svg", svgContent);
  fs.writeFileSync("public/favicon.svg", svgContent);
  
  console.log("All brand icons generated with razor-sharp quality!");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
