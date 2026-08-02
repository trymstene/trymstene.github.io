// THE GUIDES — platform emoji/emote spec pages (organic expansion #1).
// Each entry = one page at /<slug>/ via src/pages/[guide].astro, all listed
// on the /guides/ mega-cheatsheet hub. Adding a guide = one entry here
// (research volumes with tools/kw.py first). Answer-first doctrine: `answer`
// is the one-sentence featured-snippet bid, specs is the table behind it.

export const GUIDES = [
  {
    slug: 'slack-emoji-size',
    platform: 'Slack',
    label: 'Slack emoji size',
    asset: 'emoji',
    title: 'Slack Emoji Size — 128×128, Limits & How to Make One (2026)',
    metaDescription: 'Slack custom emoji is 128×128 pixels, max 128KB, PNG/JPG/GIF. Full spec table for emoji, workspace icons and reactions — plus a free pixel emoji maker.',
    h1: 'Slack emoji size — the complete spec',
    answer: 'Upload Slack custom emoji at **128×128 pixels**, **max 128 KB**, as **PNG**, **JPG** or **GIF**. The 128 KB ceiling is the one that catches people out — it is half of Discord’s.',
    specs: [
      ['Custom emoji (upload)', '128 × 128 px', '≤ 128 KB', 'PNG · JPG · GIF'],
      ['Emoji in message (display)', '22 × 22 px', '—', 'rendered size'],
      ['Emoji in reaction (display)', '16 × 16 px', '—', 'rendered size'],
      ['Workspace icon', '512 × 512 px', '≤ 1 MB', 'PNG · JPG · GIF'],
      ['Profile photo', '512 × 512 px', '≤ 1 MB', 'PNG · JPG · GIF'],
    ],
    gotchas: [
      ['128 KB is the real limit, not the pixels', 'Most failed Slack uploads are file size, not dimensions. An animated GIF at 128×128 blows past 128 KB fast — cut frames, cut colours, or both. Pixel art wins here because it compresses to almost nothing.'],
      ['It renders at 22 pixels — twenty-two', 'Slack shows emoji smaller than any other platform, and smaller again in reactions. Fine lines and detailed faces turn to soup. Silhouette first, detail never.'],
      ['Animated emoji do work', 'GIFs animate in Slack messages and reactions. Keep them short and looping — a long animation reads as a distraction in a work channel, and eats the file budget.'],
      ['You cannot resize after upload', 'Slack keeps what you gave it. Get the size right first, or you are deleting and re-uploading — and any message already using it loses the emoji.'],
    ],
    faq: [
      ['What size should a Slack emoji be?', 'Upload at 128×128 pixels, maximum 128KB, in PNG, JPG or GIF format.'],
      ['Can Slack emoji be animated?', 'Yes — upload an animated GIF. It animates in both messages and reactions, but must stay under the 128KB limit.'],
      ['Why was my Slack emoji rejected?', 'Almost always file size. The limit is 128KB, much tighter than Discord’s 256KB — reduce frames or colours rather than dimensions.'],
    ],
  },
  {
    slug: 'telegram-sticker-size',
    platform: 'Telegram',
    label: 'Telegram sticker size',
    asset: 'sticker',
    title: 'Telegram Sticker Size — 512×512, WEBP & Limits (2026)',
    metaDescription: 'Telegram stickers are 512×512 pixels, WEBP or PNG, under 512KB, with a transparent background. Full spec table for static and animated stickers — plus a free maker.',
    h1: 'Telegram sticker size — the complete spec',
    answer: 'Telegram stickers are **512×512 pixels**, **under 512 KB**, as **WEBP** or **PNG** with a **transparent background**. One side must be exactly 512 px — the other can be smaller.',
    specs: [
      ['Static sticker', '512 × 512 px', '≤ 512 KB', 'WEBP · PNG, transparent'],
      ['Animated sticker', '512 × 512 px', '≤ 64 KB', 'TGS (Lottie)'],
      ['Video sticker', '512 × 512 px', '≤ 256 KB', 'WEBM (VP9)'],
      ['Sticker pack icon', '100 × 100 px', '≤ 32 KB', 'WEBP · PNG'],
      ['Custom emoji', '100 × 100 px', '≤ 64 KB', 'WEBP · PNG · TGS'],
    ],
    gotchas: [
      ['One side must be exactly 512', 'Telegram is strict about this and vague about saying so. A 500×512 sticker is rejected; 512×400 is fine. Make the long side 512 and let the short side fall where it likes.'],
      ['Transparent background is not optional', 'Telegram chat backgrounds are user-chosen photos. A white box behind your sticker looks broken on every one of them.'],
      ['Animated stickers are NOT GIFs', 'Telegram’s animated stickers are TGS — a Lottie vector format — with a brutal 64 KB budget. If you have a GIF, the video-sticker (WEBM) route is the practical one.'],
      ['You publish through a bot', 'Stickers go up via @Stickers inside Telegram, not a website. Have your 512×512 files ready before you start that chat.'],
    ],
    faq: [
      ['What size is a Telegram sticker?', 'Telegram stickers are 512×512 pixels with a transparent background, under 512KB, in WEBP or PNG format.'],
      ['Do Telegram stickers need a transparent background?', 'Yes. Chat backgrounds are user-set photos, so a sticker with a solid background looks like a pasted rectangle.'],
      ['Can I use a GIF as a Telegram sticker?', 'Not directly — animated stickers use TGS (Lottie) under 64KB, or video stickers use WEBM under 256KB.'],
    ],
  },
  {
    slug: 'discord-sticker-size',
    platform: 'Discord',
    label: 'Discord sticker size',
    asset: 'sticker',
    title: 'Discord Sticker Size — 320×320, APNG & Limits (2026)',
    metaDescription: 'Discord stickers are 320×320 pixels, max 512KB, PNG or APNG with transparency. Full spec table plus how stickers differ from emoji — and a free maker.',
    h1: 'Discord sticker size — the complete spec',
    answer: 'Discord stickers are **320×320 pixels**, **max 512 KB**, as **PNG** or **APNG** (animated) with a **transparent background**. Note APNG — not GIF, which is the single most common mistake.',
    specs: [
      ['Sticker (upload)', '320 × 320 px', '≤ 512 KB', 'PNG · APNG, transparent'],
      ['Sticker in chat (display)', '160 × 160 px', '—', 'rendered size'],
      ['Custom emoji (for comparison)', '128 × 128 px', '≤ 256 KB', 'PNG · GIF'],
      ['Server icon', '512 × 512 px', '≤ 10 MB', 'PNG · JPG · GIF'],
    ],
    gotchas: [
      ['APNG, not GIF — this is the one', 'Emoji animate with GIF; stickers animate with APNG. Uploading a GIF as a sticker fails or silently loses the animation, and Discord’s own wording does little to warn you.'],
      ['Stickers are big, emoji are small', 'A sticker renders at 160×160 — five times the area of an emoji. It can carry real detail and a readable expression, so do not just upscale an emote and call it done.'],
      ['Free servers get five slots', 'Five sticker slots on an unboosted server, rising with boost level. Slots are scarcer than emoji slots, so a sticker has to earn its place.'],
      ['Transparency, same as everything else', 'Light theme, dark theme, and every custom background in between. Export with transparency or it looks pasted on.'],
    ],
    faq: [
      ['What size is a Discord sticker?', 'Discord stickers are 320×320 pixels, maximum 512KB, in PNG or APNG format with a transparent background.'],
      ['Can Discord stickers be animated?', 'Yes, but as APNG — not GIF. GIF is for custom emoji; stickers use APNG.'],
      ['What is the difference between a Discord sticker and an emoji?', 'Stickers are 320×320 and display at 160×160 as their own message; emoji are 128×128 and display at 32×32 inline with text.'],
    ],
  },
  {
    slug: 'discord-emoji-size',
    platform: 'Discord',
    label: 'Discord emoji size',
    asset: 'emote',
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
    label: 'Twitch emote size',
    asset: 'emote',
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
