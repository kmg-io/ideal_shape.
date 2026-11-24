/* ============================================================
   データ構造・評価ロジック
   ------------------------------------------------------------
   画面遷移は select → crossbreed → result → [retire] → select
   のループになっている。
============================================================ */
const FEMALE_BREEDING_LIMIT = 3; // ここで引退イベント（3択）が発生する
const FEMALE_HARD_LIMIT = 4;     // ここに達すると強制的に選択不可になる
const BASE_AGE = 2; // 繁殖回数0のときの推定年齢

/* 初期の繁殖犬：15頭（オス8・メス7）、すべて純血種。
   現実のブリーダーが飼育できる頭数（1人15頭まで）に合わせている。
   7犬種すべてにオスとメスが1匹ずつ揃っているので、同じ犬種同士を
   選べば純血種が生まれる。（トイプードルのみオスが2匹） */
let dogs = [
  // トイプードル
  {id:'A', name:'ハル', breed:'トイプードル', sex:'F', color:'#D9B370', earType:'floppy', furLength:'long',  size:0.70, breedingCount:0},
  {id:'B', name:'マル', breed:'トイプードル', sex:'M', color:'#C9A15E', earType:'floppy', furLength:'long',  size:0.72, breedingCount:0},
  {id:'C', name:'リク', breed:'トイプードル', sex:'M', color:'#8B5A2B', earType:'floppy', furLength:'long',  size:0.68, breedingCount:0},
  // チワワ
  {id:'D', name:'ココ', breed:'チワワ', sex:'F', color:'#E2C08A', earType:'pointy', furLength:'short', size:0.50, breedingCount:0},
  {id:'E', name:'コウ', breed:'チワワ', sex:'M', color:'#C99B5F', earType:'pointy', furLength:'short', size:0.52, breedingCount:0},
  // 柴犬
  {id:'F', name:'ミト', breed:'柴犬', sex:'F', color:'#C97B4A', earType:'pointy', furLength:'short', size:1.00, breedingCount:0},
  {id:'G', name:'アオ', breed:'柴犬', sex:'M', color:'#B5713C', earType:'pointy', furLength:'short', size:1.05, breedingCount:0},
  // ダックスフンド
  {id:'H', name:'ナナ', breed:'ダックスフンド', sex:'F', color:'#A8552A', earType:'floppy', furLength:'short', size:0.80, breedingCount:0},
  {id:'I', name:'レン', breed:'ダックスフンド', sex:'M', color:'#8B5A2B', earType:'floppy', furLength:'short', size:0.84, breedingCount:0},
  // ビーグル
  {id:'J', name:'モモ', breed:'ビーグル', sex:'F', color:'#B5834A', earType:'floppy', furLength:'short', size:0.90, breedingCount:0},
  {id:'K', name:'タロ', breed:'ビーグル', sex:'M', color:'#A87642', earType:'floppy', furLength:'short', size:0.94, breedingCount:0},
  // ポメラニアン
  {id:'L', name:'ユキ', breed:'ポメラニアン', sex:'F', color:'#EDE4CF', earType:'pointy', furLength:'long',  size:0.55, breedingCount:0},
  {id:'M', name:'ソラ', breed:'ポメラニアン', sex:'M', color:'#D9A066', earType:'pointy', furLength:'long',  size:0.58, breedingCount:0},
  // ラブラドール
  {id:'N', name:'ノア', breed:'ラブラドール', sex:'F', color:'#E3C48A', earType:'floppy', furLength:'short', size:1.08, breedingCount:0},
  {id:'O', name:'ハチ', breed:'ラブラドール', sex:'M', color:'#3A3532', earType:'floppy', furLength:'short', size:1.10, breedingCount:0},
];

/* ---------- 犬ごとの性格・年齢（選択画面の表示用）----------
   性格は犬種ごとの一般的なイメージ（仮）。生まれた子犬は、両親から1つずつ受け継ぐ。
   年齢：メスは「2歳＋繁殖回数」、オスは個体ごとの固定値（仮）。 */
const BREED_TEMPERAMENT = {
  'トイプードル':   ['賢い','人懐っこい'],
  'チワワ':         ['勇敢','警戒心が強い'],
  '柴犬':           ['忠実','頑固'],
  'ダックスフンド': ['好奇心旺盛','活発'],
  'ビーグル':       ['陽気','食いしん坊'],
  'ポメラニアン':   ['元気','おしゃべり'],
  'ラブラドール':   ['穏やか','人懐っこい']
};
const MALE_AGES = {B:3, C:2, E:4, G:3, I:5, K:4, M:2, O:3};
dogs.forEach(d=>{
  d.temperament = (BREED_TEMPERAMENT[d.breed] || []).slice();
  if(d.sex==='M') d.age = MALE_AGES[d.id];
});
function ageOf(d){ return d.sex==='F' ? BASE_AGE + d.breedingCount : (d.age ?? BASE_AGE); }

/* ---------- 収益システム ----------
   売り方によって受け取れる金額が変わる。
   ・ペットショップ：需要に関係なく一律で評価額の80%（手数料20%）
   ・自分で売る：需要が高い犬ほど満額に近く、低い犬は買い手がつきにくく安くなる
   → 「人気の犬は自分で売った方が得、人気のない犬はペットショップに任せた方が得」
     という判断を毎回プレイヤーにさせる。
   ・引退した母犬：自分で売れば評価額の50%が収益、里親に出す場合は無償
------------------------------------------------------------ */
const SHOP_RATE = 0.8;
const RETIRED_SELL_RATE = 0.5;
let totalRevenue = 0;

function roundYen(n){ return Math.round(n/500)*500; }
function selfSellRate(popularity){
  if(popularity >= 4) return 1.0;
  if(popularity === 3) return 0.85;
  return 0.6;
}
function formatYen(n){ return '¥' + n.toLocaleString(); }

/* ---------- 体験の長さ ----------
   ・いつでも「体験を終了する」ボタンで終われる
   ・繁殖が5回終わると「終了」か「もう少し続ける（+5回）」を選ぶ
   ・10回に達したら必ず終了
------------------------------------------------------------ */
const ROUNDS_FIRST = 5;
const ROUNDS_EXTEND = 5;
const ROUNDS_ABSOLUTE_MAX = 10;
let roundCount = 0;            // 完了した繁殖の回数
let maxRounds = ROUNDS_FIRST;  // 現在の上限

/* ---------- 全記録（最終画面の記録簿用）----------
   allDogs: 初期犬＋生まれた子犬すべて（売ったり手放した犬も残す）
   outcomes: 犬のid → {status:'sold'|'adopted', amount}
------------------------------------------------------------ */
let allDogs = dogs.slice();
let outcomes = {};

let childCounter = 1;
let selectedMaleId = null;
let selectedFemaleId = null;
let lastChild = null, lastParents = null, retirePending = null;

let currentIdeal = { color:[139,90,43], earType:'floppy', furLength:'long', size:0.75 };
let previousIdeal = null;

function cloneIdeal(i){ return {color:[...i.color], earType:i.earType, furLength:i.furLength, size:i.size}; }
/* 流行の毛色は、実際の犬にいる自然な毛色の中だけで移り変わる。
   （以前は赤・緑・青を別々にランダムに動かしていたため、
    世代が進むとビビットなピンクなど不自然な色に偏っていた） */
const NATURAL_COATS = [
  [237,235,227], // ホワイト
  [233,215,176], // クリーム
  [217,179,112], // アプリコット
  [201,155, 95], // フォーン
  [201,123, 74], // レッド
  [139, 90, 43], // ブラウン
  [ 90, 60, 35], // ダークブラウン
  [150,148,142], // グレー
  [ 50, 45, 42]  // ブラック
];
function nextIdeal(prev){
  const next = cloneIdeal(prev);
  // 前の色から、自然な毛色のどれかへ向かって半分ほど寄せる
  const target = NATURAL_COATS[Math.floor(Math.random()*NATURAL_COATS.length)];
  next.color = prev.color.map((c,i)=> c + (target[i]-c)*0.5);
  if(Math.random() < 0.3) next.earType = prev.earType==='floppy' ? 'pointy':'floppy';
  if(Math.random() < 0.3) next.furLength = prev.furLength==='short' ? 'long':'short';
  next.size = Math.max(0.4, Math.min(1.1, prev.size + (Math.random()-0.5)*0.3));
  return next;
}
function describeIdeal(ideal){
  const earText = ideal.earType==='floppy' ? '垂れ耳' : '立ち耳';
  const furText = ideal.furLength==='long' ? '長毛' : '短毛';
  const sizeText = ideal.size < 0.6 ? '小型' : ideal.size < 0.9 ? '中型' : '大型';
  return `${earText}・${furText}・${sizeText}`;
}

function hexToRgb(hex){ const v=hex.replace('#',''); return [parseInt(v.slice(0,2),16),parseInt(v.slice(2,4),16),parseInt(v.slice(4,6),16)]; }
function rgbToHex([r,g,b]){ return '#'+[r,g,b].map(x=>Math.round(Math.max(0,Math.min(255,x))).toString(16).padStart(2,'0')).join(''); }
function mix(c1,c2,t){ return c1.map((v,i)=> v+(c2[i]-v)*t); }

function computeEvaluation(dog, ideal){
  const rgb = hexToRgb(dog.color);
  const colorDist = Math.sqrt(rgb.reduce((s,c,i)=>s+Math.pow(c-ideal.color[i],2),0)) / 441.7;
  let standard = 100 - colorDist*45 - (dog.earType!==ideal.earType?15:0) - (dog.furLength!==ideal.furLength?12:0) - Math.abs(dog.size-ideal.size)*55;
  standard = Math.round(Math.max(3, Math.min(99, standard)));
  const rarityBonus = colorDist*30;
  const popularity = Math.max(1, Math.min(5, Math.round((standard*0.55+rarityBonus*0.45)/20)));
  const price = Math.round((standard*400 + popularity*22000)/500)*500;
  return {standard, popularity, price};
}
function starString(n){ return '★'.repeat(n) + '☆'.repeat(5-n); }

/* ===== BALLOON DOG START ===================================================
   犬の見た目は「バルーンドッグ」。風船のパーツ（胴・頭・口・耳・足・しっぽ）を
   ねじってつないだ形で描く。ゲームのデータ（毛色・耳・毛の長さ・体格）は
   これまでどおり使い、犬種の違いは「パーツの比率」だけで表す。
   ※ 見た目だけの変更。評価・繁殖・収益などのロジックには触れていない。
============================================================================ */
const BALLOON_BASE = {bodyRx:40, bodyRy:17, legH:28, legW:9, headRx:19, headRy:16, muzzle:14, earScale:1, tail:'up', tailLen:1};

/* 犬種ごとの比率（どれも同じ大きさを基準にした比率。全体の大小は dog.size が担当）
   bodyRx/bodyRy:胴の長さ/太さ  legH/legW:足の長さ/太さ  headRx/headRy:頭  muzzle:口の長さ
   earScale:耳の大きさ  tail:'up'（立つ）|'curl'（くるん）  tailLen:しっぽの長さ        */
const BREED_SHAPES = {
  'トイプードル':   {bodyRx:36, bodyRy:15, legH:30, legW:8,  headRx:18, headRy:15, muzzle:15, earScale:1.25, tail:'up',   tailLen:1},
  'チワワ':         {bodyRx:30, bodyRy:13, legH:24, legW:7,  headRx:25, headRy:22, muzzle:11, earScale:1.4,  tail:'up',   tailLen:0.9},
  '柴犬':           {bodyRx:38, bodyRy:17, legH:28, legW:9,  headRx:19, headRy:16, muzzle:13, earScale:0.85, tail:'curl', tailLen:1},
  'ダックスフンド': {bodyRx:58, bodyRy:14, legH:13, legW:9,  headRx:17, headRy:14, muzzle:17, earScale:1.1,  tail:'up',   tailLen:1},
  'ビーグル':       {bodyRx:42, bodyRy:17, legH:28, legW:9,  headRx:19, headRy:16, muzzle:15, earScale:1.2,  tail:'up',   tailLen:1},
  'ポメラニアン':   {bodyRx:32, bodyRy:16, legH:21, legW:8,  headRx:22, headRy:19, muzzle:9,  earScale:0.7,  tail:'curl', tailLen:1.2},
  'ラブラドール':   {bodyRx:46, bodyRy:20, legH:34, legW:11, headRx:21, headRy:17, muzzle:18, earScale:1.0,  tail:'up',   tailLen:1.3},
  // ↓ まだゲームには登場しない犬種（追加するときは、犬のデータの breed にこの名前を書くだけ）
  'コーギー':             {bodyRx:50, bodyRy:16, legH:13, legW:9,  headRx:19, headRy:16, muzzle:14, earScale:1.6, tail:'up', tailLen:0.5},
  'フレンチブルドッグ':   {bodyRx:30, bodyRy:20, legH:20, legW:11, headRx:23, headRy:20, muzzle:8,  earScale:1.5, tail:'up', tailLen:0.5}
};

const BALLOON_FIT = 1.25;  // 枠いっぱいに見えるようにする全体の拡大率（比率には影響しない）
function shapeOf(dog){ return dog.shape || BREED_SHAPES[dog.breed] || BALLOON_BASE; }

// ミックス：両親の比率をまぜる（毎回少しだけばらつく）
function blendShape(a, b){
  const out = {};
  Object.keys(BALLOON_BASE).forEach(k=>{
    if(typeof BALLOON_BASE[k] === 'number'){
      const w = 0.35 + Math.random()*0.3;
      out[k] = (a[k]*w + b[k]*(1-w)) * (0.96 + Math.random()*0.08);
    } else {
      out[k] = Math.random()<0.5 ? a[k] : b[k];
    }
  });
  return out;
}

function balloonDogSVG(dog){
  const p = shapeOf(dog);
  const s = dog.size;
  const color = dog.color;
  const rgb = hexToRgb(color);
  const edge = rgbToHex(rgb.map(c=>c*0.66));   // 風船のふち
  const back = rgbToHex(rgb.map(c=>c*0.84));   // 奥側のパーツ（少し暗く）
  const G = 172, cx = 98;                       // 地面の高さ／胴の中心
  const cy = G - p.legH - p.bodyRy + 4;         // 胴の中心の高さ

  // 風船ひとつぶん：本体＋つや（白いハイライト）
  const bal = (x,y,rx,ry,rot=0,fill=color) =>
    `<g transform="rotate(${rot.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})">`+
    `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" fill="${fill}" stroke="${edge}" stroke-width="1.6"/>`+
    `<ellipse cx="${(x-rx*0.32).toFixed(1)}" cy="${(y-ry*0.42).toFixed(1)}" rx="${Math.max(1.5,rx*0.28).toFixed(1)}" ry="${Math.max(1.2,ry*0.17).toFixed(1)}" fill="#fff" opacity="0.5"/></g>`;
  // ねじり目（風船をひねった所）
  const knot = (x,y,rot=0) =>
    `<g transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})"><ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="3.6" ry="1.7" fill="${edge}"/>`+
    `<ellipse cx="${(x-1).toFixed(1)}" cy="${(y-0.4).toFixed(1)}" rx="1.3" ry="0.5" fill="#fff" opacity="0.4"/></g>`;

  const es = p.earScale;
  const legRx = p.legW/2, legRy = (p.legH+12)/2, legCy = G - legRy;
  const hindX = cx - p.bodyRx*0.6, frontX = cx + p.bodyRx*0.6;
  const hx = cx + p.bodyRx*0.92 + p.headRx*0.35;
  const hy = cy - p.bodyRy*0.95 - p.headRy*0.55;
  const tbx = cx - p.bodyRx + 2, tby = cy - p.bodyRy*0.35;   // しっぽの付け根
  const long = dog.furLength === 'long';

  const parts = [];
  parts.push(`<ellipse cx="${cx+10}" cy="${G}" rx="${p.bodyRx+34}" ry="7" fill="#2B2621" opacity="0.09"/>`);
  // 奥の足
  parts.push(bal(hindX+8,  legCy, legRx, legRy, 0, back));
  parts.push(bal(frontX+8, legCy, legRx, legRy, 0, back));
  // しっぽ
  let tipX, tipY;
  if(p.tail === 'curl'){
    const r = 7*p.tailLen, tx = tbx-6, ty = tby-12*p.tailLen;
    parts.push(`<circle cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${edge}" stroke-width="9"/>`);
    parts.push(`<circle cx="${tx.toFixed(1)}" cy="${ty.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="${color}" stroke-width="5.6"/>`);
    tipX = tx; tipY = ty - r;
  } else {
    const len = 11*p.tailLen;
    parts.push(bal(tbx-6, tby-len*0.8, 4.6, len, -26));
    tipX = tbx-6-len*0.42; tipY = tby-len*1.7;
  }
  parts.push(knot(tbx, tby, 40));
  // 体
  parts.push(bal(cx, cy, p.bodyRx, p.bodyRy, 0));
  // 手前の足（上にねじり目）
  parts.push(bal(hindX,  legCy, legRx, legRy, 0));
  parts.push(bal(frontX, legCy, legRx, legRy, 0));
  parts.push(knot(hindX,  G - p.legH + 2));
  parts.push(knot(frontX, G - p.legH + 2));
  // 首 → 奥の耳 → 頭 → 口 → 手前の耳
  parts.push(bal(cx + p.bodyRx*0.86, cy - p.bodyRy*0.8, 9, p.headRy*0.85, 28));
  if(dog.earType === 'floppy'){
    parts.push(bal(hx+4, hy + p.headRy*0.35, 5.8*es, 11.5*es, 10, back));
  } else {
    parts.push(bal(hx + p.headRx*0.1, hy - p.headRy*1.0, 4.8*es, 11.5*es, 10, back));
  }
  parts.push(bal(hx, hy, p.headRx, p.headRy, 0));
  const mrx = p.muzzle/2 + 2, mry = p.headRy*0.44, mx = hx + p.headRx*0.78, my = hy + p.headRy*0.32;
  parts.push(bal(mx, my, mrx, mry, 0));
  parts.push(`<circle cx="${(mx+mrx*0.82).toFixed(1)}" cy="${(my-mry*0.25).toFixed(1)}" r="2.3" fill="#2B2621"/>`);
  parts.push(`<circle cx="${(hx+p.headRx*0.3).toFixed(1)}" cy="${(hy-p.headRy*0.18).toFixed(1)}" r="2.1" fill="#2B2621"/>`);
  if(dog.earType === 'floppy'){
    parts.push(bal(hx - p.headRx*0.3, hy + p.headRy*0.5, 6.6*es, 13*es, 12));
    parts.push(knot(hx - p.headRx*0.3, hy - p.headRy*0.1, 20));
  } else {
    parts.push(bal(hx - p.headRx*0.3, hy - p.headRy*0.98, 5.4*es, 12.5*es, -8));
    parts.push(knot(hx - p.headRx*0.3, hy - p.headRy*0.62, 0));
  }
  // 長毛：ふわふわの小さな風船（頭のてっぺん・足先・しっぽの先）
  if(long){
    const pf = (x,y,r)=> bal(x,y,r,r,0);
    parts.push(pf(hx-1,  hy-p.headRy-4, 6.8), pf(hx+8, hy-p.headRy-1, 5.2), pf(hx-10, hy-p.headRy-1, 5.2));
    const r = p.legW*0.8+1.5;
    [hindX, frontX].forEach(x=> parts.push(pf(x, G-r*0.7, r)));
    parts.push(pf(tipX, tipY, 6.5), pf(tipX-6, tipY+4, 4.8));
  }
  return `<svg viewBox="0 0 220 190" xmlns="http://www.w3.org/2000/svg">
    <g transform="translate(110 ${G}) scale(${(s*BALLOON_FIT).toFixed(3)}) translate(-110 -${G})">${parts.join('')}</g>
  </svg>`;
}
/* ===== BALLOON DOG END ===================================================== */

function dogSVG(dog){ return balloonDogSVG(dog); }

/* ---------- 画面切り替え ---------- */
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  // 「売る／残す」の判断が途中の画面では終了ボタンを押せない。最終画面では非表示。
  document.body.classList.toggle('ending', id==='screen-ending');
  document.body.classList.toggle('sel', id==='screen-select'); // 選択画面ではヘッダーの小さい理想像を隠す
  if(id==='screen-select') requestAnimationFrame(()=>layoutCarousel()); // 表示された後でないと幅が測れない // 最終画面ではヘッダー表示を隠す
  document.body.classList.toggle('op', id==='screen-title' || id==='screen-intro' || id==='screen-about'); // OP画面ではヘッダー全体を隠す
  const endBtn = document.getElementById('endBtn');
  endBtn.disabled = (id==='screen-result' || id==='screen-retire');
  endBtn.style.display = (id==='screen-ending') ? 'none' : '';
}

/* ---------- ヘッダー ---------- */
function idealAsDog(ideal){
  return { color: rgbToHex(ideal.color), earType: ideal.earType, furLength: ideal.furLength, size: ideal.size };
}

function renderHeader(){
  document.getElementById('genBadge').textContent = `繁殖 ${roundCount} / ${maxRounds}`;
  document.getElementById('revenueBadge').textContent = `総収益 ${formatYen(totalRevenue)}`;
  document.getElementById('trendIconMini').innerHTML = dogSVG(idealAsDog(currentIdeal));
  document.getElementById('trendText').innerHTML = `今季の理想像：<b>${describeIdeal(currentIdeal)}</b>`;
}

/* ---------- 理想像モーダル ---------- */
/* ---------- 社会の需要を伝える「人」（仮の簡易イラスト）----------
   季節ごとに違う人が理想の犬を吹き出しで語る。毎回ランダムで別の人になる
   ことで、「特定の誰か」ではなく「社会」の声として見せる。 */
const PERSON_LOOKS = [
  {skin:'#F1CFA8', hair:'#2B2621', shirt:'#7A2E2E', style:'short'},
  {skin:'#E8BE96', hair:'#6B4423', shirt:'#3B4A3A', style:'long'},
  {skin:'#F4D7B5', hair:'#A9822C', shirt:'#5A6B7A', style:'bun'},
  {skin:'#D9A87C', hair:'#2B2621', shirt:'#A9822C', style:'long'},
  {skin:'#F1CFA8', hair:'#8A8680', shirt:'#4A5A4A', style:'short'}
];
function personSVG(v){
  let hairBack = '', hairFront = `<path d="M26 50 Q26 24 50 24 Q74 24 74 50 Q66 37 50 37 Q34 37 26 50 Z" fill="${v.hair}"/>`;
  if(v.style==='long'){
    hairBack = `<rect x="24" y="40" width="52" height="44" rx="22" fill="${v.hair}"/>`;
  } else if(v.style==='bun'){
    hairFront += `<circle cx="50" cy="20" r="9" fill="${v.hair}"/>`;
  }
  return `<svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg">
    ${hairBack}
    <path d="M12 130 Q12 84 50 84 Q88 84 88 130 Z" fill="${v.shirt}"/>
    <rect x="43" y="68" width="14" height="18" fill="${v.skin}"/>
    <circle cx="50" cy="52" r="24" fill="${v.skin}"/>
    ${hairFront}
    <circle cx="41" cy="55" r="2.2" fill="#2B2621"/>
    <circle cx="59" cy="55" r="2.2" fill="#2B2621"/>
    <path d="M44 65 Q50 70 56 65" stroke="#2B2621" stroke-width="2" fill="none" stroke-linecap="round"/>
  </svg>`;
}

let currentPersonLook = null;
function pickPerson(){ currentPersonLook = PERSON_LOOKS[Math.floor(Math.random()*PERSON_LOOKS.length)]; }

function showIdealModal(){
  document.getElementById('idealPerson').innerHTML = personSVG(currentPersonLook);
  document.getElementById('idealModalIcon').innerHTML = dogSVG(idealAsDog(currentIdeal));
  const earText = currentIdeal.earType==='floppy' ? '垂れ耳' : '立ち耳';
  const furText = currentIdeal.furLength==='long' ? '長毛' : '短毛';
  const sizeText = currentIdeal.size < 0.6 ? '小型' : currentIdeal.size < 0.9 ? '中型' : '大型';
  document.getElementById('idealModalDesc').innerHTML = `耳：<b>${earText}</b>／毛：<b>${furText}</b>／体格：<b>${sizeText}</b>`;
  document.getElementById('idealModal').classList.add('show');
}
function hideIdealModal(){
  document.getElementById('idealModal').classList.remove('show');
}
document.getElementById('idealModalOk').addEventListener('click', ()=>{
  hideIdealModal();
  showScreen('screen-select');
});

/* ---------- SELECT 画面（メイン画面）----------
   左下の横一覧をスワイプして犬を決める → 左上に大きく情報が出る
   「この犬を親にする」で右下の ♂/♀ の枠に入る。両方そろうと交配へ進める。
------------------------------------------------------------ */
const $ = id => document.getElementById(id);
const CAR_CARD_W = 82, CAR_GAP = 12, CAR_STEP = CAR_CARD_W + CAR_GAP;
let carFilter = 'all';   // 'all' | 'M' | 'F'   ← ♂♀を混ぜるか分けるかは、ここで切り替えて試せる
let carIndex = 0;
let carList = [];

function isExhausted(d){ return d.sex==='F' && d.breedingCount >= FEMALE_HARD_LIMIT; }
function isPicked(d){ return d.id===selectedMaleId || d.id===selectedFemaleId; }

function showWarning(msg){
  const el = $('warningMsg');
  el.textContent = msg;
  clearTimeout(showWarning._t);
  showWarning._t = setTimeout(()=>{ el.textContent=''; }, 2600);
}

/* --- 右上：市場の流行（人＋吹き出し）--- */
function renderTrendPanel(){
  $('trendPerson').innerHTML = personSVG(currentPersonLook);
  $('trendDog').innerHTML = dogSVG(idealAsDog(currentIdeal));
  $('trendDesc').innerHTML = `<b>${describeIdeal(currentIdeal)}</b>`;
}

/* --- 右下：親犬の枠 --- */
function renderSlots(){
  const fill = (el, d, sex) => {
    el.className = 'pslot' + (d ? ' filled' : '');
    el.innerHTML = d
      ? `<button class="x" data-x="${sex}" aria-label="選択を外す">×</button><div class="icon-box">${dogSVG(d)}</div><div class="pn">${d.name}</div><div class="pb">${d.breed}</div>`
      : `<div class="pe">未選択</div>`;
  };
  const male = dogs.find(d=>d.id===selectedMaleId);
  const female = dogs.find(d=>d.id===selectedFemaleId);
  fill($('slotM'), male, 'M');
  fill($('slotF'), female, 'F');
  $('nextBtn').disabled = !(male && female);
}
['M','F'].forEach(sex=>{
  $(sex==='M'?'slotM':'slotF').addEventListener('click', e=>{
    if(e.target.closest('.x')){ if(sex==='M') selectedMaleId=null; else selectedFemaleId=null; afterPickChange(); return; }
    const id = sex==='M' ? selectedMaleId : selectedFemaleId;
    if(id) focusDog(id);   // 枠をクリックすると、その犬を一覧の中央に呼び戻す
  });
});

/* --- 左上：大きな犬の情報 --- */
function renderBig(dir){
  const d = carList[carIndex];
  const info = $('bigInfo'), dogBox = $('bigDog'), btn = $('pickBtn');
  if(!d){ info.innerHTML=''; dogBox.innerHTML=''; btn.hidden = true; return; }
  btn.hidden = false;
  const ev = computeEvaluation(d, currentIdeal);
  const exh = isExhausted(d), picked = isPicked(d);
  info.innerHTML = `
    <div class="big-name">${d.name}<span class="sx ${d.sex}">${d.sex==='M'?'♂':'♀'}</span></div>
    <div class="big-lines">
      <div><span>犬種</span>${d.breed}</div>
      <div><span>性格</span>${(d.temperament||[]).join('・') || '—'}</div>
      <div><span>コート</span>${d.furLength==='long'?'長毛':'短毛'}</div>
      <div><span>年齢</span>${ageOf(d)}歳</div>
    </div>
    <div class="big-sub">人気 <span class="stars">${starString(ev.popularity)}</span>　犬種標準 ${ev.standard}%${
      d.sex==='F' ? `<br>${exh ? '生涯出産回数に達しています' : '繁殖 '+d.breedingCount+' / '+FEMALE_BREEDING_LIMIT}` : ''}</div>`;
  dogBox.innerHTML = `<div class="bd-inner">${dogSVG(d)}</div>`;
  btn.disabled = exh && !picked;
  btn.classList.toggle('picked', picked);
  btn.textContent = exh ? '繁殖できません' : picked ? '選択を外す' : 'この犬を親にする';
  if(dir){ // 切り替わりの動き（スワイプの向きに合わせて滑り込む）
    const cls = dir>0 ? 'swapL' : 'swapR';
    [info, dogBox.firstElementChild].forEach(el=>{ el.classList.remove('swapL','swapR'); void el.offsetWidth; el.classList.add(cls); });
  }
}

$('pickBtn').addEventListener('click', ()=>{
  const d = carList[carIndex]; if(!d) return;
  if(isPicked(d)){
    if(d.sex==='M') selectedMaleId = null; else selectedFemaleId = null;
  } else {
    if(isExhausted(d)){ showWarning(`${d.name}は生涯出産回数の上限に達しており、選択できません。`); return; }
    if(d.sex==='M') selectedMaleId = d.id; else selectedFemaleId = d.id;
  }
  afterPickChange();
});
function afterPickChange(){
  renderSlots();
  $('carTrack').querySelectorAll('.car-card').forEach((el,i)=> el.classList.toggle('sel', isPicked(carList[i])));
  renderBig(0);
}

/* --- 左下：横スワイプの一覧 --- */
function refreshCarList(keepId){
  carList = dogs.filter(d=> carFilter==='all' || d.sex===carFilter);
  const i = keepId ? carList.findIndex(d=>d.id===keepId) : -1;
  carIndex = i>=0 ? i : Math.min(carIndex, Math.max(0, carList.length-1));
}
function renderCarousel(){
  $('carTrack').innerHTML = carList.map((d,i)=>`
    <div class="car-card${isPicked(d)?' sel':''}${isExhausted(d)?' exh':''}" data-i="${i}">
      <span class="cs ${d.sex}">${d.sex==='M'?'♂':'♀'}</span>
      <div class="icon-box">${dogSVG(d)}</div>
      <div class="cn">${d.name}</div>
    </div>`).join('');
  layoutCarousel();
}
// 中央に来る犬ほど大きく・はっきり見せる。ドラッグ中は dragDx 分だけずらす。
function layoutCarousel(dragDx=0){
  const vp = $('carViewport'), track = $('carTrack');
  const W = vp.clientWidth;
  if(!W) return;
  const base = W/2 - (carIndex*CAR_STEP + CAR_CARD_W/2) + dragDx;
  track.style.transform = `translateX(${base}px)`;
  track.querySelectorAll('.car-card').forEach((c,i)=>{
    const dist = Math.abs(i*CAR_STEP + CAR_CARD_W/2 + base - W/2) / CAR_STEP;
    c.style.transform = `scale(${(1.14 - 0.2*Math.min(dist,1.5)).toFixed(3)})`;
    c.style.opacity = (1 - 0.28*Math.min(dist,2.2)).toFixed(3);
  });
}
function setIndex(i){
  if(!carList.length) return;
  i = Math.max(0, Math.min(carList.length-1, i));
  const dir = i===carIndex ? 0 : (i>carIndex ? 1 : -1);
  carIndex = i;
  layoutCarousel();
  if(dir) renderBig(dir);
}
function setFilter(f, keepId){
  carFilter = f;
  document.querySelectorAll('#carFilter .car-chip').forEach(b=> b.classList.toggle('on', b.dataset.f===f));
  refreshCarList(keepId || (carList[carIndex] && carList[carIndex].id));
  renderCarousel(); renderBig(0);
}
function focusDog(id){
  if(!carList.some(d=>d.id===id)){ setFilter('all', id); return; }
  setIndex(carList.findIndex(d=>d.id===id));
}
document.querySelectorAll('#carFilter .car-chip').forEach(b=> b.addEventListener('click', ()=> setFilter(b.dataset.f)));
$('carPrev').addEventListener('click', ()=> setIndex(carIndex-1));
$('carNext').addEventListener('click', ()=> setIndex(carIndex+1));

// スワイプ（マウスのドラッグ・タッチ・ホイール・矢印キー）
(function initSwipe(){
  const vp = $('carViewport'), track = $('carTrack');
  let down=false, moved=false, startX=0, dx=0, t0=0, downCard=null;
  vp.addEventListener('pointerdown', e=>{
    if(e.button!==undefined && e.button!==0) return;
    down=true; moved=false; startX=e.clientX; dx=0; t0=performance.now();
    downCard = e.target.closest('.car-card');
    track.classList.add('dragging'); vp.classList.add('dragging');
    vp.setPointerCapture(e.pointerId);
  });
  vp.addEventListener('pointermove', e=>{
    if(!down) return;
    dx = e.clientX - startX;
    if(Math.abs(dx) > 6) moved = true;
    if(moved) layoutCarousel(dx);
  });
  const end = ()=>{
    if(!down) return;
    down=false; track.classList.remove('dragging'); vp.classList.remove('dragging');
    if(moved){
      const v = dx / Math.max(1, performance.now()-t0);             // 速さ（px/ms）
      let steps = -Math.round(dx / CAR_STEP);
      if(steps===0 && Math.abs(v) > 0.5) steps = v>0 ? -1 : 1;      // 素早く払う（フリック）
      setIndex(carIndex + steps);
    } else if(downCard){
      setIndex(+downCard.dataset.i);                                // タップした犬を中央へ
    } else {
      layoutCarousel();
    }
  };
  vp.addEventListener('pointerup', end);
  vp.addEventListener('pointercancel', end);
  let wheelLock = 0;
  vp.addEventListener('wheel', e=>{
    e.preventDefault();
    const now = performance.now(); if(now < wheelLock) return;
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if(Math.abs(d) < 8) return;
    wheelLock = now + 180;
    setIndex(carIndex + (d>0 ? 1 : -1));
  }, {passive:false});
  document.addEventListener('keydown', e=>{
    if(!$('screen-select').classList.contains('active')) return;
    if(document.querySelector('.modal-overlay.show')) return;
    if(e.key==='ArrowLeft') setIndex(carIndex-1);
    else if(e.key==='ArrowRight') setIndex(carIndex+1);
  });
  window.addEventListener('resize', ()=> layoutCarousel());
})();

// 選択画面をまるごと描き直す（ラウンドの始まりと初期化で使う）
function renderSelect(){
  refreshCarList();
  renderCarousel(); renderBig(0); renderSlots(); renderTrendPanel();
}

document.getElementById('nextBtn').addEventListener('click', ()=>{
  if(!selectedMaleId || !selectedFemaleId) return;
  renderCrossbreedScreen();
  showScreen('screen-crossbreed');
});

/* ---------- CROSSBREED 画面 ---------- */
function renderCrossbreedScreen(){
  const male = dogs.find(d=>d.id===selectedMaleId);
  const female = dogs.find(d=>d.id===selectedFemaleId);
  document.getElementById('cbMaleIcon').innerHTML = dogSVG(male);
  document.getElementById('cbFemaleIcon').innerHTML = dogSVG(female);
  document.getElementById('cbMaleLabel').textContent = `♂ ${male.name}（${male.breed}）`;
  document.getElementById('cbFemaleLabel').textContent = `♀ ${female.name}（${female.breed}）`;
}

document.getElementById('startBreedBtn').addEventListener('click', ()=>{
  const male = dogs.find(d=>d.id===selectedMaleId);
  const female = dogs.find(d=>d.id===selectedFemaleId);
  lastChild = breed(male, female);
  lastParents = {male, female};
  roundCount++;
  lastChild.round = roundCount;
  allDogs.push(lastChild);
  renderHeader();
  female.breedingCount++;
  // 引退イベントは、ちょうど上限回数(3回)に達した瞬間だけ表示する。
  // ここで「繁殖犬として残す」を選んだ場合、4回目の繁殖も可能になるが、
  // 4回目以降は自動的に選択不可になる（FEMALE_HARD_LIMITで判定）ため、
  // このイベントを再度表示する必要はない。
  retirePending = (female.breedingCount === FEMALE_BREEDING_LIMIT) ? female : null;
  renderResultScreen();
  showScreen('screen-result');
});

/* ---------- 繁殖ロジック ----------
   親の特徴＋ランダム性で子犬の見た目を決定する。
   ・毛色：両親の色をランダムな比率でブレンド（10%で突然変異）
   ・耳の形／毛の長さ：どちらかの親から遺伝（10%で突然変異）
   ・サイズ：両親の平均±ランダムなブレ
   ・犬種：両親が同じ犬種なら純血種、違えばミックスとして命名
   評価（犬種標準・人気・価格）はここでは計算しない。表示のたびに
   「今季の理想像」と比較して計算し直す（流行が変われば同じ犬でも
   評価が変わる）ため。
------------------------------------------------------------ */
function breed(parentA, parentB){
  const rand = Math.random;
  const t = rand();
  let colorRgb = mix(hexToRgb(parentA.color), hexToRgb(parentB.color), t);
  if(rand()<0.1){
    // 突然変異は明るさだけを変える（色相は変えない）。
    // 以前は赤・緑・青を別々に動かしていたため、不自然な色の子犬が生まれていた
    const factor = 0.75 + rand()*0.5; // 0.75〜1.25倍（比率が保たれるので色相は変わらない）
    colorRgb = colorRgb.map(c=>Math.min(255, c*factor));
  }
  const color = rgbToHex(colorRgb);
  let earType = rand()<0.5 ? parentA.earType : parentB.earType;
  if(rand()<0.1) earType = earType==='floppy'?'pointy':'floppy';
  let furLength = rand()<0.5 ? parentA.furLength : parentB.furLength;
  if(rand()<0.1) furLength = furLength==='short'?'long':'short';
  let size = (parentA.size+parentB.size)/2 + (rand()-0.5)*0.15;
  size = Math.max(0.4, Math.min(1.1, size));
  const sex = rand()<0.5 ? 'M':'F';
  // 性格：両親から1つずつ受け継ぐ（同じ場合は1つ）
  const pick = arr => arr && arr.length ? arr[Math.floor(rand()*arr.length)] : null;
  const temperament = [...new Set([pick(parentA.temperament), pick(parentB.temperament)].filter(Boolean))];
  childCounter++;
  const breedLabel = (parentA.breed===parentB.breed) ? parentA.breed : `ミックス（${parentA.breed} × ${parentB.breed}）`;
  return { id:'child'+childCounter, name:'子犬 #'+childCounter, breed:breedLabel, sex, color, earType, furLength, size, breedingCount:0, temperament, age:BASE_AGE, shape: blendShape(shapeOf(parentA), shapeOf(parentB)) };
}

/* ---------- RESULT 画面 ---------- */
function renderResultScreen(){
  const ev = computeEvaluation(lastChild, currentIdeal);
  document.getElementById('resultTitle').textContent = `${lastChild.name} が生まれた`;
  document.getElementById('pupIcon').innerHTML = dogSVG(lastChild);
  document.getElementById('infoPanel').innerHTML = `
    <div>犬種：${lastChild.breed}</div>
    <div>性別：${lastChild.sex==='M'?'♂ 男の子':'♀ 女の子'}</div>
    <div>毛の長さ：${lastChild.furLength==='long'?'長毛':'短毛'}</div>
    <div>耳：${lastChild.earType==='floppy'?'垂れ耳':'立ち耳'}</div>
    <div>犬種標準：${ev.standard}%</div>
    <div>売値：¥${ev.price.toLocaleString()}</div>
    <div class="demand">需要 ${starString(ev.popularity)}</div>
  `;
  // 売り方ごとの受取額を計算してボタンに表示する
  lastOffers = {
    shop: roundYen(ev.price * SHOP_RATE),
    self: roundYen(ev.price * selfSellRate(ev.popularity))
  };
  document.getElementById('shopBtn').textContent = `ペットショップへ売る（${formatYen(lastOffers.shop)}）`;
  document.getElementById('selfSellBtn').textContent = `自分で売る（${formatYen(lastOffers.self)}）`;
}

let lastOffers = {shop:0, self:0};

function afterResultAction(keepChild, earned){
  if(keepChild){
    dogs.push(lastChild);
  } else {
    outcomes[lastChild.id] = {status:'sold', amount: earned || 0};
  }
  totalRevenue += (earned || 0);
  renderHeader();
  if(retirePending){
    renderRetireScreen();
    showScreen('screen-retire');
  } else {
    advanceGeneration();
  }
}
document.getElementById('keepBtn').addEventListener('click', ()=> afterResultAction(true, 0));
document.getElementById('shopBtn').addEventListener('click', ()=> afterResultAction(false, lastOffers.shop));
document.getElementById('selfSellBtn').addEventListener('click', ()=> afterResultAction(false, lastOffers.self));

/* ---------- RETIRE 画面 ---------- */
function renderRetireScreen(){
  const f = retirePending;
  document.getElementById('retireIcon').innerHTML = dogSVG(f);
  document.getElementById('retireLabel').textContent = `♀ ${f.name}（${f.breed}） ${BASE_AGE+f.breedingCount}歳`;
  retireSellAmount = roundYen(computeEvaluation(f, currentIdeal).price * RETIRED_SELL_RATE);
  document.getElementById('retireAdoptBtn').textContent = '里親に出す（無償）';
  document.getElementById('retireSellBtn').textContent = `自分で売る（${formatYen(retireSellAmount)}）`;
}
let retireSellAmount = 0;

function finishRetire(remove, earned){
  if(remove){
    dogs = dogs.filter(d=>d.id!==retirePending.id);
    outcomes[retirePending.id] = (earned > 0)
      ? {status:'sold', amount: earned}
      : {status:'adopted', amount: 0};
  }
  totalRevenue += (earned || 0);
  retirePending = null;
  advanceGeneration(); // 内部でヘッダー（総収益）も更新される
}
document.getElementById('retireKeepBtn').addEventListener('click', ()=> finishRetire(false, 0));
document.getElementById('retireAdoptBtn').addEventListener('click', ()=> finishRetire(true, 0));
document.getElementById('retireSellBtn').addEventListener('click', ()=> finishRetire(true, retireSellAmount));

/* ---------- 世代を進める ---------- */
function advanceGeneration(){
  // 繁殖回数が上限に達していたら、次の選択画面には進まず終了の確認を出す
  if(roundCount >= maxRounds){
    showLimitPrompt();
    return;
  }
  previousIdeal = cloneIdeal(currentIdeal);
  currentIdeal = nextIdeal(currentIdeal);
  selectedMaleId = null; selectedFemaleId = null;
  renderHeader();
  pickPerson(); carIndex = 0;
  renderSelect();
  showScreen('screen-select');
  showIdealModal();
}

/* ---------- 体験の終了 ---------- */
function showEndModal({title, desc, primaryLabel, onPrimary, secondaryLabel, onSecondary}){
  document.getElementById('endModalTitle').textContent = title;
  document.getElementById('endModalDesc').textContent = desc;
  const p = document.getElementById('endModalPrimary');
  const s = document.getElementById('endModalSecondary');
  p.textContent = primaryLabel;
  p.onclick = ()=>{ hideEndModal(); onPrimary(); };
  if(secondaryLabel){
    s.style.display = '';
    s.textContent = secondaryLabel;
    s.onclick = ()=>{ hideEndModal(); onSecondary(); };
  } else {
    s.style.display = 'none';
  }
  document.getElementById('endModal').classList.add('show');
}
function hideEndModal(){ document.getElementById('endModal').classList.remove('show'); }

// 上限（5回／10回）に達したとき
function showLimitPrompt(){
  if(maxRounds >= ROUNDS_ABSOLUTE_MAX){
    showEndModal({
      title: `${roundCount}回の繁殖が終わりました`,
      desc: '体験を終了します。',
      primaryLabel: '結果を見る',
      onPrimary: showEnding
    });
  } else {
    showEndModal({
      title: `${roundCount}回の繁殖が終わりました`,
      desc: '体験を終了します。',
      primaryLabel: '体験を終了する',
      onPrimary: showEnding,
      secondaryLabel: `もう少し続ける（+${ROUNDS_EXTEND}回）`,
      onSecondary: ()=>{
        maxRounds = Math.min(ROUNDS_ABSOLUTE_MAX, maxRounds + ROUNDS_EXTEND);
        advanceGeneration();
      }
    });
  }
}

// 常時表示の「体験を終了する」ボタン
document.getElementById('endBtn').addEventListener('click', ()=>{
  showEndModal({
    title: '体験を終了しますか？',
    desc: '',
    primaryLabel: '終了する',
    onPrimary: showEnding,
    secondaryLabel: '続ける',
    onSecondary: ()=>{}
  });
});

/* ---------- 最終画面（記録簿）----------
   総収益を大きく見せたうえで、関わった犬すべての行方を
   同じ淡々としたトーンで並べる。
------------------------------------------------------------ */
function statusOf(d){
  const o = outcomes[d.id];
  if(o && o.status==='sold')    return {key:'sold',    label: `販売済み ${formatYen(o.amount)}`};
  if(o && o.status==='adopted') return {key:'adopted', label: '里親'};
  if(d.sex==='F' && d.breedingCount >= FEMALE_HARD_LIMIT) return {key:'retired', label:'引退'};
  return {key:'active', label:'現役'};
}

function showEnding(){
  const rows = allDogs.map(d=>({d, st: statusOf(d)}));
  const count = k => rows.filter(r=>r.st.key===k).length;

  document.getElementById('endSub').textContent = `${roundCount}回の繁殖の成果`;
  document.getElementById('endRevenue').textContent = formatYen(totalRevenue);
  document.getElementById('endCounts').innerHTML = `
    <div>関わった犬<br><b>${rows.length}匹</b></div>
    <div>現役<br><b>${count('active')}匹</b></div>
    <div>販売済み<br><b>${count('sold')}匹</b></div>
    <div>引退<br><b>${count('retired')}匹</b></div>
    <div>里親<br><b>${count('adopted')}匹</b></div>
  `;
  document.getElementById('ledgerList').innerHTML = rows.map(({d, st})=>`
    <div class="ledger-row">
      <div class="ledger-icon">${dogSVG(d)}</div>
      <div class="ledger-name">${d.name}（${d.breed}）<span>${d.sex==='M'?'♂':'♀'}・${d.round ? d.round+'回目の繁殖' : '初期'}</span></div>
      <div class="ledger-tag ${st.key}">${st.label}</div>
    </div>
  `).join('');
  showScreen('screen-ending');
}
document.getElementById('restartBtn').addEventListener('click', ()=> location.reload());

/* ---------- OP（タイトル → 説明 → ゲーム開始）---------- */
function renderTitleDogs(){
  const picks = ['ハル','コウ','ミト','タロ','ユキ'].map(n=>dogs.find(d=>d.name===n)).filter(Boolean);
  document.getElementById('opDogs').innerHTML = picks.map(d=>`<div class="op-dog">${dogSVG(d)}</div>`).join('');
}
/* ---------- 作品について（キャプション＋作者の意図）----------
   教授への見せ方を比べるため、URLの末尾（#の後）で表示案を切り替える。
     （なし）  … 作品について を表示しない（現在の形）
     #before … A案：体験の前（タイトル → 作品について → 説明 → ゲーム）
     #after  … B案：体験の後（最終画面に「作品について」ボタンを出す）
     #link   … C案：タイトル画面の隅に「作品について」リンクを置く
   ※ 下の文面は仮のもの。作者本人の言葉に差し替えること。 */
const ABOUT_PARAGRAPHS = [
  '「かわいい」「珍しい」という需要から、新しい犬種名を持つミックス犬が生まれていることに、違和感がありました。',
  '調べるうちに、純血種もまた、人間が見た目や血統を選び続けてきた結果の姿だと気づきました。',
  '犬の価値は、見た目・血統・人気・価格という、人間が決めた基準によって決められています。',
  'この作品では、あなた自身がブリーダーとしてその基準に従い、犬を選び、価値をつけていきます。',
  'その選択は、本当に犬にとっての理想だったのでしょうか。'
];
const VERSION_LABELS = {
  before: '表示案A：体験の前に組み込む',
  after:  '表示案B：体験の後に組み込む',
  link:   '表示案C：タイトルの隅にリンク'
};
const aboutVersion = (()=>{ const v = location.hash.replace('#',''); return VERSION_LABELS[v] ? v : ''; })();
window.addEventListener('hashchange', ()=> location.reload()); // 同じタブで案を切り替えたとき用

function showAbout(nextLabel, nextAction){
  document.getElementById('aboutText').innerHTML = ABOUT_PARAGRAPHS.map(t=>`<p>${t}</p>`).join('');
  const btn = document.getElementById('aboutNextBtn');
  btn.textContent = nextLabel;
  btn.onclick = nextAction;
  showScreen('screen-about');
}

document.getElementById('titleStartBtn').addEventListener('click', ()=>{
  if(aboutVersion==='before') showAbout('次へ', ()=> showScreen('screen-intro'));
  else showScreen('screen-intro');
});
document.getElementById('aboutLink').addEventListener('click', e=>{
  e.preventDefault();
  showAbout('戻る', ()=> showScreen('screen-title'));
});
document.getElementById('aboutAfterBtn').addEventListener('click', ()=>{
  showAbout('最初に戻る', ()=> location.reload());
});
document.getElementById('introStartBtn').addEventListener('click', ()=>{
  showScreen('screen-select');
  showIdealModal(); // 選択画面に触る前に、まず今季の理想像を見せる
});

/* ---------- 初期化 ---------- */
renderHeader();
pickPerson();
renderSelect();
renderTitleDogs();
showScreen('screen-title');
if(aboutVersion){
  const lab = document.getElementById('verLabel');
  lab.textContent = VERSION_LABELS[aboutVersion];
  lab.hidden = false;
}
document.getElementById('aboutLink').hidden = (aboutVersion !== 'link');
document.getElementById('aboutAfterBtn').hidden = (aboutVersion !== 'after');
// B案では、最終画面のボタンは「次へ」だけ（結果 → 作品について → 最初に戻る、と選ばずに進む）
document.getElementById('restartBtn').hidden = (aboutVersion === 'after');