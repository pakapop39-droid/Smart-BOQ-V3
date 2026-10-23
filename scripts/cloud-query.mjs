import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
export const EXPECTED_PROJECT='e735280a-6e3b-43ce-b60e-fa6c330b32e8';
export function query(sql,{allowFailure=false}={}){
 const linked=JSON.parse(fs.readFileSync('.insforge/project.json','utf8'));
 if(!Object.values(linked).includes(EXPECTED_PROJECT))throw Error('Refusing non-test project');
 const encoded=Buffer.from(sql,'utf8').toString('base64');
 const cmd=`$boqSql=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')); npx -y @insforge/cli db query $boqSql --json; exit $LASTEXITCODE`;
 try{return JSON.parse(execFileSync('pwsh',['-NoProfile','-Command',cmd],{encoding:'utf8',maxBuffer:12*1024*1024}));}
 catch(e){const message=String(e.stderr||'')+String(e.stdout||'');if(allowFailure)return {failed:true,message};throw Error(message);}
}
