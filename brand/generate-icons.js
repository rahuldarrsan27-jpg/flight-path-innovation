const Jimp = require('jimp');
const path = require('path');
const SRC = '/private/tmp/claude-501/-Users-rahul-Claus/0d7aa981-ad80-4a17-b551-0df8c9b5550b/scratchpad/newlogo.jpeg';
const SC = '/private/tmp/claude-501/-Users-rahul-Claus/0d7aa981-ad80-4a17-b551-0df8c9b5550b/scratchpad';
const PUB = '/Users/rahul/Claus/flight-path-innovation/public';
const ASSETS = path.join(PUB, 'assets');

const isBlue = (r,g,b) => b > 150 && (b - r) > 45 && (b - g) > 25;
const lum = (r,g,b) => 0.299*r + 0.587*g + 0.114*b;

Jimp.read(SRC).then(async (img) => {
  const W = img.bitmap.width, H = img.bitmap.height, d = img.bitmap.data;

  // ---- 1. find the blue circle bbox ----
  const xs=[], ys=[];
  for (let y=0;y<H;y++) for (let x=0;x<W;x++){
    const i=(y*W+x)<<2;
    if (isBlue(d[i],d[i+1],d[i+2])){ xs.push(x); ys.push(y); }
  }
  const med=(arr)=>{const s=arr.slice().sort((a,b)=>a-b);return s[s.length>>1];};
  const cx=med(xs), cy=med(ys);
  const dists=[]; for(let k=0;k<xs.length;k+=4) dists.push(Math.hypot(xs[k]-cx,ys[k]-cy));
  dists.sort((a,b)=>a-b);
  const r=dists[Math.floor(dists.length*0.88)];
  console.log(`circle center ${cx|0},${cy|0} r=${r|0} bluePx=${xs.length}`);

  // crop square around circle, apply circular alpha mask
  const pad=Math.round(r*0.03), size=Math.round(2*(r+pad));
  const x0=Math.round(cx-r-pad), y0=Math.round(cy-r-pad);
  const roundel=img.clone().crop(x0,y0,size,size);
  const rc=size/2, maskR=r*0.965;
  roundel.scan(0,0,size,size,function(x,y,i){
    const dist=Math.hypot(x-rc,y-rc);
    let a=255;
    if(dist>=maskR) a=0; else if(dist>maskR*0.985) a=Math.round((maskR-dist)/(maskR*0.015)*255);
    this.bitmap.data[i+3]=a;
  });
  await roundel.clone().resize(Jimp.AUTO,220).writeAsync(path.join(ASSETS,'logo-mark.png'));
  await roundel.clone().resize(Jimp.AUTO,220).writeAsync(path.join(ASSETS,'logo-mark-light.png'));

  // ---- 2. wordmark band (dark ink below the circle) ----
  const rowInk=new Array(H).fill(0);
  for(let y=Math.round(cy);y<H;y++){ let c=0; for(let x=0;x<W;x++){const i=(y*W+x)<<2; if(lum(d[i],d[i+1],d[i+2])<115)c++;} rowInk[y]=c; }
  const thr=W*0.015; const bands=[]; let s=-1;
  for(let y=Math.round(cy);y<H;y++){ if(rowInk[y]>thr){ if(s<0)s=y; } else if(s>=0){ bands.push([s,y-1]); s=-1; } }
  if(s>=0) bands.push([s,H-1]);
  const tall=bands.filter(b=>b[1]-b[0]>30);
  const [wy0,wy1]=tall[tall.length-1];
  let wMinX=W,wMaxX=0;
  for(let y=wy0;y<=wy1;y++) for(let x=0;x<W;x++){const i=(y*W+x)<<2; if(lum(d[i],d[i+1],d[i+2])<115){ if(x<wMinX)wMinX=x; if(x>wMaxX)wMaxX=x; }}
  const wp=Math.round((wy1-wy0)*0.16);
  const wx=Math.max(0,wMinX-wp), wy=Math.max(0,wy0-wp);
  const ww=Math.min(W-wx,wMaxX-wMinX+2*wp), wh=Math.min(H-wy,wy1-wy0+2*wp);
  console.log(`wordmark x${wx} y${wy} w${ww} h${wh} bands=${JSON.stringify(bands)}`);
  const alphaFor=(r,g,b)=>{const L=lum(r,g,b); if(L>=205)return 0; if(L<=105)return 255; return Math.round((205-L)/100*255);};
  const wm=img.clone().crop(wx,wy,ww,wh);
  const navy=wm.clone(); navy.scan(0,0,ww,wh,function(x,y,i){const b=this.bitmap.data;b[i+3]=alphaFor(b[i],b[i+1],b[i+2]);});
  const white=wm.clone(); white.scan(0,0,ww,wh,function(x,y,i){const b=this.bitmap.data;const a=alphaFor(b[i],b[i+1],b[i+2]);b[i+3]=a;if(a>0){b[i]=238;b[i+1]=242;b[i+2]=246;}});
  await navy.clone().resize(Jimp.AUTO,90).writeAsync(path.join(ASSETS,'logo-wordmark.png'));
  await white.clone().resize(Jimp.AUTO,90).writeAsync(path.join(ASSETS,'logo-wordmark-light.png'));

  // ---- 3. favicons: roundel; 16/32 transparent, app icons on white ----
  const mk=async(name,S,bg)=>{
    const canvas=new Jimp(S,S,bg);
    const inner=Math.round(S*(bg===0x00000000?0.98:0.82));
    const m=roundel.clone().resize(inner,inner);
    canvas.composite(m,Math.round((S-inner)/2),Math.round((S-inner)/2));
    await canvas.writeAsync(path.join(PUB,name));
  };
  await mk('favicon-16.png',16,0x00000000);
  await mk('favicon-32.png',32,0x00000000);
  await mk('apple-touch-icon.png',180,0xffffffff);
  await mk('icon-192.png',192,0xffffffff);
  await mk('icon-512.png',512,0xffffffff);

  // ---- previews on navy (like the site nav) ----
  const prev=new Jimp(760,200,0x0b1420ff);
  prev.composite(roundel.clone().resize(Jimp.AUTO,120),30,40);
  prev.composite(white.clone().resize(Jimp.AUTO,40),190,80);
  await prev.writeAsync(path.join(SC,'nl-preview.png'));
  console.log('DONE');
}).catch(e=>{console.error(e);process.exit(1);});
