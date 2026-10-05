// Alur pengiriman; disimpan bersama data usaha dan ikut cadangan JSON.
let orderTab='scheduled';
const orderLabels={scheduled:'Schedule Pengiriman',transit:'Dalam Perjalanan',arrived:'Sampai'};
function lateDays(order,now=today()){
 if(order.status==='cancelled')return 0;
 const end=order.status==='arrived'?order.arrival_date:now;
 return Math.max(0,Math.round((Date.parse(end)-Date.parse(order.estimated_arrival))/86400000));
}
function orderBadge(o){const late=lateDays(o);return late?`<span class="badge late">${o.status==='arrived'?'Tiba terlambat':'Terlambat'} ${late} hari</span>`:`<span class="badge ${o.status==='arrived'?'paid':''}">${o.status==='arrived'?'Tiba tepat waktu':o.status==='cancelled'?'Dibatalkan':'Sesuai jadwal'}</span>`}
function orderActions(o){return o.status==='scheduled'?`<button data-action="order-edit" data-id="${o.id}">Edit</button><button class="danger" data-action="order-cancel" data-id="${o.id}">Batal</button><button class="primary" data-action="order-start" data-id="${o.id}">Jalan →</button>`:o.status==='transit'?`<button class="primary" data-action="order-arrive" data-id="${o.id}">✓ Sudah sampai</button>`:''}
function orderCard(o){return `<article class="order-row"><div class="order-destination" title="${esc(o.destination_address||'Alamat belum diisi')}"><span>${esc(o.destination_address||'Alamat belum diisi')}</span><small>${esc(o.recipient_name||'Nama penerima belum diisi')}</small></div><div class="order-row-date"><small>Tanggal pengiriman</small>${date(o.shipping_date)}</div>${orderBadge(o)}<div class="order-row-actions"><button data-action="order-detail" data-id="${o.id}">Detail</button>${orderActions(o)}</div></article>`}
function orderDetail(id){const o=db.orders.find(x=>x.id===id);if(!o)return;$('#modal-title').textContent='Detail pengiriman';$('#error').textContent='';$('#form button[type="submit"]').style.display='none';$('#form').onsubmit=e=>e.preventDefault();
 const items=[['Alamat tujuan',o.destination_address],['Nama penerima',o.recipient_name],['Nomor penerima',o.recipient_phone],['Kode surat jalan',o.delivery_code],['Tanggal pengiriman',date(o.shipping_date)],['Estimasi tiba',date(o.estimated_arrival)],['Nama supir',o.driver_name],['Nomor supir',o.driver_phone],['Nomor kendaraan',o.vehicle_number]];
 if(o.departure_date)items.push(['Mulai jalan',date(o.departure_date)]);if(o.arrival_date)items.push(['Tanggal sampai',date(o.arrival_date)]);
 $('#fields').innerHTML=`<p>${orderLabels[o.status]||'Dibatalkan'} · ${orderBadge(o)}</p><dl class="shipment-detail">${items.map(([label,value])=>`<div><dt>${label}</dt><dd>${esc(value||'Belum diisi')}</dd></div>`).join('')}</dl>${o.comment?`<p class="order-comment">${esc(o.comment)}</p>`:''}`;$('#modal').showModal();
}
function renderOrders(){
 const list=db.orders.filter(o=>o.status===orderTab).sort((a,b)=>a.estimated_arrival.localeCompare(b.estimated_arrival));
 const cancelled=db.orders.filter(o=>o.status==='cancelled');
 $('#view').innerHTML=`<div class="order-tabs" role="tablist" aria-label="Kategori pengiriman">${Object.entries(orderLabels).map(([key,label],i)=>`<button role="tab" aria-selected="${key===orderTab}" class="${key===orderTab?'active':''}" data-action="order-tab" data-id="${key}"><span>${label}</span></button>`).join('')}</div><section class="panel"><div class="panel-head"><div><h2>${orderLabels[orderTab]}</h2></div></div><div class="order-list">${list.length?list.map(orderCard).join(''):blank('Belum ada pengiriman','',orderTab==='scheduled'?'order-new':null,'Tambah pengiriman')}</div></section>${orderTab==='scheduled'&&cancelled.length?`<details class="cancelled-orders"><summary>Riwayat dibatalkan (${cancelled.length})</summary>${cancelled.map(orderCard).join('')}</details>`:''}`;
}
function validOrderDate(value){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value}
async function storeOrder(values,id){
 const v={...values};
 for(const k of ['driver_name','driver_phone','vehicle_number']){v[k]=String(v[k]||'').trim();if(!v[k])throw Error('Nama supir, nomor supir, dan nomor kendaraan wajib diisi.');if(v[k].length>100)throw Error('Data supir atau kendaraan terlalu panjang.');}
 for(const [k,label,max] of [['destination_address','Alamat tujuan',500],['recipient_name','Nama penerima',100],['recipient_phone','Nomor penerima',100],['delivery_code','Kode surat jalan',100]]){v[k]=String(v[k]||'').trim();if(!v[k])throw Error(label+' wajib diisi.');if(v[k].length>max)throw Error(label+' terlalu panjang.');}
 v.comment=String(v.comment||'').trim();if(v.comment.length>1000)throw Error('Komentar maksimal 1.000 karakter.');
 if(!validOrderDate(v.shipping_date)||!validOrderDate(v.estimated_arrival))throw Error('Isi tanggal pengiriman dan estimasi tiba yang valid.');
 if(v.estimated_arrival<v.shipping_date)throw Error('Estimasi tiba tidak boleh sebelum tanggal pengiriman.');
 const next=structuredClone(db);
 if(id){const o=next.orders.find(x=>x.id===id);if(!o||o.status!=='scheduled')throw Error('Hanya jadwal yang belum jalan dapat diedit.');Object.assign(o,v)}else next.orders.push({...v,id:crypto.randomUUID(),status:'scheduled',created_at:new Date().toISOString()});
 await save(next);
}
async function transitionOrder(id,target,arrival=today()){
 const next=structuredClone(db),o=next.orders.find(x=>x.id===id);
 if(!o)throw Error('Pengiriman tidak ditemukan.');
 if(target==='transit'&&o.status==='scheduled'){if(o.shipping_date>today())throw Error('Tanggal pengiriman masih di masa depan. Edit jadwal sebelum menekan Jalan.');o.departure_date=today()}
 else if(target==='cancelled'&&o.status==='scheduled'){o.cancelled_at=new Date().toISOString()}
 else if(target==='arrived'&&o.status==='transit'){if(!validOrderDate(arrival)||arrival<o.departure_date||arrival>today())throw Error('Tanggal sampai harus antara tanggal mulai jalan dan hari ini.');o.arrival_date=arrival}
 else throw Error('Perubahan status pengiriman tidak valid.');
 o.status=target;await save(next);orderTab=target==='cancelled'?'scheduled':target;
}
function orderForm(id){const o=db.orders.find(x=>x.id===id);$('#modal-title').textContent=o?'Edit jadwal pengiriman':'Tambah jadwal pengiriman';$('#error').textContent='';$('#form button[type="submit"]').style.display='';
 $('#fields').innerHTML=field('destination_address','Alamat tujuan *','text',o?.destination_address||'','required maxlength="500"')+field('recipient_name','Nama penerima *','text',o?.recipient_name||'','required maxlength="100"')+field('recipient_phone','Nomor penerima *','tel',o?.recipient_phone||'','required maxlength="100"')+field('delivery_code','Kode surat jalan *','text',o?.delivery_code||'','required maxlength="100"')+'<div class="form-grid">'+field('shipping_date','Tanggal pengiriman *','date',o?.shipping_date||today(),'required')+field('estimated_arrival','Estimasi tiba *','date',o?.estimated_arrival||today(),'required')+'</div>'+field('driver_name','Nama supir *','text',o?.driver_name||'','required maxlength="100"')+field('driver_phone','Nomor supir *','tel',o?.driver_phone||'','required maxlength="100"')+field('vehicle_number','Nomor kendaraan *','text',o?.vehicle_number||'','required maxlength="100"')+`<label for="f-comment">Komentar</label><textarea id="f-comment" name="comment" rows="3" maxlength="1000">${esc(o?.comment||'')}</textarea>`;
 $('#form').onsubmit=async e=>{e.preventDefault();try{await storeOrder(Object.fromEntries(new FormData(e.target)),id);orderTab='scheduled';$('#modal').close();render();toast('Jadwal pengiriman disimpan.')}catch(err){$('#error').textContent=err.message}};$('#modal').showModal();
}
function arrivalForm(id){const o=db.orders.find(x=>x.id===id);if(!o)return;$('#modal-title').textContent='Pengiriman sudah sampai';$('#error').textContent='';$('#form button[type="submit"]').style.display='';$('#fields').innerHTML=`<p>${esc(o.driver_name)} · ${esc(o.vehicle_number)}</p>`+field('arrival_date','Tanggal sampai sebenarnya *','date',today(),`required min="${o.departure_date}" max="${today()}"`);$('#form').onsubmit=async e=>{e.preventDefault();try{await transitionOrder(id,'arrived',new FormData(e.target).get('arrival_date'));$('#modal').close();render();toast('Pengiriman dipindahkan ke Sampai.')}catch(err){$('#error').textContent=err.message}};$('#modal').showModal()}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-action]');if(!b)return;const {action,id}=b.dataset;try{if(action==='order-tab'){orderTab=id;renderOrders()}if(action==='order-new')orderForm();if(action==='order-detail')orderDetail(id);if(action==='order-edit'){$('#modal').close();orderForm(id);}if(action==='order-start'||action==='order-cancel'){await transitionOrder(id,action==='order-start'?'transit':'cancelled');$('#modal').close();render();toast(action==='order-start'?'Pengiriman dalam perjalanan.':'Pengiriman dibatalkan dan disimpan di riwayat.')}if(action==='order-arrive'){$('#modal').close();arrivalForm(id)}}catch(err){toast(err.message)}});
// Perbarui keterlambatan saat berganti hari, tanpa mengganggu formulir.
setInterval(()=>{if(page==='orders'&&!$('#modal').open)renderOrders()},60000);
