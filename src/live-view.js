// Avoid invalidating text layout, SVG filters and material backgrounds when the
// simulation tick has not changed what the player can actually see.
export function updateText(element,value){
  const text=String(value);
  if(element&&element.textContent!==text)element.textContent=text;
}
export function updateDisabled(element,value){
  if(element&&element.disabled!==!!value)element.disabled=!!value;
}
export function updateAttribute(element,name,value){
  const text=String(value);
  if(element&&element.getAttribute(name)!==text)element.setAttribute(name,text);
}
export function updatePercent(element,property,value){
  if(!element)return;
  const percent=Math.round(Math.max(0,Math.min(100,Number(value)||0))*1000)/1000+'%';
  if(element.style[property]!==percent)element.style[property]=percent;
}
