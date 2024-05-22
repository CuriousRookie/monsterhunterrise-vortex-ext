import { types, util } from 'vortex-api';

import { setFluffyPath } from './actions';

export const mhrReducer: types.IReducerSpec = {
    reducers: {
        [setFluffyPath as any]: (state, payload) => {
            const { fluffyPath } = payload;
            return util.setSafe(state, ['fluffyPath'], fluffyPath);
        }
    },
    defaults: {},
};
