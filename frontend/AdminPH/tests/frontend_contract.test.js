const fs=require('fs');
const s=fs.readFileSync('js/app.js','utf8');
const checks=[
 ['convocatoriaActual state', /convocatoriaActual\s*:\s*1/],
 ['quorum first', /quorumPrimeraPorcentaje/],
 ['quorum second', /quorumSegundaPorcentaje/],
 ['informative varios storage', /variosInformativosAsamblea/],
 ['informative PDF label', /PDF informativo/i],
 ['next destination council', /Consejo de Administración/],
 ['next destination assembly', /Siguiente Asamblea/],
 ['owner reference', /Copropietario \/ solicitante/]
];
let failed=0;
for(const [name,re] of checks){ if(!re.test(s)){console.error('FAIL',name); failed++;} else console.log('PASS',name); }
process.exit(failed?1:0);
