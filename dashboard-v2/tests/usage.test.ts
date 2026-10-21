import { describe, expect, it } from 'vitest';
import { addUsage, freshUsage, localDay, parseUsage, usageRows } from '../src/models/usage';

// Tracking is opt-in; most cases exercise an enabled store.
const enabled = (at: number) => ({ ...freshUsage(at), enabled: true });
const now = new Date(2026,9,21,12).getTime();
describe('local dashboard usage', () => {
  it('keeps unused features visible and separates opens from interactions', () => {
    let data=addUsage(enabled(now),'page.team','opens',now);
    data=addUsage(data,'page.team','interactions',now);
    const rows=usageRows(data,30,now);
    expect(rows.find(row=>row.id==='page.team')).toMatchObject({opens:1,interactions:1,activeDays:1,lastUsed:now});
    expect(rows.find(row=>row.id==='page.bank')).toMatchObject({total:0,lastUsed:0});
  });
  it('does not collect while paused or store unrecognised identifiers', () => {
    const data={...freshUsage(now),enabled:false};
    expect(addUsage(data,'page.team','opens',now)).toBe(data);
    expect(addUsage(enabled(now),'private character or token','opens',now).days).toEqual({});
  });
  it('counts local calendar days and excludes events outside a selected period', () => {
    const earlier=new Date(2026,9,1,12).getTime();
    let data=addUsage(enabled(earlier),'page.team','opens',earlier);
    data=addUsage(data,'page.team','opens',now);
    expect(usageRows(data,7,now).find(row=>row.id==='page.team')?.opens).toBe(1);
    expect(usageRows(data,30,now).find(row=>row.id==='page.team')?.activeDays).toBe(2);
  });
  it('recovers corrupt storage and removes unknown fields, invalid counters and old days', () => {
    expect(parseUsage('{broken',now)).toEqual(freshUsage(now));
    const data=parseUsage(JSON.stringify({version:1,enabled:true,startedAt:now,token:'never retain',days:{
      '2025-01-01':{'page.team':{opens:100,interactions:0,lastUsed:1}},
      [localDay(now)]:{'not-a-feature':{opens:1,interactions:0,lastUsed:now},'page.bank':{opens:-1,interactions:0,lastUsed:now},'page.team':{opens:1,interactions:0,lastUsed:now,secret:'never retain'}},
    }}),now);
    expect(Object.keys(data.days)).toEqual([localDay(now)]);
    expect(JSON.stringify(data)).not.toMatch(/secret|token|never retain|not-a-feature/);
    expect(usageRows(data,90,now).find(row=>row.id==='page.team')?.total).toBe(1);
  });
  it('round-trips data across reloads and keeps its collection start', () => {
    const data=addUsage(enabled(now-10000),'tool.setup','opens',now);
    expect(parseUsage(JSON.stringify(data),now)).toEqual(data);
  });
  it('starts paused and counts nothing until enabled', () => {
    const data = freshUsage(now);
    expect(data.enabled).toBe(false);
    expect(addUsage(data, 'page.team', 'opens', now).days).toEqual({});
  });
  it('falls back to a paused empty state for corrupt storage', () => {
    expect(parseUsage(JSON.stringify({ version: 2 }), now).enabled).toBe(false);
  });
});
