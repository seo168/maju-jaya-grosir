// Browser client: all access is additionally checked by Supabase RLS.
const cloudStore = (() => {
 let client, user, generation=0, saving=false;
 const tables=['customers','debts','payments','orders'];
 function configured(){return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(window.MJG_CONFIG?.supabaseUrl||'')&&!!window.MJG_CONFIG?.supabaseKey}
 function getClient(){if(!configured())throw Error('Koneksi Supabase belum dikonfigurasi.');if(!window.supabase)throw Error('Komponen login gagal dimuat. Muat ulang halaman.');return client ||= window.supabase.createClient(window.MJG_CONFIG.supabaseUrl,window.MJG_CONFIG.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}})}
 function reset(){generation++;user=null;db=empty();$('#view').innerHTML='';$('#modal').close();document.body.classList.add('auth-locked');$('#auth-screen').hidden=false;$('#auth-password').value=''}
 async function read(){if(!user)throw Error('Silakan login terlebih dahulu.');const identity=user.id,stamp=generation;const result={version:1};
  for(const table of tables){result[table]=[];for(let offset=0;;offset+=500){const {data,error}=await getClient().from(table).select('*').order('id').range(offset,offset+499);if(error)throw error;result[table].push(...data);if(data.length<500)break}}
  if(stamp!==generation||user?.id!==identity)throw Error('Sesi berubah. Silakan masuk kembali.');return result;
 }
 async function enter(session){if(!session){reset();return}const stamp=++generation;user=session.user;
  const {data,error}=await getClient().rpc('is_approved_account');
  if(error||data!==true){reset();throw Error(error?'Database belum siap atau tidak dapat diakses.':'Akun belum mendapat akses sistem.')}
  const fresh=await read();if(stamp!==generation)return;db=fresh;page='dashboard';query='';filter='all';render();$('#account-email').textContent=(user.email||'').split('@')[0];document.body.classList.remove('auth-locked');$('#auth-screen').hidden=true;
 }
 async function save(before,next){if(!user)throw Error('Silakan login terlebih dahulu.');if(saving)throw Error('Penyimpanan sebelumnya masih diproses.');
  const changes=[];for(const table of tables){for(const row of next[table]){const old=before[table].find(x=>x.id===row.id);if(!old||JSON.stringify(old)!==JSON.stringify(row))changes.push({table,row,old})}}
  if(changes.length!==1)throw Error('Simpan satu perubahan setiap kali.');const {table,row,old}=changes[0],identity=user.id,stamp=generation;
  const payload={...row};delete payload.created_at;delete payload.updated_at;payload.owner_id=identity;
  saving=true;try{
   let req=old?getClient().from(table).update(payload).eq('id',row.id).eq('owner_id',identity).eq('updated_at',old.updated_at):getClient().from(table).insert(payload);
   const {data,error}=await req.select().single();if(error){if(error.code==='PGRST116')throw Error('Data telah berubah di perangkat lain. Muat ulang sebelum mengedit.');throw error}
   if(stamp!==generation||user?.id!==identity)throw Error('Sesi berubah. Muat ulang untuk memeriksa penyimpanan.');
   const committed=structuredClone(before),index=committed[table].findIndex(x=>x.id===row.id);if(index<0)committed[table].push(data);else committed[table][index]=data;
   return committed;
  }finally{saving=false}
 }
 async function start(){reset();if(!configured()){$('#auth-message').textContent='Koneksi Supabase sedang disiapkan. Sistem terkunci sampai konfigurasi selesai.';$('#login-submit').disabled=true;return}
  try{const {data,error}=await getClient().auth.getSession();if(error)throw error;await enter(data.session)}catch(error){$('#auth-message').textContent=error.message}
  getClient().auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT')reset()});
 }
 async function login(username,password){if(!/^[a-z0-9._-]{3,40}$/i.test(username))throw Error('Username harus 3–40 karakter: huruf, angka, titik, _ atau -.');const email=username.toLowerCase()+'@accounts.majujaya.invalid';const {data,error}=await getClient().auth.signInWithPassword({email,password});if(error)throw Error('Username atau password tidak cocok, atau akun belum aktif.');await enter(data.session)}
 async function logout(){reset();const {error}=await getClient().auth.signOut({scope:'local'});if(error)$('#auth-message').textContent='Sesi lokal ditutup. Muat ulang jika mengalami kendala.'}
 return {start,login,logout,save,read,reset};
})();
