// Small local-network server for the Қозғалыс classroom monitor.
// Uses only Node's built-in modules. For a real school deployment, add HTTPS and authentication.
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'class-data.json');
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
let db = { classes: {} };
try { db = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch {}
function save(){ fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8'); }
function send(res, status, value){ res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'}); res.end(JSON.stringify(value)); }
function readBody(req){ return new Promise((resolve,reject)=>{let s='';req.on('data',c=>{s+=c;if(s.length>20000)reject(new Error('Өтініш тым үлкен'));});req.on('end',()=>{try{resolve(JSON.parse(s||'{}'));}catch{reject(new Error('JSON қате'));}});req.on('error',reject);}); }
function cleanText(v,max=60){return String(v||'').trim().replace(/[<>]/g,'').slice(0,max);}
function getClass(code){ code=cleanText(code,20).toUpperCase(); if(!/^[A-ZА-ЯӘІҢҒҮҰҚӨҺ0-9-]{2,20}$/u.test(code))return null; return db.classes[code] ||= {students:{}}; }
const handler=async(req,res)=>{
  const url=new URL(req.url,'http://localhost');
  if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end();}
  try{
    if(req.method==='POST' && url.pathname==='/api/register'){
      const body=await readBody(req), name=cleanText(body.name), code=cleanText(body.classCode,20).toUpperCase();
      if(name.length<2||!code)return send(res,400,{error:'Атыңызды және сынып кодын енгізіңіз.'});
      const cls=getClass(code); if(!cls)return send(res,400,{error:'Сынып коды 2–20 таңбадан тұруы керек.'});
      const id=crypto.randomUUID(); cls.students[id]={id,name,createdAt:new Date().toISOString(),heartRate:null,lastSeen:null,deviceName:null}; save();
      return send(res,201,{id,name,classCode:code});
    }
    if(req.method==='POST' && url.pathname==='/api/heart-rate'){
      const body=await readBody(req), code=cleanText(body.classCode,20).toUpperCase(), cls=db.classes[code], student=cls?.students?.[cleanText(body.studentId,50)];
      const bpm=Number(body.bpm); if(!student)return send(res,404,{error:'Оқушы тіркелімі табылмады. Қайта тіркеліңіз.'});
      if(!Number.isFinite(bpm)||bpm<25||bpm>240)return send(res,400,{error:'Жүрек соғысы мәні жарамсыз.'});
      student.heartRate=Math.round(bpm); student.lastSeen=new Date().toISOString(); student.deviceName=cleanText(body.deviceName,80)||'Bluetooth құрылғысы'; save();
      return send(res,200,{ok:true});
    }
    if(req.method==='GET' && url.pathname==='/api/class'){
      const code=cleanText(url.searchParams.get('code'),20).toUpperCase(), cls=db.classes[code];
      if(!cls)return send(res,200,{classCode:code,students:[]});
      return send(res,200,{classCode:code,students:Object.values(cls.students).sort((a,b)=>a.name.localeCompare(b.name,'kk'))});
    }
    if(req.method==='POST' && url.pathname==='/api/clear'){
      const body=await readBody(req),code=cleanText(body.classCode,20).toUpperCase(); if(!db.classes[code])return send(res,404,{error:'Сынып табылмады.'}); delete db.classes[code];save();return send(res,200,{ok:true});
    }
    if(req.method==='GET'){
      let file=decodeURIComponent(url.pathname==='/ ' ? '/' : url.pathname); if(file==='/')file='/index.html';
      const full=path.resolve(ROOT,'.'+file); if(!full.startsWith(ROOT+path.sep))return send(res,403,{error:'Рұқсат жоқ'});
      fs.readFile(full,(err,data)=>{if(err){res.writeHead(404);return res.end('Файл табылмады');}res.writeHead(200,{'Content-Type':MIME[path.extname(full)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});return;
    }
    send(res,404,{error:'Табылмады'});
  }catch(e){send(res,400,{error:e.message||'Сұрауды өңдеу мүмкін болмады.'});}
};
let server;
if(process.env.TLS_CERT && process.env.TLS_KEY){
 server=https.createServer({cert:fs.readFileSync(process.env.TLS_CERT),key:fs.readFileSync(process.env.TLS_KEY)},handler);
}else server=http.createServer(handler);
server.listen(PORT,'0.0.0.0',()=>{
 const scheme=process.env.TLS_CERT&&process.env.TLS_KEY?'https':'http';
 console.log(`Қозғалыс сервері: ${scheme}://localhost:${PORT}`);
 const ips=Object.values(os.networkInterfaces()).flat().filter(x=>x&&x.family==='IPv4'&&!x.internal).map(x=>x.address);
 for(const ip of ips)console.log(`Телефондардан (бір Wi-Fi): ${scheme}://${ip}:${PORT}`);
 console.log('Оқушыларға да, мұғалімге де бірдей желілік мекенжайды ашыңыз. Ctrl+C — тоқтату.');
});
