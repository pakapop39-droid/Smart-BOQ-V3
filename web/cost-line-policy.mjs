// Charged rows are removed, never switched off in an editor.
export const isCostLineTable=table=>['rate_template_cost_lines','component_cost_lines'].includes(table);
export const selectedCostActive=(table,form)=>isCostLineTable(table)?true:form.elements.is_active.checked;
