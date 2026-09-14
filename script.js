/* ============================================================
   データ構造・評価ロジック
   ------------------------------------------------------------
   画面遷移は select → crossbreed → result → [retire] → select
   のループになっている。
============================================================ */
const FEMALE_BREEDING_LIMIT = 3; // ここで引退イベント（3択）が発生する
const FEMALE_HARD_LIMIT = 4;     // ここに達すると強制的に選択不可になる
const BASE_AGE = 2; // 繁殖回数0のときの推定年齢

let dogs = [
  {id:'A', name:'ハル', breed:'トイプードル', sex:'F', color:'#D9B370', earType:'floppy', furLength:'long',  size:0.8, breedingCount:0},
  {id:'B', name:'マル', breed:'トイプードル', sex:'M', color:'#C9A15E', earType:'floppy', furLength:'long',  size:0.75,breedingCount:0},
  {id:'C', name:'コウ', breed:'チワワ',       sex:'M', color:'#C97B4A', earType:'pointy', furLength:'short', size:0.5, breedingCount:0},
  {id:'D', name:'ノア', breed:'ミックス（マルプー）', sex:'F', color:'#EDEBE3', earType:'floppy', furLength:'long', size:0.7, breedingCount:0},
  {id:'E', name:'レン', breed:'ダックスフンド', sex:'M', color:'#8B5A2B', earType:'floppy', furLength:'short', size:0.9, breedingCount:0},
  {id:'F', name:'ミト', breed:'柴犬', sex:'F', color:'#C97B4A', earType:'pointy', furLength:'short', size:1.0, breedingCount:0},
  {id:'G', name:'アオ', breed:'柴犬', sex:'M', color:'#B5713C', earType:'pointy', furLength:'short', size:1.05,breedingCount:0},
  {id:'H', name:'ソラ', breed:'ミックス（チワックス）', sex:'M', color:'#B5875A', earType:'pointy', furLength:'short', size:0.6, breedingCount:0},
];

let genCount = 1;
let childCounter = 1;
let selTab = 'M';
let selectedMaleId = null;
let selectedFemaleId = null;
let lastChild = null, lastParents = null, retirePending = null;

let currentIdeal = { color:[139,90,43], earType:'floppy', furLength:'long', size:0.75 };
let previousIdeal = null;

function cloneIdeal(i){ return {color:[...i.color], earType:i.earType, furLength:i.furLength, size:i.size}; }
function nextIdeal(prev){
  const next = cloneIdeal(prev);
  next.color = prev.color.map(c => Math.max(0, Math.min(255, c + (Math.random()-0.5)*80)));
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

function dogSVG(dog){
  const s = dog.size;
  const bodyRx=46*s, bodyRy=32*s, headR=26*s;
  const cx=100, bodyCy=132, headCx=148, headCy=92;
  const color = dog.color;
  const darker = rgbToHex(hexToRgb(color).map(c=>c*0.78));
  let ear = dog.earType==='floppy'
    ? `<ellipse cx="${headCx+14}" cy="${headCy+18}" rx="${11*s}" ry="${19*s}" fill="${darker}" transform="rotate(18 ${headCx+14} ${headCy+18})"/>`
    : `<path d="M ${headCx+2} ${headCy-20} L ${headCx+14} ${headCy-40} L ${headCx+20} ${headCy-16} Z" fill="${darker}"/>`;
  let furBumps = '';
  if(dog.furLength==='long'){
    furBumps = [[60,110],[70,95],[85,86],[100,84],[115,88]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="9" fill="${color}"/>`).join('');
  }
  return `<svg viewBox="0 0 220 190" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="${cx}" cy="170" rx="70" ry="8" fill="#2B2621" opacity="0.08"/>
    <path d="M ${cx-10} 150 Q ${cx-40} 120 ${cx-30} 95" stroke="${color}" stroke-width="9" fill="none" stroke-linecap="round"/>
    <rect x="${cx-38}" y="150" width="9" height="22" rx="4" fill="${darker}"/>
    <rect x="${cx-14}" y="152" width="9" height="20" rx="4" fill="${darker}"/>
    <rect x="${cx+22}" y="150" width="9" height="22" rx="4" fill="${darker}"/>
    <rect x="${cx+44}" y="152" width="9" height="20" rx="4" fill="${darker}"/>
    <ellipse cx="${cx}" cy="${bodyCy}" rx="${bodyRx}" ry="${bodyRy}" fill="${color}"/>
    ${furBumps}${ear}
    <circle cx="${headCx}" cy="${headCy}" r="${headR}" fill="${color}"/>
    <ellipse cx="${headCx+22}" cy="${headCy+8}" rx="12" ry="9" fill="#F3EFE4"/>
    <circle cx="${headCx+30}" cy="${headCy+8}" r="3" fill="#2B2621"/>
    <circle cx="${headCx+6}" cy="${headCy-6}" r="3" fill="#2B2621"/>
  </svg>`;
}

/* ---------- 画面切り替え ---------- */
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ---------- ヘッダー ---------- */
function idealAsDog(ideal){
  return { color: rgbToHex(ideal.color), earType: ideal.earType, furLength: ideal.furLength, size: ideal.size };
}

function renderHeader(){
  document.getElementById('genBadge').textContent = `世代 ${genCount} / 5`;
  document.getElementById('trendIconMini').innerHTML = dogSVG(idealAsDog(currentIdeal));
  document.getElementById('trendText').innerHTML = `今季の理想像：<b>${describeIdeal(currentIdeal)}</b>`;
}

/* ---------- 理想像モーダル ---------- */
function showIdealModal(){
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

/* ---------- SELECT 画面 ---------- */
function showWarning(msg){
  const el = document.getElementById('warningMsg');
  el.textContent = msg;
  clearTimeout(showWarning._t);
  showWarning._t = setTimeout(()=>{ el.textContent=''; }, 2400);
}

function renderSlots(){
  const female = dogs.find(d=>d.id===selectedFemaleId);
  const male = dogs.find(d=>d.id===selectedMaleId);
  const slotF = document.getElementById('slotF');
  const slotM = document.getElementById('slotM');
  slotF.className = 'slot' + (female?' filled':'');
  slotF.innerHTML = female
    ? `<div class="slot-label">♀ メス</div><div class="icon-box">${dogSVG(female)}</div><div class="sname">${female.name}</div>`
    : `<div class="slot-label">♀ メス</div><div class="sname">未選択</div>`;
  slotM.className = 'slot' + (male?' filled':'');
  slotM.innerHTML = male
    ? `<div class="slot-label">♂ オス</div><div class="icon-box">${dogSVG(male)}</div><div class="sname">${male.name}</div>`
    : `<div class="slot-label">♂ オス</div><div class="sname">未選択</div>`;
  document.getElementById('nextBtn').disabled = !(female && male);
}

function renderCandGrid(){
  const grid = document.getElementById('candGrid');
  grid.innerHTML = '';
  dogs.filter(d=>d.sex===selTab).forEach(dog=>{
    const exhausted = dog.sex==='F' && dog.breedingCount >= FEMALE_HARD_LIMIT;
    const isSel = dog.id===selectedMaleId || dog.id===selectedFemaleId;
    const ev = computeEvaluation(dog, currentIdeal);
    const card = document.createElement('div');
    card.className = 'cand-card' + (isSel?' selected':'') + (exhausted?' exhausted':'');
    card.innerHTML = `
      <div class="icon-box">${dogSVG(dog)}</div>
      <div class="cname">${dog.name}</div>
      <div class="cbreed">${dog.breed}</div>
      <div class="cstars">${starString(ev.popularity)}</div>
      ${dog.sex==='F' ? `<div class="clim">${exhausted?'上限到達':'繁殖 '+dog.breedingCount+'/'+FEMALE_BREEDING_LIMIT+'（推定'+(BASE_AGE+dog.breedingCount)+'歳)'}</div>` : ''}
    `;
    card.addEventListener('click', ()=>{
      if(exhausted){ showWarning(`${dog.name}は生涯出産回数の上限に達しており、選択できません。`); return; }
      if(dog.sex==='M') selectedMaleId = dog.id; else selectedFemaleId = dog.id;
      renderCandGrid(); renderSlots();
    });
    grid.appendChild(card);
  });
}

document.getElementById('tabM').addEventListener('click', ()=>{ selTab='M'; document.getElementById('tabM').classList.add('active'); document.getElementById('tabF').classList.remove('active'); renderCandGrid(); });
document.getElementById('tabF').addEventListener('click', ()=>{ selTab='F'; document.getElementById('tabF').classList.add('active'); document.getElementById('tabM').classList.remove('active'); renderCandGrid(); });

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
  if(rand()<0.1) colorRgb = colorRgb.map(c=>c+(rand()-0.5)*90);
  const color = rgbToHex(colorRgb);
  let earType = rand()<0.5 ? parentA.earType : parentB.earType;
  if(rand()<0.1) earType = earType==='floppy'?'pointy':'floppy';
  let furLength = rand()<0.5 ? parentA.furLength : parentB.furLength;
  if(rand()<0.1) furLength = furLength==='short'?'long':'short';
  let size = (parentA.size+parentB.size)/2 + (rand()-0.5)*0.15;
  size = Math.max(0.4, Math.min(1.1, size));
  const sex = rand()<0.5 ? 'M':'F';
  childCounter++;
  const breedLabel = (parentA.breed===parentB.breed) ? parentA.breed : `ミックス（${parentA.breed} × ${parentB.breed}）`;
  return { id:'child'+childCounter, name:'子犬 #'+childCounter, breed:breedLabel, sex, color, earType, furLength, size, breedingCount:0 };
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
}

function afterResultAction(keepChild){
  if(keepChild) dogs.push(lastChild);
  if(retirePending){
    renderRetireScreen();
    showScreen('screen-retire');
  } else {
    advanceGeneration();
  }
}
document.getElementById('keepBtn').addEventListener('click', ()=> afterResultAction(true));
document.getElementById('shopBtn').addEventListener('click', ()=> afterResultAction(false));
document.getElementById('selfSellBtn').addEventListener('click', ()=> afterResultAction(false));

/* ---------- RETIRE 画面 ---------- */
function renderRetireScreen(){
  const f = retirePending;
  document.getElementById('retireIcon').innerHTML = dogSVG(f);
  document.getElementById('retireLabel').textContent = `♀ ${f.name}（${f.breed}） ${BASE_AGE+f.breedingCount}歳`;
}
function finishRetire(remove){
  if(remove){ dogs = dogs.filter(d=>d.id!==retirePending.id); }
  retirePending = null;
  advanceGeneration();
}
document.getElementById('retireKeepBtn').addEventListener('click', ()=> finishRetire(false));
document.getElementById('retireAdoptBtn').addEventListener('click', ()=> finishRetire(true));
document.getElementById('retireSellBtn').addEventListener('click', ()=> finishRetire(true));

/* ---------- 世代を進める ---------- */
function advanceGeneration(){
  genCount = Math.min(5, genCount+1);
  previousIdeal = cloneIdeal(currentIdeal);
  currentIdeal = nextIdeal(currentIdeal);
  selectedMaleId = null; selectedFemaleId = null;
  renderHeader();
  renderCandGrid(); renderSlots();
  showScreen('screen-select');
  showIdealModal();
}

/* ---------- 初期化 ---------- */
renderHeader();
renderCandGrid();
renderSlots();
showIdealModal(); // 1世代目も、選択画面に触る前にまず理想像を見せる