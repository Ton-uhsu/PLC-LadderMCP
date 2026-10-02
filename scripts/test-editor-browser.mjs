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
 await page.getByRole('button',{name:'Toggle entry mode',exact:true}).click(); await page.getByRole('button',{name:'Toggle properties',exact:true}).click();
 const add=async(tool,value)=>{await page.getByRole('button',{name:'Insert '+tool,exact:true}).click();await page.getByLabel('Element address or instruction').fill(value);await page.getByLabel('Element address or instruction').press('Enter');await page.locator('.editor-command-entry').waitFor({state:'hidden'});};
 await add('NO contact','X0'); await add('Output coil','Y0'); await add('Output coil','Y1');
 assert.equal(await page.locator('.editor-rung [data-node-id]').count(),3);
 await page.getByRole('button',{name:'Undo edit',exact:true}).click(); await page.waitForFunction(()=>document.querySelectorAll('.editor-rung [data-node-id]').length===2);
 await page.getByRole('button',{name:'Redo edit',exact:true}).click(); await page.waitForFunction(()=>document.querySelectorAll('.editor-rung [data-node-id]').length===3);
 const first=page.locator('.editor-rung [data-node-id]').first(); await first.click(); await page.getByRole('complementary',{name:'Element properties'}).getByLabel('Device',{exact:true}).fill('X1'); await page.getByRole('button',{name:'Update element',exact:true}).click(); await page.locator('.editor-rung').getByText('NO X1',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Network',exact:true}).click(); await page.waitForFunction(()=>document.querySelectorAll('.editor-rung').length===2);
 await add('NC contact','M0'); await add('Timer','T0 K10');
 await page.locator('.rung-gutter').first().click(); await page.locator('.editor-rung').first().locator('[data-node-id]').first().click(); await page.getByRole('button',{name:'Add parallel branch',exact:true}).click();
 await page.locator('.editor-rung').first().getByText('Empty series',{exact:true}).click(); await add('NO contact','X2');
 await page.getByLabel('Network label',{exact:true}).fill('Start / interlock'); await page.getByLabel('Network label',{exact:true}).press('Tab'); await page.locator('.rung-comment').first().getByText('Start / interlock',{exact:true}).waitFor();
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Delete element"]').disabled); await page.locator('.editor-stage').focus(); await page.locator('.editor-stage').press('Delete'); await page.locator('.editor-rung').first().getByText('NO X2',{exact:true}).waitFor({state:'hidden'});
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Undo edit"]').disabled); await page.locator('.editor-stage').press('Control+z'); await page.locator('.editor-rung').first().getByText('NO X2',{exact:true}).waitFor();
 const stage = page.locator('.editor-stage');
 // Excel-like rectangular selection: Shift+click and drag select cells; Escape cancels;
 // Delete clears the whole range and Undo restores it as one edit.
 const firstRung=page.locator('.editor-rung').first();
 const cell00=firstRung.locator('[data-cell-row="0"][data-cell-column="0"]').first();
 const cell02=firstRung.locator('[data-cell-row="0"][data-cell-column="2"]').first();
 await cell00.click(); await cell02.click({modifiers:['Shift']});
 await page.waitForFunction(()=>document.querySelector('.editor-statusbar').textContent.includes('3 cells selected'));
 assert.equal(await firstRung.locator('.cell-range-selection').count(),1);
 await stage.focus(); await stage.press('Escape');
 await firstRung.locator('.cell-range-selection').waitFor({state:'hidden'});
 const startBox=await cell00.boundingBox(), endBox=await cell02.boundingBox();
 await page.mouse.move(startBox.x+startBox.width/2,startBox.y+startBox.height/2);
 await page.mouse.down();
 await page.mouse.move(endBox.x+endBox.width/2,endBox.y+endBox.height/2,{steps:5});
 await page.mouse.up();
 await page.waitForFunction(()=>document.querySelector('.editor-statusbar').textContent.includes('3 cells selected'));
 const beforeRangeDelete=await firstRung.locator('[data-node-id]').count();
 await stage.focus(); await stage.press('Delete');
 await page.waitForFunction(()=>[...document.querySelectorAll('.editor-rung:first-of-type [data-node-id]')].some(n=>n.getAttribute('aria-label')?.startsWith('Empty cell')));
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Undo edit"]').disabled); await stage.press('Control+z');
 await page.waitForFunction(count=>document.querySelectorAll('.editor-rung:first-of-type [data-node-id]').length===count,beforeRangeDelete);
 // Real editor commands: copy/paste, cut/move identity, dialog, context menu and whole-rung duplicate.
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
 assert.ok((await page.locator('.editor-statusbar').textContent()).includes('Column 1'));
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
 // Integer grid: individual implicit segments and one-column coil wiring.
 // Deleting a projected wire must disconnect that cell, never its neighboring coil.
 const projected=page.locator('.editor-rung').first().locator('[data-cell-row="1"][data-cell-column="1"]');
 await projected.click(); await stage.focus(); await stage.press('Delete');
 const deletedPadding=page.locator('.editor-rung').first().locator('[data-node-id][aria-label^="Empty cell"]');
 await deletedPadding.waitFor();assert.equal(await deletedPadding.locator('line,circle,path').count(),0);assert.equal(await deletedPadding.getByText('Gap',{exact:true}).count(),0); assert.equal(await deletedPadding.getAttribute('data-cell-column'),'1');
 assert.equal(await page.locator('.editor-rung').first().getByText('OUT Y1',{exact:true}).count(),1);
 await page.waitForFunction(()=>!document.querySelector('[aria-label="Undo edit"]').disabled); await stage.press('Control+z'); await deletedPadding.waitFor({state:'hidden'});
 // Open-branch drawing is exercised separately below; completed toolbar branches remain covered above.
 await page.locator('.rung-gutter').first().click();
 if(!mode){
  const beforeFailedEdit=await page.locator('.editor-rung').first().locator('[data-node-id]').count();
  await page.route('**/api/manual/project',r=>r.fulfill({status:404,contentType:'application/json',body:'{"error":"Not found"}'}));
  await page.getByRole('button',{name:'Insert NO contact',exact:true}).click(); await page.getByLabel('Element address or instruction').fill('X3'); await page.getByLabel('Element address or instruction').press('Enter');
  await page.getByRole('alert').filter({hasText:'restart npm run server'}).waitFor(); assert.equal(await page.locator('.editor-rung').first().locator('[data-node-id]').count(),beforeFailedEdit); await page.unroute('**/api/manual/project'); await page.getByRole('button',{name:'Cancel',exact:true}).click(); await page.getByRole('button',{name:'Dismiss',exact:true}).click();
 }
 await page.getByRole('button',{name:'Zoom out',exact:true}).click(); await page.screenshot({path:`${shots}/editor-workspace-${mode}.png`,fullPage:true});
 if(mode){await page.locator('.editor-save-state').filter({hasText:/saved/}).waitFor();await page.reload();await page.getByRole('heading',{name:'Conveyor control',exact:true}).waitFor();assert.equal(await page.locator('.editor-rung').count(),2);assert.ok(await page.locator('.editor-rung').first().locator('[data-node-id]').count()>=4);assert.equal(await page.locator('.editor-rung').nth(1).locator('[data-node-id][aria-label^="Empty cell"]').count(),0);}
 if((await page.getByRole('button',{name:'Toggle entry mode',exact:true}).textContent())==='Overwrite')await page.getByRole('button',{name:'Toggle entry mode',exact:true}).click();
 // New workflow: rectangular clipboard -> exact Compile -> stale/failure navigation -> retained export.
 page.once('dialog',d=>d.accept('Clipboard compile acceptance'));await page.getByRole('button',{name:'New project',exact:true}).click();
 await page.getByRole('heading',{name:'Clipboard compile acceptance',exact:true}).waitFor();
 await add('NO contact','X0');await add('Output coil','Y0');
 const source=page.locator('.editor-rung').first();
 await source.locator('[data-cell-row="0"][data-cell-column="0"]').first().click();
 await source.locator('[data-cell-row="0"][data-cell-column="9"]').first().click({modifiers:['Shift']});
 await page.waitForFunction(()=>document.querySelector('.editor-statusbar').textContent.includes('10 cells selected'));
 await page.getByRole('button',{name:'Copy selection',exact:true}).click();
 await page.getByRole('button',{name:'Network',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.editor-rung').length===2);
 const destination=page.locator('.editor-rung').nth(1);
 await destination.locator('[data-cell-row="0"][data-cell-column="0"]').first().click();
 await page.getByRole('button',{name:'Paste selection',exact:true}).click();
 await destination.getByText('OUT Y0',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Undo edit',exact:true}).click();await destination.getByText('OUT Y0',{exact:true}).waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Redo edit',exact:true}).click();await destination.getByText('OUT Y0',{exact:true}).waitFor();
 // One atomic Cut and one Undo restores the complete selected range.
 await destination.locator('[data-cell-row="0"][data-cell-column="0"]').first().click();
 await destination.locator('[data-cell-row="0"][data-cell-column="9"]').first().click({modifiers:['Shift']});
 await page.getByRole('button',{name:'Cut selection',exact:true}).click();await destination.getByText('OUT Y0',{exact:true}).waitFor({state:'hidden'});
 await page.getByRole('button',{name:'Undo edit',exact:true}).click();await destination.getByText('OUT Y0',{exact:true}).waitFor();
 await destination.locator('[data-cell-row="0"][data-cell-column="0"]').first().click();
 await page.getByRole('button',{name:'Paste selection',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'overwrite a symbol'}).waitFor();
 if(mode)await page.locator('.editor-save-state').filter({hasText:/saved/}).waitFor();
 await page.getByRole('button',{name:'Compile project',exact:true}).click();
 await page.getByRole('region',{name:'Compile diagnostics'}).getByText('Compile PASS',{exact:true}).waitFor();
 // Deleting one padding cell invalidates the old Compile, and the next run locates the gap.
 await destination.locator('[data-cell-row="0"][data-cell-column="1"]').first().click();await stage.focus();await stage.press('Delete');
 await page.getByRole('region',{name:'Compile diagnostics'}).getByText('Compile Required · previous results are stale',{exact:true}).waitFor();
 if(mode)await page.locator('.editor-save-state').filter({hasText:/saved/}).waitFor();
 await page.getByRole('button',{name:'Compile project',exact:true}).click();
 const diagnostics=page.getByRole('region',{name:'Compile diagnostics'});
 await diagnostics.getByText('Compile FAIL',{exact:true}).waitFor();
 await diagnostics.getByRole('button').filter({hasText:'DISCONNECTED_WIRE'}).click();
 await destination.locator('.diagnostic-error-node').waitFor();
 await page.screenshot({path:`${shots}/compile-diagnostic-${mode}.png`,fullPage:true});
 await page.getByRole('button',{name:'Undo edit',exact:true}).click();if(mode)await page.locator('.editor-save-state').filter({hasText:/saved/}).waitFor();
 await page.getByRole('button',{name:'Compile project',exact:true}).click();await diagnostics.getByText('Compile PASS',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Project / Export',exact:true}).click();
 await page.locator('.export-card select').selectOption({label:'GX Works2'});if(mode)await page.getByLabel('Target IDE version').fill('Acceptance-test-version');
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Generate GX Works2 file',exact:true}).click();
 const download=await downloadPromise;assert.equal(download.suggestedFilename(),'plc-ladder-gxworks2.csv');
 const stream=await download.createReadStream(),chunks=[];for await(const c of stream)chunks.push(c);const bytes=Buffer.concat(chunks);assert.equal(bytes[0],255);assert.equal(bytes[1],254);assert.ok(bytes.toString('utf16le').includes('OUT'));
 await page.screenshot({path:`${shots}/compile-export-${mode}.png`,fullPage:true});
 if(mode){await page.reload();await page.getByRole('heading',{name:'Clipboard compile acceptance',exact:true}).waitFor();await page.getByRole('region',{name:'Compile diagnostics'}).getByText('Compile PASS',{exact:true}).waitFor();}
 console.log(`PASS browser ${mode?'database':'local'} rectangular copy/cut/paste/atomic undo/collision/compile-stale-gap-navigation/export-download${mode?'/compile-history-reload':''}`);
 // Cursor-first classic editor, independent of earlier insert-mode regression.
 await page.getByRole('button',{name:'Project / Export',exact:true}).click();
 page.once('dialog',d=>d.accept('Classic cursor acceptance'));await page.getByRole('button',{name:'New project',exact:true}).click();await page.getByRole('heading',{name:'Classic cursor acceptance',exact:true}).waitFor();
 const toggle=page.getByRole('button',{name:'Toggle entry mode',exact:true});if((await toggle.textContent())==='Insert')await toggle.click();
 const properties=page.getByRole('button',{name:'Toggle properties',exact:true});if(await properties.getAttribute('aria-pressed')==='true')await properties.click();
 const classic=page.locator('.editor-rung').first();
 await classic.locator('[data-cell-row="0"][data-cell-column="0"]').first().click();
 const keyEntry=async(key,value)=>{await stage.focus();await stage.press(key);await page.getByRole('dialog',{name:'Enter symbol',exact:true}).waitFor();await page.getByLabel('Element address or instruction').fill(value);await page.getByLabel('Element address or instruction').press('Enter');await page.getByRole('dialog',{name:'Enter symbol',exact:true}).waitFor({state:'hidden'});};
 await keyEntry('F5','X0');assert.ok((await page.locator('.editor-statusbar').textContent()).includes('Column 1'));
 await keyEntry('F6','X1');await classic.getByText('NC X1',{exact:true}).waitFor();
 await keyEntry('F7','Y0');await classic.getByText('OUT Y0',{exact:true}).waitFor();
 await classic.locator('[data-cell-row="0"][data-cell-column="0"]').first().click();const originalId=await classic.getByText('NO X0',{exact:true}).locator('..').getAttribute('data-node-id');
 await keyEntry('F5','X2');await classic.getByText('NO X2',{exact:true}).waitFor();assert.equal(await classic.getByText('NO X0',{exact:true}).count(),0);
 await classic.locator('[data-cell-row="0"][data-cell-column="0"]').first().click();await stage.focus();await stage.press('Enter');const edit=page.getByRole('dialog',{name:'Edit symbol'});await edit.waitFor();await edit.getByLabel('Device',{exact:true}).fill('X3');await edit.getByRole('button',{name:'Update element',exact:true}).click();await classic.getByText('NO X3',{exact:true}).waitFor();
 await stage.focus();await stage.press('Shift+ArrowRight');await page.waitForFunction(()=>document.querySelector('.editor-statusbar').textContent.includes('2 cells selected'));await stage.press('Escape');
 await classic.locator('[data-cell-row="0"][data-cell-column="2"]').first().dblclick();await page.getByRole('dialog',{name:'Enter symbol',exact:true}).waitFor();await page.getByLabel('Element address or instruction').press('Escape');
 await stage.focus();await stage.press('Insert');assert.equal(await toggle.textContent(),'Insert');await stage.press('Insert');assert.equal(await toggle.textContent(),'Overwrite');
 await keyEntry('F8','MOV K100 D0');await classic.getByText('MOV K100 D0',{exact:true}).waitFor();
 if(mode)await page.locator('.editor-save-state').filter({hasText:/saved/}).waitFor();
 await page.screenshot({path:`${shots}/classic-cursor-${mode}.png`,fullPage:true});console.log(`PASS classic cursor ${mode?'database':'local'} F5/F6/F7/F8/overwrite/continue/Enter/doubleclick/Escape/Shift-arrows/Insert`);
 // Regression for user screenshots: Down alone, then Right creates an open L.
 page.once('dialog',d=>d.accept('Open branch acceptance'));await page.getByRole('button',{name:'New project',exact:true}).click();await page.getByRole('heading',{name:'Open branch acceptance',exact:true}).waitFor();
 const openRung=page.locator('.editor-rung').first();await openRung.locator('[data-cell-row="0"][data-cell-column="0"]').first().click();
 await keyEntry('F5','X0');await keyEntry('F7','Y0');
await openRung.locator('[data-cell-row="0"][data-cell-column="1"]').first().click();await stage.focus();await stage.press('Control+ArrowDown');
 await page.waitForFunction(()=>document.querySelector('.editor-statusbar').textContent.includes('Row 2 · Column 1'));
 const verticals=()=>openRung.locator('svg').evaluate(svg=>[...svg.querySelectorAll(':scope > g:first-of-type > line')].filter(l=>l.getAttribute('x1')===l.getAttribute('x2') && l.getAttribute('y1')!=='20').length);
 assert.equal(await verticals(),1);assert.equal(await openRung.locator('[data-node-id][data-cell-row="1"]').count(),0);
 // Delete immediately after drawing: actual cursor, blank lower cell, toolbar and key.
 await stage.press('Delete');await page.waitForFunction(()=>[...document.querySelectorAll('.editor-rung svg > g:first-of-type > line')].filter(l=>l.getAttribute('x1')===l.getAttribute('x2')&&l.getAttribute('y1')!=='20').length===0);
 await page.getByRole('button',{name:'Undo edit',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('.editor-rung svg > g:first-of-type > line')].filter(l=>l.getAttribute('x1')===l.getAttribute('x2')&&l.getAttribute('y1')!=='20').length===1);
 await page.getByRole('button',{name:'Delete element',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('.editor-rung svg > g:first-of-type > line')].filter(l=>l.getAttribute('x1')===l.getAttribute('x2')&&l.getAttribute('y1')!=='20').length===0);
 if(mode){await page.locator('.editor-save-state').filter({hasText:/saved/}).waitFor();await page.reload();await page.getByRole('heading',{name:'Open branch acceptance',exact:true}).waitFor();assert.equal(await verticals(),0);await openRung.locator('[data-cell-row="1"][data-cell-column="1"]').first().click();await stage.focus();await stage.press('Control+ArrowUp');await page.waitForFunction(()=>[...document.querySelectorAll('.editor-rung svg > g:first-of-type > line')].filter(l=>l.getAttribute('x1')===l.getAttribute('x2')&&l.getAttribute('y1')!=='20').length===1);}
 else {await page.getByRole('button',{name:'Undo edit',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('.editor-rung svg > g:first-of-type > line')].filter(l=>l.getAttribute('x1')===l.getAttribute('x2')&&l.getAttribute('y1')!=='20').length===1);}
 await openRung.locator('[data-cell-row="1"][data-cell-column="1"]').first().click();await stage.focus();
 console.log(`PASS vertical Delete ${mode?'database':'local'} keyboard/toolbar/immediate-cursor/Undo${mode?'/saved-reload':''}`);

 if(mode)await page.locator('.editor-save-state').filter({hasText:/saved/}).waitFor();
 await page.getByRole('button',{name:'Compile project',exact:true}).click();await page.getByRole('region',{name:'Compile diagnostics'}).getByRole('button').filter({hasText:'OPEN_BRANCH'}).waitFor();
 await stage.focus();await stage.press('Control+ArrowRight');await openRung.locator('[data-node-id][data-cell-row="1"][data-cell-column="1"][aria-label^="Wire"]').waitFor();assert.equal(await verticals(),1);
 if(mode)await page.locator('.editor-save-state').filter({hasText:/saved/}).waitFor();await stage.evaluate(el=>el.scrollLeft=0);
 await page.screenshot({path:`${shots}/open-L-${mode}.png`,fullPage:true});
 if(mode){await page.locator('.editor-save-state').filter({hasText:/saved/}).waitFor();await page.reload();await page.getByRole('heading',{name:'Open branch acceptance',exact:true}).waitFor();await openRung.locator('[data-node-id][data-cell-row="1"][data-cell-column="1"][aria-label^="Wire"]').waitFor();assert.equal(await verticals(),1);}
 // Traverse the existing left leg in reverse: remove only it and keep the horizontal wire.
 await openRung.locator('[data-cell-row="1"][data-cell-column="1"]').first().click();await stage.focus();await stage.press('Control+ArrowUp');
 await page.waitForFunction(()=>[...document.querySelectorAll('.editor-rung svg > g:first-of-type > line')].filter(l=>l.getAttribute('x1')===l.getAttribute('x2')&&l.getAttribute('y1')!=='20').length===0);
 assert.equal(await openRung.locator('[data-node-id][data-cell-row="1"][data-cell-column="1"][aria-label^="Wire"]').count(),1);
 if(mode){await page.locator('.editor-save-state').filter({hasText:/saved/}).waitFor();await page.reload();await page.getByRole('heading',{name:'Open branch acceptance',exact:true}).waitFor();assert.equal(await verticals(),0);}
 await openRung.locator('[data-cell-row="1"][data-cell-column="1"]').first().click();await stage.focus();await stage.press('Control+ArrowUp');
 await page.waitForFunction(()=>[...document.querySelectorAll('.editor-rung svg > g:first-of-type > line')].filter(l=>l.getAttribute('x1')===l.getAttribute('x2')&&l.getAttribute('y1')!=='20').length===1);
 await openRung.locator('[data-cell-row="1"][data-cell-column="2"]').first().click();await stage.focus();await stage.press('Control+ArrowUp');
 await page.waitForFunction(()=>[...document.querySelectorAll('.editor-rung svg > g:first-of-type > line')].filter(l=>l.getAttribute('x1')===l.getAttribute('x2')&&l.getAttribute('y1')!=='20').length===2);assert.equal(await verticals(),2);if(mode)await page.locator('.editor-save-state').filter({hasText:/saved/}).waitFor();
 await page.getByRole('button',{name:'Compile project',exact:true}).click();await page.getByRole('region',{name:'Compile diagnostics'}).getByText('Compile PASS',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Undo edit',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('.editor-rung svg > g:first-of-type > line')].filter(l=>l.getAttribute('x1')===l.getAttribute('x2')&&l.getAttribute('y1')!=='20').length===1);
 console.log(`PASS open branch ${mode?'database':'local'} single-vertical/open-L/reverse-delete/reconnect/explicit-join/compile-gate/Undo${mode?'/saved-reload':''}`);
 // User-image continuation: extend an open lower wire left of its junction, then beyond the sheet.
 page.once('dialog',d=>d.accept('Continuous wire acceptance'));await page.getByRole('button',{name:'New project',exact:true}).click();await page.getByRole('heading',{name:'Continuous wire acceptance',exact:true}).waitFor();
 await page.evaluate(async()=>{const {useProjectStore}=await import('/PLC-LadderMCP/src/store.ts');const s=useProjectStore.getState(),p=structuredClone(s.project);p.programs[0].networks[0].root={kind:'series',id:'continuous-root',children:[{kind:'wire',id:'continuous-top',connected:true}]};await s.editProject(p);});
 const continuous=page.locator('.editor-rung').first();await continuous.locator('[data-cell-row="0"][data-cell-column="3"]').first().click();await stage.focus();await stage.press('Control+ArrowDown');await page.waitForFunction(()=>document.querySelector('.editor-statusbar').textContent.includes('Row 2 · Column 3'));
 for(let i=0;i<3;i++){await stage.press('Control+ArrowLeft');await page.waitForFunction(column=>document.querySelector('.editor-statusbar').textContent.includes(`Row 2 · Column ${column}`),2-i);}
 for(let i=0;i<18;i++){await stage.press('Control+ArrowRight');await page.waitForFunction(column=>document.querySelector('.editor-statusbar').textContent.includes(`Row 2 · Column ${column}`),i+1);}
 assert.equal(await continuous.locator('.cell-range-selection').count(),0);
 assert.equal(await continuous.locator('[data-node-id][data-cell-row="1"][aria-label^="Wire"]').count(),15);
 assert.equal(await continuous.locator('svg').evaluate(svg=>[...svg.querySelectorAll(':scope > g:first-of-type > line')].filter(l=>l.getAttribute('x1')===l.getAttribute('x2')&&l.getAttribute('y1')!=='20').length),1);
 await page.getByRole('button',{name:'Undo edit',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.editor-rung [data-node-id][data-cell-row="1"][aria-label^="Wire"]').length===14);
 await page.getByRole('button',{name:'Redo edit',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.editor-rung [data-node-id][data-cell-row="1"][aria-label^="Wire"]').length===15);
 if(mode){await page.locator('.editor-save-state').filter({hasText:/saved/}).waitFor();await page.reload();await page.getByRole('heading',{name:'Continuous wire acceptance',exact:true}).waitFor();assert.equal(await continuous.locator('[data-node-id][data-cell-row="1"][aria-label^="Wire"]').count(),15);await continuous.locator('[data-cell-row="1"][data-cell-column="18"]').first().click();}
 await stage.evaluate(el=>el.scrollLeft=0);await page.screenshot({path:`${shots}/continuous-wire-${mode}.png`,fullPage:true});console.log(`PASS continuous wire ${mode?'database':'local'} left-past-junction/right-past-sheet/single-highlight/Undo/Redo${mode?'/saved-reload':''}`);
 // Blank closed branches must not turn their inferred tail into a full-width wire.
 page.once('dialog',d=>d.accept('One block wire acceptance'));await page.getByRole('button',{name:'New project',exact:true}).click();await page.getByRole('heading',{name:'One block wire acceptance',exact:true}).waitFor();
 await page.evaluate(async()=>{const {useProjectStore}=await import('/PLC-LadderMCP/src/store.ts');const s=useProjectStore.getState(),p=structuredClone(s.project);p.programs[0].networks[0].root={kind:'series',id:'step-root',children:[{kind:'parallel',id:'step-group',branches:[{kind:'series',id:'step-top',children:Array.from({length:6},(_,i)=>({kind:'wire',id:`step-top-${i}`,connected:true}))},{kind:'series',id:'step-empty',children:[]}]}]};await s.editProject(p);});
 const stepRung=page.locator('.editor-rung').first();
 for(const [start,key,destination] of [[2,'Control+ArrowRight',3],[4,'Control+ArrowLeft',3],[1,'Control+ArrowLeft',0]]){
  await stepRung.locator(`[data-cell-row="1"][data-cell-column="${start}"]`).first().click();await stage.focus();await stage.press(key);
  await page.waitForFunction(column=>document.querySelector('.editor-statusbar').textContent.includes(`Row 2 · Column ${column}`),destination);
  assert.equal(await stepRung.locator('[data-node-id][data-cell-row="1"][aria-label^="Wire"]').count(),1);
  assert.equal(await stepRung.locator('svg').evaluate(svg=>[...svg.querySelectorAll(':scope > g:first-of-type > line')].filter(l=>l.getAttribute('y1')===l.getAttribute('y2') && l.getAttribute('y1')==='164').length),0);
  await page.getByRole('button',{name:'Undo edit',exact:true}).click();await stepRung.locator('[data-node-id="step-empty"]').waitFor();
 }
 console.log(`PASS one-block wire ${mode?'database':'local'} left/right/first-cell/blank-tail/Undo`);
 // User image: open lower row at column 2; Left must not add a suffix to columns on its right.
 page.once('dialog',d=>d.accept('Left tail acceptance'));await page.getByRole('button',{name:'New project',exact:true}).click();await page.getByRole('heading',{name:'Left tail acceptance',exact:true}).waitFor();
 await page.evaluate(async()=>{const {useProjectStore}=await import('/PLC-LadderMCP/src/store.ts');const s=useProjectStore.getState(),p=structuredClone(s.project);p.programs[0].networks[0].root={kind:'series',id:'left-root',children:[{kind:'contact',id:'left-contact',mode:'NO',device:{kind:'device',address:'X0'}},{kind:'wire',id:'left-prefix',connected:true},{kind:'parallel',id:'left-group',branches:[{kind:'series',id:'left-top',children:[{kind:'action',id:'left-out',action:{kind:'coil',id:'left-coil',device:{kind:'device',address:'Y0'}}},...Array.from({length:6},(_,i)=>({kind:'wire',id:`left-tail-${i}`,connected:true}))]},{kind:'series',id:'left-open',children:[],openEnd:true}]}]};await s.editProject(p);});
 const leftRung=page.locator('.editor-rung').first();await leftRung.locator('[data-cell-row="1"][data-cell-column="2"]').first().click();await stage.focus();await stage.press('Control+ArrowLeft');await page.waitForFunction(()=>document.querySelector('.editor-statusbar').textContent.includes('Row 2 · Column 1'));
 const assertLeftTail=async()=>{assert.equal(await leftRung.locator('[data-node-id][data-cell-row="1"][aria-label^="Wire"]').count(),1);assert.equal(await leftRung.locator('svg').evaluate(svg=>[...svg.querySelectorAll(':scope > g:first-of-type > line')].filter(l=>l.getAttribute('y1')===l.getAttribute('y2')&&l.getAttribute('y1')==='164').length),0);};
 await assertLeftTail();await page.getByRole('button',{name:'Undo edit',exact:true}).click();await leftRung.locator('[data-node-id][data-cell-row="1"][aria-label^="Wire"]').waitFor({state:'hidden'});await page.getByRole('button',{name:'Redo edit',exact:true}).click();await leftRung.locator('[data-node-id][data-cell-row="1"][aria-label^="Wire"]').waitFor();await assertLeftTail();
 if(mode){await page.locator('.editor-save-state').filter({hasText:/saved/}).waitFor();await page.reload();await page.getByRole('heading',{name:'Left tail acceptance',exact:true}).waitFor();await assertLeftTail();}
 await stage.evaluate(el=>el.scrollLeft=0);await page.screenshot({path:`${shots}/left-tail-${mode}.png`,fullPage:true});console.log(`PASS left tail ${mode?'database':'local'} one-left-cell/no-right-alignment-wire/Undo/Redo${mode?'/saved-reload':''}`);
 // Four-direction contract: each gesture changes one geometric cell, including tall legs.
 page.once('dialog',d=>d.accept('Single cell acceptance'));await page.getByRole('button',{name:'New project',exact:true}).click();await page.getByRole('heading',{name:'Single cell acceptance',exact:true}).waitFor();
 await page.evaluate(async()=>{const {useProjectStore}=await import('/PLC-LadderMCP/src/store.ts');const s=useProjectStore.getState(),p=structuredClone(s.project);p.programs[0].networks[0].root={kind:'parallel',id:'single-outer',branches:[{kind:'series',id:'single-tall',children:[{kind:'wire',id:'single-prefix',connected:true},{kind:'parallel',id:'single-inner',branches:[0,1,2].map(i=>({kind:'wire',id:`single-inner-${i}`,connected:true}))}]},{kind:'series',id:'single-bottom',children:[{kind:'wire',id:'single-bottom-wire',connected:true}]}]};await s.editProject(p);});
 const singleRung=page.locator('.editor-rung').first();
 const footprints=()=>page.evaluate(async()=>{const {useProjectStore}=await import('/PLC-LadderMCP/src/store.ts');const {layoutLadder}=await import('/PLC-LadderMCP/src/editor/layout.ts');const l=layoutLadder(useProjectStore.getState().project.programs[0].networks[0].root);return {h:l.cells.filter(c=>c.connected).map(c=>`${c.row}:${c.column}`).sort(),v:[...new Set(l.wires.filter(w=>w.x1===w.x2).map(w=>`${w.x1}:${w.y1}`))].sort()};});
 const difference=(a,b)=>a.filter(x=>!b.includes(x)).concat(b.filter(x=>!a.includes(x)));
 for(const [row,column,key,destRow,destColumn] of [[1,0,'ArrowDown',2,0],[2,0,'ArrowUp',1,0],[0,4,'ArrowLeft',0,3],[0,2,'ArrowRight',0,3]]){
  const before=await footprints();await singleRung.locator(`[data-cell-row="${row}"][data-cell-column="${column}"]`).first().click();await stage.focus();await stage.press(`Control+${key}`);
  await page.waitForFunction(({r,c})=>document.querySelector('.editor-statusbar').textContent.includes(`Row ${r+1} · Column ${c}`),{r:destRow,c:destColumn});
  const after=await footprints();const horizontal=key==='ArrowLeft'||key==='ArrowRight';assert.equal(difference(before[horizontal?'h':'v'],after[horizontal?'h':'v']).length,1);assert.deepEqual(after[horizontal?'v':'h'],before[horizontal?'v':'h']);
  await page.getByRole('button',{name:'Undo edit',exact:true}).click();await page.waitForFunction(async expected=>{const {useProjectStore}=await import('/PLC-LadderMCP/src/store.ts');const {layoutLadder}=await import('/PLC-LadderMCP/src/editor/layout.ts');const l=layoutLadder(useProjectStore.getState().project.programs[0].networks[0].root);const current={h:l.cells.filter(c=>c.connected).map(c=>`${c.row}:${c.column}`).sort(),v:[...new Set(l.wires.filter(w=>w.x1===w.x2).map(w=>`${w.x1}:${w.y1}`))].sort()};return JSON.stringify(current)===JSON.stringify(expected);},before);
 }
 if(mode){
  await singleRung.locator('[data-cell-row="1"][data-cell-column="0"]').first().click();await stage.focus();await stage.press('Control+ArrowDown');await page.waitForFunction(()=>document.querySelector('.editor-statusbar').textContent.includes('Row 3 · Column 0'));
  const saved=await footprints();await page.locator('.editor-save-state').filter({hasText:/saved/}).waitFor();await page.reload();await page.getByRole('heading',{name:'Single cell acceptance',exact:true}).waitFor();assert.deepEqual(await footprints(),saved);
  await singleRung.locator('[data-cell-row="2"][data-cell-column="0"]').first().click();await stage.focus();await stage.press('Control+ArrowUp');await page.waitForFunction(()=>document.querySelector('.editor-statusbar').textContent.includes('Row 2 · Column 0'));assert.equal(difference(saved.v,(await footprints()).v).length,1);
 }
 await page.screenshot({path:`${shots}/single-cell-${mode}.png`,fullPage:true});console.log(`PASS single cell ${mode?'database':'local'} Left/Right/Up/Down/tall-junction/Undo${mode?'/saved-reload':''}`);
 // User screenshot: only the moving cell cursor may remain highlighted.
 page.once('dialog',d=>d.accept('Cursor and reverse wire acceptance'));await page.getByRole('button',{name:'New project',exact:true}).click();await page.getByRole('heading',{name:'Cursor and reverse wire acceptance',exact:true}).waitFor();
 await page.evaluate(async()=>{const {useProjectStore}=await import('/PLC-LadderMCP/src/store.ts');const s=useProjectStore.getState(),p=structuredClone(s.project);p.programs[0].networks[0].root={kind:'series',id:'reverse-root',children:[{kind:'parallel',id:'reverse-group',branches:[{kind:'series',id:'reverse-top',children:Array.from({length:6},(_,i)=>({kind:'wire',id:`reverse-${i}`,connected:true}))},{kind:'series',id:'reverse-empty',children:[]}]}]};await s.editProject(p);});
 const reverseRung=page.locator('.editor-rung').first();
 const assertCursor=async(row,column)=>{assert.equal(await reverseRung.locator('.cell-cursor').count(),1);assert.equal(await reverseRung.locator('.cell-cursor').getAttribute('data-cursor-row'),String(row));assert.equal(await reverseRung.locator('.cell-cursor').getAttribute('data-cursor-column'),String(column));const highlights=await reverseRung.locator('svg').evaluate(svg=>[...svg.querySelectorAll('rect')].filter(r=>getComputedStyle(r).fill==='rgb(36, 62, 97)' || getComputedStyle(r).stroke==='rgb(37, 99, 235)'));assert.equal(highlights.length,1);};
 for(const [start,first,second,end] of [[3,'ArrowRight','ArrowLeft',4],[4,'ArrowLeft','ArrowRight',3]]){
  await reverseRung.locator(`[data-cell-row="1"][data-cell-column="${start}"]`).first().click();await stage.focus();await stage.press(`Control+${first}`);await page.waitForFunction(c=>document.querySelector('.cell-cursor')?.getAttribute('data-cursor-column')===String(c),end);await assertCursor(1,end);assert.equal(await reverseRung.locator('[data-node-id][data-cell-row="1"][aria-label^="Wire"]').count(),1);
  await stage.press(`Control+${second}`);await page.waitForFunction(c=>document.querySelector('.cell-cursor')?.getAttribute('data-cursor-column')===String(c),start);await assertCursor(1,start);assert.equal(await reverseRung.locator('[data-node-id][data-cell-row="1"][aria-label^="Wire"]').count(),0);
 }
 // Move from a focused old leaf with plain arrows; there is still only one main cursor.
 await reverseRung.locator('[data-node-id="reverse-3"]').first().click();await stage.focus();await stage.press('ArrowDown');await assertCursor(1,3);await stage.press('ArrowRight');await assertCursor(1,4);
 await page.getByRole('button',{name:'Undo edit',exact:true}).click();await reverseRung.locator('[data-node-id][data-cell-row="1"][aria-label^="Wire"]').waitFor();await assertCursor(1,4);await page.getByRole('button',{name:'Redo edit',exact:true}).click();await reverseRung.locator('[data-node-id][data-cell-row="1"][aria-label^="Wire"]').waitFor({state:'hidden'});await assertCursor(1,4);
 if(mode){await page.locator('.editor-save-state').filter({hasText:/saved/}).waitFor();await page.reload();await page.getByRole('heading',{name:'Cursor and reverse wire acceptance',exact:true}).waitFor();await reverseRung.locator('[data-cell-row="1"][data-cell-column="3"]').first().click();await stage.focus();await stage.press('Control+ArrowRight');await page.waitForFunction(()=>document.querySelector('.cell-cursor')?.getAttribute('data-cursor-column')==='4');await stage.press('Control+ArrowLeft');await page.waitForFunction(()=>document.querySelector('.cell-cursor')?.getAttribute('data-cursor-column')==='3');await assertCursor(1,3);assert.equal(await reverseRung.locator('[data-node-id][data-cell-row="1"][aria-label^="Wire"]').count(),0);}
 await page.screenshot({path:`${shots}/cursor-reverse-${mode}.png`,fullPage:true});console.log(`PASS cursor/reverse ${mode?'database':'local'} Right-Left/Left-Right/one-highlight/plain-arrows/Undo/Redo${mode?'/saved-reload':''}`);
 // User image pair: Right exits the existing return leg; it must not stretch that leg/coil.
 page.once('dialog',d=>d.accept('Right return acceptance'));await page.getByRole('button',{name:'New project',exact:true}).click();await page.getByRole('heading',{name:'Right return acceptance',exact:true}).waitFor();
 await page.evaluate(async()=>{const {useProjectStore}=await import('/PLC-LadderMCP/src/store.ts');const s=useProjectStore.getState(),p=structuredClone(s.project);p.programs[0].networks[0].root={kind:'series',id:'return-root',children:[{kind:'contact',id:'return-x',mode:'NO',device:{kind:'device',address:'X0'}},{kind:'parallel',id:'return-group',branches:[{kind:'action',id:'return-y',action:{kind:'coil',id:'return-coil',device:{kind:'device',address:'Y0'}}},{kind:'series',id:'return-row',children:Array.from({length:9},(_,i)=>({kind:'wire',id:`return-${i}`,connected:i===8,erased:i!==8}))}]}]};await s.editProject(p);});
 const returnRung=page.locator('.editor-rung').first();
 const returnGeometry=()=>page.evaluate(async()=>{const {useProjectStore}=await import('/PLC-LadderMCP/src/store.ts');const {layoutLadder}=await import('/PLC-LadderMCP/src/editor/layout.ts');const l=layoutLadder(useProjectStore.getState().project.programs[0].networks[0].root);return {v:l.wires.filter(w=>w.x1===w.x2),coil:l.nodes.find(n=>n.node.id==='return-y').x,filled:l.cells.filter(c=>c.row===1&&c.connected).map(c=>c.column)};});
 const originalReturn=await returnGeometry();
 // Reach the boundary cell while retaining the original left-facing segment.
 await returnRung.locator('[data-node-id="return-8"]').click();await stage.focus();await stage.press('Control+ArrowRight');await page.waitForFunction(()=>document.querySelector('.cell-cursor')?.getAttribute('data-cursor-column')==='10');await page.getByRole('button',{name:'Undo edit',exact:true}).click();await returnRung.locator('[data-node-id="return-8"][aria-label^="Wire"]').waitFor();
 await page.screenshot({path:`${shots}/return-before-${mode}.png`,fullPage:true});
 await stage.focus();await stage.press('Control+ArrowRight');await page.waitForFunction(()=>document.querySelector('.cell-cursor')?.getAttribute('data-cursor-column')==='11');await returnRung.locator('[data-cell-row="1"][data-cell-column="10"][aria-label^="Wire"]').waitFor();
 const extendedReturn=await returnGeometry();assert.deepEqual(extendedReturn.v,originalReturn.v);assert.equal(extendedReturn.coil,originalReturn.coil);assert.deepEqual(extendedReturn.filled,[9,10]);assert.equal(await returnRung.locator('.cell-cursor').count(),1);
 await page.screenshot({path:`${shots}/return-right-${mode}.png`,fullPage:true});
 await page.getByRole('button',{name:'Undo edit',exact:true}).click();await returnRung.locator('[data-cell-row="1"][data-cell-column="10"][aria-label^="Wire"]').waitFor({state:'hidden'});assert.deepEqual(await returnGeometry(),originalReturn);await page.getByRole('button',{name:'Redo edit',exact:true}).click();await returnRung.locator('[data-cell-row="1"][data-cell-column="10"][aria-label^="Wire"]').waitFor();assert.deepEqual(await returnGeometry(),extendedReturn);
 if(mode){await page.locator('.editor-save-state').filter({hasText:/saved/}).waitFor();await page.reload();await page.getByRole('heading',{name:'Right return acceptance',exact:true}).waitFor();assert.deepEqual(await returnGeometry(),extendedReturn);}
 await returnRung.locator('[data-cell-row="1"][data-cell-column="10"]').first().click();await stage.focus();await stage.press('ArrowRight');await stage.press('Control+ArrowLeft');await page.waitForFunction(()=>document.querySelector('.cell-cursor')?.getAttribute('data-cursor-column')==='10');assert.deepEqual((await returnGeometry()).filled,[9]);assert.deepEqual((await returnGeometry()).v,originalReturn.v);
 console.log(`PASS right return ${mode?'database':'local'} right-of-junction/fixed-leg/fixed-coil/one-cell/reverse-delete/Undo/Redo${mode?'/saved-reload':''}`);
 // Legacy Gap reproduction: one Delete leaves a genuinely empty rendered cell.
 page.once('dialog',d=>d.accept('Erase acceptance'));await page.getByRole('button',{name:'New project',exact:true}).click();await page.getByRole('heading',{name:'Erase acceptance',exact:true}).waitFor();
 await page.evaluate(async()=>{const {useProjectStore}=await import('/PLC-LadderMCP/src/store.ts');const s=useProjectStore.getState(),p=structuredClone(s.project);p.programs[0].networks[0].root={kind:'series',id:'erase-root',children:[{kind:'wire',id:'gap-a',connected:false},{kind:'wire',id:'gap-b',connected:false},{kind:'parallel',id:'gap-branch',branches:[{kind:'wire',id:'gap-top',connected:false},{kind:'wire',id:'gap-middle',connected:false},{kind:'wire',id:'gap-bottom',connected:false}]}]};await s.editProject(p);});
 const erasedRung=page.locator('.editor-rung').first(),oldGap=erasedRung.locator('[data-node-id="gap-a"]');await oldGap.getByText('Gap',{exact:true}).waitFor();
 await oldGap.click();await stage.focus();await stage.press('Delete');await oldGap.getByText('Gap',{exact:true}).waitFor({state:'hidden'});assert.equal(await oldGap.locator('line,circle,path').count(),0);assert.ok((await oldGap.getAttribute('aria-label')).startsWith('Empty cell'));
 await page.getByRole('button',{name:'Undo edit',exact:true}).click();await oldGap.getByText('Gap',{exact:true}).waitFor();
 await erasedRung.locator('[data-cell-row="0"][data-cell-column="0"]').first().click();await erasedRung.locator('[data-cell-row="2"][data-cell-column="9"]').first().click({modifiers:['Shift']});await stage.focus();await stage.press('Delete');
 await page.waitForFunction(()=>![...document.querySelectorAll('.editor-rung text')].some(n=>n.textContent==='Gap'));assert.equal(await erasedRung.locator('[data-node-id] line,[data-node-id] circle,[data-node-id] path').count(),0);assert.equal(await erasedRung.locator('svg').evaluate(svg=>svg.querySelectorAll(':scope > g:first-of-type > line').length),2);
 if(mode){await page.locator('.editor-save-state').filter({hasText:/saved/}).waitFor();await page.reload();await page.getByRole('heading',{name:'Erase acceptance',exact:true}).waitFor();assert.equal(await erasedRung.getByText('Gap',{exact:true}).count(),0);assert.equal(await erasedRung.locator('[data-node-id] line,[data-node-id] circle').count(),0);}
 await stage.evaluate(el=>el.scrollLeft=0);await page.screenshot({path:`${shots}/erase-blank-${mode}.png`,fullPage:true});console.log(`PASS erase ${mode?'database':'local'} legacy-Gap/one-Delete/no-glyphs/whole-branch-clear/Undo${mode?'/saved-reload':''}`);
 await page.setViewportSize({width:520,height:800}); await page.screenshot({path:`${shots}/editor-workspace-${mode}-520.png`,fullPage:true});
 await page.setViewportSize({width:1100,height:800}); await page.screenshot({path:`${shots}/editor-workspace-${mode}-1100.png`,fullPage:true});
 assert.deepEqual(errors,[]); console.log(`PASS browser ${mode?'PostgreSQL':'local'} insert/properties/branch/networks/clipboard/cut-identity/dialog/context-menu/duplicate/find/navigation/undo/redo/keyboard/zoom/cell-grid/coil-wires/ctrl-arrow-wires${mode?'/reload':'/old-backend-error'}`); await context.close();
}
console.log('Browser QA screenshots: '+shots);
}finally{await browser?.close();await vite.close();for(const s of servers)await new Promise(r=>s.close(r));await db.destroy();await rm(temp,{recursive:true,force:true});}
