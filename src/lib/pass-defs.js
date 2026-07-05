// THE BANANA PASS — patch catalog. PURE DATA (safe for Astro frontmatter):
// the Card server-renders every patch as a dark slot with its hint; the client
// lights up the earned ones from localStorage. Patches are MOMENTS, not
// metrics: one-time, never expire, no streaks, no leaderboards.
//
// icon: a PixelIcon name (the site's icon language). Adding a patch here is
// enough — earning happens wherever the moment lives via passPatch(id).
export const PATCHES = [
  { id: 'maker',     icon: 'palette',  title: 'Maker',          hint: 'Take your first banana home from the workshop.' },
  { id: 'chaos',     icon: 'dice',     title: 'Agent of Chaos', hint: 'Let the dice dress the banana.' },
  { id: 'emoji',     icon: 'chat',     title: 'Chat Weapon',    hint: 'Download a chat-sized emoji GIF.' },
  { id: 'spreader',  icon: 'link',     title: 'Spreader',       hint: 'Share a banana with the world.' },
  { id: 'smith',     icon: 'bolt',     title: 'Pixel Smith',    hint: 'Forge an emoji from raw pixels.' },
  { id: 'exhibitor', icon: 'note',     title: 'Exhibitor',      hint: 'Submit a piece to the banana wall.' },
  { id: 'raver',     icon: 'sparkle',  title: 'First Night',    hint: 'Step onto the dance floor.' },
  { id: 'survivor',  icon: 'globe',    title: '30-Min Survivor',hint: 'Outlast 30 minutes at the rave. Glowstick included.' },
  { id: 'round',     icon: 'coffee',   title: 'First Round',    hint: 'Be first to the bar when Barty calls happy hour.' },
  { id: 'courier',   icon: 'floppy',   title: 'The Courier',    hint: 'Run a lost record to the DJ.' },
  { id: 'spotlight', icon: 'heart',    title: 'In the Light',   hint: 'Be standing in the spotlight when it lands.' },
  { id: 'regular',   icon: 'burger',   title: 'The Regular',    hint: 'Show up on five different days.' },
  { id: 'patron',    icon: 'tag',      title: 'Sticker Patron', hint: 'Your banana, on real vinyl.' },
  { id: 'golden',    icon: 'sparkle',  title: 'The Golden One', hint: 'Once in a golden while, something rare hits the floor. Be there.' },
  { id: 'og',        icon: 'banana',   title: 'OG',             hint: 'Was here before the world arrived.' },
];

// visitors before this date mint the OG patch automatically (set it to the
// real launch day when the launch happens)
export const OG_CUTOFF = '2026-08-01';
