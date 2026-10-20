import { expect, it, vi, afterEach } from 'vitest';
import Fastify from 'fastify';
import { initialProfile, scripts } from '../server/scripts';
import { profileSchema } from '../shared/schema';
import { cautiousProfile } from '../shared/onboarding';
const mocks = vi.hoisted(() => ({ remote: vi.fn(), connectCredential: vi.fn() }));
vi.mock('../server/deploy', () => mocks);
import { onboardingRoute } from '../server/routes/onboarding';
afterEach(() => vi.clearAllMocks());
it('creates a valid cautious profile without mutating an existing profile', () => {
 const base=initialProfile(scripts()), before=structuredClone(base);
 const p=profileSchema.parse(cautiousProfile(base));
 expect(base).toEqual(before);expect(p.onboardingComplete).toBe(false);
 expect(p.characters.every(c=>!c.enabled && !c.events)).toBe(true);
 expect([p.farming.hunts,p.farming.rareVisits,p.farming.dailyDungeon,p.farming.bossChecks.enabled,p.events.enabled,p.seller.buy.enabled,p.seller.upgrade.enabled,p.seller.exchange.enabled,p.seller.craft.enabled,p.seller.ponty.enabled,p.seller.standEnabled,p.seller.npcEnabled,p.seller.bankDeposit.enabled,p.seller.teamSupervisor.enabled]).toEqual(Array(14).fill(false));
 expect(p.seller.buy.orders).toEqual([]);expect(p.seller.upgrade.rules).toEqual([]);
});
it('discovers account characters without returning credentials or starting CODE', async () => {
 mocks.connectCredential.mockResolvedValue({characters:[{character:'NewRanger',class:'ranger',level:20,profile:{private:'discard'}}]});
 const app=Fastify();await app.register(onboardingRoute);
 const response=await app.inject({method:'POST',url:'/api/onboarding/connect',payload:{token:'test-secret'}});
 expect(response.statusCode).toBe(200);expect(response.json()).toEqual({connected:true,characters:[{name:'NewRanger',ctype:'ranger',level:20}]});
 expect(response.body).not.toContain('test-secret');expect(mocks.remote).not.toHaveBeenCalled();await app.close();
});
it('tests existing credentials read-only and rejects malformed input', async () => {
 mocks.remote.mockResolvedValue({characters:[]});const app=Fastify();await app.register(onboardingRoute);
 expect((await app.inject({method:'POST',url:'/api/onboarding/connect',payload:{}})).statusCode).toBe(200);
 expect(mocks.remote).toHaveBeenCalledWith('mainframe_list_characters');
 expect((await app.inject({method:'POST',url:'/api/onboarding/connect',payload:{token:''}})).statusCode).toBe(400);
 await app.close();
});
