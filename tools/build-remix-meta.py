# -*- coding: utf-8 -*-
"""Generate SEO/curation metadata for every community remix.

Reads src/data/remixes.json (the base data from build-remix-gallery.py) and
writes src/data/remix-meta.json — a per-id overlay the detail pages + gallery
merge in. Non-destructive to the pipeline; re-runnable (new remixes get sane
auto-generated meta, curated ones keep their hand-tuned hints/renames below).

Each entry: { slug, title, metaTitle, metaDescription, blurb, mood, creator }.
  slug   — clean, unique URL segment (frozen once live: never change these)
  title  — display name (RENAMES fix mislabels, e.g. the dead 'Left' banana)
  mood   — target search-query tag where one exists (cool / sunglasses / ...)
  creator— null for all today; the field exists so a credit can be dropped in
           under the hood the moment someone emails to claim one.

Run: python tools/build-remix-meta.py [--write]
"""
import json, os, re, sys

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(SITE, 'src', 'data', 'remixes.json')
OUT  = os.path.join(SITE, 'src', 'data', 'remix-meta.json')

# --- corrections: the community name is wrong for what the GIF actually shows
# (Trym reviewed the duplicates/mislabels by eye). Slugs derive from these.
RENAMES = {
    'bananadance-left': 'Dead',            # a banana flat on its back, not dancing
    'banana-dance-1': 'Sweet Potato',      # a sprouting sweet-potato-looking banana
    'banana-dance-2': 'Ketchup Song',      # does the ketchup-song dance
    'banana-dance': 'Robot Dance',         # doing the robot
    'bananadance-pbj': 'Flash Banana Red', # Flash-era banana, red racing stripes
    'bananadance': 'Flash Banana Classic', # the classic Flash PBJT banana
    'pbj-dance': 'Berry',                  # a winged berry, not a banana
    'dancing-banana-alien': 'Xenomorph',   # the Alien-vs-Predator alien
    'dancing-banana-devil': 'Pitchfork Devil',
    'bananadance-fade2': 'Sliding Fade',
    'bananadance-pink-1': 'Nerdy Pink',    # nerdy pink (glasses); the other is classic
    'bananadance-satan': 'Satan Splits',   # a Satan banana doing the splits
    'bananadance-sign': 'Dance Sign',      # holds a sign reading DANCE
    'super-mario-banana': 'Super Mario Banana Party',  # Mario + banana together
    'bananadance-slow-2': 'Boogie',        # does the boogie
}

# --- remove entirely: near-duplicate the source can't tell apart (Trym's call)
DROP = {'dancing-banana-upsidedown'}       # dup of bananadance-upsidedown

# --- visual hints from reviewing every GIF → richer, non-boilerplate blurbs.
# keyed by id. Absent ids fall back to a name-based description.
HINTS = {
    'aliendance-pbj': 'a grey little-green-man Area-51 alien banana',
    'dancing-banana-alien': 'a Xenomorph — the Alien-vs-Predator alien, as a banana',
    'bananadance-warrior': 'a warrior banana kitted out with a sword and shield',
    'bananadance-jedi': 'a Jedi banana swinging a green lightsaber',
    'bananadance-sunglasses': 'a banana chilling in black sunglasses',
    'bananadance-cool': 'a too-cool banana in shades',
    'bananadance-cool2': 'a cool banana in dark shades',
    'bananadance-glasses': 'a green banana in glasses',
    'bananadance-rainbow': 'a banana bursting with every rainbow colour',
    'bananadance-rainbow2': 'a rainbow-striped banana',
    'bananadance-cheerleader': 'a cheerleader banana shaking pom-poms',
    'bananadance-santa': 'a Santa banana in a red hat',
    'dancing-banana-santa': 'a Santa banana sat on a throne',
    'bananadance-santahat': 'a banana in a Santa hat',
    'bananadance-witch': 'a witch banana in a pointy hat',
    'bananadance-clown': 'a colourful clown banana',
    'bananadance-cop': 'a police banana on the beat',
    'bananadance-rapper': 'a rapper banana in a cap and gold chains',
    'bananadance-devil': 'a little red devil banana',
    'dancing-banana-devil': 'a red devil banana with a pitchfork',
    'bananadance-satan': 'a Satan banana dropping into the splits, pitchfork and all',
    'dancing-banana-satan': 'Satan himself, as a red banana with a pitchfork',
    'bananadance-angel': 'an angel banana with a halo and wings',
    'bananadance-pinkangel': 'a pink angel banana with a halo',
    'bananadance-fire': 'a banana dancing in flames',
    'bananadance-flame': 'a banana wreathed in flame',
    'bananadance-bloody': 'a blood-splattered banana',
    'bananadance-left': "a banana flat on its back — this one's clearly had enough",
    'bananadance-moonwalk': 'a banana moonwalking in a fedora',
    'bananadance-spin': 'a banana caught mid-spin',
    'bananadance-split': 'a banana dropping into the splits',
    'bananadance-guitar': 'a banana shredding a guitar',
    'dancing-banana-guitar': 'a banana rocking out on guitar',
    'dancing-banana-drums': 'a banana hammering a drum kit',
    'bananadance-piano': 'a banana tinkling the piano',
    'bananadance-jazz': 'a banana blowing a jazz trumpet',
    'batman-banana-dance': 'a Batman banana in a dark cape',
    'dancing-banana-homer': 'a Homer Simpson banana',
    'mariodance-pbj': 'a Mario banana',
    'dancing-super-mario': 'a Super Mario banana',
    'super-mario-banana': 'Super Mario and a banana partying together',
    'luigi-dance-pbj': 'a Luigi banana',
    'sonicdance-pbjtime': 'a Sonic the Hedgehog banana',
    'bender-dance-pbj': 'Bender from Futurama, as a banana',
    'bananadance-superman': 'a Superman banana with a red cape',
    'bananadance-mickeymouse': 'a banana in Mickey Mouse ears',
    'bananadance-smurf': 'a little blue Smurf banana',
    'bananadance-fro': 'a banana rocking a giant afro',
    'bananadance-mullet': 'a banana with a business-in-front mullet',
    'bananadance-dreadlocks': 'a banana with dreadlocks',
    'rasta-bananadance': 'a rasta banana with dreads',
    'bananadance-rot': 'a rotting banana shedding brown spots',
    'bananadance-vomit': 'a queasy banana losing its lunch',
    'bananadance-melt': 'a banana melting into a puddle',
    'bananadance-sleep': 'a banana fast asleep with little Zs',
    'bananadance-invisible': 'a nearly invisible banana — just gloves and feet',
    'bananadance-silhouette': 'a banana in pure black silhouette',
    'bananadance-explode': 'a banana blowing up',
    'dancing-banana-mexican': 'a banana under a huge sombrero',
    'bananadance-kilt': 'a banana in a Scottish kilt',
    'dancing-banana-bagpipe': 'a banana squeezing the bagpipes',
    'bananadance-tennis': 'a banana serving on the tennis court',
    'bananadance-football': 'a banana suited up for football',
    'bananadance-skiing': 'a banana on skis',
    'dancing-banana-skiing': 'a banana carving down the slopes',
    'bananadance-heart': 'a banana holding up a big pink heart',
    'dancing-banana-in-love': 'two bananas in love, hearts and all',
    'bananadance-love': 'a loved-up banana',
    'bananadance-jester': 'a court-jester banana',
    'bananadance-magician': 'a magician banana pulling a trick',
    'magician-bananadance': 'a top-hat magician banana',
    'bananadance-thief': 'a masked thief banana',
    'bananadance-lsd': 'a banana melting through a psychedelic trip',
    'bananadance-joint': 'a mellow banana having a smoke',
    'companion-cube-pbj-dance': 'the Portal companion cube, dancing',
    'ring-of-death-dance-pbj': 'the dreaded Xbox red ring of death',
    'ronald-mcdonald-pbj-dance': 'a Ronald McDonald banana',
    'reaper-dance-pbj': 'a tiny grim reaper',
    'bananadance-monster': 'a bolt-necked Frankenstein banana',
    'bananadance-greenmonster': 'a green monster banana',
    'bananadance-shark': 'a banana in shark-grey, jaws and all',
    'bananadance-dragon': 'a fierce blue dragon banana',
    # Trym's fixups
    'banana-dance-1': 'a sprouting sweet-potato-looking banana',
    'banana-dance-2': 'a banana doing the ketchup-song dance',
    'banana-dance': 'a banana busting out the robot',
    'bananadance-pbj': 'the Flash-era banana in red racing stripes',
    'bananadance': 'the classic Flash Peanut-Butter-Jelly-Time banana',
    'pbj-dance': 'a little winged berry cutting a rug',
    'bananadance-fade2': 'a banana in a sliding fade',
    'bananadance-pink-1': 'a nerdy pink banana in glasses',
    'bananadance-sign': 'a banana holding up a sign that reads DANCE',
    'bananadance-slow-2': 'a banana doing the boogie',
}

# names that match real search demand (GSC) → mood tag + query-first phrasing
MOODS = {
    'bananadance-cool': 'cool', 'bananadance-cool2': 'cool',
    'bananadance-sunglasses': 'sunglasses', 'bananadance-glasses': 'glasses',
    'bananadance-warrior': 'warrior', 'bananadance-jedi': 'jedi',
    'bananadance-rainbow': 'rainbow', 'bananadance-rainbow2': 'rainbow',
    'bananadance-angel': 'angel', 'bananadance-devil': 'devil',
    'dancing-banana-devil': 'devil', 'bananadance-witch': 'witch',
}
# query-first meta titles for the mood winners (put the searched phrase up front)
MOOD_TITLE = {
    'sunglasses': 'Banana with Sunglasses GIF',
    'glasses': 'Banana with Glasses GIF',
    'cool': 'Cool Banana GIF',
    'warrior': 'Warrior Banana GIF',
    'jedi': 'Jedi Banana GIF',
    'rainbow': 'Rainbow Banana GIF',
    'angel': 'Angel Banana GIF',
    'devil': 'Devil Banana GIF',
    'witch': 'Witch Banana GIF',
}

CHAR_WORDS = {'mario','luigi','yoshi','peach','sonic','pichu','batman','homer',
    'bender','fry','brian','chuck','norris','link','ichigo','bowser','goofy',
    'superman','nelson','otto','mrburns','oswald','radiohead','phelps','palkia',
    'monkey','duck','wolf','rabbit','hornet','mickeymouse','smurf','ronald',
    'mcdonald','master','chief'}


def slugify(s):
    s = s.lower()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return re.sub(r'-{2,}', '-', s).strip('-')


def main(write):
    base = json.load(open(BASE, encoding='utf-8'))
    N = len(base)
    seen, out = set(), []
    for i, r in enumerate(base):
        rid = r['id']
        if rid in DROP:
            continue
        title = RENAMES.get(rid, r['title'])
        # tidy display casing: "apple red" -> "Apple Red" (leave odd ones alone)
        title = ' '.join(w if (w.isupper() and len(w) > 1) else w.capitalize()
                         for w in title.split())
        cat = r['cat']
        # unique slug from the (corrected) title
        slug = slugify(title) or slugify(rid)
        base_slug = slug
        n = 2
        while slug in seen:
            slug = f'{base_slug}-{n}'; n += 1
        seen.add(slug)

        mood = MOODS.get(rid)
        low = title.lower()
        # meta title — lead with the searched phrase for mood winners
        if mood in MOOD_TITLE:
            metaTitle = f'{MOOD_TITLE[mood]} — a Dancing Banana Remix'
        elif any(w in rid for w in CHAR_WORDS) or cat == 'characters':
            metaTitle = f'{title} Dancing Banana GIF — Community Remix'
        elif cat in ('food', 'wild'):
            # not a banana (an apple, a taco, a companion cube) — don't call it one
            metaTitle = f'{title} — a Dancing Banana Remix (GIF)'
        else:
            metaTitle = f'{title} Banana GIF — a Dancing Banana Remix'

        hint = HINTS.get(rid, f'{low} — a fan take on the dancing banana')
        Hint = hint[0].upper() + hint[1:]
        f = r['frames']
        art = 'an' if f in (8, 11, 18, 80) else 'a'   # an 8-frame / a 4-frame
        loop = 'a still, single-frame pixel' if f == 1 else f'{art} {f}-frame pixel loop'
        size = f'{r["w"]}×{r["h"]}'
        # description (SERP snippet): what it is + free + funnel, varied by index
        dtempl = [
            f'{Hint}. One of {N} community Dancing Banana remixes — watch it, download the GIF free, or make your own.',
            f'A fan-made Dancing Banana remix: {hint}. Free to download and share, or dress your own banana in the builder.',
            f'{Hint} — part of the {N}-strong Dancing Banana remix collection. Grab the GIF free or make your own.',
        ]
        metaDescription = dtempl[i % len(dtempl)]

        # on-page blurb: descriptive + a unique factual line + a nudge
        frameline = (f'a still {size} pixel frame' if f == 1
                     else f'{loop} at {size}')
        btempl = [
            f'Meet {hint} — one of {N} Dancing Banana remixes the internet has made since 1999, '
            f'{frameline}.',
            f'This is {hint}: a community remix of the original Dancing Banana, {frameline}, '
            f'kept exactly as the meme era made it.',
            f'{Hint} — a fan remix of the 1999 Dancing Banana, {frameline}.',
        ]
        blurb = btempl[i % len(btempl)]

        out.append(dict(id=rid, slug=slug, title=title, metaTitle=metaTitle,
                        metaDescription=metaDescription, blurb=blurb,
                        mood=mood, creator=None))

    dupes = len(out) - len(set(o['slug'] for o in out))
    print(f'{len(out)} entries · {dupes} slug collisions · {sum(1 for o in out if o["mood"])} mood-tagged')
    print('renamed:', ', '.join(f'{k}->{v}' for k, v in RENAMES.items()))
    print('\nsamples:')
    for o in out[:3] + [o for o in out if o['mood']][:3]:
        print(f'  /{o["slug"]}/  ·  {o["metaTitle"]}')
    if write:
        json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        print('\nwrote', os.path.relpath(OUT, SITE))
    else:
        print('\n(dry run — pass --write to emit)')


if __name__ == '__main__':
    main('--write' in sys.argv)
