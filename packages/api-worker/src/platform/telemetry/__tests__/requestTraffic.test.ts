/** HTTP request traffic metric contract tests. */

import { describe, expect, it, vi } from 'vitest';

import {
  HTTP_REQUEST_EVENT_KIND,
  PREFLIGHT_REQUEST_ROUTE,
  recordHttpRequestTraffic,
  resolveHttpRequestRoute,
  UNMATCHED_REQUEST_ROUTE,
} from '../requestTraffic';

describe('request traffic metrics', () => {
  it.each([
    {
      label: 'preflight requests',
      input: {
        method: 'OPTIONS',
        registeredRoutePath: '*',
      },
      expected: PREFLIGHT_REQUEST_ROUTE,
    },
    {
      label: 'unknown paths',
      input: {
        method: 'GET',
        registeredRoutePath: '*',
      },
      expected: UNMATCHED_REQUEST_ROUTE,
    },
    {
      label: 'registered dynamic routes',
      input: {
        method: 'GET',
        registeredRoutePath: '/admin/rooms/:roomCode/players',
      },
      expected: '/admin/rooms/:roomCode/players',
    },
  ])('normalizes $label', ({ input, expected }) => {
    expect(resolveHttpRequestRoute(input)).toBe(expected);
  });

  it('encodes one completed request using stable positional fields', () => {
    const writeDataPoint = vi.fn<AnalyticsEngineDataset['writeDataPoint']>();
    const dataset: AnalyticsEngineDataset = { writeDataPoint };

    recordHttpRequestTraffic(dataset, {
      method: 'POST',
      route: '/room/command',
      status: 200,
      durationMs: 42,
      country: 'US',
      colo: 'IAD',
      deploymentId: 'deployment-1',
    });

    expect(writeDataPoint).toHaveBeenCalledWith({
      indexes: ['http:/room/command'],
      blobs: [
        HTTP_REQUEST_EVENT_KIND,
        'POST',
        '/room/command',
        '200',
        '2xx',
        'US',
        'IAD',
        'deployment-1',
      ],
      doubles: [42],
    });
  });
});
