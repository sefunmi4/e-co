import { config } from './config.js';
import { createServer } from './index.js';

const app = createServer();

app.listen(config.port, () => {
  console.log(`Ethos Guild server listening on port ${config.port}`);
});
