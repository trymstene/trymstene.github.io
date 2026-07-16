// THE BANANA GALLERY tag registry — a tag gets a landing page once it holds
// MIN_TAG_ITEMS items (thin category pages hurt more than they help).
//
// REGISTRATION IS OPTIONAL (Trym: "what if i just forget to let you know?"):
// any tag reaching the threshold auto-generates a page from tagMeta()'s
// template copy — nothing rots waiting for a human. Registering a tag HERE
// upgrades it with hand-written, query-first copy (do it for tags worth
// aiming at a real search query). Slugs are frozen once live.
export const MIN_TAG_ITEMS = 3;

// meta for ANY tag: registered copy if we wrote it, honest template if not
export function tagMeta(t) {
  if (TAGS[t]) return TAGS[t];
  const cap = t.charAt(0).toUpperCase() + t.slice(1).replace(/-/g, ' ');
  return {
    name: `${cap} Banana Memes`,
    q: `${t.replace(/-/g, ' ')} meme`,
    blurb: `${cap} banana memes — GIFs and stickers tagged “${t}”, starring the dancing banana. Free to download and share; new ones join the moment they're made.`,
    auto: true,
  };
}

// THE one liveTags computation (hub, tag/cat routes, community route and the
// sitemap all call this — four hand-rolled copies is how drift happens).
// A tag goes live at MIN_TAG_ITEMS across BOTH lanes, unless its slug is
// reserved by a route or collides with an editorial item id (item pages own
// their URL; such a tag stays chips-only rather than eating a page).
export function liveTagList(editorialItems, communityItems = []) {
  const count = {};
  editorialItems.forEach((i) => (i.tags || []).forEach((t) => { count[t] = (count[t] || 0) + 1; }));
  communityItems.forEach((c) => (c.tags || []).forEach((t) => { count[t] = (count[t] || 0) + 1; }));
  const reserved = new Set(['stickers', 'gifs', 'by', 'tags', 'submit', 'search',
    ...editorialItems.map((i) => i.id)]);
  return Object.keys(count)
    .filter((t) => count[t] >= MIN_TAG_ITEMS && !reserved.has(t))
    .sort((a, b) => count[b] - count[a]);
}

export const TAGS = {
  monday: {
    name: 'Monday Banana Memes',
    q: 'monday meme',
    blurb: 'Monday memes, banana edition — for the 9am group-chat check-in, the first coffee, and the long sigh before the standup. The dancing banana faces the week so you don’t have to.',
  },
  work: {
    name: 'Work Banana Memes',
    q: 'work meme',
    blurb: 'Work memes starring the dancing banana: meetings on mute, quiet quitting, the last braincell on shift. Office-safe, deadline-tested, free to drop in any work chat.',
  },
  mood: {
    name: 'Mood Banana Memes',
    q: 'mood meme',
    blurb: 'Big-mood banana memes — emotional support, this-is-fine energy, and every feeling in between. When words are too much, send the banana.',
  },
  vibes: {
    name: 'Vibe Banana Memes',
    q: 'vibing meme',
    blurb: 'Not thriving, but vibing — good-vibes banana memes for celebrations, tiny wins and unbothered energy. The dancing banana has been radiating vibes since 1999.',
  },
  // ⚠ this tag must NEVER target "dancing banana gif" — that phrase belongs to
  // /dancing-banana-gif-meme/ (the money page). Happy-dance cluster instead.
  dancing: {
    name: 'Happy Dance Banana Memes',
    q: 'happy dance gif',
    blurb: 'Happy dance memes from the banana that started it all — dance-first philosophy, rent-defying grooves and quiet quitting done loudly.',
  },
  party: {
    name: 'Party Banana Memes',
    q: 'party meme',
    blurb: 'Party banana memes and stickers — sombreros, boomboxes and sparklers. For birthdays, Fridays and anything that deserves confetti.',
  },
  costume: {
    name: 'Banana Stickers in Costume',
    q: 'banana sticker',
    blurb: 'The dancing banana in costume — transparent stickers with 3D glasses, viking helmets, clown shoes and more. Drop them straight into any chat, no background box.',
  },
  money: {
    name: 'Money Banana Memes',
    q: 'payday meme',
    blurb: 'Rent is due, bills are bananas — money memes from a fruit with no bank account and no worries. Financial advice not included; dancing is.',
  },
};
