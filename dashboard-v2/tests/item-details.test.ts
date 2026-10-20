import { expect, it } from 'vitest';
import { initialProfile, scripts } from '../server/scripts';
import { itemLoadoutReservations, itemRuleLinks } from '../src/models/item-details';
import type { Catalog } from '../src/types';
it('retains disabled rules and their exact level, amount and panel links', () => {
  const profile = initialProfile(scripts());
  profile.seller.buy = {...profile.seller.buy,enabled:false,orders:[{item:'ololipop',level:0,quantity:10,price:1000}]};
  expect(itemRuleLinks('ololipop0',profile).find(row=>row.label==='Buy wishlist')).toMatchObject({id:'merchant-buy',enabled:false,detail:'+0 ×10 · 1,000 gold/unit'});
  expect(itemRuleLinks('unknown',profile)).toEqual([]);
});
it('includes craft ingredient reservations independently of ownership', () => {
  const profile = initialProfile(scripts());
  profile.seller.craft = {...profile.seller.craft,enabled:true,rules:[{item:'wingedboots'}]};
  const catalog = {recipes:{wingedboots:{cost:100,ingredients:[{item:'feather0',quantity:20,level:0}]}}} as unknown as Catalog;
  expect(itemRuleLinks('feather0',profile,catalog)).toContainEqual({id:'merchant-craft',label:'Craft ingredient',detail:'20 × +0 for wingedboots',enabled:true});
});
it('shows every custom build requirement and normalizes item aliases', () => {
  const profile = initialProfile(scripts());
  profile.farming.loadouts.Test = {aoe:{gear:[],skills:[]},mono:{gear:[],skills:[]},tank:{gear:[],skills:[]},boss:{gear:[{item:'ololipop',slot:'mainhand',minLevel:7}],skills:[]}};
  expect(itemLoadoutReservations('ololipop0',profile)).toEqual([{character:'Test',style:'boss',slot:'mainhand',minLevel:7}]);
  expect(itemLoadoutReservations('anything')).toEqual([]);
});
