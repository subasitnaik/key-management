/**
 * Optional: run default data (admin + test seller). Not required — npm start does this automatically.
 */

import 'dotenv/config';
import { initDb } from '../src/db/index.js';

initDb()
  .then(() => console.log('Done.'))
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
