export const EVALUATOR_VERSION='mask-seven-v1';
export function cardId(card:string):number {if(!/^[2-9TJQKA][cdhs]$/.test(card))throw Error('Invalid card '+card);return '23456789TJQKA'.indexOf(card[0]!)*4+'cdhs'.indexOf(card[1]!);}
export function cardName(id:number):string {return '23456789TJQKA'[id>>2]!+'cdhs'[id&3]!;}
function straight(mask:number):number {for(let hi=12;hi>=4;hi--)if((mask&(31<<(hi-4)))===(31<<(hi-4)))return hi+2;return (mask&4111)===4111?5:0;}
function top(mask:number,count:number):number {let n=0;while(count--&&mask){const r=31-Math.clz32(mask);n=n*16+r+2;mask&=~(1<<r);}return n;}
/** Direct 5–7-card rank; no five-card subset enumeration. Higher rank wins. */
export function evaluate(cards:readonly number[]):number {
 let once=0,twice=0,thrice=0,four=0,s0=0,s1=0,s2=0,s3=0,c0=0,c1=0,c2=0,c3=0;
 for(let i=0;i<cards.length;i++){const c=cards[i]!,bit=1<<(c>>2);four|=thrice&bit;thrice|=twice&bit;twice|=once&bit;once|=bit;switch(c&3){case 0:s0|=bit;c0++;break;case 1:s1|=bit;c1++;break;case 2:s2|=bit;c2++;break;case 3:s3|=bit;c3++;break;}}
 const flush=c0>=5?s0:c1>=5?s1:c2>=5?s2:c3>=5?s3:0;
 const sf=flush?straight(flush):0;if(sf)return 8*0x1000000+sf*0x10000;
 if(four){const q=31-Math.clz32(four);return 7*0x1000000+(q+2)*0x10000+top(once&~(1<<q),1)*0x1000;}
 if(thrice){const t=31-Math.clz32(thrice),pair=twice&~(1<<t);if(pair)return 6*0x1000000+(t+2)*0x10000+top(pair,1)*0x1000;}
 if(flush)return 5*0x1000000+top(flush,5);
 const st=straight(once);if(st)return 4*0x1000000+st*0x10000;
 if(thrice){const t=31-Math.clz32(thrice);return 3*0x1000000+(t+2)*0x10000+top(once&~(1<<t),2)*0x100;}
 if(twice){const p=31-Math.clz32(twice),rest=twice&~(1<<p);if(rest){const q=31-Math.clz32(rest);return 2*0x1000000+(p+2)*0x10000+(q+2)*0x1000+top(once&~((1<<p)|(1<<q)),1)*0x100;}return 0x1000000+(p+2)*0x10000+top(once&~(1<<p),3)*16;}
 return top(once,5);
}
