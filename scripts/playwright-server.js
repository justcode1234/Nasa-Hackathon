// Isolated test servers; both use the production data adapters.
import { createApp } from '../server/index.js';
import { createStaticPreview } from './static-preview.js';
const nodeMode=process.argv.includes('--node');
// Two projects on one machine cannot both own 4173/4174, so E2E_PORT moves the pair (the Node server
// takes the next port unless E2E_PORT_NODE says otherwise).
const staticPort=Number(process.env.E2E_PORT ?? 4173);
const port=Number(process.env[nodeMode?'E2E_PORT_NODE':'E2E_PORT'] ?? (nodeMode?staticPort+1:staticPort));
const app=nodeMode?createApp():createStaticPreview();
app.listen(port,'127.0.0.1',()=>console.log(`Playwright ${nodeMode?'Node':'static'} server on ${port}`));
