import { wrapCreateBrowserRouter } from '@sentry/react/react-router';
import { createBrowserRouter } from 'react-router';

import { routes } from '@/app/routes';

const createSentryBrowserRouter = wrapCreateBrowserRouter(createBrowserRouter);

/** Application router; wrapped so Sentry names navigation spans by route pattern. */
export const router = createSentryBrowserRouter(routes);
