// Navigate the same paginated controls a player uses; never wheel-scroll a test.
export async function revealResource(page,id){
  if(!await page.locator('[data-node="'+id+'"]').count()){
    const first=page.locator('[data-pagination="resources"] [data-list-index="0"]').first();
    if(await first.count()&&!await first.isDisabled())await first.click();
    for(let i=0;i<30&&!await page.locator('[data-node="'+id+'"]').count();i++){
      const next=page.locator('[data-pagination="resources"] button').last();
      if(!await next.count()||await next.isDisabled())throw Error('Resource node is unavailable: '+id);
      await next.click();
    }
  }
  await page.locator('[data-node-id="'+id+'"][data-node-view="manual"]').click();
}
export async function pickOption(page,selector,value){
  const target=await page.locator(selector).evaluate((select,value)=>{
    const index=[...select.options].findIndex(option=>option.value===value);
    if(index<0)throw Error('Missing select option: '+value);
    return {index,text:select.options[index].text};
  },value);
  await page.locator(selector+'+button').click();
  await page.locator('#choiceSearch').fill(target.text);
  await page.locator('[data-choice-option="'+target.index+'"]').click();
}
export async function checkLastDrop(page,expect,text){
  await page.locator('[data-show-drops]').click();
  await expect(page.locator('[data-last-drops]')).toContainText(text);
  await page.locator('[data-action="close-modal"]').click();
}
