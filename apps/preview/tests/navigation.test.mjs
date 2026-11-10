import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const js=html.split('<script>')[1].split('</script>')[0];
function preview(){
 const nodes={view:{innerHTML:''},userBtn:{textContent:''},toast:{textContent:'',style:{}},search:{value:'',addEventListener(){}}};
 const location={protocol:'https:',pathname:'/',hash:''};
 const ctx=vm.createContext({
  location,document:{querySelector:(selector)=>nodes[selector.slice(1)]||null,querySelectorAll:()=>[],addEventListener(){}},
  history:{pushState(_state,_title,path){location.pathname=path}},
  window:{addEventListener(){},scrollTo(){}},
  navigator:{},setTimeout,clearTimeout,console,URL,Math,Date,
 });
 vm.runInContext(js,ctx,{timeout:2000});
 return {ctx,nodes,location,run(code){return vm.runInContext(code,ctx,{timeout:2000})}};
}
test('guest home lists public content only',()=>{
 const p=preview();assert.match(p.nodes.view.innerHTML,/營養概論/);assert.doesNotMatch(p.nodes.view.innerHTML,/領導力進階培訓/);
});
test('detail uses a root URL without videos prefix',()=>{
 const p=preview();p.run("go('/nutrition101')");assert.equal(p.location.pathname,'/nutrition101');assert.match(p.nodes.view.innerHTML,/營養概論/);
});
test('unauthorized deep link denies access',()=>{
 const p=preview();p.run("go('/leadership')");assert.match(p.nodes.view.innerHTML,/需要符合資格才能瀏覽此內容/);
});
test('rank never implies admin permissions',()=>{
 const p=preview();p.run("identity='verified';go('/leadership')");assert.match(p.nodes.view.innerHTML,/領導力進階培訓/);
 p.run("go('/admin')");assert.match(p.nodes.view.innerHTML,/沒有管理員權限/);
});
test('member sees member-only but not rank content',()=>{
 const p=preview();p.run("identity='member';go('/')");assert.match(p.nodes.view.innerHTML,/高效率學習與行動養成/);
 assert.doesNotMatch(p.nodes.view.innerHTML,/領導力進階培訓/);
});
test('small developer footnotes are removed',()=>{
 assert.doesNotMatch(html,/僅顯示你目前符合觀看資格的內容/);
 assert.doesNotMatch(html,/此為本機開發模擬預覽/);
 assert.doesNotMatch(html,/網址格式：\/影片ID/);
 assert.doesNotMatch(html,/不會實際傳送影片到 Mux/);
});
test('YouTube drafts can publish to shareable root link',()=>{
 const p=preview();p.run('admin=()=>{}; drafts.push({id:"newcourse9",title:"新課程",description:"",category:"一般",source:"YouTube",access:"public",color:1,youtubeUrl:"https://youtu.be/dQw4w9WgXcQ",youtubeVisibility:"public"})');
 p.run('publishDraft("newcourse9")');
 assert.equal(p.run('drafts.length'),0);assert.equal(p.run('videos.some(x=>x.id==="newcourse9")'),true);
 p.run('go("/newcourse9")');assert.match(p.nodes.view.innerHTML,/新課程/);
 assert.equal(p.location.pathname,'/newcourse9');
});
test('Mux draft cannot publish without secure upload',()=>{
 const p=preview();p.run('admin=()=>{}; drafts.push({id:"newmux999",title:"新課程",description:"",category:"一般",source:"Mux",access:"rank",color:1})');
 p.run('publishDraft("newmux999")');assert.equal(p.run('drafts.length'),1);assert.equal(p.run('videos.some(x=>x.id==="newmux999")'),false);
});
test('restricted unlisted YouTube requires risk confirmation',()=>{
 const p=preview();p.run('admin=()=>{}; drafts.push({id:"newcourse9",title:"新課程",description:"",category:"一般",source:"YouTube",access:"members",color:1,youtubeUrl:"https://youtu.be/dQw4w9WgXcQ",youtubeVisibility:"unlisted",acceptRisk:false})');
 p.run('publishDraft("newcourse9")');assert.equal(p.run('drafts.length'),1);
 p.run('drafts[0].acceptRisk=true;publishDraft("newcourse9")');assert.equal(p.run('drafts.length'),0);
});
