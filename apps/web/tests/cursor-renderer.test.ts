import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {LadderRenderer} from '../src/editor/LadderRenderer';
import {GRID_X,COLUMN_WIDTH} from '../src/editor/layout';
import type {LogicNode} from '@plc-ladder-mcp/ladder-ir';
const root:LogicNode={kind:'series',id:'root',children:[{kind:'parallel',id:'branch',branches:[{kind:'wire',id:'old-wire',connected:true},{kind:'series',id:'old-empty',children:[]}]}]};
test('one cursor replaces the old node/empty-container highlight after moving between cells',()=>{
 const html=renderToStaticMarkup(React.createElement(LadderRenderer,{root,selectedId:'old-wire',cursor:{row:1,column:5},onSelect:()=>{},theme:'dark'}));
 assert.equal((html.match(/class="cell-cursor"/g)??[]).length,1);
 assert.equal((html.match(/fill="#243e61"/g)??[]).length,1);
 assert.ok(html.includes('data-cursor-row="1" data-cursor-column="5"'));
 assert.ok(!html.includes('aria-pressed="true"'));
});
test('cursor at the next cell after the sheet edge is visible without highlighting the previous wire',()=>{
 const p:LogicNode={kind:'series',id:'edge-root',children:Array.from({length:10},(_,i)=>({kind:'wire',id:`edge-${i}`,connected:true}))};
 const html=renderToStaticMarkup(React.createElement(LadderRenderer,{root:p,selectedId:'edge-9',cursor:{row:0,column:10},onSelect:()=>{},theme:'dark'}));
 assert.equal((html.match(/class="cell-cursor"/g)??[]).length,1);
 assert.ok(html.includes(`width="${GRID_X*2+11*COLUMN_WIDTH}"`));
 assert.ok(html.includes('data-cell-column="10"'));
 assert.ok(!html.includes('aria-pressed="true"'));
});
