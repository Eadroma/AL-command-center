import type { Profile } from './schema';
import { automationDefaults } from './automation';

/** First-install template only. Never apply implicitly to an existing profile. */
export function cautiousProfile(base: Profile): Profile {
  const p = structuredClone(base);
  p.name = 'Starter profile'; p.onboardingComplete = false;
  p.automation = structuredClone(automationDefaults);
  p.characters = p.characters.map((c, i) => ({ ...c, name: `Example_${c.ctype}_${i + 1}`, enabled: false, events: false, follow: '', farmMonster: '', overrides: {}, runtime: 'browser' }));
  p.farming.defaultMonster = 'goo'; p.farming.hunts = false; p.farming.allowedHunts = [];
  p.farming.rareVisits = false; p.farming.dailyDungeon = false; p.farming.style = {}; p.farming.loadouts = {};
  p.farming.bossChecks = { enabled: false, rules: [] };
  p.events = { enabled: false, allowed: [], style: {}, expedition: { enabled: false, allowed: ['mrgreen', 'mrpumpkin'], maxMinutes: 20, maxDeaths: 3 } };
  p.seller.buy = { ...p.seller.buy, managed: true, enabled: false, orders: [] };
  p.seller.npcEnabled = false; p.seller.npcItems = []; p.seller.standEnabled = false; p.seller.listings = [];
  p.seller.exchange = { ...p.seller.exchange, enabled: false, items: [] };
  p.seller.upgrade = { ...p.seller.upgrade, enabled: false, rules: [] };
  p.seller.compound = { enabled: false, checkBankOnDeposit: false, rules: [] };
  p.seller.craft = { ...p.seller.craft, enabled: false, rules: [] };
  p.seller.ponty = { ...p.seller.ponty, enabled: false, items: [] };
  p.seller.kit = { enabled: false, rules: [] }; p.seller.consumables = { enabled: false, rules: [] }; p.seller.gifts = { enabled: false, rules: [] };
  p.seller.bankDeposit = { enabled: false, items: [] };
  p.seller.teamSupervisor = { enabled: false, characters: [], soloGuard: false };
  return p;
}
