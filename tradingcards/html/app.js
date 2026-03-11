
// --- Toast helper (NUI overlay-safe) ---
let _tcToastTimer = null;
function tcShowToast(message, kind = "error"){
  try{
    const el = document.getElementById("tc-toast");
    if(!el) return null;

    const msg = String(message || "");
    if(msg.includes("<br")){
      el.innerHTML = msg;
    }else{
      el.textContent = msg;
    }

    el.classList.remove("success","error","show");
    el.classList.add(kind === "success" ? "success" : "error");
    void el.offsetWidth;
    el.classList.add("show");

    if(_tcToastTimer) clearTimeout(_tcToastTimer);
    _tcToastTimer = setTimeout(() => {
      el.classList.remove("show");
    }, 2600);

    return el;
  }catch(e){
    return null;
  }
}

function buildAllCardsCache(){
  const all = (state.allCards||[]).slice();
  // Build card index for quick lookups (trade/reward etc)
  state.cardIndex = {};
  for(const c of all){
    try{ const cid = (c && (c.card_id||c.cardId||c.id)) ? String(c.card_id||c.cardId||c.id) : ''; if(cid) state.cardIndex[cid]=c; }catch(_){ }
  }
  all.sort((a,b)=>{
    const aid=(a.card_id||'').toString();
    const bid=(b.card_id||'').toString();
    return aid.localeCompare(bid);
  });
  state.allCardsSorted = all;
}


function openCardPreviewAt(index){
  const pv=document.getElementById('cardPreview');
  const img=document.getElementById('cardPreviewImg');
  if(!pv || !img) return;
  const list = state.previewGlobalList || state.previewList || [];
  let i = Number(index||0);
  if(!Number.isFinite(i)) i = 0;
  // clamp to available cards
  const valid = list.map((x,idx)=>({x,idx})).filter(o=>o.x);
  if(valid.length===0) return;
  // if index points to empty, snap to first valid
  if(!list[i]) i = valid[0].idx;
  state.previewIndex = i;
  img.src = list[i] || '';
  pv.classList.remove('hidden');
}
function openCardPreview(src){
  // backward compat: open first matching src in current list
  const list = state.previewList || [];
  const i = list.indexOf(src);
  openCardPreviewAt(i>=0?i:0);
}
function closeCardPreview(){
  const pv=document.getElementById('cardPreview');
  if(!pv) return;
  pv.classList.add('hidden');
  const img=document.getElementById('cardPreviewImg');
  if(img) img.src='';
}
function previewStep(dir){
  const pv=document.getElementById('cardPreview');
  if(!pv || pv.classList.contains('hidden')) return;
  const list = state.previewGlobalList || state.previewList || [];
  if(!list.length) return;
  let i = Number(state.previewIndex||0);
  const validIdx = list.map((x,idx)=>x?idx:null).filter(v=>v!==null);
  if(validIdx.length===0) return;
  // move to next/prev valid index (wrap)
  const curPos = validIdx.indexOf(list[i]?i:validIdx[0]);
  let nextPos = (curPos + (dir>0?1:-1) + validIdx.length) % validIdx.length;
  const ni = validIdx[nextPos];
  state.previewIndex = ni;
  // if navigating across pages, update page + grid
  if(state.previewGlobalList){
    const targetPage = Math.floor(ni/15) + 1;
    if(Number(state.currentPage||1) !== targetPage){
      state.currentPage = targetPage;
      renderPage();
    }
  }

  const img=document.getElementById('cardPreviewImg');
  if(img) img.src = list[ni] || '';
}
document.addEventListener('keydown', (e)=>{
  if(e.key==='Escape') return closeCardPreview();
  if(e.key==='ArrowRight') return previewStep(1);
  if(e.key==='ArrowLeft') return previewStep(-1);
});
document.addEventListener('click', (e)=>{
  const pv=document.getElementById('cardPreview');
  if(!pv || pv.classList.contains('hidden')) return;
  // click outside panel closes
  if(e.target && (e.target.classList.contains('cardPreviewBackdrop'))) closeCardPreview();
});
document.addEventListener('DOMContentLoaded',()=>{
  document.body.style.background = 'transparent';
  const o=document.getElementById('overlay'); const a=document.getElementById('adminOverlay');
  if(o) o.classList.add('hidden'); if(a) a.classList.add('hidden');
});

let state={currentPage:1,allCards:[],allCardsSorted:null,cardIndex:{},ownedMap:{},newMap:{},pendingCard:null,selectedTarget:null,mode:'album',pendingRewards:[],overlayOpen:false,_pendingRewardNeedsAlbum:false,rarityFilter:'ALL',collectionScope:'ALL'};
let adminState={ tab:'list', cards:[], listScroll:0, rarityWeights:{R:9548,SR:400,SSR:50,UR:2}, editingId:null, deletePendingId:null, deleteSubmitting:false };
function postNui(endpoint,data={}){return fetch(`https://${GetParentResourceName()}/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).catch(()=>null);}

function setOverlayRarity(r){
  const ov=document.getElementById('overlay');
  if(!ov) return;
  ov.classList.remove('rarity-r','rarity-sr','rarity-ssr','rarity-ur');
  const key=(r||'R').toString().toUpperCase();
  if(key==='UR') ov.classList.add('rarity-ur');
  else if(key==='SSR') ov.classList.add('rarity-ssr');
  else if(key==='SR') ov.classList.add('rarity-sr');
  else ov.classList.add('rarity-r');
}

function endPackFlow(){ try{ postNui('close'); }catch(_){} try{ closeOverlay(); }catch(_){} }
function playSound(id,vol=0.6){const e=document.getElementById(id); if(!e) return; try{e.pause();e.currentTime=0;e.volume=vol;const p=e.play(); if(p&&p.catch)p.catch(()=>{});}catch(_){}}
function playClonedSound(id,vol=0.6){const base=document.getElementById(id); if(!base) return; try{const s=base.cloneNode(true); s.volume=vol; s.currentTime=0; s.preload='auto'; s.style.display='none'; document.body.appendChild(s); const p=s.play(); if(p&&p.catch)p.catch((err)=>{console.warn('[sound] play failed:', id, err); try{s.remove();}catch(_){}}); s.addEventListener('ended',()=>{try{s.remove();}catch(_){}} ,{once:true});}catch(err){console.warn('[sound] clone failed:', id, err);}}
['sound_r','sound_sr','sound_ssr','sound_ur','sound_open','sound_page','sound_hover'].forEach((id)=>{const e=document.getElementById(id); if(!e) return; try{e.load();}catch(_){}});
let lastCardHoverSoundAt = 0;
function playCardHoverSound(){
  const now = Date.now();
  if(now - lastCardHoverSoundAt < 80) return;
  lastCardHoverSoundAt = now;
  playSound('sound_hover', 0.5);
}

function getCardLabel(cardObj, cardId){
  const c = cardObj || {};
  const label =
    c.display_name || c.displayName ||
    c.name || c.title ||
    c.card_name || c.cardName ||
    c.label || c.card_label;
  return String(label || cardId || "");
}

function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

function openOverlay(){
  try{ setOverlayRarity('R'); }catch(_){}
const ov=document.getElementById('overlay'); if(!ov) return; ov.classList.remove('hidden'); state.overlayOpen=true; try{ maybeShowQueuedRewardOnOpen(); }catch(_){ } ov.classList.remove('mode-pack'); const pl=document.getElementById('packLayer'); if(pl) pl.classList.add('hidden'); const pt=document.getElementById('packTop'); if(pt){pt.style.transition='';pt.style.opacity='1';pt.style.transform='translateY(0px)';} }
function closeOverlay(){
  try{ setOverlayRarity('R'); }catch(_){}
const ov=document.getElementById('overlay'); if(ov){ov.classList.add('hidden'); ov.classList.remove('mode-pack');} state.overlayOpen=false; hideTrade();}
document.getElementById('closeBtn').onclick=()=>{postNui('close');closeOverlay();}

// ESC to close overlay (finder)
if(!window.__tcEscBound){
  window.__tcEscBound = true;
  document.addEventListener('keydown', (e)=>{
    if(e.key !== 'Escape') return;

    // close delete confirm modal if open
    const delModal = document.getElementById('deleteConfirmModal');
    if(delModal && !delModal.classList.contains('hidden')){
      try{ adminCloseDeleteModal(); }catch(_){ }
      return;
    }

    // close reward popup if open
    const rw = document.getElementById('rewardEffect');
    if(rw && !rw.classList.contains('hidden')){
      try{ hideReward(); }catch(_){ }
      return;
    }

    // close binder overlay if open
    const ov = document.getElementById('overlay');
    if(ov && !ov.classList.contains('hidden')){
      try{ postNui('close'); }catch(_){}
      try{ closeOverlay(); }catch(_){}
      return;
    }

    // close admin overlay if open
    const aov = document.getElementById('adminOverlay');
    if(aov && !aov.classList.contains('hidden')){
      try{ postNui('close'); }catch(_){}
      try{ adminClose(); }catch(_){}
      return;
    }
  });
}

document.getElementById('tradeClose').onclick=()=>hideTrade();

function showReward(html,bg){
  /* reward popup */
  const r=document.getElementById('rewardEffect');
  const c=document.getElementById('rewardCard');
  if(!r||!c) return;
  if(bg) r.style.background=bg;
  c.innerHTML=html + `<div style="margin-top:10px;opacity:.7;font-size:12px;">クリックで閉じる</div>`;
  r.classList.remove('hidden');

  // Close ONLY the reward popup (do not close the whole overlay)
  const closeReward = ()=>{ try{ hideReward(); }catch(_){} };
  r.onclick = closeReward;
  c.onclick = (ev)=>{ try{ ev.stopPropagation(); }catch(_){} closeReward(); };
}
function hideReward(){
  const el=document.getElementById('rewardEffect');
  if(el){
    el.classList.add('hidden');
    el.style.background='rgba(0,0,0,.80)';
  }
  // If UI is open and there are more queued rewards, show the next one.
  const ov=document.getElementById('overlay');
  if(ov && !ov.classList.contains('hidden')){
    try{ maybeShowQueuedRewardOnOpen(); }catch(_){}
  }
}

// pack peel
let drag={active:false,startY:0,opened:false};
function showPack(card){
  state.pendingCard=card;
  try{ setOverlayRarity(card && card.rarity); }catch(_){ }
  const ov=document.getElementById('overlay'); if(ov) ov.classList.add('mode-pack');
  const layer=document.getElementById('packLayer');
  layer.classList.remove('hidden'); layer.classList.remove('r','sr','ssr','ur');
  layer.classList.add((card.rarity||'R').toLowerCase());
  const top=document.getElementById('packTop'); top.style.transform='translateY(0px)';
  drag.opened=false;
}
function hidePack(){document.getElementById('packLayer').classList.add('hidden');}
function launchCard(card, done){
  const packLayer=document.getElementById('packLayer');
  const wrap=packLayer && packLayer.querySelector('.packWrap');
  if(!wrap){ if(done) done(); return; }

  const old=document.getElementById('cardLaunchLayer');
  if(old) old.remove();

  const layer=document.createElement('div');
  layer.id='cardLaunchLayer';

  const cardBox=document.createElement('div');
  cardBox.id='cardLaunch';

  // Back face (start)
  const back=document.createElement('div');
  back.className='face back';
  const mark=document.createElement('div');
  mark.className='mark';
  mark.innerHTML = `<div style="font-size:18px;line-height:1.1;">BOND</div><div style="font-size:14px;opacity:.9;margin-top:4px;">OFFICIAL PACK</div>`;
  back.appendChild(mark);

  // Front face (end)
  const front=document.createElement('div');
  front.className='face front';
  const img=document.createElement('img');
  img.alt='card';
  img.src=(card && (card.image_url||card.imageUrl||card.image||'')) || '';
  img.style.width='100%';
  img.style.height='100%';
  img.style.objectFit='cover';
  img.style.display='block';
  front.appendChild(img);

  cardBox.appendChild(back);
  cardBox.appendChild(front);

  layer.appendChild(cardBox);
  wrap.appendChild(layer);

  requestAnimationFrame(()=>{ cardBox.classList.add('play'); });

  const cleanup = ()=>{
    cardBox.classList.remove('play');
    setTimeout(()=>{ layer.remove(); }, 50);
    if(done) done();
  };

  let fired=false;
  cardBox.addEventListener('animationend', ()=>{ if(fired) return; fired=true; armEnd(); }, { once:true });
  setTimeout(()=>{ if(fired) return; fired=true; armEnd(); }, 1400);
}

function launchCardRotateSwap(card, done){
  const packLayer=document.getElementById('packLayer');
  const wrap=packLayer && packLayer.querySelector('.packWrap');
  if(!wrap){ if(done) done(); return; }

  const old=document.getElementById('cardLaunchLayer');
  if(old) old.remove();

  const layer=document.createElement('div');
  layer.id='cardLaunchLayer';

  const box=document.createElement('div');
  box.id='cardLaunch';

  const back=document.createElement('img');
  back.className='imgBack';
  back.alt='back';
  back.src='images/card_back.png';

  const front=document.createElement('img');
  front.className='imgFront';
  front.alt='card';
  front.src=(card && (card.image_url||card.imageUrl||card.image||'')) || '';

  box.appendChild(back);
  box.appendChild(front);
  layer.appendChild(box);

  // If packTop exists, insert behind it (still ok visually)
  const packTop=document.getElementById('packTop');
  if(packTop && packTop.parentElement === wrap) wrap.insertBefore(layer, packTop);
  else wrap.appendChild(layer);

  requestAnimationFrame(()=>{ box.classList.add('play'); });

  const finish = ()=>{
    try{ layer.remove(); }catch(_){}
    try{ endPackFlow(); }catch(_){}
  };
  let raritySoundPlayed = false;
  const playRarityAfterSpin = ()=>{
    if(raritySoundPlayed) return;
    raritySoundPlayed = true;
    try{ playClonedSound('sound_'+((card && card.rarity) || 'R').toLowerCase(), 0.65); }catch(_){}
  };
  const armEnd = ()=>{
    playRarityAfterSpin();
    // allow click to end after return
    layer.style.pointerEvents='auto';
    layer.onclick = finish;
    window.addEventListener('keydown', (e)=>{ if(e.key==='Escape') finish(); }, { once:true });
  };
  let fired=false;
  box.addEventListener('animationend', ()=>{ if(fired) return; fired=true; armEnd(); }, { once:true });
  setTimeout(()=>{ if(fired) return; fired=true; armEnd(); }, 2800);
}



function openPackNow(){
  // ensure glow fades out after open
  try{const wrap=document.querySelector('#packLayer .packWrap'); if(wrap) setTimeout(()=>wrap.classList.remove('glowOn'), 260);}catch(_){}
  try{const g=document.getElementById('tearGlow'); if(g) setTimeout(()=>{g.style.opacity='0';}, 260);}catch(_){}

  if(drag.opened) return; drag.opened=true;
  playClonedSound('sound_open',0.7);
  const c=state.pendingCard; if(!c) return;
  // A2: play animation and STOP here (no reward, no auto-close)
  launchCardRotateSwap(c, ()=>{});
}

(function(){
  const top=document.getElementById('packTop');
  const down=y=>{if(drag.opened) return; drag.active=true; drag.startY=y;}
  const move=y=>{if(!drag.active||drag.opened) return; const diff=drag.startY-y; const c=Math.max(0,Math.min(160,diff));
    top.style.transform=`translateY(${-c}px)`;
    // glow at tear seam
    const wrap=document.querySelector('#packLayer .packWrap');
    if(wrap){
      const t=Math.min(1, Math.max(0, c/120));
      wrap.classList.toggle('glowOn', t>0.05);
      const g=document.getElementById('tearGlow');
      if(g) g.style.opacity = String(Math.min(1, t));
    }
    /*glowPatch*/ if(c>=120){drag.active=false;openPackNow();}}
  const up=()=>{drag.active=false; if(!drag.opened) top.style.transform='translateY(0px)';}
  top.addEventListener('mousedown',e=>down(e.clientY)); document.addEventListener('mousemove',e=>move(e.clientY)); document.addEventListener('mouseup',up);
  top.addEventListener('touchstart',e=>down(e.touches[0].clientY),{passive:true}); document.addEventListener('touchmove',e=>move(e.touches[0].clientY),{passive:true}); document.addEventListener('touchend',up);
})();


function getFilteredCards(){
  let all = (state.allCardsSorted || state.allCards || []);
  const scope = String(state.collectionScope || 'ALL').toUpperCase();
  const filter = String(state.rarityFilter || 'ALL').toUpperCase();

  if(scope === 'OWNED'){
    all = all.filter(c => {
      const cid = c && (c.card_id||c.cardId||c.id);
      return !!(cid && state.ownedMap && state.ownedMap[String(cid)]);
    });
  }

  if(filter === 'ALL') return all;
  return all.filter(c => String((c && c.rarity) || 'R').toUpperCase() === filter);
}

function syncRarityFilterButtons(){
  document.querySelectorAll('[data-rarity-filter]').forEach(btn=>{
    const key = String(btn.dataset.rarityFilter || 'ALL').toUpperCase();
    btn.classList.toggle('active', key === String(state.rarityFilter || 'ALL').toUpperCase());
  });
}

function syncCollectionScopeButtons(){
  document.querySelectorAll('[data-collection-toggle]').forEach(btn=>{
    const isOwned = String(state.collectionScope || 'ALL').toUpperCase() === 'OWNED';
    btn.classList.toggle('active', isOwned);
  });
}

function setRarityFilter(filter){
  state.rarityFilter = String(filter || 'ALL').toUpperCase();
  state.currentPage = 1;
  syncRarityFilterButtons();
  renderPage();
}

function setCollectionScope(scope){
  state.collectionScope = String(scope || 'ALL').toUpperCase();
  state.currentPage = 1;
  syncCollectionScopeButtons();
  renderPage();
}

function toggleOwnedFilter(){
  const current = String(state.collectionScope || 'ALL').toUpperCase();
  setCollectionScope(current === 'OWNED' ? 'ALL' : 'OWNED');
}

function updateStats(){
  const total=state.allCards.length; let owned=0;
  state.allCards.forEach(c=>{ if(state.ownedMap[c.card_id]) owned++; });
  const pct=total?Math.floor((owned/total)*100):0;
  document.getElementById('collectionInfo').textContent='';
  document.getElementById('rarityInfo').textContent=`Collection: ${owned}/${total} (${pct}%)`;
}


function makeCardEl(c){
  const el=document.createElement('div');
  el.className='card';
  const cid = (c && (c.card_id||c.cardId||c.id)) ? String(c.card_id||c.cardId||c.id) : '';
  const owned = !!(state.ownedMap && cid && state.ownedMap[cid]);
  let ownedCount = 0;
  try{
    const meta = (state.ownedMap && cid) ? state.ownedMap[cid] : null;
    if(meta && typeof meta==='object') ownedCount = Number(meta.count||meta.qty||0) || 0;
    else if(typeof meta==='number') ownedCount = Number(meta) || 0;
    else if(owned) ownedCount = 1;
  }catch(_){ ownedCount = owned ? 1 : 0; }

  const isNew = !!(state.newMap && cid && state.newMap[cid]);

  el.dataset.owned = owned ? '1' : '0';
  if(!owned) el.classList.add('locked');

  const img=document.createElement('img');
  img.alt = c.label || c.card_id || 'card';
  img.src = owned ? (c.image_url||c.imageUrl||c.image||'') : (c.image_url||c.imageUrl||c.image||''); // keep src for layout; locked style will dim
  el.appendChild(img);

  // COUNT badge
  try{
    if(owned && ownedCount >= 2){
      const bc=document.createElement('div');
      bc.className='badge-count';
      bc.textContent='×' + String(ownedCount);
      el.appendChild(bc);
    }
  }catch(_){}

  // NEW badge
  try{
    if(owned && isNew){
      el.classList.add('is-new');
      const bn=document.createElement('div');
      bn.className='badge-new';
      bn.textContent='NEW';
      el.appendChild(bn);
    }
  }catch(_){ }


  el.addEventListener('mouseenter', ()=>{
    playCardHoverSound();
  });

  // Optional: click to open trade/detail if you have handlers (keep noop if not)
  el.addEventListener('click', (ev)=>{
    if(!owned) return; // no preview for unowned
    try{ ev.stopPropagation(); }catch(_){}
    try{
      if(state.newMap && cid && state.newMap[cid]){
        postNui('clearNew', { cardId: cid });
        state.newMap[cid] = false;
        renderPage();
      }
    }catch(_){ }
    const gidx = el.dataset && el.dataset.previewGlobalIndex;
    if(gidx!=null) return openCardPreviewAt(Number(gidx));
    const idx = el.dataset && el.dataset.previewIndex;
    if(idx!=null) return openCardPreviewAt(Number(idx));
    const src = (c && (c.image_url||c.imageUrl||c.image||'')) || '';
    openCardPreview(src);
  });

  return el;
}


function renderPage(){
  const L=document.getElementById('leftPage'), R=document.getElementById('rightPage');
  if(!L) return;
  L.innerHTML=''; if(R) R.innerHTML='';
  const all = getFilteredCards();
  // global preview list for cross-page navigation (owned only)
  state.previewGlobalList = all.map(c=>{
    if(!c) return null;
    const owned = !!(state.ownedMap && state.ownedMap[c.card_id]);
    return owned ? (c.image_url||c.imageUrl||c.image||'') : null;
  });
  const maxP = getMaxPage();
  let cur = Number(state.currentPage||1);
  if(!Number.isFinite(cur)) cur = 1;
  cur = Math.min(maxP, Math.max(1, cur));
  state.currentPage = cur;
  updatePageIndicator();

  const start = (cur-1)*15;
  const slice = all.slice(start, start+15);

  // preview list: allow owned-only navigation if ownedMap exists
  state.previewList = slice.map(c=>{
    if(!c) return null;
    const owned = !!(state.ownedMap && state.ownedMap[c.card_id]);
    return owned ? (c.image_url||c.imageUrl||c.image||'') : null;
  });

  for(let i=0;i<15;i++) {
    const c = slice[i];
    if(c){
      const el = makeCardEl(c);
      el.dataset.previewIndex = String(i);
      el.dataset.previewGlobalIndex = String(start + i);
      L.appendChild(el);
    } else {
      const ph=document.createElement('div');
      ph.className='card comingsoon';
      L.appendChild(ph);
    }
  }
}



function updatePageIndicator(){
  const el=document.getElementById('pageIndicator');
  if(el) el.textContent = 'Page ' + String(state.currentPage||1);
}

function getMaxPage(){ const total=(getFilteredCards().length)||0; return Math.max(1, Math.ceil(total/15)); }

function flipPage(dir){
  playSound('sound_page',0.35);
  const s=document.getElementById('spread');
  if(!s) return;

  // slide transition (no 3D rotate)
  s.classList.remove('flip-left','flip-right','slide-next','slide-prev');
  s.classList.add(dir==='next' ? 'slide-next' : 'slide-prev');

  // swap content at the middle of the animation (around 50%)
  setTimeout(()=>{
    const maxP=getMaxPage();
    if(dir==='next') state.currentPage=Math.min(maxP, (Number(state.currentPage||1)+1));
    else state.currentPage=Math.max(1, (Number(state.currentPage||1)-1));
    renderPage();
    updatePageIndicator();
  }, 260);

  // cleanup
  setTimeout(()=>{ s.classList.remove('slide-next','slide-prev'); }, 520);
}


function jumpPage10(delta){
  playSound('sound_page',0.35);
  const s=document.getElementById('spread');
  const maxP=getMaxPage();
  const dir = delta>0 ? 'next' : 'prev';
  if(!s) return;

  s.classList.remove('flip-left','flip-right','slide-next','slide-prev');
  s.classList.add(dir==='next' ? 'slide-next' : 'slide-prev');

  setTimeout(()=>{
    const cur = Number(state.currentPage||1);
    let next = cur + delta;
    if(next < 1) next = 1;
    if(next > maxP) next = maxP;
    state.currentPage = next;
    renderPage();
    updatePageIndicator();
  }, 260);

  setTimeout(()=>{ s.classList.remove('slide-next','slide-prev'); }, 520);
}

document.getElementById('next').onclick=()=>flipPage('next');
document.getElementById('prev').onclick=()=>{if(state.currentPage>1) flipPage('prev');};
document.querySelectorAll('[data-rarity-filter]').forEach(btn=>{
  btn.addEventListener('click', ()=>setRarityFilter(btn.dataset.rarityFilter || 'ALL'));
});
document.querySelectorAll('[data-collection-toggle]').forEach(btn=>{
  btn.addEventListener('click', ()=>toggleOwnedFilter());
});
syncRarityFilterButtons();
syncCollectionScopeButtons();
syncRarityFilterButtons();


function showTrade(){document.getElementById('tradePanel').classList.remove('hidden')}
function hideTrade(){document.getElementById('tradePanel').classList.add('hidden'); state.mode='album'; state.selectedTarget=null;}


function renderTradePlayers(){
  const body=document.getElementById('tradeBody');
  body.innerHTML='';

  // Top: target select (always visible)
  const top=document.createElement('div');
  top.className='tradeTop';
  top.innerHTML=`
    <div class="tradeTopTitle">送り先</div>
    <div class="tradeTopSub mono">相手のIDを指定して送信します</div>

    <div class="tradeTargetRow">
      <label class="tradeLabel mono">送り先ID</label>
      <input id="tradeTargetId" class="tradeTargetInput" placeholder="例: 12" inputmode="numeric" />
      <button id="tradeTargetGo" class="btn tradeTargetBtn">選択</button>
    </div>

    <div id="tradeTargetStatus" class="tradeTargetStatus mono empty">送り先：未選択</div>
  `;
  body.appendChild(top);

  const idEl = top.querySelector('#tradeTargetId');
  const goEl = top.querySelector('#tradeTargetGo');
  const statusEl = top.querySelector('#tradeTargetStatus');

  const setTarget = (idNum)=>{
    state.selectedTarget = idNum;
    statusEl.classList.remove('empty');
    statusEl.innerHTML = `送り先：<b>${esc(String(idNum))}</b>`;
    // enable send buttons
    body.querySelectorAll('button.tradeSend').forEach(btn=>{
      btn.disabled = false;
    });
  };

  const go = ()=>{
    const v = String(idEl.value||'').trim();
    if(!/^\d+$/.test(v)){
      tcShowToast('送り先のIDを入力してください。', "error");
      return;
    }
    setTarget(Number(v));
  };
  goEl.onclick = go;
  idEl.addEventListener('keydown', (e)=>{ if(e.key==='Enter') go(); });

  // List: always visible under the target row
  renderTradeList(body);

  // initial state: disable send until target selected
  body.querySelectorAll('button.tradeSend').forEach(btn=>{
    btn.disabled = !state.selectedTarget;
  });
  if(state.selectedTarget){
    statusEl.classList.remove('empty');
    statusEl.innerHTML = `送り先：<b>${esc(String(state.selectedTarget))}</b>`;
  }
}

function renderTradeList(body){
  const ids=Object.keys(state.ownedMap||{});
  if(ids.length===0){
    body.insertAdjacentHTML('beforeend','<div class="mono" style="opacity:.85">送れるカードがありません</div>');
    return;
  }

  ids.sort().forEach(id=>{
    const c = (state.cardIndex && state.cardIndex[id]) ? state.cardIndex[id] : null;
    const img = (c && (c.image_url||c.imageUrl||c.image)) ? (c.image_url||c.imageUrl||c.image) : '';
    const rarity = ((c && c.rarity) ? String(c.rarity) : (String(id).split('_')[0]||'')).toUpperCase();
    const count = Number(state.ownedMap[id]||0);
    const label = getCardLabel(c, id);

    const d=document.createElement('div');
    d.className='tradeItem';
    d.innerHTML=`
      <div class="tradeLeft">
        <div class="tradeThumbWrap">${img ? `<img class="tradeThumb" src="${esc(img)}" alt="card" />` : `<div class="tradeThumb ph"></div>`}</div>
        <div class="tradeInfo">
          <div class="tradeLine1">
            <span class="badge-rarity badge-${esc(String(rarity||'').toLowerCase())}">${esc(rarity||'')}</span>
            <span class="tradeName">${esc(label)}</span>
          </div>
          <div class="tradeLine2 mono">所持: x${esc(String(count))}</div>
        </div>
      </div>
      <button class="btn tradeSend">送る</button>
    `;
    const sendBtn = d.querySelector('button.tradeSend');
    sendBtn.onclick=()=>{
      if(!state.selectedTarget){
        tcShowToast('送り先のIDを入力してください。', "error");
        return;
      }
      // Two-step confirm (avoids native confirm modal)
      if(sendBtn.dataset.confirming === '1'){
        // confirmed
        sendBtn.dataset.confirming = '0';
        sendBtn.textContent = '送る';
        if(sendBtn._confirmInterval){ clearInterval(sendBtn._confirmInterval); sendBtn._confirmInterval = null; }
        doSendCard(id);
        return;
      }

      // reset other confirming buttons
      body.querySelectorAll('button.tradeSend[data-confirming="1"]').forEach(b=>{
        b.dataset.confirming='0';
        b.textContent='送る';
        if(b._confirmInterval){ clearInterval(b._confirmInterval); b._confirmInterval=null; }
      });

      
      sendBtn.dataset.confirming = '1';
      sendBtn.textContent = '確定';

      const CONFIRM_MS = 3000;
      const startedAt = Date.now();

      const renderCountdown = () => {
        const leftMs = Math.max(0, CONFIRM_MS - (Date.now() - startedAt));
        const leftSec = Math.ceil(leftMs / 1000);
        tcShowToast(
          `ID ${state.selectedTarget} に「${label}」を送信します。<br><span class="toast-sub">${leftSec}秒後に自動でキャンセルします（もう一度押して確定）</span>`,
          "success"
        );
        return leftMs;
      };

      renderCountdown();

      if(sendBtn._confirmInterval) clearInterval(sendBtn._confirmInterval);
      sendBtn._confirmInterval = setInterval(() => {
        const left = renderCountdown();
        if(left <= 0){
          clearInterval(sendBtn._confirmInterval);
          sendBtn._confirmInterval = null;
          try{
            sendBtn.dataset.confirming = '0';
            sendBtn.textContent = '送る';
          }catch(e){}
        }
      }, 250);

    };
    body.appendChild(d);
  });
}


function doSendCard(cardId){
  if(!state.selectedTarget){
    tcShowToast('送り先のIDを入力してください。', 'error');
    return;
  }
  postNui('sendCard',{targetId:state.selectedTarget,cardId});
  hideTrade();
}

document.getElementById('tradeBtn').onclick=()=>{
  state.mode='tradePlayers'; 
  state.selectedTarget=null; 
  showTrade();
  renderTradePlayers();
};



function maybeShowQueuedRewardOnOpen(){
  // When UI is opened, if there are queued rewards, show the first one.
  const rw=document.getElementById('rewardEffect');
  const hasRewardOpen = rw && !rw.classList.contains('hidden');
  if(hasRewardOpen) return;
  if(!state.pendingRewards || state.pendingRewards.length===0) return;

  // albumData (and thus state.allCards with image_url) may arrive *after* the UI opens.
  // If we pop the queue too early, the popup renders without the image.
  // Wait until card definitions are loaded.
  if(!state.allCards || state.allCards.length === 0){
    state._pendingRewardNeedsAlbum = true;
    return;
  }

  const next = state.pendingRewards.shift();
  if(next) showReceive(next.cardId, !!next.isNew);
}

function showReceive(cardId,isNew){
  // Try to resolve image from cached card definitions (available after albumData loads).
  let imgUrl = '';
  try{
    const list = state.allCards || [];
    const found = list.find(x => String(x.card_id || x.cardId || '') === String(cardId));
    imgUrl = (found && (found.image_url || found.imageUrl || found.image || '')) || '';
  }catch(_){ imgUrl = ''; }

  const title = isNew ? 'NEW CARD ACQUIRED' : 'カードを受け取りました';
  const html = `
    <div style="font-size:18px;font-weight:700;${isNew?'color:#9b59ff;':''}">${esc(title)}</div>
    ${imgUrl ? `<img src="${esc(imgUrl)}" alt="${esc(cardId)}" loading="lazy" />` : ''}
  `;

  showReward(html,
    isNew?'rgba(155, 89, 255, 0.25)':'rgba(0, 200, 255, 0.15)');
      // (hold) reward stays until you close
}


(function particles(){
  const canvas=document.getElementById('particles'); if(!canvas) return; const ctx=canvas.getContext('2d'); const parts=[]; const count=35;
  const resize=()=>{canvas.width=window.innerWidth; canvas.height=window.innerHeight;}; resize(); window.addEventListener('resize',resize);
  for(let i=0;i<count;i++) parts.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,r:Math.random()*2+1,s:Math.random()*0.3+0.1,a:Math.random()*0.5+0.2});
  const tick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height); for(const p of parts){ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle=`rgba(0,200,255,${p.a})`; ctx.fill(); p.y-=p.s; if(p.y<0){p.y=canvas.height;p.x=Math.random()*canvas.width;}} requestAnimationFrame(tick);}; tick();
})();

// NUI bridge
window.addEventListener('message', (ev)=>{
  const d = ev.data || {};


  if(d.action === 'toast'){
    tcShowToast(d.message || d.msg || '', d.kind || d.type || 'error');
    return;
  }
  if(d.action === 'forceClose'){
    try{ closeOverlay(); }catch(_){}
    try{ adminClose(); }catch(_){}
    return;
  }

  if(d.action === 'openBinder'){
    openOverlay();
    return;
  }

  if(d.action === 'openPack'){
    openOverlay();
    showPack(d.card);
    return;
  }

  if(d.action === 'albumData'){
    state.allCards = d.allCards || d.cards || [];
    state.allCardsSorted = null;
    try{ buildAllCardsCache(); }catch(_){}
    state.ownedMap = {};
    state.newMap = {};
    (d.owned||[]).forEach(o=>{
      state.ownedMap[o.card_id] = Number(o.count||0);
      state.newMap[o.card_id] = (Number(o.is_new||0) === 1);
    });
    updateStats();
    renderPage();

    // If we were waiting for album data to show the queued reward popup, do it now.
    const ov=document.getElementById('overlay');
    if(ov && !ov.classList.contains('hidden')){
      if(state._pendingRewardNeedsAlbum){
        state._pendingRewardNeedsAlbum = false;
      }
      try{ maybeShowQueuedRewardOnOpen(); }catch(_){ }
    }
    return;
  }

  if(d.action === 'cardReceived'){
    // Do NOT auto-open UI when a card is received.
    // Queue it; if the binder is open, show immediately (or right after current popup).
    if(!state.pendingRewards) state.pendingRewards = [];
    state.pendingRewards.push({ cardId: d.cardId, isNew: !!d.isNew });

    const ov=document.getElementById('overlay');
    if(ov && !ov.classList.contains('hidden')){
      try{ maybeShowQueuedRewardOnOpen(); }catch(_){}
    }
    return;
  }

  // ADMIN
  if(d.action === 'openAdmin'){
    adminOpen();
    adminSetTab(adminState.tab || 'list');
  try{ adminSyncCardId(); }catch(_){}
    // reset the form only when opening the add tab manually
    if((adminState.tab||'list') !== 'add') { try{ adminResetForm(); }catch(_){ } }
    return;
  }
  if(d.action === 'adminCards'){
    adminOpen();
    adminRenderList(d.cards || []);
    // stay on current tab; list updates in background
    return;
  }
  if(d.action === 'adminRarityWeights'){
    adminApplyRarityWeights(d.weights || {});
    return;
  }
});




// ===== ADMIN (bind handlers) =====


function adminCollectRarityWeights(){
  const get = (id)=> Math.max(0, Math.floor(Number(document.getElementById(id)?.value || 0)));
  return {
    R: get('rarityWeightR'),
    SR: get('rarityWeightSR'),
    SSR: get('rarityWeightSSR'),
    UR: get('rarityWeightUR')
  };
}

function adminUpdateRarityPercentages(){
  const weights = adminCollectRarityWeights();
  const total = Object.values(weights).reduce((a,b)=>a + (Number(b)||0), 0);
  const fmt = (v)=> total > 0 ? `${((v/total)*100).toFixed(2)}%` : '0%';
  const set = (id,val)=>{ const el=document.getElementById(id); if(el) el.textContent = `約 ${fmt(val)}`; };
  set('rarityPctR', weights.R);
  set('rarityPctSR', weights.SR);
  set('rarityPctSSR', weights.SSR);
  set('rarityPctUR', weights.UR);
  const totalEl = document.getElementById('rarityWeightTotal');
  if(totalEl) totalEl.textContent = String(total);
}

function adminApplyRarityWeights(weights){
  adminState.rarityWeights = {
    R: Math.max(0, Math.floor(Number(weights.R ?? weights.r ?? adminState.rarityWeights?.R ?? 0))),
    SR: Math.max(0, Math.floor(Number(weights.SR ?? weights.sr ?? adminState.rarityWeights?.SR ?? 0))),
    SSR: Math.max(0, Math.floor(Number(weights.SSR ?? weights.ssr ?? adminState.rarityWeights?.SSR ?? 0))),
    UR: Math.max(0, Math.floor(Number(weights.UR ?? weights.ur ?? adminState.rarityWeights?.UR ?? 0)))
  };
  const set = (id,val)=>{ const el=document.getElementById(id); if(el) el.value = String(val); };
  set('rarityWeightR', adminState.rarityWeights.R);
  set('rarityWeightSR', adminState.rarityWeights.SR);
  set('rarityWeightSSR', adminState.rarityWeights.SSR);
  set('rarityWeightUR', adminState.rarityWeights.UR);
  adminUpdateRarityPercentages();
}

function adminNextCardId(rarity){
  const prefix = String(rarity||'R').toLowerCase();
  const re = new RegExp('^' + prefix + '_(\\d{3})$', 'i');
  let max = 0;
  (adminState.cards||[]).forEach(c=>{
    const m = String(c.card_id||'').match(re);
    if(m){
      const n = parseInt(m[1],10);
      if(!isNaN(n)) max = Math.max(max, n);
    }
  });
  const next = max + 1;
  return `${prefix}_${String(next).padStart(3,'0')}`;
}

function adminSyncCardId(){
  const r = document.getElementById('rarity')?.value || 'R';
  const id = adminNextCardId(r);
  const el = document.getElementById('card_id');
  if(el) el.value = id;
  const pv = document.getElementById('cardIdPreview');
  if(pv) pv.textContent = `card_id: ${id}`;
  try{ adminSyncPlacement(); }catch(_){}
  return id;
}


function adminPageForRarity(rarity){
  const r = String(rarity||'R').toLowerCase();
  const map = { r:1, sr:2, ssr:3, ur:4 };
  return map[r] ?? 1;
}

function adminNextSlot(page){
  const p = Number(page||1);
  const used = new Set();
  (adminState.cards||[]).forEach(c=>{
    if(Number(c.page)===p){
      const s = Number(c.slot);
      if(!isNaN(s) && s>0) used.add(s);
    }
  });
  // pick the smallest free positive integer
  let slot = 1;
  while(used.has(slot)) slot++;
  return slot;
}

function adminSyncPlacement(){
  const rarity = document.getElementById('rarity')?.value || 'R';
  const page = adminPageForRarity(rarity);
  const pageEl = document.getElementById('page');
  if(pageEl){
    pageEl.value = String(page);
    pageEl.disabled = true;
  }
  const slot = adminNextSlot(page);
  const slotEl = document.getElementById('slot');
  if(slotEl){
    slotEl.value = String(slot);
    slotEl.disabled = true;
  }
  const pv = document.getElementById('placePreview');
  if(pv) pv.textContent = `place: p${page} / s${slot}`;
  return {page, slot};
}


function adminCollectForm(){
  return {
    card_id: document.getElementById('card_id')?.value?.trim() || '',
    label: document.getElementById('label')?.value?.trim() || '',
    rarity: document.getElementById('rarity')?.value || 'R',
    weight: Number(document.getElementById('weight')?.value || 0),
    page: Number(document.getElementById('page')?.value || 1),
    slot: Number(document.getElementById('slot')?.value || 1),
    image_url: document.getElementById('image_url')?.value?.trim() || '',
    is_limited: !!document.getElementById('is_limited')?.checked,
    start_date: document.getElementById('start_date')?.value || '',
    end_date: document.getElementById('end_date')?.value || ''
  };
}

function adminResetForm(){
  const id = document.getElementById('card_id'); if(id){ id.value=''; id.disabled=true; }
  const label = document.getElementById('label'); if(label) label.value='';
  const rarity = document.getElementById('rarity'); if(rarity) rarity.value='R';
  const weight = document.getElementById('weight'); if(weight) weight.value='';
  const page = document.getElementById('page'); if(page) page.value='1';
  const slot = document.getElementById('slot'); if(slot) slot.value='1';
  const url = document.getElementById('image_url'); if(url) url.value='';
  const lim = document.getElementById('is_limited'); if(lim) lim.checked=false;
  const sd = document.getElementById('start_date'); if(sd) sd.value='';
  const ed = document.getElementById('end_date'); if(ed) ed.value='';
  adminState.editingId = null;
  adminState.deletePendingId = null;
  adminState.deleteSubmitting = false;
  const title = document.getElementById('formTitle'); if(title) title.textContent='新規カード追加';
  const preview = document.getElementById('cardIdPreview'); if(preview) preview.textContent='';
  try{ adminUpdateDeleteButton(); }catch(_){ }
  try{ adminCloseDeleteModal(); }catch(_){ }
  try{ adminSyncCardId(); }catch(_){}
}function adminOpen(){
  const ov = document.getElementById('adminOverlay');
  if(!ov) return;
  ov.classList.remove('hidden'); state.overlayOpen=true; try{ maybeShowQueuedRewardOnOpen(); }catch(_){ }
  // keep the last tab the admin used
  adminSetTab(adminState.tab || 'list');
  try{ adminSyncCardId(); }catch(_){}
}

function adminClose(){
  const ov = document.getElementById('adminOverlay');
  if(ov) ov.classList.add('hidden');
  // reset form state so it never gets stuck (e.g. card_id disabled)
  try{ adminResetForm(); }catch(_){}
}

function adminSetTab(tab){
  adminState.tab = tab || 'list';
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.tabContent').forEach(x=>x.classList.remove('active'));
  const t = document.querySelector(`.tab[data-tab="${tab}"]`);
  if(t) t.classList.add('active');
  if(tab==='list') document.getElementById('adminList')?.classList.add('active');
  if(tab==='add') document.getElementById('adminAdd')?.classList.add('active');
  if(tab==='add') { try{ adminSyncCardId(); }catch(_){} try{ adminUpdateDeleteButton(); }catch(_){} }
  else { try{ adminCloseDeleteModal(); }catch(_){} }
  if(tab==='give') document.getElementById('adminGive')?.classList.add('active');
  if(tab==='rates') document.getElementById('adminRates')?.classList.add('active');
}


function adminEditCard(card){
  try{
    if(!card) return;
    // switch to add/edit tab
    try{ adminSetTab('add'); }catch(_){}
    const setVal = (id, v)=>{ const el=document.getElementById(id); if(el!=null) el.value = (v==null?'':String(v)); };
    const setChk = (id, v)=>{ const el=document.getElementById(id); if(el!=null) el.checked = !!v; };

    // populate fields
    setVal('card_id', card.card_id);
    setVal('label', card.display_name || card.displayName || card.name || card.title || card.label || '');
    setVal('rarity', (card.rarity || 'R'));
    setVal('weight', (card.weight ?? '1'));
    setVal('image_url', (card.image_url || card.imageUrl || card.image || ''));

    setChk('is_limited', Number(card.is_limited ?? card.limited ?? 0) === 1 || (card.is_limited === true) || (card.limited === true));

    // datetime-local expects YYYY-MM-DDTHH:MM (local time)
    const pad2 = (n)=> String(n).padStart(2,'0');
    const toLocalInput = (d)=>{
      if(!(d instanceof Date) || isNaN(d.getTime())) return '';
      return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    };
    const normDt = (v)=>{
      if(v == null || v === '') return '';
      // If numeric timestamp (seconds or ms)
      const num = (typeof v === 'number') ? v : (/^\d{10,13}$/.test(String(v)) ? Number(v) : NaN);
      if(Number.isFinite(num)){
        const ms = (String(num).length <= 10) ? num*1000 : num;
        return toLocalInput(new Date(ms));
      }
      const s = String(v);
      // Common SQL datetime: "YYYY-MM-DD HH:MM:SS"
      let t = s.includes('T') ? s : s.replace(' ', 'T');
      // strip timezone / millis
      t = t.replace(/\.\d+Z?$/,'').replace(/Z$/,'');
      // accept "YYYY-MM-DDTHH:MM"
      const m = t.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
      return m ? m[0] : '';
    };
setVal('start_date', normDt(card.start_date));
    setVal('end_date', normDt(card.end_date));

    // keep page/slot hidden fields if present
    if(document.getElementById('page')) setVal('page', (card.page ?? document.getElementById('page').value));
    if(document.getElementById('slot')) setVal('slot', (card.slot ?? document.getElementById('slot').value));

    const title = document.getElementById('formTitle');
    if(title) title.textContent = 'カード編集';
    adminState.editingId = String(card.card_id || '');
    const preview = document.getElementById('cardIdPreview');
    if(preview) preview.textContent = `card_id: ${card.card_id}`;
    try{ adminUpdateDeleteButton(); }catch(_){ }

  }catch(e){}
}

function adminUpdateDeleteButton(){
  const btn = document.getElementById('deleteCardBtn');
  if(!btn) return;
  const editing = !!adminState.editingId;
  btn.classList.toggle('hidden', !editing);
  btn.disabled = !editing || adminState.deleteSubmitting;
}

function adminOpenDeleteModal(){
  if(!adminState.editingId || adminState.deleteSubmitting) return;
  adminState.deletePendingId = String(adminState.editingId);
  const modal = document.getElementById('deleteConfirmModal');
  const target = document.getElementById('deleteTargetCardId');
  if(target) target.textContent = `card_id: ${adminState.deletePendingId}`;
  if(modal) modal.classList.remove('hidden');
}

function adminCloseDeleteModal(){
  adminState.deletePendingId = null;
  const modal = document.getElementById('deleteConfirmModal');
  if(modal) modal.classList.add('hidden');
}

function adminConfirmDelete(){
  const cardId = String(adminState.deletePendingId || adminState.editingId || '');
  if(!cardId || adminState.deleteSubmitting) return;
  adminState.deleteSubmitting = true;
  const btn = document.getElementById('deleteConfirmBtn');
  if(btn){ btn.disabled = true; btn.textContent = '削除中...'; }
  postNui('adminDelete', {card_id: cardId}).finally(()=>{
    adminState.deleteSubmitting = false;
    if(btn){ btn.disabled = false; btn.textContent = '削除する'; }
    try{ adminUpdateDeleteButton(); }catch(_){ }
  });
  adminCloseDeleteModal();
  try{ adminResetForm(); }catch(_){ }
}

function adminRenderList(cards){
  const list = document.getElementById('cardList');
  if(!list) return;

  // preserve scroll position
  adminState.listScroll = list.scrollTop || 0;
  adminState.cards = (cards||[]).slice();
  try{ if((adminState.tab||'list')==='add') adminSyncCardId(); }catch(_){}

  list.innerHTML = '';

  (cards||[]).forEach(c=>{
    const row = document.createElement('div');
    const active = (Number(c.is_active)===1);

    row.className = 'adminTradeItem' + (active ? '' : ' inactive');
    const rarityRaw = (c.rarity ? String(c.rarity) : (String(c.card_id||'').split('_')[0]||'')).toUpperCase();
    const rarityCls = String(rarityRaw||'').toLowerCase();
    const img = c.image_url || c.imageUrl || c.image || c.img || '';
    const label = getCardLabel(c, c.card_id);

    row.innerHTML = `
      <div class="tradeLeft">
        <div class="tradeThumbWrap">${img ? `<img class="tradeThumb" src="${esc(img)}" alt="card" />` : `<div class="tradeThumb ph"></div>`}</div>
        <div class="tradeInfo">
          <div class="tradeLine1">
            <span class="badge-rarity badge-${esc(rarityCls)}">${esc(rarityRaw||'')}</span>
            <span class="tradeName">${esc(label)}</span>
          </div>
          <div class="tradeLine2 mono"><span class="pill ${active?'':'off'}" style="margin-left:8px">${active?'ACTIVE':'INACTIVE'}</span>
          </div>
        </div>
      </div>
      <div class="adminActions"><button class="btn subtle adminEditBtn">編集</button><button class="btn adminToggleBtn">${active?'無効':'有効'}</button></div>
    `;

    row.querySelector('button.adminToggleBtn').onclick = ()=> postNui('adminToggleActive', {card_id: c.card_id});
    row.querySelector('button.adminEditBtn')?.addEventListener('click', (e)=>{ e.stopPropagation(); adminEditCard(c); });
    list.appendChild(row);
  });

  requestAnimationFrame(()=>{ try{ list.scrollTop = adminState.listScroll||0; }catch(_){ } });
}

document.addEventListener('DOMContentLoaded', ()=>{
  // close
  document.getElementById('adminClose')?.addEventListener('click', ()=>{ postNui('close'); adminClose(); });
  // tabs
  document.querySelectorAll('.tab').forEach(t=>{
    t.addEventListener('click', ()=> adminSetTab(t.dataset.tab));
  });
  // reset
  document.getElementById('resetFormBtn')?.addEventListener('click', adminResetForm);
  document.getElementById('deleteCardBtn')?.addEventListener('click', adminOpenDeleteModal);
  document.getElementById('deleteCancelBtn')?.addEventListener('click', adminCloseDeleteModal);
  document.getElementById('deleteConfirmBtn')?.addEventListener('click', adminConfirmDelete);
  document.querySelector('#deleteConfirmModal .confirmModalBackdrop')?.addEventListener('click', adminCloseDeleteModal);
  // auto card_id
  document.getElementById('rarity')?.addEventListener('change', adminSyncCardId);
  try{ adminSyncCardId(); }catch(_){}
  // save
  document.getElementById('saveCardBtn')?.addEventListener('click', ()=>{
    const data = adminCollectForm();
    if(!data.label) return tcShowToast('表示名は必須', 'error');
    if(!data.image_url) return tcShowToast('画像URLは必須', 'error');
    if(!data.weight || data.weight <= 0) return tcShowToast('weight は 1 以上推奨', 'error');
    if(adminState.editingId){ postNui('adminUpdate', data); }
    else { postNui('adminAdd', data); }
  });
  // give pack
  document.getElementById('givePackBtn')?.addEventListener('click', ()=>{
    const targetId = Number(document.getElementById('targetId')?.value || 0);
    const amount = Number(document.getElementById('amount')?.value || 1);
    if(!targetId) return tcShowToast('送り先IDを入力してください。', "error");
    postNui('adminGivePack', {targetId, amount});
  });
  // give card finder
  document.getElementById('giveFinderBtn')?.addEventListener('click', ()=>{
    const targetId = Number(document.getElementById('targetId')?.value || 0);
    if(!targetId) return tcShowToast('送り先IDを入力してください。', "error");
    postNui('adminGiveFinder', {targetId});
  });
  ['rarityWeightR','rarityWeightSR','rarityWeightSSR','rarityWeightUR'].forEach(id=>{
    document.getElementById(id)?.addEventListener('input', adminUpdateRarityPercentages);
  });
  document.getElementById('saveRarityWeightsBtn')?.addEventListener('click', ()=>{
    const data = adminCollectRarityWeights();
    const total = Object.values(data).reduce((a,b)=>a + (Number(b)||0), 0);
    if(total <= 0) return tcShowToast('排出率の合計は 1 以上にしてください', 'error');
    postNui('adminSaveRarityWeights', data);
  });
  adminApplyRarityWeights(adminState.rarityWeights || {});
  try{ adminUpdateDeleteButton(); }catch(_){ }
});





function initPreviewArrows(){
  const prev=document.getElementById('prevArrow');
  const next=document.getElementById('nextArrow');
  if(prev){
    prev.addEventListener('click', (ev)=>{ ev.stopPropagation(); previewStep(-1); });
  }
  if(next){
    next.addEventListener('click', (ev)=>{ ev.stopPropagation(); previewStep(1); });
  }
}
document.addEventListener('DOMContentLoaded', ()=>{ try{ initPreviewArrows(); }catch(_){} });

document.addEventListener('DOMContentLoaded', ()=>{
  const p10=document.getElementById('prev10');
  const n10=document.getElementById('next10');
  if(p10) p10.addEventListener('click', ()=>jumpPage10(-10));
  if(n10) n10.addEventListener('click', ()=>jumpPage10(10));
});
// toast handler injection failed: please place manually