// ---------- Storage layer (swap this object for Firebase/Supabase later) ----------
const KEY='spc_portal_v1';
const Store={
  load(){try{return JSON.parse(localStorage.getItem(KEY))}catch(e){return null}},
  save(state){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){}}
};

// ---------- State ----------
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4);
const mkSet=(name,tag,custom)=>({id:uid(),name,tag,custom:!!custom,questions:[]});
let S=Store.load();
if(!S||!Array.isArray(S.sets)||!S.sets.length){S={sets:[mkSet('SPC – CAT2 – Set 3','SET C'),mkSet('SPC – CAT2 – Set 5','SET A')]};}
if(!S.sets.find(s=>s.id===S.cur))S.cur=S.sets[0].id;
const cur=()=>S.sets.find(s=>s.id===S.cur)||S.sets[0];
const save=()=>Store.save(S);
let qf='',ff='all',lastPick=null;

const $=s=>document.querySelector(s);
const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const letter=i=>i<26?String.fromCharCode(65+i):String(i+1);

// ---------- Modal + toast ----------
function ask(title,fields,ok,msg){
  return new Promise(res=>{
    const m=$('#modal');
    m.innerHTML=`<form class="mbox"><h3>${esc(title)}</h3>${msg?`<p>${esc(msg)}</p>`:''}${fields.map((f,i)=>`<label>${esc(f.label)}${f.area?`<textarea name="f${i}" rows="${f.rows||4}" placeholder="${esc(f.ph||'')}" ${f.req?'required':''}>${esc(f.value||'')}</textarea>`:`<input name="f${i}" value="${esc(f.value||'')}" placeholder="${esc(f.ph||'')}" ${f.req?'required':''}>`}</label>`).join('')}<div class="row"><button type="button" class="btn ghost" id="mc">Cancel</button><button class="btn ${ok==='Delete'?'danger':''}">${ok||'Save'}</button></div></form>`;
    m.classList.add('open');
    const form=m.firstChild;
    const close=v=>{m.classList.remove('open');m.innerHTML='';document.removeEventListener('keydown',esc_);res(v)};
    const esc_=e=>{if(e.key==='Escape')close(null)};
    document.addEventListener('keydown',esc_);
    form.onsubmit=e=>{e.preventDefault();close(fields.map((f,i)=>form['f'+i].value))};
    $('#mc').onclick=()=>close(null);
    m.onclick=e=>{if(e.target===m)close(null)};
    const first=form.querySelector('input,textarea');if(first)first.focus();else form.querySelector('.row .btn:last-child').focus();
  });
}
let tt;
function toast(t){const el=$('#toast');el.textContent=t;el.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>el.classList.remove('show'),2200)}

// ---------- Rendering ----------
function renderSets(){
  $('#sets').innerHTML=S.sets.map(s=>{
    const a=s.questions.filter(q=>q.selected).length;
    return `<div class="set ${s.id===S.cur?'on':''}" data-act="set" data-s="${s.id}" tabindex="0" role="button" aria-pressed="${s.id===S.cur}">
      <span class="tag">${esc(s.tag||'SET')}</span><h3>${esc(s.name)}</h3>
      <p>${s.questions.length} questions · ${a} answered</p>
      ${s.custom?`<button class="ib" data-act="ds" data-s="${s.id}" title="Delete set" aria-label="Delete set">🗑</button>`:''}</div>`;
  }).join('')+`<div class="set add" data-act="as" tabindex="0" role="button">＋ Add new set</div>`;
}
function renderStats(){
  const set=cur(),total=set.questions.length,a=set.questions.filter(q=>q.selected).length;
  const pct=total?Math.round(a/total*100):0;
  const items=[['📁',S.sets.length,'Question sets'],['❓',total,'Questions in this set'],['✅',a,'Answered'],['⏳',total-a,'Unanswered'],['🎯',pct+'%','Progress']];
  $('#stats').innerHTML=items.map(i=>`<div class="stat"><span>${i[0]} ${i[2]}</span><b>${i[1]}</b></div>`).join('');
  $('#barfill').style.width=pct+'%';$('#pct').textContent=pct+'%';
  $('#setTitle').textContent=`Questions – ${set.name}${set.tag?' ('+set.tag+')':''}`;
}
function renderNav(){
  $('#nav').innerHTML=cur().questions.map((q,i)=>`<button class="pill ${q.selected?'done':''}" data-act="nav" data-q="${q.id}" title="Question ${i+1}">${i+1}</button>`).join('');
}
function renderList(){
  const set=cur();
  const items=set.questions.map((q,i)=>({q,n:i+1})).filter(({q})=>{
    if(ff==='a'&&!q.selected)return false;
    if(ff==='u'&&q.selected)return false;
    if(qf&&!(q.text+' '+q.options.map(o=>o.text).join(' ')).toLowerCase().includes(qf.toLowerCase()))return false;
    return true;
  });
  if(!set.questions.length){$('#list').innerHTML=`<div class="empty">No questions in this set yet.<br>Click <b>＋ Add question</b> to start.</div>`;return}
  if(!items.length){$('#list').innerHTML=`<div class="empty">No questions match your search or filter.</div>`;return}
  $('#list').innerHTML=items.map(({q,n})=>`
  <article class="q ${q.selected?'ans':''}" id="q-${q.id}">
    <div class="qh"><div class="qn">${n}</div><p class="qt">${esc(q.text)}</p>
      <div class="qa"><button class="ib" data-act="eq" data-q="${q.id}" title="Edit question" aria-label="Edit question">✏️</button><button class="ib" data-act="dq" data-q="${q.id}" title="Delete question" aria-label="Delete question">🗑</button></div></div>
    <div class="opts" role="radiogroup">${q.options.map((o,i)=>`
      <div class="opt ${q.selected===o.id?'sel':''} ${lastPick===o.id?'pop':''}" role="radio" aria-checked="${q.selected===o.id}" tabindex="0" data-act="pick" data-q="${q.id}" data-o="${o.id}">
        <span class="radio"></span><span class="ltr">${letter(i)}</span><span class="ot">${esc(o.text)}</span>
        <span class="oa"><button class="ib" data-act="eo" data-q="${q.id}" data-o="${o.id}" title="Edit option" aria-label="Edit option">✏️</button><button class="ib" data-act="do" data-q="${q.id}" data-o="${o.id}" title="Delete option" aria-label="Delete option">🗑</button></span>
      </div>`).join('')}</div>
    <div class="qf"><button class="lnk" data-act="ao" data-q="${q.id}">＋ Add option</button>
      ${q.selected?`<button class="lnk" data-act="clr" data-q="${q.id}">Clear answer</button><span class="st">✅ Answered</span>`:`<span class="st">Not answered yet</span>`}
      ${q.options.length<2?`<span class="st">Add at least 2 options</span>`:''}</div>
  </article>`).join('');
  lastPick=null;
}
function render(){renderSets();renderStats();renderNav();renderList()}

// ---------- Actions ----------
const findQ=id=>cur().questions.find(q=>q.id===id);
function scrollToQ(id){
  let el=document.getElementById('q-'+id);
  if(!el){ff='all';qf='';$('#search').value='';$('#seg').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.f==='all'));renderList();el=document.getElementById('q-'+id)}
  if(!el)return;
  el.scrollIntoView({behavior:'smooth',block:'center'});
  el.classList.add('flash');setTimeout(()=>el.classList.remove('flash'),1500);
}
const actions={
  set(el){S.cur=el.dataset.s;save();render()},
  async as(){
    const r=await ask('Add a new question set',[{label:'Set name',req:1,ph:'e.g. SPC – CAT2 – Set 7'},{label:'Set label (optional)',ph:'e.g. SET B'}],'Add set');
    if(!r)return;const s=mkSet(r[0].trim(),r[1].trim(),true);S.sets.push(s);S.cur=s.id;save();render();toast('Set added')
  },
  async ds(el){
    const s=S.sets.find(x=>x.id===el.dataset.s);
    if(!await ask('Delete this set?',[],'Delete',`“${s.name}” and all its ${s.questions.length} questions will be removed.`))return;
    S.sets=S.sets.filter(x=>x.id!==s.id);if(S.cur===s.id)S.cur=S.sets[0].id;save();render();toast('Set deleted')
  },
  async aq(){
    const r=await ask('Add question',[{label:'Question',area:1,rows:3,req:1,ph:'Type the question here'},{label:'Options (one per line, optional – you can add more later)',area:1,rows:5,ph:'Option A\nOption B\nOption C\nOption D'}],'Add question');
    if(!r)return;
    cur().questions.push({id:uid(),text:r[0].trim(),selected:null,options:r[1].split('\n').map(t=>t.trim()).filter(Boolean).map(t=>({id:uid(),text:t}))});
    save();render();toast('Question added');
    const last=cur().questions[cur().questions.length-1];setTimeout(()=>scrollToQ(last.id),50)
  },
  async eq(el){
    const q=findQ(el.dataset.q);const r=await ask('Edit question',[{label:'Question',area:1,rows:4,req:1,value:q.text}]);
    if(!r)return;q.text=r[0].trim();save();render()
  },
  async dq(el){
    if(!await ask('Delete this question?',[],'Delete','The question and its options will be removed.'))return;
    const set=cur();set.questions=set.questions.filter(q=>q.id!==el.dataset.q);save();render();toast('Question deleted')
  },
  pick(el){
    const q=findQ(el.dataset.q);
    if(q.selected===el.dataset.o){q.selected=null}else{q.selected=el.dataset.o;lastPick=el.dataset.o}
    save();render()
  },
  clr(el){findQ(el.dataset.q).selected=null;save();render()},
  async ao(el){
    const q=findQ(el.dataset.q);const r=await ask('Add option',[{label:'Option text',area:1,rows:2,req:1}],'Add option');
    if(!r)return;q.options.push({id:uid(),text:r[0].trim()});save();render()
  },
  async eo(el){
    const q=findQ(el.dataset.q),o=q.options.find(x=>x.id===el.dataset.o);
    const r=await ask('Edit option',[{label:'Option text',area:1,rows:2,req:1,value:o.text}]);
    if(!r)return;o.text=r[0].trim();save();render()
  },
  async do(el){
    if(!await ask('Delete this option?',[],'Delete'))return;
    const q=findQ(el.dataset.q);q.options=q.options.filter(x=>x.id!==el.dataset.o);
    if(q.selected===el.dataset.o)q.selected=null;save();render()
  },
  nav(el){scrollToQ(el.dataset.q)},
  go(){
    const n=parseInt($('#jump').value,10),qs=cur().questions;
    if(!n||n<1||n>qs.length){toast(qs.length?`Enter a number from 1 to ${qs.length}`:'This set has no questions yet');return}
    scrollToQ(qs[n-1].id)
  }
};
document.addEventListener('click',e=>{
  const fb=e.target.closest('#seg button');
  if(fb){ff=fb.dataset.f;$('#seg').querySelectorAll('button').forEach(b=>b.classList.toggle('on',b===fb));renderList();return}
  const el=e.target.closest('[data-act]');if(el&&actions[el.dataset.act])actions[el.dataset.act](el)
});
document.addEventListener('keydown',e=>{
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('.opt,.set')){e.preventDefault();e.target.click()}
  if(e.key==='Enter'&&e.target.id==='jump')actions.go()
});
$('#search').addEventListener('input',e=>{qf=e.target.value.trim();renderList()});
render();