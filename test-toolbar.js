const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('node:assert/strict');
const code = fs.readFileSync(path.join(__dirname, 'api', 'implementation.js'), 'utf8');
const context = {
  console,
  Ci: { nsMsgFolderFlags: { Virtual: 0x0020 }, nsIMsgSearchNotify: Symbol('notify') },
  ExtensionCommon: { ExtensionAPI: class {} }
};
vm.createContext(context);
vm.runInContext(code, context);
const element = {
  style: { minWidth: '' },
  rendered: 116.4,
  getAttribute(name) { return name === 'extension' ? 'recursive-folder-view-prototype@local' : null; },
  getBoundingClientRect() { return {width: this.rendered}; }
};
const doc = {
  getElementById(id) {return id === 'unifiedToolbarContent' ? {
    querySelectorAll(s) { return s === '[extension]' ? [element] : []; }
  } : null;}
};
const tab = {chromeBrowser:{ownerDocument:doc}};
context.stabilizeActionButton(tab,'recursive-folder-view-prototype@local');
assert.equal(element.style.minWidth,'117px');
element.rendered=106.1;
context.stabilizeActionButton(tab,'recursive-folder-view-prototype@local');
assert.equal(element.style.minWidth,'117px');
console.log('PASS — measured OFF button width retained through ON state');
