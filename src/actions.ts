import { createAction } from "redux-act";

export const setFluffyPath = createAction('MHR_SET_FLUFFY_PATH',
    (fluffyPath: string) => ({ fluffyPath }));
