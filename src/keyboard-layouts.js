"use strict";

const SCHEMA_VERSION = 1;
const MAX_LAYERS = 12;
const MAX_ROWS = 8;
const MAX_KEYS_PER_ROW = 24;
const MAX_LABEL_LENGTH = 18;

function key(label, shift, width) {
  return {label, shift: shift || "", width: width || 1};
}

function placed(label, x, y, width, shift, altGr, shiftAltGr) {
  return {label, x, y, width: width || 0.9, height: 0.88, shift: shift || "", altGr: altGr || "", shiftAltGr: shiftAltGr || ""};
}

const REMNANT_POSITIONS = [
  ...[0, 1, 2, 3, 4, 5, 11, 12, 13, 14, 15, 16].map(x => [x, 0]),
  ...[0, 1, 2, 3, 4, 5, 11, 12, 13, 14, 15, 16].map(x => [x, 1]),
  ...[0, 1, 2, 3, 4, 5, 11, 12, 13, 14, 15, 16].map(x => [x, 2]),
  ...[0, 1, 2, 3, 4, 5, 11, 12, 13, 14, 15, 16].map(x => [x, 3]),
  ...[[2, 4], [3, 4], [5, 4], [6, 4], [7, 4], [9, 4], [10, 4], [11, 4], [13, 4], [14, 4], [6, 5], [7, 5], [9, 5], [10, 5]]
];

function remnantLayer(id, name, labels) {
  const columnDrop = {0: 0.30, 1: 0.18, 2: 0.06, 3: 0, 4: 0.09, 5: 0.22, 11: 0.22, 12: 0.09, 13: 0, 14: 0.06, 15: 0.18, 16: 0.30};
  const thumbDrop = {2: 0.16, 3: 0.16, 5: 0.10, 6: 0.20, 7: 0.30, 9: 0.30, 10: 0.20, 11: 0.10, 13: 0.16, 14: 0.16};
  return {id, name, bounds: {width: 17, height: 5.45}, keys: REMNANT_POSITIONS.slice(0, 58).map((position, index) => {
    const label = labels[index] || "";
    const parts = Array.isArray(label) ? label : String(label || "").split("|");
    const offset = position[1] < 4 ? columnDrop[position[0]] : thumbDrop[position[0]];
    return placed(parts[0], position[0], position[1] + offset, 0.9, parts[1]);
  })};
}

const blank = "";
const ENGRAMMER = {
  schemaVersion: SCHEMA_VERSION,
  id: "engrammer",
  name: "Engrammer Remnant",
  description: "Engrammer on the split 5x6+5 Remnant, with Miryoku layers",
  layers: [
    remnantLayer("base", "Base", [
      "`|~","1|!","2|@","3|#","4|$","5|%", "6|^","7|&","8|*","9|(","0|)","=|+",
      ["\\", "|"],"B","Y","O","U","'|\"", ";|:","L","D","W","V","Z",
      "Caps word","C|Win","I|Alt","E|Ctrl","A|Shift",",|<", ".|>","H|Shift","T|Ctrl","S|Alt","N|Win","Q",
      "Shift","G","X|AltGr","J","K","-|_", "/|?","R","M","F|AltGr","P","Shift",
      "Page up","Page down","Backspace|Cursor","Delete|Number","Escape|Function", "Enter|System","Tab|Mouse","Space|Symbol","[|{","]|}", "Left","Right","Down","Up"
    ]),
    remnantLayer("cursor", "Cursor", [
      "Reset",blank,blank,blank,blank,"EEPROM reset", blank,blank,"Redo","Undo",blank,blank,
      blank,blank,blank,blank,blank,blank, "Cut","Backspace","Undo","Redo","Delete","Insert",
      "Caps lock","Win","Alt","Ctrl","Shift",blank, "Copy","Left","Up","Down","Right","Print screen",
      "Sticky layer",blank,"AltGr",blank,blank,"Debug", "Paste","Home","Page up","Page down","End","Find & replace",
      blank,blank,"Cursor",blank,blank, "Select URL","Select all","Select word","Find","Find next", blank,blank,blank,blank
    ]),
    remnantLayer("number", "Number", [
      "Reset",blank,blank,blank,blank,"EEPROM reset", "~","^","#","$","@","!",
      blank,blank,blank,blank,blank,blank, "%","7","8","9",":","<",
      "Num lock","Win","Alt","Ctrl","Shift",blank, "+","4","5","6","-",">",
      "Sticky layer",blank,blank,blank,blank,"Debug", "*","1","2","3","/","=",
      blank,blank,blank,"Number",blank, ",",".","0","(",")", blank,blank,"Enter","Tab"
    ]),
    remnantLayer("function", "Function", [
      "Reset",blank,blank,blank,blank,"EEPROM reset", "Media","Play","Previous","Next","Stop","Eject",
      blank,blank,blank,blank,blank,blank, "Wheel home","F7","F8","F9","F10","F13",
      "Scroll lock","Win","Alt","Ctrl","Shift",blank, "Calculator","F4","F5","F6","F11","F14",
      "Sticky layer",blank,blank,blank,blank,"Debug", "Computer","F1","F2","F3","F12","F15",
      blank,blank,blank,blank,"Function", "Mute","Volume -","Volume +","Bright -","Bright +", blank,blank,blank,blank
    ]),
    remnantLayer("symbol", "Symbol", [
      "~",",","(",")",";","?", "EEPROM reset",blank,blank,blank,blank,"Reset",
      "@","{","\"","'","}",".", blank,blank,blank,blank,blank,blank,
      "#","^","=","_","$","*", blank,"Shift","Ctrl","Alt","Win",blank,
      "!","<",["|", ""],"-",">","/", "Debug",blank,blank,blank,blank,"Sticky layer",
      "&","+","\\",":","%", blank,blank,"Symbol","[","]", ",",".",blank,blank
    ]),
    remnantLayer("mouse", "Mouse", [
      blank,blank,blank,blank,blank,blank, "EEPROM reset",blank,blank,blank,blank,"Reset",
      blank,"Accel 2","Wheel left","Mouse up","Wheel right",blank, blank,blank,blank,blank,blank,blank,
      blank,"Accel 0","Mouse left","Mouse down","Mouse right",blank, blank,"Shift","Ctrl","Alt","Win",blank,
      blank,"Accel 1","Ctrl","Button 4","Button 5",blank, "Debug",blank,blank,blank,blank,"Sticky layer",
      "Wheel up","Wheel down","Button 1","Button 2","Button 3", blank,"Mouse",blank,blank, blank,blank,blank,blank
    ]),
    remnantLayer("system", "System", [
      "Power",blank,blank,blank,blank,blank, "EEPROM reset",blank,blank,blank,blank,"Reset",
      "RGB X",blank,blank,blank,"RGB twinkle","RGB rainbow", blank,blank,blank,blank,blank,blank,
      "RGB knight","RGB -","RGB mode -","RGB mode +","RGB +","RGB gradient", blank,"Shift","Ctrl","Alt","Win",blank,
      "RGB plain","Sat -","Hue -","Hue +","Sat +","RGB breathe", "Debug",blank,blank,blank,blank,"Sticky layer",
      "Wake","Sleep","Screenshot","Pause","RGB toggle", "System",blank,blank,blank, blank,blank,"Layer 7","Layer 8",blank
    ])
  ]
};

ENGRAMMER.layers[0].layerThumbKeys = [50, 51, 52, 53, 54, 55];
ENGRAMMER.layers.slice(1).forEach((layer, offset) => {
  layer.layerThumbKeys = [[50, 51, 52, 55, 54, 53][offset]];
});

function qwertyKeys() {
  const keys = [];
  const add = (label, x, y, width, shift) => keys.push(placed(label, x, y, width, shift));
  [["Esc",0],["F1",2],["F2",3],["F3",4],["F4",5],["F5",6.5],["F6",7.5],["F7",8.5],["F8",9.5],["F9",11],["F10",12],["F11",13],["F12",14],["Print",15.5],["Scroll",16.5],["Pause",17.5]].forEach(v => add(v[0],v[1],0));
  [["`",0,"~"],["1",1,"!"],["2",2,"@"],["3",3,"#"],["4",4,"$"],["5",5,"%"],["6",6,"^"],["7",7,"&"],["8",8,"*"],["9",9,"("],["0",10,")"],["-",11,"_"],["=",12,"+"]].forEach(v => add(v[0],v[1],1,0.9,v[2])); add("Backspace",13,1,1.9); add("Insert",15.5,1); add("Home",16.5,1); add("Page up",17.5,1); add("Num lock",19,1); add("/",20,1); add("*",21,1); add("-",22,1);
  add("Tab",0,2,1.4); "QWERTYUIOP".split("").forEach((c,i)=>add(c,1.5+i,2)); add("[",11.5,2,0.9,"{"); add("]",12.5,2,0.9,"}"); add("\\",13.5,2,1.4,"|"); add("Delete",15.5,2); add("End",16.5,2); add("Page down",17.5,2); ["7","8","9"].forEach((c,i)=>add(c,19+i,2)); add("+",22,2,0.9);
  add("Caps lock",0,3,1.7); "ASDFGHJKL".split("").forEach((c,i)=>add(c,1.8+i,3)); add(";",10.8,3,0.9,":"); add("'",11.8,3,0.9,"\""); add("Enter",12.8,3,2.1); ["4","5","6"].forEach((c,i)=>add(c,19+i,3));
  add("Shift",0,4,2.2); "ZXCVBNM".split("").forEach((c,i)=>add(c,2.3+i,4)); add(",",9.3,4,0.9,"<"); add(".",10.3,4,0.9,">"); add("/",11.3,4,0.9,"?"); add("Shift",12.3,4,2.7); add("Up",16.5,4); ["1","2","3"].forEach((c,i)=>add(c,19+i,4)); add("Enter",22,4);
  add("Ctrl",0,5,1.3); add("Win",1.4,5,1.2); add("Alt",2.7,5,1.2); add("Space",4,5,6.1); add("Alt",10.2,5,1.2); add("Win",11.5,5,1.2); add("Menu",12.8,5,1); add("Ctrl",13.9,5,1.1); add("Left",15.5,5); add("Down",16.5,5); add("Right",17.5,5); add("0",19,5,1.9); add(".",21,5); add("Enter",22,5);
  return keys;
}

const QWERTY = {
  schemaVersion: SCHEMA_VERSION,
  id: "qwerty",
  name: "QWERTY",
  description: "Full-size standard US ANSI keyboard",
  layers: [{
    id: "base",
    name: "Base",
    bounds: {width: 23, height: 6},
    keys: qwertyKeys()
  }]
};

function letterLayout(id, name, top, home, bottom) {
  const layout = JSON.parse(JSON.stringify(QWERTY));
  layout.id = id;
  layout.name = name;
  layout.description = name + " on a full-size ANSI keyboard";
  const rows = [{y: 2, start: 1.5, labels: top}, {y: 3, start: 1.8, labels: home}, {y: 4, start: 2.3, labels: bottom}];
  for (const row of rows) {
    const keys = layout.layers[0].keys.filter(item => item.y === row.y && item.x >= row.start && item.x < row.start + row.labels.length);
    keys.sort((a, b) => a.x - b.x);
    row.labels.split("").forEach((label, index) => { if (keys[index]) keys[index].label = label.toUpperCase(); });
  }
  return layout;
}

function germanQwertz() {
  const layout = letterLayout("qwertz", "German QWERTZ", "QWERTZUIOP", "ASDFGHJKL", "YXCVBNM");
  layout.description = "German QWERTZ on a full-size ISO-style keyboard";
  const keys = layout.layers[0].keys;
  const set = (x, y, label, shift, altGr, shiftAltGr) => {
    const target = keys.find(item => item.x === x && item.y === y);
    if (target) { target.label = label; target.shift = shift || ""; target.altGr = altGr || ""; target.shiftAltGr = shiftAltGr || ""; }
  };
  [[0,"^","°","′","″"],[1,"1","!","¹","¡"],[2,"2","\"","²","⅛"],[3,"3","§","³","£"],[4,"4","$","¼","¤"],[5,"5","%","½","⅜"],[6,"6","&","¬","⅝"],[7,"7","/","{","⅞"],[8,"8","(","[","™"],[9,"9",")","]","±"],[10,"0","=","}","°"],[11,"ß","?","\\","¿"],[12,"´","`","◌̧","◌̨"]].forEach(item => set(item[0], 1, item[1], item[2], item[3], item[4]));
  [[1.5,"Q","Q","@","Ω"],[2.5,"W","W","ſ","§"],[3.5,"E","E","€","€"],[4.5,"R","R","¶","®"],[5.5,"T","T","ŧ","Ŧ"],[6.5,"Z","Z","←","¥"],[7.5,"U","U","↓","↑"],[8.5,"I","I","→","ı"],[9.5,"O","O","ø","Ø"],[10.5,"P","P","þ","Þ"],[11.5,"Ü","Ü","◌̈","◌̊"],[12.5,"+","*","~","¯"],[13.5,"#","'","’","◌̆"]].forEach(item => set(item[0], 2, item[1], item[2], item[3], item[4]));
  [[1.8,"A","A","æ","Æ"],[2.8,"S","S","ſ","ẞ"],[3.8,"D","D","ð","Ð"],[4.8,"F","F","đ","ª"],[5.8,"G","G","ŋ","Ŋ"],[6.8,"H","H","ħ","Ħ"],[7.8,"J","J","◌̣","◌̇"],[8.8,"K","K","ĸ","&"],[9.8,"L","L","ł","Ł"],[10.8,"Ö","Ö","◌̋","◌̣"],[11.8,"Ä","Ä","◌̂","◌̌"]].forEach(item => set(item[0], 3, item[1], item[2], item[3], item[4]));
  [[2.3,"Y","Y","»","›"],[3.3,"X","X","«","‹"],[4.3,"C","C","¢","©"],[5.3,"V","V","„","‘"],[6.3,"B","B","“","‘"],[7.3,"N","N","”","’"],[8.3,"M","M","µ","º"],[9.3,",",";","·","×"],[10.3,".",":","…","÷"],[11.3,"-","_","–","—"]].forEach(item => set(item[0], 4, item[1], item[2], item[3], item[4]));
  const leftShift = keys.find(item => item.label === "Shift" && item.x === 0 && item.y === 4);
  leftShift.width = 1.2;
  keys.push(placed("<", 1.3, 4, 0.9, ">", "|", "◌̱"));
  const rightAlt = keys.find(item => item.label === "Alt" && item.x === 10.2 && item.y === 5);
  rightAlt.label = "AltGr";
  return layout;
}

const QWERTZ = germanQwertz();
const AZERTY = letterLayout("azerty", "AZERTY", "AZERTYUIOP", "QSDFGHJKLM", "WXCVBN");
const DVORAK = letterLayout("dvorak", "Dvorak", "',.PYFGCRL", "AOEUIDHTNS", ";QJKXBMWVZ");
const COLEMAK = letterLayout("colemak", "Colemak", "QWFPGJLUY", "ARSTDHNEIO", "ZXCVBKM");
const WORKMAN = letterLayout("workman", "Workman", "QDRWBJFUP", "ASHTGYNEOI", "ZXMCVKL");

const BUILT_INS = [QWERTY, QWERTZ, AZERTY, DVORAK, COLEMAK, WORKMAN, ENGRAMMER];

function boundedString(value, fallback, maximum = 64) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum ? value.trim() : fallback;
}

function normalizeKey(value) {
  if (typeof value === "string") value = {label: value};
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const label = boundedString(value.label, "", MAX_LABEL_LENGTH);
  if (!label) return null;
  const shift = value.shift === undefined || value.shift === "" ? "" : boundedString(value.shift, "", MAX_LABEL_LENGTH);
  const altGr = value.altGr === undefined || value.altGr === "" ? "" : boundedString(value.altGr, "", MAX_LABEL_LENGTH);
  const shiftAltGr = value.shiftAltGr === undefined || value.shiftAltGr === "" ? "" : boundedString(value.shiftAltGr, "", MAX_LABEL_LENGTH);
  const width = typeof value.width === "number" && Number.isFinite(value.width)
    ? Math.max(0.5, Math.min(8, value.width)) : 1;
  return {label, shift, altGr, shiftAltGr, width};
}

function normalizeLayer(value, index) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Array.isArray(value.rows)
      || value.rows.length < 1 || value.rows.length > MAX_ROWS) return null;
  const rows = [];
  for (const row of value.rows) {
    if (!Array.isArray(row) || row.length < 1 || row.length > MAX_KEYS_PER_ROW) return null;
    const keys = row.map(normalizeKey);
    if (keys.some(candidate => candidate === null)) return null;
    rows.push(keys);
  }
  return {
    id: boundedString(value.id, "layer-" + (index + 1), 48),
    name: boundedString(value.name, "Layer " + (index + 1), 48),
    rows
  };
}

function normalize(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schemaVersion !== SCHEMA_VERSION
      || !Array.isArray(value.layers) || value.layers.length < 1 || value.layers.length > MAX_LAYERS) return null;
  const layers = value.layers.map(normalizeLayer);
  if (layers.some(layer => layer === null)) return null;
  return {
    schemaVersion: SCHEMA_VERSION,
    id: "custom",
    name: boundedString(value.name, "Custom layout", 64),
    description: boundedString(value.description, "Imported from omatype-keyboard.json", 160),
    layers
  };
}

function parse(text) {
  if (typeof text !== "string" || text.length === 0) return {status: "absent", value: null};
  try {
    const value = normalize(JSON.parse(text));
    return value ? {status: "ready", value} : {status: "invalid", value: null};
  } catch (_error) {
    return {status: "invalid", value: null};
  }
}

function options(customLayout) {
  const values = BUILT_INS.map(layout => ({id: layout.id, name: layout.name}));
  if (customLayout) values.push({id: "custom", name: customLayout.name});
  return values;
}

function get(id, customLayout) {
  if (id === "custom" && customLayout) return customLayout;
  return BUILT_INS.find(layout => layout.id === id) || QWERTY;
}

const api = {SCHEMA_VERSION, QWERTY, QWERTZ, AZERTY, DVORAK, COLEMAK, WORKMAN, ENGRAMMER, BUILT_INS, normalize, parse, options, get};
if (typeof module !== "undefined" && module.exports) module.exports = api;
