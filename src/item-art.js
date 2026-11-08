import {ICON_GAPS} from './data/icon-gaps.js';

// A visibly unknown icon is preferable to a different material's artwork.
// Keep this shared by recipes, selectors, readouts, and container/device groups.
export function itemIconMissing(item,id) {
  return !id||ICON_GAPS.has(item?.icon||id);
}
export function itemIconPath(item,id) {
  return itemIconMissing(item,id)?'assets/ui/item-unavailable.svg':`assets/gtnh/${encodeURIComponent(item?.icon||id)}.svg`;
}
export function itemIconTitle(item,id) {
  return itemIconMissing(item,id)?`${item?.name||'物品'}：暂无图标`:'';
}
const escape=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function itemImage(item,id) {
  const title=itemIconTitle(item,id);
  return `<img src="${itemIconPath(item,id)}" alt=""${title?` title="${escape(title)}"`:''} draggable="false">`;
}
