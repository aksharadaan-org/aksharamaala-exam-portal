// Design fixture; staff operations are simulated in tab memory.
const content=document.querySelector('#staff-content');
const school=document.querySelector('#scope'), role=document.querySelector('#role');
const people=[{name:'Learner A',school:'cloud',grade:7,done:true},{name:'Learner B',school:'lake',grade:8,done:false}];
let tab='reports',version=1,draft=null,windowDates=['2026-01-01','2026-12-31'],message='';
const html=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let published={en:'How can you help a teammate?',te:'సహచరుడికి ఎలా సహాయపడగలరు?',key:'0'};
const btn=(id,label)=>'<button data-act="'+id+'">'+label+'</button>';
const dateOkay=value=>/^\d{4}-\d{2}-\d{2}$/.test(value);
function show(){
 const admin=role.value==='admin';
 if(!admin) school.value='cloud';
 school.disabled=!admin;
 const visible=people.filter(p=>school.value==='all'||p.school===school.value);
 const done=visible.filter(p=>p.done).length;
 let pane='';
 if(tab==='reports') pane='<h2>Baseline completion</h2><div class="tiles"><div class="metric">Eligible learners<div class="stat">'+visible.length+'</div></div><div class="metric">Submitted<div class="stat">'+done+'</div></div><div class="metric">Completion<div class="stat">'+(visible.length?Math.round(done*100/visible.length)+'%':'—')+'</div></div></div><p>Snapshot for the baseline stage, across its full date range.</p>'+btn('export','Export aggregate CSV');
 if(tab==='roster') pane='<h2>School roster</h2><table><tr><th>Student</th><th>School</th><th>Grade</th></tr>'+visible.map(p=>'<tr><td>'+html(p.name)+'</td><td>'+p.school+'</td><td>'+p.grade+'</td></tr>').join('')+'</table>';
 if(tab==='roster'&&admin) pane+='<h3>Add a synthetic learner</h3><label>Name <input id="learner" maxlength="50"></label> <label>Grade <input id="grade" min="1" max="12" type="number" value="7"></label> <label>School <select id="new-school"><option>cloud</option><option>lake</option></select></label><p>'+btn('register','Add to roster')+'</p>';
 if(tab==='bank') pane='<h2>Question bank</h2><p>Kindness · Published version '+version+'</p>'+(admin?'<label>English prompt <input id="en" value="'+html(draft?.en||published.en)+'"></label><p><label>Telugu prompt <input id="te" value="'+html(draft?.te||published.te)+'"></label></p><label>Answer key <select id="key"><option value="0">Listen first</option><option value="1" '+((draft||published).key==='1'?'selected':'')+'>Ignore the request</option></select></label><div class="actions">'+btn('draft','Save draft')+(draft?btn('publish','Publish saved draft'):'')+'</div>':'<p>Question editing requires programme administrator access.</p>');
 if(tab==='schedule') pane='<h2>Baseline window</h2><p>UTC · Opening inclusive, closing exclusive</p><label>Opens <input type="date" id="opens" value="'+windowDates[0]+'" '+(!admin?'disabled':'')+'></label> <label>Closes <input type="date" id="closes" value="'+windowDates[1]+'" '+(!admin?'disabled':'')+'></label>'+(admin?'<p>'+btn('window','Save window')+'</p>':'');
 content.innerHTML=pane+'<p role="status">'+html(message)+'</p>';
 document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));
}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;message='';show();});
role.onchange=school.onchange=()=>{message='';show();};
content.onclick=event=>{
 const key=event.target.dataset.act;
 if(key==='export'){
   const records=people.filter(p=>school.value==='all'||p.school===school.value);
   const file=new Blob(['scope,stage,eligible,completed\n'+[school.value,0,records.length,records.filter(p=>p.done).length].join(',')+'\n'],{type:'text/csv;charset=utf-8'});
   const a=document.createElement('a');a.href=URL.createObjectURL(file);a.download='demo-completion.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);return;
 }
 if(role.value!=='admin')return;
 if(key==='register'){
   const name=document.querySelector('#learner').value.trim(), grade=Number(document.querySelector('#grade').value);
   if(!name||!Number.isInteger(grade)||grade<1||grade>12){content.querySelector('[role=status]').textContent='Enter a name and valid grade.';return;}
   people.push({name,grade,school:document.querySelector('#new-school').value,done:false});message='Synthetic learner added.';
 }else if(key==='draft'){
   const en=document.querySelector('#en').value.trim(),te=document.querySelector('#te').value.trim();
   if(!en||!te){message='Both translations are required.';content.querySelector('[role=status]').textContent=message;return;}
   draft={en,te,key:document.querySelector('#key').value};message='Draft saved. Existing attempts keep their published item version.';
 }else if(key==='publish'&&draft){version++;published={...draft};draft=null;message='Published version '+version+'.';}
 else if(key==='window'){const from=document.querySelector('#opens').value,to=document.querySelector('#closes').value;if(!dateOkay(from)||!dateOkay(to)||from>=to){content.querySelector('[role=status]').textContent='Closing date must follow opening date.';return;}windowDates=[from,to];message='Window saved for this walkthrough.';}
 else return;
 show();
};
show();
