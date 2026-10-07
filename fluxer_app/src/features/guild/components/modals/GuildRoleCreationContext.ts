// SPDX-License-Identifier: AGPL-3.0-or-later

import {createContext} from 'react';

export const GuildRoleCreationContext = createContext<((roleId: string) => void) | undefined>(undefined);
