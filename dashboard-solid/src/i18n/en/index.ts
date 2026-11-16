/** English dictionary: the reference. Every other language must match its shape exactly. */
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

/** Language names are written in their own language, identical in every dictionary. */
export const languages = {
  fr: 'Français',
  en: 'English',
};

export const en = { attention, bar, builder, classes, common, deploy, errors, events, farming, languages, loadouts, map, merchant, panel, preview, profile, settings, team };

export type RawDictionary = typeof en;
