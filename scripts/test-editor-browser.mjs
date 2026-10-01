// Optional local browser QA. Isolated test data and PGlite; no VPS or Docker required.
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
const cwd=fileURLToPath(new URL('../', import.meta.url)); const require=createRequire(cwd+'/package.json');
let chromium;
try { ({chromium}=require('playwright')); } catch { throw new Error('Optional browser QA requires Playwright tooling: npm install --no-save --package-lock=false playwright'); } const {Kysely,PGliteDialect}=await import(pathToFileURL(require.resolve('kysely')).href); const {PGlite}=require('@electric-sql/pglite');
const temp=await mkdtemp(tmpdir()+'/editor-ui-');
const shots=await mkdtemp(tmpdir()+'/editor-ui-screenshots-'); process.env.PLC_LADDER_DATA_DIR=temp;
const {createApplicationServer}=await import(pathToFileURL(cwd+'/services/mcp-server/src/server.ts').href); const {createWebAuth}=await import(pathToFileURL(cwd+'/services/mcp-server/src/auth/web-auth.ts').href);
const {ProjectRepository}=await import(pathToFileURL(cwd+'/services/mcp-server/src/persistence/projects.ts').href); const {migrateDatabase}=await import(pathToFileURL(cwd+'/services/mcp-server/src/persistence/test-support/migrations.ts').href);
const db=new Kysely({dialect:new PGliteDialect({pglite:new PGlite({parsers:{20:v=>v}})})}); await migrateDatabase(db);
const repository=new ProjectRepository(db); const servers=[false,true].map(database=>createApplicationServer({token:'machine',webAuth:createWebAuth({username:'admin',password:'test',secret:'editor-ui-secret'}),...(database?{projectRepository:repository}:{})}));
for(const s of servers){s.listen(0,'127.0.0.1');await once(s,'listening');}
const {createServer}=await import(pathToFileURL(require.resolve('vite')).href); const vite=await createServer({root:cwd+'/apps/web',configFile:cwd+'/apps/web/vite.config.ts',server:{host:'127.0.0.1',port:5189,strictPort:true}}); await vite.listen();
let browser;
try {
 browser=await chromium.launch({...(process.env.PLC_EDITOR_BROWSER_PATH ? {executablePath:process.env.PLC_EDITOR_BROWSER_PATH} : {}),headless:true,args:['--no-sandbox']});
for(let mode=0;mode<2;mode++){
 const context=await browser.newContext({viewport:{width:1600,height:1000}}); const api=`http://127.0.0.1:${servers[mode].address().port}`;
 await context.addInitScript(api=>localStorage.setItem('plc-ladder-api',api),api); const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5189/PLC-LadderMCP/'); await page.getByLabel('Username').fill('admin'); await page.getByLabel('Password').fill('test'); await page.getByRole('button',{name:'Enter workspace'}).click();
 await page.getByRole('button',{name:'New project',exact:true}).waitFor(); page.once('dialog',d=>d.accept('Conveyor control'));await page.getByRole('button',{name:'New project',exact:true}).click(); await page.getByRole('heading',{name:'Conveyor control',exact:true}).waitFor();
 const add=async(tool,value)=>{await page.getByRole('button',{name:'Insert '+tool,exact:true}).click();await page.getByLabel('Element address or instruction').fill(value);await page.getByLabel('Element address or instruction').press('Enter');await page.locator('.editor-command-entry').waitFor({state:'hidden'});};
 await add('NO contact','X0'); await add('Output coil','Y0'); await add('Output coil','Y1');
 assert.equal(await page.locator('.editor-rung [data-node-id]').count(),3);
 await page.getByRole('button',{name:'Undo edit',exact:true}).click(); await page.waitForFunction(()=>document.querySelectorAll('.editor-rung [data-node-id]').length===2);
 await page.getByRole('button',{name:'Redo edit',exact:true}).click(); await page.waitForFunction(()=>document.querySelectorAll('.editor-rung [data-node-id]').length===3);
 const first=page.locator('.editor-rung [data-node-id]').first(); await first.click(); await page.getByRole('complementary',{name:'Element properties'}).getByLabel('Device',{exact:true}).fill('X1'); await page.getByRole('button',{name:'Update element',exact:true}).click(); await page.locator('.editor-rung').getByText('NO X1',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Network',exact:true}).click(); await page.waitForFunction(()=>document.querySelectorAll('.editor-rung').length===2);
 await add('NC contact','M0'); await add('Timer','T0 K10');
 await page.locator('.rung-gutter').first().click(); await page.locator('.editor-rung').first().locator('[data-node-id]').first().click(); await page.getByRole('button',{name:'Add parallel branch',exact:true}).click();
 await page.locator('.editor-rung').first().getByText('Empty series · draft',{exact:true}).click(); await add('NO contact','X2');
 await page.getByLabel('Network label',{exact:true}).fill('Start / interlock'); await page.getByLabel('Network label',{exact:true}).press('Tab'); await page.locator('.rung-comment').first().getByText('Start / interlock',{exact:true}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Delete element"]').disabled); await page.locator('.editor-stage').focus(); await page.locator('.editor-stage').press('Delete'); await page.locator('.editor-rung').first().getByText('NO X2',{exact:true}).waitFor({state:'hidden'});
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Undo edit"]').disabled); await page.locator('.editor-stage').press('Control+z'); await page.locator('.editor-rung').first().getByText('NO X2',{exact:true}).waitFor();
 // Real editor commands: copy/paste, cut/move identity, dialog, context menu and whole-rung duplicate.
 const stage = page.locator('.editor-stage');
 const x2 = page.locator('.editor-rung').first().locator('[data-node-id]').filter({hasText:'NO X2'});
 await x2.click(); const movedId = await x2.getAttribute('data-node-id');
 await stage.focus(); await stage.press('Control+c'); await stage.press('Control+v');
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.editor-rung:first-of-type [data-node-id]')).filter(n=>n.textContent.includes('NO X2')).length===2);
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Undo edit"]').disabled); await page.getByRole('button',{name:'Undo edit',exact:true}).click();
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.editor-rung:first-of-type [data-node-id]')).filter(n=>n.textContent.includes('NO X2')).length===1);
 await x2.click(); await stage.focus(); await stage.press('Control+x'); await x2.waitFor({state:'hidden'});
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Paste selection"]').disabled); await stage.press('Control+v'); await x2.waitFor();
 assert.equal(await x2.getAttribute('data-node-id'), movedId);
 await x2.dblclick(); const dialog=page.getByRole('dialog',{name:'Edit symbol'}); await dialog.waitFor();
 await page.screenshot({path:`${shots}/editor-symbol-dialog-${mode}.png`});
 await dialog.getByLabel('Device',{exact:true}).fill('   '); await dialog.getByRole('button',{name:'Update element',exact:true}).click(); await dialog.getByRole('alert').filter({hasText:'Device address is required'}).waitFor();
 await dialog.getByLabel('Device',{exact:true}).fill(' x4 '); await dialog.getByRole('button',{name:'Update element',exact:true}).click(); await dialog.waitFor({state:'hidden'});
 const x4=page.locator('.editor-rung').first().locator('[data-node-id]').filter({hasText:'NO X4'}); await x4.waitFor();
 await x4.click(); await stage.focus(); await stage.press('ArrowRight');
 assert.ok((await page.locator('.editor-rung').first().locator('[data-node-id][aria-pressed="true"]').getAttribute('aria-label')).includes('OUT Y1'));
 await x4.click(); await stage.focus(); await stage.press('ArrowUp');
 assert.ok((await page.locator('.editor-rung').first().locator('[data-node-id][aria-pressed="true"]').getAttribute('aria-label')).includes('NO X1'));
 await x4.focus(); await x4.press('Enter'); await dialog.waitFor(); await dialog.getByLabel('Device',{exact:true}).fill('X9'); await dialog.getByRole('button',{name:'Cancel',exact:true}).click(); assert.equal(await x4.count(),1);
 await x4.click({button:'right'}); await page.getByRole('menuitem',{name:'Duplicate · Ctrl+D',exact:true}).click();
 await page.waitForFunction(()=>Array.from(document.querySelectorAll('.editor-rung:first-of-type [data-node-id]')).filter(n=>n.textContent.includes('NO X4')).length===2);
 await page.getByRole('button',{name:'Undo edit',exact:true}).click(); await page.waitForFunction(()=>document.querySelectorAll('.editor-rung:first-of-type [data-node-id]').length===4);
 await page.locator('.rung-gutter').first().click(); await stage.focus(); await stage.press('Control+d'); await page.waitForFunction(()=>document.querySelectorAll('.editor-rung').length===3);
 await page.getByRole('button',{name:'Undo edit',exact:true}).click(); await page.waitForFunction(()=>document.querySelectorAll('.editor-rung').length===2);
 await page.locator('.rung-gutter').first().click();
 await stage.focus(); await stage.press('Control+f'); await page.getByLabel('Find device or instruction').fill('T0'); await page.getByLabel('Find device or instruction').press('Enter');
 await page.waitForFunction(()=>document.querySelectorAll('.rung-gutter')[1].getAttribute('aria-pressed')==='true');
 assert.ok((await page.locator('.editor-rung').nth(1).locator('[data-node-id][aria-pressed="true"]').getAttribute('aria-label')).includes('T0'));
 const timer = page.locator('.editor-rung').nth(1).locator('[data-node-id]').filter({hasText:'OUT T0 K10'});
 await timer.dblclick(); await dialog.waitFor(); await dialog.getByLabel('Operand 2 value',{exact:true}).fill('20'); await dialog.getByRole('button',{name:'Update element',exact:true}).click(); await dialog.waitFor({state:'hidden'}); await page.locator('.editor-rung').nth(1).getByText('OUT T0 K20',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Close search',exact:true}).click();
 await stage.press('Home'); await stage.press('ArrowUp'); await page.waitForFunction(()=>document.querySelectorAll('.rung-gutter')[0].getAttribute('aria-pressed')==='true');
 await page.locator('.rung-gutter').first().click();
 if(!mode){
  await page.route('**/api/manual/project',r=>r.fulfill({status:404,contentType:'application/json',body:'{"error":"Not found"}'}));
  await page.getByRole('button',{name:'Insert NO contact',exact:true}).click(); await page.getByLabel('Element address or instruction').fill('X3'); await page.getByLabel('Element address or instruction').press('Enter');
  await page.getByRole('alert').filter({hasText:'restart npm run server'}).waitFor(); assert.equal(await page.locator('.editor-rung').first().locator('[data-node-id]').count(),4); await page.unroute('**/api/manual/project'); await page.getByRole('button',{name:'Cancel',exact:true}).click(); await page.getByRole('button',{name:'Dismiss',exact:true}).click();
 }
 await page.getByRole('button',{name:'Zoom out',exact:true}).click(); await page.screenshot({path:`${shots}/editor-workspace-${mode}.png`,fullPage:true});
 if(mode){await page.getByRole('status').filter({hasText:/saved/}).waitFor();await page.reload();await page.getByRole('heading',{name:'Conveyor control',exact:true}).waitFor();assert.equal(await page.locator('.editor-rung').count(),2);assert.equal(await page.locator('.editor-rung').first().locator('[data-node-id]').count(),4);}
 await page.setViewportSize({width:520,height:800}); await page.screenshot({path:`${shots}/editor-workspace-${mode}-520.png`,fullPage:true});
 await page.setViewportSize({width:1100,height:800}); await page.screenshot({path:`${shots}/editor-workspace-${mode}-1100.png`,fullPage:true});
 assert.deepEqual(errors,[]); console.log(`PASS browser ${mode?'PostgreSQL':'local'} insert/properties/branch/networks/clipboard/cut-identity/dialog/context-menu/duplicate/find/navigation/undo/redo/keyboard/zoom${mode?'/reload':'/old-backend-error'}`); await context.close();
}
console.log('Browser QA screenshots: '+shots);
}finally{await browser?.close();await vite.close();for(const s of servers)await new Promise(r=>s.close(r));await db.destroy();await rm(temp,{recursive:true,force:true});}
