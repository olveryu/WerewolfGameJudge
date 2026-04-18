/** WeChat domain unblock verification file — must return text/plain */
export const onRequest: PagesFunction = () =>
  new Response('3352308f2f8f4cf4a4ffc59399abe8758643f2c8', {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
