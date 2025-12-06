import 'dotenv/config';

/** @type { import("drizzle-kit").Config } */
export default {
  schema: './src/models/*.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DB_URL, 
  },
};