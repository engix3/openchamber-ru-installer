const fs=require('fs'), crypto=require('crypto');
const ROOT=process.env.OCRU_ROOT||'/opt/openchamber-ru';
const ASSETS=process.env.OC_ASSETS||'/usr/lib/node_modules/@openchamber/web/dist/assets';
function extract(path,name,strip){
  const s=fs.readFileSync(path,'utf8');
  const m=s.match(new RegExp(name+'\\s*=\\s*\\{'));
  if(!m) throw 'no '+name;
  const start=s.indexOf('{',m.index); let d=0,end=-1;
  for(let i=start;i<s.length;i++){const c=s[i]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){end=i;break;}}}
  let body=s.slice(start,end+1);
  if(strip) body=body.replace(/\.\.\.settingsDict\s*,?/g,'');
  return eval('('+body+')');
}
const settings=extract(ROOT+'/i18n/messages/ru.settings.ts','settingsDict',false);
const dict=extract(ROOT+'/i18n/messages/ru.ts','dict',true);
const merged=Object.assign({},settings,dict);
if(fs.existsSync(ROOT+'/extra.json')) Object.assign(merged, JSON.parse(fs.readFileSync(ROOT+'/extra.json','utf8')));
if(!merged['common.language.russian']) merged['common.language.russian']='Русский';
const chunk='const dict='+JSON.stringify(merged)+';export{dict as dict};';
const hash=crypto.createHash('sha256').update(chunk).digest('hex').slice(0,8);
const chunkName='ru-'+hash+'.js';
fs.writeFileSync(ASSETS+'/'+chunkName,chunk);
console.log('KEYS='+Object.keys(merged).length+' CHUNK='+chunkName);
let loaderFile=null;
for(const f of fs.readdirSync(ASSETS)){ if(!/\.js$/.test(f)) continue; const s=fs.readFileSync(ASSETS+'/'+f,'utf8'); if(/\["en"(?:,"[A-Za-z-]+")+\]/.test(s)&&s.includes('common.language.turkish')){loaderFile=f;break;} }
if(!loaderFile) throw 'loader not found';
let L=fs.readFileSync(ASSETS+'/'+loaderFile,'utf8');
if(!fs.existsSync(ASSETS+'/'+loaderFile+'.ru-bak')) fs.writeFileSync(ASSETS+'/'+loaderFile+'.ru-bak',L);
const o={};
L=L.replace(/(\["en"(?:,"[A-Za-z-]+")+\])/,m=>m.includes('"ru"')?m:(m.slice(0,-1)+',"ru"]'));
o.locales=/,?"ru"\]/.test(L);
L=L.replace(/tr:"common\.language\.turkish"/, m=> L.includes('ru:"common.language.russian"')?m:(m+',ru:"common.language.russian"'));
o.labels=L.includes('ru:"common.language.russian"');
L=L.replace(/([A-Za-z_$][\w$]*)==="tr"\|\|\1\.startsWith\("tr-"\)\?"tr":/, (m,id)=> L.includes('startsWith("ru-")')?m:(m+id+'==="ru"||'+id+'.startsWith("ru-")?"ru":'));
o.normalize=L.includes('startsWith("ru-")');
if(!L.includes('==="ru"?await')) L=L.replace(/(([A-Za-z_$][\w$]*)==="tr"\?await\s+(\w+)\(\(\)=>import\("\.\/tr-[A-Za-z0-9_.-]+\.js"\),(__vite__mapDeps\(\[[0-9,]+\]\))\))/,(m,seg,v,fn,deps)=> seg+':'+v+'==="ru"?await '+fn+'(()=>import("./'+chunkName+'"),'+deps+')');
L=L.replace(/(==="ru"\?await \w+\(\(\)=>import\("\.\/)[^"]+("\),)/,(m,a,b)=> a+chunkName+b);
o.import=L.includes('==="ru"?await')&&L.includes(chunkName);
L=L.replace(/function ([A-Za-z_$][\w$]*)\(\)\{([A-Za-z_$][\w$]*)\.getState\(\)\.setLocale\(([A-Za-z_$][\w$]*)\(\)\)\}/,(m,fn,store,res)=> L.includes('setLocale("ru")')?m:('function '+fn+'(){try{typeof window!="undefined"&&window.localStorage.setItem("openchamber.i18n.v1",JSON.stringify({locale:"ru"}))}catch(e){}'+store+'.getState().setLocale("ru")}'));
o.init=L.includes('setLocale("ru")');
fs.writeFileSync(ASSETS+'/'+loaderFile,L);
console.log('LOADER='+loaderFile+' PATCH='+JSON.stringify(o));
