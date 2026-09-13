// Browser facilities only. No bot decision logic.
export function trainingEnvironment(io) {
  const storage = () => {
    const values = new Map();
    return { getItem: k => values.get(k) ?? null, setItem: (k,v) => values.set(k,String(v)), removeItem: k => values.delete(k) };
  };
  const elements = new Map();
  const element = () => ({ value:'', textContent:'', innerHTML:'', style:{}, dataset:{}, checked:false,
    addEventListener(){}, appendChild(){}, remove(){}, focus(){}, scrollIntoView(){},
    classList:{add(){},remove(){},toggle(){}}, querySelectorAll(){return [];} });
  const document = {getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);},
    querySelector(){return null;},querySelectorAll(){return [];},createElement:element};
  const fetch = io.fetch || (() => {throw new Error('Training engine fetch adapter missing');});
  return {document,localStorage:storage(),sessionStorage:storage(),location:{pathname:'',search:'',hash:''},history:{replaceState(){}},fetch,
    window:{crypto:globalThis.crypto,sbFetch:io.sbFetch || (() => {throw new Error('Training database adapter missing');})}};
}
