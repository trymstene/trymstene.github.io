# -*- coding: utf-8 -*-
# 🍳 THE KITCHEN'S ART — the cooking stations, the plated dishes and the
# park-crop icons, cut straight from the purchased packs (Modern Interiors,
# Modern Exteriors, Modern Farm) into public/assets/homestead/. Sibling of
# build-homestead-scene.py (the yard); same OUT, same rule: never repair
# pixels — re-run this when something looks wrong.
import os
from PIL import Image

SITE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(SITE, 'public', 'assets', 'homestead')
ART = os.path.expanduser(r'~\OneDrive\banana-art-pack')
MI_ANIM = os.path.join(ART, 'moderninteriors-win', '3_Animated_objects', '48x48', 'spritesheets')
MI_SING = os.path.join(ART, 'moderninteriors-win', '1_Interiors', '48x48', 'Theme_Sorter_Singles_48x48')
ME_CAMP = os.path.join(ART, 'Modern_Exteriors_48x48', 'ME_Theme_Sorter_48x48', '11_Camping_Singles_48x48')
MF_ICON = os.path.join(ART, 'Modern_Farm_v1.2', 'Icons', 'Icons_32x32', 'Icons_32x32')
if not os.path.isdir(ART):
    raise SystemExit('art pack not found at ' + ART)


def put(name, im):
    im.save(os.path.join(OUT, name), optimize=True)
    print('  %-18s %dx%d' % (name, im.size[0], im.size[1]))


def trim(im):
    box = im.getbbox()
    return im.crop(box) if box else im


print('stations:')
oven = Image.open(os.path.join(MI_ANIM, 'animated_kitchen_oven_48x48.png')).convert('RGBA')
put('k-cooktop-on.png', Image.open(os.path.join(MI_ANIM, 'animated_kitchen_oven_2cookers_48x48.png')).convert('RGBA'))
put('k-cooktop-off.png', oven.crop((0, 0, 48, 48)))          # frame 0, top half: four cold burners
put('k-oven.png', oven)                                        # 6 frames of 48x96: the door opens
put('k-pan.png', Image.open(os.path.join(MI_ANIM, 'animated_kitchen_pan_with_omelette_48x48.png')).convert('RGBA'))   # 8 frames of 96x96
put('k-pot.png', Image.open(os.path.join(MI_SING, '12_Kitchen_Singles_48x48', 'Kitchen_Singles_48x48_380.png')).convert('RGBA'))
for n, src in (('idle', 2), ('on', 5), ('done', 3)):
    put('k-tripod-%s.png' % n, Image.open(os.path.join(ME_CAMP, 'ME_Singles_Camping_48x48_Hanging_Cooking_Pot_%d.png' % src)).convert('RGBA'))

print('dishes:')
DISH = {
    'fried': ('12_Kitchen_Singles_48x48', 'Kitchen_Singles_48x48_385.png'),
    'greens': ('12_Kitchen_Singles_48x48', 'Kitchen_Singles_48x48_388.png'),
    'soup': ('12_Kitchen_Singles_48x48', 'Kitchen_Singles_48x48_390.png'),
    'stew': ('12_Kitchen_Singles_48x48', 'Kitchen_Singles_48x48_387.png'),
    'board': ('16_Grocery_Store_Singles_48x48', 'Grocery_Store_Singles_48x48_387.png'),
    'pie': ('16_Grocery_Store_Singles_48x48', 'Grocery_Store_Singles_48x48_215.png'),
}
for k, (theme, f) in DISH.items():
    put('f-%s.png' % k, trim(Image.open(os.path.join(MI_SING, theme, f)).convert('RGBA')))

print('park crops as 32px icons:')
for k, f in (('radish', 'Crops_Radish'), ('carrot', 'Crops_Carrot'), ('tomato', 'Crops_Tomato'), ('pumpkin', 'Crops_Pumpkin'),
             ('wheat', 'Crops_Grain'), ('strawberry', 'Crops_Strawberry'), ('corn', 'Crops_Corn'), ('watermelon', 'Crops_Watermelon'),
             ('grape', 'Crops_Grape'), ('pineapple', 'Crops_Pineapple'), ('prickly', 'Crops_Prickly_Pear')):
    put('m-%s.png' % k, Image.open(os.path.join(MF_ICON, 'Singles_Icons_32x32_%s.png' % f)).convert('RGBA'))
print('done')
