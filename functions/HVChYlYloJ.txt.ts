/** WeChat domain verification file — must return text/plain */
export const onRequest: PagesFunction = () =>
  new Response('6c82b555cf9938b263f6dc7134e2fb33', {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
