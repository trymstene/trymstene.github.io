// Shared "state → animated meme GIF blob" renderer. ONE render path for the
// builder's download/submit AND the Banana Mail desk's re-render, so a
// re-rendered gallery GIF is pixel-identical to what a visitor downloads — and
// now bakes captions in Anton (see ensureCaptionFont). Parse params with
// sticker-core's parseDesign to get the `state` this takes.
import { assetsReady, NFRAMES } from './banana-engine.js';
import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { composite, bboxOf, pad, ensureCaptionFont } from './sticker-core.js';

export async function memeGif(state) {
  await assetsReady();
  await ensureCaptionFont(state); // Anton must be decoded before captions bake in
  const isT = state.bg === 'transparent';
  const W = 480;
  const frames = [];
  const cv = document.createElement('canvas'); cv.width = W; cv.height = W; const ctx = cv.getContext('2d');
  for (let i = 0; i < NFRAMES; i++) {
    composite(ctx, W, i, state, {
      bg: state.bg, captions: true, effect: state.effect,
      hue: state.effect === 'disco' ? (360 * i / NFRAMES) : 0,
    });
    frames.push(ctx.getImageData(0, 0, W, W));
  }
  // solid bg → full square; transparent → crop to content (captions included), 1-bit alpha
  const bb = isT ? pad(bboxOf(frames.map((f) => f.data), W), W) : { x: 0, y: 0, w: W, h: W };
  const s = 480 / Math.max(bb.w, bb.h);
  const tw = Math.max(2, Math.round(bb.w * s)), th = Math.max(2, Math.round(bb.h * s));
  const delay = Math.max(20, Math.round((state.spd * 1000) / NFRAMES));

  // crop+scale each frame, then ONE shared palette across all frames (no flicker)
  const tmp = document.createElement('canvas'); tmp.width = tw; tmp.height = th; const tctx = tmp.getContext('2d');
  const datas = [];
  for (let i = 0; i < NFRAMES; i++) {
    const src = document.createElement('canvas'); src.width = W; src.height = W; src.getContext('2d').putImageData(frames[i], 0, 0);
    tctx.clearRect(0, 0, tw, th);
    tctx.imageSmoothingEnabled = false;
    tctx.drawImage(src, bb.x, bb.y, bb.w, bb.h, 0, 0, tw, th);
    const data = tctx.getImageData(0, 0, tw, th).data;
    if (isT) for (let k = 3; k < data.length; k += 4) data[k] = data[k] < 110 ? 0 : 255; // 1-bit alpha
    datas.push(data);
  }
  const merged = new Uint8ClampedArray(datas.length * datas[0].length);
  datas.forEach((d, i) => merged.set(d, i * d.length));
  const palette = quantize(merged, 256, { format: 'rgba4444', oneBitAlpha: isT });

  const gif = GIFEncoder();
  for (let i = 0; i < NFRAMES; i++) {
    const index = applyPalette(datas[i], palette, 'rgba4444');
    gif.writeFrame(index, tw, th, isT ? { palette, delay, transparent: true, dispose: 2 } : { palette, delay });
  }
  gif.finish();
  return { blob: new Blob([gif.bytes()], { type: 'image/gif' }), isT, tw, th };
}
