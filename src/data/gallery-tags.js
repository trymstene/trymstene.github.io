// THE BANANA GALLERY tag registry — each tag is a query-first landing page.
// A tag only GETS a page once it holds MIN_TAG_ITEMS items (thin category
// pages hurt more than they help); below that, chips render without links.
// Slugs are frozen once live. Intro copy targets the query in `q`.
export const MIN_TAG_ITEMS = 3;

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
