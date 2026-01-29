/**
 * Local dev server. For Vercel use index.js.
 */
import { createApp } from './app.js';

const PORT = process.env.PORT || 3000;
const app = createApp();
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
