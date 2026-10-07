// SPDX-License-Identifier: AGPL-3.0-or-later

import {NETRCOL_MESSAGE_LANGUAGES} from '@fluxer/constants/src/ModuleSettingsConstants';
import {z} from 'zod';

export const ModuleSettings = z.object({message_language: z.enum(NETRCOL_MESSAGE_LANGUAGES)}).strict();
export type ModuleSettings = z.infer<typeof ModuleSettings>;
export const ModuleSettingsResponse = z.object({settings: ModuleSettings, revision: z.number().int().min(0)});
export type ModuleSettingsResponse = z.infer<typeof ModuleSettingsResponse>;
export const ModuleSettingsUpdateRequest = ModuleSettings.extend({revision: z.number().int().min(0)});
export type ModuleSettingsUpdateRequest = z.infer<typeof ModuleSettingsUpdateRequest>;
