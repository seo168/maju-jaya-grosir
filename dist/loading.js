// Sembunyikan isi halaman selama transisi 1,5 detik.
(()=>{
 const overlay=document.createElement('div');
 overlay.id='brand-loading';overlay.hidden=true;
 overlay.setAttribute('role','status');overlay.setAttribute('aria-label','Memuat tampilan');
 overlay.innerHTML='<div class="loading-brand"><img src="assets/maju-jaya-logo.png" alt="Maju Jaya Grosir"></div>';
 document.body.appendChild(overlay);
 let timer;
 function show(){clearTimeout(timer);document.body.classList.add('page-loading');const content=document.querySelector('.content');content.setAttribute('aria-busy','true');content.inert=true;overlay.hidden=false;timer=setTimeout(()=>{overlay.hidden=true;document.body.classList.remove('page-loading');content.setAttribute('aria-busy','false');content.inert=false},1500)}
 document.addEventListener('click',event=>{
  const menu=event.target.closest('[data-page]');
  if(menu&&menu.dataset.page!==page)show();
 },true);
 // Halaman awal langsung terlihat; animasi hanya untuk perpindahan menu.
 document.body.classList.remove('page-loading');
})();
