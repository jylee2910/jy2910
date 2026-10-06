"""render selected anims of a character big for inspection"""
import sys
import numpy as np
from PIL import Image
import anims
from bake import render_frame, CAST
name=sys.argv[1]; which=sys.argv[2].split(','); out=sys.argv[3]
cls=CAST[name]; style=getattr(cls,'style','sword')
tiles=[]
for w in which:
    view,an=w.split('.')
    table = anims.BATTLE_ANIMS if view=='battle' else anims.FIELD_ANIMS
    for p in table[an][0](style):
        tiles.append(render_frame((name,view,p,an=='ko')))
tiles=[t[10:, 20:] for t in tiles]
h=max(t.shape[0] for t in tiles)
w=max(t.shape[1] for t in tiles)
tiles=[np.pad(t,((0,h-t.shape[0]),(0,w-t.shape[1]),(0,0))) for t in tiles]
cols=int(sys.argv[5]) if len(sys.argv)>5 else 6
while len(tiles)%cols: tiles.append(np.zeros_like(tiles[0]))
sheet=np.concatenate([np.concatenate(tiles[i:i+cols],1) for i in range(0,len(tiles),cols)],0)
im=Image.fromarray(sheet,'RGBA'); bg=Image.new('RGBA',im.size,(80,100,84,255)); bg.alpha_composite(im)
z=int(sys.argv[4]) if len(sys.argv)>4 else 3
bg.resize((im.width*z,im.height*z),Image.NEAREST).save(out)
