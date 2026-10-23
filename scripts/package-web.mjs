import fs from 'node:fs';import path from 'node:path';
const files=['index.html','vite.config.mjs','web/main.mjs','web/cost-editor.mjs','web/catalog-model.mjs','web/catalog-ui.mjs','web/local-draft.mjs','web/style.css','web/fixtures.mjs','web/public-config.mjs','lib/catalog-excel.mjs','lib/live-calculator.mjs'];
const deps={};for(const name of ['@insforge/sdk','buffer','exceljs','vite','decimal.js'])deps[name]=JSON.parse(fs.readFileSync(path.join('node_modules',name,'package.json'),'utf8')).version;
const pkg={name:'smart-boq-new-test-web',version:'0.1.0',private:true,type:'module',scripts:{build:'vite build'},dependencies:deps,overrides:{uuid:'11.1.1'}};
const payload=files.map(file=>({file,data:fs.readFileSync(file,'utf8'),encoding:'utf-8'}));payload.push({file:'package.json',data:JSON.stringify(pkg),encoding:'utf-8'});
process.stdout.write(JSON.stringify(payload));
