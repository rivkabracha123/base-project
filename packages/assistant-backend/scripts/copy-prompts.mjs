import { cp, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
//AI script - realtime v1 and V1 to prompts when dist is unvailable
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const sourceDirectory = resolve(scriptDirectory, '../../../prompts');
const destinationDirectory = resolve(scriptDirectory, '../dist/prompts');

await mkdir(destinationDirectory, { recursive: true });
await cp(sourceDirectory, destinationDirectory, { recursive: true });
console.log(`Copied runtime prompts to ${destinationDirectory}`);
