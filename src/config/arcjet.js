import arcjet, { shield, detectBot, slidingWindow } from '@arcjet/node';

const isProd = process.env.NODE_ENV === 'production';

const aj = arcjet({
  key: process.env.ARCJET_KEY,
  rules: [
    shield({ mode: 'LIVE' }),
    // Enable bot detection only in production; disable it in development
    ...(isProd
      ? [
          detectBot({
            mode: 'LIVE',
            allow: ['CATEGORY:SEARCH_ENGINE', 'CATEGORY:PREVIEW'],
          }),
        ]
      : []),
    // Keep a global rate limit enabled in all environments
    slidingWindow({
      mode: 'LIVE',
      interval: '2s',
      max: 5,
    }),
  ],
});

export default aj;
