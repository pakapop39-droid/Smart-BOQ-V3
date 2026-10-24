// Validate a UI draft using the existing catalog save/yield rules, then roll back.
export function previewCatalogDraft(store,data){return store.tx(()=>{
 store.db.exec('SAVEPOINT catalog_ui_draft');
 try{const resource=store.save('cost_resources',data);return {resource,snapshot:store.snapshot(resource)};}
 finally{store.db.exec('ROLLBACK TO catalog_ui_draft; RELEASE catalog_ui_draft');}
});}
