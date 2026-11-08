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
// Exercise both the outer resource pager and every part of an automatic card.
export async function checkCollectorLayout(page,expect,{deployed=false}={}){
  const fit=async()=>{
    const outside=await page.locator('#page').evaluate(root=>{
      const box=root.getBoundingClientRect();
      return [...root.querySelectorAll('button,input,.surface')].filter(el=>el.getClientRects().length)
        .filter(el=>{const r=el.getBoundingClientRect();return r.left<box.left-1||r.right>box.right+1||r.top<box.top-1||r.bottom>box.bottom+1;})
        .map(el=>el.textContent.trim().slice(0,60));
    });
    expect(outside,'automatic collector and resource pagination must fit').toEqual([]);
  };
  for(const id of ['forest','surface']){
    await revealResource(page,id);
    await page.locator(`[data-node-id="${id}"][data-node-view=auto]`).click();
    await fit();
    const card=page.locator(`[data-node="${id}"]`);
    const show=async selector=>{
      const back=card.locator('[data-mobile-panel-step="-1"]');
      while(await back.count()&&!await back.isDisabled())await back.click();
      const next=card.locator('[data-mobile-panel-step="1"]');
      for(let i=0;i<20&&!await card.locator(selector).first().isVisible();i++){
        expect(await next.count(),'hidden collector control needs content pagination').toBe(1);
        expect(await next.isDisabled()).toBe(false);await next.click();await fit();
      }
      await expect(card.locator(selector).first()).toBeVisible();await fit();
    };
    await show('[data-collector]');
    await show('[data-node-details]');await card.locator('[data-node-details]').click();
    await expect(page.locator('#modal')).toContainText('每轮掉落范围');await page.locator('[data-action=close-modal]').click();
    if(deployed&&id==='forest'){
      await show('[data-toggle-collector]');await card.locator('[data-toggle-collector]').click();
      await show('[data-toggle-collector]');await expect(card.locator('[data-toggle-collector]')).toHaveText('恢复采集');
      await card.locator('[data-toggle-collector]').click();
      await show('[data-worker-count="2"]');await card.locator('[data-worker-count="2"]').click();
      await show('[data-worker-count="3"]');await expect(card.locator('.worker-stepper strong')).toHaveText('2 台');
      await card.locator('[data-worker-count="3"]').first().click();
    }
  }
  const pager=page.locator('[data-pagination=resources]');
  await expect(pager.locator('button')).toHaveCount(2);
  await pager.locator('button').last().click();await fit();
  await pager.locator('button').first().click();await fit();
}
export async function pickOption(page,selector,value){
  const target=await page.locator(selector).evaluate((select,value)=>{
    const index=[...select.options].findIndex(option=>option.value===value);
    if(index<0)throw Error('Missing select option: '+value);
    return {index,text:select.options[index].text};
  },value);
  await page.locator(selector+'+button').click();
  await page.locator('#choiceSearch').fill(target.text.split(' #')[0]);
  // Entity cards separate their live quantities from the display name. The
  // select's legacy text can include those quantities and cannot be searched.
  // Walk the displayed pages by the option's stable index instead.
  for(let i=0;i<1000&&!await page.locator('[data-choice-option="'+target.index+'"]').count();i++){
    const next=page.locator('[data-choice-step="1"]');
    if(await next.isDisabled())throw Error('Choice is unavailable: '+value);
    await next.click();
  }
  await page.locator('[data-choice-option="'+target.index+'"]').click();
}
export async function checkLastDrop(page,expect,text){
  await page.locator('[data-show-drops]').click();
  await expect(page.locator('[data-last-drops]')).toContainText(text);
  await page.locator('[data-action="close-modal"]').click();
}
