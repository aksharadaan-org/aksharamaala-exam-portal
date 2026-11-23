// Browser design sandbox. All profile inputs and attempts stay on this browser.
const phone = document.querySelector('#phone');
const wiring = document.querySelector('#trace');
const storeKey = 'assessment-blueprint-draft-v3';
let model;
try { model = JSON.parse(localStorage.getItem(storeKey)) || {}; } catch { model = {}; }
let view = 'entry', stage = 0, index = 0, choice = null, notice = '', pendingStage = 0;
const save = () => localStorage.setItem(storeKey, JSON.stringify(model));
const escapeHtml = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const qualityIds = Array.from({length:24},(_,i)=>'d'+(Math.floor(i/6)+1)+'q'+(i%6+1));
const stageName = s => s === 0 ? 'Baseline' : 'Practice '+s;
const button = (action,label,extra='') => '<button data-action="'+action+'" '+extra+'>'+label+'</button>';
const stateTrace = {
  entry:['Open the separate app','The future Exam icon or reminder should open this app. If a reminder names a stage, remember that stage while the student signs in.'],
  login:['Ask for a practice code','Send the demo account to POST /v1/challenges. The API returns a challenge ID for the next step.'],
  verify:['Check the practice code','Send the challenge ID and six-digit code to POST /v1/sessions. Save the returned token securely in the real mobile app.'],
  profile:['Save student details','Load schools with GET /v1/schools. Save the name, grade, school, and language with PATCH /v1/me. The school tells us the district.'],
  qualities:['Save chosen qualities','Read the list with GET /v1/qualities. Send chosen IDs with PUT /v1/selections. Adding a quality later does not change questions in an attempt already started.'],
  home:['Show available stages','GET /v1/stages says which stage is ready, locked, open, closed, in progress, or complete. Show Start, Resume, or Result to match.'],
  question:['Save one answer','POST /v1/attempts starts or resumes the stage. PUT /v1/attempts/{id}/answers saves one choice. Move on only after the API confirms it saved.'],
  review:['Check saved answers','GET /v1/attempts/{id} returns the questions and saved choices. Let the student edit before final submission.'],
  result:['Submit and show a score','POST /v1/attempts/{id}/submit makes the API calculate and save the score. A repeat request returns the same saved result.'],
  history:['Show earlier results','GET /v1/progress returns stages and scores. Show a blank for a quality that was not part of an earlier attempt.']
};
function render() {
  let html='';
  const a = model.attempts?.[stage];
  if(view==='entry') html='<h2>Open an exam</h2><p>Try either entry into the assessment app.</p>'+button('icon','Exam tile')+button('notification','Practice 1 reminder','class="secondary"');
  if(view==='login') html='<h2>Student sign-in</h2><p>Use the fictional learner account.</p><label>Account<input value="demo-a" readonly></label>'+button('send','Send practice code');
  if(view==='verify') html='<h2>Verify code</h2><label>Demo code · 246810<input id="otp" inputmode="numeric" maxlength="6"></label>'+button('verify','Verify');
  if(view==='profile') html='<h2>Your profile</h2><label>Name<input id="name" maxlength="50" value="'+escapeHtml(model.name||'Learner A')+'"></label><label>Grade<input id="grade" type="number" min="1" max="12" value="'+(model.grade||7)+'"></label><label>School<select id="school"><option>cloud</option><option '+(model.school==='lake'?'selected':'')+'>lake</option></select></label><label>Language<select id="lang"><option>English</option><option '+(model.lang==='తెలుగు'?'selected':'')+'>తెలుగు</option></select></label>'+button('profile','Save and continue');
  if(view==='qualities') html='<h2>Choose qualities</h2><p>Select at least one. Saved selections stay in your plan.</p>'+[1,2,3,4].map(d=>'<details '+(d===1?'open':'')+'><summary>Dimension '+d+'</summary>'+qualityIds.filter(k=>k.startsWith('d'+d)).map(id=>'<label><span><input type="checkbox" value="'+id+'" '+(model.qualities?.includes(id)?'checked disabled':'')+'> Demo quality '+id+'</span></label>').join('')+'</details>').join('')+button('qualities','Save qualities');
  if(view==='home') html='<h2>My assessments</h2>'+Array.from({length:5},(_,s)=>{const item=model.attempts?.[s];const locked=s>0&&!model.attempts?.[s-1]?.done; return button('stage:'+s,stageName(s)+' · '+(item?.done?'Result':locked?'Locked':item?'Resume':'Start'),'class="opt" '+(locked?'disabled':''));}).join('')+button('history','Progress')+button('more','Add qualities','class="secondary"')+button('logout','Sign out','class="secondary"');
  if(view==='question'){
    const te=model.lang==='తెలుగు';
    html='<small>'+stageName(stage)+' · '+(index+1)+' / '+a.ids.length+'</small><div class="progressbar"><i style="width:'+Math.round(100*(index+1)/a.ids.length)+'%"></i></div><h2>'+(te?'ఒక సహచరుడు సహాయం అడిగారు. మీరు ఏమి చేయగలరు?':'A teammate asks for help. What could you do?')+'</h2>'+[te?'ముందు వినండి':'Listen first',te?'పట్టించుకోకండి':'Ignore the request'].map((v,i)=>button('choice:'+i,v,'class="opt" aria-pressed="'+(choice===i)+'"')).join('')+button('next','Save and continue',choice==null?'disabled':'')+button('leave','Exit to stages','class="secondary"');
  }
  if(view==='review') html='<h2>Review answers</h2>'+a.ids.map((q,i)=>button('edit:'+i,q+' · Option '+(a.answers[i]+1),'class="opt"')).join('')+button('submit','Confirm and submit');
  if(view==='result') {const earned=a.answers.filter(v=>v===0).length;html='<small>'+stageName(stage)+' · Submitted</small><h2>Your result</h2><div class="score">'+earned+' / '+a.ids.length+'</div><p>'+(earned===a.ids.length?'All items correct.':'Keep practising.')+'</p>'+button('history','View progress')+button('leave','Stages','class="secondary"');}
  if(view==='history') html='<h2>My progress</h2>'+Object.entries(model.attempts||{}).filter(([,v])=>v.done).map(([s,v])=>'<div class="mockrow"><b>'+stageName(+s)+'</b><br>'+v.ids.map((id,i)=>id+' · '+(v.answers[i]===0?1:0)+'/1').join('<br>')+'</div>').join('')+(!Object.values(model.attempts||{}).some(v=>v.done)?'<p>No completed stages yet.</p>':'')+button('leave','Back to stages');
  phone.innerHTML='<header>Assessment &nbsp; / &nbsp; Student preview</header>'+html+'<p role="status" class="form-error">'+escapeHtml(notice)+'</p>';
  wiring.innerHTML='<h3>'+stateTrace[view][0]+'</h3><p>'+stateTrace[view][1]+'</p>';
}
function question(i){index=i; choice=model.attempts[stage].answers[i]??null;view='question';}
function openStage(s){stage=s;const attempts=model.attempts||={};if(s&&!attempts[s-1]?.done){view='home';notice='Complete the preceding stage first.';return;}const a=attempts[s]||={ids:[...model.qualities],answers:[],done:false};if(a.done)view='result';else if(a.answers.length===a.ids.length)view='review';else question(a.answers.length);}
function enter(){if(!model.session)view='login';else if(!model.name)view='profile';else if(!model.qualities?.length)view='qualities';else openStage(pendingStage);}
phone.addEventListener('click',event=>{
  const action=event.target.closest('button')?.dataset.action;if(!action)return;
  const [key,arg]=action.split(':');notice='';
  switch(key){
    case 'icon':case 'notification':pendingStage=key==='icon'?0:1;enter();break;
    case 'send':view='verify';break;
    case 'verify':if(document.querySelector('#otp').value!=='246810'){notice='Enter the six-digit demo code.';break;}model.session=true;enter();break;
    case 'profile':{const name=document.querySelector('#name').value.trim(),grade=Number(document.querySelector('#grade').value);if(!name||!Number.isInteger(grade)||grade<1||grade>12){notice='Enter a name and a grade from 1 to 12.';break;}Object.assign(model,{name,grade,school:document.querySelector('#school').value,lang:document.querySelector('#lang').value});enter();break;}
    case 'qualities':{const ids=[...phone.querySelectorAll('input:checked')].map(n=>n.value);if(!ids.length){notice='Select one or more qualities.';break;}model.qualities=ids; if(pendingStage===null)view='home';else openStage(pendingStage);break;}
    case 'more':pendingStage=null;view='qualities';break;
    case 'stage':openStage(+arg);break;
    case 'choice':choice=+arg;break;
    case 'next':{if(document.querySelector('#fault').checked){notice='Save failed. Your choice is still selected. Disable the simulated failure and retry.';break;}const a=model.attempts[stage];a.answers[index]=choice;if(index+1===a.ids.length)view='review';else question(index+1);break;}
    case 'edit':question(+arg);break;
    case 'submit':model.attempts[stage].done=true;view='result';break;
    case 'leave':view='home';break;
    case 'history':view='history';break;
    case 'logout':model.session=false;view='entry';break;
  }
  save();render();
});
document.querySelector('#restart').onclick=()=>{model={};save();view='entry';notice='';render();};
render();
