/**
 * Generate iOS app assets (App Store icon 1024 + splash) with the same
 * zero-dep PNG encoder as the PWA icons. Capacitor's @capacitor/assets then
 * derives the full icon/splash set from these. Run: node scripts/gen-ios-assets.mjs
 */
import zlib from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "mobile", "resources");
const INK=[10,10,10,255], MARK=[245,245,245,255];
const crcTable=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
const crc32=b=>{let c=0xffffffff;for(let i=0;i<b.length;i++)c=crcTable[(c^b[i])&0xff]^(c>>>8);return(c^0xffffffff)>>>0;};
const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length,0);const ty=Buffer.from(t,"ascii");const cr=Buffer.alloc(4);cr.writeUInt32BE(crc32(Buffer.concat([ty,d])),0);return Buffer.concat([l,ty,d,cr]);};
function png(w,h,rgba){const sig=Buffer.from([137,80,78,71,13,10,26,10]);const ih=Buffer.alloc(13);ih.writeUInt32BE(w,0);ih.writeUInt32BE(h,4);ih[8]=8;ih[9]=6;const st=w*4;const raw=Buffer.alloc((st+1)*h);for(let y=0;y<h;y++){raw[y*(st+1)]=0;rgba.copy(raw,y*(st+1)+1,y*st,(y+1)*st);}return Buffer.concat([sig,chunk("IHDR",ih),chunk("IDAT",zlib.deflateSync(raw,{level:9})),chunk("IEND",Buffer.alloc(0))]);}
function canvas(w,h,bg){const b=Buffer.alloc(w*h*4);for(let i=0;i<w*h;i++)b.set(bg,i*4);return b;}
function rr(buf,W,x0,y0,w,h,r,c){for(let y=y0;y<y0+h;y++)for(let x=x0;x<x0+w;x++){let inside=true;const dxl=x-(x0+r),dxr=x-(x0+w-1-r),dyt=y-(y0+r),dyb=y-(y0+h-1-r);if(x<x0+r&&y<y0+r)inside=dxl*dxl+dyt*dyt<=r*r;else if(x>x0+w-1-r&&y<y0+r)inside=dxr*dxr+dyt*dyt<=r*r;else if(x<x0+r&&y>y0+h-1-r)inside=dxl*dxl+dyb*dyb<=r*r;else if(x>x0+w-1-r&&y>y0+h-1-r)inside=dxr*dxr+dyb*dyb<=r*r;if(inside)buf.set(c,(y*W+x)*4);}}
function bars(buf,W,size,cx,cy){const bw=Math.round(size*0.42),x0=cx-Math.round(bw/2),bh=Math.round(size*0.075),gap=Math.round(size*0.055),tot=bh*3+gap*2;let y=cy-Math.round(tot/2),r=Math.round(bh/2);for(let i=0;i<3;i++){rr(buf,W,x0,y,bw,bh,r,MARK);y+=bh+gap;}}
mkdirSync(OUT,{recursive:true});
// App icon 1024 (opaque, iOS masks corners)
const icon=canvas(1024,1024,INK);bars(icon,1024,1024,512,512);writeFileSync(resolve(OUT,"icon-only.png"),png(1024,1024,icon));
writeFileSync(resolve(OUT,"icon-foreground.png"),png(1024,1024,icon));
writeFileSync(resolve(OUT,"icon-background.png"),png(1024,1024,canvas(1024,1024,INK)));
// Splash 2732x2732 (brand bg + centered mark)
const sp=canvas(2732,2732,INK);bars(sp,2732,900,1366,1366);writeFileSync(resolve(OUT,"splash.png"),png(2732,2732,sp));
writeFileSync(resolve(OUT,"splash-dark.png"),png(2732,2732,sp));
console.log("wrote mobile/resources: icon-only, icon-foreground, icon-background, splash, splash-dark");
