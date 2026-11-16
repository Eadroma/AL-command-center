/** French dictionary. `satisfies` makes a missing, extra or mistyped key a compile error. */
import type { RawDictionary } from '../en/index.ts';
import { languages } from '../en/index.ts';
import { attention } from './attention.ts';
import { bar } from './bar.ts';
import { builder } from './builder.ts';
import { classes } from './classes.ts';
import { common } from './common.ts';
import { deploy } from './deploy.ts';
import { errors } from './errors.ts';
import { events } from './events.ts';
import { farming } from './farming.ts';
import { loadouts } from './loadouts.ts';
import { map } from './map.ts';
import { merchant } from './merchant.ts';
import { panel } from './panel.ts';
import { preview } from './preview.ts';
import { profile } from './profile.ts';
import { settings } from './settings.ts';
import { team } from './team.ts';

export const fr = { attention, bar, builder, classes, common, deploy, errors, events, farming, languages, loadouts, map, merchant, panel, preview, profile, settings, team } satisfies RawDictionary;
