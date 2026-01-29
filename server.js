/**
 * Local dev server. Uses createApp() and listens.
 * For Vercel/serverless deploy from this directory; Vercel uses the default export from index.js.
 */

import { createApp } from './src/app.js';

const PORT = process.env.PORT || 3000;
const app = createApp();
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Connect auth: POST http://localhost:${PORT}/connect/`);
  console.log(`Seller panel: http://localhost:${PORT}/panel/seller`);
  console.log(`Master admin: http://localhost:${PORT}/panel/admin`);
});
