import {describe,it,expect} from 'vitest';
import {realmKey,profileRealm,reportedRealm} from '../server/fleet-health';
describe('realmKey',()=>{
 it('treats EU Europas III as EU III',()=>{
  expect(realmKey('EU Europas III')).toBe(realmKey('EU III'));
  expect(profileRealm({region:'EU',name:'III'})).toBe(reportedRealm({},{stats:{server:'EU Europas III'}}));
 });
});
