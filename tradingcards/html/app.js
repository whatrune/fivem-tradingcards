document.addEventListener('DOMContentLoaded',()=>{
  document.body.style.background = 'transparent';
  const o=document.getElementById('overlay'); const a=document.getElementById('adminOverlay');
  if(o) o.classList.add('hidden'); if(a) a.classList.add('hidden');
});

let state={currentPage:1,allCards:[],ownedMap:{},newMap:{},pendingCard:null,selectedTarget:null,mode:'album'};
function postNui(endpoint,data={}){return fetch(`https://${GetParentResourceName()}/${endpoint}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}).catch(()=>null);}
function playSound(id,vol=0.6){const e=document.getElementById(id); if(!e) return; try{e.pause();e.currentTime=0;e.volume=vol;const p=e.play(); if(p&&p.catch)p.catch(()=>{});}catch(_){}}
function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}

function openOverlay(){document.getElementById('overlay').classList.remove('hidden')}
function closeOverlay(){document.getElementById('overlay').classList.add('hidden');hideTrade();}
document.getElementById('closeBtn').onclick=()=>{postNui('close');closeOverlay();}
document.getElementById('tradeClose').onclick=()=>hideTrade();

function showReward(html,bg){const r=document.getElementById('rewardEffect');const c=document.getElementById('rewardCard'); if(bg) r.style.background=bg; c.innerHTML=html; r.classList.remove('hidden');}
function hideReward(){document.getElementById('rewardEffect').classList.add('hidden'); document.getElementById('rewardEffect').style.background='rgba(0,0,0,.80)';}

// pack peel
let drag={active:false,startY:0,opened:false};
function showPack(card){
  state.pendingCard=card;
  const layer=document.getElementById('packLayer');
  layer.classList.remove('opening');
  layer.classList.remove('hidden'); layer.classList.remove('r','sr','ssr','ur');
  layer.classList.add((card.rarity||'R').toLowerCase());
  playSound('sound_'+(card.rarity||'R').toLowerCase(),0.65);
  const top=document.getElementById('packTop'); top.style.transition=''; top.style.opacity='1'; top.style.transform='translateY(0px)';
  drag.opened=false;
}
function hidePack(){document.getElementById('packLayer').classList.add('hidden');}
function openPackNow(){
  if(drag.opened) return; drag.opened=true;
  playSound('sound_open',0.7); hidePack();
  setTimeout(()=>{
    const c=state.pendingCard; if(!c) return;
    showReward(`<img src="${c.image_url||''}"><div style="font-size:18px;font-weight:700">${esc(c.label||c.card_id)}</div><div style="opacity:.85">${esc(c.rarity||'')}</div>`,
      c.rarity==='UR'?'rgba(255,255,255,.55)':(c.rarity==='SSR'?'rgba(255,213,74,.18)':'rgba(0,0,0,.80)'));
    setTimeout(hideReward, c.rarity==='UR'?2000:1200);
  },260);
}
(function(){
  const layer = document.getElementById('packLayer');
  const top = document.getElementById('packTop');

  const ripFinish = ()=>{
    if(drag.opened) return;
    drag.opened = true;

    layer.classList.add('opening');

    top.style.transition='transform 220ms ease-out, opacity 220ms ease-out';
    top.style.transform='translateY(-260px) rotateX(55deg) rotateZ(-4deg)';
    top.style.opacity='0';

    // playSound('sound_rip', 0.85); // 任意：破りSE

    setTimeout(()=>{
      layer.classList.remove('opening');
      top.style.transition='';
      top.style.opacity='1';
      top.style.transform='translateY(0px)';
      openPackNow();
    },240);
  };

  const down=y=>{ if(drag.opened) return; drag.active=true; drag.startY=y; };
  const move=y=>{
    if(!drag.active||drag.opened) return;
    const diff=drag.startY-y;
    const c=Math.max(0,Math.min(160,diff));
    top.style.transform=`translateY(${-c}px)`;
    if(c>=120){ drag.active=false; ripFinish(); }
  };
  const up=()=>{
    drag.active=false;
    if(!drag.opened) top.style.transform='translateY(0px)';
  };

  top.addEventListener('mousedown',e=>down(e.clientY));
  document.addEventListener('mousemove',e=>move(e.clientY));
  document.addEventListener('mouseup',up);

  top.addEventListener('touchstart',e=>down(e.touches[0].clientY),{passive:true});
  document.addEventListener('touchmove',e=>move(e.touches[0].clientY),{passive:true});
  document.addEventListener('touchend',up);
})();

function updateStats(){
  const total=state.allCards.length; let owned=0;
  const rt={r:0,sr:0,ssr:0,ur:0}, ro={r:0,sr:0,ssr:0,ur:0};
  state.allCards.forEach(c=>{const r=(c.rarity||'R').toLowerCase(); if(rt[r]==null) return; rt[r]++; if(state.ownedMap[c.card_id]){owned++; ro[r]++;}});
  const pct=total?Math.floor((owned/total)*100):0;
  document.getElementById('collectionInfo').textContent=`Collection: ${owned}/${total} (${pct}%)`;
  document.getElementById('rarityInfo').innerHTML=`<span class="r">R ${ro.r}/${rt.r}</span><span class="sr">SR ${ro.sr}/${rt.sr}</span><span class="ssr">SSR ${ro.ssr}/${rt.ssr}</span><span class="ur">UR ${ro.ur}/${rt.ur}</span>`;
}
function renderPage(){
  const L=document.getElementById('leftPage'), R=document.getElementById('rightPage'); L.innerHTML=''; R.innerHTML='';
  const pageCards=state.allCards.filter(c=>Number(c.page||1)===state.currentPage).sort((a,b)=>Number(a.slot||1)-Number(b.slot||1));
  pageCards.forEach((c,i)=>{
    const el=document.createElement('div'); el.className='card '+(c.rarity||'R').toLowerCase();
    const owned=!!state.ownedMap[c.card_id]; if(!owned) el.classList.add('locked');
    el.innerHTML=`<img src="${c.image_url||''}"><div class="label">${esc(c.label||c.card_id)}${owned?` <span class="mono">x${state.ownedMap[c.card_id]}</span>`:''}</div>`;
    if(state.newMap[c.card_id]){const b=document.createElement('div'); b.className='newBadge'; b.textContent='NEW'; el.appendChild(b);}
    el.onclick=()=>{ if(state.newMap[c.card_id]){state.newMap[c.card_id]=false;postNui('clearNew',{cardId:c.card_id});renderPage();} if(state.mode==='tradeCards') confirmSend(c.card_id); };
    if(i<4)L.appendChild(el); else R.appendChild(el);
  });
  document.getElementById('pageIndicator').textContent=`Page ${state.currentPage}`;
}
function flipPage(dir){
  playSound('sound_page',0.35);
  const s=document.getElementById('spread'); s.classList.add(dir==='next'?'flip-left':'flip-right');
  setTimeout(()=>{ if(dir==='next') state.currentPage++; else if(state.currentPage>1) state.currentPage--; renderPage(); s.classList.remove('flip-left','flip-right'); },600);
}
document.getElementById('next').onclick=()=>flipPage('next');
document.getElementById('prev').onclick=()=>{if(state.currentPage>1) flipPage('prev');};

function showTrade(){document.getElementById('tradePanel').classList.remove('hidden')}
function hideTrade(){document.getElementById('tradePanel').classList.add('hidden'); state.mode='album'; state.selectedTarget=null;}
function renderTradePlayers(players){
  const body=document.getElementById('tradeBody'); body.innerHTML='';
  if(!players||players.length===0){body.innerHTML='<div class="mono">近くにプレイヤーがいません</div>';return;}
  players.forEach(p=>{const d=document.createElement('div'); d.className='tradeItem';
    d.innerHTML=`<div>Player ID: <b>${p.id}</b></div><button class="btn">Select</button>`;
    d.querySelector('button').onclick=()=>{state.selectedTarget=p.id;state.mode='tradeCards';renderTradeCards();}; body.appendChild(d);});
}
function renderTradeCards(){
  const body=document.getElementById('tradeBody'); body.innerHTML='';
  const ids=Object.keys(state.ownedMap); if(ids.length===0){body.innerHTML='<div class="mono">送れるカードがありません</div>';return;}
  ids.sort().forEach(id=>{const d=document.createElement('div'); d.className='tradeItem';
    d.innerHTML=`<div><b>${esc(id)}</b> <span class="mono">x${state.ownedMap[id]}</span></div><button class="btn">Send</button>`;
    d.querySelector('button').onclick=()=>confirmSend(id); body.appendChild(d);});
}
function confirmSend(cardId){
  if(!state.selectedTarget){alert('先に送り先を選択してね');return;}
  if(!confirm(`ID ${state.selectedTarget} に ${cardId} を1枚送信しますか？`)) return;
  postNui('sendCard',{targetId:state.selectedTarget,cardId}); hideTrade();
}
document.getElementById('tradeBtn').onclick=async()=>{
  state.mode='tradePlayers'; state.selectedTarget=null; showTrade();
  try{const resp=await fetch(`https://${GetParentResourceName()}/getNearbyPlayers`,{method:'POST'}); let players=null;
    try{players=await resp.json();}catch{players=JSON.parse(await resp.text());} renderTradePlayers(players);
  }catch(_){renderTradePlayers([]);}
};

function showReceive(cardId,isNew){
  showReward(`<div style="font-size:18px;font-weight:700;${isNew?'color:#9b59ff;':''}">${isNew?'NEW CARD ACQUIRED':'カードを受け取りました'}</div><div style="font-size:22px">${esc(cardId)}</div>`,
    isNew?'rgba(155, 89, 255, 0.25)':'rgba(0, 200, 255, 0.15)'); setTimeout(hideReward,1400);
}

function openAdmin(){document.getElementById('adminOverlay').classList.remove('hidden');}
function closeAdmin(){document.getElementById('adminOverlay').classList.add('hidden'); document.getElementById('card_id').disabled=false;}
document.getElementById('adminClose').onclick=()=>{postNui('close');closeAdmin();}

(function particles(){
  const canvas=document.getElementById('particles'); if(!canvas) return; const ctx=canvas.getContext('2d'); const parts=[]; const count=35;
  const resize=()=>{canvas.width=window.innerWidth; canvas.height=window.innerHeight;}; resize(); window.addEventListener('resize',resize);
  for(let i=0;i<count;i++) parts.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height,r:Math.random()*2+1,s:Math.random()*0.3+0.1,a:Math.random()*0.5+0.2});
  const tick=()=>{ctx.clearRect(0,0,canvas.width,canvas.height); for(const p of parts){ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fillStyle=`rgba(0,200,255,${p.a})`; ctx.fill(); p.y-=p.s; if(p.y<0){p.y=canvas.height;p.x=Math.random()*canvas.width;}} requestAnimationFrame(tick);}; tick();
})();

window.addEventListener('message',(ev)=>{
  const d=ev.data||{};
  if(d.action==='forceClose'){closeOverlay();closeAdmin();return;}
  if(d.action==='openBinder'){openOverlay();return;}
  if(d.action==='openPack'){openOverlay();showPack(d.card);return;}
  if(d.action==='albumData'){state.allCards=d.allCards||[]; state.ownedMap={}; state.newMap={};
    (d.owned||[]).forEach(o=>{state.ownedMap[o.card_id]=Number(o.count||0); state.newMap[o.card_id]=(Number(o.is_new||0)===1);});
    updateStats(); renderPage(); return;}
  if(d.action==='cardReceived'){openOverlay(); showReceive(d.cardId,!!d.isNew); return;}
  if(d.action==='openAdmin'){openAdmin(); return;}
  if(d.action==='adminCards'){openAdmin(); return;}
});


function wireAdminTabs(){
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.tabContent');
  if(!tabs.length) return;

  tabs.forEach(t=>{
    t.addEventListener('click', ()=>{
      tabs.forEach(x=>x.classList.remove('active'));
      t.classList.add('active');
      contents.forEach(c=>c.classList.remove('active'));

      const tab = t.dataset.tab;
      if(tab === 'list') document.getElementById('adminList')?.classList.add('active');
      if(tab === 'add') document.getElementById('adminAdd')?.classList.add('active');
      if(tab === 'give') document.getElementById('adminGive')?.classList.add('active');
    });
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  wireAdminTabs();
});


// ===== ADMIN (bind handlers) =====
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
  const id = document.getElementById('card_id'); if(id){ id.value=''; id.disabled=false; }
  const label = document.getElementById('label'); if(label) label.value='';
  const rarity = document.getElementById('rarity'); if(rarity) rarity.value='R';
  const weight = document.getElementById('weight'); if(weight) weight.value='';
  const page = document.getElementById('page'); if(page) page.value='1';
  const slot = document.getElementById('slot'); if(slot) slot.value='1';
  const url = document.getElementById('image_url'); if(url) url.value='';
  const lim = document.getElementById('is_limited'); if(lim) lim.checked=false;
  const sd = document.getElementById('start_date'); if(sd) sd.value='';
  const ed = document.getElementById('end_date'); if(ed) ed.value='';
}

function adminOpen(){
  document.getElementById('adminOverlay')?.classList.remove('hidden');
}

function adminClose(){
  document.getElementById('adminOverlay')?.classList.add('hidden');
}

function adminSetTab(tab){
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  document.querySelectorAll('.tabContent').forEach(x=>x.classList.remove('active'));
  const t = document.querySelector(`.tab[data-tab="${tab}"]`);
  if(t) t.classList.add('active');
  if(tab==='list') document.getElementById('adminList')?.classList.add('active');
  if(tab==='add') document.getElementById('adminAdd')?.classList.add('active');
  if(tab==='give') document.getElementById('adminGive')?.classList.add('active');
}

function adminRenderList(cards){
  const list = document.getElementById('cardList');
  if(!list) return;
  list.innerHTML = '';
  (cards||[]).forEach(c=>{
    const row = document.createElement('div');
    row.className = 'rowItem';
    const active = (Number(c.is_active)===1);
    row.innerHTML = `
      <div>
        <div><b>${esc(c.card_id)}</b> <span class="pill ${active?'':'off'}">${active?'ACTIVE':'INACTIVE'}</span></div>
        <div class="mono">${esc(c.rarity)} | w:${c.weight} | p:${c.page} s:${c.slot}</div>
      </div>
      <div class="row" style="justify-content:flex-end">
        <button class="btn">${active?'無効化':'有効化'}</button>
      </div>
    `;
    row.querySelector('button').onclick = ()=> postNui('adminToggleActive', {card_id: c.card_id});
    list.appendChild(row);
  });
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
  // save
  document.getElementById('saveCardBtn')?.addEventListener('click', ()=>{
    const data = adminCollectForm();
    if(!data.card_id) return alert('card_id は必須');
    if(!data.label) return alert('表示名は必須');
    if(!data.image_url) return alert('画像URLは必須');
    if(!data.weight || data.weight <= 0) return alert('weight は 1 以上推奨');
    postNui('adminAdd', data);
  });
  // give pack
  document.getElementById('givePackBtn')?.addEventListener('click', ()=>{
    const targetId = Number(document.getElementById('targetId')?.value || 0);
    const amount = Number(document.getElementById('amount')?.value || 1);
    if(!targetId) return alert('プレイヤーIDを入れてね');
    postNui('adminGivePack', {targetId, amount});
  });
});


// ADMIN bridge (separate listener to avoid messing with existing one)
window.addEventListener('message', (ev)=>{
  const d = ev.data || {};
  if(d.action === 'openAdmin'){
    adminOpen();
    adminSetTab('list');
    adminResetForm();
  }
  if(d.action === 'adminCards'){
    adminOpen();
    adminRenderList(d.cards || []);
  }
});
