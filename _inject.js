const fs = require('fs');
const htmlPath = 'C:\\Users\\毕东昇\\Desktop\\集训\\知识竞赛\\刷题.html';
const exd = fs.readFileSync('C:\\Users\\毕东昇\\Desktop\\集训\\知识竞赛\\exd.js', 'utf8');
// 校验 exd.js 语法
new Function(exd);
let html = fs.readFileSync(htmlPath, 'utf8');
if (html.includes('const EXD=')) { console.log('EXD already injected, replacing'); 
  html = html.replace(/<script>\n\/\/ 知识点详解[\s\S]*?<\/script>\n/, '');
}
const anchor = '<script>\r\n"use strict";';
if (!html.includes(anchor)) throw new Error('anchor not found');
html = html.replace(anchor, '<script>\n' + exd.trimEnd() + '\n</' + 'script>\n' + anchor);
fs.writeFileSync(htmlPath, html);
console.log('injected ok');
