import sharp from "sharp";
import fs from "fs";

const svgPath = "app/icon.svg";
let svgContent = fs.readFileSync(svgPath, "utf-8");

// replace <image href="..." width="512" height="512" />
// with <image transform="translate(256,256) scale(1.5) translate(-256,-256)" href="..." width="512" height="512" />
if (!svgContent.includes('transform=')) {
  svgContent = svgContent.replace('<image href=', '<image transform="translate(256,256) scale(1.8) translate(-256,-256)" href=');
  fs.writeFileSync("app/icon.svg", svgContent);
  fs.writeFileSync("public/favicon.svg", svgContent);
}

const sizes = [
  { path: "app/icon.png", size: 512 },
  { path: "app/apple-icon.png", size: 512 },
  { path: "public/icon.png", size: 512 },
  { path: "public/icon-192.png", size: 192 },
  { path: "public/icon-512.png", size: 512 },
  { path: "public/icon-maskable-512.png", size: 512 },
];

for (const { path, size } of sizes) {
  await sharp(Buffer.from(svgContent))
    .resize(size, size)
    .toFile(path);
  console.log(`Generated ${path} at ${size}x${size}`);
}
