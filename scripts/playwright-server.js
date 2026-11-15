// Isolated test servers; both use the production data adapters.
import { createApp } from '../server/index.js';
import { createStaticPreview } from './static-preview.js';
const nodeMode=process.argv.includes('--node');
const port=nodeMode?4174:4173;
const app=nodeMode?createApp():createStaticPreview();
app.listen(port,'127.0.0.1',()=>console.log(`Playwright ${nodeMode?'Node':'static'} server on ${port}`));
