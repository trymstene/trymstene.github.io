// THE GUIDES — platform emoji/emote spec pages (organic expansion #1).
// Each entry = one page at /<slug>/ via src/pages/[guide].astro, all listed
// on the /guides/ mega-cheatsheet hub. Adding a guide = one entry here
// (research volumes with tools/kw.py first). Answer-first doctrine: `answer`
// is the one-sentence featured-snippet bid, specs is the table behind it.

export const GUIDES = [
  {
    slug: 'discord-emoji-size',
    platform: 'Discord',
    title: 'Discord Emoji Size — Dimensions, Limits & How to Make One (2026)',
    metaDescription: 'Discord emoji size is 128×128 pixels, max 256KB, PNG or GIF. Full spec table for emojis, stickers and server icons — plus a free pixel emoji maker.',
    h1: 'Discord emoji size — the complete spec',
    answer: 'Upload Discord emojis at **128×128 pixels**, **max 256 KB**, as **PNG** (static) or **GIF** (animated). Discord shows them at 32×32 in chat (48×48 when the message is emoji-only — "jumbo" size).',
    specs: [
      ['Custom emoji (upload)', '128 × 128 px', '≤ 256 KB', 'PNG · JPG · GIF'],
      ['Emoji in chat (display)', '32 × 32 px', '—', 'rendered size'],
      ['Jumbo emoji (emoji-only message)', '48 × 48 px', '—', 'rendered size'],
      ['Sticker', '320 × 320 px', '≤ 512 KB', 'PNG · APNG'],
      ['Server icon', '512 × 512 px', '≤ 10 MB', 'PNG · JPG · GIF'],
      ['Role icon', '64 × 64 px', '≤ 256 KB', 'PNG · JPG'],
    ],
    gotchas: [
      ['Why does my emoji look blurry?', 'You uploaded something big and photographic. Emojis render at 32×32 — fine detail turns to mush. Bold shapes, thick outlines and few colors survive the shrink; that\'s why pixel art makes the best emotes.'],
      ['Animated emojis: who can use them?', 'Anyone with the right permission can UPLOAD an animated (GIF) emoji to a server. Using custom emojis across other servers — and in DMs — needs Nitro.'],
      ['How many emoji slots does a server get?', '50 static + 50 animated on a fresh server; boosting raises it (up to 250 + 250 at level 3).'],
      ['Transparent background or not?', 'Yes — always. Discord chat backgrounds vary (dark, light, themes), so a baked-in background looks like a sticker slapped on the screen. Export PNG/GIF with transparency.'],
    ],
    faq: [
      ['What size should a Discord emoji be?', 'Upload at 128×128 pixels, maximum 256KB, in PNG or GIF format. Discord displays it at 32×32 in chat.'],
      ['Can Discord emojis be animated?', 'Yes — upload an animated GIF as a server emoji. Using it in other servers requires Discord Nitro.'],
      ['What is the Discord sticker size?', 'Discord stickers are 320×320 pixels, max 512KB, in PNG or APNG format.'],
    ],
  },
  {
    slug: 'twitch-emote-size',
    platform: 'Twitch',
    title: 'Twitch Emote Size — 28px, 56px, 112px Explained (2026)',
    metaDescription: 'Twitch emotes need three sizes: 28×28, 56×56 and 112×112 pixels, PNG with transparency, under 1MB. Full spec table + a free pixel emote maker.',
    h1: 'Twitch emote size — the complete spec',
    answer: 'Twitch requires **three sizes** of every emote: **28×28**, **56×56** and **112×112 pixels** — PNG with a transparent background, **under 1 MB** each. (Or upload one ≥112×112 square image and let Twitch auto-resize.)',
    specs: [
      ['Emote — small (chat)', '28 × 28 px', '≤ 1 MB', 'PNG, transparent'],
      ['Emote — medium (retina)', '56 × 56 px', '≤ 1 MB', 'PNG, transparent'],
      ['Emote — large (previews)', '112 × 112 px', '≤ 1 MB', 'PNG, transparent'],
      ['Animated emote', 'same trio', '≤ 1 MB', 'GIF, ≤ 60 fps'],
      ['Sub badge', '18 / 36 / 72 px', '≤ 25 KB', 'PNG'],
    ],
    gotchas: [
      ['Design at 112, judge at 28.', 'Viewers see your emote at 28×28 in chat. If it doesn\'t read at postage-stamp size, it doesn\'t work — zoom out and squint before you submit. Big shapes, faces and 2–4 colors win.'],
      ['The auto-resize shortcut.', 'Twitch can generate the smaller sizes from one ≥112×112 upload — but auto-shrunk fine detail gets muddy. Pixel-art emotes drawn on a small grid survive perfectly.'],
      ['Animated emotes need approval history.', 'Affiliates and Partners unlock animated-emote slots; the same size trio applies and GIFs must stay under 1MB and 60fps.'],
      ['Transparency is mandatory in practice.', 'Chat has dark mode, light mode and channel themes — a solid background box screams amateur.'],
    ],
    faq: [
      ['What size are Twitch emotes?', 'Twitch emotes require three sizes: 28×28, 56×56, and 112×112 pixels, as transparent PNGs under 1MB each.'],
      ['Can I upload one image for all Twitch emote sizes?', 'Yes — upload a single square image of at least 112×112 pixels and Twitch auto-generates the smaller sizes.'],
      ['What size are Twitch sub badges?', 'Sub badges need 18×18, 36×36, and 72×72 pixel versions, each under 25KB.'],
    ],
  },
];

// hub cheatsheet rows for platforms WITHOUT deep guides yet — the /guides/
// table stays complete (self-value doctrine) and each row can grow into a
// full guide later (kw.py the volumes first)
export const CHEATSHEET_EXTRA = [
  ['Slack', 'Custom emoji', '128 × 128 px', '≤ 128 KB', 'PNG · JPG · GIF'],
  ['Telegram', 'Sticker', '512 × 512 px', '≤ 512 KB', 'PNG · WEBP'],
  ['Microsoft Teams', 'Custom emoji', '≥ 256 × 256 px', '≤ 1 MB', 'PNG · JPG · GIF'],
  ['YouTube', 'Channel emoji (members)', '32 × 32 px', '≤ 1 MB', 'PNG'],
  ['Reddit', 'Community emoji', '128 × 128 px', '≤ 64 KB', 'PNG'],
];
