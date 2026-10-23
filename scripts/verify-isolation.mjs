import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const base=JSON.parse(fs.readFileSync('../outputs/new-system-phase1-20261023/legacy-file-baseline.json','utf8'));
const drift=Object.entries(base.files).filter(([f,h])=>{const p=path.join(base.root,f);return !fs.existsSync(p)||hash(fs.readFileSync(p))!==h;}).map(([f])=>f);
const masterUnchanged=hash(fs.readFileSync('../Smart-BOQ-Master-v1.md'))===base.masterSha256;
const linked=JSON.parse(fs.readFileSync('.insforge/project.json','utf8'));
if(linked.project_id!=='e735280a-6e3b-43ce-b60e-fa6c330b32e8')throw Error('Non-test target');
const links=[];for(const f of ['README.md','docs/MASTER.md','docs/DESIGN.md','docs/CATALOG-EXCEL.md','docs/PHASE-2-REPORT.md']){
 for(const m of fs.readFileSync(f,'utf8').matchAll(/\]\(([^)]+)\)/g)){const t=m[1].split('#')[0];if(t&&!/^https?:/.test(t)&&!fs.existsSync(path.resolve(path.dirname(f),t)))links.push({file:f,target:t});}
}
const report={checkedAt:new Date().toISOString(),newTestProject:linked.project_id,legacyFilesChecked:Object.keys(base.files).length,legacyFileDrift:drift,originalMasterUnchanged:masterUnchanged,brokenDocumentLinks:links,scope:'Local legacy bytes and source Master only; no queries or mutations against legacy cloud',status:drift.length===0&&masterUnchanged&&links.length===0?'PASS':'REVIEW_REQUIRED'};
fs.writeFileSync('artifacts/isolation-check.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(report.status!=='PASS')process.exitCode=1;
