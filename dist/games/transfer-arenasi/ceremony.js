// Turnuva sonu töreni: gol kralı → asist kralı → 3. → 2. → şampiyon (havai fişekler).
import {escapeHTML as esc} from './cards.js';

const STEP_MS=3600;
function leaders(board,key){
 const best=Math.max(0,...board.map(x=>x[key]));
 return best?board.filter(x=>x[key]===best):[];
}
export function ceremonySteps(room,teamLabel){
 const board=room.leaderboard||[],steps=[];
 const award=(key,eyebrow,icon,unit)=>{
  const rows=leaders(board,key);
  if(!rows.length){steps.push({eyebrow,icon,title:'—',sub:'Bu turnuvada '+unit+' yok'});return;}
  steps.push({eyebrow,icon,title:rows.map(x=>esc(x.name)).join(' · '),sub:rows.map(x=>teamLabel(x.team)).join(' · ')+` · <strong>${rows[0][key]} ${unit}</strong>`});
 };
 award('goals','GOL KRALI','⚽','gol');
 award('assists','ASİST KRALI','🎯','asist');
 const second=(room.finalists||[]).find(id=>id!==room.champion);
 const third=(room.table||[]).find(id=>!(room.finalists||[]).includes(id));
 if(third)steps.push({eyebrow:'ÜÇÜNCÜ',icon:'🥉',title:teamLabel(third),sub:'Ligi finalistlerin ardından bitirdi',place:3});
 if(second)steps.push({eyebrow:'İKİNCİ',icon:'🥈',title:teamLabel(second),sub:'Finalde kupaya çok yaklaştı',place:2});
 steps.push({eyebrow:'ŞAMPİYON',icon:'🏆',title:teamLabel(room.champion),sub:'Kupanın sahibi',place:1,champion:true});
 return steps;
}
function fireworks(canvas){
 const ctx=canvas.getContext('2d');if(!ctx)return ()=>{};
 const colors=['#d0fa76','#f4d57c','#ff7a5c','#6fc3ff','#ffffff','#c49bff'];
 let particles=[],frame=0,raf=0,running=true;
 function resize(){canvas.width=canvas.clientWidth*devicePixelRatio;canvas.height=canvas.clientHeight*devicePixelRatio;}
 resize();addEventListener('resize',resize);
 function burst(){
  const x=canvas.width*(.15+Math.random()*.7),y=canvas.height*(.12+Math.random()*.38),color=colors[Math.floor(Math.random()*colors.length)];
  for(let i=0;i<70;i++){const a=Math.PI*2*i/70,s=(1.5+Math.random()*3.5)*devicePixelRatio;particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:1,color});}
 }
 function loop(){
  if(!running)return;
  if(frame++%38===0)burst();
  ctx.globalCompositeOperation='destination-out';ctx.fillStyle='rgba(0,0,0,.22)';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.globalCompositeOperation='lighter';
  particles=particles.filter(p=>p.life>0);
  for(const p of particles){p.x+=p.vx;p.y+=p.vy;p.vy+=.045*devicePixelRatio;p.vx*=.985;p.life-=.012;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,2.2*devicePixelRatio,0,Math.PI*2);ctx.fill();}
  ctx.globalAlpha=1;raf=requestAnimationFrame(loop);
 }
 loop();
 return ()=>{running=false;cancelAnimationFrame(raf);removeEventListener('resize',resize);};
}
export function playCeremony(room,teamLabel,onClose=()=>{}){
 document.querySelector('.ceremony')?.remove();
 const steps=ceremonySteps(room,teamLabel),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const overlay=document.createElement('div');overlay.className='ceremony';overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Turnuva töreni');
 overlay.innerHTML='<canvas class="fireworks" aria-hidden="true"></canvas><div class="ceremony-stage" aria-live="polite"></div><div class="ceremony-progress" aria-hidden="true">'+steps.map(()=>'<i></i>').join('')+'</div><div class="ceremony-actions"><button class="secondary" data-next>İleri</button><button data-close>Kapat</button></div>';
 document.body.append(overlay);
 let index=-1,timer=0,stopFireworks=()=>{};
 const stage=overlay.querySelector('.ceremony-stage');
 function show(i){
  index=i;clearTimeout(timer);const s=steps[i];
  stage.innerHTML=`<div class="ceremony-step ${s.champion?'champion':''} ${s.place?'place-'+s.place:''}"><span class="ceremony-icon">${s.icon}</span><p class="eyebrow">${s.eyebrow}</p><h2>${s.title}</h2><p>${s.sub}</p></div>`;
  overlay.querySelectorAll('.ceremony-progress i').forEach((dot,n)=>dot.classList.toggle('on',n<=i));
  const last=i===steps.length-1;overlay.querySelector('[data-next]').hidden=last;
  if(last&&!reduced)stopFireworks=fireworks(overlay.querySelector('.fireworks'));
  if(!last)timer=setTimeout(()=>show(i+1),STEP_MS);
 }
 function close(){clearTimeout(timer);stopFireworks();overlay.remove();removeEventListener('keydown',key);onClose();}
 function key(e){if(e.key==='Escape')close();}
 overlay.querySelector('[data-next]').onclick=()=>show(Math.min(steps.length-1,index+1));
 overlay.querySelector('[data-close]').onclick=close;addEventListener('keydown',key);
 show(0);overlay.querySelector('[data-close]').focus();
}
