import sharp from "sharp";
import fs from "fs";

// iOS ignores the manifest's background_color, so each screen size gets a startup image that
// matches the first frame of the in-app launch splash (components/launch-splash.tsx).
const BACKGROUND = "#0f4c81";
const LOGO_ASPECT = 260 / 422;
const LOGO_MAX_WIDTH = 152; // min(9.5rem, 42vw)
const LOGO_MAX_VW = 0.42;
const BELOW_LOGO = 43.2; // 1.5rem gap + the name line, which is laid out but still transparent

const screens = JSON.parse(fs.readFileSync("lib/ios-splash-screens.json", "utf8"));
fs.mkdirSync("public/splash", { recursive: true });

const logo = sharp("public/brand-logo.png");
const { width: srcW, height: srcH } = await logo.metadata();
const alpha = await logo.clone().extractChannel("alpha").png().toBuffer();
const whiteLogo = await sharp({
  create: { width: srcW, height: srcH, channels: 3, background: "#ffffff" },
})
  .joinChannel(alpha)
  .png()
  .toBuffer();

for (const { width, height, ratio } of screens) {
  const logoW = Math.min(LOGO_MAX_WIDTH, width * LOGO_MAX_VW);
  const logoH = logoW * LOGO_ASPECT;
  const left = Math.round(((width - logoW) / 2) * ratio);
  const top = Math.round(((height - logoH - BELOW_LOGO) / 2) * ratio);

  const mark = await sharp(whiteLogo)
    .resize(Math.round(logoW * ratio), Math.round(logoH * ratio), { kernel: "lanczos3" })
    .toBuffer();

  const file = `public/splash/ios-${width}x${height}@${ratio}x.png`;
  await sharp({
    create: { width: width * ratio, height: height * ratio, channels: 3, background: BACKGROUND },
  })
    .composite([{ input: mark, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log(file);
}
