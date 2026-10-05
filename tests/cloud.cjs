(async()=>{
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const elements=new Map(),classes=new Set();const $=s=>{if(!elements.has(s))elements.set(s,{textContent:'',innerHTML:'',value:'',hidden:false,close(){}});return elements.get(s)};
let session=null,approved=true,failWrite=false,loginEmail='',savedRows={},authCallback;
const client={auth:{async getSession(){return {data:{session}}},onAuthStateChange(fn){authCallback=fn},async signInWithPassword(v){loginEmail=v.email;session={user:{id:'u1',email:v.email}};return {data:{session}}},async signOut(){session=null;authCallback('SIGNED_OUT');return {}}},async rpc(){return {data:approved}},from(table){let payload;const builder={select(){return builder},order(){return builder},async range(){return {data:savedRows[table]||[]}},insert(value){payload=value;return builder},update(value){payload=value;return builder},eq(){return builder},async single(){if(failWrite)return {error:{message:'Network failed'}};const row={...payload,updated_at:'now'};savedRows[table]=[row];return {data:row}}};return builder}};
const sandbox={console,structuredClone,Error,JSON,window:{MJG_CONFIG:{supabaseUrl:'https://test.supabase.co',supabaseKey:'public'},supabase:{createClient(){return client}}},document:{body:{classList:{add(v){classes.add(v)},remove(v){classes.delete(v)}}}},$,db:{},empty:()=>({version:1,customers:[],debts:[],payments:[],orders:[]}),render(){},page:'',query:'',filter:''};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(__dirname+'/../dist/cloud.js','utf8'),sandbox);const run=s=>vm.runInContext(s,sandbox);
await run('cloudStore.start()');assert.ok(classes.has('auth-locked'));
await assert.rejects(run('cloudStore.save(empty(),empty())'),/login/);
await run("cloudStore.login('majujaya','test-only')");assert.equal(loginEmail,'majujaya@accounts.majujaya.invalid');assert.equal($('#account-email').textContent,'majujaya');assert.ok(!classes.has('auth-locked'));
sandbox.next=sandbox.empty();sandbox.next.customers.push({id:'c1',name:'Test'});
let result=await run('cloudStore.save(empty(),next)');assert.equal(result.customers[0].owner_id,'u1');
failWrite=true;await assert.rejects(run('cloudStore.save(empty(),next)'));assert.equal(sandbox.db.customers.length,0);failWrite=false;
approved=false;await assert.rejects(run("cloudStore.login('blocked','test-only')"),/belum mendapat/);assert.ok(classes.has('auth-locked'));assert.equal(sandbox.db.customers.length,0);
approved=true;await run("cloudStore.login('majujaya','test-only')");await run('cloudStore.logout()');assert.ok(classes.has('auth-locked'));assert.equal(sandbox.db.customers.length,0);
sandbox.window.MJG_CONFIG.supabaseUrl='';await run('cloudStore.start()');assert.ok(classes.has('auth-locked'));assert.equal($('#login-submit').disabled,true);
console.log('PASS: login required, username mapping, approved account gate, owner writes, write failure, logout clears data, missing config stays locked.');
})().catch(e=>{console.error(e);process.exitCode=1});
